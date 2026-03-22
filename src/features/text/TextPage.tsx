import { useEffect, useMemo, useRef, useState } from 'react'
import type { JSX } from 'react'
import Editor, { useMonaco } from '@monaco-editor/react'
import { computeDiff } from './textDiff'
import { exportDiffHtml, loadDoffBundle, saveDoffBundle } from './exporters'
import { useSessionStore } from '../../store/sessionStore'

type Side = 'left' | 'right'

const LANGUAGES = [
  'plaintext',
  'typescript',
  'javascript',
  'tsx',
  'jsx',
  'json',
  'css',
  'html',
  'markdown',
  'python',
  'go',
  'rust',
  'java',
  'csharp',
  'cpp',
  'yaml',
  'xml',
  'sql',
  'shell',
]

const readFileText = async (file: File): Promise<string> => {
  const text = await file.text()
  return text.replace(/\r\n?/g, '\n')
}

export function TextPage() {
  const session = useSessionStore((state) => state.textSession)
  const setLeftText = useSessionStore((state) => state.setLeftText)
  const setRightText = useSessionStore((state) => state.setRightText)
  const setTextOptions = useSessionStore((state) => state.setTextOptions)
  const swapSides = useSessionStore((state) => state.swapSides)
  const clearTextSession = useSessionStore((state) => state.clearTextSession)
  const overwriteTextSession = useSessionStore((state) => state.overwriteTextSession)

  const monaco = useMonaco()

  const leftFileInputRef = useRef<HTMLInputElement | null>(null)
  const rightFileInputRef = useRef<HTMLInputElement | null>(null)
  const doffFileInputRef = useRef<HTMLInputElement | null>(null)
  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({})

  const [frozenInputs, setFrozenInputs] = useState({
    leftText: session.leftText,
    rightText: session.rightText,
    options: session.options,
  })
  const [activeChange, setActiveChange] = useState(0)
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (session.options.realTime) {
      setFrozenInputs({
        leftText: session.leftText,
        rightText: session.rightText,
        options: session.options,
      })
    }
  }, [session.leftText, session.rightText, session.options])

  const source = session.options.realTime
    ? { leftText: session.leftText, rightText: session.rightText, options: session.options }
    : frozenInputs

  const diffResult = useMemo(
    () => computeDiff(source.leftText, source.rightText, source.options),
    [source.leftText, source.rightText, source.options],
  )

  const visibleRows = useMemo(
    () =>
      session.options.hideUnchanged
        ? diffResult.rows.filter((row) => row.type !== 'unchanged')
        : diffResult.rows,
    [session.options.hideUnchanged, diffResult.rows],
  )

  const changeRowIds = useMemo(
    () => visibleRows.filter((row) => row.type !== 'unchanged').map((row) => row.id),
    [visibleRows],
  )

  useEffect(() => {
    if (!changeRowIds.length) {
      setActiveChange(0)
      return
    }
    setActiveChange((current) => Math.min(current, changeRowIds.length - 1))
  }, [changeRowIds])

  const jumpToChange = (index: number) => {
    if (!changeRowIds.length) {
      return
    }
    const bounded = Math.max(0, Math.min(index, changeRowIds.length - 1))
    setActiveChange(bounded)
    const row = rowRefs.current[changeRowIds[bounded]]
    row?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  const applyManualCompare = () => {
    setFrozenInputs({
      leftText: session.leftText,
      rightText: session.rightText,
      options: session.options,
    })
  }

  const updateSideText = (side: Side, value: string, name?: string) => {
    if (side === 'left') {
      setLeftText(value, name)
      return
    }
    setRightText(value, name)
  }

  const handleOpenFile = async (side: Side, file?: File) => {
    if (!file) {
      return
    }

    try {
      const text = await readFileText(file)
      updateSideText(side, text, file.name)
      setErrorMessage(null)
    } catch {
      setErrorMessage(`Failed to read ${file.name}.`)
    }
  }

  const handleDrop = async (
    event: React.DragEvent<HTMLElement>,
    side: Side,
  ) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]

    if (file) {
      await handleOpenFile(side, file)
      return
    }

    const droppedText = event.dataTransfer.getData('text/plain')
    if (droppedText) {
      updateSideText(side, droppedText)
    }
  }

  const handlePasteFromClipboard = async (side: Side) => {
    try {
      const text = await navigator.clipboard.readText()
      updateSideText(side, text)
      setErrorMessage(null)
    } catch {
      setErrorMessage('Clipboard read failed. Grant clipboard access and try again.')
    }
  }

  const handleCopyPane = async (side: Side) => {
    const value = side === 'left' ? session.leftText : session.rightText
    try {
      await navigator.clipboard.writeText(value)
      setErrorMessage(null)
    } catch {
      setErrorMessage('Copy failed. Clipboard write is not available.')
    }
  }

  const handleExportHtml = async () => {
    setBusyMessage('Exporting HTML...')
    try {
      await exportDiffHtml({
        monaco,
        rows: visibleRows,
        language: session.options.language,
        viewMode: session.options.viewMode,
      })
      setErrorMessage(null)
    } catch {
      setErrorMessage('Failed to export HTML.')
    } finally {
      setBusyMessage(null)
    }
  }

  const handleSaveDoff = () => {
    try {
      saveDoffBundle(session)
      setErrorMessage(null)
    } catch {
      setErrorMessage('Failed to save .doff bundle.')
    }
  }

  const handleLoadDoff = async (file?: File) => {
    if (!file) {
      return
    }

    setBusyMessage('Loading .doff session...')
    try {
      const bundle = await loadDoffBundle(file)
      overwriteTextSession({
        id: bundle.manifest.session.id,
        createdAt: bundle.manifest.session.createdAt,
        updatedAt: bundle.manifest.session.updatedAt,
        leftName: bundle.manifest.session.leftName,
        rightName: bundle.manifest.session.rightName,
        leftText: bundle.leftText,
        rightText: bundle.rightText,
        options: bundle.manifest.session.options,
      })
      setErrorMessage(null)
    } catch {
      setErrorMessage('Unable to load .doff file. Check that it is a valid text session bundle.')
    } finally {
      setBusyMessage(null)
    }
  }

  const handleClearSession = () => {
    clearTextSession()
    setFrozenInputs({
      leftText: '',
      rightText: '',
      options: session.options,
    })
    setErrorMessage(null)
  }

  const editorOptions = {
    minimap: { enabled: false },
    fontFamily: 'IBM Plex Mono',
    fontSize: 13,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    wordWrap: session.options.disableWrap ? 'off' : 'on',
  } as const

  const renderSplitRows = () =>
    visibleRows.map((row) => (
      <tr
        key={row.id}
        ref={(node) => {
          rowRefs.current[row.id] = node
        }}
        className={`diff-row row-${row.type} ${changeRowIds[activeChange] === row.id ? 'row-active' : ''}`}
      >
        <td className="line-cell">{row.leftLine ?? ''}</td>
        <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.leftHtml || '&nbsp;' }} />
        <td className="line-cell">{row.rightLine ?? ''}</td>
        <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.rightHtml || '&nbsp;' }} />
      </tr>
    ))

  const renderUnifiedRows = () => {
    const rows: JSX.Element[] = []

    visibleRows.forEach((row) => {
      if (row.type === 'changed') {
        rows.push(
          <tr
            key={`${row.id}-removed`}
            ref={(node) => {
              rowRefs.current[row.id] = node
            }}
            className={`diff-row row-removed ${changeRowIds[activeChange] === row.id ? 'row-active' : ''}`}
          >
            <td className="line-cell">{row.leftLine ?? ''}</td>
            <td className="prefix-cell">-</td>
            <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.leftHtml || '&nbsp;' }} />
          </tr>,
        )

        rows.push(
          <tr key={`${row.id}-added`} className={`diff-row row-added ${changeRowIds[activeChange] === row.id ? 'row-active' : ''}`}>
            <td className="line-cell">{row.rightLine ?? ''}</td>
            <td className="prefix-cell">+</td>
            <td className="code-cell" dangerouslySetInnerHTML={{ __html: row.rightHtml || '&nbsp;' }} />
          </tr>,
        )
        return
      }

      const isAdded = row.type === 'added'
      const isRemoved = row.type === 'removed'
      const prefix = isAdded ? '+' : isRemoved ? '-' : ' '
      const codeHtml = isRemoved ? row.leftHtml : row.rightHtml
      const lineNumber = isAdded ? row.rightLine : row.leftLine

      rows.push(
        <tr
          key={row.id}
          ref={(node) => {
            rowRefs.current[row.id] = node
          }}
          className={`diff-row row-${row.type} ${changeRowIds[activeChange] === row.id ? 'row-active' : ''}`}
        >
          <td className="line-cell">{lineNumber ?? ''}</td>
          <td className="prefix-cell">{prefix}</td>
          <td className="code-cell" dangerouslySetInnerHTML={{ __html: codeHtml || '&nbsp;' }} />
        </tr>,
      )
    })

    return rows
  }

  return (
    <section className="text-page">
      <div className="text-header">
        <h1>Text Compare</h1>
        <div className="stat-pills">
          <span className="pill pill-added">+ {diffResult.stats.added} added</span>
          <span className="pill pill-removed">- {diffResult.stats.removed} removed</span>
          <span className="pill pill-changed">~ {diffResult.stats.changed} changed</span>
        </div>
      </div>

      <div className="editor-grid">
        <section
          className="editor-pane"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            void handleDrop(event, 'left').catch(() => {})
          }}
        >
          <header className="pane-header">
            <strong>Left input</strong>
            <div className="pane-actions">
              <button type="button" onClick={() => leftFileInputRef.current?.click()} aria-label="Open file for left input">
                Open file
              </button>
              <button type="button" onClick={() => void handlePasteFromClipboard('left')} aria-label="Paste text into left input">
                Paste text
              </button>
              <button type="button" onClick={() => void handleCopyPane('left')} aria-label="Copy left input text">
                Copy left
              </button>
            </div>
          </header>
          <Editor
            height="300px"
            language={session.options.language}
            value={session.leftText}
            options={editorOptions}
            onChange={(value) => {
              setLeftText(value ?? '')
            }}
          />
          <input
            ref={leftFileInputRef}
            type="file"
            hidden
            onChange={(event) => {
              void handleOpenFile('left', event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </section>

        <section
          className="editor-pane"
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            void handleDrop(event, 'right').catch(() => {})
          }}
        >
          <header className="pane-header">
            <strong>Right input</strong>
            <div className="pane-actions">
              <button type="button" onClick={() => rightFileInputRef.current?.click()} aria-label="Open file for right input">
                Open file
              </button>
              <button type="button" onClick={() => void handlePasteFromClipboard('right')} aria-label="Paste text into right input">
                Paste text
              </button>
              <button type="button" onClick={() => void handleCopyPane('right')} aria-label="Copy right input text">
                Copy right
              </button>
            </div>
          </header>
          <Editor
            height="300px"
            language={session.options.language}
            value={session.rightText}
            options={editorOptions}
            onChange={(value) => {
              setRightText(value ?? '')
            }}
          />
          <input
            ref={rightFileInputRef}
            type="file"
            hidden
            onChange={(event) => {
              void handleOpenFile('right', event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </section>
      </div>

      <div className="toolbar" role="toolbar" aria-label="Diff options">
        <div className="toolbar-group">
          <label>
            <input
              type="checkbox"
              checked={session.options.realTime}
              onChange={(event) => {
                setTextOptions({ realTime: event.target.checked })
              }}
            />
            Real-time diff
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.hideUnchanged}
              onChange={(event) => {
                setTextOptions({ hideUnchanged: event.target.checked })
              }}
            />
            Hide unchanged lines
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.disableWrap}
              onChange={(event) => {
                setTextOptions({ disableWrap: event.target.checked })
              }}
            />
            Disable line wrap
          </label>
          {!session.options.realTime && (
            <button type="button" onClick={applyManualCompare}>
              Compare now
            </button>
          )}
        </div>

        <div className="toolbar-group">
          <label>
            View
            <select
              value={session.options.viewMode}
              onChange={(event) => {
                setTextOptions({ viewMode: event.target.value as 'split' | 'unified' })
              }}
            >
              <option value="split">Split</option>
              <option value="unified">Unified</option>
            </select>
          </label>
          <label>
            Precision
            <select
              value={session.options.precision}
              onChange={(event) => {
                setTextOptions({ precision: event.target.value as 'word' | 'character' })
              }}
            >
              <option value="word">Word</option>
              <option value="character">Character</option>
            </select>
          </label>
          <label>
            Syntax
            <select
              value={session.options.language}
              onChange={(event) => {
                setTextOptions({ language: event.target.value })
              }}
            >
              {LANGUAGES.map((language) => (
                <option key={language} value={language}>
                  {language}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <details className="option-panel" open>
        <summary>Ignore options</summary>
        <div className="option-grid">
          <label>
            <input
              type="checkbox"
              checked={session.options.ignoreLeadingTrailingWhitespace}
              onChange={(event) => {
                setTextOptions({ ignoreLeadingTrailingWhitespace: event.target.checked })
              }}
            />
            Leading/trailing whitespace
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.ignoreAllWhitespace}
              onChange={(event) => {
                setTextOptions({ ignoreAllWhitespace: event.target.checked })
              }}
            />
            All whitespace
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.ignoreCase}
              onChange={(event) => {
                setTextOptions({ ignoreCase: event.target.checked })
              }}
            />
            Case changes
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.ignoreBlankLines}
              onChange={(event) => {
                setTextOptions({ ignoreBlankLines: event.target.checked })
              }}
            />
            Blank lines
          </label>
        </div>
      </details>

      <details className="option-panel" open>
        <summary>Transform options</summary>
        <div className="option-grid">
          <label>
            <input
              type="checkbox"
              checked={session.options.trimTrailingWhitespace}
              onChange={(event) => {
                setTextOptions({ trimTrailingWhitespace: event.target.checked })
              }}
            />
            Trim trailing whitespace
          </label>
          <label>
            <input
              type="checkbox"
              checked={session.options.normalizeUnicode}
              onChange={(event) => {
                setTextOptions({ normalizeUnicode: event.target.checked })
              }}
            />
            Normalize unicode
          </label>
          <label>
            Tabs/spaces
            <select
              value={session.options.tabSpaceMode}
              onChange={(event) => {
                setTextOptions({
                  tabSpaceMode: event.target.value as
                    | 'none'
                    | 'tabsToSpaces'
                    | 'spacesToTabs',
                })
              }}
            >
              <option value="none">No conversion</option>
              <option value="tabsToSpaces">Convert tabs to spaces</option>
              <option value="spacesToTabs">Convert spaces to tabs</option>
            </select>
          </label>
        </div>
      </details>

      <div className="action-bar" role="toolbar" aria-label="Diff navigation and actions">
        <div className="toolbar-group">
          <button type="button" onClick={() => jumpToChange(0)} disabled={!changeRowIds.length} aria-label="Jump to first change">
            First change
          </button>
          <button
            type="button"
            onClick={() => jumpToChange(activeChange - 1)}
            disabled={!changeRowIds.length}
            aria-label="Previous change"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={() => jumpToChange(activeChange + 1)}
            disabled={!changeRowIds.length}
            aria-label="Next change"
          >
            Next
          </button>
          <span className="change-counter">
            {changeRowIds.length ? `${activeChange + 1}/${changeRowIds.length}` : '0/0'}
          </span>
        </div>

        <div className="toolbar-group">
          <button type="button" onClick={swapSides} aria-label="Swap left and right inputs">
            Swap inputs
          </button>
          <button type="button" onClick={handleClearSession} aria-label="Clear current session">
            Clear session
          </button>
          <button type="button" onClick={handleSaveDoff} aria-label="Export session as .doff file">
            Export .doff
          </button>
          <button type="button" onClick={handleExportHtml} aria-label="Export diff as HTML file">
            Export HTML
          </button>
          <button type="button" onClick={() => doffFileInputRef.current?.click()} aria-label="Load .doff session file">
            Load .doff
          </button>
          <input
            ref={doffFileInputRef}
            hidden
            type="file"
            accept=".doff,.zip,application/zip"
            onChange={(event) => {
              void handleLoadDoff(event.target.files?.[0])
              event.target.value = ''
            }}
          />
        </div>
      </div>

      <section className="diff-panel">
        <header className="diff-header">
          <h2>Diff Output</h2>
          <span>{visibleRows.length} rows</span>
        </header>
        <div className={`diff-table-wrap ${session.options.disableWrap ? 'nowrap' : ''}`}>
          <table className="diff-table" role="table" aria-label={`Diff output: ${diffResult.stats.added} added, ${diffResult.stats.removed} removed, ${diffResult.stats.changed} changed`}>
            {session.options.viewMode === 'split' ? (
              <thead>
                <tr>
                  <th>L#</th>
                  <th>Left</th>
                  <th>R#</th>
                  <th>Right</th>
                </tr>
              </thead>
            ) : (
              <thead>
                <tr>
                  <th>#</th>
                  <th>Δ</th>
                  <th>Text</th>
                </tr>
              </thead>
            )}
            <tbody>
              {session.options.viewMode === 'split' ? renderSplitRows() : renderUnifiedRows()}
            </tbody>
          </table>
        </div>
      </section>

      {(busyMessage || errorMessage) && (
        <div
          className="status-bar"
          role={errorMessage ? 'alert' : 'status'}
          aria-live={errorMessage ? 'polite' : undefined}
        >
          {busyMessage ?? errorMessage}
        </div>
      )}
    </section>
  )
}
