import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

export const ACTIVE_KB_VERSION = 2;

export type ChunkBbox = {
  page: number;
  l: number;
  t: number;
  r: number;
  b: number;
  pageWidth: number | null;
  pageHeight: number | null;
  coordOrigin: string;
};

export type KnowledgeChunkRecord = {
  id: string;
  sourceDoc: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  text: string;
  rawText: string | null;
  leadSentence: string | null;
  hash: string;
  version: number;
  citationKey: string;
  sectionPath: string[];
  bboxes: ChunkBbox[] | null;
  isTable: boolean;
  isPicture: boolean;
  createdAt: string;
  updatedAt: string;
};

export type RetrievalChunk = {
  chunk_id: string;
  source_doc: string;
  page_range: string | null;
  text_snippet: string;
  lead_sentence: string | null;
  citation_key: string;
  section_path: string[];
  is_table: boolean;
  is_picture: boolean;
  bboxes: ChunkBbox[] | null;
};

let kbStartupLogged = false;
async function logKbVersionOnce() {
  if (kbStartupLogged) return;
  kbStartupLogged = true;
  try {
    const total = await prisma.knowledgeChunk.count({ where: { version: ACTIVE_KB_VERSION } });
    const docs = await prisma.knowledgeChunk.groupBy({
      by: ['sourceDoc'],
      where: { version: ACTIVE_KB_VERSION },
      _count: { _all: true }
    });
    console.log(
      `[knowledge] retrieval active: version=${ACTIVE_KB_VERSION}, ${total} chunks across ${docs.length} documents`
    );
    if (total === 0) {
      console.warn(`[knowledge] WARNING: zero chunks for version=${ACTIVE_KB_VERSION}`);
    }
  } catch (error) {
    console.warn('[knowledge] startup sanity log failed:', (error as Error).message);
  }
}

function chunkRowToRecord(chunk: {
  id: string;
  sourceDoc: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  text: string;
  rawText: string | null;
  leadSentence: string | null;
  hash: string;
  version: number;
  citationKey: string;
  sectionPath: string[];
  bboxes: unknown;
  isTable: boolean;
  isPicture: boolean;
  createdAt: Date;
  updatedAt: Date;
}): KnowledgeChunkRecord {
  return {
    id: chunk.id,
    sourceDoc: chunk.sourceDoc,
    sourcePageStart: chunk.sourcePageStart,
    sourcePageEnd: chunk.sourcePageEnd,
    text: chunk.text,
    rawText: chunk.rawText,
    leadSentence: chunk.leadSentence,
    hash: chunk.hash,
    version: chunk.version,
    citationKey: chunk.citationKey,
    sectionPath: chunk.sectionPath ?? [],
    bboxes: (chunk.bboxes as ChunkBbox[] | null) ?? null,
    isTable: chunk.isTable,
    isPicture: chunk.isPicture,
    createdAt: chunk.createdAt.toISOString(),
    updatedAt: chunk.updatedAt.toISOString()
  };
}

function makeSampleChunk(
  id: string,
  pageStart: number,
  text: string,
  leadSentence: string
): KnowledgeChunkRecord {
  return {
    id,
    sourceDoc: 'Sample knowledge',
    sourcePageStart: pageStart,
    sourcePageEnd: pageStart,
    text,
    rawText: text,
    leadSentence,
    hash: `sample-hash-${id}`,
    version: ACTIVE_KB_VERSION,
    citationKey: `DOC:Sample knowledge|CHUNK:${id}|P:${pageStart}-${pageStart}`,
    sectionPath: [],
    bboxes: null,
    isTable: false,
    isPicture: false,
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01'
  };
}

const SAMPLE_CHUNKS: KnowledgeChunkRecord[] = [
  makeSampleChunk(
    'sample-chunk-001',
    1,
    'Incidental adrenal nodules are often discovered on imaging done for other reasons. Clinics typically confirm imaging details, review prior scans, and check whether the nodule has features that require follow-up. Most workups include a review of symptoms, blood pressure history, and targeted lab testing for hormone overproduction.',
    'Incidental adrenal nodules are often discovered on imaging done for other reasons.'
  ),
  makeSampleChunk(
    'sample-chunk-002',
    2,
    'Common hormonal testing includes a dexamethasone suppression test (DST) for cortisol excess, plasma or urine metanephrines for catecholamine excess, and an aldosterone-renin ratio (ARR) when hypertension or low potassium is present. Timing and medication considerations are often reviewed by the care team.',
    'Common hormonal testing includes a dexamethasone suppression test (DST) for cortisol excess, plasma or urine metanephrines for catecholamine excess, and an aldosterone-renin ratio (ARR) when hypertension or low potassium is present.'
  ),
  makeSampleChunk(
    'sample-chunk-003',
    3,
    'Clinics may provide prep instructions such as taking a prescribed dexamethasone tablet at night before morning labs, avoiding certain supplements before metanephrine testing, or noting current blood pressure medications before ARR testing. Patients should follow their clinician\'s specific instructions.',
    'Clinics may provide prep instructions such as taking a prescribed dexamethasone tablet at night before morning labs, avoiding certain supplements before metanephrine testing, or noting current blood pressure medications before ARR testing.'
  )
];

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

function makeSnippet(text: string, maxLength = 320) {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).trim()}…`;
}

export function buildCitationKey(
  sourceDoc: string,
  chunkId: string,
  pageStart?: number | null,
  pageEnd?: number | null,
  kind?: string
) {
  const pageRange =
    pageStart && pageEnd
      ? `${pageStart}-${pageEnd}`
      : pageStart
      ? `${pageStart}-${pageStart}`
      : 'NA';
  const base = `DOC:${sourceDoc}|CHUNK:${chunkId}|P:${pageRange}`;
  return kind ? `${base}|KIND:${kind}` : base;
}

export function scoreChunkKeyword(query: string, chunkText: string) {
  const tokens = query.toLowerCase().split(/\W+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const haystack = chunkText.toLowerCase();
  return tokens.reduce((score, token) => {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const matches = haystack.match(new RegExp(`\\b${escaped}\\b`, 'g'));
    return score + (matches ? matches.length : 0);
  }, 0);
}

export function rankChunksByKeyword(query: string, chunks: KnowledgeChunkRecord[]) {
  return chunks
    .map((chunk) => ({ chunk, score: scoreChunkKeyword(query, chunk.text) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.chunk.id.localeCompare(b.chunk.id);
    })
    .map((item) => item.chunk);
}

export function cosineSimilarity(a: number[], b: number[]) {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function getQueryEmbedding(query: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: query
  });
  const vector = response.data?.[0]?.embedding;
  return vector ?? null;
}

export async function retrieveRelevantChunks(query: string, k = 4) {
  await logKbVersionOnce();
  const chunks = await getKnowledgeChunks();
  if (chunks.length === 0) {
    return { chunks: [] as RetrievalChunk[] };
  }

  const embeddingsAvailable =
    process.env.DATABASE_URL &&
    !!process.env.OPENAI_API_KEY &&
    (await prisma.knowledgeEmbedding
      .count({ where: { chunk: { version: ACTIVE_KB_VERSION } } })
      .catch(() => 0)) > 0;

  let rankedChunks: KnowledgeChunkRecord[] = [];

  if (embeddingsAvailable) {
    const queryEmbedding = await getQueryEmbedding(query);
    if (queryEmbedding) {
      const embeddings = await prisma.knowledgeEmbedding.findMany({
        where: { chunk: { version: ACTIVE_KB_VERSION } },
        include: { chunk: true }
      });

      const scored = embeddings
        .map((embedding) => ({
          chunk: chunkRowToRecord(embedding.chunk),
          score: cosineSimilarity(queryEmbedding, embedding.vector)
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.chunk.id.localeCompare(b.chunk.id);
        });

      rankedChunks = scored.map((item) => item.chunk);
    } else {
      rankedChunks = rankChunksByKeyword(query, chunks);
    }
  } else {
    rankedChunks = rankChunksByKeyword(query, chunks);
  }

  return {
    chunks: rankedChunks.slice(0, k).map((chunk) => ({
      chunk_id: chunk.id,
      source_doc: chunk.sourceDoc,
      page_range:
        chunk.sourcePageStart && chunk.sourcePageEnd
          ? `${chunk.sourcePageStart}-${chunk.sourcePageEnd}`
          : chunk.sourcePageStart
          ? `${chunk.sourcePageStart}-${chunk.sourcePageStart}`
          : null,
      text_snippet: makeSnippet(chunk.text),
      lead_sentence: chunk.leadSentence,
      citation_key: chunk.citationKey,
      section_path: chunk.sectionPath,
      is_table: chunk.isTable,
      is_picture: chunk.isPicture,
      bboxes: chunk.bboxes
    }))
  };
}

export async function getKnowledgeChunks(
  options: { allVersions?: boolean } = {}
): Promise<KnowledgeChunkRecord[]> {
  if (process.env.DATABASE_URL) {
    try {
      const dbChunks = await prisma.knowledgeChunk.findMany({
        where: options.allVersions ? undefined : { version: ACTIVE_KB_VERSION },
        orderBy: { createdAt: 'desc' }
      });
      if (dbChunks.length > 0) {
        return dbChunks.map(chunkRowToRecord);
      }
    } catch (error) {
      console.warn('Falling back to sample knowledge chunks.', error);
    }
  }

  return SAMPLE_CHUNKS;
}

export async function getChunkById(id: string) {
  // Resolve any chunk by id regardless of version (so historical citations remain valid).
  if (process.env.DATABASE_URL) {
    try {
      const row = await prisma.knowledgeChunk.findUnique({ where: { id } });
      if (row) return chunkRowToRecord(row);
    } catch (error) {
      console.warn('getChunkById DB lookup failed:', (error as Error).message);
    }
  }
  return SAMPLE_CHUNKS.find((chunk) => chunk.id === id) ?? null;
}
