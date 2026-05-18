import { z } from 'zod';

export const FastAPIORMSchema = z.enum([
  'sqlalchemy',
  'sqlmodel',
  'tortoise-orm',
  'beanie',
  'none',
]);

export const FastAPIAuthSchema = z.enum([
  'jwt',
  'oauth2',
  'api-key',
  'none',
]);

export const FastAPIArchitectureSchema = z.enum([
  'flat',
  'layered',
  'feature-based',
  'domain',
]);

export const FastAPIConfigSchema = z.object({
  architecture:   FastAPIArchitectureSchema.default('layered'),
  orm:            FastAPIORMSchema.default('sqlmodel'),
  db_engine:      z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  auth:           FastAPIAuthSchema.default('none'),
  migrations:     z.boolean().default(true),
  cors:           z.boolean().default(true),
  swagger:        z.boolean().default(true),
  rate_limiting:  z.boolean().default(false),
  background_tasks: z.boolean().default(false),
  websockets:     z.boolean().default(false),
  runner:         z.enum(['makefile', 'bash', 'none']).default('makefile'),
  python_version: z.enum(['3.10', '3.11', '3.12']).default('3.11'),
  async_mode:     z.boolean().default(true),
});

export type FastAPIConfig = z.infer<typeof FastAPIConfigSchema>;
