import { useI18n } from '../../i18n'

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
      <header className="page-header">
        <div>
          <h1>{t('about.title')}</h1>
          <p>{t('about.description')}</p>
        </div>
      </header>

      <div className="about-grid">
        {sections.map((section) => (
          <article key={section.title} className="settings-card">
            <h2>{section.title}</h2>
            <p>{section.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}
