import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { Model, ProjectConfig, NamedField } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { modelToTableName, modelToRouteName, modelToVarName, pluralize, pascalCase } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'

const TEMPLATES_DIR = resolveTemplatesDir('express')

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class ExpressGenerator {
  private hbs: typeof Handlebars
  private cache = new Map<string, HandlebarsTemplateDelegate>()

  constructor() {
    this.hbs = configureHandlebars()
  }

  async generate(config: ProjectConfig, projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    
    if (!config.express) {
      result.warnings.push('Express configuration is missing.')
      return result
    }

    const orm = config.express.orm ?? 'none'

    // Generate Prisma Schema
    if (orm === 'prisma') {
      result.files.push(this.generatePrismaSchema(config))
    }

    // Unsupported ORM warnings
    if (orm === 'sequelize' || orm === 'typeorm') {
      result.warnings.push(`ORM "${orm}" is not yet fully scaffolded — repository stubs generated. Wire your models manually.`)
    }
    if (orm === 'knex') {
      result.warnings.push('ORM "knex" is not yet scaffolded — no database integration files generated. Configure knex manually.')
    }

    // Generate layers for each model
    for (const model of config.models) {
      const modelResult = this.generateModelLayers(model, config)
      result.files.push(...modelResult.files)
      result.warnings.push(...modelResult.warnings)

      // Mongoose model file
      if (orm === 'mongoose') {
        const ctx = this.buildContext(model, config)
        result.files.push({
          outputPath: `src/models/${model.name.toLowerCase()}.model.ts`,
          content: this.render('overlays/mongoose/model.ts.hbs', ctx)
        })
      }
    }

    // Smart injection for routes
    const routesPath = path.join(projectRoot, 'src/routes/index.ts')
    const modelsWithRoutes = config.models.filter(m => m.generate.routes)

    if (modelsWithRoutes.length > 0) {
      if (fs.existsSync(routesPath)) {
        let content = fs.readFileSync(routesPath, 'utf-8')
        for (const model of modelsWithRoutes) {
          const importName = `${modelToVarName(model.name)}Routes`
          const importLine = `import ${importName} from './${model.name.toLowerCase()}.routes';`
          const useLine    = `router.use('/${modelToRouteName(model.name)}', ${importName});`

          if (!content.includes(importLine)) {
            // Insert after the last import or after 'import { Router }'
            const lines = content.split('\n')
            const lastImportIndex = lines.reduce((last, line, idx) => line.startsWith('import') ? idx : last, -1)
            lines.splice(lastImportIndex + 1, 0, importLine)
            content = lines.join('\n')
          }

          if (!content.includes(useLine)) {
            // Insert before 'export default' or at the end
            if (content.includes('export default')) {
              content = content.replace('export default', `${useLine}\n\nexport default`)
            } else {
              content += `\n${useLine}`
            }
          }
        }
        result.files.push({ outputPath: 'src/routes/index.ts', content })
      } else {
        const routeCtx = {
          models: modelsWithRoutes.map(m => ({
            name: m.name,
            varName: `${modelToVarName(m.name)}Routes`,
            routeName: modelToRouteName(m.name),
            fileName: m.name.toLowerCase()
          }))
        }
        // Simplified inline template for index.ts if it doesn't exist
        let content = `import { Router } from 'express';\n`
        routeCtx.models.forEach(m => {
          content += `import ${m.varName} from './${m.fileName}.routes';\n`
        })
        content += `\nconst router = Router();\n\n`
        routeCtx.models.forEach(m => {
          content += `router.use('/${m.routeName}', ${m.varName});\n`
        })
        content += `\nexport default router;\n`
        
        result.files.push({ outputPath: 'src/routes/index.ts', content })
      }
    }

    return result
  }

  private generatePrismaSchema(config: ProjectConfig): GeneratedFile {
    const ctx = {
      provider: config.express?.db_engine === 'mongodb' ? 'mongodb' : (config.express?.db_engine || 'postgresql'),
      models: config.models.map(m => ({
        name: pascalCase(m.name),
        tableName: m.table || modelToTableName(m.name),
        fields: m.fields.map(f => this.mapFieldToPrisma(f, m, config.models)),
        relations: m.relations
      }))
    }

    return {
      outputPath: 'prisma/schema.prisma',
      content: this.render('overlays/prisma/schema.prisma.hbs', ctx)
    }
  }

  private mapFieldToPrisma(field: NamedField, _model: Model, _allModels: Model[]) {
    let type = 'String'
    let attributes = ''

    switch (field.type) {
      case 'id':
        type = 'Int'
        attributes = '@id @default(autoincrement())'
        break
      case 'uuid':
        type = 'String'
        attributes = '@id @default(uuid())'
        break
      case 'ulid':
        type = 'String'
        attributes = '@id @default(cuid())'
        break
      case 'string':
      case 'char':
      case 'tinyText':
      case 'text':
      case 'mediumText':
      case 'longText':
        type = 'String'
        break
      case 'tinyInteger':
      case 'smallInteger':
      case 'mediumInteger':
      case 'integer':
      case 'unsignedTinyInteger':
      case 'unsignedSmallInteger':
      case 'unsignedInteger':
        type = 'Int'
        break
      case 'bigInteger':
      case 'unsignedBigInteger':
        type = 'BigInt'
        break
      case 'float':
      case 'double':
        type = 'Float'
        break
      case 'boolean':
        type = 'Boolean'
        break
      case 'date':
      case 'dateTime':
      case 'dateTimeTz':
      case 'timestamp':
      case 'timestampTz':
        type = 'DateTime'
        break
      case 'decimal':
        type = 'Decimal'
        break
      case 'json':
      case 'jsonb':
        type = 'Json'
        break
      case 'foreignId':
      case 'foreignUuid':
      case 'foreignUlid':
        type = field.type === 'foreignId' ? 'Int' : 'String'
        break
    }

    if ('unique' in field && field.unique) attributes += ' @unique'
    if ('nullable' in field && field.nullable) type += '?'

    return {
      name: field.name,
      type,
      attributes: attributes.trim()
    }
  }

  private generateModelLayers(model: Model, config: ProjectConfig): GeneratorResult {
    const files: GeneratedFile[] = []
    const warnings: string[] = []
    const ctx = this.buildContext(model, config)
    const gen = model.generate
    const baseDir = 'src'
    const mLow = model.name.toLowerCase()

    if (gen.repository) {
      files.push({
        outputPath: `${baseDir}/repositories/${mLow}.repository.ts`,
        content: this.render('overlays/repository/repository.ts.hbs', ctx),
      })
    }

    if (gen.service) {
      files.push({
        outputPath: `${baseDir}/services/${mLow}.service.ts`,
        content: this.render('overlays/service/service.ts.hbs', ctx),
      })
    }

    if (gen.controller) {
      files.push({
        outputPath: `${baseDir}/controllers/${mLow}.controller.ts`,
        content: this.render('overlays/controller/controller.ts.hbs', ctx),
      })
    }

    if (gen.routes) {
      files.push({
        outputPath: `${baseDir}/routes/${mLow}.routes.ts`,
        content: this.render('overlays/routes/routes.ts.hbs', ctx),
      })
    }

    if (config.express?.validation === 'zod' && gen.request) {
      files.push({
        outputPath: `${baseDir}/validation/${mLow}.schema.ts`,
        content: this.render('overlays/validation/validation.ts.hbs', ctx),
      })
    }

    return { files, warnings }
  }

  private buildContext(model: Model, config: ProjectConfig): Record<string, unknown> {
    const enrichedRelations = model.relations.map(rel => {
      if (rel.type === 'belongsTo' && !rel.foreign_key) {
        const targetModel = config.models.find(m => m.name === rel.model)
        const targetTable = targetModel?.table ?? modelToTableName(rel.model)
        const fkField = model.fields.find(f =>
          (f.type === 'foreignId' || f.type === 'foreignUuid' || f.type === 'foreignUlid') &&
          (f as any).references === targetTable
        )
        return { ...rel, foreign_key: fkField?.name ?? `${rel.model.toLowerCase()}_id` }
      }
      return rel
    })

    const pkField = model.fields.find(f => f.type === 'id' || f.type === 'uuid' || f.type === 'ulid')
    const pkExtraction = pkField
      ? (pkField.type === 'id' ? 'Number(req.params.id)' : 'req.params.id')
      : 'req.params.id'

    return {
      name: model.name,
      pascalName: pascalCase(model.name),
      camelName: modelToVarName(model.name),
      pluralName: pluralize(model.name),
      tableName: model.table ?? modelToTableName(model.name),
      fields: model.fields,
      relations: enrichedRelations,
      expressConfig: config.express,
      pkExtraction,
    }
  }

  private render(tpl: string, ctx: Record<string, unknown>): string {
    if (!this.cache.has(tpl)) {
      const fullPath = path.join(TEMPLATES_DIR, tpl)
      if (!fs.existsSync(fullPath)) {
        // Fallback for missing templates during development
        return `// Template not found: ${tpl}`
      }
      const src = fs.readFileSync(fullPath, 'utf-8')
      this.cache.set(tpl, this.hbs.compile(src))
    }
    return this.cache.get(tpl)!(ctx)
  }
}
