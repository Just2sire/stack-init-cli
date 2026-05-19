import fs from 'node:fs'
import path from 'node:path'
import Handlebars from 'handlebars'
import type { Model, ProjectConfig } from '@stack-init/schema'
import { configureHandlebars } from './handlebars'
import { fieldToCast, fieldToValidationRule, fieldToFaker } from '../../utils/field-helpers'
import { modelToTableName, modelToRouteName, modelToVarName, migrationTimestamp, pluralize } from '../../utils/naming'
import { type GeneratedFile } from '../../utils/fs'
import { resolveTemplatesDir } from '../../utils/template-path'

const TEMPLATES_DIR = resolveTemplatesDir('laravel')

// Tables créées par les migrations par défaut de Laravel — on évite de régénérer Schema::create
const LARAVEL_DEFAULT_TABLES = new Set([
  'users', 'password_reset_tokens', 'failed_jobs', 'personal_access_tokens',
])

// Champs déjà présents dans ces migrations par défaut
const LARAVEL_DEFAULT_FIELDS: Record<string, Set<string>> = {
  users:                  new Set(['name', 'email', 'email_verified_at', 'password', 'remember_token']),
  password_reset_tokens:  new Set(['email', 'token']),
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

    const laravelAuth = config.laravel?.auth ?? 'none'

    for (let i = 0; i < config.models.length; i++) {
      const r = await this.generateModel(config.models[i], config, i)
      result.files.push(...r.files)
      result.warnings.push(...r.warnings)
    }

    // Auth service generation
    if (laravelAuth !== 'none') {
      const hasUserModel = config.models.some(m => m.name.toLowerCase() === 'user')
      if (!hasUserModel) {
        result.warnings.push('Auth is enabled but no "User" model found. The AuthController references the User model — add one or adjust manually.')
      }
      result.files.push(...this.generateAuthFiles(config))
    }

    // .env.example
    result.files.push(this.generateEnvExample(config))

    // Routes
    const modelsWithRoutes = config.models.filter(m => m.generate.routes)
    if (modelsWithRoutes.length > 0 || laravelAuth !== 'none') {
      const routePath = path.join(projectRoot, 'routes/api.php')
      const routeCtx = {
        models: modelsWithRoutes.map(m => ({
          name: m.name,
          routeName: modelToRouteName(m.name),
          generate: m.generate,
        })),
      }

      if (fs.existsSync(routePath)) {
        let content = fs.readFileSync(routePath, 'utf-8')
        for (const model of routeCtx.models) {
          const resourceLine = `Route::apiResource('${model.routeName}', ${model.name}Controller::class);`
          const useLine = `use App\\Http\\Controllers\\Api\\${model.name}Controller;`

          if (!content.includes(resourceLine)) {
            const marker = '// @stack-init-routes-end'
            if (content.includes(marker)) {
              content = content.replace(marker, `${resourceLine}\n${marker}`)
            } else {
              content = content.trimEnd() + `\n${resourceLine}\n`
            }
          }

          if (!content.includes(useLine)) {
            const lines = content.split('\n')
            const lastUseIdx = lines.reduce((last, line, i) =>
              line.trimStart().startsWith('use ') ? i : last, -1)
            if (lastUseIdx >= 0) {
              lines.splice(lastUseIdx + 1, 0, useLine)
              content = lines.join('\n')
            } else {
              content = content.replace('<?php', `<?php\n\n${useLine}`)
            }
          }
        }

        if (laravelAuth !== 'none') {
          const authUse    = `use App\\Http\\Controllers\\Auth\\AuthController;`
          const authRoutes = `Route::prefix('auth')->group(function () {\n    Route::post('register', [AuthController::class, 'register']);\n    Route::post('login',    [AuthController::class, 'login']);\n    Route::middleware('auth:sanctum')->group(function () {\n        Route::post('logout', [AuthController::class, 'logout']);\n        Route::get('me',      [AuthController::class, 'me']);\n    });\n});`
          if (!content.includes(authUse)) {
            const lines = content.split('\n')
            const lastUseIdx = lines.reduce((last, line, i) =>
              line.trimStart().startsWith('use ') ? i : last, -1)
            if (lastUseIdx >= 0) {
              lines.splice(lastUseIdx + 1, 0, authUse)
              content = lines.join('\n')
            } else {
              content = content.replace('<?php', `<?php\n\n${authUse}`)
            }
          }
          if (!content.includes('AuthController::class')) {
            const marker = '// @stack-init-routes-end'
            content = content.includes(marker)
              ? content.replace(marker, `${authRoutes}\n${marker}`)
              : content.trimEnd() + `\n\n${authRoutes}\n`
          }
        }

        result.files.push({ outputPath: 'routes/api.php', content })
      } else {
        result.files.push({
          outputPath: 'routes/api.php',
          content: this.render('overlays/routes/api.php.hbs', routeCtx),
        })
        if (laravelAuth !== 'none') {
          result.files.push(...this.generateAuthRoutesFile())
        }
      }
    }

    // DatabaseSeeder
    const modelsWithSeeder = config.models.filter(m => m.generate.seeder)
    if (modelsWithSeeder.length > 0) {
      const seederPath = path.join(projectRoot, 'database/seeders/DatabaseSeeder.php')
      const seederNames = modelsWithSeeder.map(m => `${m.name}Seeder::class`)

      if (fs.existsSync(seederPath)) {
        let content = fs.readFileSync(seederPath, 'utf-8')
        for (const seeder of seederNames) {
          if (!content.includes(seeder)) {
            // Tentative d'insertion dans le tableau $this->call([...])
            if (content.includes('$this->call([')) {
              content = content.replace('$this->call([', `$this->call([\n            ${seeder},`)
            } else {
              result.warnings.push(`Impossible d'injecter automatiquement ${seeder} dans DatabaseSeeder.php. Ajoutez-le manuellement.`)
            }
          }
        }
        result.files.push({ outputPath: 'database/seeders/DatabaseSeeder.php', content })
      } else {
        const seederCtx = { seeders: seederNames }
        result.files.push({
          outputPath: 'database/seeders/DatabaseSeeder.php',
          content: this.render('overlays/seeder/DatabaseSeeder.php.hbs', seederCtx),
        })
      }
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
      const tableName = ctx.tableName as string
      if (LARAVEL_DEFAULT_TABLES.has(tableName)) {
        // Laravel fournit déjà une migration pour cette table — générer uniquement les champs supplémentaires
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

  // ── Auth generation ───────────────────────────────────────────────

  private generateEnvExample(config: ProjectConfig): GeneratedFile {
    const db    = config.laravel?.db_engine ?? 'mysql'
    const auth  = config.laravel?.auth ?? 'none'
    const name  = config.name

    const dbHost = db === 'pgsql' ? 'DB_CONNECTION=pgsql\nDB_HOST=127.0.0.1\nDB_PORT=5432' : `DB_CONNECTION=${db}\nDB_HOST=127.0.0.1\nDB_PORT=${db === 'mysql' ? '3306' : '5432'}`

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
      ...(auth !== 'none' && auth !== 'breeze' && auth !== 'jetstream' ? [] : []),
    ]

    return { outputPath: '.env.example', content: lines.join('\n') + '\n' }
  }

  private generateAuthFiles(config: ProjectConfig): GeneratedFile[] {
    const auth = config.laravel?.auth ?? 'sanctum'
    return [
      { outputPath: 'app/Http/Controllers/Auth/AuthController.php', content: this.laravelAuthController(auth) },
      { outputPath: 'app/Http/Requests/Auth/LoginRequest.php',      content: this.laravelLoginRequest() },
      { outputPath: 'app/Http/Requests/Auth/RegisterRequest.php',   content: this.laravelRegisterRequest() },
    ]
  }

  private generateAuthRoutesFile(): GeneratedFile[] {
    return [{
      outputPath: 'routes/auth.php',
      content: `<?php

use App\\Http\\Controllers\\Auth\\AuthController;
use Illuminate\\Support\\Facades\\Route;

Route::prefix('auth')->group(function () {
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login',    [AuthController::class, 'login']);
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me',      [AuthController::class, 'me']);
    });
});
`,
    }]
  }

  private laravelAuthController(auth: string): string {
    const guardName = auth === 'passport' ? 'api' : 'sanctum'
    return `<?php

declare(strict_types=1);

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

        $token = $user->createToken('auth_token')->plainTextToken;

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
        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user'  => $user->only('id', 'name', 'email'),
        ]);
    }

    public function logout(): JsonResponse
    {
        Auth::user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(): JsonResponse
    {
        return response()->json(Auth::user());
    }
}
`
  }

  private laravelLoginRequest(): string {
    return `<?php

declare(strict_types=1);

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

  private laravelRegisterRequest(): string {
    return `<?php

declare(strict_types=1);

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
