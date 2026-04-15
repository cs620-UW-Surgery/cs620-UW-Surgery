import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { buildCitationKey } from '@/lib/knowledge';

export const DOCLING_VERSION = 2;
export const DOCLING_KIND = 'docling';
const DEFAULT_CHUNKS_DIR = path.resolve(process.cwd(), 'chunks');
const DOCLING_SUFFIX = '_docling.json';

type DoclingBbox = {
  page: number;
  l: number;
  t: number;
  r: number;
  b: number;
  pageWidth: number | null;
  pageHeight: number | null;
  coordOrigin: string;
};

type DoclingChunk = {
  text: string;
  raw_text: string;
  sectionPath: string[];
  isTable: boolean;
  isPicture: boolean;
  bboxes: DoclingBbox[];
  pageStart: number | null;
  pageEnd: number | null;
  tokenCount: number;
};

export type DoclingIngestOptions = {
  chunksDir?: string;
  embeddingModel?: string;
  dryRun?: boolean;
  openai?: OpenAI | null;
};

export type DoclingIngestStats = {
  filesProcessed: number;
  chunksCreated: number;
  chunksSkipped: number;
  embeddingsCreated: number;
  embeddingErrors: number;
};

function hashChunk(sourceDoc: string, chunk: DoclingChunk): string {
  const parts = [
    sourceDoc,
    chunk.pageStart ?? '',
    chunk.sectionPath.join('>'),
    chunk.raw_text.trim()
  ];
  return crypto.createHash('sha256').update(parts.join('::')).digest('hex');
}

function extractLeadSentence(text: string): string | null {
  const sentences = text.match(/[^.!?]*[.!?]+(?:\s|$)/g);
  if (!sentences) return null;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.split(/\s+/).length >= 8) return trimmed;
  }
  return sentences[0]?.trim() || null;
}

async function listDoclingFiles(chunksDir: string): Promise<string[]> {
  const entries = await fs.readdir(chunksDir);
  return entries
    .filter((name) => name.endsWith(DOCLING_SUFFIX))
    .map((name) => path.join(chunksDir, name))
    .sort();
}

function sourceDocFromFile(filePath: string): string {
  return path.basename(filePath).replace(new RegExp(`${DOCLING_SUFFIX}$`), '');
}

export async function ingestDoclingChunks(
  options: DoclingIngestOptions = {}
): Promise<DoclingIngestStats> {
  const chunksDir = options.chunksDir ?? DEFAULT_CHUNKS_DIR;
  const embeddingModel =
    options.embeddingModel ?? process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';
  const openai =
    options.openai ??
    (process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null);

  const stats: DoclingIngestStats = {
    filesProcessed: 0,
    chunksCreated: 0,
    chunksSkipped: 0,
    embeddingsCreated: 0,
    embeddingErrors: 0
  };

  const files = await listDoclingFiles(chunksDir);
  if (files.length === 0) {
    console.warn(`No Docling chunk files found in ${chunksDir}`);
    return stats;
  }

  for (const filePath of files) {
    const sourceDoc = sourceDocFromFile(filePath);
    const raw = await fs.readFile(filePath, 'utf-8');
    const chunks = JSON.parse(raw) as DoclingChunk[];
    if (!Array.isArray(chunks) || chunks.length === 0) {
      console.warn(`Empty or invalid chunk file: ${filePath}`);
      continue;
    }

    console.log(`Ingesting ${sourceDoc} (${chunks.length} chunks)`);
    stats.filesProcessed += 1;

    for (const chunk of chunks) {
      const hash = hashChunk(sourceDoc, chunk);
      const existing = await prisma.knowledgeChunk.findUnique({ where: { hash } });
      if (existing) {
        stats.chunksSkipped += 1;
        continue;
      }

      const chunkId = crypto.randomUUID();
      const citationKey = buildCitationKey(
        sourceDoc,
        chunkId,
        chunk.pageStart,
        chunk.pageEnd,
        DOCLING_KIND
      );

      if (options.dryRun) {
        console.log(`  dry-run: ${citationKey}`);
        stats.chunksSkipped += 1;
        continue;
      }

      const created = await prisma.knowledgeChunk.create({
        data: {
          id: chunkId,
          sourceDoc,
          sourcePageStart: chunk.pageStart,
          sourcePageEnd: chunk.pageEnd,
          text: chunk.text,
          rawText: chunk.raw_text,
          leadSentence: extractLeadSentence(chunk.raw_text),
          hash,
          version: DOCLING_VERSION,
          citationKey,
          sectionPath: chunk.sectionPath ?? [],
          bboxes: chunk.bboxes as unknown as object,
          isTable: !!chunk.isTable,
          isPicture: !!chunk.isPicture
        }
      });
      stats.chunksCreated += 1;

      if (openai) {
        try {
          const response = await openai.embeddings.create({
            model: embeddingModel,
            input: chunk.text
          });
          const vector = response.data?.[0]?.embedding;
          if (vector) {
            await prisma.knowledgeEmbedding.create({
              data: {
                chunkId: created.id,
                model: embeddingModel,
                vector
              }
            });
            stats.embeddingsCreated += 1;
          }
        } catch (error) {
          stats.embeddingErrors += 1;
          console.warn(`  embedding failed for ${created.id}:`, (error as Error).message);
        }
      }
    }
  }

  return stats;
}
