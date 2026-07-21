import type { ProjectConfig } from '@stack-init/schema'
import { isMixedStack } from '@stack-init/schema'

// ─── helpers ────────────────────────────────────────────────────────────────

function isLaravelStack(stack: string)  { return stack.includes('laravel') }
function isFastAPIStack(stack: string)  { return stack.includes('fastapi') }
function isNodeStack(stack: string)     { return stack.includes('express') || stack.includes('nestjs') }
function hasReactFrontend(stack: string){ return stack.includes('react') || stack.includes('nextjs') }

function backendDir(stack: string, mixed: boolean): string {
  if (!mixed) return '.'
  return isLaravelStack(stack) ? '.' : 'backend'
}

// ─── setup.sh ───────────────────────────────────────────────────────────────

export function generateSetupSh(config: ProjectConfig): string {
  const stack  = config.stack as string
  const mixed  = isMixedStack(config.stack)
  const bDir   = backendDir(stack, mixed)
  const laravelAuth = config.laravel?.auth ?? 'sanctum'
  const laravelVer  = parseInt(config.laravel?.laravel_version ?? '12')
  const needsInstallApi = isLaravelStack(stack)
    && (laravelAuth === 'sanctum' || laravelAuth === 'passport')
    && laravelVer >= 11
  const needsPassport  = isLaravelStack(stack) && laravelAuth === 'passport'
  const needsBreeze    = isLaravelStack(stack) && laravelAuth === 'breeze'
  const needsJetstream = isLaravelStack(stack) && laravelAuth === 'jetstream'
  const hasSwagger = isLaravelStack(stack) && config.models.some(m => m.generate?.swagger)
  const lines: string[] = [
    '#!/usr/bin/env bash',
    'set -e',
    `echo "🚀 Configuration de ${config.name}..."`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('# Backend — Laravel')
    lines.push('# Vider le cache bootstrap avant l\'installation (évite les conflits de providers)')
    lines.push('rm -f bootstrap/cache/packages.php bootstrap/cache/services.php bootstrap/cache/config.php bootstrap/cache/routes.php')
    lines.push('composer update --no-interaction')
    if (hasSwagger) {
      lines.push('')
      lines.push('# Swagger / L5-Swagger')
      lines.push('composer require darkaonline/l5-swagger --no-interaction')
      lines.push('php artisan vendor:publish --provider "L5Swagger\\L5SwaggerServiceProvider"')
      lines.push('composer update --no-interaction')
    }
    lines.push('cp .env.example .env')
    lines.push('php artisan key:generate')
    if (needsPassport)  lines.push('composer require laravel/passport --no-interaction')
    if (needsInstallApi) {
      lines.push('if [ ! -f routes/api.php ]; then')
      lines.push('    php artisan install:api --no-interaction')
      lines.push('fi')
    }
    if (needsBreeze) {
      lines.push('composer require laravel/breeze --no-interaction')
      lines.push('php artisan breeze:install api --no-interaction')
    }
    if (needsJetstream) {
      lines.push('composer require laravel/jetstream --no-interaction')
      lines.push('php artisan jetstream:install inertia --no-interaction')
    }
    lines.push('php artisan migrate --force')
    lines.push('php artisan db:seed')
    if (hasSwagger) lines.push('php artisan l5-swagger:generate')
    lines.push('')
  } else if (isFastAPIStack(stack)) {
    lines.push('# Backend — FastAPI')
    if (bDir !== '.') lines.push(`cd ${bDir}`)
    lines.push('pip install -r requirements.txt')
    if (bDir !== '.') lines.push('cd ..')
    lines.push('')
  } else if (isNodeStack(stack)) {
    lines.push('# Backend — Node.js')
    if (bDir !== '.') lines.push(`cd ${bDir}`)
    lines.push('npm install')
    if (bDir !== '.') lines.push('cd ..')
    lines.push('')
  }

  if (mixed && hasReactFrontend(stack)) {
    lines.push('# Frontend')
    lines.push('cd frontend')
    lines.push('npm install')
    lines.push('cd ..')
    lines.push('')
  }

  lines.push(`echo "✅ ${config.name} est prêt !"`)
  return lines.join('\n') + '\n'
}

// ─── setup.ps1 ──────────────────────────────────────────────────────────────

export function generateSetupPs1(config: ProjectConfig): string {
  const stack  = config.stack as string
  const mixed  = isMixedStack(config.stack)
  const bDir   = backendDir(stack, mixed)
  const laravelAuth = config.laravel?.auth ?? 'sanctum'
  const laravelVer  = parseInt(config.laravel?.laravel_version ?? '12')
  const needsInstallApi = isLaravelStack(stack)
    && (laravelAuth === 'sanctum' || laravelAuth === 'passport')
    && laravelVer >= 11
  const needsPassport  = isLaravelStack(stack) && laravelAuth === 'passport'
  const needsBreeze    = isLaravelStack(stack) && laravelAuth === 'breeze'
  const needsJetstream = isLaravelStack(stack) && laravelAuth === 'jetstream'
  const hasSwagger = isLaravelStack(stack) && config.models.some(m => m.generate?.swagger)
  const lines: string[] = [
    'Set-StrictMode -Version Latest',
    '$ErrorActionPreference = "Stop"',
    `Write-Host "🚀 Configuration de ${config.name}..." -ForegroundColor Cyan`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('# Backend — Laravel')
    lines.push('# Vider le cache bootstrap avant l\'installation (évite les conflits de providers)')
    lines.push('@("bootstrap/cache/packages.php","bootstrap/cache/services.php","bootstrap/cache/config.php","bootstrap/cache/routes.php") | ForEach-Object { if (Test-Path $_) { Remove-Item $_ -Force } }')
    lines.push('composer update --no-interaction')
    if (hasSwagger) {
      lines.push('')
      lines.push('# Swagger / L5-Swagger')
      lines.push('composer require darkaonline/l5-swagger --no-interaction')
      lines.push('php artisan vendor:publish --provider "L5Swagger\\L5SwaggerServiceProvider"')
      lines.push('composer update --no-interaction')
    }
    lines.push('Copy-Item .env.example .env')
    lines.push('php artisan key:generate')
    if (needsPassport)  lines.push('composer require laravel/passport --no-interaction')
    if (needsInstallApi) {
      lines.push('if (-not (Test-Path "routes/api.php")) {')
      lines.push('    php artisan install:api --no-interaction')
      lines.push('}')
    }
    if (needsBreeze) {
      lines.push('composer require laravel/breeze --no-interaction')
      lines.push('php artisan breeze:install api --no-interaction')
    }
    if (needsJetstream) {
      lines.push('composer require laravel/jetstream --no-interaction')
      lines.push('php artisan jetstream:install inertia --no-interaction')
    }
    lines.push('php artisan migrate --force')
    lines.push('php artisan db:seed')
    if (hasSwagger) lines.push('php artisan l5-swagger:generate')
    lines.push('')
  } else if (isFastAPIStack(stack)) {
    lines.push('# Backend — FastAPI')
    if (bDir !== '.') lines.push(`Set-Location ${bDir}`)
    lines.push('pip install -r requirements.txt')
    if (bDir !== '.') lines.push('Set-Location ..')
    lines.push('')
  } else if (isNodeStack(stack)) {
    lines.push('# Backend — Node.js')
    if (bDir !== '.') lines.push(`Set-Location ${bDir}`)
    lines.push('npm install')
    if (bDir !== '.') lines.push('Set-Location ..')
    lines.push('')
  }

  if (mixed && hasReactFrontend(stack)) {
    lines.push('# Frontend')
    lines.push('Set-Location frontend')
    lines.push('npm install')
    lines.push('Set-Location ..')
    lines.push('')
  }

  lines.push(`Write-Host "✅ ${config.name} est prêt !" -ForegroundColor Green`)
  return lines.join('\n') + '\n'
}

// ─── setup.bat ──────────────────────────────────────────────────────────────

export function generateSetupBat(config: ProjectConfig): string {
  const stack  = config.stack as string
  const mixed  = isMixedStack(config.stack)
  const bDir   = backendDir(stack, mixed)
  const laravelAuth = config.laravel?.auth ?? 'sanctum'
  const laravelVer  = parseInt(config.laravel?.laravel_version ?? '12')
  const needsInstallApi = isLaravelStack(stack)
    && (laravelAuth === 'sanctum' || laravelAuth === 'passport')
    && laravelVer >= 11
  const needsPassport  = isLaravelStack(stack) && laravelAuth === 'passport'
  const needsBreeze    = isLaravelStack(stack) && laravelAuth === 'breeze'
  const needsJetstream = isLaravelStack(stack) && laravelAuth === 'jetstream'
  const hasSwagger = isLaravelStack(stack) && config.models.some(m => m.generate?.swagger)
  const lines: string[] = [
    '@echo off',
    'setlocal EnableExtensions EnableDelayedExpansion',
    `echo [stack-init] Configuration de ${config.name}...`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('REM ── Backend Laravel ──────────────────────────────────────────────')
    lines.push('echo [1/6] Nettoyage du cache bootstrap...')
    lines.push('if exist "bootstrap\\cache\\packages.php" del /q "bootstrap\\cache\\packages.php"')
    lines.push('if exist "bootstrap\\cache\\services.php" del /q "bootstrap\\cache\\services.php"')
    lines.push('if exist "bootstrap\\cache\\config.php"   del /q "bootstrap\\cache\\config.php"')
    lines.push('if exist "bootstrap\\cache\\routes.php"   del /q "bootstrap\\cache\\routes.php"')
    lines.push('')
    lines.push('echo [2/6] Installation des dependances Composer...')
    lines.push('composer update --no-interaction')
    lines.push('if errorlevel 1 goto :error')
    if (hasSwagger) {
      lines.push('')
      lines.push('echo [2b] Installation de L5-Swagger...')
      lines.push('composer require darkaonline/l5-swagger --no-interaction')
      lines.push('if errorlevel 1 goto :error')
      lines.push('php artisan vendor:publish --provider "L5Swagger\\L5SwaggerServiceProvider"')
      lines.push('if errorlevel 1 goto :error')
      lines.push('composer update --no-interaction')
      lines.push('if errorlevel 1 goto :error')
    }
    lines.push('')
    lines.push('echo [3/6] Configuration du fichier .env...')
    lines.push('copy /Y .env.example .env')
    lines.push('if errorlevel 1 goto :error')
    lines.push('')
    lines.push('echo [4/6] Generation de la cle applicative...')
    lines.push('php artisan key:generate')
    lines.push('if errorlevel 1 goto :error')
    if (needsPassport) {
      lines.push('')
      lines.push('echo [4b] Installation de Laravel Passport...')
      lines.push('composer require laravel/passport --no-interaction')
      lines.push('if errorlevel 1 goto :error')
    }
    if (needsInstallApi) {
      lines.push('')
      lines.push("echo [4c] Installation de l'API (Sanctum)...")
      lines.push('if not exist "routes\\api.php" (')
      lines.push('    php artisan install:api --no-interaction')
      lines.push('    if errorlevel 1 goto :error')
      lines.push(')')
    }
    if (needsBreeze) {
      lines.push('')
      lines.push('echo [4d] Installation de Laravel Breeze...')
      lines.push('composer require laravel/breeze --no-interaction')
      lines.push('if errorlevel 1 goto :error')
      lines.push('php artisan breeze:install api --no-interaction')
      lines.push('if errorlevel 1 goto :error')
    }
    if (needsJetstream) {
      lines.push('')
      lines.push('echo [4e] Installation de Laravel Jetstream...')
      lines.push('composer require laravel/jetstream --no-interaction')
      lines.push('if errorlevel 1 goto :error')
      lines.push('php artisan jetstream:install inertia --no-interaction')
      lines.push('if errorlevel 1 goto :error')
    }
    lines.push('')
    lines.push('echo [5/6] Migration de la base de donnees...')
    lines.push('php artisan migrate --force')
    lines.push('if errorlevel 1 goto :error')
    lines.push('')
    lines.push('echo [6/6] Chargement des donnees initiales (seeders)...')
    lines.push('php artisan db:seed')
    lines.push('if errorlevel 1 goto :error')
    if (hasSwagger) {
      lines.push('')
      lines.push('echo Generation de la documentation Swagger...')
      lines.push('php artisan l5-swagger:generate')
      lines.push('if errorlevel 1 goto :error')
    }
    lines.push('')
  } else if (isFastAPIStack(stack)) {
    lines.push('REM ── Backend FastAPI ──────────────────────────────────────────────')
    lines.push('echo [1/1] Installation des dependances Python...')
    if (bDir !== '.') lines.push(`pushd ${bDir}`)
    lines.push('pip install -r requirements.txt')
    lines.push('if errorlevel 1 goto :error')
    if (bDir !== '.') lines.push('popd')
    lines.push('')
  } else if (isNodeStack(stack)) {
    lines.push('REM ── Backend Node.js ──────────────────────────────────────────────')
    lines.push('echo [1/2] Installation des dependances backend...')
    if (bDir !== '.') lines.push(`pushd ${bDir}`)
    lines.push('npm install')
    lines.push('if errorlevel 1 goto :error')
    if (bDir !== '.') lines.push('popd')
    lines.push('')
  }

  if (mixed && hasReactFrontend(stack)) {
    lines.push('REM ── Frontend ─────────────────────────────────────────────────────')
    lines.push('echo [2/2] Installation des dependances frontend...')
    lines.push('pushd frontend')
    lines.push('npm install')
    lines.push('if errorlevel 1 goto :error')
    lines.push('popd')
    lines.push('')
  }

  lines.push(`echo [OK] ${config.name} est pret !`)
  lines.push('goto :end')
  lines.push('')
  lines.push(':error')
  lines.push('echo.')
  lines.push("echo [ERREUR] La configuration a echoue a l'etape precedente.")
  lines.push('echo Verifiez les messages ci-dessus, corrigez le probleme, puis relancez ce script.')
  lines.push('exit /b 1')
  lines.push('')
  lines.push(':end')
  lines.push('endlocal')
  return lines.join('\n') + '\n'
}

// ─── dev.sh (mixed stacks only) ─────────────────────────────────────────────

export function generateDevSh(config: ProjectConfig): string {
  const stack = config.stack as string
  const lines: string[] = [
    '#!/usr/bin/env bash',
    '# Arrête les deux processus quand le script se termine (Ctrl+C)',
    'trap \'kill 0\' EXIT',
    `echo "🏁 Démarrage de ${config.name}..."`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('php artisan serve &')
  } else if (isFastAPIStack(stack)) {
    lines.push('cd backend && uvicorn main:app --reload &')
  } else if (isNodeStack(stack)) {
    lines.push('cd backend && npm run dev &')
  }

  lines.push('cd frontend && npm run dev &')
  lines.push('wait')
  return lines.join('\n') + '\n'
}

// ─── dev.ps1 (mixed stacks only) ────────────────────────────────────────────

export function generateDevPs1(config: ProjectConfig): string {
  const stack = config.stack as string
  const lines: string[] = [
    '$ErrorActionPreference = "Stop"',
    `Write-Host "🏁 Démarrage de ${config.name}..." -ForegroundColor Cyan`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('$backend = Start-Process php -ArgumentList "artisan","serve" -PassThru -NoNewWindow')
  } else if (isFastAPIStack(stack)) {
    lines.push('$backend = Start-Process python -ArgumentList "-m","uvicorn","main:app","--reload" -WorkingDirectory backend -PassThru -NoNewWindow')
  } else if (isNodeStack(stack)) {
    lines.push('$backend = Start-Process npm -ArgumentList "run","dev" -WorkingDirectory backend -PassThru -NoNewWindow')
  }

  lines.push('$frontend = Start-Process npm -ArgumentList "run","dev" -WorkingDirectory frontend -PassThru -NoNewWindow')
  lines.push('Write-Host "Services démarrés. Appuie sur Ctrl+C pour arrêter." -ForegroundColor Yellow')
  lines.push('try { $backend.WaitForExit(); $frontend.WaitForExit() }')
  lines.push('finally { $backend.Kill(); $frontend.Kill() }')
  return lines.join('\n') + '\n'
}

// ─── dev.bat (mixed stacks only) ────────────────────────────────────────────

export function generateDevBat(config: ProjectConfig): string {
  const stack = config.stack as string
  const lines: string[] = [
    '@echo off',
    `echo Demarrage de ${config.name}...`,
    '',
  ]

  if (isLaravelStack(stack)) {
    lines.push('start /b php artisan serve')
  } else if (isFastAPIStack(stack)) {
    lines.push('start /b cmd /c "cd backend && uvicorn main:app --reload"')
  } else if (isNodeStack(stack)) {
    lines.push('start /b cmd /c "cd backend && npm run dev"')
  }

  lines.push('start /b cmd /c "cd frontend && npm run dev"')
  lines.push('echo Services demarres. Ferme cette fenetre pour arreter.')
  lines.push('pause')
  return lines.join('\n') + '\n'
}
