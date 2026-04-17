import type { DiffSegment } from './textDiff'

type DiffSegmentsProps = {
  segments: DiffSegment[]
}

export function DiffSegments({ segments }: DiffSegmentsProps) {
  const keyedSegments = segments.reduce<{
    offset: number
    items: Array<{ key: string; segment: DiffSegment }>
  }>((state, segment) => ({
    offset: state.offset + segment.text.length,
    items: [
      ...state.items,
      {
        key: `${segment.kind}-${state.offset}-${segment.text}`,
        segment,
      },
    ],
  }), { offset: 0, items: [] }).items

  return (
    <>
      {keyedSegments.map(({ key, segment }) => (
        segment.kind === 'plain'
          ? <span key={key}>{segment.text}</span>
          : (
            <mark
              key={key}
              className={segment.kind === 'added' ? 'intraline-added' : 'intraline-removed'}
            >
              {segment.text}
            </mark>
          )
      ))}
    </>
  )
}
