import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { Model, ProjectConfig, NamedField } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { modelToTableName, modelToVarName, pluralize, pascalCase, kebabCase } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'
import { sortModelsByDependency } from '../../utils/model-sort'

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

    const auth = config.nestjs.auth ?? 'none'

    const sortedModels = sortModelsByDependency(config.models)

    // Generate modules for each model
    for (const model of sortedModels) {
      const modelResult = this.generateModelModule(model, config)
      result.files.push(...modelResult.files)
      result.warnings.push(...modelResult.warnings)
    }

    // Auth module generation
    if (auth !== 'none') {
      const hasUserModel = config.models.some(m => m.name.toLowerCase() === 'user')
      if (!hasUserModel) {
        result.warnings.push('Auth is enabled but no "User" model found. The AuthService references a User entity — add one or adjust auth files manually.')
      }
      result.files.push(...this.generateAuthModule(config))
    }

    // .env.example
    result.files.push(this.generateEnvExample(config))

    // Smart injection for AppModule
    const appModulePath = path.join(projectRoot, 'src/app.module.ts')
    const allModuleNames = [
      ...sortedModels.map(m => ({ name: `${pascalCase(m.name)}Module`, path: `./modules/${kebabCase(m.name)}/${kebabCase(m.name)}.module` })),
      ...(auth !== 'none' ? [{ name: 'AuthModule', path: './modules/auth/auth.module' }] : []),
    ]

    if (fs.existsSync(appModulePath)) {
      let content = fs.readFileSync(appModulePath, 'utf-8')

      for (const mod of allModuleNames) {
        const importLine = `import { ${mod.name} } from '${mod.path}';`
        if (!content.includes(importLine)) {
          const lines = content.split('\n')
          const lastImportIndex = lines.reduce((last, line, idx) => line.startsWith('import') ? idx : last, -1)
          lines.splice(lastImportIndex + 1, 0, importLine)
          content = lines.join('\n')
        }
        const inImportsArray = new RegExp(`imports:\\s*\\[[^\\]]*${mod.name}`).test(content)
        if (!inImportsArray) {
          const importsRegex = /imports:\s*\[/
          if (importsRegex.test(content)) {
            content = content.replace(importsRegex, `imports: [\n    ${mod.name},`)
          }
        }
      }
      result.files.push({ outputPath: 'src/app.module.ts', content })
    } else {
      let content = allModuleNames.map(m => `import { ${m.name} } from '${m.path}';`).join('\n')
      content += `\nimport { Module } from '@nestjs/common';\n\n@Module({\n  imports: [\n`
      allModuleNames.forEach(m => { content += `    ${m.name},\n` })
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
      const isCqrs = config.nestjs?.architecture === 'cqrs'
      files.push({
        outputPath: `${entityDir}/${kn}.controller.ts`,
        content: isCqrs
          ? this.generateCqrsController(ctx, config)
          : this.render('overlays/controller/controller.ts.hbs', ctx),
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

    // CQRS commands + queries
    if (config.nestjs?.architecture === 'cqrs') {
      const name = ctx.pascalName as string
      const slug = kn

      // Commands
      files.push({ outputPath: `${entityDir}/commands/create-${slug}.command.ts`,  content: this.cqrsCreateCommand(name, slug) })
      files.push({ outputPath: `${entityDir}/commands/update-${slug}.command.ts`,  content: this.cqrsUpdateCommand(name, slug) })
      files.push({ outputPath: `${entityDir}/commands/delete-${slug}.command.ts`,  content: this.cqrsDeleteCommand(name) })
      // Command handlers
      files.push({ outputPath: `${entityDir}/commands/handlers/create-${slug}.handler.ts`, content: this.cqrsCreateHandler(name, slug) })
      files.push({ outputPath: `${entityDir}/commands/handlers/update-${slug}.handler.ts`, content: this.cqrsUpdateHandler(name, slug) })
      files.push({ outputPath: `${entityDir}/commands/handlers/delete-${slug}.handler.ts`, content: this.cqrsDeleteHandler(name, slug) })
      // Queries
      files.push({ outputPath: `${entityDir}/queries/get-all-${slug}.query.ts`,    content: this.cqrsGetAllQuery(name) })
      files.push({ outputPath: `${entityDir}/queries/get-one-${slug}.query.ts`,    content: this.cqrsGetOneQuery(name) })
      // Query handlers
      files.push({ outputPath: `${entityDir}/queries/handlers/get-all-${slug}.handler.ts`, content: this.cqrsGetAllHandler(name, slug) })
      files.push({ outputPath: `${entityDir}/queries/handlers/get-one-${slug}.handler.ts`, content: this.cqrsGetOneHandler(name, slug) })
      // Override module to register all handlers
      const moduleFile = files.find(f => f.outputPath === `${entityDir}/${kn}.module.ts`)
      if (moduleFile) moduleFile.content = this.generateCqrsModule(ctx, config)
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

  // ── CQRS file generators ─────────────────────────────────────────────────────

  private cqrsCreateCommand(name: string, slug: string): string {
    return `import { ICommand } from '@nestjs/cqrs';\nimport { Create${name}Dto } from '../dto/create-${slug}.dto';\nexport class Create${name}Command implements ICommand {\n  constructor(public readonly dto: Create${name}Dto) {}\n}\n`
  }
  private cqrsUpdateCommand(name: string, slug: string): string {
    return `import { ICommand } from '@nestjs/cqrs';\nimport { Update${name}Dto } from '../dto/update-${slug}.dto';\nexport class Update${name}Command implements ICommand {\n  constructor(public readonly id: number, public readonly dto: Update${name}Dto) {}\n}\n`
  }
  private cqrsDeleteCommand(name: string): string {
    return `import { ICommand } from '@nestjs/cqrs';\nexport class Delete${name}Command implements ICommand {\n  constructor(public readonly id: number) {}\n}\n`
  }
  private cqrsCreateHandler(name: string, slug: string): string {
    return `import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';\nimport { Create${name}Command } from '../create-${slug}.command';\nimport { ${name}Service } from '../../${slug}.service';\n\n@CommandHandler(Create${name}Command)\nexport class Create${name}Handler implements ICommandHandler<Create${name}Command> {\n  constructor(private readonly service: ${name}Service) {}\n  async execute(cmd: Create${name}Command) { return this.service.create(cmd.dto); }\n}\n`
  }
  private cqrsUpdateHandler(name: string, slug: string): string {
    return `import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';\nimport { Update${name}Command } from '../update-${slug}.command';\nimport { ${name}Service } from '../../${slug}.service';\n\n@CommandHandler(Update${name}Command)\nexport class Update${name}Handler implements ICommandHandler<Update${name}Command> {\n  constructor(private readonly service: ${name}Service) {}\n  async execute(cmd: Update${name}Command) { return this.service.update(cmd.id, cmd.dto); }\n}\n`
  }
  private cqrsDeleteHandler(name: string, slug: string): string {
    return `import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';\nimport { Delete${name}Command } from '../delete-${slug}.command';\nimport { ${name}Service } from '../../${slug}.service';\n\n@CommandHandler(Delete${name}Command)\nexport class Delete${name}Handler implements ICommandHandler<Delete${name}Command> {\n  constructor(private readonly service: ${name}Service) {}\n  async execute(cmd: Delete${name}Command) { return this.service.remove(cmd.id); }\n}\n`
  }
  private cqrsGetAllQuery(name: string): string {
    return `import { IQuery } from '@nestjs/cqrs';\nexport class GetAll${name}Query implements IQuery {}\n`
  }
  private cqrsGetOneQuery(name: string): string {
    return `import { IQuery } from '@nestjs/cqrs';\nexport class GetOne${name}Query implements IQuery {\n  constructor(public readonly id: number) {}\n}\n`
  }
  private cqrsGetAllHandler(name: string, slug: string): string {
    return `import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';\nimport { GetAll${name}Query } from '../get-all-${slug}.query';\nimport { ${name}Service } from '../../${slug}.service';\n\n@QueryHandler(GetAll${name}Query)\nexport class GetAll${name}Handler implements IQueryHandler<GetAll${name}Query> {\n  constructor(private readonly service: ${name}Service) {}\n  async execute() { return this.service.findAll(); }\n}\n`
  }
  private cqrsGetOneHandler(name: string, slug: string): string {
    return `import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';\nimport { GetOne${name}Query } from '../get-one-${slug}.query';\nimport { ${name}Service } from '../../${slug}.service';\n\n@QueryHandler(GetOne${name}Query)\nexport class GetOne${name}Handler implements IQueryHandler<GetOne${name}Query> {\n  constructor(private readonly service: ${name}Service) {}\n  async execute(q: GetOne${name}Query) { return this.service.findOne(q.id); }\n}\n`
  }

  private generateCqrsController(ctx: Record<string, unknown>, config: ProjectConfig): string {
    const name    = ctx.pascalName as string
    const mLow    = ctx.camelName  as string
    const slug    = ctx.kebabName  as string
    const swagger = config.nestjs?.swagger ?? false
    const auth    = config.nestjs?.auth !== 'none' && config.nestjs?.auth

    return `import { Controller, Get, Post, Body, Patch, Param, Delete${auth ? ', UseGuards' : ''} } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
${swagger ? `import { ApiTags, ApiOperation${auth ? ', ApiBearerAuth' : ''} } from '@nestjs/swagger';` : ''}
import { Create${name}Command } from './commands/create-${slug}.command';
import { Update${name}Command } from './commands/update-${slug}.command';
import { Delete${name}Command } from './commands/delete-${slug}.command';
import { GetAll${name}Query } from './queries/get-all-${slug}.query';
import { GetOne${name}Query } from './queries/get-one-${slug}.query';
import { Create${name}Dto } from './dto/create-${slug}.dto';
import { Update${name}Dto } from './dto/update-${slug}.dto';
${auth ? `import { JwtAuthGuard } from '../auth/jwt-auth.guard';` : ''}

${swagger ? `@ApiTags('${name}')` : ''}
@Controller('${slug}')
export class ${name}Controller {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) {}

  @Post()${swagger ? `\n  @ApiOperation({ summary: 'Create ${mLow}' })` : ''}${auth ? `\n  @UseGuards(JwtAuthGuard)\n  @ApiBearerAuth()` : ''}
  create(@Body() dto: Create${name}Dto) {
    return this.commandBus.execute(new Create${name}Command(dto));
  }

  @Get()${swagger ? `\n  @ApiOperation({ summary: 'Get all ${mLow}s' })` : ''}
  findAll() { return this.queryBus.execute(new GetAll${name}Query()); }

  @Get(':id')${swagger ? `\n  @ApiOperation({ summary: 'Get one ${mLow}' })` : ''}
  findOne(@Param('id') id: string) {
    return this.queryBus.execute(new GetOne${name}Query(+id));
  }

  @Patch(':id')${swagger ? `\n  @ApiOperation({ summary: 'Update ${mLow}' })` : ''}${auth ? `\n  @UseGuards(JwtAuthGuard)\n  @ApiBearerAuth()` : ''}
  update(@Param('id') id: string, @Body() dto: Update${name}Dto) {
    return this.commandBus.execute(new Update${name}Command(+id, dto));
  }

  @Delete(':id')${swagger ? `\n  @ApiOperation({ summary: 'Delete ${mLow}' })` : ''}${auth ? `\n  @UseGuards(JwtAuthGuard)\n  @ApiBearerAuth()` : ''}
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new Delete${name}Command(+id));
  }
}
`
  }

  private generateCqrsModule(ctx: Record<string, unknown>, config: ProjectConfig): string {
    const name  = ctx.pascalName as string
    const slug  = ctx.kebabName  as string
    const orm   = config.nestjs?.orm ?? 'typeorm'

    const ormImport = orm === 'typeorm'
      ? `import { TypeOrmModule } from '@nestjs/typeorm';\nimport { ${name} } from './entities/${slug}.entity';`
      : orm === 'mongoose'
      ? `import { MongooseModule } from '@nestjs/mongoose';\nimport { ${name}, ${name}Schema } from './${slug}.schema';`
      : orm === 'prisma'
      ? `import { PrismaService } from '../prisma.service';`
      : ''

    const ormImportsArr = orm === 'typeorm'
      ? `TypeOrmModule.forFeature([${name}]), `
      : orm === 'mongoose'
      ? `MongooseModule.forFeature([{ name: ${name}.name, schema: ${name}Schema }]), `
      : ''

    const ormProviders = orm === 'prisma' ? ', PrismaService' : ''

    return `import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ${name}Controller } from './${slug}.controller';
import { ${name}Service } from './${slug}.service';
${ormImport}
import { Create${name}Handler } from './commands/handlers/create-${slug}.handler';
import { Update${name}Handler } from './commands/handlers/update-${slug}.handler';
import { Delete${name}Handler } from './commands/handlers/delete-${slug}.handler';
import { GetAll${name}Handler } from './queries/handlers/get-all-${slug}.handler';
import { GetOne${name}Handler } from './queries/handlers/get-one-${slug}.handler';

@Module({
  imports: [CqrsModule, ${ormImportsArr}],
  controllers: [${name}Controller],
  providers: [
    ${name}Service${ormProviders},
    Create${name}Handler,
    Update${name}Handler,
    Delete${name}Handler,
    GetAll${name}Handler,
    GetOne${name}Handler,
  ],
})
export class ${name}Module {}
`
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

  // ── Auth module generation ────────────────────────────────────────

  private generateEnvExample(config: ProjectConfig): GeneratedFile {
    const auth   = config.nestjs?.auth ?? 'none'
    const db     = config.nestjs?.db_engine ?? 'postgresql'
    const name   = config.name
    const orm    = config.nestjs?.orm ?? 'typeorm'

    let dbLine = ''
    if (orm === 'mongoose') {
      dbLine = `MONGODB_URI="mongodb://localhost:27017/${name}"`
    } else {
      if (db === 'postgresql') dbLine = `DATABASE_URL="postgresql://user:password@localhost:5432/${name}"`
      else if (db === 'mysql')  dbLine = `DATABASE_URL="mysql://user:password@localhost:3306/${name}"`
      else if (db === 'sqlite') dbLine = `DATABASE_URL="file:./dev.db"`
    }

    const lines = [
      `NODE_ENV=development`,
      `PORT=3000`,
      dbLine,
      ...(auth !== 'none' ? [
        `JWT_SECRET="change-me-in-production"`,
        `JWT_EXPIRES_IN="7d"`,
      ] : []),
    ].filter(Boolean)

    return { outputPath: '.env.example', content: lines.join('\n') + '\n' }
  }

  private generateAuthModule(config: ProjectConfig): GeneratedFile[] {
    const orm = config.nestjs?.orm ?? 'typeorm'
    const hasSwagger = config.nestjs?.swagger ?? true
    const hasValidation = config.nestjs?.validation ?? true

    return [
      { outputPath: 'src/modules/auth/auth.module.ts',              content: this.nestAuthModule(orm) },
      { outputPath: 'src/modules/auth/auth.service.ts',             content: this.nestAuthService(orm) },
      { outputPath: 'src/modules/auth/auth.controller.ts',          content: this.nestAuthController(hasSwagger) },
      { outputPath: 'src/modules/auth/strategies/jwt.strategy.ts',  content: this.nestJwtStrategy() },
      { outputPath: 'src/modules/auth/guards/jwt-auth.guard.ts',    content: this.nestJwtGuard() },
      { outputPath: 'src/modules/auth/dto/login.dto.ts',            content: this.nestLoginDto(hasValidation, hasSwagger) },
      { outputPath: 'src/modules/auth/dto/register.dto.ts',         content: this.nestRegisterDto(hasValidation, hasSwagger) },
    ]
  }

  private nestAuthModule(orm: string): string {
    const isTypeOrm  = orm === 'typeorm'
    const isMongoose = orm === 'mongoose'

    return `import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
${isTypeOrm ? "import { TypeOrmModule } from '@nestjs/typeorm';\nimport { User } from '../user/entities/user.entity';" : ''}
${isMongoose ? "import { MongooseModule } from '@nestjs/mongoose';\nimport { User, UserSchema } from '../user/entities/user.entity';" : ''}
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET ?? 'change-me',
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN ?? '7d' },
    }),
    ${isTypeOrm ? 'TypeOrmModule.forFeature([User]),' : ''}
    ${isMongoose ? "MongooseModule.forFeature([{ name: User.name, schema: UserSchema }])," : ''}
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
`
  }

  private nestAuthService(orm: string): string {
    const isTypeOrm  = orm === 'typeorm'
    const isMongoose = orm === 'mongoose'
    const isPrisma   = orm === 'prisma'

    const userImport = isPrisma
      ? `import { PrismaService } from '../prisma/prisma.service';`
      : isTypeOrm
        ? `import { InjectRepository } from '@nestjs/typeorm';\nimport { Repository } from 'typeorm';\nimport { User } from '../user/entities/user.entity';`
        : `import { InjectModel } from '@nestjs/mongoose';\nimport { Model } from 'mongoose';\nimport { User } from '../user/entities/user.entity';`

    const constructorArgs = isPrisma
      ? `private readonly prisma: PrismaService,`
      : isTypeOrm
        ? `@InjectRepository(User) private readonly userRepo: Repository<User>,`
        : `@InjectModel(User.name) private readonly userModel: Model<User>,`

    const findByEmail = isPrisma
      ? `this.prisma.user.findUnique({ where: { email } })`
      : isTypeOrm
        ? `this.userRepo.findOne({ where: { email } })`
        : `this.userModel.findOne({ email }).exec()`

    const checkDuplicate = isPrisma
      ? `this.prisma.user.findUnique({ where: { email: dto.email } })`
      : isTypeOrm
        ? `this.userRepo.findOne({ where: { email: dto.email } })`
        : `this.userModel.findOne({ email: dto.email }).exec()`

    const createUser = isPrisma
      ? `await this.prisma.user.create({ data: { name: dto.name, email: dto.email, password: hashed }, select: { id: true, name: true, email: true } })`
      : isTypeOrm
        ? `await this.userRepo.save(this.userRepo.create({ name: dto.name, email: dto.email, password: hashed }))`
        : `(await this.userModel.create({ name: dto.name, email: dto.email, password: hashed })).toObject()`

    return `import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
${userImport}
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    ${constructorArgs}
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await ${checkDuplicate};
    if (existing) throw new ConflictException('Email already in use');
    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await ${createUser};
    return { message: 'Account created', user };
  }

  async login(dto: LoginDto) {
    const user = await ${findByEmail};
    if (!user) throw new UnauthorizedException('Invalid credentials');
    const valid = await bcrypt.compare(dto.password, user.password as string);
    if (!valid) throw new UnauthorizedException('Invalid credentials');
    const token = this.jwtService.sign({ id: user.id ?? (user as any)._id });
    return { token, user: { id: user.id ?? (user as any)._id, name: user.name, email: user.email } };
  }
}
`
  }

  private nestAuthController(hasSwagger: boolean): string {
    const swaggerImports = hasSwagger ? `import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';\n` : ''
    const apiTags  = hasSwagger ? `@ApiTags('auth')\n` : ''
    const bearerAuth = hasSwagger ? `@ApiBearerAuth()\n` : ''
    const loginOp    = hasSwagger ? `  @ApiOperation({ summary: 'Login and receive a JWT token' })\n` : ''
    const registerOp = hasSwagger ? `  @ApiOperation({ summary: 'Register a new account' })\n` : ''
    const meOp       = hasSwagger ? `  @ApiOperation({ summary: 'Get current authenticated user' })\n` : ''

    return `import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
${swaggerImports}import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

${apiTags}@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

${registerOp}  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

${loginOp}  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

${bearerAuth}${meOp}  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Request() req: any) {
    return req.user;
  }
}
`
  }

  private nestJwtStrategy(): string {
    return `import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET ?? 'change-me',
    });
  }

  async validate(payload: { id: any }) {
    return { id: payload.id };
  }
}
`
  }

  private nestJwtGuard(): string {
    return `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
`
  }

  private nestLoginDto(hasValidation: boolean, hasSwagger: boolean): string {
    const valImport  = hasValidation ? `import { IsEmail, IsString, MinLength } from 'class-validator';\n` : ''
    const swImport   = hasSwagger    ? `import { ApiProperty } from '@nestjs/swagger';\n` : ''
    const emailDeco  = [hasSwagger ? `  @ApiProperty({ example: 'user@example.com' })` : '', hasValidation ? '  @IsEmail()' : ''].filter(Boolean).join('\n')
    const passDeco   = [hasSwagger ? `  @ApiProperty({ example: 'password123' })` : '', hasValidation ? '  @IsString()\n  @MinLength(8)' : ''].filter(Boolean).join('\n')

    return `${valImport}${swImport}
export class LoginDto {
${emailDeco}
  email: string;

${passDeco}
  password: string;
}
`
  }

  private nestRegisterDto(hasValidation: boolean, hasSwagger: boolean): string {
    const valImport = hasValidation ? `import { IsEmail, IsString, MinLength } from 'class-validator';\n` : ''
    const swImport  = hasSwagger    ? `import { ApiProperty } from '@nestjs/swagger';\n` : ''
    const nameDeco  = [hasSwagger ? `  @ApiProperty({ example: 'John Doe' })` : '', hasValidation ? '  @IsString()' : ''].filter(Boolean).join('\n')
    const emailDeco = [hasSwagger ? `  @ApiProperty({ example: 'user@example.com' })` : '', hasValidation ? '  @IsEmail()' : ''].filter(Boolean).join('\n')
    const passDeco  = [hasSwagger ? `  @ApiProperty({ example: 'password123', minLength: 8 })` : '', hasValidation ? '  @IsString()\n  @MinLength(8)' : ''].filter(Boolean).join('\n')

    return `${valImport}${swImport}
export class RegisterDto {
${nameDeco}
  name: string;

${emailDeco}
  email: string;

${passDeco}
  password: string;
}
`
  }
}
