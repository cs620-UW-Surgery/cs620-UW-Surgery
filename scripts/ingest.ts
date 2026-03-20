import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { buildCitationKey } from '../lib/knowledge';
import {
  chunkPagesByTokens,
  chunkPagesSemantic,
  dedupeChunksByHash,
  extractLeadSentence
} from '../lib/ingest/chunking';

const DEFAULT_FILES = [
  'FINAL Adrenal Nodual Workflow Flyer copy.pdf',
  'Adrenal Incidentaloma Practice Guidelines.pdf',
  'Unveiling the Silent Threat_ Disparities in Adrenal Incidentaloma Management.pdf',
  "Diagnosis of Cushing's Syndrome Clinical Practice Guideline.pdf",
  'JAMA Guidelines for Adrenalectomy.pdf',
  'Primary Aldosteronism- An Endocrine Society Clinical Practice Guideline.pdf',
  'primary-aldosteronism Family Medicine Clinical Guidelines.pdf',
  'Emergency_Severity_Index_Handbook.pdf'
].map((name) => path.resolve(process.cwd(), 'Reference documents', name));

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

type Args = {
  paths: string[];
  version: number;
  dryRun: boolean;
  minTokens?: number;
  maxTokens?: number;
  targetTokens?: number;
  overlapTokens?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    paths: [],
    version: 1,
    dryRun: false
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--path' && argv[i + 1]) {
      args.paths.push(argv[i + 1]);
      i += 1;
      continue;
    }
    if (arg === '--paths' && argv[i + 1]) {
      args.paths.push(...argv[i + 1].split(',').map((item) => item.trim()).filter(Boolean));
      i += 1;
      continue;
    }
    if (arg === '--version' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value)) {
        args.version = value;
      }
      i += 1;
      continue;
    }
    if (arg === '--dry-run') {
      args.dryRun = true;
      continue;
    }
    if (arg === '--minTokens' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value)) {
        args.minTokens = value;
      }
      i += 1;
      continue;
    }
    if (arg === '--maxTokens' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value)) {
        args.maxTokens = value;
      }
      i += 1;
      continue;
    }
    if (arg === '--targetTokens' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value)) {
        args.targetTokens = value;
      }
      i += 1;
      continue;
    }
    if (arg === '--overlapTokens' && argv[i + 1]) {
      const value = Number(argv[i + 1]);
      if (!Number.isNaN(value)) {
        args.overlapTokens = value;
      }
      i += 1;
      continue;
    }
  }

  if (args.paths.length === 0) {
    args.paths = DEFAULT_FILES;
  }

  return args;
}

async function extractPdfPages(filePath: string) {
  const buffer = await fs.readFile(filePath);
  const pages: { page: number; text: string }[] = [];

  await pdf(buffer, {
    pagerender: async (pageData) => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items
        .map((item: any) => (typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ');
      pages.push({ page: pageData.pageIndex + 1, text: pageText });
      return pageText + '\n\n';
    }
  });

  const normalizeText = (text: string) => text.replace(/\s+/g, ' ').trim();
  const hasText = pages.some((page) => normalizeText(page.text).length > 0);
  if (hasText) {
    return pages.sort((a, b) => a.page - b.page);
  }

  // Fallback: use full-document text if per-page extraction yields nothing.
  const fallback = await pdf(buffer);
  const cleaned = normalizeText(fallback.text ?? '');
  if (!cleaned) return [];

  const totalPages = fallback.numpages ?? 1;
  if (totalPages <= 1) {
    return [{ page: 1, text: cleaned }];
  }

  const approxPageSize = Math.ceil(cleaned.length / totalPages);
  const fallbackPages = Array.from({ length: totalPages }, (_, index) => {
    const slice = cleaned.slice(index * approxPageSize, (index + 1) * approxPageSize).trim();
    return { page: index + 1, text: slice };
  }).filter((page) => page.text.length > 0);

  if (fallbackPages.length > 0) {
    console.warn(
      `Warning: Could not extract per-page text for ${path.basename(
        filePath
      )}. Using approximate page splits.`
    );
  }

  return fallbackPages;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is required for ingestion.');
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

  let totalCreated = 0;
  let totalSkipped = 0;

  for (const filePath of args.paths) {
    const sourceDoc = path.basename(filePath);
    try {
      await fs.access(filePath);
    } catch {
      console.warn(`Skipping missing file: ${filePath}`);
      continue;
    }

    console.log(`Ingesting: ${sourceDoc}`);
    const pages = await extractPdfPages(filePath);

    // Use token-based recursive chunking (512-token target with sentence boundary snapping)
    const chunks = chunkPagesByTokens(pages, {
      minTokens: args.minTokens,
      maxTokens: args.maxTokens,
      targetTokens: args.targetTokens,
      overlapTokens: args.overlapTokens
    });
    console.log(`  ${chunks.length} chunks (token-based, target 512)`);
    const deduped = dedupeChunksByHash(chunks);
    if (deduped.length === 0) {
      console.warn(
        `No chunks created for ${sourceDoc}. Check PDF text extraction or chunk settings.`
      );
      continue;
    }

    for (const chunk of deduped) {
      const existing = await prisma.knowledgeChunk.findUnique({
        where: { hash: chunk.hash }
      });
      if (existing) {
        // Backfill embedding if chunk exists but has no embedding
        if (openai) {
          const hasEmbedding = await prisma.knowledgeEmbedding.findUnique({
            where: { chunkId: existing.id }
          });
          if (!hasEmbedding) {
            try {
              const embeddingResponse = await openai.embeddings.create({
                model: EMBEDDING_MODEL,
                input: existing.text
              });
              const vector = embeddingResponse.data?.[0]?.embedding;
              if (vector) {
                await prisma.knowledgeEmbedding.create({
                  data: {
                    chunkId: existing.id,
                    model: EMBEDDING_MODEL,
                    vector
                  }
                });
                console.log(`  Backfilled embedding for ${existing.id}`);
              }
            } catch (error) {
              console.warn(`  Embedding backfill failed for ${existing.id}:`, error);
            }
          }
        }
        totalSkipped += 1;
        continue;
      }

      const chunkId = crypto.randomUUID();
      const citationKey = buildCitationKey(
        sourceDoc,
        chunkId,
        chunk.pageStart,
        chunk.pageEnd
      );

      if (args.dryRun) {
        console.log(`Dry run: ${citationKey}`);
        totalSkipped += 1;
        continue;
      }

      const leadSentence = extractLeadSentence(chunk.text);

      const created = await prisma.knowledgeChunk.create({
        data: {
          id: chunkId,
          sourceDoc,
          sourcePageStart: chunk.pageStart,
          sourcePageEnd: chunk.pageEnd,
          text: chunk.text,
          leadSentence,
          hash: chunk.hash,
          version: args.version,
          citationKey
        }
      });
      totalCreated += 1;

      if (openai) {
        try {
          const embeddingResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: chunk.text
          });
          const vector = embeddingResponse.data?.[0]?.embedding;
          if (vector) {
            await prisma.knowledgeEmbedding.create({
              data: {
                chunkId: created.id,
                model: EMBEDDING_MODEL,
                vector
              }
            });
          }
        } catch (error) {
          console.warn(`Embedding failed for ${created.id}:`, error);
        }
      }
    }
  }

  console.log(`Ingestion complete. Created: ${totalCreated}, Skipped: ${totalSkipped}`);
  await prisma.$disconnect();
}

main().catch(async (error) => {
  console.error('Ingestion failed:', error);
  await prisma.$disconnect();
  process.exit(1);
});
