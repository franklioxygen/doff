import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import {
  Alert,
  Button,
  Checkbox,
  Code,
  CopyButton,
  Group,
  Modal,
  ScrollArea,
  Select,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconArrowsLeftRight,
  IconCheck,
  IconCode,
  IconCopy,
  IconDownload,
  IconFileArrowLeft,
  IconFileArrowRight,
  IconFileTypeZip,
  IconGitMerge,
  IconSparkles,
  IconTextPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react'
import { useDisclosure } from '@mantine/hooks'
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
import { useI18n } from '../../i18n'
import { TEXT_LANGUAGES } from './languages'
import { PageHero } from '../../components/ui/PageHero'
import { StatBadge } from '../../components/ui/StatBadge'
import { SurfaceCard } from '../../components/ui/SurfaceCard'

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
type UnifiedLineType = 'unchanged' | 'added' | 'removed'

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
  if (/^\s*[{[]/.test(trimmed)) {
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
  const { t, formatNumber } = useI18n()

  const monaco = useMonaco()

  const leftFileInputRef = useRef<HTMLInputElement | null>(null)
  const rightFileInputRef = useRef<HTMLInputElement | null>(null)
  const doffFileInputRef = useRef<HTMLInputElement | null>(null)
  const leftEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const rightEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const singleEditorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const leftDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const rightDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)
  const singleDecorationsRef = useRef<monaco.editor.IEditorDecorationsCollection | null>(null)

  const [frozenInputs, setFrozenInputs] = useState({
    leftText: session.leftText,
    rightText: session.rightText,
    options: session.options,
  })
  const [busyMessage, setBusyMessage] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [editorsReady, setEditorsReady] = useState(0)
  const [singleEditorReady, setSingleEditorReady] = useState(0)
  const [onlyShowDiffs, setOnlyShowDiffs] = useState(false)
  const [showDiffInSingleInput, setShowDiffInSingleInput] = useState(
    session.options.viewMode === 'unified',
  )
  const [gitDiffOpened, { open: openGitDiff, close: closeGitDiff }] = useDisclosure(false)
  const [gitDiffText, setGitDiffText] = useState('')

  useEffect(() => {
    if (session.options.realTime) {
      setFrozenInputs({
        leftText: session.leftText,
        rightText: session.rightText,
        options: session.options,
      })
    }
  }, [session.leftText, session.rightText, session.options])

  useEffect(() => {
    setShowDiffInSingleInput(session.options.viewMode === 'unified')
  }, [session.options.viewMode])

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

  const unifiedDiffView = useMemo(() => {
    const lines: string[] = []
    const types: UnifiedLineType[] = []

    for (const row of diffResult.rows) {
      if (row.type === 'unchanged') {
        lines.push(`  ${row.leftText}`)
        types.push('unchanged')
        continue
      }

      if (row.type === 'removed') {
        lines.push(`- ${row.leftText}`)
        types.push('removed')
        continue
      }

      if (row.type === 'added') {
        lines.push(`+ ${row.rightText}`)
        types.push('added')
        continue
      }

      lines.push(`- ${row.leftText}`)
      types.push('removed')
      lines.push(`+ ${row.rightText}`)
      types.push('added')
    }

    return {
      text: lines.join('\n'),
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
      setErrorMessage(t('text.failedRead', { name: file.name }))
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
      setErrorMessage(t('text.clipboardReadFailed'))
    }
  }

  const handleCopyPane = async (side: Side) => {
    const value = side === 'left' ? session.leftText : session.rightText
    try {
      await navigator.clipboard.writeText(value)
      setErrorMessage(null)
    } catch {
      setErrorMessage(t('text.copyFailed'))
    }
  }

  const handleExportHtml = async () => {
    if (!monaco) return
    setBusyMessage(t('text.exportingHtml'))
    try {
      await exportDiffHtml({
        monaco,
        rows: diffResult.rows,
        language: session.options.language,
        viewMode: session.options.viewMode,
      })
      setErrorMessage(null)
    } catch {
      setErrorMessage(t('text.failedExportHtml'))
    } finally {
      setBusyMessage(null)
    }
  }

  const handleSaveDoff = () => {
    try {
      saveDoffBundle(session)
      setErrorMessage(null)
    } catch {
      setErrorMessage(t('text.failedSaveDoff'))
    }
  }

  const handleLoadDoff = async (file?: File) => {
    if (!file) {
      return
    }

    setBusyMessage(t('text.loadingDoff'))
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
      setErrorMessage(t('text.invalidDoff'))
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

  const handleGenerateGitDiff = () => {
    const leftName = session.leftName ?? 'a'
    const rightName = session.rightName ?? 'b'
    const lines: string[] = []
    lines.push(`--- ${leftName}`)
    lines.push(`+++ ${rightName}`)

    // Build hunks with context lines
    const rows = diffResult.rows
    let i = 0
    while (i < rows.length) {
      // Find next changed row
      while (i < rows.length && rows[i].type === 'unchanged') i++
      if (i >= rows.length) break

      // Include up to 3 context lines before
      const contextStart = Math.max(0, i - 3)
      // Find end of this change block (including gaps <= 6 unchanged lines)
      let end = i
      while (end < rows.length) {
        if (rows[end].type !== 'unchanged') {
          end++
          continue
        }
        // Check if there's another change within 6 lines
        let nextChange = end
        while (nextChange < rows.length && nextChange - end < 6 && rows[nextChange].type === 'unchanged') {
          nextChange++
        }
        if (nextChange < rows.length && rows[nextChange].type !== 'unchanged') {
          end = nextChange + 1
        } else {
          break
        }
      }
      // Include up to 3 context lines after
      const contextEnd = Math.min(rows.length, end + 3)

      // Compute hunk header line numbers
      let leftStart = 0
      let leftCount = 0
      let rightStart = 0
      let rightCount = 0
      for (let j = contextStart; j < contextEnd; j++) {
        const row = rows[j]
        if (j === contextStart) {
          leftStart = row.leftLine ?? (row.rightLine ?? 1)
          rightStart = row.rightLine ?? (row.leftLine ?? 1)
        }
        if (row.type === 'unchanged' || row.type === 'changed' || row.type === 'removed') {
          leftCount++
        }
        if (row.type === 'unchanged' || row.type === 'changed' || row.type === 'added') {
          rightCount++
        }
      }

      lines.push(`@@ -${leftStart},${leftCount} +${rightStart},${rightCount} @@`)
      for (let j = contextStart; j < contextEnd; j++) {
        const row = rows[j]
        if (row.type === 'unchanged') {
          lines.push(` ${row.leftText}`)
        } else if (row.type === 'removed') {
          lines.push(`-${row.leftText}`)
        } else if (row.type === 'added') {
          lines.push(`+${row.rightText}`)
        } else if (row.type === 'changed') {
          lines.push(`-${row.leftText}`)
          lines.push(`+${row.rightText}`)
        }
      }

      i = contextEnd
    }

    setGitDiffText(lines.join('\n'))
    openGitDiff()
  }

  const editorOptions = {
    minimap: { enabled: false },
    fontFamily: 'IBM Plex Mono',
    fontSize: 13,
    automaticLayout: true,
    scrollBeyondLastLine: false,
    wordWrap: (session.options.disableWrap ? 'off' : 'on') as 'on' | 'off',
    glyphMargin: true,
    readOnly: onlyShowDiffs,
  }

  const singleEditorOptions = {
    ...editorOptions,
    readOnly: true,
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

  const handleSingleMount: OnMount = useCallback((editor) => {
    singleEditorRef.current = editor
    setSingleEditorReady((n) => n + 1)
  }, [])

  // Apply diff decorations to editor gutters and line backgrounds
  useEffect(() => {
    if (!monaco) return
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
  }, [diffResult, aligned, editorsReady, onlyShowDiffs, monaco])

  useEffect(() => {
    if (!monaco) return
    const singleEditor = singleEditorRef.current
    if (!singleEditor) return

    const singleDecorations: monaco.editor.IModelDeltaDecoration[] = []

    unifiedDiffView.types.forEach((type, i) => {
      if (type === 'unchanged') return

      const cls = type === 'added' ? 'added' : 'removed'
      const line = i + 1

      singleDecorations.push({
        range: new monaco.Range(line, 1, line, 1),
        options: {
          isWholeLine: true,
          className: `editor-line-${cls}`,
          glyphMarginClassName: `editor-glyph-${cls}`,
        },
      })
    })

    if (singleDecorationsRef.current) singleDecorationsRef.current.clear()
    singleDecorationsRef.current = singleEditor.createDecorationsCollection(singleDecorations)
  }, [monaco, unifiedDiffView, singleEditorReady])

  useEffect(() => {
    requestAnimationFrame(() => {
      if (showDiffInSingleInput) {
        singleEditorRef.current?.layout()
        return
      }

      leftEditorRef.current?.layout()
      rightEditorRef.current?.layout()
    })
  }, [showDiffInSingleInput])

  return (
    <section className="text-page">
      <Stack gap="lg">
        <PageHero
          title={t('text.title')}
          icon={<IconTextPlus size={26} stroke={1.8} />}
          stats={(
            <>
              <StatBadge tone="added">
                {t('text.addedCount', { count: formatNumber(diffResult.stats.added) })}
              </StatBadge>
              <StatBadge tone="removed">
                {t('text.removedCount', { count: formatNumber(diffResult.stats.removed) })}
              </StatBadge>
              <StatBadge tone="changed">
                {t('text.changedCount', { count: formatNumber(diffResult.stats.changed) })}
              </StatBadge>
            </>
          )}
        />

        {!showDiffInSingleInput && (
          <SimpleGrid cols={{ base: 1, xl: 2 }} spacing="lg" aria-hidden={showDiffInSingleInput}>
            <SurfaceCard className="editor-surface" padded={false}>
              <div
                className="editor-pane"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  void handleDrop(event, 'left').catch(() => {})
                }}
              >
                <header className="pane-header">
                  <div className="pane-title-wrap">
                    <Text fw={600}>{t('text.leftInput')}</Text>
                    {session.leftName && <Code>{session.leftName}</Code>}
                  </div>
                  <Group gap="xs" className="pane-actions">
                    <Button
                      type="button"
                      size="compact-md"
                      variant="light"
                      leftSection={<IconFileArrowLeft size={14} stroke={1.8} />}
                      onClick={() => leftFileInputRef.current?.click()}
                      aria-label={t('text.openFileLeftAria')}
                    >
                      {t('common.openFile')}
                    </Button>
                    <Button
                      type="button"
                      size="compact-md"
                      variant="subtle"
                      leftSection={<IconUpload size={14} stroke={1.8} />}
                      onClick={() => void handlePasteFromClipboard('left')}
                      aria-label={t('text.pasteLeftAria')}
                    >
                      {t('text.pasteText')}
                    </Button>
                    <Button
                      type="button"
                      size="compact-md"
                      variant="subtle"
                      leftSection={<IconCopy size={14} stroke={1.8} />}
                      onClick={() => void handleCopyPane('left')}
                      aria-label={t('text.copyLeftAria')}
                    >
                      {t('text.copyLeft')}
                    </Button>
                  </Group>
                </header>
                <div className="editor-host">
                  <Editor
                    key={`left-${onlyShowDiffs ? 'diff' : 'source'}`}
                    height="420px"
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
                </div>
                <input
                  ref={leftFileInputRef}
                  type="file"
                  hidden
                  onChange={(event) => {
                    void handleOpenFile('left', event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </div>
            </SurfaceCard>

            <SurfaceCard className="editor-surface" padded={false}>
              <div
                className="editor-pane"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  void handleDrop(event, 'right').catch(() => {})
                }}
              >
                <header className="pane-header">
                  <div className="pane-title-wrap">
                    <Text fw={600}>{t('text.rightInput')}</Text>
                    {session.rightName && <Code>{session.rightName}</Code>}
                  </div>
                  <Group gap="xs" className="pane-actions">
                    <Button
                      type="button"
                      size="compact-md"
                      variant="light"
                      leftSection={<IconFileArrowRight size={14} stroke={1.8} />}
                      onClick={() => rightFileInputRef.current?.click()}
                      aria-label={t('text.openFileRightAria')}
                    >
                      {t('common.openFile')}
                    </Button>
                    <Button
                      type="button"
                      size="compact-md"
                      variant="subtle"
                      leftSection={<IconUpload size={14} stroke={1.8} />}
                      onClick={() => void handlePasteFromClipboard('right')}
                      aria-label={t('text.pasteRightAria')}
                    >
                      {t('text.pasteText')}
                    </Button>
                    <Button
                      type="button"
                      size="compact-md"
                      variant="subtle"
                      leftSection={<IconCopy size={14} stroke={1.8} />}
                      onClick={() => void handleCopyPane('right')}
                      aria-label={t('text.copyRightAria')}
                    >
                      {t('text.copyRight')}
                    </Button>
                  </Group>
                </header>
                <div className="editor-host">
                  <Editor
                    key={`right-${onlyShowDiffs ? 'diff' : 'source'}`}
                    height="420px"
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
                </div>
                <input
                  ref={rightFileInputRef}
                  type="file"
                  hidden
                  onChange={(event) => {
                    void handleOpenFile('right', event.target.files?.[0])
                    event.target.value = ''
                  }}
                />
              </div>
            </SurfaceCard>
          </SimpleGrid>
        )}

        {showDiffInSingleInput && (
          <SurfaceCard className="editor-surface" padded={false}>
            <section className="editor-pane single-diff-pane">
              <header className="pane-header">
                <div className="pane-title-wrap">
                  <Text fw={600}>{t('text.diffInput')}</Text>
                  {!unifiedDiffView.text && <Code>{t('text.noContent')}</Code>}
                </div>
              </header>
              <div className="editor-host">
                <Editor
                  height="420px"
                  theme={theme === 'dark' ? 'vs-dark' : 'light'}
                  language="plaintext"
                  value={unifiedDiffView.text}
                  options={singleEditorOptions}
                  onMount={handleSingleMount}
                />
              </div>
            </section>
          </SurfaceCard>
        )}

        <SimpleGrid cols={{ base: 1, xl: 3 }} spacing="lg">
          <SurfaceCard
            title={t('text.diffOptionsAria')}
            description={session.options.realTime ? undefined : t('text.compareNow')}
            className="control-surface"
          >
            <Stack gap="md">
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('common.syntax')}
                </Text>
                <Select
                  searchable
                  value={session.options.language}
                  data={TEXT_LANGUAGES.map((language) => ({ label: language, value: language }))}
                  onChange={(value) => {
                    if (value) {
                      setTextOptions({ language: value })
                    }
                  }}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultViewMode')}
                </Text>
                <SegmentedControl
                  fullWidth
                  value={showDiffInSingleInput ? 'unified' : 'split'}
                  onChange={(value) => {
                    const nextMode = value as 'split' | 'unified'
                    setTextOptions({ viewMode: nextMode })
                    setShowDiffInSingleInput(nextMode === 'unified')
                  }}
                  data={[
                    { label: t('common.split'), value: 'split' },
                    { label: t('common.unified'), value: 'unified' },
                  ]}
                />
              </div>
              <div>
                <Text size="sm" fw={600} mb={8}>
                  {t('settings.defaultPrecision')}
                </Text>
                <SegmentedControl
                  fullWidth
                  value={session.options.precision}
                  onChange={(value) => {
                    setTextOptions({ precision: value as 'word' | 'character' })
                  }}
                  data={[
                    { label: t('common.word'), value: 'word' },
                    { label: t('common.character'), value: 'character' },
                  ]}
                />
              </div>
              <Checkbox
                checked={session.options.realTime}
                label={t('text.realTime')}
                onChange={(event) => {
                  setTextOptions({ realTime: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.disableWrap}
                label={t('text.disableWrap')}
                onChange={(event) => {
                  setTextOptions({ disableWrap: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={onlyShowDiffs}
                label={t('text.onlyShowDiffs')}
                onChange={(event) => {
                  setOnlyShowDiffs(event.currentTarget.checked)
                }}
              />
              {!session.options.realTime && (
                <Button
                  type="button"
                  variant="light"
                  leftSection={<IconSparkles size={16} stroke={1.8} />}
                  onClick={applyManualCompare}
                >
                  {t('text.compareNow')}
                </Button>
              )}
            </Stack>
          </SurfaceCard>

          <SurfaceCard
            title={t('settings.textDefaultsTitle')}
            description={t('settings.textDefaultsDescription')}
            className="control-surface"
          >
            <Stack gap="sm">
              <Checkbox
                checked={session.options.ignoreLeadingTrailingWhitespace}
                label={t('settings.ignoreLeadingTrailingWhitespace')}
                onChange={(event) => {
                  setTextOptions({ ignoreLeadingTrailingWhitespace: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.ignoreAllWhitespace}
                label={t('settings.ignoreAllWhitespace')}
                onChange={(event) => {
                  setTextOptions({ ignoreAllWhitespace: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.ignoreCase}
                label={t('settings.ignoreCase')}
                onChange={(event) => {
                  setTextOptions({ ignoreCase: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.ignoreBlankLines}
                label={t('settings.ignoreBlankLines')}
                onChange={(event) => {
                  setTextOptions({ ignoreBlankLines: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.trimTrailingWhitespace}
                label={t('settings.trimTrailingWhitespace')}
                onChange={(event) => {
                  setTextOptions({ trimTrailingWhitespace: event.currentTarget.checked })
                }}
              />
              <Checkbox
                checked={session.options.normalizeUnicode}
                label={t('settings.normalizeUnicode')}
                onChange={(event) => {
                  setTextOptions({ normalizeUnicode: event.currentTarget.checked })
                }}
              />
            </Stack>
          </SurfaceCard>

          <SurfaceCard
            title={t('text.actionsAria')}
            description={busyMessage ?? errorMessage ?? undefined}
            className="control-surface"
          >
            <Stack gap="sm">
              <Button
                type="button"
                variant="light"
                leftSection={<IconArrowsLeftRight size={16} stroke={1.8} />}
                onClick={swapSides}
                aria-label={t('text.swapInputsAria')}
              >
                {t('text.swapInputs')}
              </Button>
              <Button
                type="button"
                variant="default"
                leftSection={<IconTrash size={16} stroke={1.8} />}
                onClick={handleClearSession}
                aria-label={t('text.clearSessionAria')}
              >
                {t('text.clearSession')}
              </Button>
              <Button
                type="button"
                variant="default"
                leftSection={<IconFileTypeZip size={16} stroke={1.8} />}
                onClick={handleSaveDoff}
                aria-label={t('text.exportDoffAria')}
              >
                {t('text.exportDoff')}
              </Button>
              <Button
                type="button"
                variant="default"
                leftSection={<IconDownload size={16} stroke={1.8} />}
                onClick={handleExportHtml}
                aria-label={t('text.exportHtmlAria')}
              >
                {t('text.exportHtml')}
              </Button>
              <Button
                type="button"
                variant="default"
                leftSection={<IconGitMerge size={16} stroke={1.8} />}
                onClick={handleGenerateGitDiff}
                aria-label={t('text.gitDiffAria')}
              >
                {t('text.gitDiff')}
              </Button>
              <Button
                type="button"
                variant="light"
                leftSection={<IconCode size={16} stroke={1.8} />}
                onClick={() => doffFileInputRef.current?.click()}
                aria-label={t('text.loadDoffAria')}
              >
                {t('text.loadDoff')}
              </Button>
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
            </Stack>
          </SurfaceCard>
        </SimpleGrid>

        {(busyMessage || errorMessage) && (
          <Alert
            color={errorMessage ? 'ember' : 'moss'}
            icon={<IconAlertCircle size={18} stroke={1.8} />}
            title={errorMessage ? 'Error' : 'Status'}
            role={errorMessage ? 'alert' : 'status'}
            aria-live={errorMessage ? 'polite' : undefined}
          >
            {busyMessage ?? errorMessage}
          </Alert>
        )}
      </Stack>

      <Modal
        opened={gitDiffOpened}
        onClose={closeGitDiff}
        title={t('text.gitDiff')}
        size="xl"
      >
        <Stack gap="sm">
          <CopyButton value={gitDiffText}>
            {({ copied, copy }) => (
              <Button
                variant={copied ? 'light' : 'default'}
                leftSection={copied ? <IconCheck size={16} stroke={1.8} /> : <IconCopy size={16} stroke={1.8} />}
                onClick={copy}
              >
                {copied ? t('text.copied') : t('text.copyToClipboard')}
              </Button>
            )}
          </CopyButton>
          <ScrollArea.Autosize mah="70vh">
            <Code block style={{ whiteSpace: 'pre', fontSize: 12 }}>
              {gitDiffText}
            </Code>
          </ScrollArea.Autosize>
        </Stack>
      </Modal>
    </section>
  )
}
