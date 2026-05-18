import { z } from 'zod'

export const NestArchitectureSchema = z.enum([
  'modular',      // un module par entité (recommandé)
  'cqrs',         // Commands + Queries + EventBus
  'microservices', // transporter TCP/Redis, services séparés
]);

export const NestConfigSchema = z.object({
  architecture:  NestArchitectureSchema.default('modular'),
  orm:           z.enum(['typeorm', 'prisma', 'mongoose', 'drizzle']).default('typeorm'),
  db_engine:     z.enum(['postgresql', 'mysql', 'sqlite', 'mongodb']).default('postgresql'),
  auth:          z.enum(['jwt', 'api-key', 'none']).default('none'),
  swagger:       z.boolean().default(true),
  validation:    z.boolean().default(true),
  serialization: z.boolean().default(true),
  throttling:    z.boolean().default(false),
  timestamps:    z.boolean().default(true),
  softDeletes:   z.boolean().default(false),
  runner:        z.enum(['makefile', 'bash', 'none']).default('makefile'),
});

export type NestConfig = z.infer<typeof NestConfigSchema>;
