import { NextRequest, NextResponse } from 'next/server';
import { getChunkById } from '@/lib/knowledge';

export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const chunk = await getChunkById(params.id);
  if (!chunk) {
    return NextResponse.json({ error: 'Chunk not found' }, { status: 404 });
  }

  return NextResponse.json({
    id: chunk.id,
    text: chunk.text,
    leadSentence: chunk.leadSentence,
    sourceDoc: chunk.sourceDoc,
    pageStart: chunk.sourcePageStart,
    pageEnd: chunk.sourcePageEnd
  });
}
