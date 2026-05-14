import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { Model, ProjectConfig } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { fieldToCast, fieldToValidationRule, fieldToFaker } from '../../utils/field-helpers'
import { modelToTableName, modelToRouteName, modelToVarName, migrationTimestamp, pluralize } from '../../utils/naming'

const TEMPLATES_DIR = path.resolve(__dirname, '../../../templates/laravel')

export interface GeneratedFile {
  outputPath: string
  content: string
}
export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class LaravelGenerator {
  private hbs: typeof Handlebars
  private cache = new Map<string, HandlebarsTemplateDelegate>()

  constructor() { this.hbs = configureHandlebars() }

  async generate(config: ProjectConfig): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    for (let i = 0; i < config.models.length; i++) {
      const r = await this.generateModel(config.models[i], config, i)
      result.files.push(...r.files)
      result.warnings.push(...r.warnings)
    }

    // Routes
    const modelsWithRoutes = config.models.filter(m => m.generate.routes)
    if (modelsWithRoutes.length > 0) {
      const routeCtx = {
        models: config.models.map(m => ({
          name: m.name,
          routeName: modelToRouteName(m.name),
          generate: m.generate,
        })),
      }
      result.files.push({
        outputPath: 'routes/api.php',
        content: this.render('overlays/routes/api.php.hbs', routeCtx),
      })
    }

    return result
  }

  private async generateModel(model: Model, config: ProjectConfig, index: number): Promise<GeneratorResult> {
    const files: GeneratedFile[] = []
    const warnings: string[]     = []
    const ctx = this.buildContext(model, config)

    // Model — toujours
    files.push({ outputPath: `app/Models/${model.name}.php`, content: this.render('base/Model.php.hbs', ctx) })

    // Migration
    if (model.generate.migration) {
      files.push({
        outputPath: `database/migrations/${migrationTimestamp(index)}_create_${ctx.tableName}_table.php`,
        content: this.render('overlays/migration/migration.php.hbs', ctx),
      })
    }

    // Controller — toujours
    if (model.generate.controller) {
      files.push({ outputPath: `app/Http/Controllers/Api/${model.name}Controller.php`, content: this.render('base/Controller.php.hbs', ctx) })
    }

    // Resource
    if (model.generate.resource) {
      files.push({ outputPath: `app/Http/Resources/${model.name}Resource.php`, content: this.render('overlays/resource/Resource.php.hbs', ctx) })
    }

    // Requests
    if (model.generate.request) {
      files.push({ outputPath: `app/Http/Requests/Store${model.name}Request.php`,  content: this.render('overlays/request/StoreRequest.php.hbs', ctx) })
      files.push({ outputPath: `app/Http/Requests/Update${model.name}Request.php`, content: this.render('overlays/request/UpdateRequest.php.hbs', ctx) })
    }

    // Policy
    if (model.generate.policy) {
      files.push({ outputPath: `app/Policies/${model.name}Policy.php`, content: this.render('overlays/policy/Policy.php.hbs', ctx) })
    }

    // Factory
    if (model.generate.factory) {
      files.push({ outputPath: `database/factories/${model.name}Factory.php`, content: this.render('overlays/factory/Factory.php.hbs', ctx) })
    }

    // Repository
    if (model.generate.repository) {
      files.push({ outputPath: `app/Repositories/${model.name}Repository.php`, content: this.render('overlays/repository/Repository.php.hbs', ctx) })
    }

    // Seeder
    if (model.generate.seeder) {
      files.push({ outputPath: `database/seeders/${model.name}Seeder.php`, content: this.render('overlays/seeder/Seeder.php.hbs', ctx) })
    }

    // Service
    if (model.generate.service) {
      files.push({ outputPath: `app/Services/${model.name}Service.php`, content: this.render('overlays/service/Service.php.hbs', ctx) })
    }

    // Tests
    if (model.generate.tests) {
      if (!model.generate.factory) warnings.push(`[${model.name}] Tests générés mais Factory désactivée.`)
      files.push({ outputPath: `tests/Feature/${model.name}Test.php`, content: this.render('overlays/tests/Test.php.hbs', ctx) })
    }

    return { files, warnings }
  }

  private buildContext(model: Model, config: ProjectConfig): Record<string, unknown> {
    const tableName  = model.table ?? modelToTableName(model.name)
    const varName    = modelToVarName(model.name)
    const routeName  = modelToRouteName(model.name)
    const namePlural = pluralize(model.name)
    const primaryKey = model.migration.primary_key ?? 'id'

    const fillable = model.fields
      .filter(f => !['id', 'rememberToken', 'morphs', 'uuidMorphs'].includes(f.type))
      .map(f => f.name)

    const casts: Record<string, string> = {}
    for (const field of model.fields) {
      const cast = fieldToCast(field)
      if (cast) casts[field.name] = cast
    }

    const hiddenFields = model.fields
      .filter(f => ['password', 'remember_token', 'token', 'secret'].includes(f.name))
      .map(f => f.name)

    const imports: string[] = []
    if (model.generate.softDelete) imports.push('Illuminate\\Database\\Eloquent\\SoftDeletes')

    const resourceFields = model.fields.filter(
      f => !['foreignId', 'foreignUuid', 'foreignUlid', 'morphs', 'uuidMorphs', 'id', 'rememberToken'].includes(f.type)
    )

    const validationRules = model.fields
      .filter(f => !['id', 'rememberToken'].includes(f.type))
      .map(field => {
        const rules = fieldToValidationRule(field, tableName).join("', '")
        return {
          name:        field.name,
          rules:       `['${rules}']`,
          rulesUpdate: `['sometimes', '${rules}']`,
        }
      })

    const fakerFields = model.fields
      .filter(f => !['id', 'rememberToken'].includes(f.type))
      .map(field => ({ name: field.name, faker: fieldToFaker(field) }))

    const hasUserRelation = model.relations.some(r => r.model === 'User') ||
      model.fields.some(f => f.name === 'user_id')

    return {
      name: model.name, namePlural, tableName, varName, routeName,
      primaryKey, customTable: model.table,
      migration: model.migration, generate: model.generate,
      fields: model.fields, fillable,
      casts:          Object.keys(casts).length > 0 ? casts : null,
      hiddenFields:   hiddenFields.length > 0 ? hiddenFields : null,
      imports, relations: model.relations,
      resourceFields, validationRules, fakerFields,
      hasUserRelation, laravelOptions: config.laravel,
    }
  }

  private render(tpl: string, ctx: Record<string, unknown>): string {
    if (!this.cache.has(tpl)) {
      const src = fs.readFileSync(path.join(TEMPLATES_DIR, tpl), 'utf-8')
      this.cache.set(tpl, this.hbs.compile(src))
    }
    return this.cache.get(tpl)!(ctx)
  }
}

export async function writeFiles(files: GeneratedFile[], root: string, dryRun = false): Promise<void> {
  for (const file of files) {
    const full = path.join(root, file.outputPath)
    if (!dryRun) {
      fs.mkdirSync(path.dirname(full), { recursive: true })
      fs.writeFileSync(full, file.content, 'utf-8')
    }
  }
}
