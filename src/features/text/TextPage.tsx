import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import Editor, { loader, useMonaco } from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'
import { computeDiff } from './textDiff'
import { exportDiffHtml, loadDoffBundle, saveDoffBundle } from './exporters'
import { useSessionStore } from '../../store/sessionStore'

// Use local monaco-editor instead of CDN — eliminates loader.js.map 404 and unhandled rejections
window.MonacoEnvironment = {
  getWorker(_: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker()
    if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker()
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

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

const EXT_TO_LANG: Record<string, string> = {
  ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx', mjs: 'javascript', cjs: 'javascript',
  json: 'json', css: 'css', scss: 'css', less: 'css',
  html: 'html', htm: 'html', svg: 'xml', xml: 'xml',
  md: 'markdown', mdx: 'markdown',
  py: 'python', go: 'go', rs: 'rust', java: 'java',
  cs: 'csharp', cpp: 'cpp', cc: 'cpp', cxx: 'cpp', c: 'cpp', h: 'cpp',
  yaml: 'yaml', yml: 'yaml', sql: 'sql',
  sh: 'shell', bash: 'shell', zsh: 'shell',
}

const detectLanguageFromContent = (text: string): string | null => {
  const trimmed = text.trimStart()
  if (/^\s*[{\[]/.test(trimmed)) {
    try { JSON.parse(text); return 'json' } catch { /* not valid json */ }
  }
  if (/^\s*<(!doctype|html|head|body|div|span|p|a |ul|ol|li|table|form|section|article|nav|header|footer|main)\b/i.test(trimmed)) return 'html'
  if (/^\s*<\?xml\b/.test(trimmed) || /^\s*<[a-z][\w.-]*[^>]*xmlns/i.test(trimmed)) return 'xml'
  if (/^\s*<svg\b/i.test(trimmed)) return 'xml'
  if (/^\s*---\s*\n/.test(trimmed) || /^\w[\w ]*:\s/.test(trimmed)) return 'yaml'
  if (/^\s*(SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH)\b/i.test(trimmed)) return 'sql'
  if (/^\s*#!\s*\/.*\b(bash|sh|zsh)\b/.test(trimmed)) return 'shell'
  if (/^\s*#!\s*\/.*\bpython/.test(trimmed)) return 'python'
  if (/^\s*(import|from)\s+\S/.test(trimmed) && /def\s+\w+|class\s+\w+.*:/.test(text)) return 'python'
  if (/^\s*package\s+\w+/.test(trimmed) && /func\s+/.test(text)) return 'go'
  if (/^\s*(use\s+|fn\s+|pub\s+|mod\s+|let\s+mut\s+|impl\s+)/.test(trimmed)) return 'rust'
  if (/^\s*(import|export)\s+/.test(trimmed) || /\b(const|let|var|function|=>)\b/.test(trimmed)) {
    if (/<[A-Z]\w*[\s/>]/.test(text)) return 'tsx'
    return 'typescript'
  }
  if (/^\s*#\s+/.test(trimmed) || /^\s*```/.test(trimmed)) return 'markdown'
  return null
}

const detectLanguage = (text: string, fileName?: string): string | null => {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && EXT_TO_LANG[ext]) return EXT_TO_LANG[ext]
  }
  return detectLanguageFromContent(text)
}

export function TextPage() {
  const session = useSessionStore((state) => state.textSession)
  const theme = useSessionStore((state) => state.theme)
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
  const leftEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const rightEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const leftDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const rightDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)

  const [frozenInputs, setFrozenInputs] = useState({
    leftText: session.leftText,
    rightText: session.rightText,
    options: session.options,
  })
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editorsReady, setEditorsReady] = useState(0)
  const [onlyShowDiffs, setOnlyShowDiffs] = useState(false)

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

  // Build aligned diff-only content: both sides get the same number of lines,
  // with blank lines as padding where one side has no counterpart.
  const aligned = useMemo(() => {
    const leftLines: string[] = []
    const rightLines: string[] = []
    const types: ('added' | 'removed' | 'changed')[] = []

    for (const row of diffResult.rows) {
      if (row.type === 'unchanged') continue
      leftLines.push(row.type === 'added' ? '' : row.leftText)
      rightLines.push(row.type === 'removed' ? '' : row.rightText)
      types.push(row.type)
    }

    return {
      leftText: leftLines.join('\n'),
      rightText: rightLines.join('\n'),
      types,
    }
  }, [diffResult])

  const applyManualCompare = () => {
    setFrozenInputs({
      leftText: session.leftText,
      rightText: session.rightText,
      options: session.options,
    })
  }

  const prevLeftLen = useRef(session.leftText.length)
  const prevRightLen = useRef(session.rightText.length)

  const autoDetect = (text: string, fileName?: string) => {
    const lang = detectLanguage(text, fileName)
    if (lang) setTextOptions({ language: lang })
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
      autoDetect(text, file.name)
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
      autoDetect(droppedText)
      updateSideText(side, droppedText)
    }
  }

  const handlePasteFromClipboard = async (side: Side) => {
    try {
      const text = await navigator.clipboard.readText()
      autoDetect(text)
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
    glyphMargin: true,
    readOnly: onlyShowDiffs,
  }

  const scrollSyncLock = useRef(false)

  const handleLeftMount: OnMount = useCallback((editor) => {
    leftEditorRef.current = editor
    setEditorsReady((n) => n + 1)
    editor.onDidScrollChange((e) => {
      if (scrollSyncLock.current) return
      const other = rightEditorRef.current
      if (!other || !e.scrollTopChanged) return
      scrollSyncLock.current = true
      other.setScrollTop(e.scrollTop)
      scrollSyncLock.current = false
    })
  }, [])

  const handleRightMount: OnMount = useCallback((editor) => {
    rightEditorRef.current = editor
    setEditorsReady((n) => n + 1)
    editor.onDidScrollChange((e) => {
      if (scrollSyncLock.current) return
      const other = leftEditorRef.current
      if (!other || !e.scrollTopChanged) return
      scrollSyncLock.current = true
      other.setScrollTop(e.scrollTop)
      scrollSyncLock.current = false
    })
  }, [])

  // Apply diff decorations to editor gutters and line backgrounds
  useEffect(() => {
    const leftEditor = leftEditorRef.current
    const rightEditor = rightEditorRef.current
    const leftDecorations: monaco.editor.IModelDeltaDecoration[] = []
    const rightDecorations: monaco.editor.IModelDeltaDecoration[] = []

    if (onlyShowDiffs) {
      // In aligned mode, line numbers map 1:1 to aligned.types
      aligned.types.forEach((type, i) => {
        const line = i + 1
        const classMap = { removed: 'removed', added: 'added', changed: 'changed' } as const
        const cls = classMap[type]
        if (type !== 'added') {
          leftDecorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: { isWholeLine: true, className: `editor-line-${cls}`, glyphMarginClassName: `editor-glyph-${cls}` },
          })
        }
        if (type !== 'removed') {
          rightDecorations.push({
            range: new monaco.Range(line, 1, line, 1),
            options: { isWholeLine: true, className: `editor-line-${cls}`, glyphMarginClassName: `editor-glyph-${cls}` },
          })
        }
      })
    } else {
      // Normal mode: use original line numbers from diff result
      for (const row of diffResult.rows) {
        if (row.type === 'unchanged') continue
        if (row.type === 'removed' && row.leftLine != null) {
          leftDecorations.push({
            range: new monaco.Range(row.leftLine, 1, row.leftLine, 1),
            options: { isWholeLine: true, className: 'editor-line-removed', glyphMarginClassName: 'editor-glyph-removed' },
          })
        } else if (row.type === 'added' && row.rightLine != null) {
          rightDecorations.push({
            range: new monaco.Range(row.rightLine, 1, row.rightLine, 1),
            options: { isWholeLine: true, className: 'editor-line-added', glyphMarginClassName: 'editor-glyph-added' },
          })
        } else if (row.type === 'changed') {
          if (row.leftLine != null) {
            leftDecorations.push({
              range: new monaco.Range(row.leftLine, 1, row.leftLine, 1),
              options: { isWholeLine: true, className: 'editor-line-changed', glyphMarginClassName: 'editor-glyph-changed' },
            })
          }
          if (row.rightLine != null) {
            rightDecorations.push({
              range: new monaco.Range(row.rightLine, 1, row.rightLine, 1),
              options: { isWholeLine: true, className: 'editor-line-changed', glyphMarginClassName: 'editor-glyph-changed' },
            })
          }
        }
      }
    }

    if (leftEditor) {
      if (leftDecorationsRef.current) leftDecorationsRef.current.clear()
      leftDecorationsRef.current = leftEditor.createDecorationsCollection(leftDecorations)
    }
    if (rightEditor) {
      if (rightDecorationsRef.current) rightDecorationsRef.current.clear()
      rightDecorationsRef.current = rightEditor.createDecorationsCollection(rightDecorations)
    }
  }, [diffResult, aligned, editorsReady, onlyShowDiffs])

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
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            language={session.options.language}
            value={onlyShowDiffs ? aligned.leftText : session.leftText}
            options={editorOptions}
            onMount={handleLeftMount}
            onChange={(value) => {
              if (onlyShowDiffs) return
              const v = value ?? ''
              if (v.length - prevLeftLen.current > 10) {
                autoDetect(v)
              }
              prevLeftLen.current = v.length
              setLeftText(v)
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
            theme={theme === 'dark' ? 'vs-dark' : 'light'}
            language={session.options.language}
            value={onlyShowDiffs ? aligned.rightText : session.rightText}
            options={editorOptions}
            onMount={handleRightMount}
            onChange={(value) => {
              if (onlyShowDiffs) return
              const v = value ?? ''
              if (v.length - prevRightLen.current > 10) {
                autoDetect(v)
              }
              prevRightLen.current = v.length
              setRightText(v)
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
              checked={session.options.disableWrap}
              onChange={(event) => {
                setTextOptions({ disableWrap: event.target.checked })
              }}
            />
            Disable line wrap
          </label>
          <label>
            <input
              type="checkbox"
              checked={onlyShowDiffs}
              onChange={(event) => {
                setOnlyShowDiffs(event.target.checked)
              }}
            />
            Only show diffs
          </label>
          {!session.options.realTime && (
            <button type="button" onClick={applyManualCompare}>
              Compare now
            </button>
          )}
        </div>

        <div className="toolbar-group">
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

      <div className="action-bar" role="toolbar" aria-label="Actions">
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
