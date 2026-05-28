import fs from 'node:fs'
import path from 'node:path'
import defaultVersionsJson from './versions.json'

export interface VersionsConfig {
  updatedAt: string
  runtimes: { node: string; php: string; python: string }
  frameworks: { laravel: string; fastapi: string }
  npm: Record<string, string>
}

// Path to the mutable versions.json copied alongside the binary at build time
// (dist/config/versions.json). Allows `update-versions` to persist changes.
function resolveVersionsFile(): string {
  return path.join(path.dirname(process.argv[1]), 'config', 'versions.json')
}

let _cache: VersionsConfig | null = null

export function getVersions(): VersionsConfig {
  if (_cache) return _cache
  const file = resolveVersionsFile()
  if (fs.existsSync(file)) {
    try {
      _cache = JSON.parse(fs.readFileSync(file, 'utf-8')) as VersionsConfig
      return _cache
    } catch { /* fall through */ }
  }
  _cache = defaultVersionsJson as VersionsConfig
  return _cache
}

export function getVersionsFile(): string {
  return resolveVersionsFile()
}

export const versions: VersionsConfig = defaultVersionsJson as VersionsConfig

export function npmVersion(pkg: string, fallback = 'latest'): string {
  return getVersions().npm[pkg] ?? fallback
}
