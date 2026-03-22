import { useCallback, useMemo, useState } from 'react'
import JSZip from 'jszip'
import { computeDiff } from '../text/textDiff'
import { useSessionStore } from '../../store/sessionStore'

// ─── Types ───────────────────────────────────────────────────────────────────

export type FileEntry = {
  path: string
  name: string
  size: number
  isText: boolean
  content?: string
  hash?: string
}

export type LoadedFolder = {
  label: string
  entries: Map<string, FileEntry>
  totalFiles: number
}

export type FileStatus = 'identical' | 'modified' | 'added-left' | 'added-right' | 'size-diff' | 'binary-diff'

export type FileDiffEntry = {
  path: string
  status: FileStatus
  leftEntry?: FileEntry
  rightEntry?: FileEntry
  diffRows?: ReturnType<typeof computeDiff>['rows']
  diffStats?: ReturnType<typeof computeDiff>['stats']
}

export type FolderDiffResult = {
  entries: FileDiffEntry[]
  stats: {
    identical: number
    modified: number
    addedLeft: number
    addedRight: number
    sizeDiff: number
    total: number
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const TEXT_EXTS = new Set([
  '.txt', '.md', '.json', '.js', '.jsx', '.ts', '.tsx', '.css', '.html',
  '.xml', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.sh',
  '.bash', '.zsh', '.py', '.rb', '.go', '.rs', '.java', '.c', '.cpp',
  '.h', '.hpp', '.cs', '.swift', '.kt', '.scala', '.r', '.sql',
  '.gitignore', '.dockerignore', '.env', '.editorconfig', '.prettierrc',
  '.eslintrc', '.markdown', '.csv', '.log', '.env.local', '.env.development',
])

function isTextFile(name: string): boolean {
  const lower = name.toLowerCase()
  for (const ext of TEXT_EXTS) {
    if (lower.endsWith(ext)) return true
  }
  // Hidden files and known text names
  const knownText = ['makefile', 'dockerfile', 'rakefile', 'gemfile', 'procfile']
  return knownText.includes(lower)
}

async function extractFromZip(blob: Blob, label: string): Promise<LoadedFolder> {
  const zip = await JSZip.loadAsync(blob)
  const entries = new Map<string, FileEntry>()

  for (const [path, zipEntry] of Object.entries(zip.files)) {
    if (zipEntry.dir) continue
    const buf = await zipEntry.async('uint8array')
    const content = new TextDecoder().decode(buf)
    const isText = isTextFile(path)
    entries.set(path, {
      path,
      name: path.split('/').pop() ?? path,
      size: buf.byteLength,
      isText,
      content: isText ? content : undefined,
    })
  }

  return { label, entries, totalFiles: entries.size }
}

async function extractFromFolderHandle(handle: FileSystemDirectoryHandle, label: string, basePath = ''): Promise<LoadedFolder> {
  const entries = new Map<string, FileEntry>()

  async function walk(dirHandle: FileSystemDirectoryHandle, dirPath: string) {
    // @ts-ignore - FileSystemDirectoryHandle.entries() not in TS lib
    for await (const [name, child] of dirHandle.entries()) {
      const fullPath = dirPath ? `${dirPath}/${name}` : name
      if (child.kind === 'directory') {
        await walk(child as FileSystemDirectoryHandle, fullPath)
      } else {
        const file = child as FileSystemFileHandle
        const fileData = await file.getFile()
        const buf = await fileData.arrayBuffer()
        const content = new TextDecoder().decode(buf)
        const isText = isTextFile(name)
        entries.set(fullPath, {
          path: fullPath,
          name,
          size: fileData.size,
          isText,
          content: isText ? content : undefined,
        })
      }
    }
  }

  await walk(handle, basePath)
  return { label, entries, totalFiles: entries.size }
}

function compareFolders(left: LoadedFolder, right: LoadedFolder): FolderDiffResult {
  const allPaths = new Set([...left.entries.keys(), ...right.entries.keys()])
  const entries: FileDiffEntry[] = []
  const stats = { identical: 0, modified: 0, addedLeft: 0, addedRight: 0, sizeDiff: 0, total: 0 }

  const sortedPaths = Array.from(allPaths).sort()

  for (const path of sortedPaths) {
    const leftEntry = left.entries.get(path)
    const rightEntry = right.entries.get(path)
    stats.total++

    if (leftEntry && rightEntry) {
      // Both exist
      if (!leftEntry.isText && !rightEntry.isText) {
        // Binary — compare sizes
        if (leftEntry.size === rightEntry.size) {
          entries.push({ path, status: 'identical', leftEntry, rightEntry })
          stats.identical++
        } else {
          entries.push({ path, status: 'size-diff', leftEntry, rightEntry })
          stats.sizeDiff++
        }
      } else if (leftEntry.isText && rightEntry.isText) {
        // Text — do a line diff
        const leftContent = leftEntry.content ?? ''
        const rightContent = rightEntry.content ?? ''
        if (leftContent === rightContent) {
          entries.push({ path, status: 'identical', leftEntry, rightEntry })
          stats.identical++
        } else {
          const diffResult = computeDiff(leftContent, rightContent, {
            realTime: false,
            hideUnchanged: false,
            disableWrap: false,
            viewMode: 'unified',
            precision: 'word',
            language: 'plaintext',
            ignoreLeadingTrailingWhitespace: false,
            ignoreAllWhitespace: false,
            ignoreCase: false,
            ignoreBlankLines: false,
            trimTrailingWhitespace: false,
            normalizeUnicode: false,
            tabSpaceMode: 'none',
          })
          entries.push({
            path,
            status: 'modified',
            leftEntry,
            rightEntry,
            diffRows: diffResult.rows,
            diffStats: diffResult.stats,
          })
          stats.modified++
        }
      } else {
        // One text, one binary — mark as modified
        entries.push({ path, status: 'modified', leftEntry, rightEntry })
        stats.modified++
      }
    } else if (leftEntry && !rightEntry) {
      entries.push({ path, status: 'added-left', leftEntry })
      stats.addedLeft++
    } else if (!leftEntry && rightEntry) {
      entries.push({ path, status: 'added-right', rightEntry })
      stats.addedRight++
    }
  }

  return { entries, stats }
}

// ─── Drop Zone ───────────────────────────────────────────────────────────────

function FolderDropZone({
  label,
  folder,
  onFolder,
}: {
  label: string
  folder: LoadedFolder | null
  onFolder: (folder: LoadedFolder) => void
}) {
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setDragging(false)
      setError('')

      const items = Array.from(e.dataTransfer.items)
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry) {
          await loadEntry(entry, label)
          return
        }
      }
      // Fallback: files
      const file = e.dataTransfer.files[0]
      if (file) await loadFile(file, label)
    },
    [label],
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const loadEntry = async (entry: any, lbl: string) => {
    setLoading(true)
    setError('')
    try {
      // For dropped directories in Chrome, get the FileSystemDirectoryHandle
      const dirHandle = entry.webkitGetAsEntry ? entry : null
      if (dirHandle?.isDirectory) {
        // @ts-ignore - custom property on Chrome's dropped entry
        const handle = entry.handle ?? entry
        if (handle && 'entries' in handle) {
          const result = await extractFromFolderHandle(handle, lbl)
          onFolder(result)
          return
        }
      }
      // If no handle, fall back to treating as archive if it looks like one
      setError('Could not read directory from drop. Try using "Pick folder" or drop a .zip archive.')
    } catch (err) {
      setError('Failed to read directory. Your browser may not support the File System Access API.')
    } finally {
      setLoading(false)
    }
  }

  const loadFile = async (file: File, lbl: string) => {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.zip') && !name.endsWith('.tar') && !name.endsWith('.tar.gz') && !name.endsWith('.tgz')) {
      setError('Supported formats: .zip, .tar, .tar.gz, .tgz')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await extractFromZip(file, lbl)
      onFolder(result)
    } catch {
      setError('Failed to extract archive.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const f = e.target.files?.[0]
      if (f) await loadFile(f, label)
    },
    [label],
  )

  const handleBrowseFolder = useCallback(async () => {
    if (!('showDirectoryPicker' in window)) {
      setError('Your browser does not support the Folder Picker API. Use a Chrome/Edge-based browser or drop a ZIP archive.')
      return
    }
    try {
      // @ts-ignore
      const handle = await window.showDirectoryPicker()
      setLoading(true)
      setError('')
      const result = await extractFromFolderHandle(handle, label)
      onFolder(result)
    } catch {
      // User cancelled
    } finally {
      setLoading(false)
    }
  }, [label, onFolder])

  return (
    <div className={`folder-drop-zone ${dragging ? 'dragging' : ''} ${folder ? 'has-folder' : ''}`}>
      <input
        type="file"
        accept=".zip,.tar,.tar.gz,.tgz"
        onChange={handleFileInput}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        style={{ display: 'none' }}
        id={`folder-input-${label}`}
      />
      {folder ? (
        <div className="folder-loaded">
          <div className="folder-icon">📁</div>
          <div className="folder-label">{folder.label}</div>
          <div className="folder-meta">{folder.totalFiles} files</div>
          <div className="folder-actions">
            <button
              type="button"
              className="folder-action-btn"
              onClick={() => document.getElementById(`folder-input-${label}`)?.click()}
            >
              Replace archive
            </button>
            {'showDirectoryPicker' in window && (
              <button type="button" className="folder-action-btn" onClick={handleBrowseFolder}>
                Pick folder
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="folder-empty">
          <div className="folder-icon">{loading ? '⏳' : '📂'}</div>
          <div className="folder-title">{label}</div>
          <div className="folder-hint">
            Drop a folder or archive (.zip, .tar.gz) — or{' '}
            <button type="button" className="inline-btn" onClick={handleBrowseFolder}>
              pick a folder
            </button>
          </div>
          {loading && <div className="folder-loading">Extracting…</div>}
        </div>
      )}
      {error && <div className="folder-error">{error}</div>}
    </div>
  )
}

// ─── File List ───────────────────────────────────────────────────────────────

function FileList({ diff }: { diff: FolderDiffResult }) {
  const { entries, stats } = diff
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = useCallback((path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <div className="file-list-container">
      <div className="file-stats">
        <span className="fstat identical">{stats.identical} identical</span>
        <span className="fstat modified">{stats.modified} modified</span>
        <span className="fstat added-left">{stats.addedLeft} only left</span>
        <span className="fstat added-right">{stats.addedRight} only right</span>
        {stats.sizeDiff > 0 && <span className="fstat size-diff">{stats.sizeDiff} size diff</span>}
        <span className="fstat total">{stats.total} total</span>
      </div>
      <div className="file-list">
        {entries.map((entry) => {
          const isExpanded = expanded.has(entry.path)
          const isExpandable = entry.status === 'modified' && entry.diffRows?.length

          return (
            <div key={entry.path} className={`file-entry file-entry-${entry.status}`}>
              <div
                className={`file-entry-row ${isExpandable ? 'expandable' : ''}`}
                onClick={isExpandable ? () => toggle(entry.path) : undefined}
                role={isExpandable ? 'button' : undefined}
                tabIndex={isExpandable ? 0 : undefined}
                onKeyDown={isExpandable ? (e) => e.key === 'Enter' && toggle(entry.path) : undefined}
              >
                <span className="file-status-icon">
                  {entry.status === 'identical' && '✓'}
                  {entry.status === 'modified' && '~'}
                  {entry.status === 'added-left' && '←'}
                  {entry.status === 'added-right' && '→'}
                  {entry.status === 'size-diff' && '≠'}
                </span>
                <span className={`file-path ${entry.path.includes('/') ? 'has-slash' : ''}`}>
                  {entry.path}
                </span>
                {entry.leftEntry && (
                  <span className="file-size" title={`Left: ${entry.leftEntry.size} bytes`}>
                    {entry.leftEntry.isText ? 'T' : 'B'}{formatSize(entry.leftEntry.size)}
                  </span>
                )}
                {entry.rightEntry && (
                  <span className="file-size" title={`Right: ${entry.rightEntry.size} bytes`}>
                    {entry.rightEntry.isText ? 'T' : 'B'}{formatSize(entry.rightEntry.size)}
                  </span>
                )}
                {isExpandable && (
                  <span className="expand-icon">{isExpanded ? '▾' : '▸'}</span>
                )}
                {entry.diffStats && (
                  <span className="diff-mini-stats">
                    +{entry.diffStats.added} -{entry.diffStats.removed} ~{entry.diffStats.changed}
                  </span>
                )}
              </div>
              {isExpanded && entry.diffRows && (
                <div className="file-diff-expanded">
                  {entry.diffRows.slice(0, 100).map((row) => (
                    <div key={row.id} className={`diff-row diff-row-${row.type}`}>
                      <span className="diff-row-marker">
                        {row.type === 'unchanged' ? ' ' : row.type === 'added' ? '+' : row.type === 'removed' ? '-' : '~'}
                      </span>
                      <span
                        className="diff-row-left"
                        dangerouslySetInnerHTML={{ __html: row.leftHtml || '' }}
                      />
                      <span
                        className="diff-row-right"
                        dangerouslySetInnerHTML={{ __html: row.rightHtml || '' }}
                      />
                    </div>
                  ))}
                  {entry.diffRows.length > 100 && (
                    <div className="diff-truncated">
                      … {entry.diffRows.length - 100} more lines (truncated)
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}K`
  return `${(bytes / (1024 * 1024)).toFixed(1)}M`
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function FolderComparePage() {
  const { folderSession, setFolderSession } = useSessionStore()

  const [leftFolder, setLeftFolder] = useState<LoadedFolder | null>(folderSession.leftFolder)
  const [rightFolder, setRightFolder] = useState<LoadedFolder | null>(folderSession.rightFolder)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const syncSession = useCallback(
    (partial: any) => {
      setFolderSession(partial)
    },
    [setFolderSession],
  )

  const handleLeft = useCallback(
    (f: LoadedFolder) => {
      setLeftFolder(f)
      syncSession({ leftFolder: f })
    },
    [syncSession],
  )

  const handleRight = useCallback(
    (f: LoadedFolder) => {
      setRightFolder(f)
      syncSession({ rightFolder: f })
    },
    [syncSession],
  )

  const swap = useCallback(() => {
    setLeftFolder(rightFolder)
    setRightFolder(leftFolder)
    syncSession({ leftFolder: rightFolder, rightFolder: leftFolder })
  }, [leftFolder, rightFolder, syncSession])

  const clear = useCallback(() => {
    setLeftFolder(null)
    setRightFolder(null)
    setFolderSession({ leftFolder: null, rightFolder: null })
  }, [setFolderSession])

  const diff = useMemo<FolderDiffResult | null>(() => {
    if (!leftFolder || !rightFolder) return null
    return compareFolders(leftFolder, rightFolder)
  }, [leftFolder, rightFolder])

  return (
    <div className="folder-page">
      <div className="page-header">
        <h1 className="page-title">Folder Compare</h1>
        <p className="page-desc">
          Compare two directories or ZIP archives. Text files get a line-level diff; binary files show size comparison.
        </p>
      </div>

      <div className="folder-panels">
        <FolderDropZone label="Left folder" folder={leftFolder} onFolder={handleLeft} />
        <div className="panel-actions">
          <button type="button" className="action-btn" onClick={swap} disabled={!leftFolder || !rightFolder} title="Swap sides">
            ⇄
          </button>
          <button type="button" className="action-btn" onClick={clear} disabled={!leftFolder && !rightFolder} title="Clear">
            ✕
          </button>
        </div>
        <FolderDropZone label="Right folder" folder={rightFolder} onFolder={handleRight} />
      </div>

      {diff && (
        <div className="folder-results">
          <div className="folder-results-header">
            <span className="results-title">
              Comparing: <strong>{leftFolder?.label ?? 'Left'}</strong> ↔ <strong>{rightFolder?.label ?? 'Right'}</strong>
            </span>
          </div>
          <FileList diff={diff} />
        </div>
      )}

      {!leftFolder && !rightFolder && (
        <div className="empty-state">
          <div className="empty-icon">📂</div>
          <div className="empty-title">No folders loaded</div>
          <div className="empty-desc">
            Drop two folders or ZIP archives above to compare their contents.
          </div>
        </div>
      )}

      <style>{`
        .folder-page {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
          padding: 1.5rem;
          height: 100%;
        }
        .page-header { flex-shrink: 0; }
        .page-title { font-size: 1.5rem; font-weight: 700; margin: 0 0 0.25rem; }
        .page-desc { margin: 0; color: var(--text-subtle); font-size: 0.875rem; }
        .folder-panels {
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
        .folder-drop-zone {
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
        .folder-drop-zone.dragging { border-color: var(--accent); background: var(--added-bg); }
        .folder-drop-zone.has-folder { border-style: solid; border-color: var(--accent); background: var(--surface); }
        .folder-empty { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .folder-loaded { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; }
        .folder-icon { font-size: 2rem; }
        .folder-title { font-weight: 600; font-size: 0.9rem; }
        .folder-label { font-weight: 600; font-size: 0.9rem; word-break: break-all; }
        .folder-hint { font-size: 0.75rem; color: var(--text-subtle); }
        .folder-meta { font-size: 0.75rem; color: var(--text-subtle); }
        .folder-loading { font-size: 0.75rem; color: var(--accent); }
        .folder-actions { display: flex; gap: 0.5rem; flex-wrap: wrap; justify-content: center; }
        .folder-action-btn {
          font-size: 0.75rem;
          padding: 0.25rem 0.75rem;
          border: 1px solid var(--border);
          border-radius: 6px;
          cursor: pointer;
          background: var(--surface-muted);
          color: var(--text);
        }
        .folder-action-btn:hover { background: var(--border); }
        .inline-btn {
          background: none;
          border: none;
          color: var(--accent);
          cursor: pointer;
          font-size: inherit;
          padding: 0;
          text-decoration: underline;
        }
        .folder-error { color: var(--removed-fg); font-size: 0.75rem; margin-top: 0.5rem; }
        .folder-results {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          gap: 0.5rem;
        }
        .folder-results-header { flex-shrink: 0; }
        .results-title { font-size: 0.875rem; color: var(--text-subtle); }
        .file-list-container {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 12px;
        }
        .file-stats {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          padding: 0.5rem 1rem;
          border-bottom: 1px solid var(--border);
          font-size: 0.75rem;
          font-family: var(--font-mono);
          flex-shrink: 0;
        }
        .fstat { padding: 0.2rem 0.5rem; border-radius: 4px; }
        .fstat.identical { background: var(--surface-muted); color: var(--text-subtle); }
        .fstat.modified { background: var(--changed-bg); color: var(--changed-fg); }
        .fstat.added-left { background: var(--removed-bg); color: var(--removed-fg); }
        .fstat.added-right { background: var(--added-bg); color: var(--added-fg); }
        .fstat.size-diff { background: var(--changed-bg); color: var(--changed-fg); }
        .fstat.total { background: var(--surface-muted); color: var(--text-subtle); }
        .file-list { overflow-y: auto; flex: 1; }
        .file-entry { border-bottom: 1px solid var(--border); }
        .file-entry:last-child { border-bottom: none; }
        .file-entry-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.4rem 1rem;
          font-size: 0.8rem;
          font-family: var(--font-mono);
        }
        .file-entry-row.expandable { cursor: pointer; }
        .file-entry-row.expandable:hover { background: var(--surface-muted); }
        .file-status-icon {
          width: 1.2rem;
          text-align: center;
          flex-shrink: 0;
          font-weight: 700;
        }
        .file-entry-identical .file-status-icon { color: var(--text-subtle); }
        .file-entry-modified .file-status-icon { color: var(--changed-fg); }
        .file-entry-added-left .file-status-icon { color: var(--removed-fg); }
        .file-entry-added-right .file-status-icon { color: var(--added-fg); }
        .file-entry-size-diff .file-status-icon { color: var(--changed-fg); }
        .file-path { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .file-size {
          font-size: 0.7rem;
          color: var(--text-subtle);
          white-space: nowrap;
          padding: 0.1rem 0.3rem;
          background: var(--surface-muted);
          border-radius: 4px;
          flex-shrink: 0;
        }
        .expand-icon { font-size: 0.7rem; color: var(--text-subtle); flex-shrink: 0; }
        .diff-mini-stats {
          font-size: 0.7rem;
          color: var(--text-subtle);
          white-space: nowrap;
          flex-shrink: 0;
        }
        .file-diff-expanded {
          padding: 0.5rem 1rem;
          background: var(--surface-muted);
          font-family: var(--font-mono);
          font-size: 0.75rem;
          max-height: 300px;
          overflow-y: auto;
          border-top: 1px solid var(--border);
        }
        .diff-row {
          display: grid;
          grid-template-columns: 1rem 1fr 1fr;
          gap: 0.5rem;
          padding: 0.1rem 0;
        }
        .diff-row-unchanged { color: var(--text-subtle); }
        .diff-row-added { background: var(--added-bg); color: var(--added-fg); }
        .diff-row-removed { background: var(--removed-bg); color: var(--removed-fg); }
        .diff-row-changed { background: var(--changed-bg); color: var(--changed-fg); }
        .diff-row-marker { user-select: none; }
        .diff-row-left, .diff-row-right { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .diff-truncated { color: var(--text-subtle); font-style: italic; padding: 0.25rem 0; }
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
