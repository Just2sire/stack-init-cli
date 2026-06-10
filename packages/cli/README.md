# stack-init-cli

**Scaffold complete backend & frontend projects from a single YAML file — or directly from the terminal.**

`stack-init-cli` generates models, migrations, controllers, services, routes, DTOs, tests and more — for Laravel, Express, NestJS, FastAPI, Django, and Next.js/React — without writing boilerplate.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
  - [Option A — Interactive CLI Wizard](#option-a--interactive-cli-wizard)
  - [Option B — From a YAML file](#option-b--from-a-yaml-file)
- [YAML Configuration](#yaml-configuration)
  - [Stacks](#stacks)
  - [Models & Fields](#models--fields)
  - [Field Types](#field-types)
  - [Field Modifiers](#field-modifiers)
  - [Relations](#relations)
  - [Generate Flags](#generate-flags)
- [Framework Options](#framework-options)
  - [Laravel](#laravel)
  - [Express](#express)
  - [NestJS](#nestjs)
  - [FastAPI](#fastapi)
  - [React](#react)
- [Commands](#commands)
  - [init](#init)
  - [generate](#generate)
  - [add](#add)
  - [rollback](#rollback)
  - [validate](#validate)
  - [diff](#diff)
  - [update-versions](#update-versions)
- [Generated Files](#generated-files)
- [Examples](#examples)

---

## Installation

```bash
npm install -g stack-init-cli
```

**Requirements:** Node.js 18+

Or use without installing:

```bash
# Interactive wizard (no YAML needed)
npx create-stack-init

# Generate from an existing YAML
npm install -g stack-init-cli
stack-init generate
```

---

## Quick Start

### Option A — Interactive CLI Wizard

No YAML file needed. The wizard asks a few questions and generates your project:

```bash
npx create-stack-init

# Or with pre-filled options
npx create-stack-init my-app --preset pern
npx create-stack-init my-api --preset laravel-api --yes
```

### Option B — From a YAML file

**1. Create a `stack-init.yaml` at the root of your project:**

```yaml
name: my-api
version: 0.1.0
stack: laravel

laravel:
  php_version: "8.4"
  laravel_version: "12"
  pattern: api-only
  auth: sanctum
  db_engine: mysql

models:
  - name: Post
    fields:
      - name: title
        type: string
      - name: body
        type: text
      - name: published_at
        type: timestamp
        nullable: true
    generate:
      migration: true
      controller: true
      resource: true
      request: true
      factory: true
      tests: true
```

**2. Run:**

```bash
stack-init generate
```

---

## YAML Configuration

### Top-level keys

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Project name (kebab-case) |
| `description` | string | no | Short project description |
| `version` | string | no | Semantic version (default: `0.1.0`) |
| `stack` | string | yes | Target stack (see [Stacks](#stacks)) |
| `models` | Model[] | yes | List of data models (min. 1 for `generate`) |
| `services` | string[] | no | Optional services (auth, email, cache, queue…) |
| `laravel` | object | if stack includes Laravel | Laravel-specific options |
| `express` | object | if stack includes Express | Express-specific options |
| `nestjs` | object | if stack includes NestJS | NestJS-specific options |
| `fastapi` | object | if stack includes FastAPI | FastAPI-specific options |
| `react` | object | if stack includes React | React-specific options |

---

### Stacks

Single-framework stacks:

| Value | Description |
|---|---|
| `laravel` | Laravel PHP backend |
| `express` | Express.js backend |
| `nestjs` | NestJS backend |
| `fastapi` | FastAPI Python backend |
| `django` | Django Python backend |
| `nextjs` | Next.js fullstack |
| `react` | React frontend (Vite) |
| `vue` | Vue 3 frontend (Vite) |

Combo stacks (monorepo with `backend/` + `frontend/` + `docker-compose.yml` + `Makefile`):

| Value | Description |
|---|---|
| `laravel+react` | Laravel API + React SPA |
| `laravel+nextjs` | Laravel API + Next.js |
| `nestjs+react` | NestJS + React SPA |
| `express+react` | Express + React SPA |
| `fastapi+react` | FastAPI + React SPA |
| `fastapi+nextjs` | FastAPI + Next.js |
| `mern` | MongoDB + Express + React + Node |
| `mevn` | MongoDB + Express + Vue + Node |
| `pern` | PostgreSQL + Express + React + Node |
| `t3` | TypeScript + tRPC + Next.js |

---

### Models & Fields

```yaml
models:
  - name: Article          # PascalCase
    migration:
      primary_key: uuid    # id | uuid | ulid | custom
      timestamps: true
      soft_deletes: false
    fields:
      - name: title
        type: string
      - name: status
        type: enum
        values: [draft, published, archived]
        default: draft
      - name: user_id
        type: foreignId
        references: users
      - name: views
        type: unsignedInteger
        default: 0
    generate:
      controller: true
      resource: true
      policy: true
      service: true
      tests: true
```

---

### Field Types

**Text**
`string` · `char` · `text` · `tinyText` · `mediumText` · `longText` · `enum` · `set` · `uuid` · `ulid` · `json` · `jsonb` · `ipAddress` · `macAddress`

**Numbers**
`integer` · `tinyInteger` · `smallInteger` · `mediumInteger` · `bigInteger` · `float` · `double` · `decimal` · `year`
+ unsigned variants: `unsignedInteger` · `unsignedBigInteger` · `unsignedSmallInteger` · `unsignedTinyInteger`

**Date & Time**
`date` · `dateTime` · `dateTimeTz` · `time` · `timeTz` · `timestamp` · `timestampTz`

**Boolean & Binary**
`boolean` · `binary` · `blob` · `tinyBlob` · `mediumBlob` · `longBlob`

**Relations & Keys**
`id` · `foreignId` · `foreignUuid` · `foreignUlid` · `morphs` · `uuidMorphs`

**Spatial**
`geometry` · `geography` · `point` · `lineString` · `polygon` · `vector`

**Special**
`rememberToken`

---

### Field Modifiers

Any field can include these modifiers:

```yaml
- name: email
  type: string
  nullable: true       # allows NULL
  unique: true         # adds unique index
  index: true          # adds index
  default: ""          # default value
  comment: "User email"
  unsigned: true       # for numeric types
```

---

### Relations

```yaml
relations:
  - type: belongsTo
    model: User
  - type: hasMany
    model: Comment
  - type: belongsToMany
    model: Tag
    pivot: article_tag
```

Supported: `hasOne` · `hasMany` · `belongsTo` · `belongsToMany` · `hasOneThrough` · `hasManyThrough` · `morphOne` · `morphMany` · `morphTo` · `morphToMany` · `morphedByMany`

---

### Generate Flags

Control which files are generated per model:

```yaml
generate:
  migration: true      # database migration
  controller: true     # API controller
  resource: true       # API resource/transformer (Laravel)
  request: true        # form request validation (Laravel)
  factory: true        # model factory for seeding/tests
  tests: true          # feature/unit tests
  policy: false        # authorization policy
  seeder: false        # database seeder
  service: false       # service class
  repository: false    # repository class
  swagger: false       # OpenAPI annotations
  soft_delete: false   # soft delete support
  dto: true            # data transfer objects (NestJS)
  module: true         # module file (NestJS)
  schema: true         # ORM schema (Express)
  routes: false        # route file (Express)
  observer: false      # model observer (Laravel)
  events: false        # events + listeners (Laravel)
  actions: false       # action classes (Laravel)
```

---

## Framework Options

### Laravel

```yaml
laravel:
  php_version: "8.4"        # "8.2" | "8.3" | "8.4"
  laravel_version: "12"     # "10" | "11" | "12"
  pattern: api-only          # api-only | full | minimal
  auth: sanctum              # sanctum | passport | breeze | jetstream | none
  db_engine: mysql           # mysql | pgsql | sqlite | sqlsrv
  route_prefix: "api/v1"    # optional API prefix
  runner: makefile           # makefile | bash | both | none
  use_api_response: true     # generate ApiResponse trait
  use_strict_types: true     # PHP declare(strict_types=1)
```

### Express

```yaml
express:
  orm: prisma                # prisma | typeorm | sequelize | drizzle | mongoose | none
  db_engine: postgresql      # postgresql | mysql | sqlite | mongodb
  auth: jwt                  # jwt | session | none
  validation: zod            # zod | joi | express-validator | none
  swagger: false             # generate OpenAPI docs
  port: 3000
  runner: makefile           # makefile | bash | none
```

### NestJS

```yaml
nestjs:
  orm: typeorm               # typeorm | prisma | mongoose | drizzle
  db_engine: postgresql      # postgresql | mysql | sqlite | mongodb
  auth: jwt                  # jwt | api-key | none
  swagger: true              # generate OpenAPI docs (Swagger UI)
  runner: makefile
```

### FastAPI

```yaml
fastapi:
  python_version: "3.12"    # "3.10" | "3.11" | "3.12" | "3.13"
  orm: sqlmodel              # sqlmodel | sqlalchemy | tortoise-orm | beanie | none
  db_engine: postgresql      # postgresql | mysql | sqlite | mongodb
  auth: jwt                  # jwt | oauth2 | api-key | none
  cors: true
  swagger: true
  migrations: true
```

### React

```yaml
react:
  ui_lib: shadcn             # shadcn | mui | antd | chakra | none
  state_lib: zustand         # zustand | redux-toolkit | jotai | none
  router: react-router-v6    # react-router-v6 | tanstack-router | none
  form_lib: react-hook-form  # react-hook-form | formik | zod | none
  http_lib: axios            # axios | ky | fetch
  data_fetching: tanstack-query  # tanstack-query | swr | none
```

---

## Commands

### init

Create a new project interactively from the terminal — no YAML file needed.

```bash
npx create-stack-init                           # full interactive wizard
npx create-stack-init my-app --preset pern      # pre-fill name + preset
npx create-stack-init my-app --preset pern -y   # 100% non-interactive
stack-init init
stack-init init my-blog --preset laravel-api
stack-init init my-api --stack fastapi --yes --no-generate
```

| Option | Default | Description |
|---|---|---|
| `[name]` | prompted | Project name (positional argument) |
| `-p, --preset <key>` | — | Predefined preset — skips stack selection |
| `-s, --stack <stack>` | — | Raw stack string for custom mode |
| `-y, --yes` | `false` | Accept all defaults, skip all prompts |
| `-o, --output <path>` | `./<name>` | Output directory |
| `--no-generate` | — | Save YAML only, skip generation |

Available presets: `pern` · `mern` · `t3` · `laravel-api` · `laravel-react` · `fastapi-react` · `nestjs-api` · `django`

In full wizard mode, 8–12 questions depending on the stack:
- Project name, preset choice (or Custom mode)
- Custom mode: ORM, DB engine, auth, validation, swagger, PHP/Python version, router, form lib…
- Models (loop: name → fields → soft deletes)
- Optional services (auth, email, cache, queue, file-upload, websockets)
- Output directory
- Action: YAML only · YAML + VS Code · generate now · dry-run

---

### generate

Scaffold all files defined in `stack-init.yaml`.

```bash
stack-init generate [options]
```

| Option | Default | Description |
|---|---|---|
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |
| `-o, --output <path>` | `.` | Target project root |
| `--dry-run` | `false` | Preview files without writing |
| `--force` | `false` | Overwrite existing files without prompt |

```bash
# Dry run — preview what would be generated
stack-init generate --dry-run

# Custom config and output path
stack-init generate --config configs/my-api.yaml --output ./backend
```

After generation, a `.stack-init-manifest.json` is created — it tracks every generated file for `rollback`.

---

### add

Add a new model to an existing project without re-running the full generation.

```bash
stack-init add <ModelName> [options]
```

| Option | Default | Description |
|---|---|---|
| `-f, --fields <string>` | — | Inline field definitions |
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |
| `-o, --output <path>` | `.` | Target project root |
| `--dry-run` | `false` | Preview without writing |

**Field syntax:** `name:type[:modifier]`

```bash
# Add a Comment model with inline fields
stack-init add Comment \
  --fields "body:text,user_id:foreignId,approved:boolean"

# Enum field with pipe-separated values
stack-init add Order \
  --fields "status:enum:pending|paid|cancelled,amount:decimal"
```

The `add` command also updates `stack-init.yaml` and appends to `.stack-init-manifest.json`.

---

### rollback

Delete all files generated during the last `generate` or `add` run.

```bash
stack-init rollback [options]
```

| Option | Default | Description |
|---|---|---|
| `-o, --output <path>` | `.` | Project root containing the manifest |

```bash
stack-init rollback
# Reads .stack-init-manifest.json and deletes every tracked file
```

> **Note:** `rollback` only removes files from the last tracked generation. It does not restore previously existing files that were modified (e.g. `routes/api.php`).

---

### validate

Validate `stack-init.yaml` without generating any files.

```bash
stack-init validate
stack-init validate --config ./stack-init.yaml
```

| Option | Default | Description |
|---|---|---|
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |

---

### diff

Show which files would be generated — a visual dry-run with colored output.

```bash
stack-init diff
stack-init diff --output ./my-project
```

| Option | Default | Description |
|---|---|---|
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |
| `-o, --output <path>` | `.` | Target project root |

---

### update-versions

Fetch the latest package versions from npm, packagist, and PyPI and update the internal cache.

```bash
stack-init update-versions
```

---

## Generated Files

### Laravel

Per model (based on `generate` flags):

```
app/
  Models/{Model}.php
  Http/
    Controllers/Api/{Model}Controller.php
    Resources/{Model}Resource.php
    Requests/Store{Model}Request.php
    Requests/Update{Model}Request.php
  Policies/{Model}Policy.php
  Repositories/{Model}Repository.php
  Services/{Model}Service.php
database/
  migrations/{timestamp}_create_{table}_table.php
  factories/{Model}Factory.php
  seeders/{Model}Seeder.php
tests/
  Feature/{Model}Test.php
routes/
  api.php                  ← patched (not overwritten)
Makefile
docker-compose.yml
setup.sh / setup.ps1 / setup.bat
```

### Express

```
src/
  models/{model}.model.ts      (Mongoose) or prisma/schema.prisma (Prisma)
  repositories/{model}.repository.ts
  services/{model}.service.ts
  controllers/{model}.controller.ts
  routes/{model}.routes.ts
  routes/index.ts              ← patched
```

### NestJS

```
src/modules/{kebab-model}/
  {model}.module.ts
  entities/{model}.entity.ts
  {model}.controller.ts
  {model}.service.ts
  dto/create-{model}.dto.ts
  dto/update-{model}.dto.ts
src/app.module.ts              ← patched
```

### FastAPI

```
app/
  routers/{model}.py
  models/{model}.py
  schemas/{model}.py
  dependencies/{model}.py
  main.py
requirements.txt
alembic/                       (migrations)
```

---

## Examples

### PERN Stack (non-interactive)

```bash
npx create-stack-init shop --preset pern --yes
```

Generates a full PostgreSQL + Express + React + Prisma monorepo with no prompts.

---

### Laravel REST API

```yaml
name: blog-api
stack: laravel
laravel:
  php_version: "8.4"
  laravel_version: "12"
  auth: sanctum
  db_engine: mysql
models:
  - name: Post
    fields:
      - { name: title, type: string }
      - { name: body, type: longText }
      - { name: user_id, type: foreignId, references: users }
      - { name: published_at, type: timestamp, nullable: true }
    generate:
      controller: true
      resource: true
      request: true
      policy: true
      factory: true
      tests: true
```

---

### NestJS + PostgreSQL

```yaml
name: orders-service
stack: nestjs
nestjs:
  orm: typeorm
  db_engine: postgresql
  auth: jwt
  swagger: true
models:
  - name: Order
    fields:
      - { name: reference, type: uuid }
      - { name: amount, type: decimal }
      - { name: status, type: enum, values: [pending, paid, cancelled] }
    generate:
      controller: true
      service: true
      dto: true
      tests: true
```

---

### FastAPI + React

```yaml
name: my-saas
stack: fastapi+react
fastapi:
  python_version: "3.12"
  orm: sqlmodel
  db_engine: postgresql
  auth: jwt
react:
  ui_lib: shadcn
  state_lib: zustand
  router: react-router-v6
  form_lib: react-hook-form
models:
  - name: Project
    fields:
      - { name: name, type: string }
      - { name: description, type: text, nullable: true }
    generate:
      controller: true
      service: true
      schema: true
```

---

## License

MIT — © [Just2sire](https://github.com/Just2sire)
