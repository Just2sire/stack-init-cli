# stack-init

`stack-init-cli` est un générateur de code full-stack qui crée automatiquement des projets complets (Laravel, Express, NestJS, React, Next.js) à partir d'un fichier YAML de configuration.

## Fonctionnalités

- **Génération Multi-Stack** : Support de Laravel, Express (Prisma), NestJS (TypeORM), React et Next.js.
- **Mixed Stacks** : Orchestration automatique de projets mixtes (ex: `laravel+react`, `express+react`).
- **Smart Injection** : Mise à jour intelligente des fichiers existants (routes, modules) plutôt qu'écrasement.
- **Templates ZIP** : Support de templates riches pour le frontend (React/Next.js).
- **Manifeste & Rollback** : Suivi précis des fichiers générés pour un nettoyage facile.
- **Orchestration** : Génération de `Makefile` et `docker-compose.yml` pour gérer plusieurs services.

## Installation

```bash
# Cloner le dépôt
git clone <repo-url> stack-init-cli
cd stack-init-cli

# Installer les dépendances du monorepo
pnpm install

# Compiler le projet
pnpm build
```

### Installer le CLI localement

```bash
cd packages/cli
pnpm link --global
```

## Utilisation

Créez un fichier `stack-init.yaml` et lancez :

```bash
stack-init generate
```

### Options principales

```bash
stack-init generate --config chemin/vers/stack-init.yaml
stack-init generate --output /chemin/vers/projet
stack-init generate --dry-run   # affiche les fichiers générés sans écrire
stack-init rollback --output /chemin/vers/projet # annule la dernière génération
```

## Exemple de configuration `stack-init.yaml`

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

models:
  - name: Post
    fields:
      - { name: title, type: string }
      - { name: content, type: text }
    generate:
      controller: true
      service: true
      repository: true
      routes: true
```

## Stacks Supportées

- **Backend** :
  - `laravel` (PHP)
  - `express` (Node.js + Prisma)
  - `nestjs` (Node.js + TypeORM)
- **Frontend** :
  - `react` (Vite template)
  - `nextjs` (App Router template)
- **Combinations** :
  - `laravel+react`, `laravel+nextjs`
  - `express+react`

## Architecture Multi-Stack

Pour les stacks mixtes (ex: `express+react`), `stack-init` organise le projet ainsi :
- `backend/` : Code du serveur (Express/Laravel)
- `frontend/` : Code client (React/Next.js)
- `Makefile` : Commandes globales (`make setup`, `make dev`)
- `docker-compose.yml` : Configuration Docker pour les deux services

## Ce qui est généré (Express/NestJS)

- **Modèles/Entités** : Schémas Prisma ou Entités TypeORM.
- **Couches (Layers)** : Controllers, Services, Repositories, DTOs/Validation.
- **Routes** : Définition des endpoints et injection automatique dans le routeur principal.
- **Manifeste** : `.stack-init-manifest.json` pour le rollback.


## Champs supportés

- Texte : `string`, `char`, `tinyText`, `text`, `mediumText`, `longText`, `enum`, `set`, `json`, `jsonb`, `uuid`, `ulid`, `ipAddress`, `macAddress`
- Nombres : `tinyInteger`, `smallInteger`, `mediumInteger`, `integer`, `bigInteger`, `unsignedInteger`, `unsignedBigInteger`, `float`, `double`, `decimal`, `year`
- Dates & heures : `date`, `dateTime`, `dateTimeTz`, `time`, `timestamp`, `timestampTz`
- Booléens & binaire : `boolean`, `binary`, `blob`, `longBlob`
- Relations : `foreignId`, `foreignUuid`, `foreignUlid`, `morphs`
- Spéciaux : `geometry`, `point`, `vector`, `rememberToken`

## Ce qui est généré

Selon la configuration de génération, `stack-init` peut produire :

- `app/Models/Name.php`
- `database/migrations/TIMESTAMP_create_names_table.php`
- `app/Http/Controllers/Api/NameController.php`
- `app/Http/Resources/NameResource.php`
- `app/Http/Requests/StoreNameRequest.php` et `UpdateNameRequest.php`
- `app/Policies/NamePolicy.php`
- `database/factories/NameFactory.php`
- `app/Services/NameService.php`
- `tests/Feature/NameTest.php`
- `Makefile` ou `run.sh`

## Architecture du monorepo

```
stack-init-cli/
├── packages/
│   ├── schema/   # @stack-init/schema — validation et types partagés
│   └── cli/      # stack-init — implémentation de la commande
├── stack-init.yaml   # exemple de configuration
└── pnpm-workspace.yaml
```

## Packages principaux

- `packages/schema` : schémas Zod et types partagés
- `packages/cli` : application CLI avec commander, handlebars et js-yaml

## Scripts utiles

- `pnpm build` : compile tous les packages du monorepo
- `pnpm dev` : lance une compilation en mode watch
- `pnpm test` : exécute les tests sur tous les packages
- `pnpm clean` : supprime les fichiers compilés

## Développement

1. Installer les dépendances : `pnpm install`
2. Compiler le monorepo : `pnpm build`
3. Modifier les templates ou le code du CLI
4. Tester localement avec `pnpm dev` ou `stack-init generate --dry-run`

## Contribution

- Ouvrez une issue pour proposer une amélioration
- Créez une branche dédiée pour chaque fonctionnalité
- Assurez-vous que le CLI et les templates fonctionnent avant de proposer une PR
