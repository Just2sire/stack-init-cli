import fs from 'node:fs'
import path from 'node:path'
import pc from 'picocolors'

const DEFAULT_CONFIG = 'stack-init.yaml'

export function resolveConfigPath(configOption: string): string {
  const explicit = path.resolve(configOption)
  if (fs.existsSync(explicit)) return explicit

  if (configOption === DEFAULT_CONFIG) {
    const cwd = process.cwd()
    const matches = fs.readdirSync(cwd).filter(f => f.endsWith('.stack-init.yaml'))

    if (matches.length === 1) {
      return path.resolve(cwd, matches[0])
    }
    if (matches.length > 1) {
      console.error(pc.red('\n  ✗ Plusieurs fichiers *.stack-init.yaml trouvés. Précisez avec -c :\n'))
      matches.forEach(m => console.error(pc.red(`    - ${m}`)))
      console.error()
      process.exit(1)
    }
  }

  console.error(pc.red(`\n  ✗ Fichier introuvable : ${explicit}\n`))
  process.exit(1)
}
