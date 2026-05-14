# Plan d'Implémentation — `stack-init-cli`

> CLI Node.js publié sur npm. L'utilisateur lance `npx stack-init generate` dans son projet backend pour scaffolder les fichiers à partir d'un fichier `stack-init.yaml`.

---

## État Actuel

Le CLI supporte aujourd'hui uniquement **Laravel**. Il lit un fichier YAML, le valide via `@stack-init/schema`, et génère les fichiers PHP via des templates Handlebars. 21 tests Vitest passent. Les fonctionnalités de base sont stables.

Ce qui manque : support d'autres stacks backend (Express, NestJS, Django, Rails), la commande `add`, la mise à jour des routes, et quelques améliorations de robustesse sur le générateur Laravel existant.

---

## Architecture du Monorepo CLI

```
stack-init-cli/
├── packages/
│   ├── schema/                    ← @stack-init/schema (source de vérité)
│   │   ├── src/
│   │   │   ├── field-types.ts
│   │   │   ├── models.schema.ts
│   │   │   ├── laravel.schema.ts
│   │   │   ├── express.schema.ts      ← à créer
│   │   │   ├── nest.schema.ts         ← à créer
│   │   │   ├── architecture.schema.ts ← à créer
│   │   │   ├── project.schema.ts
│   │   │   └── index.ts
│   │   └── tests/
│   └── cli/
│       ├── src/
│       │   ├── index.ts
│       │   ├── commands/
│       │   │   ├── generate.ts
│       │   │   └── add.ts             ← à créer
│       │   ├── utils/
│       │   │   ├── naming.ts
│       │   │   └── field-helpers.ts
│       │   └── generators/
│       │       ├── laravel/           ← existant, à compléter
│       │       ├── express/           ← à créer
│       │       └── nest/              ← à créer
│       └── templates/
│           ├── laravel/               ← existant
│           ├── express/               ← à créer
│           └── nest/                  ← à créer
├── stack-init.yaml
└── pnpm-workspace.yaml
```

---

## Phase 1 — Complétion du Générateur Laravel

> Objectif : rendre le générateur Laravel production-ready avant d'attaquer les nouveaux stacks.

### 1.1 Routes API (`routes/api.php`)

**Fichier :** `src/generators/laravel/routes.ts`

Le générateur doit détecter si `routes/api.php` existe et se comporter différemment selon le cas :

- **Fichier absent** → générer un `routes/api.php` complet avec toutes les routes
- **Fichier présent** → insérer uniquement les nouvelles routes sans écraser l'existant (mode append intelligent avec commentaire `// stack-init: [ModelName]`)

Template à générer :
```php
// routes/api.php
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\PostController;

Route::apiResource('users', UserController::class);
Route::apiResource('posts', PostController::class);
```

Toggle dans le YAML : `generate.routes: true` (défaut `false` pour ne pas casser les projets existants).

### 1.2 DatabaseSeeder

**Fichier :** `src/generators/laravel/seeder.ts`

Générer ou mettre à jour `database/seeders/DatabaseSeeder.php` pour appeler les seeders de chaque modèle qui a `generate.seeder: true`.

```php
public function run(): void
{
    $this->call([
        UserSeeder::class,
        PostSeeder::class,
    ]);
}
```

### 1.3 Commande `stack-init add <ModelName>`

**Fichier :** `src/commands/add.ts`

Permet d'ajouter un seul modèle à un projet déjà scaffoldé sans tout regénérer.

Flux :
1. Lire le `stack-init.yaml` existant
2. Vérifier que le modèle n'existe pas déjà (erreur claire sinon)
3. Demander les champs interactivement (ou lire depuis `--fields` en CLI)
4. Générer uniquement les fichiers de ce modèle
5. Mettre à jour `routes/api.php` et `DatabaseSeeder.php` si présents

```bash
stack-init add Post
stack-init add Post --fields "title:string,body:longText,user_id:foreignId:users"
```

### 1.4 Commande `stack-init rollback`

**Fichier :** `src/commands/rollback.ts`

Maintenir un fichier `.stack-init-manifest.json` à la racine qui liste tous les fichiers générés avec leur timestamp. `rollback` supprime les fichiers de la dernière génération.

```json
{
  "lastGeneration": "2026-05-14T12:00:00Z",
  "files": [
    "app/Models/Post.php",
    "database/migrations/2026_05_14_create_posts_table.php"
  ]
}
```

### 1.5 Amélioration des messages d'erreur

Les erreurs Zod actuelles sont affichées brutes. Les reformater en messages lisibles :

```
✗ Erreur de configuration (3 problèmes détectés)

  [models.0.name] "blogPost" n'est pas en PascalCase → utilisez "BlogPost"
  [models.1.fields.2.type] Type "Text" inconnu → utilisez "text" (minuscule)
  [models.1.fields.2] foreignId "category_id" référence "categories" mais
  aucun modèle "Category" n'est défini dans votre configuration
```

---

## Phase 2 — Extension du Schema (`packages/schema`)

> Toute nouvelle fonctionnalité doit d'abord exister dans le schema. Le CLI et le web consomment les mêmes types.

### 2.1 `architecture.schema.ts`

```typescript
export const BackendArchitectureSchema = z.enum([
  'mvc',           // controllers + models + routes séparés
  'layered',       // routes → services → repositories → models
  'feature-based', // src/features/users/, src/features/posts/...
  'minimal',       // tout dans un seul niveau
]);

export const FrontendArchitectureSchema = z.enum([
  'feature-first',
  'domain-driven',
  'mvvm',
  'mvc',
  'atomic-design',
  'minimal',
]);
```

### 2.2 `express.schema.ts`

```typescript
export const ExpressOrmSchema = z.enum([
  'prisma',
  'sequelize',
  'typeorm',
  'mongoose',
  'knex',
  'none',
]);

export const ExpressConfigSchema = z.object({
  architecture:  BackendArchitectureSchema.default('layered'),
  orm:           ExpressOrmSchema.default('prisma'),
  db_engine:     z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  auth:          z.enum(['jwt', 'session', 'none']).default('none'),
  validation:    z.enum(['zod', 'joi', 'express-validator', 'none']).default('zod'),
  runner:        z.enum(['makefile', 'bash', 'none']).default('makefile'),
  middlewares:   z.array(z.enum([
    'cors', 'morgan', 'rate-limit', 'helmet', 'compression', 'error-handler'
  ])).default(['cors', 'morgan', 'error-handler']),
  swagger:       z.boolean().default(false),
  typescript:    z.boolean().default(true),
  port:          z.number().default(3000),
});

export type ExpressConfig = z.infer<typeof ExpressConfigSchema>;
```

### 2.3 `nest.schema.ts`

```typescript
export const NestArchitectureSchema = z.enum([
  'modular',      // un module par entité (recommandé)
  'cqrs',         // Commands + Queries + EventBus
  'microservices', // transporter TCP/Redis, services séparés
]);

export const NestConfigSchema = z.object({
  architecture:  NestArchitectureSchema.default('modular'),
  orm:           z.enum(['typeorm', 'prisma', 'mongoose', 'drizzle']).default('typeorm'),
  db_engine:     z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  auth:          z.enum(['jwt', 'api-key', 'none']).default('none'),
  swagger:       z.boolean().default(true),
  validation:    z.boolean().default(true),   // class-validator + ValidationPipe global
  serialization: z.boolean().default(true),   // class-transformer + @Exclude()
  throttling:    z.boolean().default(false),
  runner:        z.enum(['makefile', 'bash', 'none']).default('makefile'),
});

export type NestConfig = z.infer<typeof NestConfigSchema>;
```

### 2.4 Extension de `project.schema.ts`

```typescript
export const StackSchema = z.enum([
  // Backend pur (CLI)
  'laravel',
  'express',
  'nestjs',
  'django',   // futur
  'rails',    // futur
  // Frontend pur (ZIP — géré par le web uniquement)
  'react',
  'nextjs',
  // Full-stack (CLI + ZIP)
  'nextjs-fullstack',
  'laravel+react',
  'laravel+nextjs',
  'express+react',
]);

// Validation croisée étendue dans superRefine :
// - stack 'express' → config express obligatoire
// - stack 'nestjs'  → config nest obligatoire
// - stack 'express' avec orm 'mongoose' → db_engine doit être 'mongodb'
// - stack 'nestjs' avec architecture 'cqrs' → swagger recommandé (warning, pas erreur)
```

### 2.5 Extension des `generate` options par modèle

Ajouter les toggles manquants :

```typescript
export const GenerateOptionsSchema = z.object({
  // Existants (Laravel)
  migration:   z.boolean().default(true),
  controller:  z.boolean().default(true),
  resource:    z.boolean().default(true),
  request:     z.boolean().default(true),
  policy:      z.boolean().default(false),
  factory:     z.boolean().default(true),
  seeder:      z.boolean().default(false),
  swagger:     z.boolean().default(false),
  tests:       z.boolean().default(true),
  service:     z.boolean().default(false),
  repository:  z.boolean().default(false),
  // Nouveaux
  routes:      z.boolean().default(false),  // Laravel : maj routes/api.php
  dto:         z.boolean().default(true),   // NestJS : CreateDto + UpdateDto
  module:      z.boolean().default(true),   // NestJS : module dédié
  schema:      z.boolean().default(true),   // Express Prisma : bloc model dans schema.prisma
});
```

### 2.6 Tests du schema

Étendre la suite Vitest pour couvrir les nouveaux schemas :

- Validation `ExpressConfig` : orm `mongoose` + db `postgresql` → erreur
- Validation `NestConfig` : architecture `microservices` sans transporter → warning
- Validation croisée : stack `express` sans config `express` → erreur claire
- `foreignId` dans un modèle Express avec ORM Prisma → vérifie que `references` est valide

---

## Phase 3 — Générateur Express

**Dossier :** `src/generators/express/`

### 3.1 Architecture du générateur

```
src/generators/express/
├── index.ts          ← ExpressGenerator (même pattern que LaravelGenerator)
├── prisma.ts         ← génère schema.prisma
├── mongoose.ts       ← génère les schemas Mongoose
├── sequelize.ts      ← génère les modèles Sequelize
└── handlebars.ts     ← helpers Handlebars spécifiques Express
```

### 3.2 Fichiers générés selon la config

**Architecture `layered` avec Prisma (cas recommandé) :**

```
src/
├── routes/
│   ├── index.ts              ← router principal (importe tous les routers)
│   ├── user.routes.ts
│   └── post.routes.ts
├── controllers/
│   ├── user.controller.ts
│   └── post.controller.ts
├── services/
│   ├── user.service.ts
│   └── post.service.ts
├── repositories/             ← si generate.repository: true
│   ├── user.repository.ts
│   └── post.repository.ts
├── middlewares/
│   ├── auth.ts               ← si auth: jwt
│   ├── validate.ts           ← si validation: zod
│   ├── errorHandler.ts       ← toujours
│   └── rateLimiter.ts        ← si middlewares inclut rate-limit
├── schemas/                  ← schemas Zod de validation
│   ├── user.schema.ts
│   └── post.schema.ts
├── types/
│   ├── user.types.ts
│   └── post.types.ts
└── app.ts                    ← setup Express + middlewares
prisma/
└── schema.prisma             ← tous les modèles Prisma
```

**Architecture `feature-based` :**

```
src/
├── features/
│   ├── users/
│   │   ├── users.routes.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   └── users.schema.ts
│   └── posts/
│       ├── posts.routes.ts
│       └── ...
└── app.ts
```

### 3.3 Mappage des types de champs → Prisma

```typescript
// src/utils/field-helpers-express.ts

export function fieldToPrismaType(field: NamedField): string {
  const map: Record<string, string> = {
    string:    'String',
    integer:   'Int',
    bigInteger:'BigInt',
    boolean:   'Boolean',
    decimal:   'Decimal',
    float:     'Float',
    timestamp: 'DateTime',
    date:      'DateTime',
    json:      'Json',
    text:      'String',
    longText:  'String',
    uuid:      'String   @db.Uuid',
    enum:      '',  // géré séparément → enum Prisma
    foreignId: '',  // géré séparément → relation Prisma
  };
  // ...
}

export function fieldToPrismaDecorators(field: NamedField): string {
  const decorators: string[] = [];
  if (field.unique)   decorators.push('@unique');
  if (field.default)  decorators.push(`@default(${field.default})`);
  if (field.nullable) return `${fieldToPrismaType(field)}?`;
  return fieldToPrismaType(field);
}
```

### 3.4 Templates Handlebars Express

```
templates/express/
├── base/
│   ├── app.ts.hbs            ← setup Express
│   ├── server.ts.hbs         ← point d'entrée
│   └── prisma-client.ts.hbs  ← singleton PrismaClient
├── layered/
│   ├── route.ts.hbs
│   ├── controller.ts.hbs
│   ├── service.ts.hbs
│   └── repository.ts.hbs
├── feature/
│   └── feature.ts.hbs        ← tout en un par feature
├── middlewares/
│   ├── auth.ts.hbs
│   ├── validate.ts.hbs
│   └── errorHandler.ts.hbs
├── schemas/
│   └── zod-schema.ts.hbs
├── prisma/
│   └── schema.prisma.hbs
└── makefile/
    └── Makefile.hbs
```

### 3.5 Makefile Express généré

```makefile
setup: install db-push seed
install:
    npm install
    cp .env.example .env
db-push:        # prisma
    npx prisma db push
db-migrate:
    npx prisma migrate dev
seed:
    npx ts-node src/seed.ts
dev:
    npx ts-node-dev src/server.ts
build:
    npx tsc
start:
    node dist/server.js
test:
    npx vitest run
```

---

## Phase 4 — Générateur NestJS

**Dossier :** `src/generators/nest/`

### 4.1 Fichiers générés (architecture `modular` avec TypeORM)

```
src/
├── app.module.ts             ← importe tous les modules
├── main.ts                   ← bootstrap NestFactory
├── users/
│   ├── users.module.ts
│   ├── users.controller.ts
│   ├── users.service.ts
│   ├── entities/
│   │   └── user.entity.ts    ← @Entity(), @Column()...
│   └── dto/
│       ├── create-user.dto.ts
│       └── update-user.dto.ts
└── posts/
    ├── posts.module.ts
    ├── posts.controller.ts
    └── ...
```

### 4.2 Mappage des types de champs → TypeORM

```typescript
export function fieldToTypeOrmDecorator(field: NamedField): string {
  const typeMap: Record<string, string> = {
    string:    "@Column({ type: 'varchar', length: {{length}} })",
    integer:   "@Column({ type: 'int' })",
    boolean:   "@Column({ type: 'boolean' })",
    decimal:   "@Column({ type: 'decimal', precision: {{precision}}, scale: {{scale}} })",
    timestamp: "@Column({ type: 'timestamp' })",
    enum:      "@Column({ type: 'enum', enum: {{EnumName}} })",
    foreignId: "@ManyToOne(() => {{Model}}, ({{model}}) => {{model}}.{{plural}})",
  };
  // ...
}

export function fieldToClassValidatorDecorator(field: NamedField): string[] {
  const decorators: string[] = [];
  if (!field.nullable) decorators.push('@IsNotEmpty()');
  switch (field.type) {
    case 'string':    decorators.push('@IsString()', `@MaxLength(${field.length ?? 255})`); break;
    case 'integer':   decorators.push('@IsInt()'); break;
    case 'boolean':   decorators.push('@IsBoolean()'); break;
    case 'enum':      decorators.push(`@IsEnum(${field.name}Enum)`); break;
    case 'foreignId': decorators.push('@IsUUID()'); break;
  }
  return decorators;
}
```

### 4.3 Templates Handlebars NestJS

```
templates/nest/
├── base/
│   ├── app.module.ts.hbs
│   └── main.ts.hbs
├── module/
│   ├── module.ts.hbs
│   ├── controller.ts.hbs
│   ├── service.ts.hbs
│   └── entity.ts.hbs
├── dto/
│   ├── create.dto.ts.hbs
│   └── update.dto.ts.hbs
├── cqrs/                     ← si architecture: cqrs
│   ├── commands/
│   │   └── create-command.ts.hbs
│   └── queries/
│       └── get-query.ts.hbs
└── makefile/
    └── Makefile.hbs
```

### 4.4 Gestion du Swagger NestJS

Si `swagger: true`, chaque DTO reçoit les décorateurs `@ApiProperty()` et `main.ts` inclut le setup `SwaggerModule` :

```typescript
// main.ts généré
const config = new DocumentBuilder()
  .setTitle('{{projectName}} API')
  .setVersion('1.0')
  .addBearerAuth()
  .build();
const document = SwaggerModule.createDocument(app, config);
SwaggerModule.setup('api/docs', app, document);
```

---

## Phase 5 — Orchestration Multi-Stack dans `generate.ts`

**Fichier :** `src/commands/generate.ts`

```typescript
export async function generateCommand(options: GenerateOptions): Promise<void> {
  // 1. Lecture + validation YAML (inchangé)
  const raw  = readYaml(options.config);
  const result = parseProjectConfig(raw);
  if (!result.success) { displayErrors(result.errors); process.exit(1); }
  const config = result.data;

  // 2. Routing vers le bon générateur
  const generators: BaseGenerator[] = [];

  if (config.stack.includes('laravel')) {
    generators.push(new LaravelGenerator());
  }
  if (config.stack.includes('express')) {
    generators.push(new ExpressGenerator());
  }
  if (config.stack === 'nestjs') {
    generators.push(new NestGenerator());
  }

  // 3. Génération parallèle si plusieurs stacks
  const allFiles = (await Promise.all(
    generators.map(g => g.generate(config))
  )).flat();

  // 4. Écriture ou dry-run
  if (options.dryRun) {
    displayDryRun(allFiles);
  } else {
    writeFiles(allFiles, options.output);
    writeManifest(allFiles);   // pour rollback
    displaySummary(allFiles);
  }
}
```

### Interface `BaseGenerator`

```typescript
interface BaseGenerator {
  generate(config: ProjectConfig): Promise<GeneratedFile[]>;
}

interface GeneratedFile {
  path:    string;   // chemin relatif (ex: "app/Models/Post.php")
  content: string;   // contenu du fichier
  stack:   string;   // 'laravel' | 'express' | 'nestjs'
}
```

---

## Phase 6 — Qualité & Publication

### 6.1 Tests à ajouter

**Schema (Vitest) :**
- Suite complète pour `ExpressConfigSchema` (40+ cas)
- Suite complète pour `NestConfigSchema` (30+ cas)
- Tests de validations croisées multi-stack
- Tests de `validateForeignKeys` avec les nouveaux stacks

**CLI (tests d'intégration) :**
- `generate --dry-run` sur un YAML Express → vérifier la liste de fichiers attendue
- `generate --dry-run` sur un YAML NestJS → vérifier la liste
- `add Post` sur un projet existant → vérifier que les autres fichiers ne sont pas touchés
- `rollback` → vérifier que les fichiers du manifest sont supprimés

### 6.2 Amélioration du DX terminal

Affichage final après génération :

```
✓ stack-init — 31 fichiers générés en 1.2s

  Laravel (18 fichiers)
  ├── app/Models/          User.php  Post.php  Comment.php
  ├── database/migrations/ 3 fichiers
  ├── app/Http/            9 fichiers (controllers, resources, requests)
  └── tests/Feature/       2 fichiers

  Express (13 fichiers)         ← si stack mixte
  ├── src/routes/          3 fichiers
  ├── src/services/        3 fichiers
  └── prisma/schema.prisma

  Prochaine étape :
  → Laravel : make setup
  → Express : npm install && npx prisma db push && npm run dev
```

### 6.3 Publication npm

```json
// packages/cli/package.json
{
  "name": "stack-init",
  "version": "1.0.0",
  "bin": { "stack-init": "./dist/index.js" },
  "files": ["dist/", "templates/"],
  "engines": { "node": ">=18.0.0" }
}
```

Checklist avant publication :
- [ ] `npm pack` → vérifier que `templates/` est inclus dans le bundle
- [ ] Test `npx stack-init@latest generate --dry-run` depuis un dossier vierge
- [ ] README avec GIF de démo
- [ ] Changelog

---

## Récapitulatif des Priorités

| Priorité | Tâche | Effort estimé |
|---|---|---|
| **P0** | Complétion Laravel (routes, seeder, messages erreur) | 2-3 jours |
| **P0** | Extension schema (Express, NestJS, architecture) | 2 jours |
| **P0** | Générateur Express (Prisma + layered) | 4-5 jours |
| **P1** | Générateur NestJS (modular + TypeORM) | 4-5 jours |
| **P1** | Commande `add <ModelName>` | 2 jours |
| **P1** | Orchestration multi-stack dans `generate.ts` | 1 jour |
| **P2** | Commande `rollback` | 1 jour |
| **P2** | Tests d'intégration CLI | 2 jours |
| **P2** | DX terminal amélioré | 1 jour |
| **P3** | Générateur Django | 5+ jours |
| **P3** | Générateur Rails | 5+ jours |
| **P3** | Publication npm + README | 1 jour |
