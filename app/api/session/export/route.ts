import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 400 });
  }

  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id') ?? request.cookies.get('session_id')?.value;

  if (!sessionId) {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      checklistItems: { orderBy: { createdAt: 'asc' } }
    }
  });

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  return NextResponse.json({
    session_id: session.id,
    created_at: session.createdAt,
    messages: session.messages,
    checklist_items: session.checklistItems
  });
}
