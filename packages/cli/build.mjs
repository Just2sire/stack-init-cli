import { build } from 'esbuild'
import { chmodSync, mkdirSync, copyFileSync } from 'fs'

const sharedConfig = {
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  external: ['fsevents'],
  sourcemap: false,
}

await build({
  ...sharedConfig,
  entryPoints: ['src/index.ts'],
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
})

await build({
  ...sharedConfig,
  entryPoints: ['src/create.ts'],
  outfile: 'dist/create.js',
  banner: { js: '#!/usr/bin/env node' },
})

chmodSync('dist/index.js', 0o755)
chmodSync('dist/create.js', 0o755)

// Copy versions.json alongside the binary so `update-versions` can write to it
mkdirSync('dist/config', { recursive: true })
copyFileSync('src/config/versions.json', 'dist/config/versions.json')
