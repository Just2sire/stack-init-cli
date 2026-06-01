# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

## [0.2.0] - 2026-06-01

### Added
- Commandes `validate` et `diff` pour inspecter un YAML sans générer de fichiers
- Support FastAPI étendu : routers async, schémas Pydantic, dépendances FastAPI
- Support NestJS étendu : architecture CQRS, layered, modulaire
- Templates Handlebars NestJS complets (module, controller, service, DTO, entity)
- Documentation complète (README 637 lignes avec exemples YAML et structure de dossiers)
- ESLint + Prettier configurés au niveau monorepo root
- Tests unitaires pour les utilitaires `naming` et `field-helpers`
- `SECURITY.md` — politique de divulgation responsable
- `CODE_OF_CONDUCT.md` — Contributor Covenant v2.1
- Métadonnées npm complètes sur tous les packages (author, license, repository, bugs, engines)
- Champ `exports` dans `@stack-init/schema` pour la résolution par les bundlers modernes
- GitHub Actions CI (lint + build + test sur push/PR)
- Templates PR et CODEOWNERS pour la gestion des contributions

### Fixed
- Exports manquants (`fastapi.schema`, `combos.schema`) dans `packages/schema/src/index.ts`
- `ForeignUuidFieldSchema` et `ForeignUlidFieldSchema` : champ `on_update` manquant
- `FIELD_TYPES_WITH_PARAMS` : `on_update` manquant pour les types foreign key
- `add.ts` : égalité stricte `=== 'nestjs'` remplacée par `.includes('nestjs')` pour le support multi-stack
- Nom du binaire CLI harmonisé : `"stack-init-cli"` → `"stack-init"` dans `packages/cli/package.json`

## [0.1.0] - 2026-05-15

### Added
- Initial monorepo setup with `cli` and `schema` packages
- Support for Laravel, Express, NestJS, FastAPI, Next.js, React stacks
- Schema validation with Zod
- CLI commands: `generate`, `add`, `rollback`
- Handlebars templates for Laravel, Express, NestJS
- Rollback via `.stack-init-manifest.json`
