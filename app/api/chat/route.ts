import { NextRequest, NextResponse } from 'next/server';
import { runDialogueEngine } from '@/lib/dialogueEngine';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userMessage = typeof body?.user_message === 'string' ? body.user_message : '';
    if (!userMessage.trim()) {
      return NextResponse.json({ error: 'Message is required.' }, { status: 400 });
    }

    const sessionId = typeof body?.session_id === 'string' ? body.session_id : request.cookies.get('session_id')?.value;
    const response = await runDialogueEngine({
      sessionId,
      userMessage,
      clientState: body?.client_state
    });

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
          contentJson: response as unknown as object
        }
      });

      const checklistCard = response.ui_cards.find((card) => card.type === 'checklist');
      const checklistItems = checklistCard?.content.checklist ?? [];
      if (checklistItems.length > 0) {
        await Promise.all(
          checklistItems.map((item) =>
            prisma.checklistItem.upsert({
              where: { sessionId_label: { sessionId, label: item.label } },
              update: { status: item.status },
              create: {
                sessionId,
                label: item.label,
                status: item.status
              }
            })
          )
        );
      }
    }

    return NextResponse.json(response);
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
