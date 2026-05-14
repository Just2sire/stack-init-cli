import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import pc from 'picocolors'
import { parseProjectConfig } from '@stack-init/schema'
import type { ProjectConfig } from '@stack-init/schema'
import { LaravelGenerator, writeFiles } from '../generators/laravel/index'
import { generateMakefile, generateBashRunner } from '../generators/runner/makefile'

export interface GenerateOptions {
  config: string
  output: string
  dryRun: boolean
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  // 1. Lecture YAML
  const configPath = path.resolve(opts.config)
  if (!fs.existsSync(configPath)) {
    console.error(pc.red(`\n  ✗ Fichier introuvable : ${configPath}\n`))
    process.exit(1)
  }

  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8'))

  // 2. Validation Zod
  const parsed = parseProjectConfig(raw)
  if (!parsed.success) {
    console.error(pc.red('\n  ✗ Erreurs dans stack-init.yaml :'))
    parsed.errors.forEach(e => console.error(pc.red(`    ${e}`)))
    console.error()
    process.exit(1)
  }

  const config: ProjectConfig = parsed.data
  const projectRoot = path.resolve(opts.output)

  console.log(pc.cyan(`\n  stack-init — ${config.name}  v${config.version}\n`))
  if (opts.dryRun) console.log(pc.yellow('  Mode --dry-run : aucun fichier ne sera écrit\n'))

  // 3. Laravel
  if (config.stack.includes('laravel')) {
    console.log(pc.bold('  Laravel'))
    const generator = new LaravelGenerator()
    const result    = await generator.generate(config)

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    await writeFiles(result.files, projectRoot, opts.dryRun)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))

    // Runner
    const runner = config.laravel?.runner ?? 'makefile'
    if (runner !== 'none') {
      if (['makefile', 'both'].includes(runner)) {
        const content = generateMakefile(config)
        if (!opts.dryRun) fs.writeFileSync(path.join(projectRoot, 'Makefile'), content)
        console.log(`  ${pc.green('✓')} Makefile`)
      }
      if (['bash', 'both'].includes(runner)) {
        const content = generateBashRunner(config)
        const p = path.join(projectRoot, 'run.sh')
        if (!opts.dryRun) { fs.writeFileSync(p, content); fs.chmodSync(p, 0o755) }
        console.log(`  ${pc.green('✓')} run.sh`)
      }
    }
  }

  console.log(pc.bold(pc.green('\n  ✓ Génération terminée\n')))
  if (!opts.dryRun && (config.laravel?.runner ?? 'makefile') !== 'none') {
    console.log(`  Lance ${pc.cyan('make setup')} pour initialiser la base de données\n`)
  }
}
