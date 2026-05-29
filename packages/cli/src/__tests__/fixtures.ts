import type { ProjectConfig } from '@stack-init/schema'

const BASE_MODEL = {
  name: 'Post',
  table: 'posts',
  fields: [
    { name: 'title',     type: 'string',  required: true,  nullable: false },
    { name: 'content',   type: 'text',    required: false, nullable: true  },
    { name: 'published', type: 'boolean', required: true,  nullable: false },
  ],
  relations: [],
  generate: {
    migration: true, controller: true, resource: true, request: true,
    policy: false,   factory: true,    seeder: true,   swagger: false,
    softDelete: false, repository: false, service: false, tests: false, routes: true,
  },
  migration: { timestamps: true, primary_key: 'id' },
} as const

export const expressConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'express',
  models: [BASE_MODEL as any],
  express: {
    architecture: 'layered',
    orm: 'prisma',
    db_engine: 'postgresql',
    auth: 'none',
    swagger: false,
  },
}

export const expressMongoConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'mern',
  models: [BASE_MODEL as any],
  express: {
    architecture: 'layered',
    orm: 'mongoose',
    db_engine: 'mongodb',
    auth: 'none',
    swagger: false,
  },
}

export const nestConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'nestjs',
  models: [BASE_MODEL as any],
  nestjs: {
    architecture: 'modular',
    orm: 'typeorm',
    db_engine: 'postgresql',
    swagger: false,
    auth: 'none',
    validation: true,
    serialization: false,
    throttling: false,
  },
}

export const nestCqrsConfig: ProjectConfig = {
  ...nestConfig,
  nestjs: {
    ...nestConfig.nestjs!,
    architecture: 'cqrs',
  },
}

export const fastapiConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'fastapi',
  models: [BASE_MODEL as any],
  fastapi: {
    architecture: 'layered',
    orm: 'sqlalchemy',
    db_engine: 'postgresql',
    auth: 'none',
    migrations: true,
    cors: true,
    swagger: true,
    rate_limiting: false,
    background_tasks: false,
    websockets: false,
    runner: 'none',
    python_version: '3.11',
    async_mode: false,
  },
}

export const fastapiBeanieConfig: ProjectConfig = {
  ...fastapiConfig,
  fastapi: {
    ...fastapiConfig.fastapi!,
    orm: 'beanie',
    db_engine: 'mongodb',
    migrations: false,
    async_mode: true,
  },
}

export const nextjsConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'nextjs',
  models: [BASE_MODEL as any],
  react: {
    state_lib: 'zustand',
    form_lib:  'react-hook-form',
    ui_lib:    'none',
    http_lib:  'fetch',
    data_fetching: 'tanstack-query',
    router: 'none',
    css:    'tailwind',
  },
}

export const laravelConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'laravel',
  models: [BASE_MODEL as any],
  laravel: {
    pattern: 'api-only',
    auth: 'sanctum',
    php_version: '8.2',
    laravel_version: '11',
    db_engine: 'mysql',
    runner: 'makefile',
  },
}

export const vueConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'mevn',
  models: [BASE_MODEL as any],
  vue: {
    ui_lib: 'none',
    state_lib: 'pinia',
    router: 'vue-router',
    css: 'none',
  },
}

export const djangoConfig: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 'django',
  models: [BASE_MODEL as any],
}

export const t3Config: ProjectConfig = {
  name: 'my-app',
  version: '1.0.0',
  stack: 't3',
  models: [BASE_MODEL as any],
}
