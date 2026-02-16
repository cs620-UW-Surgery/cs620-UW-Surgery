'use client';

import { useEffect, useState } from 'react';
import type { KnowledgeChunkRecord } from '@/lib/knowledge';

type ChunkResponse = { chunks: KnowledgeChunkRecord[] };

export default function AdminContentPage() {
  const [chunks, setChunks] = useState<KnowledgeChunkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch('/api/admin/chunks');
        const data = (await response.json()) as ChunkResponse;
        if (active) setChunks(data.chunks ?? []);
      } catch (error) {
        console.error('Failed to load chunks', error);
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="grid gap-8">
      <section className="card fade-in">
        <h1 className="font-serif text-3xl text-ink">Knowledge Base</h1>
        <p className="mt-2 text-muted">
          Review the knowledge chunks used for citations. Versioning is tracked per chunk.
        </p>
      </section>

      <section className="grid gap-4">
        {loading && <div className="card">Loading knowledge chunks...</div>}
        {!loading && chunks.length === 0 && (
          <div className="card">No chunks available.</div>
        )}
        {chunks.map((chunk) => (
          <article key={chunk.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-[0.2em] text-moss">{chunk.id}</div>
                <h2 className="mt-2 font-serif text-xl text-ink">{chunk.sourceDoc}</h2>
              </div>
              <div className="badge">v{chunk.version}</div>
            </div>
            <div className="mt-4 text-xs text-muted">
              Source: {chunk.sourceDoc} | Pages:{' '}
              {chunk.sourcePageStart && chunk.sourcePageEnd
                ? `${chunk.sourcePageStart}-${chunk.sourcePageEnd}`
                : chunk.sourcePageStart ?? 'NA'}{' '}
              | Updated: {chunk.updatedAt}
            </div>
            <div className="mt-3 rounded-2xl border border-clay bg-white/70 p-3 text-xs text-ink">
              Citation Key: {chunk.citationKey}
            </div>
            <p className="mt-4 text-sm text-muted whitespace-pre-wrap">{chunk.text}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
