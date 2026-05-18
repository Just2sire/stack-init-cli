import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { Model, ProjectConfig, NamedField } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { modelToTableName, modelToVarName, pluralize, pascalCase, kebabCase } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'

const TEMPLATES_DIR = resolveTemplatesDir('nest')

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class NestGenerator {
  private hbs: typeof Handlebars
  private cache = new Map<string, HandlebarsTemplateDelegate>()

  constructor() {
    this.hbs = configureHandlebars()
  }

  async generate(config: ProjectConfig, projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    
    if (!config.nestjs) {
      result.warnings.push('NestJS configuration is missing.')
      return result
    }

    // Generate modules for each model
    for (const model of config.models) {
      const modelResult = this.generateModelModule(model, config)
      result.files.push(...modelResult.files)
      result.warnings.push(...modelResult.warnings)
    }

    // Smart injection for AppModule
    const appModulePath = path.join(projectRoot, 'src/app.module.ts')
    if (fs.existsSync(appModulePath)) {
      let content = fs.readFileSync(appModulePath, 'utf-8')
      for (const model of config.models) {
        const moduleName = `${pascalCase(model.name)}Module`
        const importLine = `import { ${moduleName} } from './modules/${kebabCase(model.name)}/${kebabCase(model.name)}.module';`

        if (!content.includes(importLine)) {
          const lines = content.split('\n')
          const lastImportIndex = lines.reduce((last, line, idx) => line.startsWith('import') ? idx : last, -1)
          lines.splice(lastImportIndex + 1, 0, importLine)
          content = lines.join('\n')
        }

        // Check if module is in the imports array (basic check)
        const inImportsArray = new RegExp(`imports:\\s*\\[[^\\]]*${moduleName}`).test(content)
        
        if (!inImportsArray) {
          // Try to insert in the imports array of @Module
          const importsRegex = /imports:\s*\[/
          if (importsRegex.test(content)) {
            content = content.replace(importsRegex, `imports: [\n    ${moduleName},`)
          }
        }
      }
      result.files.push({ outputPath: 'src/app.module.ts', content })
    } else {
      // Create a basic app.module.ts if missing
      const ctx = {
        modules: config.models.map(m => ({
          name: `${pascalCase(m.name)}Module`,
          path: `./modules/${kebabCase(m.name)}/${kebabCase(m.name)}.module`
        }))
      }
      let content = ctx.modules.map(m => `import { ${m.name} } from '${m.path}';`).join('\n')
      content += `\nimport { Module } from '@nestjs/common';\n\n@Module({\n  imports: [\n`
      ctx.modules.forEach(m => { content += `    ${m.name},\n` })
      content += `  ],\n})\nexport class AppModule {}\n`
      
      result.files.push({ outputPath: 'src/app.module.ts', content })
    }

    return result
  }

  private generateModelModule(model: Model, config: ProjectConfig): GeneratorResult {
    const files: GeneratedFile[] = []
    const warnings: string[] = []
    const ctx = this.buildContext(model, config)
    const gen = model.generate
    const entityDir = `src/modules/${ctx.kebabName}`
    const kn = ctx.kebabName as string

    // Module — always (NestJS DI requires it)
    files.push({
      outputPath: `${entityDir}/${kn}.module.ts`,
      content: this.render('overlays/module/module.ts.hbs', ctx),
    })

    // Entity — always (it's the data model)
    files.push({
      outputPath: `${entityDir}/entities/${kn}.entity.ts`,
      content: this.render('overlays/entity/entity.ts.hbs', ctx),
    })

    if (gen.controller) {
      files.push({
        outputPath: `${entityDir}/${kn}.controller.ts`,
        content: this.render('overlays/controller/controller.ts.hbs', ctx),
      })
    }

    if (gen.service) {
      files.push({
        outputPath: `${entityDir}/${kn}.service.ts`,
        content: this.render('overlays/service/service.ts.hbs', ctx),
      })
    }

    // DTOs use the `resource` flag (closest analog to NestJS DTOs in the wizard)
    if (gen.resource !== false) {
      files.push({
        outputPath: `${entityDir}/dto/create-${kn}.dto.ts`,
        content: this.render('overlays/dto/create.dto.ts.hbs', ctx),
      })
      files.push({
        outputPath: `${entityDir}/dto/update-${kn}.dto.ts`,
        content: this.render('overlays/dto/update.dto.ts.hbs', ctx),
      })
    }

    // CQRS stubs
    if (config.nestjs?.architecture === 'cqrs') {
      files.push({ outputPath: `${entityDir}/commands/.gitkeep`, content: '' })
      files.push({ outputPath: `${entityDir}/queries/.gitkeep`, content: '' })
      warnings.push(`${model.name}: CQRS architecture selected — commands/ and queries/ are stubbed. Move business logic from the service into dedicated command/query handlers.`)
    }

    // Tests
    if (gen.tests) {
      files.push({
        outputPath: `${entityDir}/${kn}.controller.spec.ts`,
        content: this.generateInlineTest(ctx),
      })
    }

    return { files, warnings }
  }

  private generateInlineTest(ctx: Record<string, unknown>): string {
    const name = ctx.pascalName as string
    const kn   = ctx.kebabName  as string
    return `import { Test, TestingModule } from '@nestjs/testing';
import { ${name}Controller } from './${kn}.controller';
import { ${name}Service } from './${kn}.service';

describe('${name}Controller', () => {
  let controller: ${name}Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [${name}Controller],
      providers: [
        { provide: ${name}Service, useValue: { findAll: jest.fn(), findOne: jest.fn(), create: jest.fn(), update: jest.fn(), remove: jest.fn() } },
      ],
    }).compile();

    controller = module.get<${name}Controller>(${name}Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
`
  }

  private buildContext(model: Model, config: ProjectConfig): Record<string, unknown> {
    return {
      name: model.name,
      pascalName: pascalCase(model.name),
      camelName: modelToVarName(model.name),
      pluralName: pluralize(model.name),
      kebabName: kebabCase(model.name),
      tableName: model.table || modelToTableName(model.name),
      fields: model.fields.map(f => ({
        ...f,
        tsType: this.mapFieldToTS(f)
      })),
      relations: model.relations,
      nestConfig: config.nestjs
    }
  }

  private mapFieldToTS(field: NamedField): string {
    switch (field.type) {
      case 'id':
      case 'tinyInteger':
      case 'smallInteger':
      case 'mediumInteger':
      case 'integer':
      case 'unsignedTinyInteger':
      case 'unsignedSmallInteger':
      case 'unsignedInteger':
      case 'bigInteger':
      case 'unsignedBigInteger':
      case 'float':
      case 'double':
      case 'decimal':
        return 'number'
      case 'boolean':
        return 'boolean'
      case 'date':
      case 'dateTime':
      case 'dateTimeTz':
      case 'timestamp':
      case 'timestampTz':
        return 'Date'
      case 'json':
      case 'jsonb':
        return 'any'
      default:
        return 'string'
    }
  }

  private render(tpl: string, ctx: Record<string, unknown>): string {
    if (!this.cache.has(tpl)) {
      const fullPath = path.join(TEMPLATES_DIR, tpl)
      if (!fs.existsSync(fullPath)) {
        return `// Template not found: ${tpl}`
      }
      const src = fs.readFileSync(fullPath, 'utf-8')
      this.cache.set(tpl, this.hbs.compile(src))
    }
    return this.cache.get(tpl)!(ctx)
  }
}
