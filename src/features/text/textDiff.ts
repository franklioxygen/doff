import { diffChars, diffLines, diffWordsWithSpace } from 'diff'
import type { TextDiffOptions } from '../../store/sessionStore'

export type DiffRowType = 'unchanged' | 'added' | 'removed' | 'changed'

export type DiffRow = {
  id: string
  type: DiffRowType
  leftLine?: number
  rightLine?: number
  leftText: string
  rightText: string
  leftHtml: string
  rightHtml: string
}

export type DiffStats = {
  added: number
  removed: number
  changed: number
}

export type DiffResult = {
  rows: DiffRow[]
  stats: DiffStats
}

type IntralineSegment = {
  value: string
  added?: boolean
  removed?: boolean
}

const escapeHtml = (value: string): string =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const splitLines = (value: string): string[] => {
  if (!value.length) {
    return []
  }
  const normalized = value.replace(/\r\n?/g, '\n')
  const parts = normalized.split('\n')
  if (normalized.endsWith('\n')) {
    parts.pop()
  }
  return parts
}

const applyTransformsAndIgnores = (
  value: string,
  options: TextDiffOptions,
): string => {
  let next = value.replace(/\r\n?/g, '\n')

  if (options.normalizeUnicode) {
    next = next.normalize('NFC')
  }

  if (options.trimTrailingWhitespace) {
    next = next
      .split('\n')
      .map((line) => line.replace(/[\t ]+$/g, ''))
      .join('\n')
  }

  if (options.tabSpaceMode === 'tabsToSpaces') {
    next = next.replaceAll('\t', '  ')
  }

  if (options.tabSpaceMode === 'spacesToTabs') {
    next = next.replace(/ {2}/g, '\t')
  }

  if (options.ignoreLeadingTrailingWhitespace) {
    next = next
      .split('\n')
      .map((line) => line.trim())
      .join('\n')
  }

  if (options.ignoreAllWhitespace) {
    next = next
      .split('\n')
      .map((line) => line.replace(/[\t ]+/g, ''))
      .join('\n')
  }

  if (options.ignoreCase) {
    next = next.toLowerCase()
  }

  if (options.ignoreBlankLines) {
    next = next
      .split('\n')
      .filter((line) => line.trim().length > 0)
      .join('\n')
  }

  return next
}

const buildIntralineDiff = (
  left: string,
  right: string,
  precision: TextDiffOptions['precision'],
): { leftHtml: string; rightHtml: string } => {
  const chunks =
    precision === 'character' ? diffChars(left, right) : diffWordsWithSpace(left, right)

  const leftParts: string[] = []
  const rightParts: string[] = []

  chunks.forEach((chunk: IntralineSegment) => {
    const safe = escapeHtml(chunk.value)

    if (chunk.removed) {
      leftParts.push(`<mark class="intraline-removed">${safe}</mark>`)
      return
    }

    if (chunk.added) {
      rightParts.push(`<mark class="intraline-added">${safe}</mark>`)
      return
    }

    leftParts.push(safe)
    rightParts.push(safe)
  })

  return {
    leftHtml: leftParts.join(''),
    rightHtml: rightParts.join(''),
  }
}

type ExpandedLine = {
  type: 'unchanged' | 'added' | 'removed'
  text: string
}

const expandDiffLines = (left: string, right: string): ExpandedLine[] => {
  const parts = diffLines(left, right)
  const expanded: ExpandedLine[] = []

  parts.forEach((part) => {
    const lines = splitLines(part.value)
    const type = part.added ? 'added' : part.removed ? 'removed' : 'unchanged'

    lines.forEach((line) => {
      expanded.push({ type, text: line })
    })
  })

  return expanded
}

const makeRowId = (index: number): string => `row-${index}`

export const computeDiff = (
  leftRaw: string,
  rightRaw: string,
  options: TextDiffOptions,
): DiffResult => {
  const left = applyTransformsAndIgnores(leftRaw, options)
  const right = applyTransformsAndIgnores(rightRaw, options)

  const expanded = expandDiffLines(left, right)

  const rows: DiffRow[] = []
  const stats: DiffStats = {
    added: 0,
    removed: 0,
    changed: 0,
  }

  let leftLine = 1
  let rightLine = 1
  let i = 0
  let rowIndex = 0

  while (i < expanded.length) {
    const current = expanded[i]

    if (current.type === 'unchanged') {
      rows.push({
        id: makeRowId(rowIndex),
        type: 'unchanged',
        leftLine,
        rightLine,
        leftText: current.text,
        rightText: current.text,
        leftHtml: escapeHtml(current.text),
        rightHtml: escapeHtml(current.text),
      })
      leftLine += 1
      rightLine += 1
      i += 1
      rowIndex += 1
      continue
    }

    if (current.type === 'removed') {
      const removed: string[] = []
      while (i < expanded.length && expanded[i].type === 'removed') {
        removed.push(expanded[i].text)
        i += 1
      }

      const added: string[] = []
      let j = i
      while (j < expanded.length && expanded[j].type === 'added') {
        added.push(expanded[j].text)
        j += 1
      }

      if (added.length) {
        i = j
        const pairCount = Math.max(removed.length, added.length)

        for (let offset = 0; offset < pairCount; offset += 1) {
          const leftText = removed[offset] ?? ''
          const rightText = added[offset] ?? ''

          if (leftText.length && rightText.length) {
            const intraline = buildIntralineDiff(leftText, rightText, options.precision)
            rows.push({
              id: makeRowId(rowIndex),
              type: 'changed',
              leftLine,
              rightLine,
              leftText,
              rightText,
              leftHtml: intraline.leftHtml,
              rightHtml: intraline.rightHtml,
            })
            stats.changed += 1
            leftLine += 1
            rightLine += 1
          } else if (leftText.length) {
            rows.push({
              id: makeRowId(rowIndex),
              type: 'removed',
              leftLine,
              leftText,
              rightText: '',
              leftHtml: escapeHtml(leftText),
              rightHtml: '',
            })
            stats.removed += 1
            leftLine += 1
          } else {
            rows.push({
              id: makeRowId(rowIndex),
              type: 'added',
              rightLine,
              leftText: '',
              rightText,
              leftHtml: '',
              rightHtml: escapeHtml(rightText),
            })
            stats.added += 1
            rightLine += 1
          }
          rowIndex += 1
        }
        continue
      }

      removed.forEach((line) => {
        rows.push({
          id: makeRowId(rowIndex),
          type: 'removed',
          leftLine,
          leftText: line,
          rightText: '',
          leftHtml: escapeHtml(line),
          rightHtml: '',
        })
        stats.removed += 1
        leftLine += 1
        rowIndex += 1
      })
      continue
    }

    if (current.type === 'added') {
      rows.push({
        id: makeRowId(rowIndex),
        type: 'added',
        rightLine,
        leftText: '',
        rightText: current.text,
        leftHtml: '',
        rightHtml: escapeHtml(current.text),
      })
      stats.added += 1
      rightLine += 1
      rowIndex += 1
      i += 1
    }
  }

  return {
    rows,
    stats,
  }
}
