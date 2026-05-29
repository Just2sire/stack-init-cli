import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export function generateCICD(config: ProjectConfig): GeneratedFile[] {
  const stack = config.stack
  const isMixed = stack.includes('+')

  const files: GeneratedFile[] = []

  if (isMixed) {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateMixedWorkflow(config) })
  } else if (stack === 'laravel') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateLaravelWorkflow(config) })
  } else if (stack === 'fastapi') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateFastAPIWorkflow(config) })
  } else if (stack === 'express' || stack === 'nestjs') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateNodeWorkflow(config) })
  } else if (stack === 'nextjs' || stack === 'react') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateFrontendWorkflow(config) })
  } else if (stack === 't3') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateT3Workflow(config) })
  } else if (stack === 'django') {
    files.push({ outputPath: '.github/workflows/ci.yml', content: generateDjangoWorkflow(config) })
  }

  return files
}

// ─── Workflow helpers ──────────────────────────────────────────────────────────

function onBlock(): string {
  return `on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
`
}

function checkoutStep(indent = 6): string {
  return `${' '.repeat(indent)}- uses: actions/checkout@v4`
}

function generateNodeWorkflow(config: ProjectConfig): string {
  const name = config.name
  return `name: CI — ${name}

${onBlock()}
jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    steps:
${checkoutStep()}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm test --if-present
`
}

function generateFrontendWorkflow(config: ProjectConfig): string {
  const name = config.name
  return `name: CI — ${name}

${onBlock()}
jobs:
  build-and-test:
    name: Build & Test
    runs-on: ubuntu-latest

    steps:
${checkoutStep()}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Type check
        run: npm run typecheck --if-present

      - name: Test
        run: npm test --if-present

      - name: Build
        run: npm run build
`
}

function generateFastAPIWorkflow(config: ProjectConfig): string {
  const name = config.name
  const pythonVersion = config.fastapi?.python_version ?? '3.11'
  return `name: CI — ${name}

${onBlock()}
jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    steps:
${checkoutStep()}

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '${pythonVersion}'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Install dev tools
        run: pip install ruff pytest

      - name: Lint (ruff)
        run: ruff check .

      - name: Test
        run: pytest --tb=short
`
}

function generateLaravelWorkflow(config: ProjectConfig): string {
  const name = config.name
  const phpVersion = config.laravel?.php_version ?? '8.4'
  return `name: CI — ${name}

${onBlock()}
jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    steps:
${checkoutStep()}

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '${phpVersion}'
          extensions: mbstring, bcmath, pdo_sqlite
          coverage: none

      - name: Copy .env
        run: cp .env.example .env

      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist --optimize-autoloader

      - name: Generate app key
        run: php artisan key:generate

      - name: Run migrations (SQLite)
        run: php artisan migrate --force

      - name: Run tests
        run: php artisan test
`
}

function generateDjangoWorkflow(config: ProjectConfig): string {
  const name = config.name
  return `name: CI — ${name}

${onBlock()}
jobs:
  lint-and-test:
    name: Lint & Test
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_DB: ${name}_test
          POSTGRES_USER: user
          POSTGRES_PASSWORD: password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
${checkoutStep()}

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Run migrations
        env:
          DATABASE_URL: postgresql://user:password@localhost:5432/${name}_test
          SECRET_KEY: ci-secret-key
          DEBUG: "True"
        run: python manage.py migrate

      - name: Run tests
        env:
          DATABASE_URL: postgresql://user:password@localhost:5432/${name}_test
          SECRET_KEY: ci-secret-key
          DEBUG: "True"
        run: python manage.py test
`
}

function generateT3Workflow(config: ProjectConfig): string {
  const name = config.name
  return `name: CI — ${name}

${onBlock()}
jobs:
  build-and-test:
    name: Build & Test
    runs-on: ubuntu-latest

    steps:
${checkoutStep()}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma client
        run: npx prisma generate

      - name: Lint
        run: npm run lint --if-present

      - name: Type check
        run: npm run typecheck --if-present

      - name: Build
        run: npm run build
`
}

function generateMixedWorkflow(config: ProjectConfig): string {
  const stack = config.stack
  const name   = config.name

  const hasLaravel = stack.includes('laravel')
  const hasFastAPI = stack.includes('fastapi')
  const hasExpress = stack.includes('express')
  const hasNest    = stack.includes('nestjs')
  const hasNextjs  = stack.includes('nextjs')
  const hasReact   = stack.includes('react') && !stack.includes('nextjs')

  const phpVersion    = config.laravel?.php_version   ?? '8.4'
  const pythonVersion = config.fastapi?.python_version ?? '3.11'

  let backendJob: string
  if (hasLaravel) {
    backendJob = `  backend:
    name: Backend — Laravel
    runs-on: ubuntu-latest
    steps:
${checkoutStep()}

      - name: Setup PHP
        uses: shivammathur/setup-php@v2
        with:
          php-version: '${phpVersion}'
          extensions: mbstring, bcmath, pdo_sqlite
          coverage: none

      - name: Copy .env
        run: cp .env.example .env

      - name: Install Composer dependencies
        run: composer install --no-interaction --prefer-dist --optimize-autoloader

      - name: Generate app key
        run: php artisan key:generate

      - name: Run migrations (SQLite)
        run: php artisan migrate --force

      - name: Run tests
        run: php artisan test
`
  } else if (hasFastAPI) {
    backendJob = `  backend:
    name: Backend — FastAPI
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
${checkoutStep()}

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '${pythonVersion}'

      - name: Install dependencies
        run: pip install -r requirements.txt

      - name: Install dev tools
        run: pip install ruff pytest

      - name: Lint (ruff)
        run: ruff check .

      - name: Test
        run: pytest --tb=short
`
  } else {
    const backendLabel = hasNest ? 'NestJS' : 'Express'
    backendJob = `  backend:
    name: Backend — ${backendLabel}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: backend
    steps:
${checkoutStep()}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Test
        run: npm test --if-present
`
  }

  const frontendLabel = hasNextjs ? 'Next.js' : 'React (Vite)'
  const frontendJob = `  frontend:
    name: Frontend — ${frontendLabel}
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: frontend
    steps:
${checkoutStep()}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint --if-present

      - name: Type check
        run: npm run typecheck --if-present

      - name: Build
        run: npm run build
`

  const hasFrontend = hasNextjs || hasReact

  return `name: CI — ${name}

${onBlock()}
jobs:
${backendJob}
${hasFrontend ? frontendJob : ''}`
}
