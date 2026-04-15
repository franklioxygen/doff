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
