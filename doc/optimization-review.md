# doff Optimization Review

Author: Codex
Date: March 22, 2026
Status: Draft v1

## Review Scope

I reviewed the main application shell, feature modules, shared state, and build configuration. I also ran `npm run build` to capture actual bundle and cache costs.

## Build Snapshot

- Main application chunk: `dist/assets/index-XWoxUz-n.js` at `4,987.93 kB` minified and `1,352.74 kB` gzip.
- PWA precache: `131` entries totaling `15,422.22 KiB`.
- Largest worker assets:
  - `ts.worker`: `7,010.23 kB`
  - `pdf.worker.min`: `1,239.05 kB`
  - `css.worker`: `1,030.36 kB`
  - `html.worker`: `693.16 kB`
  - `json.worker`: `383.07 kB`

## Prioritized Opportunities

### P0. Split heavyweight features by route

Evidence:
- `src/app/router.tsx:1-30` imports every feature page eagerly.
- The current production build emits one very large app chunk instead of isolating text, PDF, spreadsheet, and folder logic behind route boundaries.

Why it matters:
- Users pay the cost for Monaco, PDF, spreadsheet, image, and folder code even if they only open one workspace.
- This is the biggest contributor to the `4.99 MB` main chunk.

Recommendation:
- Convert feature routes to lazy routes with `React.lazy` or React Router route-level `lazy`.
- Keep the shell, navigation, settings, and privacy pages in the base chunk.
- Consider explicit `manualChunks` for Monaco, PDF, spreadsheet, and folder comparison code if Vite does not split them cleanly on its own.

Expected payoff:
- Smaller first-load JS.
- Faster cold starts on web and Tauri.
- Lower memory pressure during initial boot.

### P0. Reduce the offline precache footprint

Evidence:
- `vite.config.ts:16-51` precaches all built `js`, `css`, `html`, `ico`, `png`, `svg`, and `woff2` files.
- The current generated service worker precaches `131` files totaling about `15.4 MB`.

Why it matters:
- Even after route splitting, broad precache rules can still download most heavy feature assets on install.
- This makes the first offline-ready experience expensive, especially on slower or metered connections.

Recommendation:
- Precache only the app shell, current-route essentials, and truly critical assets.
- Move Monaco workers, PDF workers, and heavy feature chunks to runtime caching.
- Revisit whether all shipped font subsets need to be cached up front.

Expected payoff:
- Smaller first install.
- Better balance between offline readiness and first-use latency.

### P1. Trim Monaco’s bundle surface

Evidence:
- `src/features/text/TextPage.tsx:2-9` imports `@monaco-editor/react`, `monaco-editor`, and multiple workers at module load time.
- `src/features/text/languages.ts:1-20` lists a relatively small supported language set, but the build still emits many Monaco language assets plus a `7.0 MB` TypeScript worker.

Why it matters:
- Monaco is currently one of the most expensive feature dependencies in the app.
- The text route likely loads more editor/runtime surface than the UI actually exposes.

Recommendation:
- Lazy-load Monaco only when the text workspace mounts.
- Register only the workers and languages that are actually needed.
- Consider a lighter read-only renderer for unified diff output instead of a second Monaco instance.

Expected payoff:
- Major reduction in `/text` route cost.
- Lower CPU and memory usage when opening text compare.

### P1. Make PDF loading incremental and cache diff summaries

Evidence:
- `src/features/documents/DocumentComparePage.tsx:32-47` loads every page, extracts text for every page, and renders a thumbnail for every page before returning.
- `src/features/documents/DocumentComparePage.tsx:169-206` recomputes a text diff for every page while building the page list.
- `src/features/documents/DocumentComparePage.tsx:252-266` computes the selected page diff again for the detail view.

Why it matters:
- Large PDFs will spend a long time on the main thread before the page becomes interactive.
- Recomputing page-level diffs during render scales poorly with document length.

Recommendation:
- Load document metadata and page count first, then process pages incrementally.
- Generate thumbnails lazily for visible or selected pages only.
- Cache per-page diff stats keyed by document identity and page number.
- Move PDF text extraction and summary generation into a worker where possible.

Expected payoff:
- Faster time to first usable state for PDFs.
- Smoother page switching.
- Less repeated CPU work.

### P1. Stop materializing full folder diffs up front

Evidence:
- `src/features/folders/FolderComparePage.tsx:77-88` reads every file into memory and decodes bytes to text before checking whether the file should be treated as text.
- `src/features/folders/FolderComparePage.tsx:128-149` computes and stores full `diffRows` for every modified text file during the initial compare.
- `src/features/folders/FolderComparePage.tsx:440-460` only renders the first `100` rows of an expanded diff anyway.

Why it matters:
- Large folder compares do unnecessary I/O, decoding, CPU work, and allocation before the user expands anything.
- Binary files pay decoding cost even though their decoded text is thrown away.

Recommendation:
- Detect text/binary first, then only decode text files.
- For binary files, compare size plus a lightweight hash instead of decoding.
- Store file-level summary stats first and compute full line diffs only when a file is expanded or selected.

Expected payoff:
- Much lower memory use for large directories.
- Faster initial folder comparison.
- Better scaling on mixed text/binary trees.

### P1. Avoid building whole-sheet grids in reactive state

Evidence:
- `src/features/spreadsheets/SpreadsheetComparePage.tsx:14-19` stores the workbook, raw sheets, and parsed sheet data together.
- `src/features/spreadsheets/SpreadsheetComparePage.tsx:68-140` builds a full cell-by-cell `grid` for the entire compared sheet.
- `src/features/spreadsheets/SpreadsheetComparePage.tsx:322-347` renders every computed row and cell with no virtualization.
- `src/features/spreadsheets/SpreadsheetComparePage.tsx:357-437` mirrors spreadsheet data in both component state and Zustand session state.

Why it matters:
- Wide or long sheets will create a large in-memory representation before anything is visible.
- Full-table rendering will stall the UI as sheet size grows.

Recommendation:
- Keep non-UI workbook objects out of reactive state when possible.
- Separate summary computation from visible-grid rendering.
- Virtualize rows and, if needed, columns.
- Compute cell details in chunks or on demand instead of materializing the whole grid immediately.

Expected payoff:
- Better responsiveness on large spreadsheets.
- Lower render and memory cost.

### P1. Reduce image memory duplication and main-thread canvas churn

Evidence:
- `src/features/images/ImageComparePage.tsx:18-35` stores both an `ImageBitmap` and a base64 `dataUrl` for each file.
- `src/store/sessionStore.ts:46-61` keeps those image objects inside the shared store.
- `src/features/images/ImageComparePage.tsx:47-68` and `src/features/images/ImageComparePage.tsx:253-272` allocate fresh canvases and image buffers for diff calculations.
- `src/features/images/ImageComparePage.tsx:489-504` runs diff-percent computation on the main thread.

Why it matters:
- Large images are duplicated in memory.
- Pixel diffing can block interactions on slower devices.

Recommendation:
- Use `URL.createObjectURL()` for previews instead of storing base64 strings.
- Revoke object URLs when images are replaced or cleared.
- Reuse canvases where possible.
- Move `pixelmatch` work to a worker or `OffscreenCanvas` path when supported.

Expected payoff:
- Lower peak memory usage.
- Smoother image compare interactions.

### P2. Tighten store subscriptions and repeated formatting work

Evidence:
- `src/features/spreadsheets/SpreadsheetComparePage.tsx:357` and `src/features/folders/FolderComparePage.tsx:481` subscribe to the entire Zustand store instead of selecting only the fields they need.
- `src/i18n/index.ts:28-36` creates new `Intl.NumberFormat` and `Intl.DateTimeFormat` instances on every formatting call.

Why it matters:
- These are smaller issues than the bundle and diff hotspots, but they add avoidable rerenders and repeated object allocation in table-heavy UIs.

Recommendation:
- Switch spreadsheet and folder pages to selector-based subscriptions.
- Memoize locale formatters inside `useI18n`.

Expected payoff:
- Lower rerender noise.
- Small but easy wins on dense list and table screens.

## Suggested Order

1. Route splitting and narrower precache rules.
2. Monaco trimming.
3. Incremental PDF and lazy folder diff computation.
4. Spreadsheet virtualization and state slimming.
5. Image memory and workerization work.
6. Smaller render-path cleanups.

## Notes

- I focused on optimizations with clear user impact or measurable bundle/runtime cost.
- I did not modify production code as part of this review; this document is the output of the review pass.
