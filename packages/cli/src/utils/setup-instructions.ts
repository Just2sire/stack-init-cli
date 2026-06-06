import { execSync } from 'node:child_process'
import pc from 'picocolors'
import type { ProjectConfig } from '@stack-init/schema'
import { isMixedStack } from '@stack-init/schema'
import { getVersions } from '../config/versions'

// ─── version detection ───────────────────────────────────────────────────────

interface InstalledVersions {
  node: string | null
  php: string | null
  python: string | null
  composer: string | null
}

function tryExec(cmd: string): string | null {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

function detectInstalledVersions(): InstalledVersions {
  const node    = tryExec('node -v')?.replace(/^v/, '') ?? null
  const php     = tryExec('php -r "echo PHP_VERSION;"') ?? null
  const python  = tryExec('python --version')?.split(' ')[1] ?? tryExec('python3 --version')?.split(' ')[1] ?? null
  const composer = tryExec('composer --version')?.match(/Composer version (\S+)/)?.[1] ?? null
  return { node, php, python, composer }
}

// ─── config accessors ────────────────────────────────────────────────────────

function getORM(config: ProjectConfig): string {
  const stack = config.stack as string
  if (stack.includes('express')) return (config as any).express?.orm ?? 'prisma'
  if (stack.includes('nestjs')) return (config as any).nestjs?.orm ?? 'typeorm'
  if (stack.includes('fastapi')) return (config as any).fastapi?.orm ?? 'sqlmodel'
  if (stack.includes('laravel')) return 'eloquent'
  return config.models.length > 0 ? 'prisma' : 'none'
}

function getDbEngine(config: ProjectConfig): string {
  const stack = config.stack as string
  if (stack.includes('express')) return (config as any).express?.db_engine ?? 'postgresql'
  if (stack.includes('nestjs')) return (config as any).nestjs?.db_engine ?? 'postgresql'
  if (stack.includes('fastapi')) return (config as any).fastapi?.db_engine ?? 'postgresql'
  if (stack.includes('laravel')) return (config as any).laravel?.db_engine ?? 'mysql'
  return 'postgresql'
}

function getAuth(config: ProjectConfig): string {
  const stack = config.stack as string
  if (stack.includes('express')) return (config as any).express?.auth ?? 'none'
  if (stack.includes('nestjs')) return (config as any).nestjs?.auth ?? 'none'
  if (stack.includes('fastapi')) return (config as any).fastapi?.auth ?? 'none'
  if (stack.includes('laravel')) return (config as any).laravel?.auth ?? 'none'
  return 'none'
}

function getBackendPort(config: ProjectConfig): number {
  const stack = config.stack as string
  if (stack.includes('express')) return (config as any).express?.port ?? 3000
  if (stack.includes('fastapi')) return 8000
  if (stack.includes('laravel')) return 8000
  return 3000
}

function getFrontendPort(stack: string): number {
  // Next.js as frontend in a mixed stack uses port 3000
  // React (Vite) uses 5173
  if (stack.startsWith('fastapi+nextjs') || stack.startsWith('express+nextjs') ||
      stack.startsWith('nestjs+nextjs') || stack.startsWith('laravel+nextjs')) return 3000
  return 5173
}

function dbUrl(engine: string, name: string): string {
  const n = name.replace(/-/g, '_')
  switch (engine) {
    case 'mysql':    return `mysql://root:password@localhost:3306/${n}`
    case 'sqlite':   return `file:./dev.db`
    case 'mongodb':  return `mongodb://localhost:27017/${n}`
    default:         return `postgresql://postgres:password@localhost:5432/${n}`
  }
}

function ormLabel(orm: string): string {
  const labels: Record<string, string> = {
    prisma: 'Prisma', drizzle: 'Drizzle ORM', typeorm: 'TypeORM',
    sequelize: 'Sequelize', mongoose: 'Mongoose', sqlmodel: 'SQLModel',
    sqlalchemy: 'SQLAlchemy', 'tortoise-orm': 'Tortoise ORM', beanie: 'Beanie',
    eloquent: 'Eloquent (intégré Laravel)', none: 'Aucun',
  }
  return labels[orm] ?? orm
}

function dbLabel(engine: string): string {
  const labels: Record<string, string> = {
    postgresql: 'PostgreSQL', mysql: 'MySQL', sqlite: 'SQLite',
    mongodb: 'MongoDB', sqlsrv: 'SQL Server',
  }
  return labels[engine] ?? engine
}

function authLabel(auth: string): string {
  const labels: Record<string, string> = {
    jwt: 'JWT', session: 'Session', oauth2: 'OAuth2',
    'api-key': 'API Key', sanctum: 'Laravel Sanctum',
    passport: 'Laravel Passport', breeze: 'Laravel Breeze',
    jetstream: 'Laravel Jetstream', none: 'Aucune',
  }
  return labels[auth] ?? auth
}

// ─── section builders ─────────────────────────────────────────────────────────

function buildQuickStart(config: ProjectConfig, mixed: boolean): string[] {
  const stack = config.stack as string
  const lines: string[] = []

  lines.push('## Démarrage rapide')
  lines.push('')
  lines.push('Des scripts prêts à l\'emploi sont inclus dans le projet — pas besoin de tout faire à la main.')
  lines.push('')
  lines.push('| Script | Plateforme | Ce qu\'il fait |')
  lines.push('|--------|-----------|---------------|')
  lines.push('| `setup.sh` | Linux / macOS / WSL | Installe les dépendances, copie `.env`, initialise la base de données |')
  lines.push('| `setup.ps1` | Windows PowerShell | Idem |')
  lines.push('| `setup.bat` | Windows CMD | Idem |')
  if (mixed) {
    lines.push('| `dev.sh` | Linux / macOS / WSL | Lance backend + frontend en parallèle |')
    lines.push('| `dev.ps1` | Windows PowerShell | Idem |')
    lines.push('| `dev.bat` | Windows CMD | Idem |')
  }
  lines.push('')
  lines.push('**3 commandes pour démarrer :**')
  lines.push('')
  lines.push('```bash')
  lines.push('# 1. Configurer les variables d\'environnement (voir section 3 pour les valeurs)')
  lines.push('cp .env.example .env          # Linux / macOS / WSL')
  lines.push('copy .env.example .env        # Windows CMD')
  lines.push('')
  lines.push('# 2. Installer les dépendances + initialiser la base de données')
  lines.push('bash setup.sh                 # Linux / macOS / WSL')
  lines.push('.\\setup.ps1                  # Windows PowerShell')
  lines.push('setup.bat                     # Windows CMD')
  lines.push('')
  if (mixed) {
    lines.push('# 3. Lancer le projet (backend + frontend en parallèle)')
    lines.push('bash dev.sh                   # Linux / macOS / WSL')
    lines.push('.\\dev.ps1                    # Windows PowerShell')
    lines.push('dev.bat                       # Windows CMD')
  } else if (stack.includes('fastapi')) {
    lines.push('# 3. Lancer le projet')
    lines.push('source .venv/bin/activate && uvicorn app.main:app --reload')
  } else if (stack.includes('laravel')) {
    lines.push('# 3. Lancer le projet')
    lines.push('php artisan serve')
  } else {
    lines.push('# 3. Lancer le projet')
    lines.push('npm run dev')
  }
  lines.push('```')
  lines.push('')
  lines.push('> Les sections numérotées ci-dessous détaillent chaque étape pour référence ou pour une exécution manuelle.')
  lines.push('')
  return lines
}

function buildStackSummary(config: ProjectConfig, mixed: boolean): string[] {
  const stack  = config.stack as string
  const orm    = getORM(config)
  const engine = getDbEngine(config)
  const auth   = getAuth(config)
  const port   = getBackendPort(config)
  const lines: string[] = []

  lines.push('## Ce qui a été généré')
  lines.push('')
  lines.push('| Composant | Valeur |')
  lines.push('|-----------|--------|')

  if (stack.includes('laravel')) {
    lines.push(`| **Backend** | Laravel (PHP) |`)
    const pattern = (config as any).laravel?.pattern ?? 'api-only'
    lines.push(`| **Pattern** | ${pattern} |`)
  } else if (stack.includes('fastapi')) {
    lines.push(`| **Backend** | FastAPI (Python) |`)
  } else if (stack.includes('nestjs')) {
    lines.push(`| **Backend** | NestJS (TypeScript) |`)
  } else if (stack.includes('express')) {
    lines.push(`| **Backend** | Express.js (TypeScript) |`)
  } else if (stack === 'nextjs') {
    lines.push(`| **Framework** | Next.js (TypeScript) |`)
  } else if (stack === 'react') {
    lines.push(`| **Frontend** | React + Vite (TypeScript) |`)
  }

  if (orm !== 'none' && stack !== 'react') {
    lines.push(`| **ORM** | ${ormLabel(orm)} |`)
    lines.push(`| **Base de données** | ${dbLabel(engine)} |`)
  }

  if (auth !== 'none') {
    lines.push(`| **Auth** | ${authLabel(auth)} |`)
  }

  if (mixed) {
    const fePort = getFrontendPort(stack)
    if (stack.includes('nextjs')) {
      lines.push(`| **Frontend** | Next.js |`)
      lines.push(`| **URL frontend** | http://localhost:${fePort} |`)
    } else if (stack.includes('react') || stack.includes('mern') || stack.includes('pern') || stack.includes('mevn')) {
      lines.push(`| **Frontend** | React + Vite |`)
      lines.push(`| **URL frontend** | http://localhost:${fePort} |`)
    }
    lines.push(`| **URL backend** | http://localhost:${port} |`)
  } else if (!stack.includes('react') && stack !== '') {
    lines.push(`| **URL** | http://localhost:${port}${stack.includes('fastapi') ? '/docs' : ''} |`)
  }

  const models = config.models.map(m => m.name).join(', ')
  if (models) lines.push(`| **Modèles générés** | ${models} |`)

  lines.push('')
  return lines
}

function buildProjectStructure(config: ProjectConfig): string[] {
  const stack = config.stack as string
  const port  = getBackendPort(config)
  const fePort = getFrontendPort(stack)
  const lines: string[] = []

  lines.push('## Structure du projet')
  lines.push('')
  lines.push('```')
  lines.push(`${config.name}/`)
  lines.push(`├── backend/     ← API backend  (http://localhost:${port})`)
  lines.push(`├── frontend/    ← Application  (http://localhost:${fePort})`)
  lines.push(`├── setup.sh     ← Installation tout-en-un (Linux/macOS/WSL)`)
  lines.push(`├── setup.ps1    ← Installation tout-en-un (Windows PowerShell)`)
  lines.push(`├── dev.sh       ← Lance backend + frontend ensemble (Linux/macOS/WSL)`)
  lines.push(`└── dev.ps1      ← Lance backend + frontend ensemble (Windows PowerShell)`)
  lines.push('```')
  lines.push('')
  return lines
}

function buildPrerequisitesTable(config: ProjectConfig): string[] {
  const stack  = config.stack as string
  const engine = getDbEngine(config)
  const v      = getVersions()
  const lines: string[] = []

  lines.push('## 1. Prérequis')
  lines.push('')
  lines.push('| Outil | Version requise | Vérifier | Installer |')
  lines.push('|-------|----------------|----------|-----------|')

  const needsNode = stack.includes('express') || stack.includes('nestjs') ||
                    stack.includes('nextjs') || stack.includes('react') ||
                    stack.includes('mern') || stack.includes('pern') || stack.includes('mevn')
  const needsPython = stack.includes('fastapi')
  const needsPhp = stack.includes('laravel')

  if (needsNode) {
    lines.push(`| **Node.js** | ${v.runtimes.node} LTS | \`node -v\` | https://nodejs.org |`)
    lines.push(`| **npm** | 10+ | \`npm -v\` | Inclus avec Node.js |`)
  }
  if (needsPython) {
    lines.push(`| **Python** | ${v.runtimes.python}+ | \`python --version\` | https://python.org/downloads |`)
    lines.push(`| **pip** | inclus | \`pip --version\` | Inclus avec Python |`)
  }
  if (needsPhp) {
    lines.push(`| **PHP** | ${v.runtimes.php}+ | \`php -v\` | https://php.net/downloads |`)
    lines.push(`| **Composer** | 2+ | \`composer --version\` | https://getcomposer.org |`)
  }

  // DB server prerequisite
  if (engine === 'postgresql') {
    lines.push(`| **PostgreSQL** | 14+ | \`psql --version\` | https://postgresql.org/download |`)
  } else if (engine === 'mysql') {
    lines.push(`| **MySQL** | 8+ | \`mysql --version\` | https://dev.mysql.com/downloads/mysql |`)
  } else if (engine === 'mongodb') {
    lines.push(`| **MongoDB** | 6+ | \`mongod --version\` | https://mongodb.com/try/download/community |`)
  }

  lines.push('')
  return lines
}

function buildNavigateSection(config: ProjectConfig): string[] {
  return [
    '## 2. Se placer dans le projet',
    '',
    '```bash',
    `cd ${config.name}`,
    '```',
    '',
  ]
}

function buildEnvSection(config: ProjectConfig, mixed: boolean): string[] {
  const stack  = config.stack as string
  const orm    = getORM(config)
  const engine = getDbEngine(config)
  const auth   = getAuth(config)
  const port   = getBackendPort(config)
  const name   = config.name.replace(/-/g, '_')
  const lines: string[] = []

  lines.push('## 3. Configurer les variables d\'environnement')
  lines.push('')

  // Laravel uses its own .env format (no DATABASE_URL)
  if (stack.includes('laravel')) {
    lines.push('### Backend — `.env`')
    lines.push('')
    lines.push('```bash')
    lines.push('# Linux / macOS / WSL')
    lines.push('cp .env.example .env')
    lines.push('')
    lines.push('# Windows')
    lines.push('copy .env.example .env')
    lines.push('```')
    lines.push('')
    lines.push('Ouvrir `.env` et remplir les valeurs :')
    lines.push('')
    lines.push('```dotenv')
    lines.push(`APP_NAME="${config.name}"`)
    lines.push('APP_ENV=local')
    lines.push('APP_KEY=    # sera générée par php artisan key:generate')
    lines.push('APP_DEBUG=true')
    lines.push('APP_URL=http://localhost:8000')
    lines.push('')
    const dbConn = engine === 'pgsql' || engine === 'postgresql' ? 'pgsql' : (engine === 'sqlite' ? 'sqlite' : 'mysql')
    lines.push(`DB_CONNECTION=${dbConn}`)
    if (engine !== 'sqlite') {
      lines.push('DB_HOST=127.0.0.1')
      lines.push(`DB_PORT=${engine === 'postgresql' || engine === 'pgsql' ? '5432' : '3306'}`)
      lines.push(`DB_DATABASE=${name}`)
      lines.push('DB_USERNAME=root')
      lines.push('DB_PASSWORD=')
    }
    lines.push('```')
    lines.push('')

    if (engine === 'postgresql' || engine === 'pgsql') {
      lines.push('> **PostgreSQL** — créer la base de données d\'abord :')
      lines.push('>')
      lines.push('> ```bash')
      lines.push(`> psql -U postgres -c "CREATE DATABASE ${name};"`)
      lines.push('> ```')
      lines.push('')
    } else if (engine === 'mysql') {
      lines.push('> **MySQL** — créer la base de données d\'abord :')
      lines.push('>')
      lines.push('> ```bash')
      lines.push(`> mysql -u root -p -e "CREATE DATABASE \\\`${name}\\\`;"`)
      lines.push('> ```')
      lines.push('')
    }
    return lines
  }

  // Node.js / Python stacks
  const backendDir = mixed ? 'backend/' : ''
  const envFile = stack === 'nextjs' ? '.env.local' : '.env'
  const envExample = stack === 'nextjs' ? '.env.local.example' : '.env.example'

  if (!stack.includes('react') || mixed) {
    lines.push(`### Backend — \`${envFile}\``)
    lines.push('')
    lines.push('```bash')
    lines.push(`# Linux / macOS / WSL${backendDir ? `  (depuis le dossier ${backendDir})` : ''}`)
    lines.push(`cp ${envExample} ${envFile}`)
    lines.push('')
    lines.push('# Windows')
    lines.push(`copy ${envExample} ${envFile}`)
    lines.push('```')
    lines.push('')
    lines.push(`Ouvrir \`${envFile}\` et remplir les valeurs :`)
    lines.push('')
    lines.push('```dotenv')

    if (orm !== 'none') {
      const url = dbUrl(engine, config.name)
      // Next.js with Prisma needs ?schema=public for PostgreSQL
      const suffix = (stack === 'nextjs' && engine === 'postgresql') ? '?schema=public' : ''
      lines.push(`DATABASE_URL="${url}${suffix}"`)
    }

    if (!stack.includes('fastapi') && !stack.includes('nextjs')) {
      lines.push(`PORT=${port}`)
    }

    if (auth === 'jwt') {
      lines.push('JWT_SECRET="remplacer-par-une-chaine-aleatoire-32-caracteres-minimum"')
      lines.push('JWT_EXPIRES_IN="7d"')
    } else if (auth === 'session') {
      lines.push('SESSION_SECRET="remplacer-par-une-chaine-aleatoire-32-caracteres-minimum"')
    } else if (auth === 'oauth2') {
      lines.push('SECRET_KEY="remplacer-par-une-chaine-aleatoire-32-caracteres-minimum"')
      lines.push('ACCESS_TOKEN_EXPIRE_MINUTES=30')
    } else if (auth === 'api-key') {
      lines.push('API_KEY_SECRET="remplacer-par-une-chaine-aleatoire"')
    }

    if (stack.includes('fastapi')) {
      lines.push('ENVIRONMENT=development')
    }

    if (stack === 'nextjs') {
      lines.push('NEXT_PUBLIC_APP_URL="http://localhost:3000"')
    }

    lines.push('```')
    lines.push('')

    // Database creation hint for PostgreSQL / MySQL (not SQLite, not MongoDB)
    if (engine === 'postgresql') {
      lines.push('> **PostgreSQL** — créer la base de données d\'abord :')
      lines.push('>')
      lines.push('> ```bash')
      lines.push(`> psql -U postgres -c "CREATE DATABASE ${name};"`)
      lines.push('> ```')
      lines.push('>')
      lines.push('> Ou via pgAdmin / DBeaver si tu préfères une interface graphique.')
      lines.push('')
    } else if (engine === 'mysql') {
      lines.push('> **MySQL** — créer la base de données d\'abord :')
      lines.push('>')
      lines.push('> ```bash')
      lines.push(`> mysql -u root -p -e "CREATE DATABASE \\\`${name}\\\`;"`)
      lines.push('> ```')
      lines.push('')
    }
  }

  // Frontend .env for mixed stacks
  if (mixed && (stack.includes('react') || stack.includes('nextjs'))) {
    const isFrontendNextjs = stack.startsWith('fastapi+nextjs') || stack.startsWith('express+nextjs') ||
                             stack.startsWith('nestjs+nextjs') || stack.startsWith('laravel+nextjs')
    const feEnvFile = isFrontendNextjs ? '.env.local' : '.env'
    const feEnvExample = isFrontendNextjs ? '.env.local.example' : '.env.example'
    // React (Vite) uses REACT_APP_API_URL; Next.js uses NEXT_PUBLIC_API_URL
    const feEnvVar = isFrontendNextjs ? 'NEXT_PUBLIC_API_URL' : 'REACT_APP_API_URL'
    lines.push(`### Frontend — \`frontend/${feEnvFile}\``)
    lines.push('')
    lines.push('```bash')
    lines.push('cd frontend')
    lines.push(`cp ${feEnvExample} ${feEnvFile}`)
    lines.push('cd ..')
    lines.push('```')
    lines.push('')
    lines.push(`Valeur à renseigner dans \`frontend/${feEnvFile}\` :`)
    lines.push('')
    lines.push('```dotenv')
    lines.push(`${feEnvVar}="http://localhost:${port}"`)
    lines.push('```')
    lines.push('')
  }

  return lines
}

function buildInstallSection(config: ProjectConfig, mixed: boolean): string[] {
  const stack     = config.stack as string
  const isNode    = stack.includes('express') || stack.includes('nestjs') ||
                    stack.includes('nextjs') || stack.includes('react') ||
                    stack.includes('mern') || stack.includes('pern') || stack.includes('mevn')
  const isPython  = stack.includes('fastapi')
  const isPhp     = stack.includes('laravel')
  const hasSwagger = isPhp && config.models.some(m => (m.generate as any)?.swagger)
  const lines: string[] = []

  lines.push('## 4. Installer les dépendances')
  lines.push('')

  // Packages supplémentaires pour Laravel + Swagger
  if (hasSwagger) {
    lines.push('### Packages supplémentaires inclus')
    lines.push('')
    lines.push('| Package | Version | Utilité |')
    lines.push('|---------|---------|---------|')
    lines.push('| `darkaonline/l5-swagger` | ^8.6 | Documentation API OpenAPI / Swagger UI |')
    lines.push('')
    lines.push('> Ces packages sont installés automatiquement par `setup.sh` via `composer require`.')
    lines.push('> La documentation Swagger sera disponible sur → **http://localhost:8000/api/documentation**')
    lines.push('> Consulter `SWAGGER_SETUP.md` pour la configuration détaillée.')
    lines.push('')
  }

  lines.push('### Option A — Scripts tout-en-un (recommandé)')
  lines.push('')
  lines.push('```bash')
  lines.push('# Linux / macOS / WSL')
  lines.push('bash setup.sh')
  lines.push('')
  lines.push('# Windows PowerShell')
  lines.push('.\\setup.ps1')
  lines.push('')
  lines.push('# Windows CMD')
  lines.push('setup.bat')
  lines.push('```')
  lines.push('')
  const scriptDesc = hasSwagger
    ? '> Ces scripts font tout automatiquement : dépendances, installation Swagger (`composer require` + `vendor:publish`), copie du `.env`, migrations, et génération de la doc OpenAPI.'
    : '> Ces scripts font tout automatiquement : installation des dépendances, copie du `.env`, et initialisation de la base de données.'
  lines.push(scriptDesc)
  lines.push('')
  lines.push('### Option B — Étape par étape')
  lines.push('')

  if (mixed) {
    lines.push('#### Backend')
    lines.push('')
    lines.push('```bash')
    lines.push('cd backend')
    if (isPython) {
      lines.push('python -m venv .venv')
      lines.push('')
      lines.push('# Linux / macOS / WSL')
      lines.push('source .venv/bin/activate')
      lines.push('')
      lines.push('# Windows PowerShell')
      lines.push('.venv\\Scripts\\Activate.ps1')
      lines.push('')
      lines.push('pip install -r requirements.txt')
    } else if (isPhp) {
      lines.push('composer install --no-interaction')
    } else {
      lines.push('npm install')
    }
    lines.push('cd ..')
    lines.push('```')
    lines.push('')
    lines.push('#### Frontend')
    lines.push('')
    lines.push('```bash')
    lines.push('cd frontend')
    lines.push('npm install')
    lines.push('cd ..')
    lines.push('```')
  } else {
    lines.push('```bash')
    if (isPython) {
      lines.push('python -m venv .venv')
      lines.push('')
      lines.push('# Linux / macOS / WSL')
      lines.push('source .venv/bin/activate')
      lines.push('')
      lines.push('# Windows PowerShell')
      lines.push('.venv\\Scripts\\Activate.ps1')
      lines.push('')
      lines.push('pip install -r requirements.txt')
    } else if (isPhp) {
      lines.push('composer install --no-interaction')
    } else {
      lines.push('npm install')
    }
    lines.push('```')
  }

  lines.push('')
  return lines
}

function buildDbInitSection(config: ProjectConfig, mixed: boolean): string[] {
  const orm   = getORM(config)
  const stack = config.stack as string
  const dir   = mixed ? 'backend/' : ''
  const lines: string[] = []

  // ORM types that need explicit migration commands
  const needsMigration = ['prisma', 'drizzle', 'typeorm', 'sequelize', 'sqlmodel', 'sqlalchemy', 'tortoise-orm']
  if (!needsMigration.includes(orm)) return lines  // mongoose, beanie, eloquent, none → skip

  lines.push('## 5. Initialiser la base de données')
  lines.push('')

  if (orm === 'prisma') {
    if (dir) {
      lines.push('```bash')
      lines.push(`cd ${dir.replace('/', '')}`)
    } else {
      lines.push('```bash')
    }
    lines.push('npx prisma generate        # génère le client TypeScript')
    lines.push('npx prisma migrate dev     # applique toutes les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
    lines.push('')
    lines.push('> Si tu vois `Error: Database does not exist`, assure-toi d\'avoir créé la base de données à l\'étape 3.')
  } else if (orm === 'drizzle') {
    lines.push('```bash')
    if (dir) lines.push(`cd ${dir.replace('/', '')}`)
    lines.push('npx drizzle-kit generate   # génère les fichiers de migration')
    lines.push('npx drizzle-kit migrate    # applique les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
  } else if (orm === 'typeorm') {
    lines.push('```bash')
    if (dir) lines.push(`cd ${dir.replace('/', '')}`)
    lines.push('npm run migration:run      # applique toutes les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
  } else if (orm === 'sequelize') {
    lines.push('```bash')
    if (dir) lines.push(`cd ${dir.replace('/', '')}`)
    lines.push('npx sequelize-cli db:migrate   # applique toutes les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
  } else if (orm === 'sqlmodel' || orm === 'sqlalchemy') {
    lines.push('```bash')
    if (dir) {
      lines.push(`cd ${dir.replace('/', '')}`)
      lines.push('source .venv/bin/activate   # si le venv n\'est pas encore activé')
    }
    lines.push('alembic upgrade head       # applique toutes les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
  } else if (orm === 'tortoise-orm') {
    lines.push('```bash')
    if (dir) {
      lines.push(`cd ${dir.replace('/', '')}`)
      lines.push('source .venv/bin/activate   # si le venv n\'est pas encore activé')
    }
    lines.push('aerich upgrade             # applique toutes les migrations')
    if (dir) lines.push('cd ..')
    lines.push('```')
  } else if (orm === 'eloquent') {
    lines.push('> Les migrations Laravel sont déjà exécutées par `setup.sh` / `setup.ps1`.')
    lines.push('> Pour les relancer manuellement :')
    lines.push('')
    lines.push('```bash')
    lines.push('php artisan migrate')
    lines.push('php artisan db:seed   # optionnel : données de test')
    lines.push('```')
  }

  lines.push('')
  return lines
}

function buildStartSection(config: ProjectConfig, mixed: boolean): string[] {
  const stack  = config.stack as string
  const port   = getBackendPort(config)
  const fePort = getFrontendPort(stack)
  const lines: string[] = []

  const sectionNum = (() => {
    const orm = getORM(config)
    const needsMigration = ['prisma', 'drizzle', 'typeorm', 'sequelize', 'sqlmodel', 'sqlalchemy', 'tortoise-orm']
    return needsMigration.includes(orm) ? '6' : '5'
  })()

  lines.push(`## ${sectionNum}. Lancer le projet`)
  lines.push('')

  if (mixed) {
    lines.push('### Option A — Scripts dev (recommandé)')
    lines.push('')
    lines.push('```bash')
    lines.push('# Linux / macOS / WSL  — démarre backend + frontend en parallèle')
    lines.push('bash dev.sh')
    lines.push('')
    lines.push('# Windows PowerShell')
    lines.push('.\\dev.ps1')
    lines.push('```')
    lines.push('')
    lines.push('### Option B — Manuellement (2 terminaux)')
    lines.push('')
    lines.push('```bash')
    lines.push('# Terminal 1 — backend')
    lines.push('cd backend')
    if (stack.includes('fastapi')) {
      lines.push('source .venv/bin/activate')
      lines.push(`uvicorn app.main:app --reload`)
      lines.push(`# → http://localhost:${port}/docs  (Swagger UI interactif)`)
    } else if (stack.includes('laravel')) {
      lines.push('php artisan serve')
      lines.push(`# → http://localhost:${port}/api`)
    } else {
      lines.push('npm run dev')
      lines.push(`# → http://localhost:${port}`)
    }
    lines.push('')
    lines.push('# Terminal 2 — frontend')
    lines.push('cd frontend')
    lines.push('npm run dev')
    lines.push(`# → http://localhost:${fePort}`)
    lines.push('```')
  } else if (stack.includes('laravel')) {
    lines.push('```bash')
    lines.push('php artisan serve')
    lines.push('```')
    lines.push('')
    lines.push(`→ **http://localhost:${port}/api**`)
  } else if (stack.includes('fastapi')) {
    lines.push('```bash')
    lines.push('source .venv/bin/activate   # si le venv n\'est pas encore activé')
    lines.push(`uvicorn app.main:app --reload`)
    lines.push('```')
    lines.push('')
    lines.push(`→ **http://localhost:${port}/docs** (Swagger UI interactif)`)
    lines.push(`→ **http://localhost:${port}/redoc** (documentation ReDoc)`)
  } else if (stack.includes('express') || stack.includes('nestjs')) {
    lines.push('```bash')
    lines.push('npm run dev')
    lines.push('```')
    lines.push('')
    lines.push(`→ **http://localhost:${port}**`)
    if ((config as any).express?.swagger || (config as any).nestjs?.swagger) {
      lines.push(`→ **http://localhost:${port}/api/docs** (Swagger UI)`)
    }
  } else if (stack.includes('nextjs')) {
    lines.push('```bash')
    lines.push('npm run dev')
    lines.push('```')
    lines.push('')
    lines.push(`→ **http://localhost:${port}**`)
  } else if (stack.includes('react')) {
    lines.push('```bash')
    lines.push('npm run dev')
    lines.push('```')
    lines.push('')
    lines.push(`→ **http://localhost:5173**`)
  }

  lines.push('')
  return lines
}

function buildEndpointsTable(config: ProjectConfig): string[] {
  const stack  = config.stack as string
  const auth   = getAuth(config)
  const port   = getBackendPort(config)
  const lines: string[] = []

  // No endpoints for pure frontend stacks
  if (stack === 'react' || stack === 'nextjs') return lines
  if (config.models.length === 0) return lines

  const orm = getORM(config)
  const sectionNum = (() => {
    const needsMigration = ['prisma', 'drizzle', 'typeorm', 'sequelize', 'sqlmodel', 'sqlalchemy', 'tortoise-orm']
    const mixed = isMixedStack(config.stack)
    const hasMigration = needsMigration.includes(orm)
    return hasMigration ? '7' : '6'
  })()

  lines.push(`## ${sectionNum}. Endpoints API générés`)
  lines.push('')

  const isFastapi = stack.includes('fastapi')
  const isLaravel = stack.includes('laravel')
  const prefix    = isLaravel ? ((config as any).laravel?.route_prefix ?? 'api') : 'api'
  const updateMethod = (isFastapi || stack.includes('nestjs')) ? 'PATCH' : 'PUT'
  const idParam  = isFastapi ? '{id}' : ':id'
  const baseUrl  = `http://localhost:${port}`

  if (isFastapi) {
    lines.push(`> Swagger UI interactif disponible sur **${baseUrl}/docs** — testez vos endpoints directement dans le navigateur.`)
    lines.push('')
  }

  lines.push('| Méthode | Chemin | Description |')
  lines.push('|---------|--------|-------------|')

  for (const model of config.models) {
    const slug  = model.name.toLowerCase() + 's'
    const label = model.name
    const path  = `/${prefix}/${slug}`

    lines.push(`| \`GET\` | \`${path}\` | Lister tous les ${label.toLowerCase()}s |`)
    lines.push(`| \`POST\` | \`${path}\` | Créer un ${label.toLowerCase()} |`)
    lines.push(`| \`GET\` | \`${path}/${idParam}\` | Obtenir un ${label.toLowerCase()} par ID |`)
    lines.push(`| \`${updateMethod}\` | \`${path}/${idParam}\` | Modifier un ${label.toLowerCase()} |`)
    lines.push(`| \`DELETE\` | \`${path}/${idParam}\` | Supprimer un ${label.toLowerCase()} |`)
  }

  if (auth !== 'none') {
    const authBase = isFastapi ? '/auth' : (isLaravel ? '/api/auth' : '/auth')
    lines.push(`| \`POST\` | \`${authBase}/login\` | Connexion — retourne un token |`)
    if (auth === 'jwt' || auth === 'sanctum' || auth === 'passport') {
      lines.push(`| \`POST\` | \`${authBase}/register\` | Inscription |`)
      lines.push(`| \`POST\` | \`${authBase}/logout\` | Déconnexion |`)
    }
    if (auth === 'oauth2') {
      lines.push(`| \`POST\` | \`/token\` | Token OAuth2 (form data) |`)
    }
  }

  lines.push('')
  return lines
}

function buildUsefulCommands(config: ProjectConfig): string[] {
  const orm   = getORM(config)
  const stack = config.stack as string
  const lines: string[] = []

  const orm2num = () => {
    const needsMigration = ['prisma', 'drizzle', 'typeorm', 'sequelize', 'sqlmodel', 'sqlalchemy', 'tortoise-orm']
    const hasEndpoints = config.models.length > 0 && stack !== 'react' && stack !== 'nextjs'
    if (!needsMigration.includes(orm)) return hasEndpoints ? '7' : '6'
    return hasEndpoints ? '8' : '7'
  }

  lines.push(`## ${orm2num()}. Commandes utiles`)
  lines.push('')

  if (orm === 'prisma') {
    lines.push('```bash')
    lines.push('# Ouvrir le navigateur de base de données visuel')
    lines.push('npx prisma studio')
    lines.push('')
    lines.push('# Créer et appliquer une nouvelle migration')
    lines.push('npx prisma migrate dev --name nom_de_la_migration')
    lines.push('')
    lines.push('# Synchroniser le schéma sans migration (dev rapide)')
    lines.push('npx prisma db push')
    lines.push('')
    lines.push('# Peupler la base de données')
    lines.push('npx prisma db seed')
    lines.push('```')
  } else if (orm === 'drizzle') {
    lines.push('```bash')
    lines.push('# Ouvrir le navigateur de base de données visuel')
    lines.push('npx drizzle-kit studio')
    lines.push('')
    lines.push('# Générer une nouvelle migration')
    lines.push('npx drizzle-kit generate')
    lines.push('')
    lines.push('# Appliquer les migrations')
    lines.push('npx drizzle-kit migrate')
    lines.push('```')
  } else if (orm === 'typeorm') {
    lines.push('```bash')
    lines.push('# Générer une migration automatiquement')
    lines.push('npm run migration:generate -- -n NomDeLaMigration')
    lines.push('')
    lines.push('# Appliquer les migrations')
    lines.push('npm run migration:run')
    lines.push('')
    lines.push('# Annuler la dernière migration')
    lines.push('npm run migration:revert')
    lines.push('```')
  } else if (orm === 'sequelize') {
    lines.push('```bash')
    lines.push('# Créer une nouvelle migration')
    lines.push('npx sequelize-cli migration:generate --name nom-migration')
    lines.push('')
    lines.push('# Appliquer les migrations')
    lines.push('npx sequelize-cli db:migrate')
    lines.push('')
    lines.push('# Annuler la dernière migration')
    lines.push('npx sequelize-cli db:migrate:undo')
    lines.push('```')
  } else if (orm === 'sqlmodel' || orm === 'sqlalchemy') {
    lines.push('```bash')
    lines.push('# Créer une nouvelle migration (auto-détection des changements)')
    lines.push('alembic revision --autogenerate -m "description"')
    lines.push('')
    lines.push('# Appliquer les migrations')
    lines.push('alembic upgrade head')
    lines.push('')
    lines.push('# Revenir une migration en arrière')
    lines.push('alembic downgrade -1')
    lines.push('')
    lines.push('# Voir l\'historique des migrations')
    lines.push('alembic history')
    lines.push('```')
  } else if (orm === 'tortoise-orm') {
    lines.push('```bash')
    lines.push('# Créer une migration')
    lines.push('aerich migrate --name description')
    lines.push('')
    lines.push('# Appliquer les migrations')
    lines.push('aerich upgrade')
    lines.push('```')
  } else if (orm === 'eloquent') {
    lines.push('```bash')
    lines.push('# Console interactive Laravel')
    lines.push('php artisan tinker')
    lines.push('')
    lines.push('# Créer un nouveau modèle + migration')
    lines.push('php artisan make:model NomDuModele -m')
    lines.push('')
    lines.push('# Annuler et relancer toutes les migrations')
    lines.push('php artisan migrate:fresh --seed')
    lines.push('')
    lines.push('# Lancer les jobs en attente')
    lines.push('php artisan queue:work')
    lines.push('')
    lines.push('# Vider les caches')
    lines.push('php artisan optimize:clear')
    lines.push('```')
  }

  if (stack.includes('nestjs')) {
    lines.push('')
    lines.push('```bash')
    lines.push('# Compiler TypeScript')
    lines.push('npm run build')
    lines.push('')
    lines.push('# Tests unitaires')
    lines.push('npm run test')
    lines.push('')
    lines.push('# Tests end-to-end')
    lines.push('npm run test:e2e')
    lines.push('```')
  }

  lines.push('')
  return lines
}

function buildTroubleshooting(config: ProjectConfig): string[] {
  const orm    = getORM(config)
  const engine = getDbEngine(config)
  const stack  = config.stack as string
  const name   = config.name.replace(/-/g, '_')
  const lines: string[] = []

  lines.push('## Dépannage')
  lines.push('')
  lines.push('| Problème | Solution |')
  lines.push('|----------|---------|')

  if (engine === 'postgresql') {
    lines.push(`| \`connect ECONNREFUSED 127.0.0.1:5432\` | Démarrer PostgreSQL : \`brew services start postgresql@16\` (macOS) · \`sudo service postgresql start\` (Linux) |`)
    lines.push(`| \`FATAL: database "${name}" does not exist\` | Créer la base : \`psql -U postgres -c "CREATE DATABASE ${name};"\` |`)
    lines.push(`| \`password authentication failed\` | Vérifier \`DB_USERNAME\` et \`DB_PASSWORD\` dans \`.env\` |`)
  } else if (engine === 'mysql') {
    lines.push(`| \`connect ECONNREFUSED 127.0.0.1:3306\` | Démarrer MySQL : \`brew services start mysql\` (macOS) · \`sudo service mysql start\` (Linux) |`)
    lines.push(`| \`ERROR 1049: Unknown database '${name}'\` | Créer la base : \`mysql -u root -p -e "CREATE DATABASE \\\`${name}\\\`;"\` |`)
  } else if (engine === 'mongodb') {
    lines.push(`| \`connect ECONNREFUSED 127.0.0.1:27017\` | Démarrer MongoDB : \`brew services start mongodb-community\` (macOS) · \`sudo service mongod start\` (Linux) |`)
  }

  if (orm === 'prisma') {
    lines.push(`| \`Cannot find module '@prisma/client'\` | Lancer \`npx prisma generate\` |`)
    lines.push(`| \`The table does not exist in the current database\` | Lancer \`npx prisma migrate dev\` |`)
  } else if (orm === 'drizzle') {
    lines.push(`| \`Table doesn't exist\` | Lancer \`npx drizzle-kit migrate\` |`)
  }

  if (stack.includes('fastapi')) {
    lines.push(`| \`ModuleNotFoundError: No module named 'fastapi'\` | Activer le venv : \`source .venv/bin/activate\` (Linux/macOS) · \`.venv\\\\Scripts\\\\Activate.ps1\` (Windows) |`)
    lines.push(`| \`uvicorn: command not found\` | Venv non activé ou \`pip install -r requirements.txt\` non exécuté |`)
  }

  if (stack.includes('laravel')) {
    lines.push(`| \`No application encryption key has been specified\` | Lancer \`php artisan key:generate\` |`)
    lines.push(`| \`php: command not found\` | Installer PHP et l'ajouter au PATH |`)
    lines.push(`| \`composer: command not found\` | Installer Composer depuis https://getcomposer.org |`)
  }

  if (!stack.includes('fastapi') && !stack.includes('laravel')) {
    lines.push(`| \`node: command not found\` | Installer Node.js depuis https://nodejs.org |`)
    lines.push(`| \`npm ERR! missing script: dev\` | Lancer \`npm install\` d'abord |`)
  }

  lines.push('')
  return lines
}

// ─── GETTING_STARTED.md ──────────────────────────────────────────────────────

export function buildGettingStartedMd(config: ProjectConfig): string {
  const stack = config.stack as string
  const mixed = isMixedStack(config.stack)
  const orm   = getORM(config)
  const lines: string[] = []

  lines.push(`# Getting Started — ${config.name}`)
  lines.push('')

  // What was generated
  lines.push(...buildStackSummary(config, mixed))

  // Quick start — scripts table + 3-command launch
  lines.push(...buildQuickStart(config, mixed))

  // Project structure (mixed stacks only)
  if (mixed) {
    lines.push(...buildProjectStructure(config))
  }

  // Prerequisites
  lines.push(...buildPrerequisitesTable(config))

  // Navigate
  lines.push(...buildNavigateSection(config))

  // Environment variables
  lines.push(...buildEnvSection(config, mixed))

  // Install
  lines.push(...buildInstallSection(config, mixed))

  // DB init (ORM-specific, skipped for mongoose/beanie/none)
  lines.push(...buildDbInitSection(config, mixed))

  // Start the project
  lines.push(...buildStartSection(config, mixed))

  // API endpoints
  lines.push(...buildEndpointsTable(config))

  // Useful commands
  if (orm !== 'none') {
    lines.push(...buildUsefulCommands(config))
  }

  // Troubleshooting
  lines.push(...buildTroubleshooting(config))

  // Laravel artisan commands per model
  if (stack.includes('laravel') && config.models.length > 0) {
    lines.push('## Régénérer les fichiers individuellement')
    lines.push('')
    lines.push('Équivalents Artisan pour chaque couche scaffoldée (à exécuter après `composer install`) :')
    lines.push('')
    lines.push('```bash')
    for (const model of config.models) {
      const name = model.name
      lines.push(`# ${name}`)
      lines.push(`php artisan make:model ${name} -m`)
      if (model.generate?.controller !== false) lines.push(`php artisan make:controller Api/${name}Controller --api --model=${name}`)
      if (model.generate?.request    !== false) lines.push(`php artisan make:request Store${name}Request`)
      if (model.generate?.request    !== false) lines.push(`php artisan make:request Update${name}Request`)
      if (model.generate?.resource   !== false) lines.push(`php artisan make:resource ${name}Resource`)
      if (model.generate?.collection !== false) lines.push(`php artisan make:resource ${name}Collection --collection`)
      if (model.generate?.factory    !== false) lines.push(`php artisan make:factory ${name}Factory --model=${name}`)
      if (model.generate?.seeder     !== false) lines.push(`php artisan make:seeder ${name}Seeder`)
      if (model.generate?.policy     !== false) lines.push(`php artisan make:policy ${name}Policy --model=${name}`)
      if (model.generate?.observer   !== false) lines.push(`php artisan make:observer ${name}Observer --model=${name}`)
      lines.push('')
    }
    lines.push('```')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*Généré par [stack-init](https://github.com/your-org/stack-init)*')
  lines.push('')

  return lines.join('\n')
}

// ─── Terminal summary ─────────────────────────────────────────────────────────

export function buildTerminalSummary(config: ProjectConfig, outputPath: string): void {
  const stack = config.stack as string
  const mixed = isMixedStack(config.stack)
  const installed = detectInstalledVersions()
  const req = getVersions().runtimes

  const sep = pc.dim('  ' + '─'.repeat(52))

  console.log('')
  console.log(sep)
  console.log(`  ${pc.bold(pc.green('✓ Génération terminée'))}  —  ${pc.cyan(config.name)}`)
  console.log(`  ${pc.dim('Dossier :')} ${pc.cyan(outputPath)}`)
  console.log(sep)
  console.log('')
  console.log(`  ${pc.bold('Prochaines étapes')}`)
  console.log('')

  let step = 1

  // Check prerequisites
  const missingPrereqs: string[] = []
  if (stack.includes('laravel')) {
    if (!installed.php) missingPrereqs.push(`PHP ${req.php}+`)
    if (!installed.composer) missingPrereqs.push('Composer 2+')
  }
  if (stack.includes('fastapi') && !installed.python) {
    missingPrereqs.push(`Python ${req.python}+`)
  }
  if ((stack.includes('express') || stack.includes('nestjs') || stack.includes('nextjs') || stack.includes('react')) && !installed.node) {
    missingPrereqs.push(`Node.js ${req.node} LTS`)
  }

  if (missingPrereqs.length > 0) {
    console.log(`  ${pc.yellow(`${step++}.`)} Installer les prérequis manquants :`)
    missingPrereqs.forEach(p => console.log(`     ${pc.red('✗')} ${p}`))
    console.log('')
  }

  console.log(`  ${pc.dim(`${step++}.`)} Lancer le script de setup :`)
  console.log(`     ${pc.cyan('bash setup.sh')}          ${pc.dim('(Linux / macOS / WSL)')}`)
  console.log(`     ${pc.cyan('.\\setup.ps1')}           ${pc.dim('(Windows PowerShell)')}`)
  console.log(`     ${pc.cyan('setup.bat')}             ${pc.dim('(Windows CMD)')}`)
  console.log('')

  if (stack.includes('laravel') || stack.includes('fastapi') || stack.includes('express') || stack.includes('nestjs')) {
    console.log(`  ${pc.dim(`${step++}.`)} Configurer ${pc.yellow('.env')} ${pc.dim('(DB, clés secrètes...)')}`)
    console.log('')
  }

  console.log(`  ${pc.dim(`${step}.`)} Lancer le projet :`)
  if (mixed) {
    console.log(`     ${pc.cyan('bash dev.sh')}            ${pc.dim('(Linux / macOS / WSL)')}`)
    console.log(`     ${pc.cyan('.\\dev.ps1')}             ${pc.dim('(Windows PowerShell)')}`)
    if (stack.includes('laravel')) {
      console.log(`     ${pc.dim('→ API  : http://localhost:8000')}`)
    } else {
      console.log(`     ${pc.dim('→ API  : http://localhost:3000')}`)
    }
    console.log(`     ${pc.dim('→ App  : http://localhost:5173')}`)
  } else if (stack.includes('laravel')) {
    console.log(`     ${pc.cyan('php artisan serve')}`)
    console.log(`     ${pc.dim('→ http://localhost:8000/api')}`)
  } else if (stack.includes('fastapi')) {
    console.log(`     ${pc.cyan('uvicorn app.main:app --reload')}`)
    console.log(`     ${pc.dim('→ http://localhost:8000/docs')}`)
  } else {
    console.log(`     ${pc.cyan('npm run dev')}`)
    console.log(`     ${pc.dim('→ http://localhost:3000')}`)
  }

  console.log('')
  console.log(`  ${pc.dim('📄 Instructions complètes → GETTING_STARTED.md')}`)
  console.log(sep)
  console.log('')
}
