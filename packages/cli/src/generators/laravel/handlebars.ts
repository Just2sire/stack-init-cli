import Handlebars from 'handlebars'
import { fieldToMigrationLine } from '../../utils/field-helpers'
import { camelCase, pluralize } from '../../utils/naming'
import type { NamedField } from '@stack-init/schema'

export function configureHandlebars(): typeof Handlebars {
  const hbs = Handlebars.create()

  hbs.registerHelper('eq',  (a: unknown, b: unknown) => a === b)
  hbs.registerHelper('neq', (a: unknown, b: unknown) => a !== b)
  hbs.registerHelper('and', (a: unknown, b: unknown) => Boolean(a) && Boolean(b))
  hbs.registerHelper('or',  (a: unknown, b: unknown) => Boolean(a) || Boolean(b))
  hbs.registerHelper('not', (a: unknown) => !a)

  hbs.registerHelper('camelCase',      (s: string) => camelCase(s))
  hbs.registerHelper('camelCasePlural',(s: string) => camelCase(pluralize(s)))
  hbs.registerHelper('pluralize',      (s: string) => pluralize(s))

  hbs.registerHelper('migrationLine', (field: NamedField) =>
    new Handlebars.SafeString(fieldToMigrationLine(field))
  )

  hbs.registerHelper('spaces', function(str, width) {
  const s = String(str || '');
  return new Handlebars.SafeString(s.padEnd(width || s.length));
});

  return hbs
}
