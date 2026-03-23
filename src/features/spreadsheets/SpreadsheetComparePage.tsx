import { useCallback, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useSessionStore, type SpreadsheetSession } from '../../store/sessionStore'
import { useI18n } from '../../i18n'

// ─── Types ───────────────────────────────────────────────────────────────────

export type SheetData = {
  name: string
  rows: Record<string, unknown>[]
  maxCol: number
}

export type LoadedFile = {
  name: string
  sheets: SheetData[]
  rawSheets: XLSX.WorkBook['Sheets']
  workbook: XLSX.WorkBook
}

export type CellStatus = 'same' | 'changed' | 'added-left' | 'added-right' | 'missing-left' | 'missing-right'

export type GridCell = {
  value: unknown
  status: CellStatus
}

export type GridRow = Record<string, GridCell>

export type SheetDiff = {
  leftSheet: string
  rightSheet: string
  grid: GridRow[]
  allKeys: string[]
  stats: {
    total: number
    same: number
    changed: number
    addedLeft: number
    addedRight: number
    missingLeft: number
    missingRight: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseSheetToRows(sheet: XLSX.WorkSheet): { rows: Record<string, unknown>[]; maxCol: number } {
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' }) as unknown[]
  if (!json.length) return { rows: [], maxCol: 0 }

  // First row is header
  const headers = json[0] as unknown[]
  const maxCol = headers.length

  const rows: Record<string, unknown>[] = json.slice(1).map((rowArr) => {
    const row = {} as Record<string, unknown>
    ;(rowArr as unknown[]).forEach((cell, i) => {
      const key = String(headers[i] ?? `col_${i}`)
      row[key] = cell
    })
    return row
  })

  return { rows, maxCol }
}

function compareSheets(left: SheetData, right: SheetData): SheetDiff {
  const allKeysSet = new Set<string>()
  const leftRows = left.rows
  const rightRows = right.rows

  // Collect all row indices
  const maxRows = Math.max(leftRows.length, rightRows.length)

  const leftKeySet = new Set<string>()
  const rightKeySet = new Set<string>()

  // Collect all column keys across all rows for both sheets
  leftRows.forEach((row) => Object.keys(row).forEach((k) => leftKeySet.add(k)))
  rightRows.forEach((row) => Object.keys(row).forEach((k) => rightKeySet.add(k)))

  const allKeys = Array.from(new Set([...leftKeySet, ...rightKeySet])).sort()
  allKeys.forEach((k) => allKeysSet.add(k))

  const grid: GridRow[] = []
  const stats = {
    total: 0,
    same: 0,
    changed: 0,
    addedLeft: 0,
    addedRight: 0,
    missingLeft: 0,
    missingRight: 0,
  }

  for (let r = 0; r < maxRows; r++) {
    const row: GridRow = {}
    const leftRow = leftRows[r]
    const rightRow = rightRows[r]

    for (const key of allKeys) {
      stats.total++
      const leftVal = leftRow?.[key]
      const rightVal = rightRow?.[key]
      const leftExists = leftRow !== undefined && key in leftRow
      const rightExists = rightRow !== undefined && key in rightRow

      if (leftExists && rightExists) {
        const lv = leftVal === undefined || leftVal === null || leftVal === '' ? undefined : String(leftVal)
        const rv = rightVal === undefined || rightVal === null || rightVal === '' ? undefined : String(rightVal)
        if (lv === rv) {
          row[key] = { value: leftVal, status: 'same' }
          stats.same++
        } else {
          row[key] = { value: rightVal, status: 'changed' }
          stats.changed++
        }
      } else if (leftExists && !rightExists) {
        row[key] = { value: leftVal, status: 'added-left' }
        stats.addedLeft++
      } else if (!leftExists && rightExists) {
        row[key] = { value: rightVal, status: 'added-right' }
        stats.addedRight++
      } else {
        // both don't exist — shouldn't happen but guard
        row[key] = { value: undefined, status: 'same' }
        stats.same++
      }
    }
    grid.push(row)
  }

  return {
    leftSheet: left.name,
    rightSheet: right.name,
    grid,
    allKeys,
    stats,
  }
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function DropZone({
  inputId,
  label,
  file,
  onFile,
  accept = '.xlsx,.xls',
}: {
  inputId: string
  label: string
  file: LoadedFile | null
  onFile: (file: LoadedFile) => void
  accept?: string
}) {
  const { t, formatNumber } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      setError('')
      const entry = e.dataTransfer.items[0]
      if (entry?.kind === 'file') {
        const f = entry.getAsFile()
        if (f) await loadFile(f)
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) await loadFile(f)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const loadFile = async (f: File) => {
    try {
      const buf = await f.arrayBuffer()
      const wb = XLSX.read(buf, { type: 'array', cellDates: true })
      const sheetNames = wb.SheetNames
      const sheets: SheetData[] = sheetNames.map((name) => {
        const sheet = wb.Sheets[name]
        const { rows, maxCol } = parseSheetToRows(sheet)
        return { name, rows, maxCol }
      })
      onFile({ name: f.name, sheets, rawSheets: wb.Sheets, workbook: wb })
    } catch {
      setError(t('spreadsheets.failedParse'))
    }
  }

  return (
    <div className={`sz-drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ display: 'none' }}
        id={inputId}
      />
      {file ? (
        <div className="sz-file-loaded">
          <svg className="sz-file-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <div className="sz-file-name">{file.name}</div>
          <div className="sz-file-meta">{t('spreadsheets.sheetsCount', { count: formatNumber(file.sheets.length) })}</div>
          <button
            type="button"
            className="sz-file-btn"
            onClick={() => document.getElementById(inputId)?.click()}
          >
            {t('common.replace')}
          </button>
        </div>
      ) : (
        <label htmlFor={inputId} className="sz-drop-zone-label">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <div className="sz-drop-zone-title">{label}</div>
          <div className="sz-drop-zone-hint">{t('spreadsheets.dropHint')}</div>
        </label>
      )}
      {error && <div className="sz-drop-zone-error">{error}</div>}
    </div>
  )
}

// ─── Sheet Selector ──────────────────────────────────────────────────────────

function SheetSelector({
  sheets,
  selected,
  side,
  onSelect,
}: {
  sheets: SheetData[]
  selected: string
  side: 'left' | 'right'
  onSelect: (name: string) => void
}) {
  const { t, formatNumber } = useI18n()
  return (
    <div className="sheet-selector">
      <span className="sheet-selector-label">{side === 'left' ? t('spreadsheets.leftSheet') : t('spreadsheets.rightSheet')}</span>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="sheet-select"
      >
        {sheets.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} ({t('spreadsheets.rowsCount', { count: formatNumber(s.rows.length) })})
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Diff Table ───────────────────────────────────────────────────────────────

function DiffTable({ diff }: { diff: SheetDiff }) {
  const { t, formatNumber } = useI18n()
  const { allKeys, grid, stats } = diff

  const cellStatusLabel = (status: CellStatus) => {
    switch (status) {
      case 'same':
        return t('spreadsheets.statusSame')
      case 'changed':
        return t('spreadsheets.statusChanged')
      case 'added-left':
        return t('spreadsheets.statusOnlyLeft')
      case 'added-right':
        return t('spreadsheets.statusOnlyRight')
      default:
        return status
    }
  }

  return (
    <div className="diff-table-wrapper">
      <div className="diff-summary">
        <span className="stat same">{t('spreadsheets.sameCount', { count: formatNumber(stats.same) })}</span>
        <span className="stat changed">{t('spreadsheets.changedCount', { count: formatNumber(stats.changed) })}</span>
        <span className="stat added-left">{t('spreadsheets.onlyLeftCount', { count: formatNumber(stats.addedLeft) })}</span>
        <span className="stat added-right">{t('spreadsheets.onlyRightCount', { count: formatNumber(stats.addedRight) })}</span>
        <span className="stat total">{t('spreadsheets.totalCellsCount', { count: formatNumber(stats.total) })}</span>
      </div>
      <div className="diff-table-scroll">
        <table className="diff-table">
          <thead>
            <tr>
              <th className="row-num-col">#</th>
              {allKeys.map((key) => (
                <th key={key} className="header-col">{String(key)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, ri) => (
              <tr key={ri} className={ri % 2 === 0 ? 'even-row' : 'odd-row'}>
                <td className="row-num-col">{ri + 1}</td>
                {allKeys.map((key) => {
                  const cell = row[key]
                  return (
                    <td
                      key={key}
                      className={`data-cell cell-${cell.status}`}
                      title={t('spreadsheets.cellTitle', {
                        column: String(key),
                        row: formatNumber(ri + 1),
                        status: cellStatusLabel(cell.status),
                      })}
                    >
                      <span className="cell-value">
                        {cell.value === undefined || cell.value === null || cell.value === ''
                          ? '·'
                          : String(cell.value)}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function SpreadsheetComparePage() {
  const spreadsheetSession = useSessionStore((state) => state.spreadsheetSession)
  const setSpreadsheetSession = useSessionStore((state) => state.setSpreadsheetSession)
  const { t } = useI18n()

  const [leftFile, setLeftFile] = useState<LoadedFile | null>(spreadsheetSession.leftFile)
  const [rightFile, setRightFile] = useState<LoadedFile | null>(spreadsheetSession.rightFile)
  const [leftSheet, setLeftSheet] = useState<string>(spreadsheetSession.leftSheet || '')
  const [rightSheet, setRightSheet] = useState<string>(spreadsheetSession.rightSheet || '')

  const syncSession = useCallback(
    (partial: Partial<SpreadsheetSession>) => {
      setSpreadsheetSession(partial)
    },
    [setSpreadsheetSession],
  )

  const handleLeftFile = useCallback(
    (f: LoadedFile) => {
      setLeftFile(f)
      const sheet = f.sheets[0]?.name ?? ''
      setLeftSheet(sheet)
      syncSession({ leftFile: f, leftSheet: sheet })
    },
    [syncSession],
  )

  const handleRightFile = useCallback(
    (f: LoadedFile) => {
      setRightFile(f)
      const sheet = f.sheets[0]?.name ?? ''
      setRightSheet(sheet)
      syncSession({ rightFile: f, rightSheet: sheet })
    },
    [syncSession],
  )

  const handleLeftSheet = useCallback(
    (s: string) => {
      setLeftSheet(s)
      syncSession({ leftSheet: s })
    },
    [syncSession],
  )

  const handleRightSheet = useCallback(
    (s: string) => {
      setRightSheet(s)
      syncSession({ rightSheet: s })
    },
    [syncSession],
  )

  const diff = useMemo<SheetDiff | null>(() => {
    if (!leftFile || !rightFile || !leftSheet || !rightSheet) return null
    const ls = leftFile.sheets.find((s) => s.name === leftSheet)
    const rs = rightFile.sheets.find((s) => s.name === rightSheet)
    if (!ls || !rs) return null
    return compareSheets(ls, rs)
  }, [leftFile, rightFile, leftSheet, rightSheet])

  const swap = useCallback(() => {
    const tmpFile = leftFile
    const tmpSheet = leftSheet
    setLeftFile(rightFile)
    setRightFile(tmpFile)
    setLeftSheet(rightSheet)
    setRightSheet(tmpSheet)
    syncSession({
      leftFile: rightFile,
      rightFile: tmpFile,
      leftSheet: rightSheet,
      rightSheet: tmpSheet,
    })
  }, [leftFile, rightFile, leftSheet, rightSheet, syncSession])

  const clear = useCallback(() => {
    setLeftFile(null)
    setRightFile(null)
    setLeftSheet('')
    setRightSheet('')
    setSpreadsheetSession({ leftFile: null, rightFile: null, leftSheet: '', rightSheet: '' })
  }, [setSpreadsheetSession])

  return (
    <div className="spreadsheet-page">
      <div className="page-header">
        <h1>{t('spreadsheets.title')}</h1>
      </div>

      <div className="compare-panels">
        <DropZone inputId="spreadsheet-left-file" label={t('spreadsheets.leftFile')} file={leftFile} onFile={handleLeftFile} />
        <div className="panel-actions">
          <button type="button" className="action-btn swap-btn" onClick={swap} disabled={!leftFile || !rightFile} title={t('spreadsheets.swapTitle')}>
            ⇄
          </button>
          <button type="button" className="action-btn clear-btn" onClick={clear} disabled={!leftFile && !rightFile} title={t('spreadsheets.clearTitle')}>
            ✕
          </button>
        </div>
        <DropZone inputId="spreadsheet-right-file" label={t('spreadsheets.rightFile')} file={rightFile} onFile={handleRightFile} />
      </div>

      {leftFile && rightFile && (
        <div className="sheet-selectors">
          <SheetSelector sheets={leftFile.sheets} selected={leftSheet} side="left" onSelect={handleLeftSheet} />
          <SheetSelector sheets={rightFile.sheets} selected={rightSheet} side="right" onSelect={handleRightSheet} />
        </div>
      )}

      {diff && (
        <>
          <div className="diff-header">
            <span className="diff-title">
              {t('spreadsheets.comparingSheets', { left: diff.leftSheet, right: diff.rightSheet })}
            </span>
          </div>
          <DiffTable diff={diff} />
        </>
      )}

      {!diff && leftFile && rightFile && (
        <div className="no-diff-hint">{t('spreadsheets.selectSheets')}</div>
      )}

      {!leftFile && !rightFile && (
        <div className="empty-state">
          <svg className="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
            <line x1="3" y1="15" x2="21" y2="15" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
          <div className="empty-title">{t('spreadsheets.noFiles')}</div>
          <div className="empty-desc">{t('spreadsheets.emptyDescription')}</div>
        </div>
      )}
    </div>
  )
}
