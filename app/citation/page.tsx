'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';

function CitationViewer() {
  const searchParams = useSearchParams();
  const doc = searchParams.get('doc');
  const page = searchParams.get('page');
  const pageEnd = searchParams.get('pageEnd');
  const quote = searchParams.get('quote');
  const chunkId = searchParams.get('chunkId');
  const [chunkSearchText, setChunkSearchText] = useState<string | null>(null);
  const [chunkLoaded, setChunkLoaded] = useState(!chunkId);

  useEffect(() => {
    if (!chunkId) return;
    fetch(`/api/chunks/${encodeURIComponent(chunkId)}`)
      .then((res) => res.json())
      .then((data) => {
        // Prefer lead sentence for highlighting — it's short and verbatim from the PDF.
        // Fall back to first ~300 chars of chunk text if no lead sentence.
        if (data?.leadSentence) {
          setChunkSearchText(data.leadSentence);
        } else if (data?.text) {
          setChunkSearchText(data.text.slice(0, 300));
        }
      })
      .catch(() => {})
      .finally(() => setChunkLoaded(true));
  }, [chunkId]);

  if (!doc) {
    return (
      <div className="card fade-in">
        <h1 className="font-serif text-3xl text-darkgray">Source Not Found</h1>
        <p className="mt-2 text-muted">No document specified.</p>
      </div>
    );
  }

  const rawPdfUrl = `/api/documents/${encodeURIComponent(doc)}`;
  const directPdfUrl = `${rawPdfUrl}${page ? `#page=${page}` : ''}`;

  // Clean up PDF extraction artifacts before searching
  const rawSearch = chunkSearchText || quote || '';
  const searchText = rawSearch
    .replace(/(\w)- (\w)/g, '$1$2')   // rejoin hyphenated line breaks ("pheochromocy- toma" → "pheochromocytoma")
    .replace(/(\w) - (\w)/g, '$1$2')  // variant with spaces
    .replace(/\s+/g, ' ')
    .trim();

  const viewerParams = new URLSearchParams();
  viewerParams.set('file', rawPdfUrl);
  if (page) viewerParams.set('page', page);
  if (pageEnd) viewerParams.set('pageEnd', pageEnd);
  if (searchText) viewerParams.set('search', searchText);

  const viewerUrl = `/pdfjs-viewer.html?${viewerParams.toString()}`;

  return (
    <div className="grid gap-4">
      {quote && (
        <div className="card fade-in">
          <div className="text-xs uppercase tracking-[0.2em] text-uwred">Referenced Text</div>
          <blockquote className="mt-3 border-l-3 border-uwred/40 pl-4 text-base italic text-darkgray">
            &ldquo;{quote}&rdquo;
          </blockquote>
          <p className="mt-3 text-xs text-muted">
            The highlighted text below corresponds to this reference
            {page ? ` (page ${page})` : ''}.
          </p>
        </div>
      )}

      <div className="card fade-in p-0 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-accent/40">
          <div>
            <div className="font-medium text-darkgray">
              {doc.replace(/\.pdf$/i, '').replace(/_/g, ' ')}
            </div>
            {page && <div className="text-xs text-muted">Page {page}</div>}
          </div>
          <a
            href={directPdfUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full border border-uwred px-4 py-1.5 text-xs font-semibold text-uwred transition hover:bg-uwred hover:text-white"
          >
            Open in New Tab
          </a>
        </div>
        {chunkLoaded ? (
          <iframe
            src={viewerUrl}
            className="w-full border-0"
            style={{ height: 'calc(100vh - 300px)', minHeight: '500px' }}
            title={`PDF viewer: ${doc}`}
          />
        ) : (
          <div className="flex items-center justify-center py-12 text-sm text-muted">
            Loading document...
          </div>
        )}
      </div>
    </div>
  );
}

export default function CitationPage() {
  return (
    <Suspense fallback={<div className="card">Loading...</div>}>
      <CitationViewer />
    </Suspense>
  );
}
