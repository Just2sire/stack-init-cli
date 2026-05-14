import type { ProjectConfig } from '@stack-init/schema'

export function generateMakefile(config: ProjectConfig): string {
  const name    = config.name
  const hasSwagger = config.models.some(m => m.generate.swagger)
  const isSanctum  = config.laravel?.auth === 'sanctum'

  return `# Makefile — généré par stack-init pour ${name}
# Usage : make setup

.PHONY: setup install migrate seed fresh routes test${hasSwagger ? ' swagger' : ''}

setup: install migrate seed
\t@echo "✅ ${name} est prêt"

install:
\tcomposer install --no-interaction
\tcp .env.example .env
\tphp artisan key:generate

migrate:
\tphp artisan migrate --force

seed:
\tphp artisan db:seed

fresh:
\tphp artisan migrate:fresh --seed

routes:
\tphp artisan route:list --path=api
${isSanctum ? `
sanctum:
\tphp artisan vendor:publish --provider="Laravel\\\\Sanctum\\\\SanctumServiceProvider"
` : ''}
test:
\t./vendor/bin/pest
${hasSwagger ? `
swagger:
\tphp artisan l5-swagger:generate
` : ''}
`
}

export function generateBashRunner(config: ProjectConfig): string {
  const hasSwagger = config.models.some(m => m.generate.swagger)
  return `#!/bin/bash
# run.sh — généré par stack-init pour ${config.name}
set -e
echo "🚀 Initialisation de ${config.name}..."
composer install --no-interaction
cp .env.example .env
php artisan key:generate
php artisan migrate --force
php artisan db:seed
${hasSwagger ? 'php artisan l5-swagger:generate' : ''}
echo "✅ Done."
`
}
