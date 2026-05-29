import Handlebars from 'handlebars'
import { fieldToMigrationLine, fieldToSwaggerType } from '../../utils/field-helpers'
import { camelCase, pluralize } from '../../utils/naming'
import type { NamedField } from '@stack-init/schema'

export function configureHandlebars(): typeof Handlebars {
  const hbs = Handlebars.create()

  hbs.registerHelper('eq',       (a: unknown, b: unknown) => a === b)
  hbs.registerHelper('neq',      (a: unknown, b: unknown) => a !== b)
  hbs.registerHelper('and',      (a: unknown, b: unknown) => Boolean(a) && Boolean(b))
  hbs.registerHelper('or',       (a: unknown, b: unknown) => Boolean(a) || Boolean(b))
  hbs.registerHelper('not',      (a: unknown) => !a)
  hbs.registerHelper('includes', (arr: unknown[], val: unknown) => Array.isArray(arr) && arr.includes(val))

  hbs.registerHelper('camelCase',      (s: string) => camelCase(s))
  hbs.registerHelper('camelCasePlural',(s: string) => camelCase(pluralize(s)))
  hbs.registerHelper('pluralize',      (s: string) => pluralize(s))

  hbs.registerHelper('migrationLine', (field: NamedField) =>
    new Handlebars.SafeString(fieldToMigrationLine(field))
  )

  hbs.registerHelper('swaggerType', (field: NamedField) =>
    new Handlebars.SafeString(fieldToSwaggerType(field))
  )

  // Maps a field type to a PHP scalar type hint (for constructor promotion / docblocks)
  hbs.registerHelper('phpType', (field: NamedField): string => {
    const intTypes = ['tinyInteger','smallInteger','mediumInteger','integer','bigInteger',
      'unsignedTinyInteger','unsignedSmallInteger','unsignedInteger','unsignedBigInteger','year']
    const floatTypes = ['float','double','decimal']
    if (intTypes.includes(field.type)) return 'int'
    if (floatTypes.includes(field.type)) return 'float'
    if (field.type === 'boolean') return 'bool'
    if (field.type === 'json' || field.type === 'jsonb') return 'array'
    return 'string'
  })

  hbs.registerHelper('spaces', function(str, width) {
    const s = String(str || '')
    return new Handlebars.SafeString(s.padEnd(width || s.length))
  })

  return hbs
}
