import { z } from 'zod'
import { FieldSchema } from './field-types'

export const NamedFieldSchema = z.object({
  name: z.string().min(1).regex(/^[a-z][a-z0-9_]*$/, 'Nom de champ en snake_case uniquement'),
}).and(FieldSchema)

export type NamedField = z.infer<typeof NamedFieldSchema>

export const RelationTypeSchema = z.enum([
  'hasOne', 'hasMany', 'belongsTo', 'belongsToMany',
  'hasOneThrough', 'hasManyThrough',
  'morphOne', 'morphMany', 'morphTo', 'morphToMany', 'morphedByMany',
])
export type RelationType = z.infer<typeof RelationTypeSchema>

export const RelationSchema = z.object({
  type:         RelationTypeSchema,
  model:        z.string(),
  pivot_table:  z.string().optional(),
  foreign_key:  z.string().optional(),
  local_key:    z.string().optional(),
  through:      z.string().optional(),
  with_trashed: z.boolean().default(false),
})
export type Relation = z.infer<typeof RelationSchema>

export const GenerateOptionsSchema = z.object({
  migration:   z.boolean().default(true),
  controller:  z.boolean().default(true),
  resource:    z.boolean().default(true),
  request:     z.boolean().default(true),
  policy:      z.boolean().default(false),
  factory:     z.boolean().default(true),
  seeder:      z.boolean().default(false),
  swagger:     z.boolean().default(false),
  softDelete:  z.boolean().default(false),
  repository:  z.boolean().default(false),
  service:     z.boolean().default(false),
  tests:       z.boolean().default(true),
  routes:      z.boolean().default(false),
  // Nouveaux — NestJS / Express
  dto:         z.boolean().default(true),   // NestJS : CreateDto + UpdateDto
  module:      z.boolean().default(true),   // NestJS : module dédié
  schema:      z.boolean().default(true),   // Express Prisma : bloc model dans schema.prisma
  // Nouveaux — Laravel
  observer:    z.boolean().default(false),  // ModelObserver (created/updated/deleted hooks)
  events:      z.boolean().default(false),  // Events + queue Listeners par modèle
  actions:     z.boolean().default(false),  // Action classes (Create/Update/Delete)
  collection:  z.boolean().default(false),  // ResourceCollection avec pagination meta
})
export type GenerateOptions = z.infer<typeof GenerateOptionsSchema>

export const MigrationOptionsSchema = z.object({
  timestamps:    z.boolean().default(true),
  timestampsTz:  z.boolean().default(false),
  softDeletes:   z.boolean().default(false),
  softDeletesTz: z.boolean().default(false),
  primary_key:   z.enum(['id', 'uuid', 'ulid', 'custom']).default('id'),
  engine:        z.string().optional(),
  charset:       z.string().optional(),
  collation:     z.string().optional(),
})
export type MigrationOptions = z.infer<typeof MigrationOptionsSchema>

export const ModelSchema = z.object({
  name: z.string().min(1).regex(/^[A-Z][a-zA-Z0-9]*$/, 'Nom de modèle en PascalCase uniquement'),
  table:     z.string().optional(),
  fields:    z.array(NamedFieldSchema).min(1, 'Un modèle doit avoir au moins un champ'),
  relations: z.array(RelationSchema).default([]),
  migration: MigrationOptionsSchema.default({}),
  generate:  GenerateOptionsSchema.default({}),
})
export type Model = z.infer<typeof ModelSchema>

export function validateForeignKeys(models: Model[]): { valid: boolean; errors: string[] } {
  const modelNames = new Set(models.map(m => m.name))
  const modelTables = new Set(models.filter(m => m.table).map(m => m.table as string))
  const errors: string[] = []

  for (const model of models) {
    for (const field of model.fields) {
      if (
        (field.type === 'foreignId' || field.type === 'foreignUuid' || field.type === 'foreignUlid') &&
        'references' in field
      ) {
        const tableName = field.references as string
        const inferredModel = tableName
          .replace(/_./g, c => c[1].toUpperCase())
          .replace(/^./, c => c.toUpperCase())
          .replace(/s$/, '')

        if (!modelNames.has(inferredModel) && !modelNames.has(tableName) && !modelTables.has(tableName)) {
          errors.push(
            `[${model.name}.${'name' in field ? field.name : ''}] foreignId référence "${tableName}" mais aucun modèle trouvé.`
          )
        }
      }
    }
    for (const rel of model.relations) {
      if (!modelNames.has(rel.model)) {
        errors.push(`[${model.name}] Relation ${rel.type} → "${rel.model}" : modèle introuvable.`)
      }
    }
  }
  return { valid: errors.length === 0, errors }
}
