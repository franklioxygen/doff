import type * as monaco from 'monaco-editor'

export type FormatResult = {
  ok: boolean
  value: string
  error?: string
  unsupported?: boolean
}

function formatJson(input: string): FormatResult {
  try {
    const parsed = JSON.parse(input)
    return { ok: true, value: JSON.stringify(parsed, null, 2) }
  } catch (e) {
    return { ok: false, value: input, error: (e as Error).message }
  }
}

// Basic XML pretty-printer. Not spec-perfect, but good enough for the
// shapes users typically paste (config files, SOAP payloads, SVG).
function formatXml(input: string): FormatResult {
  try {
    const withBreaks = input
      .replace(/>\s*</g, '>\n<')
      .replace(/^\s+|\s+$/g, '')

    const indentUnit = '  '
    let pad = 0
    const out: string[] = []

    for (const rawLine of withBreaks.split('\n')) {
      const line = rawLine.trim()
      if (!line) continue

      const isClose = /^<\/[^>]+>/.test(line)
      const isSelfClose = /\/>$/.test(line) || /^<\?/.test(line) || /^<!/.test(line)
      const isOpenAndClose = /^<[^!?][^>]*>[^<]*<\/[^>]+>$/.test(line)

      if (isClose) pad = Math.max(0, pad - 1)
      out.push(indentUnit.repeat(pad) + line)
      if (!isClose && !isSelfClose && !isOpenAndClose) pad += 1
    }

    return { ok: true, value: out.join('\n') }
  } catch (e) {
    return { ok: false, value: input, error: (e as Error).message }
  }
}

// Minimal CSS pretty-printer fallback. Monaco's CSS worker is usually
// the one in charge, but if it's unavailable we still produce something
// readable.
function formatCss(input: string): FormatResult {
  try {
    const compact = input.replace(/\s+/g, ' ').trim()
    let indent = 0
    let out = ''

    for (let i = 0; i < compact.length; i++) {
      const ch = compact[i]
      if (ch === '{') {
        out += ` {\n${'  '.repeat(indent + 1)}`
        indent++
      } else if (ch === '}') {
        indent = Math.max(0, indent - 1)
        out = out.replace(/\s+$/, '')
        out += `\n${'  '.repeat(indent)}}\n${'  '.repeat(indent)}`
      } else if (ch === ';') {
        out += `;\n${'  '.repeat(indent)}`
      } else {
        out += ch
      }
    }

    return { ok: true, value: `${out.trim()}\n` }
  } catch (e) {
    return { ok: false, value: input, error: (e as Error).message }
  }
}

async function runMonacoFormat(
  editor: monaco.editor.IStandaloneCodeEditor,
): Promise<FormatResult> {
  try {
    const action = editor.getAction('editor.action.formatDocument')
    if (!action) {
      return {
        ok: false,
        value: editor.getValue(),
        unsupported: true,
      }
    }
    await action.run()
    return { ok: true, value: editor.getValue() }
  } catch (e) {
    return { ok: false, value: editor.getValue(), error: (e as Error).message }
  }
}

export async function formatText(
  language: string,
  text: string,
  editor: monaco.editor.IStandaloneCodeEditor | null,
): Promise<FormatResult> {
  if (!text.trim()) {
    return { ok: true, value: text }
  }

  if (language === 'json') return formatJson(text)
  if (language === 'xml') return formatXml(text)

  // Monaco ships built-in formatters for html, css, javascript,
  // typescript, tsx/jsx, and json. Delegate to the editor action
  // so we get the canonical pretty-print.
  if (editor) {
    const monacoResult = await runMonacoFormat(editor)
    if (monacoResult.ok) return monacoResult
    if (!monacoResult.unsupported) return monacoResult
  }

  // Last-ditch fallback for CSS when no editor is attached.
  if (language === 'css') return formatCss(text)

  return {
    ok: false,
    value: text,
    unsupported: true,
  }
}
