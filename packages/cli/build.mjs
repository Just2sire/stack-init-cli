import { build } from 'esbuild'
import { chmodSync } from 'fs'

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