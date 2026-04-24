# BrailleVision

## Project overview

BrailleVision is a Next.js dashboard (with Supabase Auth/DB) plus a small Python API that together convert documents (manual text, PDFs, images/camera) into Braille.

The current pipeline is **block-based**: pages are segmented into ordered semantic-ish blocks (e.g. headings, paragraphs, equation groups, side notes) before translation, and the UI renders **block-aligned** Original vs Braille.

## Problem statement

Flat OCR/text dumps lose page structure (reading order, side notes, math grouping). This project aims to preserve enough layout to:

- reconstruct a reasonable reading order,
- separate sidebars/notes from main flow,
- group multi-line math derivations,
- present an accessible, reviewable Original ↔ Braille alignment.

## Current architecture

- **Frontend**: Next.js app + dashboard UI, Supabase Auth + Database.
- **PDF extraction (client-side)**: PDF.js text layer is converted into **layout lines with bounding boxes**.
- **Image OCR / Vision**: image text extraction goes through the JS client helper and the Python API.
- **Segmentation**: layout lines → ordered blocks (`pageBlocks`) using bbox heuristics.
- **Translation**:
  - regular text blocks can be sent to the Python API,
  - math-like blocks (`equation_group`) use the local JS Braille conversion.

## Pipeline overview

At a high level:

1. Input chosen in UI (`manual` / `pdf` / `image` / `camera`).
2. Extraction:
   - PDF: text layer → `pageLayouts` (bbox lines) + repaired page text
   - Image/camera: OCR via `lib/extractImageText.js`
3. Processing: `processDocumentInput(...)` produces:
   - `pages` (page texts)
   - `pageBlocks` (per-page blocks from `pageLayouts` or plain text)
4. Translation: per-block conversion, then joined for storage.
5. Review: block-aligned UI for Original vs Braille.

## Key modules/files

- Block IR (types/helpers): `lib/pageBlocks.js`
- Block segmentation + reading order: `lib/pageSegmentation.js`
- PDF layout reconstruction (bbox lines): `lib/pdfTextLayout.js`
- PDF extraction (returns `pageLayouts`): `lib/extractPdfText.js`
- Processing entrypoint (produces `pageBlocks`): `lib/documentProcessing.js`
- Conversion UI entrypoint: `components/UploadPanel.jsx`
- Block-aligned comparison UI: `components/BlockAlignedComparison.jsx`
- Review reader uses block-alignment: `components/dashboard/ConversionReviewReader.jsx`
- Python API server: `app.py`

## How to run the frontend

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## How to run the backend

The Python API runs on port `8000`.

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r requirements.txt
python3 app.py
```

Open `http://localhost:8000`.

## Environment variables

Create `.env.local` for the Next.js app:

```bash
cp .env.local.example .env.local
```

Minimum required (dashboard auth/db):

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Optional (enables higher-quality vision mode where available):

```env
GEMINI_API_KEY=your-gemini-api-key
```

Also run the schema in Supabase:

- `supabase/documents.sql`

## How PDF processing works now

PDF extraction is **layout-first**:

- `extractPdfContent(file)` in `lib/extractPdfText.js` uses PDF.js text items and returns:
  - `text`: full extracted text
  - `pages`: per-page text
  - `pageLayouts`: per-page `{ pageNumber, width, height, lines, source }`

Each `pageLayouts[n].lines` entry comes from `reconstructPdfPageLines(...)` in `lib/pdfTextLayout.js` and has:

- `text`: reconstructed line text
- `kind`: `text` / `math` / `empty`
- `bbox`: `{ x0, y0, x1, y1, space: "pdf" }`

This `pageLayouts` payload is what drives bbox-based ordering and segmentation.

## How block-based page segmentation works

Segmentation lives in `lib/pageSegmentation.js`:

- **Reading order**: `sortLayoutLinesByReadingOrder(lines)` sorts by y (top→bottom) then x (left→right) using bbox.
- **Region detection**: lightweight heuristics split **main flow** vs **sidebars** using bbox width, main-column band detection, and side anchoring.
- **Block building**: lines are grouped into blocks by gaps/indentation + content heuristics.
- **Mixed-content ordering**: final block order is re-sorted across detected regions so margin notes can appear near the relevant main-flow blocks instead of always being appended as one large sidebar chunk.

### Block types

Defined in `PAGE_BLOCK_TYPES` (`lib/pageBlocks.js`). Key ones used today:

- `chapter_header`, `section_header`
- `paragraph`
- `equation_group` (with child `equation_step` blocks)
- `sidebar_note`
- `graph_placeholder`, `table_placeholder` (caption-driven placeholders)
- `figure_caption` (stored as a child on placeholders)

### Equation grouping (`equation_group`)

- Multi-line derivations are grouped into a single `equation_group`.
- Each original line becomes a child block of type `equation_step`.
- The segmenter includes a safeguard to avoid absorbing surrounding prose lines into an equation group.
- Narrow centered equations are kept in the main flow instead of being treated as margin notes.

### Sidebar / graph / table behavior

- Sidebar-ish lines are separated into `sidebar_note` blocks when detected.
- `Figure ...` / `Table ...` caption-like lines create **placeholder blocks**:
  - `graph_placeholder` or `table_placeholder`
  - with a child `figure_caption` containing the caption text
- Caption lines are forced to start their own block so they do not get absorbed into surrounding prose or math runs.

These placeholders do **not** imply real graph/table understanding yet; they are used to preserve structure and reading flow.

## Developer debug inspection

During local development, PDF conversions now expose a **page segmentation inspector** in the upload flow:

- page-by-page view of ordered `pageLayouts` lines
- detected `pageBlocks` with order, type, bbox, confidence, and original content
- a lightweight bbox mini-map showing line and block boundaries
- browser-console payload at `window.__BRAILLEVISION_SEGMENTATION_DEBUG__`

This is intended for tuning a small set of representative textbook pages for demo quality, not as a new persistent architecture layer.

## How translation / Braille flow works

The conversion UI (`components/UploadPanel.jsx`) translates **per block** when `pageBlocks` are available:

- For `equation_group` blocks: uses the local JS converter (`lib/convertToBraille.js`).
- For text blocks:
  - in `text` mode: calls the Python API via `lib/translateBrailleText.js`
  - otherwise falls back to the local converter.

The UI then joins translated blocks using blank lines so the stored `original_text` / `braille_text` remain compatible with older consumers.

## Tests

These commands are known to pass in the current state:

```bash
node --test tests/pageSegmentation.test.mjs
```

```bash
npm run test:pdf-layout
```

Python tests are also available:

```bash
python3 -m unittest -v test_pipeline.py
```

## Known limitations

- Block segmentation is heuristic; complex multi-column textbooks and nested boxes will still fail in edge cases.
- Graph/table handling is currently **placeholder-based** (caption detection), not full semantic understanding.
- Blocks are not yet stored as first-class JSON in the database; review currently re-segments stored text for display.

## Next planned improvements

- Persist `pageBlocks` (and bbox) in storage so review doesn’t need to re-segment.
- Stronger multi-column reading order and boxed-structure detection.
- Improve math reconstruction and block-specific translation strategies.
- Expand segmentation test fixtures to cover more real-world layouts.
