// Language detection for pasted text. Mirrors the heuristics used by
// the text compare page but lives alongside the formatter so the two
// features can evolve independently.

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

export function detectLanguageFromContent(text: string): string | null {
  const trimmed = text.trimStart()
  if (!trimmed) return null

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
  if (/\{[^{}]*:[^{}]*;[^{}]*\}/.test(text) && /[.#]?[\w-]+\s*\{/.test(text)) return 'css'
  if (/^\s*#\s+/.test(trimmed) || /^\s*```/.test(trimmed)) return 'markdown'

  return null
}

export function detectLanguage(text: string, fileName?: string): string | null {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase()
    if (ext && EXT_TO_LANG[ext]) return EXT_TO_LANG[ext]
  }
  return detectLanguageFromContent(text)
}
