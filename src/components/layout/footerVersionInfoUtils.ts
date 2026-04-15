export const DOFF_GITHUB_URL = 'https://github.com/franklioxygen/doff'

const GITHUB_LATEST_RELEASE_API = 'https://api.github.com/repos/franklioxygen/doff/releases/latest'
const GITHUB_TAGS_API = 'https://api.github.com/repos/franklioxygen/doff/tags?per_page=1'
const VERSION_CHECK_CACHE_KEY = 'doff:version-check'
const VERSION_CHECK_CACHE_TTL_MS = 6 * 60 * 60 * 1000

interface GithubReleaseResponse {
  tag_name?: string
  html_url?: string
}

interface GithubTagResponse {
  name?: string
}

export interface UpdateInfo {
  latestVersion: string
  releaseUrl: string
}

interface VersionCheckCache extends UpdateInfo {
  checkedAt: number
  currentVersion: string
  hasUpdate: boolean
}

export const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION

function normalizeVersion(value: string) {
  return value.trim().replace(/^v/i, '')
}

function parseVersionPart(value: string) {
  const match = value.match(/\d+/)
  return match ? Number(match[0]) : 0
}

export function isNewerVersion(latest: string, current: string) {
  try {
    const latestParts = normalizeVersion(latest).split('.').map(parseVersionPart)
    const currentParts = normalizeVersion(current).split('.').map(parseVersionPart)

    for (let index = 0; index < Math.max(latestParts.length, currentParts.length); index += 1) {
      const latestPart = latestParts[index] ?? 0
      const currentPart = currentParts[index] ?? 0

      if (latestPart > currentPart) return true
      if (latestPart < currentPart) return false
    }

    return false
  } catch {
    return normalizeVersion(latest) !== normalizeVersion(current)
  }
}

export function getBuildDateLabel() {
  const buildDate = new Date(import.meta.env.VITE_BUILD_DATE)
  return Number.isNaN(buildDate.getTime())
    ? `Built on ${import.meta.env.VITE_BUILD_DATE}`
    : `Built on ${buildDate.toLocaleString()}`
}

export function readVersionCheckCache() {
  if (typeof window === 'undefined') return null

  try {
    const rawCache = window.localStorage.getItem(VERSION_CHECK_CACHE_KEY)
    if (!rawCache) return null

    const parsed = JSON.parse(rawCache) as Partial<VersionCheckCache>
    if (
      typeof parsed.checkedAt !== 'number'
      || parsed.currentVersion !== CURRENT_VERSION
      || Date.now() - parsed.checkedAt > VERSION_CHECK_CACHE_TTL_MS
      || typeof parsed.latestVersion !== 'string'
      || typeof parsed.releaseUrl !== 'string'
      || typeof parsed.hasUpdate !== 'boolean'
    ) {
      return null
    }

    return parsed as VersionCheckCache
  } catch {
    return null
  }
}

export function writeVersionCheckCache(cache: UpdateInfo & { checkedAt: number; hasUpdate: boolean }) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(VERSION_CHECK_CACHE_KEY, JSON.stringify({
      ...cache,
      currentVersion: CURRENT_VERSION,
    }))
  } catch {
    // Ignore storage errors in private/incognito contexts.
  }
}

function normalizeReleaseUrl(url: string | undefined, fallback: string) {
  try {
    const parsed = new URL(url ?? fallback)
    const isTrustedGithubRelease = parsed.origin === 'https://github.com'
      && parsed.pathname.startsWith('/franklioxygen/doff/releases')

    return isTrustedGithubRelease ? parsed.toString() : fallback
  } catch {
    return fallback
  }
}

async function fetchGithubJson<T>(url: string, signal: AbortSignal) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
    },
    signal,
  })

  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`GitHub version check failed with status ${response.status}`)
  }

  return (await response.json()) as T
}

export async function fetchLatestGithubVersion(signal: AbortSignal) {
  const latestRelease = await fetchGithubJson<GithubReleaseResponse>(GITHUB_LATEST_RELEASE_API, signal)
  if (latestRelease?.tag_name) {
    return {
      latestVersion: normalizeVersion(latestRelease.tag_name),
      releaseUrl: normalizeReleaseUrl(latestRelease.html_url, `${DOFF_GITHUB_URL}/releases/latest`),
    }
  }

  const latestTags = await fetchGithubJson<GithubTagResponse[]>(GITHUB_TAGS_API, signal)
  const latestTag = latestTags?.[0]
  if (!latestTag?.name) return null

  return {
    latestVersion: normalizeVersion(latestTag.name),
    releaseUrl: `${DOFF_GITHUB_URL}/releases/tag/${latestTag.name}`,
  }
}
