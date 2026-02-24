import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ messages: [] });
  }
  const sessionId = request.cookies.get('session_id')?.value;
  if (!sessionId) {
    return NextResponse.json({ messages: [] });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { messages: { orderBy: { createdAt: 'asc' } } }
  });

  if (!session) {
    return NextResponse.json({ messages: [] });
  }

  const messages = session.messages.map((message) => {
    const assistantTurn = message.contentJson as { assistant_message?: string } | null;
    return {
      id: message.id,
      role: message.role,
      content: message.contentText ?? assistantTurn?.assistant_message ?? '',
      assistant_turn: message.contentJson ?? null
    };
  });

  return NextResponse.json({ messages });
}
