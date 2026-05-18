# Changelog

All notable changes to this project will be documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- ESLint + Prettier configuration at monorepo root
- Unit tests for `packages/cli` utils (`naming`, `field-helpers`)
- CHANGELOG.md

### Fixed
- Missing exports (`fastapi.schema`, `combos.schema`) in `packages/schema/src/index.ts`
- `ForeignUuidFieldSchema` and `ForeignUlidFieldSchema` missing `on_update` field
- `FIELD_TYPES_WITH_PARAMS` missing `on_update` for foreign key types
- `add.ts`: strict equality `=== 'nestjs'` replaced with `.includes('nestjs')` for multi-stack support

## [0.1.0] - 2026-05-15

### Added
- Initial monorepo setup with `cli` and `schema` packages
- Support for Laravel, Express, NestJS, FastAPI, Next.js, React stacks
- Schema validation with Zod
- CLI commands: `generate`, `add`, `rollback`
- Handlebars templates for Laravel, Express, NestJS
- Rollback via `.stack-init-manifest.json`
