# stack-init-cli

**Scaffold complete backend & frontend projects from a single YAML file.**

`stack-init-cli` generates models, migrations, controllers, services, routes, DTOs, tests and more — for Laravel, Express, NestJS, FastAPI, and Next.js/React — without writing boilerplate.

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
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
- [Commands](#commands)
  - [generate](#generate)
  - [add](#add)
  - [rollback](#rollback)
- [Generated Files](#generated-files)
- [Examples](#examples)

---

## Installation

```bash
npm install -g stack-init-cli
```

**Requirements:** Node.js 18+

---

## Quick Start

**1. Create a `stack-init.yaml` at the root of your project:**

```yaml
name: my-api
version: 0.1.0
stack: laravel

laravel:
  php_version: "8.2"

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
stack-init-cli generate
```

That's it. Your Laravel project now has a `Post` model, migration, controller, resource, form requests, factory, and feature tests — all properly wired up.

---

## YAML Configuration

### Top-level keys

| Key | Type | Required | Description |
|---|---|---|---|
| `name` | string | yes | Project name (kebab-case) |
| `description` | string | no | Short project description |
| `version` | string | no | Semantic version (default: `0.1.0`) |
| `stack` | string | yes | Target stack (see [Stacks](#stacks)) |
| `models` | Model[] | yes | List of data models (min. 1) |
| `laravel` | object | if stack includes Laravel | Laravel-specific options |
| `express` | object | if stack includes Express | Express-specific options |
| `nestjs` | object | if stack includes NestJS | NestJS-specific options |
| `fastapi` | object | if stack includes FastAPI | FastAPI-specific options |

---

### Stacks

Single-framework stacks:

| Value | Description |
|---|---|
| `laravel` | Laravel PHP backend |
| `express` | Express.js backend |
| `nestjs` | NestJS backend |
| `fastapi` | FastAPI Python backend |
| `nextjs` | Next.js fullstack |
| `react` | React frontend |

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

Supported relation types: `hasOne` · `hasMany` · `belongsTo` · `belongsToMany` · `hasOneThrough` · `hasManyThrough` · `morphOne` · `morphMany` · `morphTo` · `morphToMany` · `morphedByMany`

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
```

---

## Framework Options

### Laravel

```yaml
laravel:
  php_version: "8.2"
  auth: sanctum        # sanctum | passport | none
  api_prefix: "api/v1"
```

### Express

```yaml
express:
  language: typescript   # typescript | javascript
  orm: prisma            # prisma | mongoose | none
  port: 3000
  database: postgresql   # postgresql | mysql | mongodb | sqlite
```

### NestJS

```yaml
nestjs:
  orm: typeorm           # typeorm | prisma | mongoose
  architecture: standard # standard | cqrs
  database: postgresql
  swagger: true
  auth: jwt              # jwt | none
```

### FastAPI

```yaml
fastapi:
  python_version: "3.11"
  orm: sqlalchemy        # sqlalchemy | tortoise
  database: postgresql
  auth: jwt
```

---

## Commands

### generate

Scaffold all files defined in `stack-init.yaml`.

```bash
stack-init-cli generate [options]
```

| Option | Default | Description |
|---|---|---|
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |
| `-o, --output <path>` | `.` | Target project root |
| `--dry-run` | `false` | Preview files without writing |

```bash
# Dry run — preview what would be generated
stack-init-cli generate --dry-run

# Custom config and output path
stack-init-cli generate --config configs/my-api.yaml --output ./backend
```

After generation, a `.stack-init-manifest.json` is created in the output directory — it tracks every generated file for use by `rollback`.

---

### add

Add a new model to an existing project without re-running the full generation.

```bash
stack-init-cli add <ModelName> [options]
```

| Option | Default | Description |
|---|---|---|
| `-f, --fields <string>` | — | Inline field definitions |
| `-c, --config <path>` | `stack-init.yaml` | Path to config file |
| `-o, --output <path>` | `.` | Target project root |
| `--dry-run` | `false` | Preview without writing |

**Field syntax:** `name:type[:modifier,modifier]`

```bash
# Add a Comment model with inline fields
stack-init-cli add Comment \
  --fields "body:text,user_id:foreignId,approved:boolean:default=false"

# Add with config file and target path
stack-init-cli add Product \
  --fields "name:string,price:decimal,stock:unsignedInteger" \
  --config stack-init.yaml \
  --output ./backend
```

The `add` command also updates `stack-init.yaml` with the new model and appends to `.stack-init-manifest.json`.

---

### rollback

Delete all files generated during the last `generate` or `add` run.

```bash
stack-init-cli rollback [options]
```

| Option | Default | Description |
|---|---|---|
| `-o, --output <path>` | `.` | Project root containing the manifest |

```bash
stack-init-cli rollback
# Reads .stack-init-manifest.json and deletes every tracked file
```

> **Note:** `rollback` only removes files from the last tracked generation. It does not restore previously existing files that were modified (e.g. `routes/api.php`).

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
  api.php                  ← auto-injected with new routes
```

### Express

```
src/
  models/{model}.model.ts      (Mongoose) or prisma/schema.prisma (Prisma)
  repositories/{model}.repository.ts
  services/{model}.service.ts
  controllers/{model}.controller.ts
  routes/{model}.routes.ts
  routes/index.ts              ← auto-injected
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
  commands/                    (CQRS architecture)
  queries/                     (CQRS architecture)
src/app.module.ts              ← auto-injected
```

---

## Examples

### Laravel REST API

```yaml
name: blog-api
stack: laravel
laravel:
  php_version: "8.2"
  auth: sanctum
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

### NestJS + PostgreSQL (CQRS)

```yaml
name: orders-service
stack: nestjs
nestjs:
  orm: typeorm
  architecture: cqrs
  database: postgresql
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

### Express + Prisma

```yaml
name: shop-api
stack: express
express:
  language: typescript
  orm: prisma
  database: postgresql
models:
  - name: Product
    fields:
      - { name: name, type: string }
      - { name: price, type: decimal }
      - { name: stock, type: unsignedInteger, default: 0 }
    generate:
      controller: true
      service: true
      repository: true
      routes: true
      schema: true
```

---

## License

MIT — © [Just2sire](https://github.com/Just2sire)
