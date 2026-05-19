import fs from 'node:fs'
import yaml from 'js-yaml'
import pc from 'picocolors'
import { parseProjectConfig } from '@stack-init/schema'
import { resolveConfigPath } from '../utils/config'

export interface ValidateOptions {
  config: string
}

export async function runValidate(opts: ValidateOptions): Promise<void> {
  const configPath = resolveConfigPath(opts.config)
  let raw: unknown
  try {
    raw = yaml.load(fs.readFileSync(configPath, 'utf-8'))
  } catch (e: any) {
    console.error(pc.red(`\n  ✗ Impossible de lire le fichier : ${e.message}\n`))
    process.exit(1)
  }

  const parsed = parseProjectConfig(raw)

  if (!parsed.success) {
    console.error(pc.red(`\n  ✗ stack-init.yaml invalide — ${parsed.errors.length} erreur(s) :\n`))
    parsed.errors.forEach((e, i) => {
      console.error(pc.red(`  ${i + 1}. `) + e)
    })
    console.error()
    process.exit(1)
  }

  const { data } = parsed
  console.log(pc.green('\n  ✓ stack-init.yaml est valide\n'))
  console.log(`  ${pc.bold('Projet')} : ${pc.cyan(data.name)}  v${data.version}`)
  console.log(`  ${pc.bold('Stack')}  : ${pc.cyan(String(data.stack))}`)
  console.log(`  ${pc.bold('Modèles')}: ${pc.cyan(String(data.models.length))} — ${data.models.map(m => m.name).join(', ') || 'aucun'}`)
  if (data.models.length > 0) {
    const totalFields = data.models.reduce((s, m) => s + m.fields.length, 0)
    console.log(`  ${pc.bold('Champs')} : ${pc.cyan(String(totalFields))} au total`)
  }
  console.log()
}
