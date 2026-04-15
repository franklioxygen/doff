import type { TextDiffOptions } from '../../store/sessionStore'
import type { DiffResult, DiffRow, DiffStats } from './textDiffTypes'
import {
  applyTransformsAndIgnores,
  buildIntralineDiff,
  buildPlainSegments,
  expandDiffLines,
} from './textDiffSupport'
export type {
  DiffResult,
  DiffRow,
  DiffRowType,
  DiffSegment,
  DiffSegmentKind,
  DiffStats,
} from './textDiffTypes'

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
