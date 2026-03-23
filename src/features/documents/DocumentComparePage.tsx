import { useCallback, useRef, useState } from 'react'
import { useSessionStore } from '../../store/sessionStore'
import { computeDiff } from '../text/textDiff'
import type { PdfPage, PdfDocInfo } from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'

// Configure worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

// ─── helpers ────────────────────────────────────────────────────────────────

const renderPageThumbnail = (
  page: pdfjsLib.PDFPageProxy,
  scale = 0.2,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const vp = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = vp.width
    canvas.height = vp.height
    const ctx = canvas.getContext('2d')!
    const op = { canvasContext: ctx, viewport: vp } as Parameters<typeof page.render>[0]
    page.render(op as Parameters<typeof page.render>[0])
      .promise.then(() => resolve(canvas.toDataURL()), reject)
  })

const loadPdfDoc = async (file: File): Promise<PdfDocInfo> => {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const pages: PdfPage[] = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const vp = page.getViewport({ scale: 1 })
    const content = await page.getTextContent()
    const text = content.items
      .filter((item): item is TextItem => 'str' in item)
      .map((item) => item.str)
      .join(' ')
    const thumbnail = await renderPageThumbnail(page).catch(() => null)
    pages.push({ pageNum: i, text, width: vp.width, height: vp.height, thumbnail })
  }
  return { name: file.name, numPages: pdf.numPages, pages }
}

// ─── drop zone ───────────────────────────────────────────────────────────────

type DropZoneProps = {
  label: string
  doc: PdfDocInfo | null
  onFile: (file: File) => void | Promise<void>
  onClear: () => void
}

const PdfDropZone = ({ label, doc, onFile, onClear }: DropZoneProps) => {
  const { t, formatNumber } = useI18n()
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      const file = e.dataTransfer.files[0]
      if (!file || file.type !== 'application/pdf') return
      setLoading(true)
      try {
        onFile(file)
      } finally {
        setLoading(false)
      }
    },
    [onFile],
  )

  return (
    <div className={`drop-zone ${dragging ? 'drop-zone-active' : ''} ${doc ? 'drop-zone-filled' : ''}`}>
      {loading && <div className="dz-empty"><p>{t('documents.loadingPdf')}</p></div>}
      {!loading && doc ? (
        <div className="dz-preview">
          <div className="dz-info">
            <span className="dz-name">{doc.name}</span>
            <span className="dz-meta">{t('documents.pagesCount', { count: formatNumber(doc.numPages) })}</span>
          </div>
          <div className="dz-actions">
            <button type="button" onClick={() => inputRef.current?.click()}>{t('common.replace')}</button>
            <button type="button" onClick={onClear}>{t('common.clear')}</button>
          </div>
        </div>
      ) : (
        !loading && (
          <div
            className="dz-empty"
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') inputRef.current?.click() }}
            aria-label={t('documents.dropZoneAria', { label })}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <p>{t('documents.dropPdfHere')}</p>
            <span>{t('images.orClickBrowse')}</span>
            <button type="button" onClick={(e) => { e.stopPropagation(); inputRef.current?.click() }}>
              {t('documents.openPdf')}
            </button>
          </div>
        )
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="application/pdf"
        onChange={async (e) => {
          const f = e.target.files?.[0]
          if (f) {
            setLoading(true)
            try {
              await onFile(f)
            } finally {
              setLoading(false)
            }
          }
          e.target.value = ''
        }}
      />
    </div>
  )
}

// ─── page list ───────────────────────────────────────────────────────────────

type PageListProps = {
  leftDoc: PdfDocInfo | null
  rightDoc: PdfDocInfo | null
  selectedPage: number
  onSelectPage: (n: number) => void
}

type PageDiffEntry = {
  pageNum: number
  leftText: string
  rightText: string
  added: number
  removed: number
  changed: number
  identical: boolean
}

const PageList = ({ leftDoc, rightDoc, selectedPage, onSelectPage }: PageListProps) => {
  const { t, formatNumber } = useI18n()
  const maxPages = Math.max(leftDoc?.numPages ?? 0, rightDoc?.numPages ?? 0)
  if (!leftDoc && !rightDoc) return null

  const entries: PageDiffEntry[] = Array.from({ length: maxPages }, (_, i) => {
    const n = i + 1
    const leftPage = leftDoc?.pages[i]
    const rightPage = rightDoc?.pages[i]
    const leftText = leftPage?.text ?? ''
    const rightText = rightPage?.text ?? ''

    if (!leftText && !rightText) {
      return { pageNum: n, leftText, rightText, added: 0, removed: 0, changed: 0, identical: true }
    }

    const result = computeDiff(leftText || ' ', rightText || ' ', {
      realTime: false,
      hideUnchanged: false,
      disableWrap: false,
      viewMode: 'split',
      precision: 'word',
      language: 'plaintext',
      ignoreLeadingTrailingWhitespace: true,
      ignoreAllWhitespace: false,
      ignoreCase: false,
      ignoreBlankLines: false,
      trimTrailingWhitespace: true,
      normalizeUnicode: false,
      tabSpaceMode: 'none',
    })

    const identical = result.stats.added === 0 && result.stats.removed === 0 && result.stats.changed === 0
    return {
      pageNum: n,
      leftText,
      rightText,
      added: result.stats.added,
      removed: result.stats.removed,
      changed: result.stats.changed,
      identical,
    }
  })

  return (
    <div className="page-list">
      <div className="page-list-header">
        <span>{t('documents.page')}</span>
        <span>{t('common.left')}</span>
        <span>{t('common.right')}</span>
        <span>{t('documents.changes')}</span>
      </div>
      {entries.map((entry) => (
        <button
          key={entry.pageNum}
          type="button"
          className={`page-list-row ${selectedPage === entry.pageNum ? 'page-list-row-active' : ''} ${entry.identical ? 'page-identical' : 'page-different'}`}
          onClick={() => onSelectPage(entry.pageNum)}
        >
          <span>{entry.pageNum}</span>
          <span>{leftDoc?.pages[entry.pageNum - 1] ? '✓' : '–'}</span>
          <span>{rightDoc?.pages[entry.pageNum - 1] ? '✓' : '–'}</span>
          <span>
            {entry.identical
              ? t('documents.identical')
              : `${entry.added > 0 ? `+${formatNumber(entry.added)} ` : ''}${entry.removed > 0 ? `-${formatNumber(entry.removed)} ` : ''}${entry.changed > 0 ? `~${formatNumber(entry.changed)}` : ''}`}
          </span>
        </button>
      ))}
    </div>
  )
}

// ─── diff view ───────────────────────────────────────────────────────────────

type DiffViewProps = {
  leftDoc: PdfDocInfo | null
  rightDoc: PdfDocInfo | null
  selectedPage: number
}

const DiffView = ({ leftDoc, rightDoc, selectedPage }: DiffViewProps) => {
  const { t, formatNumber } = useI18n()
  const leftPage = leftDoc?.pages[selectedPage - 1]
  const rightPage = rightDoc?.pages[selectedPage - 1]
  const leftText = leftPage?.text ?? ''
  const rightText = rightPage?.text ?? ''

  const result = computeDiff(leftText || ' ', rightText || ' ', {
    realTime: false,
    hideUnchanged: false,
    disableWrap: false,
    viewMode: 'split',
    precision: 'word',
    language: 'plaintext',
    ignoreLeadingTrailingWhitespace: true,
    ignoreAllWhitespace: false,
    ignoreCase: false,
    ignoreBlankLines: false,
    trimTrailingWhitespace: true,
    normalizeUnicode: false,
    tabSpaceMode: 'none',
  })

  return (
    <div className="doc-diff-panel">
      <div className="doc-diff-header">
        <div className="doc-diff-side">
          <strong>
            {t('documents.leftPageHeader', {
              page: formatNumber(selectedPage),
              dimensions: leftPage ? ` (${leftPage.width.toFixed(0)}×${leftPage.height.toFixed(0)})` : '',
            })}
          </strong>
          {leftPage?.thumbnail && (
            <img
              src={leftPage.thumbnail}
              alt={t('documents.leftThumbnailAlt', { page: formatNumber(selectedPage) })}
              className="page-thumb"
            />
          )}
        </div>
        <div className="doc-diff-side">
          <strong>
            {t('documents.rightPageHeader', {
              page: formatNumber(selectedPage),
              dimensions: rightPage ? ` (${rightPage.width.toFixed(0)}×${rightPage.height.toFixed(0)})` : '',
            })}
          </strong>
          {rightPage?.thumbnail && (
            <img
              src={rightPage.thumbnail}
              alt={t('documents.rightThumbnailAlt', { page: formatNumber(selectedPage) })}
              className="page-thumb"
            />
          )}
        </div>
      </div>
      <div className="diff-table-wrap nowrap">
        <table className="diff-table">
          <tbody>
            {result.rows.map((row) => (
              <tr
                key={row.id}
                className={`diff-row ${
                  row.type === 'added'
                    ? 'row-added'
                    : row.type === 'removed'
                    ? 'row-removed'
                    : row.type === 'changed'
                    ? 'row-changed'
                    : ''
                }`}
              >
                {row.type === 'changed' ? (
                  <>
                    <td className="line-cell">{row.leftLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.leftHtml }} />
                    <td className="line-cell">{row.rightLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.rightHtml }} />
                  </>
                ) : row.type === 'removed' ? (
                  <>
                    <td className="line-cell">{row.leftLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.leftHtml }} />
                    <td className="line-cell" />
                    <td className="code-cell" />
                  </>
                ) : row.type === 'added' ? (
                  <>
                    <td className="line-cell" />
                    <td className="code-cell" />
                    <td className="line-cell">{row.rightLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.rightHtml }} />
                  </>
                ) : (
                  <>
                    <td className="line-cell">{row.leftLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.leftHtml }} />
                    <td className="line-cell">{row.rightLine ?? ''}</td>
                    <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.rightHtml }} />
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="diff-stats">
        <span className="pill pill-added">+ {result.stats.added}</span>
        <span className="pill pill-removed">- {result.stats.removed}</span>
        <span className="pill pill-changed">~ {result.stats.changed}</span>
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export function DocumentComparePage() {
  const documentSession = useSessionStore((s) => s.documentSession)
  const setDocumentSession = useSessionStore((s) => s.setDocumentSession)
  const clearDocumentSession = useSessionStore((s) => s.clearDocumentSession)
  const { t, formatNumber } = useI18n()

  const { leftDoc, rightDoc, selectedPage } = documentSession

  const handleFile = useCallback(
    async (side: 'left' | 'right', file: File) => {
      try {
        const info = await loadPdfDoc(file)
        setDocumentSession({ [side === 'left' ? 'leftDoc' : 'rightDoc']: info, selectedPage: 1 })
      } catch (err) {
        console.error('Failed to load PDF', err)
      }
    },
    [setDocumentSession],
  )

  const handleClear = useCallback(
    (side: 'left' | 'right') => {
      setDocumentSession({ [side === 'left' ? 'leftDoc' : 'rightDoc']: null, selectedPage: 1 })
    },
    [setDocumentSession],
  )

  const bothLoaded = leftDoc && rightDoc

  return (
    <div className="doc-page">
      <div className="page-header">
        <h1>{t('documents.title')}</h1>
        <div className="stat-pills">
          {leftDoc && <span className="pill">{t('documents.leftFileSummary', { name: leftDoc.name, pages: formatNumber(leftDoc.numPages) })}</span>}
          {rightDoc && <span className="pill">{t('documents.rightFileSummary', { name: rightDoc.name, pages: formatNumber(rightDoc.numPages) })}</span>}
        </div>
      </div>

      {/* Drop zones */}
      <div className="image-dropzones">
        <PdfDropZone
          label={`${t('common.left')} PDF`}
          doc={leftDoc}
          onFile={(f) => handleFile('left', f)}
          onClear={() => handleClear('left')}
        />
        <PdfDropZone
          label={`${t('common.right')} PDF`}
          doc={rightDoc}
          onFile={(f) => handleFile('right', f)}
          onClear={() => handleClear('right')}
        />
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <div className="toolbar-group">
          {bothLoaded && (
            <span style={{ color: 'var(--text-subtle)' }}>
              {t('documents.comparingPageOf', {
                page: formatNumber(selectedPage),
                total: formatNumber(Math.max(leftDoc.numPages, rightDoc.numPages)),
              })}
            </span>
          )}
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={clearDocumentSession}>{t('documents.clearSession')}</button>
        </div>
      </div>

      {/* Content */}
      <div className="doc-content">
        {/* Page list */}
        <PageList
          leftDoc={leftDoc}
          rightDoc={rightDoc}
          selectedPage={selectedPage}
          onSelectPage={(n) => setDocumentSession({ selectedPage: n })}
        />

        {/* Diff view */}
        {(leftDoc || rightDoc) && (
          <DiffView
            leftDoc={leftDoc}
            rightDoc={rightDoc}
            selectedPage={selectedPage}
          />
        )}
      </div>

      {!leftDoc && !rightDoc && (
        <div className="viewer-placeholder">
          <p>{t('documents.loadTwoPdfs')}</p>
        </div>
      )}
    </div>
  )
}
