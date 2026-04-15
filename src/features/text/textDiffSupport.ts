import { diffChars, diffLines, diffWordsWithSpace } from 'diff'
import type { TextDiffOptions } from '../../store/sessionStore'
import type { DiffSegment } from './textDiffTypes'

type IntralineSegment = {
  value: string
  added?: boolean
  removed?: boolean
}

type ExpandedLine = {
  type: 'unchanged' | 'added' | 'removed'
  text: string
}

export const buildPlainSegments = (text: string): DiffSegment[] =>
  text.length ? [{ text, kind: 'plain' }] : []

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

export const applyTransformsAndIgnores = (
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

export const buildIntralineDiff = (
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

export const expandDiffLines = (left: string, right: string): ExpandedLine[] => {
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
