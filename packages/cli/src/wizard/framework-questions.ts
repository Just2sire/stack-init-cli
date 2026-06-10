import * as clack from '@clack/prompts'
import type { ExpressConfig, LaravelOptions, NestConfig, FastAPIConfig, ReactOptions } from '@stack-init/schema'
import type { Preset } from './presets'

function checkCancel<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel('Opération annulée.')
    process.exit(0)
  }
  return value as T
}

// ---------------------------------------------------------------------------
// Backend questions
// ---------------------------------------------------------------------------

async function askExpress(): Promise<Partial<ExpressConfig>> {
  const orm = checkCancel(await clack.select({
    message: 'ORM Express',
    options: [
      { value: 'prisma',    label: 'Prisma',    hint: 'recommandé' },
      { value: 'typeorm',   label: 'TypeORM' },
      { value: 'sequelize', label: 'Sequelize' },
      { value: 'drizzle',   label: 'Drizzle' },
      { value: 'mongoose',  label: 'Mongoose',  hint: 'MongoDB uniquement' },
      { value: 'none',      label: 'Aucun' },
    ],
  }))

  const db_engine = checkCancel(await clack.select({
    message: 'Base de données',
    options: orm === 'mongoose'
      ? [{ value: 'mongodb', label: 'MongoDB' }]
      : [
          { value: 'postgresql', label: 'PostgreSQL', hint: 'recommandé' },
          { value: 'mysql',      label: 'MySQL' },
          { value: 'sqlite',     label: 'SQLite' },
          { value: 'mongodb',    label: 'MongoDB' },
        ],
  }))

  const auth = checkCancel(await clack.select({
    message: 'Authentification',
    options: [
      { value: 'jwt',     label: 'JWT' },
      { value: 'session', label: 'Session' },
      { value: 'none',    label: 'Aucune' },
    ],
  }))

  const validation = checkCancel(await clack.select({
    message: 'Validation des données',
    options: [
      { value: 'zod',               label: 'Zod',               hint: 'recommandé' },
      { value: 'joi',               label: 'Joi' },
      { value: 'express-validator', label: 'express-validator' },
      { value: 'none',              label: 'Aucune' },
    ],
  }))

  const swagger = checkCancel(await clack.confirm({
    message: 'Générer la documentation Swagger / OpenAPI ?',
    initialValue: false,
  }))

  return { orm, db_engine, auth, validation, swagger: swagger as boolean } as Partial<ExpressConfig>
}

async function askNest(): Promise<Partial<NestConfig>> {
  const orm = checkCancel(await clack.select({
    message: 'ORM NestJS',
    options: [
      { value: 'typeorm',   label: 'TypeORM',   hint: 'recommandé' },
      { value: 'prisma',    label: 'Prisma' },
      { value: 'mongoose',  label: 'Mongoose',  hint: 'MongoDB uniquement' },
      { value: 'drizzle',   label: 'Drizzle' },
    ],
  }))

  const db_engine = checkCancel(await clack.select({
    message: 'Base de données',
    options: orm === 'mongoose'
      ? [{ value: 'mongodb', label: 'MongoDB' }]
      : [
          { value: 'postgresql', label: 'PostgreSQL', hint: 'recommandé' },
          { value: 'mysql',      label: 'MySQL' },
          { value: 'sqlite',     label: 'SQLite' },
        ],
  }))

  const auth = checkCancel(await clack.select({
    message: 'Authentification',
    options: [
      { value: 'jwt',     label: 'JWT' },
      { value: 'api-key', label: 'API Key' },
      { value: 'none',    label: 'Aucune' },
    ],
  }))

  const swagger = checkCancel(await clack.confirm({
    message: 'Générer la documentation Swagger / OpenAPI ?',
    initialValue: true,
  }))

  return { orm, db_engine, auth, swagger: swagger as boolean } as Partial<NestConfig>
}

async function askFastAPI(): Promise<Partial<FastAPIConfig>> {
  const orm = checkCancel(await clack.select({
    message: 'ORM FastAPI',
    options: [
      { value: 'sqlmodel',     label: 'SQLModel',     hint: 'recommandé' },
      { value: 'sqlalchemy',   label: 'SQLAlchemy' },
      { value: 'tortoise-orm', label: 'Tortoise ORM' },
      { value: 'beanie',       label: 'Beanie',       hint: 'MongoDB uniquement' },
      { value: 'none',         label: 'Aucun' },
    ],
  }))

  const db_engine = checkCancel(await clack.select({
    message: 'Base de données',
    options: orm === 'beanie'
      ? [{ value: 'mongodb', label: 'MongoDB' }]
      : [
          { value: 'postgresql', label: 'PostgreSQL', hint: 'recommandé' },
          { value: 'mysql',      label: 'MySQL' },
          { value: 'sqlite',     label: 'SQLite' },
        ],
  }))

  const auth = checkCancel(await clack.select({
    message: 'Authentification',
    options: [
      { value: 'jwt',     label: 'JWT' },
      { value: 'oauth2',  label: 'OAuth2' },
      { value: 'api-key', label: 'API Key' },
      { value: 'none',    label: 'Aucune' },
    ],
  }))

  const python_version = checkCancel(await clack.select({
    message: 'Version Python',
    options: [
      { value: '3.13', label: 'Python 3.13', hint: 'recommandé' },
      { value: '3.12', label: 'Python 3.12' },
      { value: '3.11', label: 'Python 3.11' },
      { value: '3.10', label: 'Python 3.10' },
    ],
  }))

  return { orm, db_engine, auth, python_version, cors: true, swagger: true } as Partial<FastAPIConfig>
}

async function askLaravel(): Promise<Partial<LaravelOptions>> {
  const pattern = checkCancel(await clack.select({
    message: 'Pattern Laravel',
    options: [
      { value: 'api-only', label: 'API only',  hint: 'recommandé pour full-stack' },
      { value: 'full',     label: 'Full MVC' },
      { value: 'minimal',  label: 'Minimal' },
    ],
  }))

  const auth = checkCancel(await clack.select({
    message: 'Authentification',
    options: [
      { value: 'sanctum',   label: 'Sanctum',   hint: 'recommandé' },
      { value: 'passport',  label: 'Passport' },
      { value: 'breeze',    label: 'Breeze' },
      { value: 'jetstream', label: 'Jetstream' },
      { value: 'none',      label: 'Aucune' },
    ],
  }))

  const db_engine = checkCancel(await clack.select({
    message: 'Base de données',
    options: [
      { value: 'mysql',   label: 'MySQL',      hint: 'recommandé' },
      { value: 'pgsql',   label: 'PostgreSQL' },
      { value: 'sqlite',  label: 'SQLite' },
      { value: 'sqlsrv',  label: 'SQL Server' },
    ],
  }))

  const php_version = checkCancel(await clack.select({
    message: 'Version PHP',
    options: [
      { value: '8.4', label: 'PHP 8.4', hint: 'recommandé' },
      { value: '8.3', label: 'PHP 8.3' },
      { value: '8.2', label: 'PHP 8.2' },
    ],
  }))

  const laravel_version = checkCancel(await clack.select({
    message: 'Version Laravel',
    options: [
      { value: '12', label: 'Laravel 12', hint: 'recommandé' },
      { value: '11', label: 'Laravel 11' },
      { value: '10', label: 'Laravel 10' },
    ],
  }))

  return { pattern, auth, db_engine, php_version, laravel_version } as Partial<LaravelOptions>
}

// ---------------------------------------------------------------------------
// Frontend questions
// ---------------------------------------------------------------------------

async function askReact(): Promise<Partial<ReactOptions>> {
  const ui_lib = checkCancel(await clack.select({
    message: 'UI Library',
    options: [
      { value: 'shadcn', label: 'shadcn/ui + Tailwind', hint: 'recommandé' },
      { value: 'mui',    label: 'Material UI (MUI)' },
      { value: 'antd',   label: 'Ant Design' },
      { value: 'chakra', label: 'Chakra UI' },
      { value: 'none',   label: 'Aucune' },
    ],
  }))

  const state_lib = checkCancel(await clack.select({
    message: 'State management',
    options: [
      { value: 'zustand',       label: 'Zustand',       hint: 'recommandé' },
      { value: 'redux-toolkit', label: 'Redux Toolkit' },
      { value: 'jotai',         label: 'Jotai' },
      { value: 'none',          label: 'Aucun' },
    ],
  }))

  const router = checkCancel(await clack.select({
    message: 'Routing',
    options: [
      { value: 'react-router-v6',  label: 'React Router v6',  hint: 'recommandé' },
      { value: 'tanstack-router',  label: 'TanStack Router' },
      { value: 'none',             label: 'Aucun' },
    ],
  }))

  const form_lib = checkCancel(await clack.select({
    message: 'Gestion des formulaires',
    options: [
      { value: 'react-hook-form', label: 'React Hook Form', hint: 'recommandé' },
      { value: 'formik',          label: 'Formik' },
      { value: 'zod',             label: 'Zod uniquement',  hint: 'validation sans lib de form' },
      { value: 'none',            label: 'Aucune' },
    ],
  }))

  return { ui_lib, state_lib, router, form_lib, http_lib: 'axios', data_fetching: 'tanstack-query' } as Partial<ReactOptions>
}

// ---------------------------------------------------------------------------
// Custom wizard — asks per-framework questions
// ---------------------------------------------------------------------------

export async function runCustomWizard(stackStr: string): Promise<Partial<Preset>> {
  const result: Partial<Preset> = { stack: stackStr }

  if (stackStr.includes('express') || stackStr === 'mern' || stackStr === 'pern') {
    clack.note('Configuration Express', '────')
    result.express = await askExpress()
  }

  if (stackStr.includes('nestjs')) {
    clack.note('Configuration NestJS', '────')
    result.nestjs = await askNest()
  }

  if (stackStr.includes('fastapi')) {
    clack.note('Configuration FastAPI', '────')
    result.fastapi = await askFastAPI()
  }

  if (stackStr.includes('laravel')) {
    clack.note('Configuration Laravel', '────')
    result.laravel = await askLaravel()
  }

  if (
    stackStr.includes('react') ||
    stackStr === 'mern' || stackStr === 'pern'
  ) {
    clack.note('Configuration React', '────')
    result.react = await askReact()
  }

  return result
}

export const BACKEND_STACKS = [
  { value: 'express',  label: 'Express',  hint: 'Node.js · REST' },
  { value: 'nestjs',   label: 'NestJS',   hint: 'Node.js · structuré' },
  { value: 'fastapi',  label: 'FastAPI',  hint: 'Python · async' },
  { value: 'laravel',  label: 'Laravel',  hint: 'PHP · MVC' },
  { value: 'django',   label: 'Django',   hint: 'Python · batteries incluses' },
  { value: 'none',     label: 'Aucun',    hint: 'frontend uniquement' },
] as const

export const FRONTEND_STACKS = [
  { value: 'react',  label: 'React (Vite)',   hint: 'SPA · Vite' },
  { value: 'nextjs', label: 'Next.js',        hint: 'SSR / SSG' },
  { value: 'none',   label: 'Aucun',          hint: 'backend uniquement' },
] as const
