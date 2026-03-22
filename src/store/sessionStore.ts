import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Safari < 15.4 doesn't have crypto.randomUUID
const randomUUID = () =>
  typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

export type DiffViewMode = 'split' | 'unified'
export type DiffPrecision = 'word' | 'character'
export type TabSpaceMode = 'none' | 'tabsToSpaces' | 'spacesToTabs'

export type TextDiffOptions = {
  realTime: boolean
  hideUnchanged: boolean
  disableWrap: boolean
  viewMode: DiffViewMode
  precision: DiffPrecision
  language: string
  ignoreLeadingTrailingWhitespace: boolean
  ignoreAllWhitespace: boolean
  ignoreCase: boolean
  ignoreBlankLines: boolean
  trimTrailingWhitespace: boolean
  normalizeUnicode: boolean
  tabSpaceMode: TabSpaceMode
}

export type TextSession = {
  id: string
  createdAt: string
  updatedAt: string
  leftText: string
  rightText: string
  leftName?: string
  rightName?: string
  options: TextDiffOptions
}

type SessionState = {
  theme: 'light' | 'dark'
  textSession: TextSession
  setTheme: (theme: 'light' | 'dark') => void
  toggleTheme: () => void
  setLeftText: (value: string, sourceName?: string) => void
  setRightText: (value: string, sourceName?: string) => void
  setTextOptions: (partial: Partial<TextDiffOptions>) => void
  swapSides: () => void
  clearTextSession: () => void
  overwriteTextSession: (session: Partial<TextSession>) => void
}

const defaultTextOptions: TextDiffOptions = {
  realTime: true,
  hideUnchanged: false,
  disableWrap: false,
  viewMode: 'split',
  precision: 'word',
  language: 'plaintext',
  ignoreLeadingTrailingWhitespace: false,
  ignoreAllWhitespace: false,
  ignoreCase: false,
  ignoreBlankLines: false,
  trimTrailingWhitespace: false,
  normalizeUnicode: false,
  tabSpaceMode: 'none',
}

const createDefaultSession = (): TextSession => {
  const now = new Date().toISOString()
  return {
    id: randomUUID(),
    createdAt: now,
    updatedAt: now,
    leftText: '',
    rightText: '',
    options: defaultTextOptions,
  }
}

const touch = (session: TextSession): TextSession => ({
  ...session,
  updatedAt: new Date().toISOString(),
})

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      theme: 'light',
      textSession: createDefaultSession(),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setLeftText: (value, sourceName) =>
        set((state) => ({
          textSession: touch({
            ...state.textSession,
            leftText: value,
            leftName: sourceName ?? state.textSession.leftName,
          }),
        })),
      setRightText: (value, sourceName) =>
        set((state) => ({
          textSession: touch({
            ...state.textSession,
            rightText: value,
            rightName: sourceName ?? state.textSession.rightName,
          }),
        })),
      setTextOptions: (partial) =>
        set((state) => ({
          textSession: touch({
            ...state.textSession,
            options: { ...state.textSession.options, ...partial },
          }),
        })),
      swapSides: () =>
        set((state) => ({
          textSession: touch({
            ...state.textSession,
            leftText: state.textSession.rightText,
            rightText: state.textSession.leftText,
            leftName: state.textSession.rightName,
            rightName: state.textSession.leftName,
          }),
        })),
      clearTextSession: () => set({ textSession: createDefaultSession() }),
      overwriteTextSession: (session) =>
        set((state) => ({
          textSession: touch({
            ...state.textSession,
            ...session,
            options: {
              ...state.textSession.options,
              ...(session.options ?? {}),
            },
          }),
        })),
    }),
    {
      name: 'doff-session-store',
      partialize: (state) => ({
        theme: state.theme,
        textSession: state.textSession,
      }),
    },
  ),
)

export const textDefaultOptions = defaultTextOptions
