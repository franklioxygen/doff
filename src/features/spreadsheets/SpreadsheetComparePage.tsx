import { useCallback, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { useSessionStore } from '../../store/sessionStore'

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
  label,
  file,
  onFile,
  accept = '.xlsx,.xls',
}: {
  label: string
  file: LoadedFile | null
  onFile: (file: LoadedFile) => void
  accept?: string
}) {
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
      setError('Failed to parse file. Make sure it is a valid .xlsx file.')
    }
  }

  return (
    <div className={`drop-zone ${dragging ? 'dragging' : ''} ${file ? 'has-file' : ''}`}>
      <input
        type="file"
        accept={accept}
        onChange={handleFileInput}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ display: 'none' }}
        id={`file-input-${label}`}
      />
      {file ? (
        <div className="file-loaded">
          <div className="file-icon">📊</div>
          <div className="file-name">{file.name}</div>
          <div className="file-meta">{file.sheets.length} sheet{file.sheets.length !== 1 ? 's' : ''}</div>
          <button
            type="button"
            className="swap-btn"
            onClick={() => document.getElementById(`file-input-${label}`)?.click()}
          >
            Replace
          </button>
        </div>
      ) : (
        <label htmlFor={`file-input-${label}`} className="drop-zone-label">
          <div className="drop-zone-icon">📋</div>
          <div className="drop-zone-title">{label}</div>
          <div className="drop-zone-hint">Drop .xlsx here or click to browse</div>
        </label>
      )}
      {error && <div className="drop-zone-error">{error}</div>}
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
  return (
    <div className="sheet-selector">
      <span className="sheet-selector-label">{side === 'left' ? 'Left sheet' : 'Right sheet'}</span>
      <select
        value={selected}
        onChange={(e) => onSelect(e.target.value)}
        className="sheet-select"
      >
        {sheets.map((s) => (
          <option key={s.name} value={s.name}>
            {s.name} ({s.rows.length} rows)
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Diff Table ───────────────────────────────────────────────────────────────

function DiffTable({ diff }: { diff: SheetDiff }) {
  const { allKeys, grid, stats } = diff

  return (
    <div className="diff-table-wrapper">
      <div className="diff-summary">
        <span className="stat same">{stats.same} same</span>
        <span className="stat changed">{stats.changed} changed</span>
        <span className="stat added-left">{stats.addedLeft} only left</span>
        <span className="stat added-right">{stats.addedRight} only right</span>
        <span className="stat total">{stats.total} total cells</span>
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
                      title={`${key} @ row ${ri + 1}: ${cell.status}`}
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
  const { spreadsheetSession, setSpreadsheetSession } = useSessionStore()

  const [leftFile, setLeftFile] = useState<LoadedFile | null>(spreadsheetSession.leftFile)
  const [rightFile, setRightFile] = useState<LoadedFile | null>(spreadsheetSession.rightFile)
  const [leftSheet, setLeftSheet] = useState<string>(spreadsheetSession.leftSheet || '')
  const [rightSheet, setRightSheet] = useState<string>(spreadsheetSession.rightSheet || '')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncSession = useCallback(
    (partial: any) => {
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
        <h1 className="page-title">Spreadsheet Compare</h1>
        <p className="page-desc">Compare two Excel (.xlsx) files cell-by-cell. All processing happens locally in your browser.</p>
      </div>

      <div className="file-panels">
        <DropZone label="Left file" file={leftFile} onFile={handleLeftFile} />
        <div className="panel-actions">
          <button type="button" className="action-btn swap-btn" onClick={swap} disabled={!leftFile || !rightFile} title="Swap sides">
            ⇄
          </button>
          <button type="button" className="action-btn clear-btn" onClick={clear} disabled={!leftFile && !rightFile} title="Clear">
            ✕
          </button>
        </div>
        <DropZone label="Right file" file={rightFile} onFile={handleRightFile} />
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
              Comparing: <strong>{diff.leftSheet}</strong> ↔ <strong>{diff.rightSheet}</strong>
            </span>
          </div>
          <DiffTable diff={diff} />
        </>
      )}

      {!diff && leftFile && rightFile && (
        <div className="no-diff-hint">Select sheets above to see the cell diff.</div>
      )}

      {!leftFile && !rightFile && (
        <div className="empty-state">
          <div className="empty-icon">📊</div>
          <div className="empty-title">No files loaded</div>
          <div className="empty-desc">Drop two .xlsx files above to compare them cell by cell.</div>
        </div>
      )}

      <style>{`
        .spreadsheet-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          height: 100%;
        }
        .page-header { flex-shrink: 0; }
        .page-title {
          font-size: 1.5rem;
          font-weight: 700;
          margin: 0 0 0.25rem;
          font-family: var(--font-sans);
        }
        .page-desc {
          margin: 0;
          color: var(--text-subtle);
          font-size: 0.875rem;
        }
        .file-panels {
          display: grid;
          grid-template-columns: 1fr auto 1fr;
          gap: 1rem;
          align-items: stretch;
          flex-shrink: 0;
        }
        .panel-actions {
          display: flex;
          flex-direction: column;
          justify-content: center;
          gap: 0.5rem;
          padding-top: 2rem;
        }
        .action-btn {
          width: 2.5rem;
          height: 2.5rem;
          border: 1px solid var(--border);
          background: var(--surface);
          border-radius: 8px;
          cursor: pointer;
          font-size: 1rem;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: background 0.15s;
        }
        .action-btn:hover:not(:disabled) { background: var(--surface-muted); }
        .action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .drop-zone {
          border: 2px dashed var(--border);
          border-radius: 12px;
          padding: 1.5rem;
          text-align: center;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          min-height: 120px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.25rem;
        }
        .drop-zone.dragging { border-color: var(--accent); background: var(--added-bg); }
        .drop-zone.has-file { border-style: solid; border-color: var(--accent); background: var(--surface); }
        .drop-zone-label { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .drop-zone-icon, .file-icon { font-size: 2rem; }
        .drop-zone-title { font-weight: 600; font-size: 0.9rem; }
        .drop-zone-hint { font-size: 0.75rem; color: var(--text-subtle); }
        .file-loaded { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .file-name { font-weight: 600; font-size: 0.9rem; word-break: break-all; }
        .file-meta { font-size: 0.75rem; color: var(--text-subtle); }
        .swap-btn, .clear-btn {
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          background: var(--surface-muted);
          color: var(--text);
          margin-top: 0.25rem;
        }
        .swap-btn:hover, .clear-btn:hover { background: var(--border); }
        .drop-zone-error { color: var(--removed-fg); font-size: 0.75rem; margin-top: 0.5rem; }
        .sheet-selectors {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          flex-shrink: 0;
        }
        .sheet-selector {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 8px;
          padding: 0.75rem 1rem;
        }
        .sheet-selector-label { font-size: 0.8rem; font-weight: 600; color: var(--text-subtle); white-space: nowrap; }
        .sheet-select {
          flex: 1;
          border: 1px solid var(--border);
          border-radius: 6px;
          padding: 0.35rem 0.5rem;
          background: var(--surface-muted);
          color: var(--text);
          font-size: 0.875rem;
          font-family: var(--font-sans);
        }
        .diff-header {
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .diff-title { font-size: 0.875rem; color: var(--text-subtle); }
        .diff-summary {
          display: flex;
          gap: 1rem;
          flex-wrap: wrap;
          padding: 0.5rem 0;
          font-size: 0.8rem;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }
        .stat { padding: 0.2rem 0.5rem; border-radius: 4px; }
        .stat.same { background: var(--surface-muted); color: var(--text-subtle); }
        .stat.changed { background: var(--changed-bg); color: var(--changed-fg); }
        .stat.added-left { background: var(--removed-bg); color: var(--removed-fg); }
        .stat.added-right { background: var(--added-bg); color: var(--added-fg); }
        .stat.total { background: var(--surface-muted); color: var(--text-subtle); }
        .diff-table-wrapper {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .diff-table-scroll { overflow: auto; flex: 1; }
        .diff-table {
          border-collapse: collapse;
          width: 100%;
          font-size: 0.8rem;
          font-family: var(--font-mono);
        }
        .diff-table th, .diff-table td {
          border: 1px solid var(--border);
          padding: 0.3rem 0.5rem;
          white-space: nowrap;
          min-width: 60px;
          max-width: 200px;
        }
        .diff-table th {
          background: var(--surface-muted);
          font-weight: 600;
          position: sticky;
          top: 0;
          z-index: 1;
        }
        .row-num-col { min-width: 40px !important; width: 40px; background: var(--surface-muted) !important; font-weight: 600; color: var(--text-subtle); }
        .data-cell.cell-same { background: var(--surface); }
        .data-cell.cell-changed { background: var(--changed-bg); }
        .data-cell.cell-added-left { background: var(--removed-bg); }
        .data-cell.cell-added-right { background: var(--added-bg); }
        .cell-value { display: block; overflow: hidden; text-overflow: ellipsis; max-width: 180px; }
        .no-diff-hint {
          text-align: center;
          color: var(--text-subtle);
          font-size: 0.875rem;
          padding: 2rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          padding: 4rem;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
          flex: 1;
        }
        .empty-icon { font-size: 3rem; }
        .empty-title { font-size: 1.1rem; font-weight: 700; }
        .empty-desc { color: var(--text-subtle); font-size: 0.875rem; }
      `}</style>
    </div>
  )
}
