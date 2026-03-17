import { createHash } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { encode } from 'gpt-3-encoder';
import OpenAI from 'openai';

export type PageText = { page: number; text: string; title?: string };

export type ChunkOptions = {
  maxTokens?: number;
  similarityThreshold?: number;
  saveDir?: string;
  outputFileName?: string;
  minTokenForMerge?: number;
  skipHeaderPages?: number;
  mergeReferences?: boolean;
  referencesPerChunk?: number;
  minChunkTokens?: number;
};

export type ChunkResult = {
  text: string;
  tokenCount: number;
  pageStart: number | null;
  pageEnd: number | null;
  hash: string;
};

const DEFAULT_OPTIONS: Required<ChunkOptions> = {
  maxTokens: 450,
  similarityThreshold: 0.78,
  saveDir: './chunks',
  outputFileName: 'semantic_chunks.json',
  minTokenForMerge: 20,
  skipHeaderPages: 2,
  mergeReferences: true,
  referencesPerChunk: 2,
  minChunkTokens: 40,
};

function normalizeText(text: string) {
  return text
    .replace(/U\.\s*S\./g, 'U.S.')
    .replace(/\.{3,}/g, ' ')  
    .replace(/\s+/g, ' ')
    .trim();
}

function isNoise(text: string) {
  if (!text) return true;
  if (/^\.+$/.test(text)) return true;
  if (text.length < 5) return true;
  if (/copyright|all rights reserved/i.test(text)) return true;
  return false;
}

function splitIntoSentences(text: string) {
  return text
    .split(/(?<=[.!?])\s+|\n+|(?<=:)\s+/)
    .map(s => s.trim())
    .filter(Boolean);
}

function hardSplitByTokens(text: string, maxTokens: number) {
  const words = text.split(' ');
  const results: string[] = [];

  let buffer = '';

  for (const w of words) {
    const test = buffer ? buffer + ' ' + w : w;

    if (encode(test).length > maxTokens) {
      if (buffer) {
        results.push(buffer.trim());
        buffer = w;
      } else {
        results.push(w);
        buffer = '';
      }
    } else {
      buffer = test;
    }
  }

  if (buffer) results.push(buffer.trim());

  return results;
}

function pushChunk(chunks: ChunkResult[], text: string, pages: number[], maxTokens: number) {
  const safeChunks = hardSplitByTokens(text, maxTokens);

  for (const c of safeChunks) {
    const tokens = encode(c).length;
    if (tokens > maxTokens) {
      const mid = Math.floor(c.length / 2);
      pushChunk(chunks, c.slice(0, mid), pages, maxTokens);
      pushChunk(chunks, c.slice(mid), pages, maxTokens);
      continue;
    }
    chunks.push({
      text: c,
      tokenCount: tokens,
      pageStart: Math.min(...pages),
      pageEnd: Math.max(...pages),
      hash: hashText(c),
    });
  }
}

export function hashText(text: string) {
  return createHash('sha256').update(text).digest('hex');
}

function cosineSimilarity(a: number[], b: number[]) {
  const dot = a.reduce((sum, val, i) => sum + val * b[i], 0);
  const normA = Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));
  const normB = Math.sqrt(b.reduce((sum, val) => sum + val * val, 0));
  return dot / (normA * normB);
}

function averageEmbedding(embeddings: number[][]): number[] {
  const dims = embeddings[0].length;
  const avg = new Array(dims).fill(0);

  for (const e of embeddings) {
    for (let i = 0; i < dims; i++) {
      avg[i] += e[i];
    }
  }

  for (let i = 0; i < dims; i++) {
    avg[i] /= embeddings.length;
  }

  return avg;
}

export async function semanticChunkPages(
  pages: PageText[],
  openai: OpenAI,
  options: ChunkOptions = {}
): Promise<ChunkResult[]> {

  const settings = { ...DEFAULT_OPTIONS, ...options };
  const effectiveSkipHeaderPages =
    pages.length <= settings.skipHeaderPages ? 0 : settings.skipHeaderPages;
  const sentences: { text: string; page: number }[] = [];

  // Sentence Extraction
  for (const page of pages) {

    if (page.page <= effectiveSkipHeaderPages) continue;

    const normalized = normalizeText(page.text);
    if (!normalized) continue;

    const isReference = /references|bibliography/i.test(normalized);

    if (settings.mergeReferences && isReference) {

      const refs = normalized.split(/\)\.\s+/);

      for (let i = 0; i < refs.length; i += settings.referencesPerChunk) {

        const chunk = refs.slice(i, i + settings.referencesPerChunk).join('). ');

        const safeChunks = hardSplitByTokens(chunk, settings.maxTokens);

        for (const c of safeChunks) {
          if (!isNoise(c)) {
            sentences.push({ text: c.trim(), page: page.page });
          }
        }
      }

      continue;
    }

    const rawSentences = splitIntoSentences(normalized);

    let buffer = '';

    for (const s of rawSentences) {

      if (isNoise(s)) continue;

      const tokenLen = encode(s).length;

      if (tokenLen < settings.minTokenForMerge) {

        buffer += ' ' + s;

      } else {

        if (buffer) {
          sentences.push({ text: buffer.trim(), page: page.page });
          buffer = '';
        }

        const safe = hardSplitByTokens(s, settings.maxTokens);

        for (const part of safe) {
          sentences.push({ text: part.trim(), page: page.page });
        }
      }
    }

    if (buffer) {
      sentences.push({ text: buffer.trim(), page: page.page });
    }
  }

  if (!sentences.length) return [];

  // Embeddings
  const inputs = sentences.map(s => s.text);
  const embeddings: number[][] = [];

  for (let i = 0; i < inputs.length; i += 50) {

    const batch = inputs.slice(i, i + 50);

    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: batch,
    });

    embeddings.push(...response.data.map(d => d.embedding));
  }

  // Semantic Chunking
  const chunks: ChunkResult[] = [];

  let currentTexts: string[] = [];
  let currentPages: number[] = [];
  let currentEmbeddings: number[][] = [];
  let currentTokenCount = 0;

  const softMaxTokens = settings.maxTokens * 0.8;

  for (let i = 0; i < inputs.length; i++) {

    const sentence = inputs[i];
    const sentenceEmbedding = embeddings[i];
    const sentenceTokens = encode(sentence).length;

    const candidateTokenCount = currentTokenCount + sentenceTokens;

    let similarity = 1;

    if (currentEmbeddings.length > 0) {
      const avg = averageEmbedding(currentEmbeddings);
      similarity = cosineSimilarity(avg, sentenceEmbedding);
    }

    const shouldSplit =
      currentTexts.length > 0 &&
      (
        similarity < settings.similarityThreshold ||
        candidateTokenCount > settings.maxTokens ||
        (candidateTokenCount > softMaxTokens && similarity < 0.85)
      );

    if (shouldSplit) {

      if (currentTokenCount < settings.minChunkTokens) {
        if (candidateTokenCount <= settings.maxTokens) {
          currentTexts.push(sentence);
          currentPages.push(sentences[i].page);
          currentEmbeddings.push(sentenceEmbedding);
          currentTokenCount = candidateTokenCount;
          continue;
        }
      }

      if (currentTokenCount > 0) {
        const finalText = currentTexts.join(' ');
        pushChunk(chunks, finalText, currentPages, settings.maxTokens);
      }

      currentTexts = [sentence];
      currentPages = [sentences[i].page];
      currentEmbeddings = [sentenceEmbedding];
      currentTokenCount = sentenceTokens;

    } else {

      currentTexts.push(sentence);
      currentPages.push(sentences[i].page);
      currentEmbeddings.push(sentenceEmbedding);
      currentTokenCount = candidateTokenCount;
    }
  }

  // final flush
  if (currentTexts.length) {
    const finalText = currentTexts.join(' ');
    pushChunk(chunks, finalText, currentPages, settings.maxTokens);
  }

  // Save
  await fs.mkdir(settings.saveDir, { recursive: true });

  await fs.writeFile(
    path.join(settings.saveDir, settings.outputFileName),
    JSON.stringify(chunks, null, 2)
  );

  return chunks;
}
