import type { DiffSegment } from './textDiff'

type DiffSegmentsProps = {
  segments: DiffSegment[]
}

export function DiffSegments({ segments }: DiffSegmentsProps) {
  return (
    <>
      {segments.map((segment, index) => (
        segment.kind === 'plain'
          ? <span key={`plain-${index}`}>{segment.text}</span>
          : (
            <mark
              key={`${segment.kind}-${index}`}
              className={segment.kind === 'added' ? 'intraline-added' : 'intraline-removed'}
            >
              {segment.text}
            </mark>
          )
      ))}
    </>
  )
}
