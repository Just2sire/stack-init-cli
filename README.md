# stack-init

`stack-init` est un générateur de code Laravel qui crée automatiquement les modèles, migrations, contrôleurs, ressources, requêtes, policies, factories et tests à partir d'un fichier YAML de configuration.

## Fonctionnalités

- Génération de code Laravel basée sur une configuration YAML simple
- Support des modèles, migrations, contrôleurs API, ressources, requests, policies, factories et tests
- Architecture monorepo avec un package CLI et un package de schema partagé
- Support des champs Laravel courants et des relations Eloquent

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

Depuis un projet Laravel, créez un fichier `stack-init.yaml` et lancez :

```bash
stack-init generate
```

### Options principales

```bash
stack-init generate --config chemin/vers/stack-init.yaml
stack-init generate --output /chemin/vers/projet
stack-init generate --dry-run   # affiche les fichiers générés sans écrire
```

## Exemple de configuration `stack-init.yaml`

```yaml
name: mon-projet
stack: laravel

models:
  - name: Post
    fields:
      - { name: title, type: string }
      - { name: body, type: longText }
      - { name: user_id, type: foreignId, references: users }
    relations:
      - { type: belongsTo, model: User }
    migration:
      timestamps: true
      softDeletes: true
    generate:
      migration: true
      resource: true
      request: true
      factory: true
      policy: false
      tests: true

laravel:
  auth: sanctum
  runner: makefile
  db_engine: mysql
```

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
