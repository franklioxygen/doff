import { Anchor, Group, Text } from '@mantine/core'
import { IconBrandGithub } from '@tabler/icons-react'

export function Footer() {
  return (
    <footer className="app-footer" role="contentinfo">
      <div className="footer-row">
        <Group gap="sm" wrap="wrap" className="footer-meta">
          <Anchor
            href="https://github.com/franklioxygen/doff"
            target="_blank"
            rel="noopener noreferrer"
            className="footer-link"
          >
            <IconBrandGithub size={16} stroke={1.8} />
            doff
          </Anchor>
          <Text
            size="sm"
            className="footer-version"
            title={`Built on ${new Date(import.meta.env.VITE_BUILD_DATE).toLocaleString()}`}
          >
            v{import.meta.env.VITE_APP_VERSION}
          </Text>
        </Group>
        <Text size="sm" className="footer-credit">
          Created by franklioxygen
        </Text>
      </div>
    </footer>
  )
}
