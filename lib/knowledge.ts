import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';

export type KnowledgeChunkRecord = {
  id: string;
  sourceDoc: string;
  sourcePageStart: number | null;
  sourcePageEnd: number | null;
  text: string;
  hash: string;
  version: number;
  citationKey: string;
  createdAt: string;
  updatedAt: string;
};

export type RetrievalChunk = {
  chunk_id: string;
  source_doc: string;
  page_range: string | null;
  text_snippet: string;
  citation_key: string;
};

const SAMPLE_CHUNKS: KnowledgeChunkRecord[] = [
  {
    id: 'sample-chunk-001',
    sourceDoc: 'Sample knowledge',
    sourcePageStart: 1,
    sourcePageEnd: 1,
    text:
      'Incidental adrenal nodules are often discovered on imaging done for other reasons. Clinics typically confirm imaging details, review prior scans, and check whether the nodule has features that require follow-up. Most workups include a review of symptoms, blood pressure history, and targeted lab testing for hormone overproduction.',
    hash: 'sample-hash-1',
    version: 1,
    citationKey: 'DOC:Sample knowledge|CHUNK:sample-chunk-001|P:1-1',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01'
  },
  {
    id: 'sample-chunk-002',
    sourceDoc: 'Sample knowledge',
    sourcePageStart: 2,
    sourcePageEnd: 2,
    text:
      'Common hormonal testing includes a dexamethasone suppression test (DST) for cortisol excess, plasma or urine metanephrines for catecholamine excess, and an aldosterone-renin ratio (ARR) when hypertension or low potassium is present. Timing and medication considerations are often reviewed by the care team.',
    hash: 'sample-hash-2',
    version: 1,
    citationKey: 'DOC:Sample knowledge|CHUNK:sample-chunk-002|P:2-2',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01'
  },
  {
    id: 'sample-chunk-003',
    sourceDoc: 'Sample knowledge',
    sourcePageStart: 3,
    sourcePageEnd: 3,
    text:
      'Clinics may provide prep instructions such as taking a prescribed dexamethasone tablet at night before morning labs, avoiding certain supplements before metanephrine testing, or noting current blood pressure medications before ARR testing. Patients should follow their clinician\'s specific instructions.',
    hash: 'sample-hash-3',
    version: 1,
    citationKey: 'DOC:Sample knowledge|CHUNK:sample-chunk-003|P:3-3',
    createdAt: '2026-02-01',
    updatedAt: '2026-02-01'
  }
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
  pageEnd?: number | null
) {
  const pageRange =
    pageStart && pageEnd
      ? `${pageStart}-${pageEnd}`
      : pageStart
      ? `${pageStart}-${pageStart}`
      : 'NA';
  return `DOC:${sourceDoc}|CHUNK:${chunkId}|P:${pageRange}`;
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
  const chunks = await getKnowledgeChunks();
  if (chunks.length === 0) {
    return { chunks: [] as RetrievalChunk[] };
  }

  const embeddingsAvailable =
    process.env.DATABASE_URL &&
    !!process.env.OPENAI_API_KEY &&
    (await prisma.knowledgeEmbedding.count().catch(() => 0)) > 0;

  let rankedChunks: KnowledgeChunkRecord[] = [];

  if (embeddingsAvailable) {
    const queryEmbedding = await getQueryEmbedding(query);
    if (queryEmbedding) {
      const embeddings = await prisma.knowledgeEmbedding.findMany({
        include: { chunk: true }
      });

      rankedChunks = embeddings
        .map((embedding) => ({
          chunk: {
            id: embedding.chunk.id,
            sourceDoc: embedding.chunk.sourceDoc,
            sourcePageStart: embedding.chunk.sourcePageStart,
            sourcePageEnd: embedding.chunk.sourcePageEnd,
            text: embedding.chunk.text,
            hash: embedding.chunk.hash,
            version: embedding.chunk.version,
            citationKey: embedding.chunk.citationKey,
            createdAt: embedding.chunk.createdAt.toISOString(),
            updatedAt: embedding.chunk.updatedAt.toISOString()
          },
          score: cosineSimilarity(queryEmbedding, embedding.vector)
        }))
        .sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score;
          return a.chunk.id.localeCompare(b.chunk.id);
        })
        .map((item) => item.chunk);
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
      citation_key: chunk.citationKey
    }))
  };
}

export async function getKnowledgeChunks(): Promise<KnowledgeChunkRecord[]> {
  if (process.env.DATABASE_URL) {
    try {
      const dbChunks = await prisma.knowledgeChunk.findMany({
        orderBy: { createdAt: 'desc' }
      });
      if (dbChunks.length > 0) {
        return dbChunks.map((chunk) => ({
          id: chunk.id,
          sourceDoc: chunk.sourceDoc,
          sourcePageStart: chunk.sourcePageStart,
          sourcePageEnd: chunk.sourcePageEnd,
          text: chunk.text,
          hash: chunk.hash,
          version: chunk.version,
          citationKey: chunk.citationKey,
          createdAt: chunk.createdAt.toISOString(),
          updatedAt: chunk.updatedAt.toISOString()
        }));
      }
    } catch (error) {
      console.warn('Falling back to sample knowledge chunks.', error);
    }
  }

  return SAMPLE_CHUNKS;
}

export async function getChunkById(id: string) {
  const chunks = await getKnowledgeChunks();
  return chunks.find((chunk) => chunk.id === id) ?? null;
}
