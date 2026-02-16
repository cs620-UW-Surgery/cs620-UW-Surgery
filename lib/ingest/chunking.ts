import { createHash } from 'crypto';
import { decode, encode } from 'gpt-3-encoder';

export type PageText = {
  page: number;
  text: string;
};

export type ChunkOptions = {
  minTokens?: number;
  maxTokens?: number;
  targetTokens?: number;
  overlapTokens?: number;
};

export type ChunkResult = {
  text: string;
  tokenCount: number;
  pageStart: number | null;
  pageEnd: number | null;
};

export type ChunkWithHash = ChunkResult & { hash: string };

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  minTokens: 400,
  maxTokens: 800,
  targetTokens: 600,
  overlapTokens: 120
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

export function chunkPagesByTokens(pages: PageText[], options: ChunkOptions = {}) {
  const settings = { ...DEFAULT_OPTIONS, ...options };
  settings.minTokens =
    typeof settings.minTokens === 'number' && Number.isFinite(settings.minTokens)
      ? settings.minTokens
      : DEFAULT_OPTIONS.minTokens;
  settings.maxTokens =
    typeof settings.maxTokens === 'number' && Number.isFinite(settings.maxTokens)
      ? settings.maxTokens
      : DEFAULT_OPTIONS.maxTokens;
  settings.targetTokens =
    typeof settings.targetTokens === 'number' && Number.isFinite(settings.targetTokens)
      ? settings.targetTokens
      : DEFAULT_OPTIONS.targetTokens;
  settings.overlapTokens =
    typeof settings.overlapTokens === 'number' && Number.isFinite(settings.overlapTokens)
      ? settings.overlapTokens
      : DEFAULT_OPTIONS.overlapTokens;
  const allTokens: number[] = [];
  const tokenPages: number[] = [];

  pages.forEach((page) => {
    const normalized = normalizeText(page.text);
    if (!normalized) return;
    const tokens = encode(normalized);
    tokens.forEach((token) => {
      allTokens.push(token);
      tokenPages.push(page.page);
    });
  });

  if (allTokens.length === 0) return [] as ChunkResult[];

  const chunks: ChunkResult[] = [];
  let startIndex = 0;
  while (startIndex < allTokens.length) {
    let endIndex = Math.min(startIndex + settings.targetTokens, allTokens.length);
    if (endIndex - startIndex < settings.minTokens && endIndex < allTokens.length) {
      endIndex = Math.min(startIndex + settings.minTokens, allTokens.length);
    }
    if (endIndex - startIndex > settings.maxTokens) {
      endIndex = startIndex + settings.maxTokens;
    }

    const chunkTokens = allTokens.slice(startIndex, endIndex);
    const pagesSlice = tokenPages.slice(startIndex, endIndex);
    const pageStart = pagesSlice.length ? Math.min(...pagesSlice) : null;
    const pageEnd = pagesSlice.length ? Math.max(...pagesSlice) : null;
    const text = normalizeText(decode(chunkTokens));

    if (text) {
      chunks.push({
        text,
        tokenCount: chunkTokens.length,
        pageStart,
        pageEnd
      });
    }

    if (endIndex >= allTokens.length) break;
    const nextStart = endIndex - settings.overlapTokens;
    if (nextStart <= startIndex) break;
    startIndex = nextStart;
  }

  return chunks;
}

export function dedupeChunksByHash(chunks: ChunkResult[]) {
  const seen = new Set<string>();
  const deduped: ChunkWithHash[] = [];

  for (const chunk of chunks) {
    const hash = hashText(chunk.text);
    if (seen.has(hash)) continue;
    seen.add(hash);
    deduped.push({ ...chunk, hash });
  }

  return deduped;
}
