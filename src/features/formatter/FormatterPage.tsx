import { useCallback, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Group,
  Select,
  Stack,
  Text,
} from '@mantine/core'
import {
  IconAlertCircle,
  IconCheck,
  IconClipboard,
  IconCopy,
  IconSparkles,
  IconTrash,
  IconWand,
} from '@tabler/icons-react'
import Editor, { loader, useMonaco } from '@monaco-editor/react'
import type { OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

import { useSessionStore } from '../../store/sessionStore'
import { useI18n } from '../../i18n'
import { PageHero } from '../../components/ui/PageHero'
import { SurfaceCard } from '../../components/ui/SurfaceCard'
import { TEXT_LANGUAGES } from '../text/languages'
import { detectLanguage } from './detect'
import { formatText } from './formatters'

// Match the local Monaco worker configuration used by TextPage so
// visiting /formatter directly (without loading /text first) still
// gets proper language workers.
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

export function FormatterPage() {
  const theme = useSessionStore((state) => state.theme)
  const { t } = useI18n()
  // We don't use useMonaco() directly for formatting, but touching it
  // ensures the loader hook runs and keeps parity with TextPage.
  useMonaco()

  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const [value, setValue] = useState('')
  const [language, setLanguage] = useState<string>('plaintext')
  // Once the user picks a language from the Select, stop auto-detecting
  // so keystrokes can't silently override their choice. Reset on Clear
  // or on an explicit Paste (the paste is always a fresh context).
  const [languageLocked, setLanguageLocked] = useState(false)
  const [status, setStatus] = useState<{ kind: 'error' | 'info'; message: string } | null>(null)
  const [copied, setCopied] = useState(false)

  const handleMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
  }, [])

  const handleChange = (next: string | undefined) => {
    const text = next ?? ''
    setValue(text)
    setStatus(null)
    setCopied(false)

    if (!text.trim()) {
      if (!languageLocked) setLanguage('plaintext')
      return
    }

    if (languageLocked) return

    const detected = detectLanguage(text)
    if (detected) setLanguage(detected)
  }

  const handleLanguageSelect = (next: string | null) => {
    if (!next) return
    setLanguage(next)
    setLanguageLocked(true)
    setStatus(null)
  }

  const handleFormat = async () => {
    if (!value.trim()) return
    const result = await formatText(language, value, editorRef.current)

    if (result.ok) {
      setValue(result.value)
      setStatus(null)
      return
    }

    if (result.unsupported) {
      setStatus({ kind: 'info', message: t('formatter.unsupported', { language }) })
      return
    }

    setStatus({
      kind: 'error',
      message: result.error
        ? t('formatter.formatFailedWith', { error: result.error })
        : t('formatter.formatFailed'),
    })
  }

  const handleCopy = async () => {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setStatus(null)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      setStatus({ kind: 'error', message: t('formatter.copyFailed') })
    }
  }

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (!text) return
      setValue(text)
      const detected = detectLanguage(text)
      setLanguage(detected ?? 'plaintext')
      setLanguageLocked(false)
      setStatus(null)
      setCopied(false)
    } catch {
      setStatus({ kind: 'error', message: t('formatter.pasteFailed') })
    }
  }

  const handleClear = () => {
    setValue('')
    setLanguage('plaintext')
    setLanguageLocked(false)
    setStatus(null)
    setCopied(false)
  }

  const hasContent = value.trim().length > 0

  return (
    <section className="formatter-page">
      <Stack gap="lg">
        <PageHero
          title={t('formatter.title')}
          description={t('formatter.description')}
          icon={<IconSparkles size={26} stroke={1.8} />}
        />

        <SurfaceCard className="editor-surface" padded={false}>
          <div className="editor-pane">
            <header className="pane-header">
              <div className="pane-title-wrap">
                <Text fw={600}>{t('formatter.input')}</Text>
                <Select
                  size="xs"
                  searchable
                  allowDeselect={false}
                  value={language}
                  data={TEXT_LANGUAGES.map((lang) => ({ label: lang, value: lang }))}
                  onChange={handleLanguageSelect}
                  aria-label={t('formatter.languageSelectAria')}
                  w={180}
                />
                {!languageLocked && (
                  <Text size="xs" c="dimmed">
                    {t('formatter.autoDetected')}
                  </Text>
                )}
              </div>
              <Group gap="sm" className="pane-actions">
                <Button
                  size="compact-md"
                  variant="subtle"
                  leftSection={<IconClipboard size={14} stroke={1.8} />}
                  onClick={() => void handlePaste()}
                >
                  {t('formatter.paste')}
                </Button>
                <Button
                  size="compact-md"
                  variant="filled"
                  color="moss"
                  leftSection={<IconWand size={14} stroke={1.8} />}
                  onClick={() => void handleFormat()}
                  disabled={!hasContent}
                >
                  {t('formatter.format')}
                </Button>
                <Button
                  size="compact-md"
                  variant="light"
                  color={copied ? 'moss' : 'moss'}
                  leftSection={
                    copied ? <IconCheck size={14} stroke={1.8} /> : <IconCopy size={14} stroke={1.8} />
                  }
                  onClick={() => void handleCopy()}
                  disabled={!hasContent}
                >
                  {copied ? t('formatter.copied') : t('formatter.copy')}
                </Button>
                <Button
                  size="compact-md"
                  variant="subtle"
                  leftSection={<IconTrash size={14} stroke={1.8} />}
                  onClick={handleClear}
                  disabled={!hasContent}
                >
                  {t('formatter.clear')}
                </Button>
              </Group>
            </header>
            <div className="editor-host">
              <Editor
                height="520px"
                theme={theme === 'dark' ? 'vs-dark' : 'light'}
                language={language}
                value={value}
                onChange={handleChange}
                onMount={handleMount}
                options={{
                  minimap: { enabled: false },
                  fontFamily: 'IBM Plex Mono',
                  fontSize: 13,
                  automaticLayout: true,
                  scrollBeyondLastLine: false,
                  scrollbar: { alwaysConsumeMouseWheel: false },
                  wordWrap: 'on',
                }}
              />
            </div>
          </div>
        </SurfaceCard>

        {!hasContent && (
          <Text size="sm" c="dimmed">
            {t('formatter.placeholder')}
          </Text>
        )}

        {status && (
          <Alert
            color={status.kind === 'error' ? 'ember' : 'moss'}
            icon={<IconAlertCircle size={18} stroke={1.8} />}
          >
            {status.message}
          </Alert>
        )}
      </Stack>
    </section>
  )
}
