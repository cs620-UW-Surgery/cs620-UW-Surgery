export type ParsedCitation = {
  sourceDoc: string;
  chunkId: string;
  pageStart: number | null;
  pageEnd: number | null;
  kind: string | null;
  displayTitle: string;
  pageLabel: string;
  pdfPath: string;
  viewerPath: string;
};

const DOC_DISPLAY_NAMES: Record<string, string> = {
  'Adrenal Nodule Workflow UW.pdf': 'UW Adrenal Nodule Workflow',
  'FINAL Adrenal Nodual Workflow Flyer copy.pdf': 'UW Adrenal Nodule Workflow',
  'Adrenal Incidentaloma Practice Guidelines.pdf': 'Adrenal Incidentaloma Practice Guidelines',
  "Diagnosis of Cushing's Syndrome Clinical Practice Guideline.pdf": "Cushing's Syndrome Clinical Practice Guideline",
  'JAMA Guidelines for Adrenalectomy.pdf': 'JAMA Guidelines for Adrenalectomy',
  'Primary Aldosteronism- An Endocrine Society Clinical Practice Guideline.pdf': 'Primary Aldosteronism (Endocrine Society Guideline)',
  'primary-aldosteronism Family Medicine Clinical Guidelines.pdf': 'Primary Aldosteronism (Family Medicine Guidelines)',
  'Emergency_Severity_Index_Handbook.pdf': 'Emergency Severity Index Handbook',
  'Unveiling the Silent Threat_ Disparities in Adrenal Incidentaloma Management.pdf': 'Disparities in Adrenal Incidentaloma Management'
};

export function parseCitationKey(citationKey: string): ParsedCitation | null {
  const match = citationKey.match(/^DOC:(.+?)\|CHUNK:(.+?)\|P:([^|]+)(?:\|KIND:(.+))?$/);
  if (!match) return null;

  const sourceDoc = match[1];
  const chunkId = match[2];
  const pageRange = match[3];
  const kind = match[4] ?? null;

  let pageStart: number | null = null;
  let pageEnd: number | null = null;
  if (pageRange && pageRange !== 'NA') {
    const parts = pageRange.split('-').map(Number);
    pageStart = Number.isFinite(parts[0]) ? parts[0] : null;
    pageEnd = Number.isFinite(parts[1]) ? parts[1] : null;
  }

  const displayTitle =
    DOC_DISPLAY_NAMES[sourceDoc] ??
    sourceDoc.replace(/\.pdf$/i, '').replace(/_/g, ' ');

  const pageLabel =
    pageStart && pageEnd
      ? pageStart === pageEnd
        ? `p. ${pageStart}`
        : `pp. ${pageStart}-${pageEnd}`
      : '';

  const pageAnchor = pageStart ? `#page=${pageStart}` : '';
  const pdfPath = sourceDoc.endsWith('.pdf')
    ? `/api/documents/${encodeURIComponent(sourceDoc)}${pageAnchor}`
    : '';

  const viewerParams = new URLSearchParams();
  viewerParams.set('doc', sourceDoc);
  if (pageStart) viewerParams.set('page', String(pageStart));
  if (pageEnd && pageEnd !== pageStart) viewerParams.set('pageEnd', String(pageEnd));

  const viewerPath = sourceDoc.endsWith('.pdf')
    ? `/citation?${viewerParams.toString()}`
    : '';

  return {
    sourceDoc,
    chunkId,
    pageStart,
    pageEnd,
    kind,
    displayTitle,
    pageLabel,
    pdfPath,
    viewerPath
  };
}
