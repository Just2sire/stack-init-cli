import { z } from 'zod'
import { BackendArchitectureSchema } from './architecture.schema'

export const ExpressOrmSchema = z.enum([
  'prisma',
  'sequelize',
  'typeorm',
  'mongoose',
  'knex',
  'none',
]);

export const ExpressConfigSchema = z.object({
  architecture:  BackendArchitectureSchema.default('layered'),
  orm:           ExpressOrmSchema.default('prisma'),
  db_engine:     z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  auth:          z.enum(['jwt', 'session', 'none']).default('none'),
  validation:    z.enum(['zod', 'joi', 'express-validator', 'none']).default('zod'),
  runner:        z.enum(['makefile', 'bash', 'none']).default('makefile'),
  middlewares:   z.array(z.enum([
    'cors', 'morgan', 'rate-limit', 'helmet', 'compression', 'error-handler'
  ])).default(['cors', 'morgan', 'error-handler']),
  swagger:       z.boolean().default(false),
  typescript:    z.boolean().default(true),
  port:          z.number().default(3000),
});

export type ExpressConfig = z.infer<typeof ExpressConfigSchema>;
