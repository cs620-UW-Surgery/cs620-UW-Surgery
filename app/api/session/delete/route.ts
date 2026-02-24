import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'DATABASE_URL not configured' }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const sessionId = body?.session_id ?? request.cookies.get('session_id')?.value;

  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: 'session_id required' }, { status: 400 });
  }

  await prisma.session.delete({ where: { id: sessionId } }).catch(() => null);

  const response = NextResponse.json({ status: 'deleted' });
  response.cookies.set('session_id', '', { maxAge: 0, path: '/' });
  return response;
}
