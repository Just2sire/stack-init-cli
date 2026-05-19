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
    const auth = config.express.auth ?? 'none'

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

    // Auth service generation
    if (auth !== 'none') {
      const hasUserModel = config.models.some(m => m.name.toLowerCase() === 'user')
      if (!hasUserModel) {
        result.warnings.push('Auth is enabled but no "User" model found. The auth service references a User model — add one or adjust auth.service.ts manually.')
      }
      result.files.push(...this.generateAuthFiles(config))
    }

    // .env.example
    result.files.push(this.generateEnvExample(config))

    // Smart injection for routes
    const routesPath = path.join(projectRoot, 'src/routes/index.ts')
    const modelsWithRoutes = config.models.filter(m => m.generate.routes)
    const includeAuthRoute = auth !== 'none'

    if (modelsWithRoutes.length > 0 || includeAuthRoute) {
      if (fs.existsSync(routesPath)) {
        let content = fs.readFileSync(routesPath, 'utf-8')

        for (const model of modelsWithRoutes) {
          const importName = `${modelToVarName(model.name)}Routes`
          const importLine = `import ${importName} from './${model.name.toLowerCase()}.routes';`
          const useLine    = `router.use('/${modelToRouteName(model.name)}', ${importName});`

          if (!content.includes(importLine)) {
            const lines = content.split('\n')
            const lastImportIndex = lines.reduce((last, line, idx) => line.startsWith('import') ? idx : last, -1)
            lines.splice(lastImportIndex + 1, 0, importLine)
            content = lines.join('\n')
          }

          if (!content.includes(useLine)) {
            if (content.includes('export default')) {
              content = content.replace('export default', `${useLine}\n\nexport default`)
            } else {
              content += `\n${useLine}`
            }
          }
        }

        if (includeAuthRoute) {
          const authImport = `import authRoutes from './auth.routes';`
          const authUse    = `router.use('/auth', authRoutes);`
          if (!content.includes(authImport)) {
            const lines = content.split('\n')
            const lastImportIndex = lines.reduce((last, line, idx) => line.startsWith('import') ? idx : last, -1)
            lines.splice(lastImportIndex + 1, 0, authImport)
            content = lines.join('\n')
          }
          if (!content.includes(authUse)) {
            content = content.includes('export default')
              ? content.replace('export default', `${authUse}\n\nexport default`)
              : content + `\n${authUse}`
          }
        }

        result.files.push({ outputPath: 'src/routes/index.ts', content })
      } else {
        const allModels = modelsWithRoutes.map(m => ({
          varName: `${modelToVarName(m.name)}Routes`,
          routeName: modelToRouteName(m.name),
          fileName: m.name.toLowerCase()
        }))

        let content = `import { Router } from 'express';\n`
        allModels.forEach(m => { content += `import ${m.varName} from './${m.fileName}.routes';\n` })
        if (includeAuthRoute) content += `import authRoutes from './auth.routes';\n`
        content += `\nconst router = Router();\n\n`
        allModels.forEach(m => { content += `router.use('/${m.routeName}', ${m.varName});\n` })
        if (includeAuthRoute) content += `router.use('/auth', authRoutes);\n`
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
        return `// Template not found: ${tpl}`
      }
      const src = fs.readFileSync(fullPath, 'utf-8')
      this.cache.set(tpl, this.hbs.compile(src))
    }
    return this.cache.get(tpl)!(ctx)
  }

  // ── Auth generation ───────────────────────────────────────────────

  private generateEnvExample(config: ProjectConfig): GeneratedFile {
    const orm    = config.express?.orm ?? 'none'
    const auth   = config.express?.auth ?? 'none'
    const db     = config.express?.db_engine ?? 'postgresql'
    const port   = config.express?.port ?? 3000
    const name   = config.name

    let dbLine = ''
    if (orm === 'mongoose') {
      dbLine = `MONGODB_URI="mongodb://localhost:27017/${name}"`
    } else if (['prisma', 'sequelize', 'typeorm', 'knex'].includes(orm)) {
      if (db === 'postgresql') dbLine = `DATABASE_URL="postgresql://user:password@localhost:5432/${name}"`
      else if (db === 'mysql')  dbLine = `DATABASE_URL="mysql://user:password@localhost:3306/${name}"`
      else if (db === 'sqlite') dbLine = `DATABASE_URL="file:./dev.db"`
      else if (db === 'mongodb') dbLine = `DATABASE_URL="mongodb://localhost:27017/${name}"`
    }

    const lines = [
      `NODE_ENV=development`,
      `PORT=${port}`,
      dbLine,
      ...(auth !== 'none' ? [
        `JWT_SECRET="change-me-in-production"`,
        `JWT_EXPIRES_IN="7d"`,
      ] : []),
    ].filter(Boolean)

    return { outputPath: '.env.example', content: lines.join('\n') + '\n' }
  }

  private generateAuthFiles(config: ProjectConfig): GeneratedFile[] {
    const orm  = config.express?.orm ?? 'prisma'
    return [
      { outputPath: 'src/services/auth.service.ts',    content: this.authService(orm) },
      { outputPath: 'src/controllers/auth.controller.ts', content: this.authController() },
      { outputPath: 'src/middleware/auth.middleware.ts',  content: this.authMiddleware() },
      { outputPath: 'src/routes/auth.routes.ts',          content: this.authRoutes() },
    ]
  }

  private authService(orm: string): string {
    const userAccess = orm === 'mongoose'
      ? `import { User } from '../models/user.model';`
      : `import { PrismaClient } from '@prisma/client';\nconst prisma = new PrismaClient();`

    const findByEmail = orm === 'mongoose'
      ? `const user = await User.findOne({ email });`
      : `const user = await prisma.user.findUnique({ where: { email } });`

    const checkDuplicate = orm === 'mongoose'
      ? `const existing = await User.findOne({ email: data.email });`
      : `const existing = await prisma.user.findUnique({ where: { email: data.email } });`

    const createUser = orm === 'mongoose'
      ? `const user = await User.create({ ...data, password: hashed });
    return { id: user._id, name: user.name, email: user.email };`
      : `const user = await prisma.user.create({
      data: { ...data, password: hashed },
      select: { id: true, name: true, email: true },
    });
    return user;`

    const findById = orm === 'mongoose'
      ? `return User.findById(id).select('-password');`
      : `return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true } });`

    const returnLogin = orm === 'mongoose'
      ? `{ id: user._id, name: user.name, email: user.email }`
      : `{ id: user.id, name: user.name, email: user.email }`

    return `import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
${userAccess}

export interface RegisterDto { name: string; email: string; password: string; }
export interface LoginDto    { email: string; password: string; }

export class AuthService {
  async register(data: RegisterDto) {
    ${checkDuplicate}
    if (existing) throw new Error('Email already in use');
    const hashed = await bcrypt.hash(data.password, 10);
    ${createUser}
  }

  async login(data: LoginDto) {
    ${findByEmail}
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(data.password, user.password as string);
    if (!valid) throw new Error('Invalid credentials');
    const token = jwt.sign({ id: ${orm === 'mongoose' ? 'user._id' : 'user.id'} }, process.env.JWT_SECRET as string, {
      expiresIn: (process.env.JWT_EXPIRES_IN ?? '7d') as string,
    });
    return { token, user: ${returnLogin} };
  }

  async getById(id: any) {
    ${findById}
  }
}
`
  }

  private authController(): string {
    return `import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

const authService = new AuthService();

export const register = async (req: Request, res: Response) => {
  try {
    const user = await authService.register(req.body);
    res.status(201).json({ message: 'Account created', user });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    res.json(result);
  } catch (error: any) {
    res.status(401).json({ error: error.message });
  }
};

export const me = async (req: Request & { user?: any }, res: Response) => {
  try {
    const user = await authService.getById(req.user?.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
`
  }

  private authMiddleware(): string {
    return `import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: { id: any };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid Authorization header' });
  }
  const token = header.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET as string) as { id: any };
    req.user = { id: payload.id };
    next();
  } catch {
    res.status(401).json({ error: 'Token invalid or expired' });
  }
};
`
  }

  private authRoutes(): string {
    return `import { Router } from 'express';
import { register, login, me } from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.post('/register', register);
router.post('/login',    login);
router.get('/me',        authenticate, me);

export default router;
`
  }
}
