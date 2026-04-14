import { diffChars, diffLines, diffWordsWithSpace } from 'diff'
import type { TextDiffOptions } from '../../store/sessionStore'

export type DiffRowType = 'unchanged' | 'added' | 'removed' | 'changed'

export type DiffSegmentKind = 'plain' | 'added' | 'removed'

export type DiffSegment = {
  text: string
  kind: DiffSegmentKind
}

export type DiffRow = {
  id: string
  type: DiffRowType
  leftLine?: number
  rightLine?: number
  leftText: string
  rightText: string
  leftSegments: DiffSegment[]
  rightSegments: DiffSegment[]
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
): { leftSegments: DiffSegment[]; rightSegments: DiffSegment[] } => {
  const chunks =
    precision === 'character' ? diffChars(left, right) : diffWordsWithSpace(left, right)

  const leftSegments: DiffSegment[] = []
  const rightSegments: DiffSegment[] = []

  chunks.forEach((chunk: IntralineSegment) => {
    if (chunk.removed) {
      leftSegments.push({ text: chunk.value, kind: 'removed' })
      return
    }

    if (chunk.added) {
      rightSegments.push({ text: chunk.value, kind: 'added' })
      return
    }

    leftSegments.push({ text: chunk.value, kind: 'plain' })
    rightSegments.push({ text: chunk.value, kind: 'plain' })
  })

  return {
    leftSegments,
    rightSegments,
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
const buildPlainSegments = (text: string): DiffSegment[] =>
  text.length ? [{ text, kind: 'plain' }] : []

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
        leftSegments: buildPlainSegments(current.text),
        rightSegments: buildPlainSegments(current.text),
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
              leftSegments: intraline.leftSegments,
              rightSegments: intraline.rightSegments,
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
              leftSegments: buildPlainSegments(leftText),
              rightSegments: [],
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
              leftSegments: [],
              rightSegments: buildPlainSegments(rightText),
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
          leftSegments: buildPlainSegments(line),
          rightSegments: [],
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
        leftSegments: [],
        rightSegments: buildPlainSegments(current.text),
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
