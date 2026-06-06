import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export function hasArtisan(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'artisan'))
}

export function runArtisan(projectRoot: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('php', ['artisan', ...args], {
      cwd: projectRoot,
      stdio: 'inherit',
    })
    proc.on('close', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`php artisan ${args.join(' ')} failed (exit ${code})`))
    })
    proc.on('error', reject)
  })
}
