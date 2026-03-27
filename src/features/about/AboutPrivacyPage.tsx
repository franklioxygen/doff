import { SimpleGrid } from '@mantine/core'
import { IconShieldLock } from '@tabler/icons-react'
import { useI18n } from '../../i18n'
import { PageHero } from '../../components/ui/PageHero'
import { SurfaceCard } from '../../components/ui/SurfaceCard'

export function AboutPrivacyPage() {
  const { t } = useI18n()

  const sections = [
    {
      title: t('about.localOnlyTitle'),
      body: t('about.localOnlyBody'),
    },
    {
      title: t('about.noUploadsTitle'),
      body: t('about.noUploadsBody'),
    },
    {
      title: t('about.offlineTitle'),
      body: t('about.offlineBody'),
    },
    {
      title: t('about.storageTitle'),
      body: t('about.storageBody'),
    },
    {
      title: t('about.languagesTitle'),
      body: t('about.languagesBody'),
    },
  ]

  return (
    <section className="about-page">
      <PageHero
        title={t('about.title')}
        description={t('about.description')}
        icon={<IconShieldLock size={26} stroke={1.8} />}
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg" mt="lg">
        {sections.map((section) => (
          <SurfaceCard key={section.title} title={section.title} className="about-card">
            {section.body}
          </SurfaceCard>
        ))}
      </SimpleGrid>
    </section>
  )
}
