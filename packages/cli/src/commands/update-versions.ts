import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'
import { getVersions, getVersionsFile } from '../config/versions'
import type { VersionsConfig } from '../config/versions'

// Packages tracked in the npm registry
const NPM_PACKAGES = [
  'next', 'react', 'react-dom',
  '@prisma/client', 'prisma',
  'tailwindcss', '@tailwindcss/postcss',
  '@mui/material', '@emotion/react', '@emotion/styled',
  'antd',
  'typescript', '@types/node', '@types/react', '@types/react-dom',
  'tsx',
]

async function fetchNpmLatest(pkg: string): Promise<string | null> {
  try {
    const encoded = encodeURIComponent(pkg).replace('%40', '@').replace('%2F', '/')
    const res = await fetch(`https://registry.npmjs.org/${encoded}/latest`, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { version?: string }
    return data.version ? `^${data.version}` : null
  } catch {
    return null
  }
}

async function fetchLaravelLatest(): Promise<string | null> {
  try {
    const res = await fetch('https://packagist.org/packages/laravel/laravel.json', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { package?: { versions?: Record<string, unknown> } }
    const versions = Object.keys(data.package?.versions ?? {})
    // Find latest stable (e.g. "v12.x-dev" → skip, look for "v12.0.0" patterns)
    const stable = versions
      .filter(v => /^v\d+\.\d+\.\d+$/.test(v))
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }))
    return stable[0] ? stable[0].replace(/^v/, '').split('.')[0] : null
  } catch {
    return null
  }
}

async function fetchFastAPILatest(): Promise<string | null> {
  try {
    const res = await fetch('https://pypi.org/pypi/fastapi/json', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json() as { info?: { version?: string } }
    return data.info?.version ?? null
  } catch {
    return null
  }
}

export async function runUpdateVersions(): Promise<void> {
  console.log(pc.cyan('\n  stack-init — mise à jour des versions\n'))

  const current: VersionsConfig = getVersions()
  const updated: VersionsConfig = JSON.parse(JSON.stringify(current))
  const changes: string[] = []

  // ── npm packages ──────────────────────────────────────────────────────────
  console.log(pc.bold('  npm'))
  for (const pkg of NPM_PACKAGES) {
    process.stdout.write(`    ${pc.dim(pkg)} ...`)
    const latest = await fetchNpmLatest(pkg)
    if (latest && latest !== current.npm[pkg]) {
      const before = current.npm[pkg] ?? pc.dim('(absent)')
      changes.push(`npm.${pkg}: ${pc.red(String(before))} → ${pc.green(latest)}`)
      updated.npm[pkg] = latest
      process.stdout.write(`\r    ${pc.green('✓')} ${pkg} ${pc.dim(current.npm[pkg] ?? '')} → ${pc.green(latest)}\n`)
    } else if (latest) {
      process.stdout.write(`\r    ${pc.dim('–')} ${pkg} ${pc.dim(latest)} (déjà à jour)\n`)
    } else {
      process.stdout.write(`\r    ${pc.yellow('?')} ${pkg} ${pc.dim('(impossible à récupérer)')}\n`)
    }
  }

  // ── Laravel ───────────────────────────────────────────────────────────────
  console.log(pc.bold('\n  Laravel'))
  process.stdout.write(`    ${pc.dim('laravel/laravel')} ...`)
  const laravelLatest = await fetchLaravelLatest()
  if (laravelLatest && laravelLatest !== current.frameworks.laravel) {
    changes.push(`frameworks.laravel: ${pc.red(current.frameworks.laravel)} → ${pc.green(laravelLatest)}`)
    updated.frameworks.laravel = laravelLatest
    process.stdout.write(`\r    ${pc.green('✓')} Laravel ${pc.dim(current.frameworks.laravel)} → ${pc.green(laravelLatest)}\n`)
  } else if (laravelLatest) {
    process.stdout.write(`\r    ${pc.dim('–')} Laravel ${pc.dim(laravelLatest)} (déjà à jour)\n`)
  } else {
    process.stdout.write(`\r    ${pc.yellow('?')} Laravel ${pc.dim('(impossible à récupérer)')}\n`)
  }

  // ── FastAPI ───────────────────────────────────────────────────────────────
  console.log(pc.bold('\n  FastAPI'))
  process.stdout.write(`    ${pc.dim('fastapi')} ...`)
  const fastapiLatest = await fetchFastAPILatest()
  if (fastapiLatest && fastapiLatest !== current.frameworks.fastapi) {
    changes.push(`frameworks.fastapi: ${pc.red(current.frameworks.fastapi)} → ${pc.green(fastapiLatest)}`)
    updated.frameworks.fastapi = fastapiLatest
    process.stdout.write(`\r    ${pc.green('✓')} FastAPI ${pc.dim(current.frameworks.fastapi)} → ${pc.green(fastapiLatest)}\n`)
  } else if (fastapiLatest) {
    process.stdout.write(`\r    ${pc.dim('–')} FastAPI ${pc.dim(fastapiLatest)} (déjà à jour)\n`)
  } else {
    process.stdout.write(`\r    ${pc.yellow('?')} FastAPI ${pc.dim('(impossible à récupérer)')}\n`)
  }

  // ── Write ─────────────────────────────────────────────────────────────────
  if (changes.length === 0) {
    console.log(pc.bold(pc.green('\n  ✓ Toutes les versions sont déjà à jour\n')))
    return
  }

  updated.updatedAt = new Date().toISOString().split('T')[0]
  const versionsFile = getVersionsFile()
  fs.mkdirSync(path.dirname(versionsFile), { recursive: true })
  fs.writeFileSync(versionsFile, JSON.stringify(updated, null, 2) + '\n', 'utf-8')

  console.log(pc.bold(`\n  ${changes.length} version(s) mise(s) à jour :\n`))
  changes.forEach(c => console.log(`    ${c}`))
  console.log(pc.bold(pc.green('\n  ✓ versions.json mis à jour\n')))
}
