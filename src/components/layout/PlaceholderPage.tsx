import { IconSparkles } from '@tabler/icons-react'
import { EmptyState } from '../ui/EmptyState'

type PlaceholderPageProps = {
  title: string
  description: string
}

export function PlaceholderPage({ title, description }: PlaceholderPageProps) {
  return (
    <section className="placeholder-page">
      <EmptyState
        icon={<IconSparkles size={28} stroke={1.8} />}
        title={title}
        description={description}
      />
    </section>
  )
}
