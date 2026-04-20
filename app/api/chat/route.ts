import { NextRequest, NextResponse } from 'next/server';
import { runDialogueEngine } from '@/lib/dialogueEngine';
import { runAgentPipeline } from '@/lib/agents/pipeline';
import type { PipelineTrace } from '@/lib/agents/schemas';
import { prisma } from '@/lib/prisma';
import { BASE_DISCLAIMERS } from '@/lib/safety';

export const runtime = 'nodejs';

const DISCLAIMER = `${BASE_DISCLAIMERS[0]} ${BASE_DISCLAIMERS[1]}`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = typeof body?.user_message === 'string' ? body.user_message : '';
    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const sessionId = typeof body?.session_id === 'string' ? body.session_id : request.cookies.get('session_id')?.value;

    // Run agent pipeline before dialogue engine
    let pipelineTrace: PipelineTrace | null = null;
    const agentsEnabled =
      !!process.env.OPENAI_API_KEY &&
      process.env.ENABLE_AGENT_PIPELINE !== 'false' &&
      process.env.NODE_ENV !== 'test';

    if (agentsEnabled) {
      const pipelineResult = await runAgentPipeline(userMessage);
      pipelineTrace = pipelineResult.trace;

      if (pipelineResult.action === 'medical_emergency') {
        return NextResponse.json({
          mode: 'triage',
          assistant_message:
            'What you are describing sounds like it needs help right away.\n\n' +
            'Please call **911** or go to your nearest emergency room now.\n\n' +
            'Do not wait — get help as soon as you can.',
          disclaimer: DISCLAIMER,
          citations: [],
          ui_cards: [],
          suggested_actions: [],
          triage_level: 'emergency',
          pipeline_trace: pipelineTrace
        });
      }

      if (pipelineResult.action === 'block') {
        return NextResponse.json({
          mode: 'faq',
          assistant_message:
            'Sorry, I can only answer questions about adrenal nodules (spots on the adrenal gland). ' +
            'Try asking your question in a different way.\n\n' +
            'If this is an emergency, please call **911**.',
          disclaimer: DISCLAIMER,
          citations: [],
          ui_cards: [],
          suggested_actions: [
            { label: 'Try a different question', action_type: 'quick_reply', payload: { href: null, value: null } }
          ],
          triage_level: 'none',
          pipeline_trace: pipelineTrace
        });
      }

      if (pipelineResult.action === 'clarify') {
        return NextResponse.json({
          mode: 'faq',
          assistant_message: pipelineResult.question,
          disclaimer: DISCLAIMER,
          citations: [],
          ui_cards: [],
          suggested_actions: [
            { label: 'Try a different question', action_type: 'quick_reply', payload: { href: null, value: null } }
          ],
          triage_level: 'none',
          pipeline_trace: pipelineTrace
        });
      }

      // action === 'proceed': continue with original query
    }

    const response = await runDialogueEngine({
      sessionId,
      userMessage,
      clientState: body?.client_state
    });

    // Attach pipeline trace to response
    const responseWithTrace = {
      ...response,
      pipeline_trace: pipelineTrace
    };

    if (sessionId && process.env.DATABASE_URL) {
      const sanitizedUserMessage = userMessage.trim().slice(0, 1200);

      await prisma.session.upsert({
        where: { id: sessionId },
        update: {},
        create: { id: sessionId }
      });

      await prisma.message.create({
        data: {
          sessionId,
          role: 'user',
          contentText: sanitizedUserMessage
        }
      });

      await prisma.message.create({
        data: {
          sessionId,
          role: 'assistant',
          contentJson: responseWithTrace as unknown as object
        }
      });

    }

    return NextResponse.json(responseWithTrace);
  } catch (error) {
    console.error('Chat API error', error);
    return NextResponse.json(
      { error: 'Unable to process request.' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok' });
}
