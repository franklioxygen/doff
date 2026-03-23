import { createTheme } from '@mantine/core'

export const doffTheme = createTheme({
  primaryColor: 'moss',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'xl',
  cursorType: 'pointer',
  fontFamily: 'IBM Plex Sans, system-ui, sans-serif',
  fontFamilyMonospace: 'IBM Plex Mono, ui-monospace, monospace',
  headings: {
    fontFamily: 'Space Grotesk, IBM Plex Sans, system-ui, sans-serif',
    fontWeight: '700',
  },
  colors: {
    moss: [
      '#edf9f2',
      '#d7f0e0',
      '#b3e1c2',
      '#8ad0a1',
      '#63c183',
      '#49b46f',
      '#38995b',
      '#2c7847',
      '#215938',
      '#133724',
    ],
    slate: [
      '#f4f7f8',
      '#e7edf0',
      '#cdd8dd',
      '#afc0c8',
      '#90a8b3',
      '#7c95a1',
      '#6d8795',
      '#5a7280',
      '#4f6574',
      '#415463',
    ],
    ember: [
      '#fff1ef',
      '#ffe1dc',
      '#ffc2b7',
      '#ff9f8f',
      '#ff7f68',
      '#ff6a50',
      '#fb5f43',
      '#e04c33',
      '#c7422c',
      '#ac3421',
    ],
    amber: [
      '#fff6e7',
      '#ffedcd',
      '#ffdaa0',
      '#ffc66e',
      '#ffb446',
      '#ffa62b',
      '#ff9e1a',
      '#e38807',
      '#ca7800',
      '#af6500',
    ],
  },
  shadows: {
    xs: '0 8px 20px rgba(15, 32, 40, 0.06)',
    sm: '0 12px 30px rgba(15, 32, 40, 0.08)',
    md: '0 16px 36px rgba(15, 32, 40, 0.1)',
    xl: '0 24px 60px rgba(15, 32, 40, 0.16)',
  },
  components: {
    Button: {
      defaultProps: {
        radius: 'xl',
      },
    },
    ActionIcon: {
      defaultProps: {
        radius: 'xl',
        variant: 'default',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'xl',
        shadow: 'xs',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'xl',
        variant: 'light',
      },
    },
    Select: {
      defaultProps: {
        radius: 'xl',
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'xl',
      },
    },
    SegmentedControl: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Switch: {
      defaultProps: {
        color: 'moss',
      },
    },
  },
})
