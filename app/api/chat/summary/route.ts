import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ assistant_turn: null });
  }
  const sessionId = request.cookies.get('session_id')?.value;
  if (!sessionId) {
    return NextResponse.json({ assistant_turn: null });
  }

  const message = await prisma.message.findFirst({
    where: { sessionId, role: 'assistant' },
    orderBy: { createdAt: 'desc' }
  });

  return NextResponse.json({ assistant_turn: message?.contentJson ?? null });
}
