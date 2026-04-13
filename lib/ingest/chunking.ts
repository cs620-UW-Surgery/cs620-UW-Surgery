import { createHash } from 'crypto';
import { decode, encode } from 'gpt-3-encoder';
import OpenAI from 'openai';

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
  minTokens: 256,
  maxTokens: 600,
  targetTokens: 512,
  overlapTokens: 80
};

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

/**
 * Extract the first meaningful sentence from a chunk (8+ words).
 * This sentence is guaranteed to exist verbatim in the source PDF
 * and serves as a reliable fallback for text-based highlighting.
 */
export function extractLeadSentence(text: string): string | null {
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)/g);
  if (!sentences) return null;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    const wordCount = trimmed.split(/\s+/).length;
    if (wordCount >= 8) return trimmed;
  }
  return sentences[0]?.trim() || null;
}

export function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

/**
 * Strip bibliography / references sections from page text.
 * Detects common headings like "References", "Bibliography", "Works Cited"
 * and removes everything after that point on the page.
 */
function stripReferenceSections(pages: PageText[]): PageText[] {
  let referencesStarted = false;
  return pages
    .map((page) => {
      if (referencesStarted) return { ...page, text: '' };
      // Detect a references header (standalone or at start of line)
      const refMatch = page.text.match(
        /(?:^|\n)\s*(References|Bibliography|Works Cited|Literature Cited)\s*(?:\n|$)/i
      );
      if (refMatch?.index !== undefined) {
        referencesStarted = true;
        // Keep text before the references header
        return { ...page, text: page.text.slice(0, refMatch.index).trim() };
      }
      return page;
    })
    .filter((page) => page.text.trim().length > 0);
}

/**
 * Check if a chunk is mostly bibliography/citation content.
 */
function isReferenceChunk(text: string): boolean {
  const etAlCount = (text.match(/et al[.,]/gi) || []).length;
  const numberedRefCount = (text.match(/\d+\.\s+[A-Z][a-z]+\s+[A-Z]/g) || []).length;
  return etAlCount >= 5 || numberedRefCount >= 5;
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

  // Strip bibliography/reference sections before chunking
  const filteredPages = stripReferenceSections(pages);

  const allTokens: number[] = [];
  const tokenPages: number[] = [];

  filteredPages.forEach((page) => {
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

    // Try to snap to a sentence boundary (look back from endIndex for a period/newline)
    if (endIndex < allTokens.length) {
      const searchStart = Math.max(startIndex + settings.minTokens, endIndex - 60);
      let bestBreak = -1;
      for (let j = endIndex; j >= searchStart; j--) {
        const decoded = decode([allTokens[j]]);
        if (/[.!?]\s*$/.test(decoded) || decoded.includes('\n')) {
          bestBreak = j + 1;
          break;
        }
      }
      if (bestBreak > startIndex) {
        endIndex = bestBreak;
      }
    }

    const chunkTokens = allTokens.slice(startIndex, endIndex);
    const pagesSlice = tokenPages.slice(startIndex, endIndex);
    const pageStart = pagesSlice.length ? Math.min(...pagesSlice) : null;
    const pageEnd = pagesSlice.length ? Math.max(...pagesSlice) : null;
    const text = normalizeText(decode(chunkTokens));

    if (text && !isReferenceChunk(text)) {
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

/* ------------------------------------------------------------------ */
/*  Semantic Chunking                                                  */
/*                                                                     */
/*  Splits text at meaning boundaries by comparing embeddings of       */
/*  adjacent segments. When similarity drops below a threshold,        */
/*  a new chunk starts. Uses OpenAI directly (no LangChain).           */
/* ------------------------------------------------------------------ */

const SEGMENT_TARGET_CHARS = 200;
const SEGMENT_MIN_CHARS = 60;
const MAX_CHUNK_CHARS = 1800;
const RELEVANCE_THRESHOLD = 0.3;
const EMBEDDING_BATCH_SIZE = 100;

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

type Segment = {
  text: string;
  pages: number[];
};

/**
 * Break page text into small segments (~200 chars) respecting paragraph
 * and sentence boundaries. Each segment tracks which pages it spans.
 */
function buildSegments(pages: PageText[]): Segment[] {
  const pieces: Segment[] = [];

  for (const page of pages) {
    const rawParagraphs = page.text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    for (const para of rawParagraphs) {
      if (para.length <= SEGMENT_TARGET_CHARS) {
        pieces.push({ text: para, pages: [page.page] });
      } else {
        // Split on newlines, then sentence boundaries
        const subParts = para
          .split(/\n/)
          .flatMap((line) => line.split(/(?<=[.!?])\s+(?=[A-Z])/))
          .filter((s) => s.trim().length > 0);

        let current = '';
        for (const part of subParts) {
          const trimmed = part.trim();
          if (
            current.length + trimmed.length + 1 > SEGMENT_TARGET_CHARS &&
            current.length >= SEGMENT_MIN_CHARS
          ) {
            pieces.push({ text: current, pages: [page.page] });
            current = trimmed;
          } else {
            current = current ? current + ' ' + trimmed : trimmed;
          }
        }
        if (current) pieces.push({ text: current, pages: [page.page] });
      }
    }
  }

  // Merge consecutive tiny pieces
  const segments: Segment[] = [];
  let buffer: Segment | null = null;

  for (const piece of pieces) {
    if (buffer && buffer.text.length + piece.text.length + 1 <= SEGMENT_TARGET_CHARS) {
      buffer.text += '\n' + piece.text;
      for (const p of piece.pages) {
        if (!buffer.pages.includes(p)) buffer.pages.push(p);
      }
    } else if (buffer && buffer.text.length >= SEGMENT_MIN_CHARS) {
      segments.push(buffer);
      buffer = { text: piece.text, pages: [...piece.pages] };
    } else if (buffer) {
      buffer.text = buffer.text + '\n' + piece.text;
      for (const p of piece.pages) {
        if (!buffer.pages.includes(p)) buffer.pages.push(p);
      }
    } else {
      buffer = { text: piece.text, pages: [...piece.pages] };
    }
  }
  if (buffer && buffer.text.length >= SEGMENT_MIN_CHARS) {
    segments.push(buffer);
  } else if (buffer && segments.length > 0) {
    const last = segments[segments.length - 1];
    last.text += '\n' + buffer.text;
    for (const p of buffer.pages) {
      if (!last.pages.includes(p)) last.pages.push(p);
    }
  } else if (buffer) {
    segments.push(buffer);
  }

  return segments;
}

/**
 * Embed texts in batches using OpenAI directly.
 */
async function embedBatched(
  openai: OpenAI,
  texts: string[],
  model: string
): Promise<number[][]> {
  const vectors: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const response = await openai.embeddings.create({ model, input: batch });
    for (const item of response.data) {
      vectors.push(item.embedding);
    }
  }
  return vectors;
}

export type SemanticChunkOptions = {
  embeddingModel?: string;
  maxChunkChars?: number;
  relevanceThreshold?: number;
};

/**
 * Semantic chunking: splits pages at meaning boundaries by comparing
 * embeddings of adjacent segments. Requires an OpenAI API key.
 *
 * Returns the same ChunkResult[] shape as chunkPagesByTokens so the
 * ingest pipeline can use either approach interchangeably.
 */
export async function chunkPagesSemantic(
  pages: PageText[],
  openai: OpenAI,
  options: SemanticChunkOptions = {}
): Promise<ChunkResult[]> {
  const model = options.embeddingModel ?? 'text-embedding-3-small';
  const maxChars = options.maxChunkChars ?? MAX_CHUNK_CHARS;
  const relevanceThresh = options.relevanceThreshold ?? RELEVANCE_THRESHOLD;

  // Step 1: Build small segments from pages
  const segments = buildSegments(pages);

  if (segments.length <= 1) {
    const text = normalizeText(segments[0]?.text ?? '');
    if (!text) return [];
    return [
      {
        text,
        tokenCount: encode(text).length,
        pageStart: segments[0]?.pages[0] ?? null,
        pageEnd: segments[0]?.pages[segments[0].pages.length - 1] ?? null
      }
    ];
  }

  // Step 2: Embed every segment
  const vectors = await embedBatched(
    openai,
    segments.map((s) => s.text),
    model
  );

  // Step 3: Filter noise using centroid similarity
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const vec of vectors) {
    for (let j = 0; j < dim; j++) centroid[j] += vec[j];
  }
  for (let j = 0; j < dim; j++) centroid[j] /= vectors.length;

  const filtered: { segment: Segment; vector: number[] }[] = [];
  for (let i = 0; i < segments.length; i++) {
    if (cosineSimilarity(vectors[i], centroid) >= relevanceThresh) {
      filtered.push({ segment: segments[i], vector: vectors[i] });
    }
  }

  if (filtered.length === 0) {
    // Nothing passed filter — fall back to all segments
    for (let i = 0; i < segments.length; i++) {
      filtered.push({ segment: segments[i], vector: vectors[i] });
    }
  }

  if (filtered.length <= 1) {
    const text = normalizeText(filtered[0]?.segment.text ?? '');
    if (!text) return [];
    const pages0 = filtered[0]?.segment.pages ?? [];
    return [
      {
        text,
        tokenCount: encode(text).length,
        pageStart: pages0[0] ?? null,
        pageEnd: pages0[pages0.length - 1] ?? null
      }
    ];
  }

  // Step 4: Compute adjacent similarities
  const similarities: number[] = [];
  for (let i = 0; i < filtered.length - 1; i++) {
    similarities.push(cosineSimilarity(filtered[i].vector, filtered[i + 1].vector));
  }

  // Step 5: Determine split threshold (25th percentile, min 0.3)
  const sorted = [...similarities].sort((a, b) => a - b);
  const percentile25 = sorted[Math.floor(sorted.length * 0.25)];
  const threshold = Math.max(percentile25, 0.3);

  // Step 6: Group segments into chunks, splitting at low similarity or size limit
  const chunkGroups: Segment[][] = [];
  let currentGroup: Segment[] = [filtered[0].segment];
  let currentLen = filtered[0].segment.text.length;

  for (let i = 0; i < similarities.length; i++) {
    const nextSeg = filtered[i + 1].segment;
    if (similarities[i] < threshold || currentLen + nextSeg.text.length > maxChars) {
      chunkGroups.push(currentGroup);
      currentGroup = [];
      currentLen = 0;
    }
    currentGroup.push(nextSeg);
    currentLen += nextSeg.text.length;
  }
  chunkGroups.push(currentGroup);

  // Step 7: Convert groups to ChunkResult[]
  const chunks: ChunkResult[] = [];
  for (const group of chunkGroups) {
    const text = normalizeText(group.map((s) => s.text).join('\n\n'));
    if (!text) continue;

    const allPages = group.flatMap((s) => s.pages);
    const pageStart = allPages.length > 0 ? Math.min(...allPages) : null;
    const pageEnd = allPages.length > 0 ? Math.max(...allPages) : null;

    chunks.push({
      text,
      tokenCount: encode(text).length,
      pageStart,
      pageEnd
    });
  }

  return chunks;
}
