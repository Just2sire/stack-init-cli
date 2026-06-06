import fs from 'node:fs'
import path from 'node:path'
import readline from 'node:readline'
import pc from 'picocolors'

export interface GeneratedFile {
  outputPath: string
  content: string
  /** When true, skip the overwrite-confirmation prompt for this file (e.g. artisan just created it). */
  skipOverwriteCheck?: boolean
}

// Files whose content is patched (not replaced wholesale) — no overwrite warning needed.
const PATCHABLE_PATHS = ['routes/api.php', 'database/seeders/DatabaseSeeder.php']

function isPatchable(outputPath: string): boolean {
  const normalized = outputPath.replace(/\\/g, '/')
  return PATCHABLE_PATHS.some(p => normalized === p || normalized.endsWith('/' + p))
}

async function askConfirm(question: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
    rl.question(question, (answer) => {
      rl.close()
      const a = answer.trim().toLowerCase()
      resolve(a === 'y' || a === 'o' || a === 'yes' || a === 'oui')
    })
  })
}

export async function writeFiles(
  files: GeneratedFile[],
  root: string,
  dryRun = false,
  force = false,
): Promise<void> {
  if (dryRun) return

  const conflicting = files.filter(
    f => !isPatchable(f.outputPath) && !f.skipOverwriteCheck && fs.existsSync(path.join(root, f.outputPath))
  )

  let overwrite = force
  if (!force && conflicting.length > 0) {
    console.log(pc.yellow(`\n  ⚠  ${conflicting.length} fichier(s) existent déjà :`))
    conflicting.forEach(f => console.log(`     ${pc.dim(f.outputPath)}`))
    overwrite = await askConfirm(pc.yellow('\n  Écraser tous ces fichiers ? [o/N] : '))
    if (!overwrite) console.log(pc.dim('\n  Fichiers existants conservés.\n'))
  }

  const conflictPaths = new Set(conflicting.map(f => f.outputPath))

  for (const file of files) {
    if (conflictPaths.has(file.outputPath) && !overwrite) continue
    const full = path.join(root, file.outputPath)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, file.content, 'utf-8')
  }
}
