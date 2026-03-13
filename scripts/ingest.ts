import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import { prisma } from '../lib/prisma';
import { buildCitationKey } from '../lib/knowledge';
import { semanticChunkPages, PageText } from '../lib/ingest/chunking';

const PDF_DIR = path.join(__dirname, '..', 'Reference documents', 'Emergency Symptoms for Escalation');

const EMBEDDING_MODEL = process.env.OPENAI_EMBEDDING_MODEL ?? 'text-embedding-3-small';

type Args = {
  version: number;
  dryRun: boolean;
  maxTokens?: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { version: 1, dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--version' && argv[i + 1]) { const v = Number(argv[i + 1]); if (!isNaN(v)) args.version = v; i++; }
    if (arg === '--dry-run') { args.dryRun = true; }
    if (arg === '--maxTokens' && argv[i + 1]) { const v = Number(argv[i + 1]); if (!isNaN(v)) args.maxTokens = v; i++; }
  }
  return args;
}

async function getAllPdfFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await getAllPdfFiles(fullPath));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.pdf')) {
      files.push(fullPath);
    }
  }
  return files;
}

async function extractPdfPages(filePath: string): Promise<PageText[]> {
  const buffer = await fs.readFile(filePath);
  const pages: PageText[] = [];

  await pdf(buffer, {
    pagerender: async pageData => {
      const textContent = await pageData.getTextContent();
      const pageText = textContent.items
        .map((item: any) => typeof item.str === 'string' ? item.str : '')
        .filter(Boolean)
        .join(' ');
      pages.push({ page: pageData.pageIndex + 1, text: pageText });
      return pageText + '\n\n';
    }
  });

  if (pages.some(p => p.text.trim().length > 0)) return pages.sort((a, b) => a.page - b.page);

  const fallback = await pdf(buffer);
  const cleaned = (fallback.text ?? '').replace(/\s+/g, ' ').trim();
  const totalPages = fallback.numpages ?? 1;
  const approxPageSize = Math.ceil(cleaned.length / totalPages);
  return Array.from({ length: totalPages }, (_, idx) => {
    const slice = cleaned.slice(idx * approxPageSize, (idx + 1) * approxPageSize).trim();
    return { page: idx + 1, text: slice };
  }).filter(p => p.text.length > 0);
}

async function ingestFile(filePath: string, openai: OpenAI, version: number, dryRun: boolean, maxTokens?: number) {
  const sourceDoc = path.basename(filePath);
  try { await fs.access(filePath); } 
  catch { console.warn(`Skipping missing file: ${filePath}`); return { created: 0, skipped: 0 }; }

  const pages = await extractPdfPages(filePath);
  if (!pages.length) { console.warn(`No text extracted from ${sourceDoc}`); return { created: 0, skipped: 0 }; }

  const chunks = await semanticChunkPages(pages, openai, {
    similarityThreshold: 0.75,
    maxTokens: maxTokens ?? 800,
    outputFileName: `${sourceDoc}_semantic.json`
  });

  let totalCreated = 0, totalSkipped = 0;

  for (const chunk of chunks) {
    const exists = await prisma.knowledgeChunk.findUnique({ where: { hash: chunk.hash } });
    if (exists) { totalSkipped++; continue; }

    const chunkId = crypto.randomUUID();
    const citationKey = buildCitationKey(sourceDoc, chunkId, chunk.pageStart, chunk.pageEnd);

    if (dryRun) { console.log(`[Dry Run] ${citationKey}`); totalSkipped++; continue; }

    const created = await prisma.knowledgeChunk.create({
      data: { id: chunkId, sourceDoc, sourcePageStart: chunk.pageStart, sourcePageEnd: chunk.pageEnd, text: chunk.text, hash: chunk.hash, version, citationKey }
    });
    totalCreated++;

    try {
      const embeddingRes = await openai.embeddings.create({ model: EMBEDDING_MODEL, input: chunk.text });
      const vector = embeddingRes.data?.[0]?.embedding;
      if (vector) await prisma.knowledgeEmbedding.create({ data: { chunkId: created.id, model: EMBEDDING_MODEL, vector } });
    } catch (err) { console.warn(`Embedding failed for ${chunkId}:`, err); }
  }

  return { created: totalCreated, skipped: totalSkipped };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!process.env.DATABASE_URL || !process.env.OPENAI_API_KEY) { console.error('DATABASE_URL and OPENAI_API_KEY required'); process.exit(1); }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const pdfFiles = await getAllPdfFiles(PDF_DIR);

  let totalCreated = 0, totalSkipped = 0;

  for (const filePath of pdfFiles) {
    const res = await ingestFile(filePath, openai, args.version, args.dryRun, args.maxTokens);
    totalCreated += res.created;
    totalSkipped += res.skipped;
  }

  console.log(`Ingestion complete. Created: ${totalCreated}, Skipped: ${totalSkipped}`);
  await prisma.$disconnect();
}

main().catch(async error => { console.error('Ingestion failed:', error); await prisma.$disconnect(); process.exit(1); });