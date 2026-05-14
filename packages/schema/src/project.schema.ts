import { z } from 'zod'
import { ModelSchema, validateForeignKeys } from './models.schema'
import { LaravelOptionsSchema } from './laravel.schema'
import { ReactOptionsSchema } from './react.schema'

export const StackSchema = z.enum([
  'laravel', 'laravel+react', 'laravel+nextjs',
  'nextjs', 'react', 'nestjs', 'django', 'rails',
])
export type Stack = z.infer<typeof StackSchema>

export const ZIP_STACKS:   Stack[] = ['react', 'nextjs']
export const CLI_STACKS:   Stack[] = ['laravel', 'nestjs', 'django', 'rails']
export const MIXED_STACKS: Stack[] = ['laravel+react', 'laravel+nextjs']

export const isZipStack   = (s: Stack) => ZIP_STACKS.includes(s)   || MIXED_STACKS.includes(s)
export const isCliStack   = (s: Stack) => CLI_STACKS.includes(s)   || MIXED_STACKS.includes(s)
export const isMixedStack = (s: Stack) => MIXED_STACKS.includes(s)

export const ProjectConfigSchema = z.object({
  name:         z.string().min(1).regex(/^[a-z][a-z0-9_-]*$/, 'Nom en kebab-case ou snake_case (lettres minuscules, chiffres, tirets et underscores autorisés)'),
  description:  z.string().optional(),
  version:      z.string().default('0.1.0'),
  stack:        StackSchema,
  models:       z.array(ModelSchema).min(1, 'Définit au moins un modèle'),
  laravel:      LaravelOptionsSchema.optional(),
  react:        ReactOptionsSchema.optional(),
  generated_at: z.string().optional(),
}).superRefine((data, ctx) => {
  if (isCliStack(data.stack) && data.stack.includes('laravel') && !data.laravel) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['laravel'], message: 'Config Laravel requise.' })
  }
  if (isZipStack(data.stack) && !data.react) {
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
  return {
    success: false,
    errors: result.error.issues.map(i => `[${i.path.join('.') || 'root'}] ${i.message}`),
  }
}
