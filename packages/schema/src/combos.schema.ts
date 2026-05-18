import { z } from 'zod';

export const COMBO_DEFINITIONS = {
  mern: {
    label:       'MERN Stack',
    description: 'MongoDB · Express · React · Node.js — Le combo JavaScript classique.',
    backend:     'express',
    frontend:    'react',
    backendConfig: {
      orm:          'mongoose',
      db_engine:    'mongodb',
      architecture: 'layered',
      middlewares:  ['cors', 'morgan', 'error-handler'],
      auth:         'jwt',
      typescript:   true,
    },
    frontendConfig: {
      state_lib:    'zustand',
      http_lib:     'axios',
      ui_lib:       'shadcn',
      data_fetching:'tanstack-query',
      css:          'tailwind',
      typescript:   true,
    },
    integration: {
      api_base_url_env: 'VITE_API_URL',
      api_base_url_default: 'http://localhost:3000/api',
      generates_api_client: true,
      generates_types: true,
    },
  },
  pern: {
    label:       'PERN Stack',
    description: 'PostgreSQL · Express · React · Node.js — MERN mais avec PostgreSQL et Prisma.',
    backend:     'express',
    frontend:    'react',
    backendConfig: {
      orm:          'prisma',
      db_engine:    'postgresql',
      architecture: 'layered',
      auth:         'jwt',
    },
    frontendConfig: {
      state_lib:    'zustand',
      http_lib:     'axios',
      ui_lib:       'shadcn',
      data_fetching:'tanstack-query',
      css:          'tailwind',
    },
    integration: {
      api_base_url_env: 'VITE_API_URL',
      generates_api_client: true,
      generates_types: true,
    },
  },
  'fastapi-react': {
    label:       'FastAPI + React',
    description: 'FastAPI · SQLModel · React · Python — API Python moderne + frontend React.',
    backend:     'fastapi',
    frontend:    'react',
    backendConfig: {
      orm:          'sqlmodel',
      db_engine:    'postgresql',
      auth:         'jwt',
      swagger:      true,
      cors:         true,
    },
    frontendConfig: {
      state_lib:    'zustand',
      http_lib:     'axios',
      ui_lib:       'shadcn',
      data_fetching:'tanstack-query',
      css:          'tailwind',
    },
    integration: {
      api_base_url_env: 'VITE_API_URL',
      api_base_url_default: 'http://localhost:8000',
      generates_api_client: true,
      generates_types: true,
      openapi_client_gen: true,
    },
  },
} as const;

export type ComboId = keyof typeof COMBO_DEFINITIONS;
export const ComboSchema = z.enum(Object.keys(COMBO_DEFINITIONS) as [ComboId, ...ComboId[]]);
