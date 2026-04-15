import { Anchor, Group, Text } from '@mantine/core'
import { IconBrandGithub } from '@tabler/icons-react'
import { FooterVersionInfo } from './FooterVersionInfo'
import { DOFF_GITHUB_URL } from './footerVersionInfoUtils'

export function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-row">
        <Group gap="sm" wrap="wrap" className="footer-meta">
          <Anchor
            href={DOFF_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <IconBrandGithub size={16} stroke={1.8} />
            doff
          </Anchor>
          <FooterVersionInfo />
        </Group>
        <Text size="sm" className="footer-credit">
          Created by franklioxygen
        </Text>
      </div>
    </footer>
  )
}
