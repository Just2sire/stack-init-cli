import { z } from 'zod'

export const LaravelOptionsSchema = z.object({
  pattern:          z.enum(['full', 'api-only', 'minimal']).default('api-only'),
  auth:             z.enum(['none', 'sanctum', 'passport', 'breeze', 'jetstream']).default('sanctum'),
  runner:           z.enum(['makefile', 'bash', 'both', 'none']).default('makefile'),
  php_version:      z.enum(['8.1', '8.2', '8.3', '8.4']).default('8.4'),
  laravel_version:  z.enum(['10', '11', '12', '13']).default('12'),
  use_strict_types: z.boolean().default(true),
  use_readonly:     z.boolean().default(false),
  use_enum_backed:  z.boolean().default(true),
  route_prefix:     z.string().default('api'),
  db_engine:        z.enum(['mysql', 'pgsql', 'sqlite', 'sqlsrv']).default('mysql'),
  use_redis:        z.boolean().default(false),
  api_version:      z.string().default('v1'),
  use_api_response: z.boolean().default(true),
})
export type LaravelOptions = z.infer<typeof LaravelOptionsSchema>
