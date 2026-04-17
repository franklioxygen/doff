import { useCallback, useRef, useState } from 'react'
import {
  Button,
  Group,
  Image,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconFileDescription,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useSessionStore } from '../../store/sessionStore'
import { computeDiff } from '../text/textDiff'
import type { PdfPage, PdfDocInfo } from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import * as pdfjsLib from 'pdfjs-dist'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import { EmptyState } from '../../components/ui/EmptyState'
import { PageHero } from '../../components/ui/PageHero'
import { StatBadge } from '../../components/ui/StatBadge'
import { SurfaceCard } from '../../components/ui/SurfaceCard'
import { UploadPreviewActions } from '../../components/ui/UploadPreviewActions'
import { DiffSegments } from '../text/DiffSegments'

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
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      reject(new Error('2D canvas context is unavailable'))
      return
    }
    const op = { canvasContext: ctx, viewport: vp } as Parameters<typeof page.render>[0]
    page.render(op as Parameters<typeof page.render>[0])
      .promise.then(() => {
        resolve(canvas.toDataURL())
      }, reject)
  })

const PDF_DIFF_OPTIONS = {
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
} as const

const computePdfTextDiff = (leftText: string, rightText: string) =>
  computeDiff(leftText || ' ', rightText || ' ', PDF_DIFF_OPTIONS)

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

  const openFilePicker = () => inputRef.current?.click()

  const handleSelectedFile = useCallback(async (file: File | null | undefined) => {
    if (!file || file.type !== 'application/pdf') return
    setLoading(true)
    try {
      await onFile(file)
    } finally {
      setLoading(false)
    }
  }, [onFile])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      await handleSelectedFile(e.dataTransfer.files[0])
    },
    [handleSelectedFile],
  )

  return (
    <div className={`upload-drop-zone ${dragging ? 'upload-drop-zone-active' : ''} ${doc ? 'upload-drop-zone-filled' : ''}`}>
      {loading && (
        <div className="upload-drop-zone-empty">
          <Text>{t('documents.loadingPdf')}</Text>
        </div>
      )}
      {!loading && doc ? (
        <div className="upload-preview upload-preview-compact">
          <Stack gap={2} className="upload-preview-info">
            <Text fw={600}>{doc.name}</Text>
            <Text size="sm" c="dimmed">
              {t('documents.pagesCount', { count: formatNumber(doc.numPages) })}
            </Text>
          </Stack>
          <UploadPreviewActions
            replaceLabel={t('common.replace')}
            clearLabel={t('common.clear')}
            onReplace={openFilePicker}
            onClear={onClear}
          />
        </div>
      ) : (
        !loading && (
          // biome-ignore lint/a11y/useSemanticElements: custom PDF drop zone supports drag-and-drop and click-to-open.
          <div
            className="upload-drop-zone-empty"
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => {
              setDragging(false)
            }}
            onDrop={(event) => {
              void handleDrop(event)
            }}
            onClick={openFilePicker}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') openFilePicker() }}
            aria-label={t('documents.dropZoneAria', { label })}
          >
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
            <Text fw={600}>{label}</Text>
            <Text c="dimmed">{t('documents.dropPdfHere')}</Text>
            <Text size="sm" c="dimmed">{t('images.orClickBrowse')}</Text>
            <Button
              type="button"
              variant="light"
              leftSection={<IconUpload size={16} stroke={1.8} />}
              onClick={(e) => { e.stopPropagation(); openFilePicker() }}
            >
              {t('documents.openPdf')}
            </Button>
          </div>
        )
      )}
      <input
        ref={inputRef}
        type="file"
        hidden
        accept="application/pdf"
        onChange={(e) => {
          void handleSelectedFile(e.target.files?.[0])
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

    const result = computePdfTextDiff(leftText, rightText)

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
          onClick={() => {
            onSelectPage(entry.pageNum)
          }}
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

type PreviewCardProps = {
  alt: string
  header: string
  page: PdfPage | undefined
}

const PagePreviewCard = ({ alt, header, page }: PreviewCardProps) => {
  const { t } = useI18n()

  return (
    <article className="doc-preview-card">
      <div className="doc-preview-meta">
        <Text fw={600}>{header}</Text>
        {page ? (
          <Text size="sm" c="dimmed">
            {page.width.toFixed(0)}×{page.height.toFixed(0)}
          </Text>
        ) : (
          <Text size="sm" c="dimmed">
            {t('common.none')}
          </Text>
        )}
      </div>
      <div className="doc-preview-stage">
        {page?.thumbnail ? (
          <Image
            src={page.thumbnail}
            alt={alt}
            className="doc-preview-image"
            radius="md"
          />
        ) : (
          <div className="doc-preview-empty">
            <Text size="sm" c="dimmed">
              {t('common.none')}
            </Text>
          </div>
        )}
      </div>
    </article>
  )
}

type DiffTableRow = ReturnType<typeof computeDiff>['rows'][number]

const DiffRowCells = ({ row }: { row: DiffTableRow }) => {
  const showLeft = row.type !== 'added'
  const showRight = row.type !== 'removed'

  return (
    <>
      <td className="line-cell">{showLeft ? row.leftLine ?? '' : ''}</td>
      <td className="code-cell">
        {showLeft ? <DiffSegments segments={row.leftSegments} /> : null}
      </td>
      <td className="line-cell">{showRight ? row.rightLine ?? '' : ''}</td>
      <td className="code-cell">
        {showRight ? <DiffSegments segments={row.rightSegments} /> : null}
      </td>
    </>
  )
}

const DiffView = ({ leftDoc, rightDoc, selectedPage }: DiffViewProps) => {
  const { t, formatNumber } = useI18n()
  const leftPage = leftDoc?.pages[selectedPage - 1]
  const rightPage = rightDoc?.pages[selectedPage - 1]
  const leftText = leftPage?.text ?? ''
  const rightText = rightPage?.text ?? ''

  const result = computePdfTextDiff(leftText, rightText)

  return (
    <div className="doc-diff-panel">
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg" className="doc-preview-grid">
        <PagePreviewCard
          alt={t('documents.leftThumbnailAlt', { page: formatNumber(selectedPage) })}
          header={t('documents.leftPageHeader', {
            page: formatNumber(selectedPage),
            dimensions: '',
          })}
          page={leftPage}
        />
        <PagePreviewCard
          alt={t('documents.rightThumbnailAlt', { page: formatNumber(selectedPage) })}
          header={t('documents.rightPageHeader', {
            page: formatNumber(selectedPage),
            dimensions: '',
          })}
          page={rightPage}
        />
      </SimpleGrid>
      <div className="doc-diff-table-area">
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
                  <DiffRowCells row={row} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
  const totalPages = Math.max(leftDoc?.numPages ?? 0, rightDoc?.numPages ?? 0)

  return (
    <section className="doc-page">
      <Stack gap="lg">
        <PageHero
          title={t('documents.title')}
          description={t('documents.loadTwoPdfs')}
          icon={<IconFileDescription size={26} stroke={1.8} />}
          stats={(
            <>
              {leftDoc && (
                <StatBadge>
                  {t('documents.leftFileSummary', {
                    name: leftDoc.name,
                    pages: formatNumber(leftDoc.numPages),
                  })}
                </StatBadge>
              )}
              {rightDoc && (
                <StatBadge>
                  {t('documents.rightFileSummary', {
                    name: rightDoc.name,
                    pages: formatNumber(rightDoc.numPages),
                  })}
                </StatBadge>
              )}
            </>
          )}
        />

        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <SurfaceCard title={`${t('common.left')} PDF`} className="upload-surface">
            <PdfDropZone
              label={`${t('common.left')} PDF`}
              doc={leftDoc}
              onFile={(f) => handleFile('left', f)}
              onClear={() => {
                handleClear('left')
              }}
            />
          </SurfaceCard>
          <SurfaceCard title={`${t('common.right')} PDF`} className="upload-surface">
            <PdfDropZone
              label={`${t('common.right')} PDF`}
              doc={rightDoc}
              onFile={(f) => handleFile('right', f)}
              onClear={() => {
                handleClear('right')
              }}
            />
          </SurfaceCard>
        </SimpleGrid>

        <SurfaceCard
          title={t('common.comparing')}
          description={bothLoaded
            ? t('documents.comparingPageOf', {
                page: formatNumber(selectedPage),
                total: formatNumber(totalPages),
              })
            : t('documents.loadTwoPdfs')}
          className="control-surface"
          headerAside={(
            <Button
              type="button"
              variant="default"
              leftSection={<IconTrash size={16} stroke={1.8} />}
              onClick={clearDocumentSession}
              disabled={!leftDoc && !rightDoc}
            >
              {t('documents.clearSession')}
            </Button>
          )}
        >
          <Group gap="xs" wrap="wrap">
            {totalPages > 0 && (
              <StatBadge>
                {t('documents.page')} {formatNumber(selectedPage)} / {formatNumber(totalPages)}
              </StatBadge>
            )}
            {leftDoc && (
              <StatBadge>
                {t('common.left')} · {formatNumber(leftDoc.numPages)} {t('common.pages')}
              </StatBadge>
            )}
            {rightDoc && (
              <StatBadge>
                {t('common.right')} · {formatNumber(rightDoc.numPages)} {t('common.pages')}
              </StatBadge>
            )}
          </Group>
        </SurfaceCard>

        {(leftDoc || rightDoc) && (
          <div className="doc-workbench">
            <SurfaceCard title={t('documents.page')} className="doc-list-surface" padded={false}>
              <PageList
                leftDoc={leftDoc}
                rightDoc={rightDoc}
                selectedPage={selectedPage}
                onSelectPage={(n) => setDocumentSession({ selectedPage: n })}
              />
            </SurfaceCard>
            <SurfaceCard title={t('documents.changes')} className="doc-diff-surface" padded={false}>
              <DiffView
                leftDoc={leftDoc}
                rightDoc={rightDoc}
                selectedPage={selectedPage}
              />
            </SurfaceCard>
          </div>
        )}

        {!leftDoc && !rightDoc && (
          <EmptyState
            icon={<IconFileDescription size={28} stroke={1.8} />}
            title={t('documents.title')}
            description={t('documents.loadTwoPdfs')}
          />
        )}
      </Stack>
    </section>
  )
}
