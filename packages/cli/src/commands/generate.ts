import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import pc from 'picocolors'
import { parseProjectConfig, isMixedStack } from '@stack-init/schema'
import type { ProjectConfig, ServiceId } from '@stack-init/schema'
import { resolveConfigPath } from '../utils/config'
import { LaravelGenerator } from '../generators/laravel/index'
import { ExpressGenerator } from '../generators/express/index'
import { NestGenerator } from '../generators/nest/index'
import { FastAPIGenerator } from '../generators/fastapi/index'
import { ZipGenerator } from '../generators/zip/index'
import { NextJSGenerator } from '../generators/nextjs/index'
import { ReactGenerator } from '../generators/react/index'
import { writeFiles, type GeneratedFile } from '../utils/fs'
import { generateMakefile, generateBashRunner } from '../generators/runner/makefile'
import {
  generateSetupSh, generateSetupPs1, generateSetupBat,
  generateDevSh, generateDevPs1, generateDevBat,
} from '../generators/runner/scripts'
import { buildTerminalSummary, buildGettingStartedMd } from '../utils/setup-instructions'
import { generateServices } from '../generators/services/index'
import { generateFrontendApi } from '../generators/frontend-api/index'
import { generateCICD } from '../generators/cicd/index'
import { VueGenerator } from '../generators/vue/index'
import { T3Generator } from '../generators/t3/index'
import { DjangoGenerator } from '../generators/django/index'
import { generateDockerFiles } from '../generators/docker/index'

export interface GenerateOptions {
  config: string
  output: string
  dryRun: boolean
}

export async function runGenerate(opts: GenerateOptions): Promise<void> {
  // 1. Lecture YAML
  const configPath = resolveConfigPath(opts.config)
  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8'))

  // 2. Validation Zod
  const parsed = parseProjectConfig(raw)
  if (!parsed.success) {
    console.error(pc.red(`\n  ✗ stack-init.yaml invalide — ${parsed.errors.length} erreur(s) :\n`))
    parsed.errors.forEach((e, i) => {
      // Try to detect the field path from common Zod error patterns
      const fieldMatch = e.match(/^([a-z_.[\]0-9]+):\s*(.+)$/i)
      if (fieldMatch) {
        console.error(`  ${pc.red(`${i + 1}.`)} ${pc.yellow(fieldMatch[1])} — ${fieldMatch[2]}`)
      } else {
        console.error(`  ${pc.red(`${i + 1}.`)} ${e}`)
      }
    })
    console.error(pc.dim('\n  Astuce : lancez "stack-init validate" pour une analyse détaillée.\n'))
    process.exit(1)
  }

  const config: ProjectConfig = parsed.data
  const projectRoot = path.resolve(opts.output)
  const isMixed = isMixedStack(config.stack)

  // Cross-stack validation: ensure required stack configs are present
  const stackStr = config.stack as string
  if ((stackStr === 'fastapi' || stackStr.startsWith('fastapi+')) && !config.fastapi) {
    console.error(pc.red(`\n  ✗ Stack "${config.stack}" requires a "fastapi:" section in the config.\n`))
    process.exit(1)
  }
  if ((stackStr === 'laravel' || stackStr.startsWith('laravel+')) && !config.laravel) {
    console.error(pc.red(`\n  ✗ Stack "${config.stack}" requires a "laravel:" section in the config.\n`))
    process.exit(1)
  }
  if (stackStr === 'mean' && !process.env.STACK_INIT_ALLOW_UNSUPPORTED) {
    console.error(pc.red(`\n  ✗ Stack "mean" (Angular) is not yet supported by the CLI generator.\n`))
    console.error(pc.yellow(`  Use "mevn" (Vue) or another supported stack instead.\n`))
    process.exit(1)
  }
  if (stackStr === 'rails' && !process.env.STACK_INIT_ALLOW_UNSUPPORTED) {
    console.error(pc.red(`\n  ✗ Stack "rails" is not yet supported by the CLI generator.\n`))
    console.error(pc.yellow(`  Supported stacks: laravel, express, nestjs, fastapi, django, and their combos with react/nextjs.\n`))
    process.exit(1)
  }

  console.log(pc.cyan(`\n  stack-init — ${config.name}  v${config.version}\n`))
  if (opts.dryRun) console.log(pc.yellow('  Mode --dry-run : aucun fichier ne sera écrit\n'))

  const allGeneratedFiles: GeneratedFile[] = []
  const manifestFiles: string[] = []

  // 3. Identification des générateurs à lancer
  
  // -- Laravel --
  if (config.stack.includes('laravel')) {
    console.log(pc.bold('  Laravel'))
    const generator = new LaravelGenerator()
    const result    = await generator.generate(config, projectRoot)
    // Laravel is always at root — even in mixed stacks it's the primary framework.
    // The frontend stack gets its own 'frontend/' subfolder.
    const subfolder = '.'
    
    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))

    // Runner spécifique Laravel si pas mixed
    if (!isMixed) {
      const runner = config.laravel?.runner ?? 'makefile'
      if (runner !== 'none') {
        if (['makefile', 'both'].includes(runner)) {
          allGeneratedFiles.push({ outputPath: 'Makefile', content: generateMakefile(config) })
          console.log(`  ${pc.green('✓')} Makefile`)
        }
        if (['bash', 'both'].includes(runner)) {
          allGeneratedFiles.push({ outputPath: 'run.sh', content: generateBashRunner(config) })
          console.log(`  ${pc.green('✓')} run.sh`)
        }
      }
    }
  }

  // -- Express --
  if (config.stack.includes('express')) {
    console.log(pc.bold('  Express'))
    const generator = new ExpressGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = isMixed ? 'backend' : '.'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- NestJS --
  if (config.stack.includes('nestjs')) {
    console.log(pc.bold('  NestJS'))
    const generator = new NestGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = isMixed ? 'backend' : '.'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- FastAPI --
  if (config.stack.includes('fastapi')) {
    console.log(pc.bold('  FastAPI'))
    const generator = new FastAPIGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = isMixed ? 'backend' : '.'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- Django --
  if (config.stack === 'django') {
    console.log(pc.bold('  Django'))
    const generator = new DjangoGenerator()
    const result    = await generator.generate(config, projectRoot)
    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    allGeneratedFiles.push(...result.files)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- Next.js (model-aware generator) --
  if (config.stack.includes('nextjs')) {
    console.log(pc.bold('  Next.js'))
    const generator = new NextJSGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = isMixed ? 'frontend' : '.'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- React SPA (Vite) --
  if (config.stack.includes('react') && !config.stack.includes('nextjs') && config.stack !== 'mevn') {
    console.log(pc.bold('  React (Vite)'))
    const generator = new ReactGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = isMixed ? 'frontend' : '.'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- T3 Stack (Next.js + tRPC + Prisma + Tailwind) --
  if (config.stack === 't3') {
    console.log(pc.bold('  T3 Stack'))
    const generator = new T3Generator()
    const result    = await generator.generate(config, projectRoot)
    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    allGeneratedFiles.push(...result.files)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // -- Vue 3 (Vite) — used for MEVN stack --
  if (config.stack === 'mevn') {
    console.log(pc.bold('  Vue 3 (Vite)'))
    const generator = new VueGenerator()
    const result    = await generator.generate(config, projectRoot)
    const subfolder = 'frontend'

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    const files = result.files.map(f => ({ ...f, outputPath: path.join(subfolder, f.outputPath) }))
    allGeneratedFiles.push(...files)
    files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // 4. Orchestration Globale (Makefile & Docker racine pour multi-stack)
  if (isMixed) {
    // Makefile
    let makefileContent = `# Makefile global pour ${config.name}\n\n`
    makefileContent += `.PHONY: setup dev clean stop\n\n`
    makefileContent += `setup:\n`
    makefileContent += `\t@echo "🚀 Initialisation du projet multi-stack..."\n`
    
    if (config.stack.includes('laravel')) {
      // Laravel files are at root; only the frontend lives in frontend/
      makefileContent += `\tcomposer install --no-interaction && cp .env.example .env && php artisan key:generate\n`
      makefileContent += `\tcd frontend && npm install\n`
      makefileContent += `\t@echo "✅ Setup terminé. N'oublie pas de configurer ton .env"\n\n`
    } else {
      makefileContent += `\tcd backend && npm install\n`
      makefileContent += `\tcd frontend && npm install\n`
      makefileContent += `\t@echo "✅ Setup terminé."\n\n`
    }

    makefileContent += `dev:\n`
    makefileContent += `\t@echo "🏁 Démarrage des services..."\n`
    makefileContent += `\t@bash dev.sh\n`

    makefileContent += `\nstop:\n`
    makefileContent += `\t@echo "🛑 Arrêt des services..."\n`
    if (config.stack.includes('laravel')) {
      makefileContent += `\t-pkill -f "php artisan serve" 2>/dev/null || true\n`
    } else {
      makefileContent += `\t-pkill -f "npm run dev" 2>/dev/null || true\n`
    }
    makefileContent += `\t-pkill -f "npm run dev" 2>/dev/null || true\n`

    allGeneratedFiles.push({ outputPath: 'Makefile', content: makefileContent })
    console.log(`  ${pc.green('✓')} Makefile (global)`)

  }

  // Docker files (compose + Dockerfiles + .dockerignore)
  console.log(pc.bold('  Docker'))
  const dockerFiles = generateDockerFiles(config, isMixed)
  allGeneratedFiles.push(...dockerFiles)
  dockerFiles.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))


  // 5a. GitHub Actions CI/CD
  console.log(pc.bold('  CI/CD'))
  const ciFiles = generateCICD(config)
  allGeneratedFiles.push(...ciFiles)
  ciFiles.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))

  // 5. Scripts cross-platform (setup + dev) + GETTING_STARTED.md
  allGeneratedFiles.push({ outputPath: 'setup.sh',  content: generateSetupSh(config) })
  allGeneratedFiles.push({ outputPath: 'setup.ps1', content: generateSetupPs1(config) })
  allGeneratedFiles.push({ outputPath: 'setup.bat', content: generateSetupBat(config) })
  allGeneratedFiles.push({ outputPath: 'GETTING_STARTED.md', content: buildGettingStartedMd(config) })
  console.log(`  ${pc.green('✓')} setup.sh / setup.ps1 / setup.bat`)
  console.log(`  ${pc.green('✓')} GETTING_STARTED.md`)
  if (isMixed) {
    allGeneratedFiles.push({ outputPath: 'dev.sh',  content: generateDevSh(config) })
    allGeneratedFiles.push({ outputPath: 'dev.ps1', content: generateDevPs1(config) })
    allGeneratedFiles.push({ outputPath: 'dev.bat', content: generateDevBat(config) })
    console.log(`  ${pc.green('✓')} dev.sh / dev.ps1 / dev.bat`)
  }

  // 6. Services additionnels (email, cache, queue, file-upload, websockets)
  const services = (config.services ?? []) as ServiceId[]
  if (services.length > 0) {
    console.log(pc.bold('  Services'))
    const before = allGeneratedFiles.length
    generateServices(config, services, allGeneratedFiles)
    const added = allGeneratedFiles.slice(before)
    added.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // Frontend API client for mixed stacks
  if (isMixed && (config.stack.includes('react') || config.stack.includes('nextjs'))) {
    console.log(pc.bold('  Frontend API client'))
    const before = allGeneratedFiles.length
    generateFrontendApi(config, allGeneratedFiles)
    const added = allGeneratedFiles.slice(before)
    added.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
  }

  // 7. Écriture des fichiers
  // Identify files that don't exist yet — only those will be tracked for rollback.
  // Pre-existing files that were overwritten are NOT deleted on rollback to avoid data loss.
  const preExistingPaths = new Set(
    allGeneratedFiles
      .filter(f => fs.existsSync(path.join(projectRoot, f.outputPath)))
      .map(f => f.outputPath)
  )

  await writeFiles(allGeneratedFiles, projectRoot, opts.dryRun)
  manifestFiles.push(...allGeneratedFiles
    .filter(f => !preExistingPaths.has(f.outputPath))
    .map(f => f.outputPath)
  )

  // 8. Manifeste
  if (!opts.dryRun) {
    const manifest = {
      lastGeneration: new Date().toISOString(),
      files: Array.from(new Set(manifestFiles))
    }
    fs.writeFileSync(path.join(projectRoot, '.stack-init-manifest.json'), JSON.stringify(manifest, null, 2))
  }

  if (!opts.dryRun) {
    buildTerminalSummary(config, opts.output)
  } else {
    console.log(pc.bold(pc.green('\n  ✓ Dry-run terminé — aucun fichier écrit\n')))
  }
}

