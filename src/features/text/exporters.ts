import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { saveAs } from 'file-saver'
import type * as Monaco from 'monaco-editor'
import type { DiffRow } from './textDiff'
import type { TextSession } from '../../store/sessionStore'

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const colorizeWithMonaco = async (
  monaco: typeof Monaco | null,
  value: string,
  language: string,
): Promise<string> => {
  if (!value.length) {
    return ''
  }

  if (!monaco) {
    return escapeHtml(value)
  }

  try {
    return await monaco.editor.colorize(value, language, {})
  } catch {
    return escapeHtml(value)
  }
}

const lineNumberCell = (value?: number): string =>
  `<td class="ln">${value === undefined ? '' : String(value)}</td>`

export const exportDiffHtml = async (params: {
  monaco: typeof Monaco | null
  rows: DiffRow[]
  language: string
  viewMode: 'split' | 'unified'
  fileName?: string
}) => {
  const { monaco, rows, language, viewMode, fileName = 'doff-diff.html' } = params

  const renderedRows: string[] = []

  for (const row of rows) {
    const leftColor = await colorizeWithMonaco(monaco, row.leftText, language)
    const rightColor = await colorizeWithMonaco(monaco, row.rightText, language)

    if (viewMode === 'split') {
      renderedRows.push(
        `<tr class="r-${row.type}">${lineNumberCell(row.leftLine)}<td class="code">${leftColor}</td>${lineNumberCell(row.rightLine)}<td class="code">${rightColor}</td></tr>`,
      )
      continue
    }

    if (row.type === 'changed') {
      renderedRows.push(
        `<tr class="r-removed">${lineNumberCell(row.leftLine)}<td class="prefix">-</td><td class="code">${leftColor}</td></tr>`,
      )
      renderedRows.push(
        `<tr class="r-added">${lineNumberCell(row.rightLine)}<td class="prefix">+</td><td class="code">${rightColor}</td></tr>`,
      )
      continue
    }

    const unifiedText = row.type === 'removed' ? leftColor : rightColor
    const prefix = row.type === 'removed' ? '-' : row.type === 'added' ? '+' : ' '
    const lineNumber = row.type === 'added' ? row.rightLine : row.leftLine
    renderedRows.push(
      `<tr class="r-${row.type}">${lineNumberCell(lineNumber)}<td class="prefix">${prefix}</td><td class="code">${unifiedText}</td></tr>`,
    )
  }

  const splitCols =
    viewMode === 'split'
      ? '<colgroup><col class="line-col"><col><col class="line-col"><col></colgroup>'
      : '<colgroup><col class="line-col"><col class="prefix-col"><col></colgroup>'

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>doff diff export</title>
<style>
:root{color-scheme:light dark;--bg:#f5f7f9;--surface:#fff;--text:#14171b;--border:#d8dce1;--added:#e7f7ec;--removed:#fbe9e9;--changed:#fff4df}
@media (prefers-color-scheme:dark){:root{--bg:#13171d;--surface:#1a2029;--text:#edf1f7;--border:#2d3644;--added:#1f3328;--removed:#3a2224;--changed:#3f3421}}
body{margin:0;padding:24px;background:var(--bg);color:var(--text);font-family:'IBM Plex Sans',system-ui,sans-serif}
h1{margin:0 0 14px;font-size:20px}
.wrap{overflow:auto;border:1px solid var(--border);background:var(--surface);border-radius:8px}
table{width:100%;border-collapse:collapse;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:13px;line-height:1.4}
.line-col{width:56px}.prefix-col{width:28px}
td{padding:4px 8px;vertical-align:top;border-top:1px solid var(--border)}
tr:first-child td{border-top:none}
.ln{opacity:.7;text-align:right;border-right:1px solid var(--border)}
.prefix{text-align:center;border-right:1px solid var(--border)}
.code{white-space:pre-wrap;word-break:break-word}
.r-added{background:var(--added)}
.r-removed{background:var(--removed)}
.r-changed{background:var(--changed)}
</style>
</head>
<body>
<h1>doff diff export</h1>
<div class="wrap">
<table>
${splitCols}
<tbody>
${renderedRows.join('')}
</tbody>
</table>
</div>
</body>
</html>`

  saveAs(new Blob([html], { type: 'text/html;charset=utf-8' }), fileName)
}

export type DoffBundle = {
  manifest: {
    format: 'doff-text'
    version: 1
    exportedAt: string
    session: Pick<
      TextSession,
      'id' | 'createdAt' | 'updatedAt' | 'leftName' | 'rightName' | 'options'
    >
  }
  leftText: string
  rightText: string
}

export const saveDoffBundle = (session: TextSession) => {
  const payload: DoffBundle = {
    manifest: {
      format: 'doff-text',
      version: 1,
      exportedAt: new Date().toISOString(),
      session: {
        id: session.id,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        leftName: session.leftName,
        rightName: session.rightName,
        options: session.options,
      },
    },
    leftText: session.leftText,
    rightText: session.rightText,
  }

  const zipData = zipSync({
    'manifest.json': strToU8(JSON.stringify(payload.manifest, null, 2)),
    'inputs/left.txt': strToU8(payload.leftText),
    'inputs/right.txt': strToU8(payload.rightText),
  })

  const fileName = `doff-session-${new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-')}.doff`
  saveAs(new Blob([new Uint8Array(zipData)], { type: 'application/zip' }), fileName)
}

export const loadDoffBundle = async (file: File): Promise<DoffBundle> => {
  const buffer = new Uint8Array(await file.arrayBuffer())
  const archive = unzipSync(buffer)
  const manifestRaw = archive['manifest.json']
  const leftRaw = archive['inputs/left.txt']
  const rightRaw = archive['inputs/right.txt']

  if (!manifestRaw || !leftRaw || !rightRaw) {
    throw new Error('Invalid .doff bundle structure.')
  }

  const manifest = JSON.parse(strFromU8(manifestRaw)) as DoffBundle['manifest']

  if (manifest.format !== 'doff-text') {
    throw new Error('Unsupported .doff bundle format.')
  }

  return {
    manifest,
    leftText: strFromU8(leftRaw),
    rightText: strFromU8(rightRaw),
  }
}
