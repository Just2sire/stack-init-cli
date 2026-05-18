import fs from 'node:fs'
import path from 'node:path'
import yaml from 'js-yaml'
import pc from 'picocolors'
import { parseProjectConfig, ModelSchema } from '@stack-init/schema'
import type { ProjectConfig, Model } from '@stack-init/schema'
import { LaravelGenerator } from '../generators/laravel/index'
import { ExpressGenerator } from '../generators/express/index'
import { NestGenerator } from '../generators/nest/index'
import { writeFiles } from '../utils/fs'

export interface AddOptions {
  modelName: string
  fields?: string
  config: string
  output: string
  dryRun: boolean
}

export async function runAdd(opts: AddOptions): Promise<void> {
  const configPath = path.resolve(opts.config)
  if (!fs.existsSync(configPath)) {
    console.error(pc.red(`\n  ✗ Fichier introuvable : ${configPath}\n`))
    process.exit(1)
  }

  const raw = yaml.load(fs.readFileSync(configPath, 'utf-8')) as any
  const parsed = parseProjectConfig(raw)
  if (!parsed.success) {
    console.error(pc.red('\n  ✗ Erreurs dans le fichier de configuration existant :'))
    parsed.errors.forEach(e => console.error(pc.red(`    ${e}`)))
    process.exit(1)
  }

  const config: ProjectConfig = parsed.data
  const projectRoot = path.resolve(opts.output)

  // Vérifier si le modèle existe déjà
  if (config.models.find(m => m.name === opts.modelName)) {
    console.error(pc.red(`\n  ✗ Le modèle "${opts.modelName}" existe déjà dans la configuration.\n`))
    process.exit(1)
  }

  let newModel: Model

  if (opts.fields) {
    const fields = opts.fields.split(',').map(f => {
      const [name, type, ...rest] = f.split(':')
      const field: any = { name, type: type || 'string' }
      if (rest.includes('nullable')) field.nullable = true
      if (rest.includes('unique'))   field.unique = true
      // Support basique foreignId:table
      if (field.type === 'foreignId' && rest[0]) field.references = rest[0]
      return field
    })

    newModel = {
      name: opts.modelName,
      fields,
      relations: [],
      migration: { primary_key: 'id', timestamps: true },
      generate: {
        migration: true, controller: true, resource: true, request: true,
        factory: true, tests: true, routes: true, seeder: true,
        policy: false, swagger: false, softDelete: false, repository: false, service: false,
        dto: true, module: true, schema: true
      }
    } as any

    // Validation du nouveau modèle
    const modelResult = ModelSchema.safeParse(newModel)
    if (!modelResult.success) {
      console.error(pc.red(`\n  ✗ Erreur de définition du modèle :`))
      modelResult.error.issues.forEach(i => console.error(pc.red(`    [${i.path.join('.')}] ${i.message}`)))
      process.exit(1)
    }
    newModel = modelResult.data

    // Ajouter au YAML
    if (!opts.dryRun) {
      raw.models.push(newModel)
      fs.writeFileSync(configPath, yaml.dump(raw), 'utf-8')
      console.log(pc.green(`  ✓ Modèle "${opts.modelName}" ajouté à ${opts.config}`))
    }
  } else {
    console.error(pc.red(`\n  ✗ L'option --fields est requise (ex: --fields "title:string,body:text").\n`))
    process.exit(1)
  }

  // Génération
  const generatedFiles: string[] = []

  if (config.stack.includes('laravel')) {
    const generator = new LaravelGenerator()
    // On crée une config temporaire avec juste le nouveau modèle pour ne pas tout regénérer
    const tempConfig: ProjectConfig = { ...config, models: [newModel] }
    const result = await generator.generate(tempConfig, projectRoot)

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    await writeFiles(result.files, projectRoot, opts.dryRun)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
    generatedFiles.push(...result.files.map(f => f.outputPath))
  }

  if (config.stack.includes('express')) {
    const generator = new ExpressGenerator()
    const tempConfig: ProjectConfig = { ...config, models: [newModel] }
    const result = await generator.generate(tempConfig, projectRoot)

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    await writeFiles(result.files, projectRoot, opts.dryRun)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
    generatedFiles.push(...result.files.map(f => f.outputPath))
  }

  if (config.stack.includes('nestjs')) {
    const generator = new NestGenerator()
    const tempConfig: ProjectConfig = { ...config, models: [newModel] }
    const result = await generator.generate(tempConfig, projectRoot)

    result.warnings.forEach(w => console.warn(pc.yellow(`  ⚠  ${w}`)))
    await writeFiles(result.files, projectRoot, opts.dryRun)
    result.files.forEach(f => console.log(`  ${pc.green('✓')} ${f.outputPath}`))
    generatedFiles.push(...result.files.map(f => f.outputPath))
  }
    
  // Mise à jour du manifeste
  if (!opts.dryRun && generatedFiles.length > 0) {
    const manifestPath = path.join(projectRoot, '.stack-init-manifest.json')
    let manifest = { lastGeneration: new Date().toISOString(), files: [] as string[] }
    if (fs.existsSync(manifestPath)) {
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'))
    }
    manifest.lastGeneration = new Date().toISOString()
    manifest.files = [...new Set([...manifest.files, ...generatedFiles])]
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
  }

  console.log(pc.bold(pc.green('\n  ✓ Modèle ajouté avec succès\n')))
}
