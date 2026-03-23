import { useCallback, useMemo, useState } from 'react'
import { computeDiff } from '../text/textDiff'
import { useSessionStore, type FolderSession } from '../../store/sessionStore'
import { useI18n } from '../../i18n'

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

async function readFolderHandle(handle: FileSystemDirectoryHandle, label: string, basePath = ''): Promise<LoadedFolder> {
  const entries = new Map<string, FileEntry>()

  async function walk(dirHandle: FileSystemDirectoryHandle, dirPath: string) {
    // @ts-expect-error - FileSystemDirectoryHandle.entries() not in TS lib
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

function FolderPickerZone({
  inputId,
  label,
  folder,
  onFolder,
}: {
  inputId: string
  label: string
  folder: LoadedFolder | null
  onFolder: (folder: LoadedFolder) => void
}) {
  const { t, formatNumber } = useI18n()
  const [dragging, setDragging] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const hasDirectoryPicker = 'showDirectoryPicker' in window

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    setError('')
    setLoading(true)

    try {
      // Try File System Access API first (Chrome/Edge)
      const items = Array.from(e.dataTransfer.items)
      for (const item of items) {
        // @ts-expect-error - getAsFileSystemHandle not in TS lib yet
        if (item.getAsFileSystemHandle) {
          // @ts-expect-error getAsFileSystemHandle not in TS lib yet
          const handle = await item.getAsFileSystemHandle()
          if (handle?.kind === 'directory') {
            const result = await readFolderHandle(handle as FileSystemDirectoryHandle, handle.name)
            onFolder(result)
            return
          }
        }
      }

      // Fallback: webkitGetAsEntry for drag-and-drop directories
      for (const item of items) {
        const entry = item.webkitGetAsEntry?.()
        if (entry?.isDirectory) {
          const files = await readWebkitDirectoryEntry(entry as FileSystemDirectoryEntry)
          const entries = new Map<string, FileEntry>()
          for (const { path, file } of files) {
            const isText = isTextFile(path)
            let content: string | undefined
            if (isText) {
              content = await file.text()
            }
            entries.set(path, { path, name: file.name, size: file.size, isText, content })
          }
          const dirName = entry.name
          onFolder({ label: dirName, entries, totalFiles: entries.size })
          return
        }
      }

      setError(t('folders.dropFolderOnly'))
    } catch {
      setError(t('folders.readDirectoryFailed'))
    } finally {
      setLoading(false)
    }
  }

  const handleBrowseFolder = async () => {
    if (!hasDirectoryPicker) {
      // Trigger the hidden webkitdirectory input as fallback
      document.getElementById(inputId)?.click()
      return
    }
    try {
      // @ts-expect-error - showDirectoryPicker is not in the current TS lib
      const handle = await window.showDirectoryPicker()
      setLoading(true)
      setError('')
      const result = await readFolderHandle(handle, handle.name)
      onFolder(result)
    } catch {
      // User cancelled
    } finally {
      setLoading(false)
    }
  }

  const handleWebkitDirInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setLoading(true)
    setError('')
    try {
      const entries = new Map<string, FileEntry>()
      // webkitdirectory gives flat file list with webkitRelativePath
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const relativePath = file.webkitRelativePath || file.name
        // Strip the top-level folder prefix so paths are relative
        const parts = relativePath.split('/')
        const path = parts.length > 1 ? parts.slice(1).join('/') : relativePath
        const isText = isTextFile(file.name)
        let content: string | undefined
        if (isText) {
          content = await file.text()
        }
        entries.set(path, { path, name: file.name, size: file.size, isText, content })
      }
      // Use the top-level folder name as label
      const topFolder = files[0]?.webkitRelativePath?.split('/')[0] ?? label
      onFolder({ label: topFolder, entries, totalFiles: entries.size })
    } catch {
      setError(t('folders.readDirectoryFailed'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className={`folder-drop-zone ${dragging ? 'dragging' : ''} ${folder ? 'has-folder' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      {/* Hidden webkitdirectory input as fallback for browsers without showDirectoryPicker */}
      <input
        type="file"
        // @ts-expect-error - webkitdirectory is non-standard but widely supported
        webkitdirectory=""
        directory=""
        onChange={handleWebkitDirInput}
        style={{ display: 'none' }}
        id={inputId}
      />
      {folder ? (
        <div className="folder-loaded">
          <svg className="folder-loaded-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div className="folder-label">{folder.label}</div>
          <div className="folder-meta">{t('folders.filesCount', { count: formatNumber(folder.totalFiles) })}</div>
          <button type="button" className="folder-action-btn" onClick={handleBrowseFolder}>
            {t('folders.changeFolder')}
          </button>
        </div>
      ) : (
        <div className="folder-empty">
          {loading ? (
            <span className="folder-loading-icon">{t('folders.reading')}</span>
          ) : (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          )}
          <div className="folder-title">{label}</div>
          <button type="button" className="folder-browse-btn" onClick={handleBrowseFolder} disabled={loading}>
            {t('folders.pickFolder')}
          </button>
          <div className="folder-hint">{t('folders.orDropFolder')}</div>
        </div>
      )}
      {error && <div className="folder-error">{error}</div>}
    </div>
  )
}

/** Read all files from a webkitGetAsEntry directory recursively */
async function readWebkitDirectoryEntry(
  dirEntry: FileSystemDirectoryEntry,
  basePath = '',
): Promise<Array<{ path: string; file: File }>> {
  const results: Array<{ path: string; file: File }> = []
  const reader = dirEntry.createReader()

  const readEntries = (): Promise<FileSystemEntry[]> =>
    new Promise((resolve, reject) => reader.readEntries(resolve, reject))

  let batch = await readEntries()
  while (batch.length > 0) {
    for (const entry of batch) {
      const fullPath = basePath ? `${basePath}/${entry.name}` : entry.name
      if (entry.isDirectory) {
        const subResults = await readWebkitDirectoryEntry(entry as FileSystemDirectoryEntry, fullPath)
        results.push(...subResults)
      } else {
        const file = await new Promise<File>((resolve, reject) =>
          (entry as FileSystemFileEntry).file(resolve, reject),
        )
        results.push({ path: fullPath, file })
      }
    }
    batch = await readEntries()
  }

  return results
}

// ─── File List ───────────────────────────────────────────────────────────────

function FileList({ diff }: { diff: FolderDiffResult }) {
  const { t, formatNumber } = useI18n()
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
        <span className="fstat identical">{t('folders.identicalCount', { count: formatNumber(stats.identical) })}</span>
        <span className="fstat modified">{t('folders.modifiedCount', { count: formatNumber(stats.modified) })}</span>
        <span className="fstat added-left">{t('folders.onlyLeftCount', { count: formatNumber(stats.addedLeft) })}</span>
        <span className="fstat added-right">{t('folders.onlyRightCount', { count: formatNumber(stats.addedRight) })}</span>
        {stats.sizeDiff > 0 && <span className="fstat size-diff">{t('folders.sizeDiffCount', { count: formatNumber(stats.sizeDiff) })}</span>}
        <span className="fstat total">{t('folders.totalCount', { count: formatNumber(stats.total) })}</span>
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
                  <span className="file-size" title={t('folders.leftBytesTitle', { bytes: formatNumber(entry.leftEntry.size) })}>
                    {entry.leftEntry.isText ? 'T' : 'B'}{formatSize(entry.leftEntry.size)}
                  </span>
                )}
                {entry.rightEntry && (
                  <span className="file-size" title={t('folders.rightBytesTitle', { bytes: formatNumber(entry.rightEntry.size) })}>
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
                      {t('folders.truncated', { count: formatNumber(entry.diffRows.length - 100) })}
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
  const folderSession = useSessionStore((state) => state.folderSession)
  const setFolderSession = useSessionStore((state) => state.setFolderSession)
  const { t } = useI18n()

  const [leftFolder, setLeftFolder] = useState<LoadedFolder | null>(folderSession.leftFolder)
  const [rightFolder, setRightFolder] = useState<LoadedFolder | null>(folderSession.rightFolder)

  const syncSession = useCallback(
    (partial: Partial<FolderSession>) => {
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
        <h1>{t('folders.title')}</h1>
      </div>

      <div className="compare-panels">
        <FolderPickerZone inputId="folder-left-input" label={t('folders.leftFolder')} folder={leftFolder} onFolder={handleLeft} />
        <div className="panel-actions">
          <button type="button" className="action-btn" onClick={swap} disabled={!leftFolder || !rightFolder} title={t('folders.swapTitle')}>
            ⇄
          </button>
          <button type="button" className="action-btn" onClick={clear} disabled={!leftFolder && !rightFolder} title={t('folders.clearTitle')}>
            ✕
          </button>
        </div>
        <FolderPickerZone inputId="folder-right-input" label={t('folders.rightFolder')} folder={rightFolder} onFolder={handleRight} />
      </div>

      {diff && (
        <div className="folder-results">
          <div className="folder-results-header">
            <span className="results-title">
              {t('folders.comparingFolders', {
                left: leftFolder?.label ?? t('common.left'),
                right: rightFolder?.label ?? t('common.right'),
              })}
            </span>
          </div>
          <FileList diff={diff} />
        </div>
      )}

      {!leftFolder && !rightFolder && (
        <div className="empty-state">
          <svg className="empty-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <div className="empty-title">{t('folders.noFolders')}</div>
          <div className="empty-desc">
            {t('folders.emptyDescription')}
          </div>
        </div>
      )}
    </div>
  )
}
