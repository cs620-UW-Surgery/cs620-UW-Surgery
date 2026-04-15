"""
Convert PDFs to structured chunks using Docling's HybridChunker.

Outputs JSON array of chunks with:
  - text:         contextualized text (heading hierarchy prepended) — embedded
  - raw_text:     raw chunk text (no heading prefix) — used for display + hashing
  - sectionPath:  list of heading strings (root → leaf)
  - isTable:      true if the chunk's primary doc item is a table
  - bboxes:       [{page, l, t, r, b, pageWidth, pageHeight, coordOrigin}]
  - pageStart, pageEnd, tokenCount

Usage:
  python3 scripts/docling_convert.py                          # all PDFs in Reference documents/
  python3 scripts/docling_convert.py "path/to/specific.pdf"   # single file
  python3 scripts/docling_convert.py --max-tokens 512         # custom token limit
"""

import hashlib
import json
import os
import sys
import glob

from docling.document_converter import DocumentConverter, PdfFormatOption
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import (
    PdfPipelineOptions,
    PictureDescriptionApiOptions,
)
from docling.chunking import HybridChunker
from docling_core.types.doc import TableItem, PictureItem


VLM_PROMPT = (
    "You are extracting clinical content from a medical document figure. "
    "First identify the figure type (flowchart, anatomical diagram, chart/graph, "
    "table, photograph, illustration, etc.). Then produce a faithful textual "
    "representation in markdown: for flowcharts list each step and branch; for "
    "charts/graphs describe axes, data points, and trends; for diagrams label "
    "parts and relationships; for tables reproduce as a markdown table; for "
    "photographs/illustrations describe what is depicted clinically. Preserve "
    "all visible text verbatim, including labels, units, thresholds, and "
    "annotations. Do not infer information not visible in the figure. If the "
    "figure is decorative or unreadable, respond with exactly: SKIP."
)

DEFAULT_PDF_DIR = os.path.join(os.path.dirname(__file__), '..', 'Reference documents')
DEFAULT_OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'chunks')
DEFAULT_MAX_TOKENS = 512
MIN_CHUNK_CHARS = 80

# Section headings that indicate non-clinical metadata content.
# Matched case-insensitively against the leaf (or any) heading in sectionPath.
# Deliberately EXCLUDES "Appendix" because clinical criteria sometimes live there.
JUNK_SECTION_PREFIXES = (
    'reference', 'bibliography', 'works cited', 'literature cited',
    'acknowledgment', 'acknowledgement',
    'disclosure', 'disclaimer',
    'conflict of interest', 'contributor disclosure', 'individual disclosure',
    'funding', 'author contribution',
)


def section_is_junk(section_path) -> bool:
    """True if any heading in sectionPath matches a known non-clinical section."""
    if not section_path:
        return False
    for heading in section_path:
        if not heading:
            continue
        low = heading.strip().lower()
        if any(low.startswith(prefix) for prefix in JUNK_SECTION_PREFIXES):
            return True
    return False


def is_junk_chunk(text: str, section_path=None) -> bool:
    """Filter out metadata, headers, author lists, and other non-clinical content."""
    if section_is_junk(section_path):
        return True

    stripped = text.strip()

    if len(stripped) < MIN_CHUNK_CHARS:
        return True

    if len(stripped) > 20 and stripped.count(' ') / len(stripped) > 0.4:
        return True

    if stripped.startswith('http') or stripped.startswith('www.') or '@' in stripped.split()[0]:
        return True

    junk_patterns = [
        'original investigation', 'available online at', 'doi:', 'reprint requests',
        'address reprint', 'copyright', 'all rights reserved', 'issn ',
        'received for publication', 'accepted for publication',
    ]
    lower = stripped.lower()
    if any(p in lower for p in junk_patterns) and len(stripped) < 300:
        return True

    return False


def extract_bboxes(chunk):
    """Pull (page, l, t, r, b, pageW, pageH, origin) for every prov entry across doc_items."""
    bboxes = []
    if not (hasattr(chunk, 'meta') and hasattr(chunk.meta, 'doc_items')):
        return bboxes

    for item in chunk.meta.doc_items:
        if not hasattr(item, 'prov'):
            continue
        for prov in item.prov:
            page_no = getattr(prov, 'page_no', None)
            bbox = getattr(prov, 'bbox', None)
            if page_no is None or bbox is None:
                continue

            # Page dimensions from the document's pages metadata (if available)
            page_w = None
            page_h = None
            try:
                doc = chunk.meta.origin if hasattr(chunk.meta, 'origin') else None
                # Fallback: read from doc_items' parent doc isn't directly accessible; leave None
            except Exception:
                pass

            coord_origin = getattr(bbox, 'coord_origin', None)
            origin_value = (
                coord_origin.value if hasattr(coord_origin, 'value') else str(coord_origin)
                if coord_origin is not None
                else 'BOTTOMLEFT'
            )

            bboxes.append({
                'page': page_no,
                'l': float(bbox.l),
                't': float(bbox.t),
                'r': float(bbox.r),
                'b': float(bbox.b),
                'pageWidth': page_w,
                'pageHeight': page_h,
                'coordOrigin': origin_value,
            })
    return bboxes


def is_table_ref(item) -> bool:
    return getattr(item, 'self_ref', '').startswith('#/tables/')


def is_picture_ref(item) -> bool:
    return getattr(item, 'self_ref', '').startswith('#/pictures/')


def _ref_index(item) -> int | None:
    try:
        return int(item.self_ref.rsplit('/', 1)[-1])
    except (AttributeError, ValueError):
        return None


def lookup_table(item, doc):
    idx = _ref_index(item)
    if idx is None or not getattr(doc, 'tables', None):
        return None
    return doc.tables[idx] if 0 <= idx < len(doc.tables) else None


def lookup_picture(item, doc):
    idx = _ref_index(item)
    if idx is None or not getattr(doc, 'pictures', None):
        return None
    return doc.pictures[idx] if 0 <= idx < len(doc.pictures) else None


def picture_text_from(picture) -> str:
    """Return non-SKIP annotation text for a PictureItem, joined."""
    annotations = getattr(picture, 'annotations', None) or []
    texts = []
    for ann in annotations:
        text = getattr(ann, 'text', None)
        if text and text.strip().upper() != 'SKIP':
            texts.append(text.strip())
    return '\n\n'.join(texts)


def chunk_is_table(chunk) -> bool:
    items = getattr(getattr(chunk, 'meta', None), 'doc_items', None) or []
    return any(is_table_ref(it) for it in items)


def chunk_is_picture(chunk, doc) -> bool:
    """A chunk counts as a picture chunk only if it contains a PictureItem
    with a usable (non-SKIP) annotation."""
    items = getattr(getattr(chunk, 'meta', None), 'doc_items', None) or []
    for it in items:
        if not is_picture_ref(it):
            continue
        pic = lookup_picture(it, doc)
        if pic and picture_text_from(pic):
            return True
    return False


def build_smart_raw_text(chunk, doc) -> str:
    """Walk doc_items in order, emitting prose for text items, markdown for
    tables, and VLM descriptions for pictures. Tables and pictures appear
    inline alongside surrounding prose (Option A)."""
    items = getattr(getattr(chunk, 'meta', None), 'doc_items', None) or []
    parts: list[str] = []
    for it in items:
        if is_table_ref(it):
            tbl = lookup_table(it, doc)
            if tbl is None:
                continue
            try:
                md = tbl.export_to_markdown(doc=doc)
            except TypeError:
                md = tbl.export_to_markdown()
            if md:
                parts.append(md.strip())
        elif is_picture_ref(it):
            pic = lookup_picture(it, doc)
            if pic is None:
                continue
            text = picture_text_from(pic)
            if text:
                parts.append(text)
        else:
            text = getattr(it, 'text', None)
            if text and text.strip():
                parts.append(text.strip())
    return '\n\n'.join(parts)


def attach_page_dims(bboxes, doc):
    """Backfill pageWidth/Height by looking up doc.pages[page_no].size."""
    pages = getattr(doc, 'pages', None) or {}
    for bb in bboxes:
        page_obj = pages.get(bb['page']) if isinstance(pages, dict) else None
        if page_obj is None:
            continue
        size = getattr(page_obj, 'size', None)
        if size is None:
            continue
        bb['pageWidth'] = float(getattr(size, 'width', 0)) or None
        bb['pageHeight'] = float(getattr(size, 'height', 0)) or None


def build_converter(use_vlm: bool) -> DocumentConverter:
    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_ocr = True
    pipeline_options.images_scale = 2.0
    pipeline_options.generate_picture_images = True

    if use_vlm:
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise RuntimeError('--vlm requires OPENAI_API_KEY in environment')
        pipeline_options.do_picture_description = True
        pipeline_options.enable_remote_services = True
        pipeline_options.picture_description_options = PictureDescriptionApiOptions(
            url='https://api.openai.com/v1/chat/completions',
            headers={'Authorization': f'Bearer {api_key}'},
            params={'model': 'gpt-4o-mini', 'max_tokens': 800},
            prompt=VLM_PROMPT,
            timeout=60.0,
            concurrency=2,
            provenance='openai/gpt-4o-mini',
        )

    return DocumentConverter(
        format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)}
    )


def convert_pdf(file_path: str, max_tokens: int = DEFAULT_MAX_TOKENS, use_vlm: bool = False) -> list[dict]:
    print(f"  Converting: {os.path.basename(file_path)} (vlm={use_vlm})")

    converter = build_converter(use_vlm)
    result = converter.convert(file_path)
    doc = result.document
    seen_hashes: set[str] = set()
    duplicates = 0

    chunker = HybridChunker(max_tokens=max_tokens, merge_peers=True)
    raw_chunks = []
    filtered = 0

    for chunk in chunker.chunk(dl_doc=doc):
        headings = []
        if hasattr(chunk, 'meta') and hasattr(chunk.meta, 'headings'):
            headings = chunk.meta.headings or []

        is_table = chunk_is_table(chunk)
        is_picture = chunk_is_picture(chunk, doc)

        raw = build_smart_raw_text(chunk, doc)
        if not raw.strip():
            raw = chunk.text  # fallback if walked text came up empty

        heading_prefix = '\n'.join(headings) + '\n' if headings else ''
        contextualized = (heading_prefix + raw).strip()

        if is_junk_chunk(contextualized, headings):
            filtered += 1
            continue

        dedupe_key = hashlib.sha256(raw.strip().encode('utf-8')).hexdigest()
        if dedupe_key in seen_hashes:
            duplicates += 1
            continue
        seen_hashes.add(dedupe_key)

        bboxes = extract_bboxes(chunk)
        attach_page_dims(bboxes, doc)

        pages_in_chunk = [bb['page'] for bb in bboxes]
        page_start = min(pages_in_chunk) if pages_in_chunk else None
        page_end = max(pages_in_chunk) if pages_in_chunk else None

        raw_chunks.append({
            'text': contextualized,
            'raw_text': raw,
            'sectionPath': headings,
            'isTable': is_table,
            'isPicture': is_picture,
            'bboxes': bboxes,
            'pageStart': page_start,
            'pageEnd': page_end,
            'tokenCount': len(contextualized.split()),
        })

    print(f"    {len(raw_chunks)} chunks ({filtered} filtered, {duplicates} duplicates)")
    return raw_chunks


def main():
    max_tokens = DEFAULT_MAX_TOKENS
    use_vlm = False
    files = []

    args = sys.argv[1:]
    i = 0
    while i < len(args):
        if args[i] == '--max-tokens' and i + 1 < len(args):
            max_tokens = int(args[i + 1])
            i += 2
        elif args[i] == '--vlm':
            use_vlm = True
            i += 1
        elif args[i].endswith('.pdf'):
            files.append(args[i])
            i += 1
        else:
            i += 1

    if not files:
        files = sorted(glob.glob(os.path.join(DEFAULT_PDF_DIR, '*.pdf')))

    if not files:
        print("No PDF files found.")
        sys.exit(1)

    os.makedirs(DEFAULT_OUTPUT_DIR, exist_ok=True)

    print(f"Docling conversion (max_tokens={max_tokens}, vlm={use_vlm})")
    print(f"Processing {len(files)} files\n")

    for file_path in files:
        source_doc = os.path.basename(file_path)
        chunks = convert_pdf(file_path, max_tokens=max_tokens, use_vlm=use_vlm)

        output_path = os.path.join(DEFAULT_OUTPUT_DIR, f"{source_doc}_docling.json")
        with open(output_path, 'w') as f:
            json.dump(chunks, f, indent=2)

        print(f"    Saved to {output_path}\n")

    print("Done.")


if __name__ == '__main__':
    main()
