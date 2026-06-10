import type { ExpressConfig, LaravelOptions, NestConfig, FastAPIConfig, ReactOptions } from '@stack-init/schema'

export const PRESET_KEYS = [
  'pern', 'mern', 't3', 'laravel-api', 'laravel-react',
  'fastapi-react', 'nestjs-api', 'django',
] as const

export type PresetKey = typeof PRESET_KEYS[number]

export interface Preset {
  label: string
  hint: string
  stack: string
  express?: Partial<ExpressConfig>
  react?: Partial<ReactOptions>
  laravel?: Partial<LaravelOptions>
  nestjs?: Partial<NestConfig>
  fastapi?: Partial<FastAPIConfig>
}

export const PRESETS: Record<PresetKey, Preset> = {
  pern: {
    label: 'PERN Stack',
    hint: 'PostgreSQL · Express · React · Prisma',
    stack: 'pern',
    express: { orm: 'prisma', db_engine: 'postgresql', auth: 'jwt', validation: 'zod' },
    react: { ui_lib: 'shadcn', state_lib: 'zustand', http_lib: 'axios', data_fetching: 'tanstack-query' },
  },
  mern: {
    label: 'MERN Stack',
    hint: 'MongoDB · Express · React · Mongoose',
    stack: 'mern',
    express: { orm: 'mongoose', db_engine: 'mongodb', auth: 'jwt', validation: 'zod' },
    react: { ui_lib: 'shadcn', state_lib: 'zustand', http_lib: 'axios', data_fetching: 'tanstack-query' },
  },
  t3: {
    label: 'T3 Stack',
    hint: 'Next.js · tRPC · Prisma · Tailwind',
    stack: 't3',
  },
  'laravel-api': {
    label: 'Laravel API',
    hint: 'Laravel 12 · Sanctum · MySQL',
    stack: 'laravel',
    laravel: { pattern: 'api-only', auth: 'sanctum', db_engine: 'mysql', php_version: '8.4', laravel_version: '12' },
  },
  'laravel-react': {
    label: 'Laravel + React',
    hint: 'Laravel 12 · Sanctum · MySQL · shadcn',
    stack: 'laravel+react',
    laravel: { pattern: 'api-only', auth: 'sanctum', db_engine: 'mysql', php_version: '8.4', laravel_version: '12' },
    react: { ui_lib: 'shadcn', state_lib: 'zustand', http_lib: 'axios', data_fetching: 'tanstack-query' },
  },
  'fastapi-react': {
    label: 'FastAPI + React',
    hint: 'FastAPI · SQLModel · PostgreSQL · shadcn',
    stack: 'fastapi+react',
    fastapi: { orm: 'sqlmodel', db_engine: 'postgresql', auth: 'jwt', cors: true, swagger: true },
    react: { ui_lib: 'shadcn', state_lib: 'zustand', http_lib: 'axios', data_fetching: 'tanstack-query' },
  },
  'nestjs-api': {
    label: 'NestJS API',
    hint: 'NestJS · TypeORM · PostgreSQL · Swagger',
    stack: 'nestjs',
    nestjs: { orm: 'typeorm', db_engine: 'postgresql', auth: 'jwt', swagger: true },
  },
  django: {
    label: 'Django',
    hint: 'Django · PostgreSQL',
    stack: 'django',
  },
}
