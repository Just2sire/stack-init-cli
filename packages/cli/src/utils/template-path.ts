import path from 'node:path'
import fs from 'node:fs'

export function resolveTemplatesDir(framework: string): string {
  let dir = __dirname
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'templates', framework)
    if (fs.existsSync(candidate)) return candidate
    dir = path.dirname(dir)
  }
  throw new Error(`Templates for '${framework}' not found (searched from: ${__dirname})`)
}
