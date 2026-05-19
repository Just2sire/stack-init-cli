import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import pc from 'picocolors'
import { parseProjectConfig, isMixedStack } from '@stack-init/schema'
import type { ProjectConfig } from '@stack-init/schema'
import { resolveConfigPath } from '../utils/config'
import { LaravelGenerator } from '../generators/laravel/index'
import { ExpressGenerator } from '../generators/express/index'
import { NestGenerator } from '../generators/nest/index'
import { FastAPIGenerator } from '../generators/fastapi/index'
import { ZipGenerator } from '../generators/zip/index'
import { NextJSGenerator } from '../generators/nextjs/index'
import { writeFiles, type GeneratedFile } from '../utils/fs'
import { generateMakefile, generateBashRunner } from '../generators/runner/makefile'

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
    console.error(pc.red('\n  ✗ Erreurs dans stack-init.yaml :'))
    parsed.errors.forEach(e => console.error(pc.red(`    ${e}`)))
    console.error()
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
  if ((stackStr === 'mevn' || stackStr === 'mean') && !process.env.STACK_INIT_ALLOW_UNSUPPORTED) {
    console.error(pc.red(`\n  ✗ Stack "${config.stack}" is not yet supported by the CLI generator.\n`))
    console.error(pc.yellow(`  Supported stacks: laravel, express, nestjs, fastapi, and their combos with react/nextjs.\n`))
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
    const subfolder = isMixed ? 'backend' : '.'
    
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
        }
        if (['bash', 'both'].includes(runner)) {
          allGeneratedFiles.push({ outputPath: 'run.sh', content: generateBashRunner(config) })
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

  // -- React SPA (static ZIP template) --
  if (config.stack.includes('react') && !config.stack.includes('nextjs')) {
    console.log(pc.bold('  React'))
    const generator = new ZipGenerator()
    const result    = await generator.generate(config, projectRoot, 'react')
    const subfolder = isMixed ? 'frontend' : '.'

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
      makefileContent += `\tcd backend && composer install && cp .env.example .env && php artisan key:generate\n`
    } else if (config.stack.includes('express')) {
      makefileContent += `\tcd backend && npm install\n`
    }

    makefileContent += `\tcd frontend && npm install\n`
    makefileContent += `\t@echo "✅ Setup terminé. N'oublie pas de configurer ton .env dans backend/"\n\n`
    
    makefileContent += `dev:\n`
    makefileContent += `\t@echo "🏁 Démarrage des services..."\n`
    if (config.stack.includes('laravel')) {
      makefileContent += `\t(cd backend && php artisan serve) & (cd frontend && npm run dev)\n`
    } else {
      makefileContent += `\t(cd backend && npm run dev) & (cd frontend && npm run dev)\n`
    }

    makefileContent += `\nstop:\n`
    makefileContent += `\t@echo "🛑 Arrêt des services..."\n`
    makefileContent += `\tpkill -f "php artisan serve" || true\n`
    makefileContent += `\tpkill -f "npm run dev" || true\n`

    allGeneratedFiles.push({ outputPath: 'Makefile', content: makefileContent })
    console.log(`  ${pc.green('✓')} Makefile (global)`)

    // Docker Compose (Simple version)
    let dockerCompose = `version: '3.8'\n\nservices:\n`
    
    if (config.stack.includes('laravel')) {
      dockerCompose += `  backend:\n    build:\n      context: ./backend\n      dockerfile: Dockerfile\n    volumes:\n      - ./backend:/var/www/html\n    ports:\n      - "8000:8000"\n\n`
    } else {
      dockerCompose += `  backend:\n    build: ./backend\n    ports:\n      - "3000:3000"\n    volumes:\n      - ./backend:/app\n\n`
    }

    dockerCompose += `  frontend:\n    build: ./frontend\n    ports:\n      - "5173:5173"\n    volumes:\n      - ./frontend:/app\n`

    allGeneratedFiles.push({ outputPath: 'docker-compose.yml', content: dockerCompose })
    console.log(`  ${pc.green('✓')} docker-compose.yml`)
  }


  // 5. Écriture des fichiers
  await writeFiles(allGeneratedFiles, projectRoot, opts.dryRun)
  manifestFiles.push(...allGeneratedFiles.map(f => f.outputPath))

  // 6. Manifeste
  if (!opts.dryRun) {
    const manifest = {
      lastGeneration: new Date().toISOString(),
      files: Array.from(new Set(manifestFiles))
    }
    fs.writeFileSync(path.join(projectRoot, '.stack-init-manifest.json'), JSON.stringify(manifest, null, 2))
  }

  console.log(pc.bold(pc.green('\n  ✓ Génération terminée\n')))
  if (!opts.dryRun) {
    console.log(`  Projet généré dans : ${pc.cyan(opts.output)}`)
    console.log(`  Lance ${pc.cyan('make setup')} pour commencer\n`)
  }
}

