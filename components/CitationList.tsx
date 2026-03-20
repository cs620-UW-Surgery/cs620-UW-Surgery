import type { AssistantTurn } from '@/lib/schemas';
import { parseCitationKey } from '@/lib/citationUtils';

type CitationListProps = {
  citations: AssistantTurn['citations'];
  leadSentences?: Record<string, string>;
};

export default function CitationList({ citations, leadSentences }: CitationListProps) {
  if (!citations.length) return null;

  return (
    <div>
      <div className="font-semibold text-darkgray">Sources</div>
      <ul className="mt-2 space-y-2">
        {citations.map((item) => {
          const parsed = parseCitationKey(item.citation_key);
          if (!parsed) {
            return (
              <li key={`${item.citation_key}-${item.quote ?? 'none'}`} className="text-sm">
                {item.citation_key}
              </li>
            );
          }

          // Use the LLM quote if available, otherwise fall back to the
          // lead sentence from the chunk (which is verbatim from the PDF).
          const searchText = item.quote || leadSentences?.[item.citation_key] || '';

          const cardContent = (
            <>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-medium text-darkgray">{parsed.displayTitle}</span>
                  {parsed.pageLabel && (
                    <span className="ml-2 text-xs text-muted">({parsed.pageLabel})</span>
                  )}
                </div>
                {parsed.viewerPath && (
                  <span className="shrink-0 rounded-full border border-uwred px-3 py-1 text-xs font-semibold text-uwred transition group-hover:bg-uwred group-hover:text-white">
                    View Source
                  </span>
                )}
              </div>
              {item.quote ? (
                <blockquote className="mt-2 border-l-2 border-uwred/30 pl-3 text-sm text-darkgray/80">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>
              ) : (
                <p className="mt-1 text-xs text-muted">
                  Click to view the referenced section in the source document.
                </p>
              )}
            </>
          );

          const viewerHref = parsed.viewerPath
            ? `${parsed.viewerPath}&chunkId=${encodeURIComponent(parsed.chunkId)}${searchText ? `&quote=${encodeURIComponent(searchText)}` : ''}`
            : '';

          return viewerHref ? (
            <li key={`${item.citation_key}-${item.quote ?? 'none'}`}>
              <a
                href={viewerHref}
                className="group block rounded-xl border border-accent/60 bg-white/70 p-3 transition hover:border-uwred/40 hover:shadow-sm"
              >
                {cardContent}
              </a>
            </li>
          ) : (
            <li
              key={`${item.citation_key}-${item.quote ?? 'none'}`}
              className="rounded-xl border border-accent/60 bg-white/70 p-3"
            >
              {cardContent}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
