import { NextResponse } from 'next/server';
import { getKnowledgeChunks } from '@/lib/knowledge';

export const runtime = 'nodejs';

export async function GET() {
  const chunks = await getKnowledgeChunks();
  return NextResponse.json({ chunks });
}
