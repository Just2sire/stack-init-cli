import { z } from 'zod'
import { ModelSchema, validateForeignKeys } from './models.schema'
import { LaravelOptionsSchema } from './laravel.schema'
import { ReactOptionsSchema } from './react.schema'
import { ExpressConfigSchema } from './express.schema'
import { NestConfigSchema } from './nest.schema'
import { FastAPIConfigSchema } from './fastapi.schema'

export const StackSchema = z.enum([
  'laravel', 'laravel+react', 'laravel+nextjs',
  'nextjs', 'react', 'nestjs', 'nestjs+react', 'django', 'rails',
  'express', 'express+react', 'fastapi', 'fastapi+react', 'fastapi+nextjs',
  'mern', 'pern', 't3', 'mevn', 'mean',
])
export type Stack = z.infer<typeof StackSchema>

export const ZIP_STACKS:   Stack[] = ['react', 'nextjs', 'express', 'nestjs', 'fastapi', 'mern', 'pern', 't3', 'mevn', 'mean']
export const CLI_STACKS:   Stack[] = ['laravel', 'nestjs', 'django', 'rails', 'express', 'fastapi']
export const MIXED_STACKS: Stack[] = ['laravel+react', 'laravel+nextjs', 'nestjs+react', 'express+react', 'fastapi+react', 'fastapi+nextjs', 'mern', 'pern', 't3', 'mevn', 'mean']

export const isZipStack   = (s: Stack) => ZIP_STACKS.includes(s)   || MIXED_STACKS.includes(s)
export const isCliStack   = (s: Stack) => CLI_STACKS.includes(s)   || MIXED_STACKS.includes(s)
export const isMixedStack = (s: Stack) => MIXED_STACKS.includes(s)

const REQUIRES_EXPRESS = ['express', 'express+react', 'mern', 'pern', 'mevn', 'mean']
const REQUIRES_FASTAPI = ['fastapi', 'fastapi+react', 'fastapi+nextjs']
const REQUIRES_NESTJS  = ['nestjs', 'nestjs+react']
const REQUIRES_REACT   = ['react', 'express+react', 'nestjs+react', 'fastapi+react', 'mern', 'pern', 'mevn', 'mean']

export const ServiceIdSchema = z.enum(['auth', 'email', 'cache', 'websockets', 'queue', 'file-upload'])
export type ServiceId = z.infer<typeof ServiceIdSchema>

export const ProjectConfigSchema = z.object({
  name:         z.string().min(1).regex(/^[a-z][a-z0-9_-]*$/, 'Nom en kebab-case ou snake_case (lettres minuscules, chiffres, tirets et underscores autorisés)'),
  description:  z.string().optional(),
  version:      z.string().default('0.1.0'),
  stack:        StackSchema,
  models:       z.array(ModelSchema).min(1, 'Définit au moins un modèle'),
  services:     z.array(ServiceIdSchema).optional(),
  laravel:      LaravelOptionsSchema.optional(),
  react:        ReactOptionsSchema.optional(),
  express:      ExpressConfigSchema.optional(),
  nestjs:       NestConfigSchema.optional(),
  fastapi:      FastAPIConfigSchema.optional(),
  generated_at: z.string().optional(),
}).superRefine((data, ctx) => {
  if (isCliStack(data.stack) && data.stack.includes('laravel') && !data.laravel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['laravel'], message: 'Config Laravel requise.' })
  }
  
  if (REQUIRES_EXPRESS.includes(data.stack) && !data.express) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['express'], message: 'Config Express requise.' })
  }
  
  if (data.express && data.express.orm === 'mongoose' && data.express.db_engine !== 'mongodb') {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['express', 'db_engine'], message: "L'ORM Mongoose nécessite le moteur de base de données 'mongodb'." })
  }
  
  if (REQUIRES_NESTJS.includes(data.stack) && !data.nestjs) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['nestjs'], message: 'Config NestJS requise.' })
  }
  
  if (REQUIRES_FASTAPI.includes(data.stack) && !data.fastapi) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['fastapi'], message: 'Config FastAPI requise.' })
  }

  if (REQUIRES_REACT.includes(data.stack) && !data.react) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['react'], message: 'Config React requise.' })
  }

  const { valid, errors } = validateForeignKeys(data.models)
  if (!valid) {
    errors.forEach(msg => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['models'], message: msg }))
  }
})

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>

export function parseProjectConfig(raw: unknown):
  | { success: true;  data: ProjectConfig }
  | { success: false; errors: string[] }
{
  const result = ProjectConfigSchema.safeParse(raw)
  if (result.success) return { success: true, data: result.data }

  const errors = result.error.issues.map(i => {
    const path = i.path.join('.') || 'root'
    return `[${path}] ${i.message}`
  })

  return {
    success: false,
    errors,
  }
}
