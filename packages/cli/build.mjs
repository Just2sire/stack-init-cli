import { build } from 'esbuild'
import { chmodSync, mkdirSync, copyFileSync } from 'fs'

await build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/index.js',
  banner: { js: '#!/usr/bin/env node' },
  external: ['fsevents'],
  sourcemap: false,
})

chmodSync('dist/index.js', 0o755)

// Copy versions.json alongside the binary so `update-versions` can write to it
mkdirSync('dist/config', { recursive: true })
copyFileSync('src/config/versions.json', 'dist/config/versions.json')
