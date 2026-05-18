import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'

export interface RollbackOptions {
  output: string
}

export async function runRollback(opts: RollbackOptions): Promise<void> {
  const projectRoot = path.resolve(opts.output)
  const manifestPath = path.join(projectRoot, '.stack-init-manifest.json')

  if (!fs.existsSync(manifestPath)) {
    console.error(pc.red(`\n  ✗ Aucun manifeste trouvé dans ${projectRoot}. Impossible de rollback.\n`))
    process.exit(1)
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
  const files: string[] = manifest.files || []

  console.log(pc.cyan(`\n  stack-init — Rollback de la génération du ${manifest.lastGeneration}\n`))

  let deletedCount = 0
  for (const file of files) {
    const fullPath = path.join(projectRoot, file)
    if (fs.existsSync(fullPath)) {
      fs.rmSync(fullPath)
      console.log(`  ${pc.red('✖')} ${file}`)
      deletedCount++
    }
  }

  fs.rmSync(manifestPath)
  console.log(pc.green(`\n  ✓ Rollback terminé (${deletedCount} fichiers supprimés)\n`))
}
