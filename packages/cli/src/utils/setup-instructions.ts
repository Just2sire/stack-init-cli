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

// ─── GETTING_STARTED.md ──────────────────────────────────────────────────────

export function buildGettingStartedMd(config: ProjectConfig): string {
  const stack  = config.stack as string
  const mixed  = isMixedStack(config.stack)
  const v      = getVersions()
  const lines: string[] = []

  lines.push(`# Getting Started — ${config.name}`)
  lines.push('')

  // ── Prérequis ──
  lines.push('## Prérequis')
  lines.push('')

  if (stack.includes('laravel')) {
    lines.push(`- **PHP** ${v.runtimes.php}+  →  \`php -v\``)
    lines.push(`- **Composer** 2+  →  \`composer --version\``)
    lines.push(`- **MySQL / PostgreSQL / SQLite** selon ton \`.env\``)
  }
  if (stack.includes('fastapi')) {
    lines.push(`- **Python** ${v.runtimes.python}+  →  \`python --version\``)
    lines.push('- **pip** ou **Poetry**')
  }
  if (stack.includes('express') || stack.includes('nestjs') || stack.includes('nextjs') || stack.includes('react')) {
    lines.push(`- **Node.js** ${v.runtimes.node} LTS  →  \`node -v\``)
    lines.push('- **npm** 10+  →  \`npm -v\`')
  }
  lines.push('')

  // ── Installation ──
  lines.push('## Installation')
  lines.push('')
  lines.push('### Option A — script (recommandé)')
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
  lines.push('### Option B — étape par étape')
  lines.push('')

  if (stack.includes('laravel')) {
    lines.push('```bash')
    lines.push('composer install --no-interaction')
    lines.push('cp .env.example .env')
    lines.push('# Éditer .env : DB_DATABASE, DB_USERNAME, DB_PASSWORD, APP_URL')
    lines.push('php artisan key:generate')
    lines.push('php artisan migrate --force')
    lines.push('php artisan db:seed')
    lines.push('```')
    lines.push('')
  }

  if (stack.includes('fastapi')) {
    const dir = mixed ? 'backend/' : ''
    lines.push('```bash')
    if (dir) lines.push(`cd ${dir}`)
    lines.push('pip install -r requirements.txt')
    lines.push('# Copier .env.example → .env et configurer DATABASE_URL')
    if (dir) lines.push('cd ..')
    lines.push('```')
    lines.push('')
  }

  if (stack.includes('express') || stack.includes('nestjs')) {
    const dir = mixed ? 'backend/' : ''
    lines.push('```bash')
    if (dir) lines.push(`cd ${dir}`)
    lines.push('npm install')
    lines.push('# Copier .env.example → .env et configurer DATABASE_URL / PORT')
    if (dir) lines.push('cd ..')
    lines.push('```')
    lines.push('')
  }

  if (mixed && (stack.includes('react') || stack.includes('nextjs'))) {
    lines.push('```bash')
    lines.push('cd frontend')
    lines.push('npm install')
    lines.push('# Copier .env.example → .env.local et configurer NEXT_PUBLIC_API_URL si nécessaire')
    lines.push('cd ..')
    lines.push('```')
    lines.push('')
  }

  // ── Lancer le projet ──
  lines.push('## Lancer le projet')
  lines.push('')

  if (mixed) {
    lines.push('```bash')
    lines.push('# Démarre backend + frontend en parallèle')
    lines.push('bash dev.sh         # Linux / macOS / WSL')
    lines.push('.\\dev.ps1          # Windows PowerShell')
    lines.push('```')
    lines.push('')
    lines.push('Ou manuellement :')
    lines.push('')
    lines.push('```bash')
    if (stack.includes('laravel')) {
      lines.push('php artisan serve   # → http://localhost:8000')
    } else if (stack.includes('fastapi')) {
      lines.push('cd backend && uvicorn main:app --reload   # → http://localhost:8000')
    } else {
      lines.push('cd backend && npm run dev   # → http://localhost:3000')
    }
    lines.push('cd frontend && npm run dev   # → http://localhost:5173')
    lines.push('```')
  } else if (stack.includes('laravel')) {
    lines.push('```bash')
    lines.push('php artisan serve')
    lines.push('```')
    lines.push('')
    lines.push('→ http://localhost:8000/api')
  } else if (stack.includes('fastapi')) {
    lines.push('```bash')
    lines.push('uvicorn main:app --reload')
    lines.push('```')
    lines.push('')
    lines.push('→ http://localhost:8000/docs (Swagger UI)')
  } else if (stack.includes('express') || stack.includes('nestjs')) {
    lines.push('```bash')
    lines.push('npm run dev')
    lines.push('```')
    lines.push('')
    lines.push('→ http://localhost:3000')
  } else if (stack.includes('nextjs')) {
    lines.push('```bash')
    lines.push('npm run dev')
    lines.push('```')
    lines.push('')
    lines.push('→ http://localhost:3000')
  }
  lines.push('')

  // ── Variables d'environnement ──
  lines.push('## Variables d\'environnement clés')
  lines.push('')
  lines.push('| Variable | Description |')
  lines.push('|---|---|')

  if (stack.includes('laravel')) {
    lines.push('| `DB_CONNECTION` | mysql / pgsql / sqlite |')
    lines.push('| `DB_HOST` | Hôte de la base de données |')
    lines.push('| `DB_DATABASE` | Nom de la base |')
    lines.push('| `DB_USERNAME` | Utilisateur |')
    lines.push('| `DB_PASSWORD` | Mot de passe |')
    lines.push('| `APP_URL` | URL de l\'application |')
  }
  if (stack.includes('fastapi') || stack.includes('express') || stack.includes('nestjs')) {
    lines.push('| `DATABASE_URL` | URL de connexion à la base |')
    lines.push('| `PORT` | Port d\'écoute (défaut : 3000 / 8000) |')
    lines.push('| `JWT_SECRET` | Clé secrète JWT (si auth activée) |')
  }
  if (mixed && (stack.includes('react') || stack.includes('nextjs'))) {
    lines.push('| `NEXT_PUBLIC_API_URL` | URL de l\'API backend |')
  }
  lines.push('')

  if (stack.includes('laravel') && config.models.length > 0) {
    lines.push('## Regenerate individual files')
    lines.push('')
    lines.push('Artisan equivalents for each scaffolded layer (run inside the project after `composer install`):')
    lines.push('')
    lines.push('```bash')
    for (const model of config.models) {
      const name = model.name
      const table = name.toLowerCase() + 's'
      lines.push(`# ${name}`)
      lines.push(`php artisan make:model ${name} -m`)
      if (model.generate.controller !== false) lines.push(`php artisan make:controller Api/${name}Controller --api --model=${name}`)
      if (model.generate.request    !== false) lines.push(`php artisan make:request Store${name}Request`)
      if (model.generate.request    !== false) lines.push(`php artisan make:request Update${name}Request`)
      if (model.generate.resource   !== false) lines.push(`php artisan make:resource ${name}Resource`)
      if (model.generate.collection !== false) lines.push(`php artisan make:resource ${name}Collection --collection`)
      if (model.generate.factory    !== false) lines.push(`php artisan make:factory ${name}Factory --model=${name}`)
      if (model.generate.seeder     !== false) lines.push(`php artisan make:seeder ${name}Seeder`)
      if (model.generate.policy     !== false) lines.push(`php artisan make:policy ${name}Policy --model=${name}`)
      if (model.generate.observer   !== false) lines.push(`php artisan make:observer ${name}Observer --model=${name}`)
      lines.push('')
    }
    lines.push('```')
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push(`*Généré par [stack-init](https://github.com/your-org/stack-init)*`)
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
    console.log(`     ${pc.cyan('uvicorn main:app --reload')}`)
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
