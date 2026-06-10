import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import ora from 'ora'
import pc from 'picocolors'

export function hasArtisan(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'artisan'))
}

export function runArtisan(projectRoot: string, args: string[]): Promise<void> {
  const spinner = ora(`php artisan ${args.join(' ')}`).start()

  return new Promise((resolve, reject) => {
    const proc = spawn('php', ['artisan', ...args], {
      cwd: projectRoot,
      stdio: 'pipe',
    })

    let output = ''
    proc.stdout?.on('data', (data) => { output += data.toString() })
    proc.stderr?.on('data', (data) => { output += data.toString() })

    proc.on('close', (code) => {
      if (code === 0) {
        spinner.succeed()
        resolve()
      } else {
        spinner.fail(pc.red(`php artisan ${args.join(' ')} failed (exit ${code})`))
        if (output) console.error(pc.dim(output))
        reject(new Error(`php artisan ${args.join(' ')} failed (exit ${code})`))
      }
    })
    proc.on('error', (err) => {
      spinner.fail()
      reject(err)
    })
  })
}
