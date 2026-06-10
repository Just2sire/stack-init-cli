# stack-init-cli

CLI Node.js/TypeScript qui lit un fichier `stack-init.yaml` et génère un projet backend complet sur disque. Organisé en monorepo pnpm avec un package de schéma partagé.

---

## Vue d'ensemble

`stack-init-cli` est le moteur de génération de code côté terminal. Il consomme la configuration produite par le wizard `stack-init` (l'interface web) et génère les fichiers réels : migrations, modèles, contrôleurs, services, routes, factories, tests, Makefile, docker-compose, etc.

Le projet est un **monorepo pnpm** composé de deux packages :

| Package | Nom npm | Rôle |
|---|---|---|
| `packages/schema` | `@stack-init/schema` | Schémas Zod + types TypeScript partagés |
| `packages/cli` | `stack-init-cli` | Implémentation des commandes CLI |

---

## Installation

```bash
# Cloner le dépôt
git clone <repo-url> stack-init-cli
cd stack-init-cli

# Installer les dépendances (tous les packages du monorepo)
pnpm install

# Compiler tous les packages
pnpm build

# Installer le CLI globalement (pour l'utiliser depuis n'importe quel dossier)
cd packages/cli
pnpm link --global
```

### Utilisation sans installation globale

```bash
# Depuis le dossier d'un projet ayant un stack-init.yaml
npx stack-init generate
```

---

## Utilisation

Créer un fichier `stack-init.yaml` à la racine du projet, puis lancer :

```bash
stack-init generate
```

### Commandes disponibles

```bash
# ── Nouveau projet depuis le terminal (wizard interactif ou flags) ──────────
stack-init init                              # wizard complet
stack-init init my-app --preset pern        # nom + preset prédéfini
stack-init init my-app --preset pern --yes  # 100% non-interactif
stack-init init my-api --stack fastapi --yes --no-generate  # YAML seulement

# Via npx (sans installation globale)
npx create-stack-init
npx create-stack-init my-app --preset laravel-api --yes

# ── Génération depuis un stack-init.yaml ─────────────────────────────────────
stack-init generate
stack-init generate --config ./chemin/vers/stack-init.yaml   # Chemin custom
stack-init generate --output ./mon-projet                    # Dossier de sortie custom
stack-init generate --dry-run                                # Aperçu sans écriture sur disque

# ── Autres commandes ─────────────────────────────────────────────────────────
# Ajoute un nouveau modèle à un projet existant
stack-init add

# Annule la dernière génération (utilise le manifeste .stack-init-manifest.json)
stack-init rollback
stack-init rollback --output ./mon-projet

# Valide le YAML sans générer de fichiers
stack-init validate
stack-init validate --config ./stack-init.yaml

# Affiche les fichiers qui seraient générés (dry-run visuel)
stack-init diff

# Met à jour versions.json avec les dernières versions npm/packagist/PyPI
stack-init update-versions
```

---

## Exemple de fichier `stack-init.yaml`

```yaml
name: my-saas
version: 0.1.0
stack: laravel

laravel:
  php_version: "8.3"
  db_engine: postgresql
  auth_type: sanctum
  runner: makefile

models:
  - name: User
    fields:
      - { name: name,       type: string }
      - { name: email,      type: string,  unique: true }
      - { name: password,   type: string }
      - { name: role,       type: enum,    enumValues: [admin, user, guest] }
      - { name: verified_at, type: timestamp, nullable: true }
    generate:
      migration: true
      factory: true
      policy: true
      resource: true
      controller: true
      service: true
      request: true
      test: true

  - name: Post
    fields:
      - { name: title,      type: string }
      - { name: slug,       type: string,  unique: true }
      - { name: content,    type: longText }
      - { name: published,  type: boolean, default: "false" }
      - { name: user_id,    type: foreignId }
    generate:
      migration: true
      factory: true
      controller: true
      service: true
      repository: true

relations:
  - from: User
    to: Post
    type: hasMany

middlewares:
  - cors
  - auth
  - throttle
```

### Exemple pour un combo Express + React

```yaml
name: mon-projet
version: 0.1.0
stack: express+react

express:
  db_engine: postgresql
  orm: prisma
  runner: makefile

react:
  typescript: true
  ui_library: shadcn
  state_library: zustand
  routing: react-router

models:
  - name: Product
    fields:
      - { name: name,        type: string }
      - { name: price,       type: decimal, precision: 10, scale: 2 }
      - { name: stock,       type: integer, default: "0" }
      - { name: category_id, type: foreignId }
    generate:
      controller: true
      service: true
      repository: true
      routes: true
```

---

## Structure du monorepo

```
stack-init-cli/
├── packages/
│   ├── schema/                        @stack-init/schema
│   │   ├── src/
│   │   │   ├── index.ts               Exports publics du package
│   │   │   ├── field-types.ts         40+ types de champs BDD
│   │   │   ├── models.schema.ts       Schéma Zod pour Model et NamedField
│   │   │   ├── project.schema.ts      Schéma Zod pour ProjectConfig complet
│   │   │   ├── laravel.schema.ts      Options spécifiques Laravel
│   │   │   ├── express.schema.ts      Options Express
│   │   │   ├── nest.schema.ts         Options NestJS
│   │   │   ├── fastapi.schema.ts      Options FastAPI
│   │   │   ├── react.schema.ts        Options React frontend
│   │   │   ├── vue.schema.ts          Options Vue frontend
│   │   │   ├── architecture.schema.ts Patterns d'architecture
│   │   │   └── combos.schema.ts       Combinaisons de stacks valides
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                           stack-init-cli
│       ├── src/
│       │   ├── index.ts               Point d'entrée CLI (Commander)
│       │   ├── commands/              Implémentation des commandes
│       │   │   ├── generate.ts        Orchestrateur principal de génération
│       │   │   ├── add.ts             Ajout incrémental de modèle
│       │   │   ├── rollback.ts        Annulation via manifeste
│       │   │   ├── validate.ts        Validation YAML sans génération
│       │   │   ├── diff.ts            Aperçu des fichiers à générer
│       │   │   └── update-versions.ts Mise à jour des versions de packages
│       │   │
│       │   ├── generators/            Un générateur par framework
│       │   │   ├── laravel/
│       │   │   │   ├── index.ts       Générateur Laravel principal
│       │   │   │   ├── handlebars.ts  Helpers Handlebars Laravel
│       │   │   │   └── plugins/       Add-ons optionnels
│       │   │   │       ├── socialite.ts    Auth sociale (Google, GitHub)
│       │   │   │       ├── permissions.ts  Spatie Permissions
│       │   │   │       ├── media.ts        Spatie Media Library
│       │   │   │       └── horizon.ts      Laravel Horizon (queues)
│       │   │   ├── express/
│       │   │   │   └── index.ts       Générateur Express + ORM
│       │   │   ├── nest/
│       │   │   │   └── index.ts       Générateur NestJS modulaire
│       │   │   ├── fastapi/
│       │   │   │   └── index.ts       Générateur FastAPI async
│       │   │   ├── django/
│       │   │   │   └── index.ts       Générateur Django
│       │   │   ├── react/
│       │   │   │   └── index.ts       Générateur React Vite
│       │   │   ├── nextjs/
│       │   │   │   └── index.ts       Générateur Next.js App Router
│       │   │   ├── vue/
│       │   │   │   └── index.ts       Générateur Vue 3
│       │   │   ├── t3/
│       │   │   │   └── index.ts       Générateur T3 Stack
│       │   │   ├── angular/
│       │   │   │   └── index.ts       Générateur Angular
│       │   │   ├── docker/
│       │   │   │   └── index.ts       Génération Docker + docker-compose
│       │   │   ├── zip/
│       │   │   │   └── index.ts       Génération ZIP (frontend)
│       │   │   ├── cicd/
│       │   │   │   └── index.ts       CI/CD (GitHub Actions, GitLab CI)
│       │   │   ├── services/          Services transversaux
│       │   │   │   ├── auth.ts        Génération du système d'auth
│       │   │   │   ├── email.ts       Service email (Mailgun, SES...)
│       │   │   │   ├── file-upload.ts Upload de fichiers
│       │   │   │   ├── cache.ts       Mise en cache (Redis)
│       │   │   │   ├── queue.ts       Queues (BullMQ, Horizon)
│       │   │   │   └── websockets.ts  WebSockets
│       │   │   ├── runner/
│       │   │   │   └── index.ts       Génération Makefile et scripts shell
│       │   │   └── frontend-api/
│       │   │       └── index.ts       Génération du client API (React/Vue)
│       │   │
│       │   ├── utils/
│       │   │   ├── field-helpers.ts   Conversion types BDD → casts, validations, Faker
│       │   │   ├── naming.ts          Conventions de nommage (camel, snake, plural...)
│       │   │   ├── fs.ts              Écriture de fichiers avec suivi pour rollback
│       │   │   ├── config.ts          Résolution du chemin du YAML
│       │   │   ├── model-sort.ts      Tri topologique (ordre des FK pour migrations)
│       │   │   ├── template-path.ts   Résolution du chemin des templates Handlebars
│       │   │   └── setup-instructions.ts Génération README + Makefile de démarrage
│       │   │
│       │   ├── config/
│       │   │   ├── versions.json      Cache des versions de packages (npm/packagist/PyPI)
│       │   │   └── versions.ts        Logique de récupération des versions
│       │   │
│       │   └── __tests__/             Tests unitaires et d'intégration
│       │       ├── generators/
│       │       │   └── *.test.ts      Tests par générateur
│       │       ├── utils/
│       │       │   ├── field-helpers.test.ts
│       │       │   └── naming.test.ts
│       │       └── fixtures.ts        Données de test partagées
│       │
│       ├── templates/                 Templates Handlebars (.hbs)
│       │   ├── laravel/
│       │   │   ├── base/              Templates de base (toujours générés)
│       │   │   │   ├── Model.php.hbs
│       │   │   │   └── Controller.php.hbs
│       │   │   └── overlays/          Templates conditionnels (selon generate.*)
│       │   │       ├── migration/
│       │   │       ├── factory/
│       │   │       ├── policy/
│       │   │       ├── resource/
│       │   │       ├── request/
│       │   │       ├── service/
│       │   │       ├── repository/
│       │   │       ├── observer/
│       │   │       ├── events/
│       │   │       ├── actions/
│       │   │       └── test/
│       │   ├── express/
│       │   │   └── overlays/
│       │   │       ├── controller/
│       │   │       ├── service/
│       │   │       ├── repository/
│       │   │       ├── validation/
│       │   │       └── routes/
│       │   └── ...                    (un dossier par framework)
│       │
│       ├── build.mjs                  Script esbuild (TypeScript → CommonJS bundle)
│       ├── package.json               Binaire CLI "stack-init"
│       ├── tsconfig.json
│       └── vitest.config.ts
│
├── stack-init.yaml                    Exemple de configuration
├── pnpm-workspace.yaml                Config monorepo pnpm
└── package.json                       Scripts racine du monorepo
```

---

## Package `@stack-init/schema`

Source unique de vérité pour les types et la validation. Utilisé par le wizard web ET le CLI.

### Types de champs supportés (`field-types.ts`)

**Texte :**
`string`, `char`, `tinyText`, `text`, `mediumText`, `longText`, `enum`, `set`, `json`, `jsonb`, `uuid`, `ulid`, `ipAddress`, `macAddress`

**Nombres :**
`tinyInteger`, `smallInteger`, `mediumInteger`, `integer`, `bigInteger`, `unsignedInteger`, `unsignedBigInteger`, `float`, `double`, `decimal`, `year`

**Dates & heures :**
`date`, `dateTime`, `dateTimeTz`, `time`, `timestamp`, `timestampTz`

**Booléens & binaire :**
`boolean`, `binary`, `blob`, `longBlob`

**Relations :**
`foreignId`, `foreignUuid`, `foreignUlid`, `morphs`

**Spéciaux :**
`geometry`, `point`, `vector`, `rememberToken`

### Schéma de validation Zod

Chaque framework a son propre schéma. Exemple pour Laravel (`laravel.schema.ts`) :

```typescript
const LaravelSchema = z.object({
  php_version: z.enum(["8.1", "8.2", "8.3", "8.4"]).default("8.3"),
  db_engine: z.enum(["mysql", "postgresql", "sqlite"]).default("mysql"),
  auth_type: z.enum(["none", "sanctum", "passport", "jetstream"]).default("sanctum"),
  runner: z.enum(["makefile", "shell", "none"]).default("makefile"),
})
```

---

## Commande `generate` — Fonctionnement détaillé

`src/commands/generate.ts` est l'orchestrateur principal. Voici son pipeline :

```
1. Lecture du stack-init.yaml (js-yaml)
       ↓
2. Validation via @stack-init/schema (Zod)
   → Erreur claire si le YAML est invalide
       ↓
3. Tri topologique des modèles (model-sort.ts)
   → S'assure que les FK parents sont générés avant les enfants
       ↓
4. Snapshot des fichiers existants (pour injection sans écrasement)
   → Ex: api.php, DatabaseSeeder.php sont lus avant modification
       ↓
5. Instanciation du/des générateur(s) selon le stack
       ↓
6. Génération de tous les fichiers (en mémoire)
       ↓
7. [Si --dry-run] Affiche la liste des fichiers, s'arrête
       ↓
8. Écriture des fichiers sur disque (fs.ts)
       ↓
9. Génération du manifeste .stack-init-manifest.json (pour rollback)
       ↓
10. Affichage du résumé et des instructions de démarrage
```

---

## Générateur Laravel — Phases de génération

Le générateur Laravel (`generators/laravel/index.ts`) travaille en phases ordonnées :

| Phase | Fichiers générés |
|---|---|
| **0 — Snapshot** | Lecture de `routes/api.php` et `DatabaseSeeder.php` existants |
| **1 — Infrastructure** | `.env.example`, `config/`, `composer.json`, `phpunit.xml` |
| **2 — Modèles** | Pour chaque modèle selon les flags `generate.*` : |
| | `database/migrations/TIMESTAMP_create_xxx_table.php` |
| | `app/Models/Name.php` (Eloquent) |
| | `app/Http/Requests/StoreNameRequest.php` |
| | `app/Http/Requests/UpdateNameRequest.php` |
| | `database/factories/NameFactory.php` |
| | `app/Repositories/NameRepository.php` |
| | `app/Services/NameService.php` |
| | `app/Http/Resources/NameResource.php` |
| | `app/Http/Controllers/Api/NameController.php` |
| | `app/Policies/NamePolicy.php` |
| | `tests/Feature/NameTest.php` |
| **3 — Auth** | `app/Http/Controllers/Api/AuthController.php` |
| **4 — Routes** | Patch de `routes/api.php` (injection sans écrasement) |
| **5 — Extras** | `Makefile`, `docker-compose.yml`, `README.md` |

### Plugins Laravel optionnels

Activés via la config, les plugins injectent des fichiers supplémentaires :

- **`socialite`** — Auth sociale (Google, GitHub, Facebook) via Laravel Socialite
- **`permissions`** — Gestion des rôles/permissions via Spatie Laravel Permission
- **`media`** — Upload et gestion de médias via Spatie Media Library
- **`horizon`** — Dashboard de monitoring des queues via Laravel Horizon

---

## Générateurs Express / NestJS

### Express (`generators/express/index.ts`)

Pour chaque modèle, génère :
- `src/models/Name.ts` — Schéma Prisma ou entité TypeORM/Sequelize/Drizzle
- `src/controllers/NameController.ts` — CRUD handlers
- `src/services/NameService.ts` — Logique métier
- `src/repositories/NameRepository.ts` — Couche d'accès données (si architecture Repository)
- `src/dtos/CreateNameDto.ts` / `UpdateNameDto.ts` — Data Transfer Objects
- `src/routes/name.routes.ts` — Définition des routes Express
- Injection automatique dans `src/routes/index.ts`

**ORMs supportés :** Prisma, TypeORM, Sequelize, Mongoose, Drizzle

**Bases de données :** PostgreSQL, MySQL, SQLite, MongoDB

### NestJS (`generators/nest/index.ts`)

Génère une architecture modulaire complète :
- `src/name/name.module.ts` — Module NestJS
- `src/name/name.controller.ts` — Controller avec décorateurs
- `src/name/name.service.ts` — Service injecté
- `src/name/dto/create-name.dto.ts` — DTO avec class-validator
- `src/name/entities/name.entity.ts` — Entité TypeORM
- Injection du module dans `src/app.module.ts`

### FastAPI (`generators/fastapi/index.ts`)

Génère une structure async complète :
- `app/routers/name.py` — Router FastAPI avec endpoints async
- `app/models/name.py` — Modèle SQLAlchemy/SQLModel/Tortoise
- `app/schemas/name.py` — Schémas Pydantic (Create, Update, Response)
- `app/dependencies/name.py` — Dépendances FastAPI (injection)

**ORMs supportés :** SQLAlchemy, SQLModel, Tortoise-ORM, Beanie (MongoDB)

---

## Utilitaires clés

### `field-helpers.ts`

Convertit un `FieldType` vers différentes représentations selon le framework cible :

```typescript
// Type PHP (Laravel)
fieldToCastType("decimal")     → "float"
fieldToCastType("boolean")     → "bool"
fieldToCastType("json")        → "array"

// Type TypeScript
fieldToTsType("integer")       → "number"
fieldToTsType("string")        → "string"
fieldToTsType("json")          → "Record<string, unknown>"

// Règle de validation Laravel
fieldToValidationRule("email") → "required|email|max:255"
fieldToValidationRule("integer") → "required|integer"

// Valeur Faker (factories)
fieldToFakerValue("name")      → "fake()->name()"
fieldToFakerValue("email")     → "fake()->safeEmail()"
fieldToFakerValue("text")      → "fake()->paragraph()"
```

### `naming.ts`

Gère toutes les conventions de nommage, y compris les irrégularités :

```typescript
modelToTableName("BlogPost")   → "blog_posts"
modelToTableName("Person")     → "people"      // Pluriel irrégulier
modelToVarName("BlogPost")     → "blogPost"    // camelCase
modelToRouteName("BlogPost")   → "blog-posts"  // kebab-case
migrationTimestamp()           → "2026_01_15_143022"
```

### `model-sort.ts`

Tri topologique des modèles selon leurs relations `foreignId`. Garantit que si `Post` a `user_id → User`, alors `User` est migré en premier.

### `fs.ts`

Wrapper autour de `node:fs` qui :
- Crée les dossiers parents automatiquement
- Enregistre chaque fichier écrit dans `.stack-init-manifest.json`
- En mode `--dry-run`, collecte la liste sans écrire

---

## Système de rollback

À chaque génération, le CLI crée ou met à jour `.stack-init-manifest.json` :

```json
{
  "timestamp": "2026-01-15T14:30:22.000Z",
  "stack": "laravel",
  "files": [
    "app/Models/Post.php",
    "database/migrations/2026_01_15_143022_create_posts_table.php",
    "app/Http/Controllers/Api/PostController.php"
  ]
}
```

La commande `stack-init rollback` lit ce fichier et supprime tous les fichiers listés.

---

## Scripts du monorepo

```bash
# Depuis la racine du monorepo
pnpm build       # Compile tous les packages (esbuild)
pnpm dev         # Compilation en mode watch
pnpm test        # Lance Vitest sur tous les packages
pnpm clean       # Supprime les dossiers dist/

# Depuis packages/cli
pnpm build       # Build du CLI uniquement
pnpm test        # Tests du CLI uniquement
pnpm link --global   # Installe "stack-init" globalement
```

---

## Tests

Les tests utilisent **Vitest** et couvrent :

- **Générateurs** : Vérifient que les fichiers générés ont le bon contenu pour des configs types
- **field-helpers** : Teste toutes les conversions de types
- **naming** : Teste les conventions de nommage et les cas irréguliers
- **fixtures.ts** : Fournit des `ProjectConfig` réalistes réutilisables dans les tests

```bash
pnpm test                    # Tous les tests
pnpm test -- --watch        # Mode watch
pnpm test -- field-helpers  # Tests d'un fichier spécifique
```

---

## Dépendances principales

| Package | Version | Usage |
|---|---|---|
| `commander` | v12 | Parsing des arguments CLI |
| `js-yaml` | v4 | Lecture/écriture YAML |
| `handlebars` | v4 | Moteur de templates |
| `adm-zip` | v0.5 | Création d'archives ZIP |
| `@clack/prompts` | v1.5 | Prompts interactifs pour la commande `init` |
| `picocolors` | v1 | Couleurs dans le terminal |
| `zod` | v3.23 | Validation du schéma YAML |

---

## Fichiers générés par stack

### Laravel

```
app/
├── Http/
│   ├── Controllers/Api/NameController.php
│   └── Requests/
│       ├── StoreNameRequest.php
│       └── UpdateNameRequest.php
│   └── Resources/NameResource.php
├── Models/Name.php
├── Policies/NamePolicy.php
└── Services/NameService.php
database/
├── factories/NameFactory.php
└── migrations/TIMESTAMP_create_names_table.php
tests/Feature/NameTest.php
routes/api.php                  (patché, non écrasé)
Makefile
docker-compose.yml
```

### Express + Prisma

```
backend/
├── src/
│   ├── controllers/NameController.ts
│   ├── services/NameService.ts
│   ├── repositories/NameRepository.ts
│   ├── dtos/CreateNameDto.ts
│   ├── routes/name.routes.ts
│   └── routes/index.ts         (patché)
├── prisma/schema.prisma         (schéma Prisma complet)
└── package.json
frontend/
└── (React Vite complet)
Makefile
docker-compose.yml
```

### FastAPI

```
backend/
├── app/
│   ├── routers/name.py
│   ├── models/name.py
│   ├── schemas/name.py
│   ├── dependencies/name.py
│   └── main.py
├── requirements.txt
└── alembic/                     (migrations)
frontend/
└── (React Vite complet)
Makefile
docker-compose.yml
```
