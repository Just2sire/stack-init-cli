import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import pc from 'picocolors'
import type { Model, ProjectConfig } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { fieldToCast, fieldToValidationRule, fieldToFaker, fieldToSwaggerType } from '../../utils/field-helpers'
import { modelToTableName, modelToRouteName, modelToVarName, migrationTimestamp, pluralize } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'
import { generateLaravelPlugins } from './plugins/index'
import { sortModelsByDependency } from '../../utils/model-sort'
import { hasArtisan, runArtisan } from '../../utils/artisan'

const TEMPLATES_DIR = resolveTemplatesDir('laravel')

// Tables créées par les migrations par défaut de Laravel — on évite de régénérer Schema::create
const LARAVEL_DEFAULT_TABLES = new Set([
  'users', 'password_reset_tokens', 'failed_jobs', 'personal_access_tokens',
  'sessions', 'cache', 'cache_locks', 'jobs', 'job_batches',
])

// Champs déjà présents dans ces migrations par défaut
const LARAVEL_DEFAULT_FIELDS: Record<string, Set<string>> = {
  users:                  new Set(['name', 'email', 'email_verified_at', 'password', 'remember_token']),
  password_reset_tokens:  new Set(['email', 'token', 'created_at']),
  sessions:               new Set(['id', 'user_id', 'ip_address', 'user_agent', 'payload', 'last_activity']),
  cache:                  new Set(['key', 'value', 'expiration']),
  cache_locks:            new Set(['key', 'owner', 'expiration']),
  jobs:                   new Set(['id', 'queue', 'payload', 'attempts', 'reserved_at', 'available_at', 'created_at']),
  job_batches:            new Set(['id', 'name', 'total_jobs', 'pending_jobs', 'failed_jobs', 'failed_job_ids', 'options', 'cancelled_at', 'created_at', 'finished_at']),
  failed_jobs:            new Set(['id', 'uuid', 'connection', 'queue', 'payload', 'exception', 'failed_at']),
  personal_access_tokens: new Set(['id', 'tokenable_type', 'tokenable_id', 'name', 'token', 'abilities', 'last_used_at', 'expires_at', 'created_at', 'updated_at']),
}

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class LaravelGenerator {
  private hbs: typeof Handlebars
  private cache = new Map<string, HandlebarsTemplateDelegate>()

  constructor() { this.hbs = configureHandlebars() }

  async generate(config: ProjectConfig, projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const laravelAuth    = config.laravel?.auth    ?? 'none'
    const laravelPattern = config.laravel?.pattern ?? 'api-only'

    // Migration order: pin Laravel-default-table models (users, etc.) first so FK-dependent
    // migrations are never generated before their parent tables.
    const sortedModels = sortModelsByDependency(config.models)
    const defaultTableModels = sortedModels.filter(m => LARAVEL_DEFAULT_TABLES.has(modelToTableName(m.name)))
    const customTableModels  = sortedModels.filter(m => !LARAVEL_DEFAULT_TABLES.has(modelToTableName(m.name)))
    const orderedModels = [...defaultTableModels, ...customTableModels]

    // ── Phase 0 — Pre-flight: snapshot patchable files before any write ────────
    // Both api.php and DatabaseSeeder.php may already exist in the project and
    // need to be patched rather than overwritten.  Reading them here — before
    // any GeneratedFile is queued — ensures we always see the real on-disk state
    // regardless of what the generator will later emit.
    let existingApi = fs.existsSync(path.join(projectRoot, 'routes/api.php'))
      ? fs.readFileSync(path.join(projectRoot, 'routes/api.php'),  'utf-8') : null
    const existingSeeder = fs.existsSync(path.join(projectRoot, 'database/seeders/DatabaseSeeder.php'))
      ? fs.readFileSync(path.join(projectRoot, 'database/seeders/DatabaseSeeder.php'), 'utf-8') : null

    // Artisan integration: when a Laravel project is present (artisan file exists),
    // delegate file creation to artisan where possible rather than writing stubs ourselves.
    const artisanAvailable = hasArtisan(projectRoot)

    // If routes/api.php doesn't exist yet and artisan is available, use `php artisan install:api`
    // to create it (installs Sanctum + proper bootstrapping) instead of rendering our template.
    // We re-read the file afterward so buildApiPhp() enters patch mode and injects our routes.
    if (!existingApi && artisanAvailable && laravelPattern !== 'minimal') {
      try {
        await runArtisan(projectRoot, ['install:api', '--no-interaction'])
        const apiPhpPath = path.join(projectRoot, 'routes/api.php')
        if (fs.existsSync(apiPhpPath)) existingApi = fs.readFileSync(apiPhpPath, 'utf-8')
      } catch {
        result.warnings.push('php artisan install:api a échoué — routes/api.php sera généré depuis le template.')
      }
    }

    // ── Phase 1 — Infrastructure (no model dependencies) ──────────────────────
    result.files.push(this.generateEnvExample(config))

    const infraCtx = { laravelOptions: config.laravel, projectName: config.name }

    // ApiResponse trait — always when use_api_response is enabled (default: true)
    if (config.laravel?.use_api_response !== false) {
      result.files.push({ outputPath: 'app/Traits/ApiResponse.php', content: this.render('base/traits/ApiResponse.php.hbs', infraCtx) })
    }

    // app:pattern artisan command — always generated so devs can add models post-scaffold.
    // When artisan is available, we first spawn `php artisan make:command Pattern --force`
    // so Laravel creates the file in the correct location with the right namespace/attribute
    // syntax for the installed version, then we overwrite it with our full implementation.
    {
      let patternSkipCheck = false
      if (artisanAvailable) {
        try {
          await runArtisan(projectRoot, ['make:command', 'Pattern', '--force'])
          patternSkipCheck = true
        } catch {
          result.warnings.push('php artisan make:command Pattern a échoué — Pattern.php généré depuis le template.')
        }
      }
      result.files.push({
        outputPath: 'app/Console/Commands/Pattern.php',
        content: this.render('base/commands/Pattern.php.hbs', infraCtx),
        skipOverwriteCheck: patternSkipCheck,
      })
    }

    const hasAnySwagger = config.models.some(m => m.generate.swagger)
    if (hasAnySwagger) {
      result.files.push({ outputPath: 'SWAGGER_SETUP.md',                  content: this.generateSwaggerGuideMd(config) })
      result.files.push({ outputPath: 'app/Http/Controllers/Controller.php', content: this.render('base/BaseController.php.hbs', infraCtx) })
      result.warnings.push('Swagger enabled: run "php artisan l5-swagger:generate" after "composer update" to generate the OpenAPI spec at /api/documentation.')
    }

    // ── Phase 2 — Database + model layer (FK-ordered) ─────────────────────────
    // Within each model: migration → eloquent model → requests → factory →
    // repository → actions → service → resource → collection → controller →
    // seeder → tests → observer → events/listeners.
    // The topological sort ensures FK parents are always processed first.
    for (let i = 0; i < orderedModels.length; i++) {
      const r = await this.generateModel(orderedModels[i], config, i, laravelPattern)
      result.files.push(...r.files)
      result.warnings.push(...r.warnings)
    }

    // ── Phase 3 — Auth controller + form requests ──────────────────────────────
    // Must come before Phase 4 so the AuthController file exists when we inject
    // auth routes into api.php.
    if (laravelAuth !== 'none') {
      const hasUserModel = config.models.some(m => m.name.toLowerCase() === 'user')
      if (!hasUserModel) {
        result.warnings.push('Auth is enabled but no "User" model found. The AuthController references the User model — add one or adjust manually.')
      }
      result.files.push(...this.generateAuthFiles(config))
    }

    // ── Phase 4 — Routes ───────────────────────────────────────────────────────
    // Built after all controllers (model + auth) are determined.
    // Uses the Phase-0 snapshot to decide: patch existing file vs. generate fresh.
    // Both paths go through buildApiPhp() so the logic is never duplicated.
    const modelsWithRoutes = orderedModels.filter(m => m.generate.routes)

    if (laravelPattern === 'minimal') {
      if (modelsWithRoutes.length > 0) {
        const minimalCtx = {
          models: modelsWithRoutes.map(m => {
            const ctx = this.buildContext(m, config)
            return { name: m.name, routeName: modelToRouteName(m.name), varName: modelToVarName(m.name), validationRules: ctx.validationRules }
          }),
        }
        result.files.push({ outputPath: 'routes/api.php', content: this.render('overlays/routes/api-minimal.php.hbs', minimalCtx) })
      }
    } else {
      if (modelsWithRoutes.length > 0 || laravelAuth !== 'none') {
        const apiVersion  = config.laravel?.api_version ?? 'v1'
        const routeModels = modelsWithRoutes.map(m => ({ name: m.name, routeName: modelToRouteName(m.name), generate: m.generate }))
        result.files.push({
          outputPath: 'routes/api.php',
          content: this.buildApiPhp(existingApi, routeModels, laravelAuth, apiVersion),
        })
      }

      if (laravelPattern === 'full' && modelsWithRoutes.length > 0) {
        const webCtx = { models: modelsWithRoutes.map(m => ({ name: m.name, routeName: modelToRouteName(m.name), generate: m.generate })) }
        result.files.push({ outputPath: 'routes/web.php', content: this.render('overlays/routes/web.php.hbs', webCtx) })

        for (const model of modelsWithRoutes) {
          const ctx = this.buildContext(model, config)
          const routeName = modelToRouteName(model.name)
          for (const view of ['index', 'create', 'edit', 'show']) {
            result.files.push({ outputPath: `resources/views/${routeName}/${view}.blade.php`, content: this.render(`overlays/views/${view}.blade.php.hbs`, ctx) })
          }
        }
        result.warnings.push('pattern:full — Blade views generated. Create a layouts/app.blade.php and add your UI framework to use them.')
      }
    }

    // ── Phase 5 — Seeder layer (FK-ordered) ────────────────────────────────────
    // Individual *Seeder files were already emitted in Phase 2.
    // DatabaseSeeder is built here, after all seeders are known, so it can call
    // them in topological order.  Uses the Phase-0 snapshot via buildDatabaseSeeder().
    const modelsWithSeeder = orderedModels.filter(m => m.generate.seeder)
    if (modelsWithSeeder.length > 0) {
      const seederNames = modelsWithSeeder.map(m => `${m.name}Seeder::class`)
      const seederCtx   = { seeders: seederNames, laravelOptions: config.laravel }
      result.files.push({
        outputPath: 'database/seeders/DatabaseSeeder.php',
        content: this.buildDatabaseSeeder(existingSeeder, seederNames, seederCtx),
      })
    }

    // ── Phase 6 — Cross-model base classes + providers ────────────────────────
    const modelsWithRepo = config.models.filter(m => m.generate.repository)
    if (modelsWithRepo.length > 0) {
      const repoBaseCtx = { laravelOptions: config.laravel }
      result.files.push({ outputPath: 'app/Repositories/BaseRepository.php',            content: this.render('base/repository/BaseRepository.php.hbs', repoBaseCtx) })
      result.files.push({ outputPath: 'app/Repositories/Contracts/BaseRepositoryInterface.php', content: this.render('base/repository/BaseRepositoryInterface.php.hbs', repoBaseCtx) })
    }

    const modelsWithObserver = config.models.filter(m => m.generate.observer)
    if (modelsWithObserver.length > 0) {
      const observerCtx = {
        observerModels: modelsWithObserver.map(m => ({ name: m.name, varName: modelToVarName(m.name) })),
        laravelOptions: config.laravel,
      }
      result.files.push({ outputPath: 'app/Providers/ObserverServiceProvider.php', content: this.render('overlays/observer/ObserverServiceProvider.php.hbs', observerCtx) })
      const laravelVer = parseInt(config.laravel?.laravel_version ?? '11')
      const regLocation = laravelVer >= 11
        ? 'bootstrap/providers.php — add \\App\\Providers\\ObserverServiceProvider::class to the array'
        : 'config/app.php — add \\App\\Providers\\ObserverServiceProvider::class to the providers array'
      result.warnings.push(`ObserverServiceProvider generated. Register it in ${regLocation}.`)
    }

    // ── Phase 7 — Plugins (Notifications, Socialite, Spatie, Horizon, 2FA) ────
    generateLaravelPlugins(config, result.files, result.warnings)

    return result
  }

  private async generateModel(
    model: Model,
    config: ProjectConfig,
    index: number,
    pattern: string,
  ): Promise<GeneratorResult> {
    const files: GeneratedFile[] = []
    const warnings: string[]     = []
    const ctx = this.buildContext(model, config)

    // Model — always
    files.push({ outputPath: `app/Models/${model.name}.php`, content: this.render('base/Model.php.hbs', ctx) })

    // Migration
    if (model.generate.migration) {
      const tableName = ctx.tableName as string
      if (LARAVEL_DEFAULT_TABLES.has(tableName)) {
        const defaultFields = LARAVEL_DEFAULT_FIELDS[tableName] ?? new Set<string>()
        const extraFields = model.fields.filter(
          f => !defaultFields.has(f.name) && f.type !== 'rememberToken'
        )
        if (extraFields.length > 0) {
          files.push({
            outputPath: `database/migrations/${migrationTimestamp(index + 100)}_add_custom_fields_to_${tableName}_table.php`,
            content: this.render('overlays/migration/alter-migration.php.hbs', { ...ctx, fields: extraFields }),
          })
        }
        warnings.push(
          `Skipped "create_${tableName}_table" migration — Laravel already provides one.` +
          (extraFields.length > 0
            ? ` Generated alter migration for ${extraFields.length} extra field(s): ${extraFields.map(f => f.name).join(', ')}.`
            : ' No extra fields to add.')
        )
      } else {
        files.push({
          outputPath: `database/migrations/${migrationTimestamp(index)}_create_${tableName}_table.php`,
          content: this.render('overlays/migration/migration.php.hbs', ctx),
        })
      }
    }

    // Controller — skip for minimal pattern (routes are inline closures)
    if (model.generate.controller && pattern !== 'minimal') {
      files.push({ outputPath: `app/Http/Controllers/Api/${model.name}Controller.php`, content: this.render('base/Controller.php.hbs', ctx) })
    } else if (model.generate.controller && pattern === 'minimal') {
      warnings.push(`[${model.name}] pattern:minimal — controller skipped (routes are generated as inline closures in routes/api.php).`)
    }

    // Resource
    if (model.generate.resource) {
      files.push({ outputPath: `app/Http/Resources/${model.name}Resource.php`, content: this.render('overlays/resource/Resource.php.hbs', ctx) })
    }

    // Resource Collection
    if (model.generate.collection && model.generate.resource) {
      files.push({ outputPath: `app/Http/Resources/${model.name}Collection.php`, content: this.render('overlays/resource/Collection.php.hbs', ctx) })
    } else if (model.generate.collection && !model.generate.resource) {
      warnings.push(`[${model.name}] collection enabled but resource is disabled — Collection requires Resource. Enable resource to generate both.`)
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
      files.push({ outputPath: `app/Repositories/${model.name}Repository.php`,            content: this.render('overlays/repository/Repository.php.hbs', ctx) })
      files.push({ outputPath: `app/Repositories/Contracts/${model.name}RepositoryInterface.php`, content: this.render('overlays/repository/RepositoryInterface.php.hbs', ctx) })
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

    // Observer
    if (model.generate.observer) {
      files.push({ outputPath: `app/Observers/${model.name}Observer.php`, content: this.render('overlays/observer/Observer.php.hbs', ctx) })
    }

    // Events + Listeners
    if (model.generate.events) {
      for (const suffix of ['Created', 'Updated', 'Deleted'] as const) {
        const eventCtx = { ...ctx, eventSuffix: suffix }
        files.push({
          outputPath: `app/Events/${model.name}${suffix}.php`,
          content: this.render('overlays/events/ModelEvent.php.hbs', eventCtx),
        })
        files.push({
          outputPath: `app/Listeners/Log${model.name}${suffix}Listener.php`,
          content: this.render('overlays/events/Listener.php.hbs', eventCtx),
        })
      }
    }

    // Action classes
    if (model.generate.actions) {
      for (const verb of ['Create', 'Update', 'Delete'] as const) {
        files.push({
          outputPath: `app/Actions/${model.name}/${verb}${model.name}Action.php`,
          content: this.render(`overlays/actions/${verb}Action.php.hbs`, ctx),
        })
      }
    }

    return {
      files: files.map(f => ({ ...f, model: model.name })),
      warnings,
    }
  }

  private buildContext(model: Model, config: ProjectConfig): Record<string, unknown> {
    const tableName  = model.table ?? modelToTableName(model.name)
    const varName    = modelToVarName(model.name)
    const routeName  = modelToRouteName(model.name)
    const namePlural = pluralize(model.name)
    const primaryKey = model.migration.primary_key ?? 'id'
    const idType     = (primaryKey === 'uuid' || primaryKey === 'ulid') ? 'string' : 'integer'

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

    const swaggerFields = model.fields
      .filter(f => !['id', 'rememberToken', 'morphs', 'uuidMorphs'].includes(f.type))
      .map(field => ({
        name:     field.name,
        oaType:   fieldToSwaggerType(field),
        nullable: 'nullable' in field ? (field as any).nullable ?? false : false,
      }))

    const hasUserRelation = model.relations.some(r => r.model === 'User') ||
      model.fields.some(f => f.name === 'user_id')

    const laravelAuth    = config.laravel?.auth       ?? 'none'
    const apiVersion     = config.laravel?.api_version ?? 'v1'
    const hasAuth        = laravelAuth !== 'none'
    const projectName    = config.name
    const swaggerSecurity = '     *     security={{"sanctum":{}}},\n'

    return {
      name: model.name, namePlural, tableName, varName, routeName,
      primaryKey, idType, customTable: model.table,
      migration: model.migration, generate: model.generate,
      fields: model.fields, fillable,
      casts:          Object.keys(casts).length > 0 ? casts : null,
      hiddenFields:   hiddenFields.length > 0 ? hiddenFields : null,
      imports, relations: model.relations,
      resourceFields, validationRules, fakerFields, swaggerFields,
      hasUserRelation, laravelOptions: config.laravel,
      apiVersion, hasAuth, projectName, swaggerSecurity,
      isUserModel:    model.name === 'User',
      modelParamName: model.name === 'User' ? 'model' : modelToVarName(model.name),
    }
  }

  private render(tpl: string, ctx: Record<string, unknown>): string {
    if (!this.cache.has(tpl)) {
      const src = fs.readFileSync(path.join(TEMPLATES_DIR, tpl), 'utf-8')
      this.cache.set(tpl, this.hbs.compile(src))
    }
    return this.cache.get(tpl)!(ctx)
  }

  // ── Auth generation ────────────────────────────────────────────────────────

  private generateEnvExample(config: ProjectConfig): GeneratedFile {
    const db   = config.laravel?.db_engine  ?? 'mysql'
    const auth = config.laravel?.auth       ?? 'none'
    const name = config.name
    const useRedis = config.laravel?.use_redis ?? false

    const dbHost = db === 'pgsql'
      ? 'DB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432'
      : `DB_CONNECTION=${db}\nDB_HOST=127.0.0.1\nDB_PORT=${db === 'mysql' ? '3306' : '5432'}`

    const lines = [
      `APP_NAME="${name}"`,
      `APP_ENV=local`,
      `APP_KEY=`,
      `APP_DEBUG=true`,
      `APP_URL=http://localhost:8000`,
      ``,
      dbHost,
      `DB_DATABASE=${name}`,
      `DB_USERNAME=root`,
      `DB_PASSWORD=`,
    ]

    if (useRedis) {
      lines.push(``, `REDIS_HOST=127.0.0.1`, `REDIS_PORT=6379`, ``, `CACHE_DRIVER=redis`, `QUEUE_CONNECTION=redis`)
    }

    return { outputPath: '.env.example', content: lines.join('\n') + '\n' }
  }

  private generateAuthFiles(config: ProjectConfig): GeneratedFile[] {
    const auth = config.laravel?.auth ?? 'sanctum'
    return [
      { outputPath: 'app/Http/Controllers/Auth/AuthController.php', content: this.laravelAuthController(auth, config) },
      { outputPath: 'app/Http/Requests/Auth/LoginRequest.php',      content: this.laravelLoginRequest(config) },
      { outputPath: 'app/Http/Requests/Auth/RegisterRequest.php',   content: this.laravelRegisterRequest(config) },
    ]
  }

  // ── Route file builder ──────────────────────────────────────────────────────
  // Single entry-point for generating or patching routes/api.php.
  // • existing !== null → patch (inject missing routes / use statements)
  // • existing === null → render fresh from template, then inject auth routes
  // Auth injection runs in both paths so the logic is never duplicated.
  private buildApiPhp(
    existing: string | null,
    routeModels: Array<{ name: string; routeName: string; generate: Record<string, boolean> }>,
    laravelAuth: string,
    apiVersion = 'v1',
  ): string {
    const hasAuth    = laravelAuth !== 'none'
    const authGuard  = laravelAuth === 'passport' ? 'api' : 'sanctum'
    const authUse    = `use App\\Http\\Controllers\\Auth\\AuthController;`
    const authRoutes = [
      `Route::prefix('auth')->group(function () {`,
      `    Route::post('register', [AuthController::class, 'register']);`,
      `    Route::post('login',    [AuthController::class, 'login']);`,
      `    Route::middleware('auth:${authGuard}')->group(function () {`,
      `        Route::post('logout', [AuthController::class, 'logout']);`,
      `        Route::get('me',      [AuthController::class, 'me']);`,
      `    });`,
      `});`,
    ].join('\n')

    const injectUse = (content: string, useLine: string): string => {
      if (content.includes(useLine)) return content
      const lines = content.split('\n')
      const lastUseIdx = lines.reduce((last, line, i) => line.trimStart().startsWith('use ') ? i : last, -1)
      if (lastUseIdx >= 0) {
        lines.splice(lastUseIdx + 1, 0, useLine)
        return lines.join('\n')
      }
      return content.replace('<?php', `<?php\n\n${useLine}`)
    }

    const injectRoute = (content: string, route: string): string => {
      if (content.includes(route)) return content
      const marker = '// @stack-init-routes-end'
      if (content.includes(marker)) {
        return content.replace(marker, `${route}\n${marker}`)
      }
      // No marker yet: add a visual separator so generated routes are clearly distinct
      // from pre-existing routes, then plant the marker for idempotent future injections.
      const separator = '\n// ─── routes générées par stack-init ─────────────────────────────────────'
      return content.trimEnd() + `${separator}\n${route}\n${marker}\n`
    }

    // Fresh generation: render template with full context (handles auth + version natively)
    let content = existing ?? this.render('overlays/routes/api.php.hbs', {
      models: routeModels, hasAuth, apiVersion,
    })

    // Patch mode only: inject missing use statements and routes into an existing file
    if (existing) {
      for (const model of routeModels) {
        content = injectUse(content, `use App\\Http\\Controllers\\Api\\${model.name}Controller;`)
        content = injectRoute(content, `Route::apiResource('${model.routeName}', ${model.name}Controller::class);`)
      }
      if (hasAuth) {
        content = injectUse(content, authUse)
        if (!content.includes('AuthController::class')) {
          content = injectRoute(content, authRoutes)
        }
      }
    }

    return content
  }

  // ── DatabaseSeeder builder ───────────────────────────────────────────────────
  private buildDatabaseSeeder(
    existing: string | null,
    seederNames: string[],
    ctx: Record<string, unknown>,
  ): string {
    if (existing?.includes('$this->call([')) {
      let content = existing
      for (const seeder of seederNames) {
        if (!content.includes(seeder)) {
          content = content.replace('$this->call([', `$this->call([\n            ${seeder},`)
        }
      }
      return content
    }
    // Fresh Laravel scaffold (no $this->call block) or no existing file → generate from template
    return this.render('overlays/seeder/DatabaseSeeder.php.hbs', ctx)
  }

  private generateSwaggerConfig(config: ProjectConfig): string {
    const name  = config.name
    const title = name.charAt(0).toUpperCase() + name.slice(1)
    return `<?php

use L5Swagger\\Generator;
use OpenApi\\scan;

return [
    'default' => 'default',
    'documentations' => [
        'default' => [
            'api' => [
                'title' => '${title} API',
            ],

            'routes' => [
                /*
                 * Route for accessing api documentation interface
                 */
                'api' => 'api/documentation',
            ],
            'paths' => [
                /*
                 * Edit to include full URL in ui for assets
                 */
                'use_absolute_path' => env('L5_SWAGGER_USE_ABSOLUTE_PATH', true),

                /*
                 * Edit to set path where swagger ui assets should be stored
                 */
                'swagger_ui_assets_path' => env('L5_SWAGGER_UI_ASSETS_PATH', 'vendor/swagger-api/swagger-ui/dist/'),

                /*
                 * File name of the generated json documentation file
                 */
                'docs_json' => 'api-docs.json',

                /*
                 * File name of the generated YAML documentation file
                 */
                'docs_yaml' => 'api-docs.yaml',

                /*
                 * Set this to \`json\` or \`yaml\` to determine which documentation file to use in UI
                 */
                'format_to_use_for_docs' => env('L5_FORMAT_TO_USE_FOR_DOCS', 'json'),

                /*
                 * Absolute paths to directory containing the swagger annotations are stored.
                 */
                'annotations' => [
                    base_path('app'),
                ],
            ],
        ],
    ],
    'defaults' => [
        'routes' => [
            /*
             * Route for accessing parsed swagger annotations.
             */
            'docs' => 'docs',

            /*
             * Route for Oauth2 authentication callback.
             */
            'oauth2_callback' => 'api/oauth2-callback',

            /*
             * Middleware allows to prevent unexpected access to API documentation
             */
            'middleware' => [
                'api' => [],
                'asset' => [],
                'docs' => [],
                'oauth2_callback' => [],
            ],

            /*
             * Route Group options
             */
            'group_options' => [],
        ],

        'paths' => [
            /*
             * Absolute path to location where parsed annotations will be stored
             */
            'docs' => storage_path('api-docs'),

            /*
             * Absolute path to directory where to export views
             */
            'views' => base_path('resources/views/vendor/l5-swagger'),

            /*
             * Edit to set the api's base path
             */
            'base' => env('L5_SWAGGER_BASE_PATH', null),

            /*
             * Absolute path to directories that should be excluded from scanning
             * @deprecated Please use \`scanOptions.exclude\`
             * \`scanOptions.exclude\` overwrites this
             */
            'excludes' => [],
        ],

        'scanOptions' => [
            /**
             * Configuration for default processors. Allows to pass processors configuration to swagger-php.
             *
             * @link https://zircote.github.io/swagger-php/reference/processors.html
             */
            'default_processors_configuration' => [],

            /**
             * analyser: defaults to \\OpenApi\\StaticAnalyser .
             *
             * @see scan
             */
            'analyser' => null,

            /**
             * analysis: defaults to a new \\OpenApi\\Analysis .
             *
             * @see scan
             */
            'analysis' => null,

            /**
             * Custom query path processors classes.
             *
             * @link https://github.com/zircote/swagger-php/tree/master/Examples/processors/schema-query-parameter
             * @see scan
             */
            'processors' => [],

            /**
             * pattern: string $pattern File pattern(s) to scan (default: *.php) .
             *
             * @see scan
             */
            'pattern' => null,

            /*
             * Absolute path to directories that should be excluded from scanning
             * @note This option overwrites \`paths.excludes\`
             * @see \\OpenApi\\scan
             */
            'exclude' => [],

            /*
             * Allows to generate specs either for OpenAPI 3.0.0 or OpenAPI 3.1.0.
             * By default the spec will be in version 3.0.0
             */
            'open_api_spec_version' => env('L5_SWAGGER_OPEN_API_SPEC_VERSION', Generator::OPEN_API_DEFAULT_SPEC_VERSION),
        ],

        /*
         * API security definitions. Will be generated into documentation file.
         */
        'securityDefinitions' => [
            'securitySchemes' => [
                /*
                 * Examples of Security schemes
                 *
                 * Uncomment and adapt to enable authentication in Swagger UI:
                 *
                 * 'sanctum' => [
                 *     'type' => 'apiKey',
                 *     'description' => 'Enter token in format (Bearer <token>)',
                 *     'name' => 'Authorization',
                 *     'in' => 'header',
                 * ],
                 *
                 * 'passport' => [
                 *     'type' => 'oauth2',
                 *     'description' => 'Laravel passport oauth2 security.',
                 *     'in' => 'header',
                 *     'scheme' => 'https',
                 *     'flows' => [
                 *         'password' => [
                 *             'authorizationUrl' => config('app.url') . '/oauth/authorize',
                 *             'tokenUrl' => config('app.url') . '/oauth/token',
                 *             'refreshUrl' => config('app.url') . '/token/refresh',
                 *             'scopes' => [],
                 *         ],
                 *     ],
                 * ],
                 */
            ],
            'security' => [
                [
                    /*
                     * Uncomment to enable global security:
                     * 'sanctum' => [],
                     */
                ],
            ],
        ],

        /*
         * Set this to \`true\` in development mode so that docs would be regenerated on each request
         * Set this to \`false\` to disable swagger generation on production
         */
        'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),

        /*
         * Set this to \`true\` to generate a copy of documentation in yaml format
         */
        'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),

        /*
         * Edit to trust the proxy's ip address - needed for AWS Load Balancer
         * string[]
         */
        'proxy' => false,

        /*
         * Configs plugin allows to fetch external configs instead of passing them to SwaggerUIBundle.
         * See more at: https://github.com/swagger-api/swagger-ui#configs-plugin
         */
        'additional_config_url' => null,

        /*
         * Apply a sort to the operation list of each API. It can be 'alpha' (sort by paths alphanumerically),
         * 'method' (sort by HTTP method).
         * Default is the order returned by the server unchanged.
         */
        'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),

        /*
         * Pass the validatorUrl parameter to SwaggerUi init on the JS side.
         * A null value here disables validation.
         */
        'validator_url' => null,

        /*
         * Swagger UI configuration parameters
         */
        'ui' => [
            'display' => [
                'dark_mode' => env('L5_SWAGGER_UI_DARK_MODE', false),
                /*
                 * Controls the default expansion setting for the operations and tags. It can be :
                 * 'list' (expands only the tags),
                 * 'full' (expands the tags and operations),
                 * 'none' (expands nothing).
                 */
                'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),

                /*
                 * If set, enables filtering. The top bar will show an edit box that
                 * you can use to filter the tagged operations that are shown. Can be
                 * Boolean to enable or disable, or a string, in which case filtering
                 * will be enabled using that string as the filter expression. Filtering
                 * is case-sensitive matching the filter expression anywhere inside
                 * the tag.
                 */
                'filter' => env('L5_SWAGGER_UI_FILTERS', true),
            ],

            'authorization' => [
                /*
                 * If set to true, it persists authorization data, and it would not be lost on browser close/refresh
                 */
                'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),

                'oauth2' => [
                    /*
                     * If set to true, adds PKCE to AuthorizationCodeGrant flow
                     */
                    'use_pkce_with_authorization_code_grant' => false,
                ],
            ],
        ],

        /*
         * Constants which can be used in annotations
         */
        'constants' => [
            'L5_SWAGGER_CONST_HOST' => env('L5_SWAGGER_CONST_HOST', 'http://my-default-host.com'),
        ],
    ],
];
`
  }

  private generateSwaggerGuideMd(config: ProjectConfig): string {
    const title = config.name.charAt(0).toUpperCase() + config.name.slice(1)
    return `# Configuration Swagger — ${title}

> Documentation API auto-générée avec [L5-Swagger](https://github.com/DarkaOnLine/L5-Swagger) (OpenAPI 3.0)

## Accès à la documentation

Une fois le projet lancé (\`php artisan serve\`) :

- **Swagger UI** → http://localhost:8000/api/documentation
- **JSON OpenAPI** → http://localhost:8000/docs/api-docs.json

## Installation

Ces commandes sont déjà exécutées par \`setup.sh\` / \`setup.ps1\` / \`setup.bat\` :

\`\`\`bash
composer require darkaonline/l5-swagger --no-interaction
php artisan vendor:publish --provider "L5Swagger\\L5SwaggerServiceProvider"
composer update --no-interaction
php artisan l5-swagger:generate
\`\`\`

## Fichier de configuration

Le fichier \`config/l5-swagger.php\` est créé automatiquement par \`vendor:publish\` (déjà exécuté via \`setup.sh\`). Les clés essentielles à adapter :

\`\`\`php
// Titre affiché dans Swagger UI
'title' => '${title} API',

// Dossier scanné pour les annotations @OA\\*
'annotations' => [
    base_path('app'),
],

// Activer la régénération automatique en développement
// Dans .env : L5_SWAGGER_GENERATE_ALWAYS=true
'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
\`\`\`

Pour activer l'authentification (Sanctum), décommenter dans \`config/l5-swagger.php\` :

\`\`\`php
'securitySchemes' => [
    'sanctum' => [
        'type' => 'apiKey',
        'description' => 'Enter token in format (Bearer <token>)',
        'name' => 'Authorization',
        'in' => 'header',
    ],
],
'security' => [
    ['sanctum' => []],
],
\`\`\`

## Variables d'environnement \`.env\`

\`\`\`dotenv
L5_SWAGGER_GENERATE_ALWAYS=true
L5_SWAGGER_CONST_HOST=http://localhost:8000
L5_SWAGGER_USE_ABSOLUTE_PATH=true
\`\`\`

## Regénérer la documentation

\`\`\`bash
php artisan l5-swagger:generate
\`\`\`

## Exemple d'annotation sur un Controller

\`\`\`php
/**
 * @OA\\Info(title="${title} API", version="1.0")
 */

/**
 * @OA\\Get(
 *     path="/api/users",
 *     summary="Lister les utilisateurs",
 *     tags={"Users"},
 *     security={{"sanctum":{}}},
 *     @OA\\Response(
 *         response=200,
 *         description="Liste des utilisateurs"
 *     )
 * )
 */
public function index() { ... }

/**
 * @OA\\Post(
 *     path="/api/users",
 *     summary="Créer un utilisateur",
 *     tags={"Users"},
 *     security={{"sanctum":{}}},
 *     @OA\\RequestBody(
 *         @OA\\JsonContent(ref="#/components/schemas/StoreUserRequest")
 *     ),
 *     @OA\\Response(response=201, description="Utilisateur créé")
 * )
 */
public function store(StoreUserRequest $request) { ... }
\`\`\`

## Commandes utiles

\`\`\`bash
# Regénérer la documentation OpenAPI
php artisan l5-swagger:generate

# Ouvrir la documentation dans le navigateur
# → http://localhost:8000/api/documentation
\`\`\`
`
  }

  private laravelAuthController(auth: string, config: ProjectConfig): string {
    const strictLine  = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''
    const isPassport  = auth === 'passport'
    const tokenCreate = isPassport
      ? `$token = $user->createToken('auth_token')->accessToken;`
      : `$token = $user->createToken('auth_token')->plainTextToken;`
    const tokenRevoke = isPassport
      ? `Auth::user()->token()->revoke();`
      : `Auth::user()->currentAccessToken()->delete();`
    return `<?php
${strictLine}
namespace App\\Http\\Controllers\\Auth;

use App\\Http\\Controllers\\Controller;
use App\\Http\\Requests\\Auth\\LoginRequest;
use App\\Http\\Requests\\Auth\\RegisterRequest;
use App\\Models\\User;
use Illuminate\\Http\\JsonResponse;
use Illuminate\\Support\\Facades\\Auth;
use Illuminate\\Support\\Facades\\Hash;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): JsonResponse
    {
        $user = User::create([
            'name'     => $request->name,
            'email'    => $request->email,
            'password' => Hash::make($request->password),
        ]);

        ${tokenCreate}

        return response()->json([
            'message' => 'Account created successfully',
            'token'   => $token,
            'user'    => $user->only('id', 'name', 'email'),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        if (!Auth::attempt($request->only('email', 'password'))) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user  = Auth::user();
        ${tokenCreate}

        return response()->json([
            'token' => $token,
            'user'  => $user->only('id', 'name', 'email'),
        ]);
    }

    public function logout(): JsonResponse
    {
        ${tokenRevoke}

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(): JsonResponse
    {
        return response()->json(Auth::user());
    }
}
`
  }

  private laravelLoginRequest(config: ProjectConfig): string {
    const strictLine = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''
    return `<?php
${strictLine}
namespace App\\Http\\Requests\\Auth;

use Illuminate\\Foundation\\Http\\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
        ];
    }
}
`
  }

  private laravelRegisterRequest(config: ProjectConfig): string {
    const strictLine = config.laravel?.use_strict_types !== false ? '\ndeclare(strict_types=1);\n' : ''
    return `<?php
${strictLine}
namespace App\\Http\\Requests\\Auth;

use Illuminate\\Foundation\\Http\\FormRequest;
use Illuminate\\Validation\\Rules\\Password;

class RegisterRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'name'     => ['required', 'string', 'max:255'],
            'email'    => ['required', 'email', 'unique:users,email'],
            'password' => ['required', 'confirmed', Password::defaults()],
        ];
    }
}
`
  }
}
