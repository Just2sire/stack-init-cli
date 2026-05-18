import type { NamedField } from '@stack-init/schema'

export function fieldToMigrationLine(field: NamedField): string {
  return `${buildBaseLine(field)}${buildModifiers(field)};`
}

function buildBaseLine(field: NamedField): string {
  const n = field.name
  switch (field.type) {
    case 'string':     return field.length !== 255 ? `$table->string('${n}', ${field.length})` : `$table->string('${n}')`
    case 'char':       return `$table->char('${n}', ${field.length})`
    case 'tinyText':   return `$table->tinyText('${n}')`
    case 'text':       return `$table->text('${n}')`
    case 'mediumText': return `$table->mediumText('${n}')`
    case 'longText':   return `$table->longText('${n}')`
    case 'enum':       return `$table->enum('${n}', [${field.values.map(v => `'${v}'`).join(', ')}])`
    case 'set':        return `$table->set('${n}', [${field.values.map(v => `'${v}'`).join(', ')}])`
    case 'json':       return `$table->json('${n}')`
    case 'jsonb':      return `$table->jsonb('${n}')`
    case 'uuid':       return `$table->uuid('${n}')`
    case 'ulid':       return `$table->ulid('${n}')`
    case 'ipAddress':  return `$table->ipAddress('${n}')`
    case 'macAddress': return `$table->macAddress('${n}')`

    case 'tinyInteger':           return `$table->tinyInteger('${n}')`
    case 'smallInteger':          return `$table->smallInteger('${n}')`
    case 'mediumInteger':         return `$table->mediumInteger('${n}')`
    case 'integer':               return `$table->integer('${n}')`
    case 'bigInteger':            return `$table->bigInteger('${n}')`
    case 'unsignedTinyInteger':   return `$table->unsignedTinyInteger('${n}')`
    case 'unsignedSmallInteger':  return `$table->unsignedSmallInteger('${n}')`
    case 'unsignedInteger':       return `$table->unsignedInteger('${n}')`
    case 'unsignedBigInteger':    return `$table->unsignedBigInteger('${n}')`
    case 'float':    return `$table->float('${n}', ${field.precision}, ${field.scale})`
    case 'double':   return `$table->double('${n}', ${field.precision}, ${field.scale})`
    case 'decimal':  return `$table->decimal('${n}', ${field.precision}, ${field.scale})`
    case 'year':     return `$table->year('${n}')`

    case 'date':        return `$table->date('${n}')`
    case 'dateTime':    return field.precision ? `$table->dateTime('${n}', ${field.precision})` : `$table->dateTime('${n}')`
    case 'dateTimeTz':  return field.precision ? `$table->dateTimeTz('${n}', ${field.precision})` : `$table->dateTimeTz('${n}')`
    case 'time':        return field.precision ? `$table->time('${n}', ${field.precision})` : `$table->time('${n}')`
    case 'timeTz':      return field.precision ? `$table->timeTz('${n}', ${field.precision})` : `$table->timeTz('${n}')`
    case 'timestamp':   return field.precision ? `$table->timestamp('${n}', ${field.precision})` : `$table->timestamp('${n}')`
    case 'timestampTz': return field.precision ? `$table->timestampTz('${n}', ${field.precision})` : `$table->timestampTz('${n}')`

    case 'boolean':    return `$table->boolean('${n}')`
    case 'binary':     return `$table->binary('${n}')`
    case 'tinyBlob':   return `$table->tinyBlob('${n}')`
    case 'blob':       return `$table->blob('${n}')`
    case 'mediumBlob': return `$table->mediumBlob('${n}')`
    case 'longBlob':   return `$table->longBlob('${n}')`

    case 'id':         return `$table->id()`
    case 'foreignId': {
      const c = field.constrained !== false ? `->constrained('${field.references}')` : ''
      const d = (field.constrained !== false && field.on_delete === 'cascade') ? `->cascadeOnDelete()` : ''
      return `$table->foreignId('${n}')${c}${d}`
    }
    case 'foreignUuid': return `$table->foreignUuid('${n}')${field.constrained !== false ? `->constrained('${field.references}')` : ''}`
    case 'foreignUlid': return `$table->foreignUlid('${n}')${field.constrained !== false ? `->constrained('${field.references}')` : ''}`
    case 'morphs':      return `$table->morphs('${n}')`
    case 'uuidMorphs':  return `$table->uuidMorphs('${n}')`

    case 'geometry':      return `$table->geometry('${n}')`
    case 'geography':     return `$table->geography('${n}')`
    case 'point':         return `$table->point('${n}')`
    case 'lineString':    return `$table->lineString('${n}')`
    case 'polygon':       return `$table->polygon('${n}')`
    case 'vector':        return `$table->vector('${n}', ${field.dimensions})`
    case 'rememberToken': return `$table->rememberToken()`

    default:
      const _: never = field
      throw new Error(`Type non géré: ${(_ as any).type}`)
  }
}

function buildModifiers(field: NamedField): string {
  const parts: string[] = []
  const noNullable  = ['morphs', 'uuidMorphs', 'id', 'rememberToken']
  const noDefault   = ['text', 'mediumText', 'longText', 'blob', 'mediumBlob', 'longBlob', 'json', 'jsonb', 'binary', 'morphs', 'uuidMorphs', 'geometry', 'geography', 'point', 'lineString', 'polygon', 'vector']

  if ('nullable' in field && field.nullable && !noNullable.includes(field.type)) parts.push('->nullable()')
  if ('unique'   in field && field.unique)   parts.push('->unique()')
  if ('index'    in field && field.index)    parts.push('->index()')
  if ('default'  in field && field.default !== undefined && !noDefault.includes(field.type)) {
    const v = field.default
    parts.push(typeof v === 'string' ? `->default('${v}')` : `->default(${v})`)
  }
  if ('comment' in field && field.comment) parts.push(`->comment('${field.comment}')`)
  return parts.join('')
}

export function fieldToCast(field: NamedField): string | null {
  switch (field.type) {
    case 'boolean':                     return `'boolean'`
    case 'integer': case 'tinyInteger': case 'smallInteger':
    case 'mediumInteger': case 'bigInteger':
    case 'unsignedInteger': case 'unsignedBigInteger':
    case 'unsignedTinyInteger': case 'unsignedSmallInteger': return `'integer'`
    case 'float': case 'double':        return `'float'`
    case 'decimal':                     return `'decimal:${field.scale}'`
    case 'date':                        return `'date'`
    case 'dateTime': case 'dateTimeTz': return `'datetime'`
    case 'timestamp': case 'timestampTz': return `'timestamp'`
    case 'json': case 'jsonb':          return `'array'`
    default:                            return null
  }
}

export function fieldToValidationRule(field: NamedField, tableName: string): string[] {
  const rules: string[] = []
  const isNullable = 'nullable' in field && field.nullable
  rules.push(isNullable ? 'nullable' : 'required')

  switch (field.type) {
    case 'string': case 'char': case 'tinyText':
    case 'uuid': case 'ulid': case 'ipAddress': case 'macAddress':
      rules.push('string')
      if (field.type === 'string' && field.length) rules.push(`max:${field.length}`)
      if (field.type === 'uuid') rules.push('uuid')
      break
    case 'text': case 'mediumText': case 'longText': rules.push('string'); break
    case 'enum': rules.push(`in:${field.values.join(',')}`); break
    case 'integer': case 'tinyInteger': case 'smallInteger':
    case 'mediumInteger': case 'bigInteger':
      rules.push('integer'); break
    case 'unsignedInteger': case 'unsignedBigInteger':
    case 'unsignedTinyInteger': case 'unsignedSmallInteger':
      rules.push('integer', 'min:0'); break
    case 'float': case 'double': case 'decimal': case 'year':
      rules.push('numeric'); break
    case 'boolean': rules.push('boolean'); break
    case 'date':    rules.push('date'); break
    case 'dateTime': case 'dateTimeTz':
    case 'timestamp': case 'timestampTz': rules.push('date'); break
    case 'json': case 'jsonb': rules.push('array'); break
    case 'foreignId': case 'foreignUuid': case 'foreignUlid':
      rules.push(`exists:${field.references},id`); break
    default: break
  }
  if ('unique' in field && field.unique) rules.push(`unique:${tableName},${field.name}`)
  return rules
}

export function fieldToFaker(field: NamedField): string {
  const n = field.name.toLowerCase()
  if (n === 'email' || n.endsWith('_email'))    return `fake()->unique()->safeEmail()`
  if (n === 'name'  || n === 'full_name')       return `fake()->name()`
  if (n === 'first_name')                       return `fake()->firstName()`
  if (n === 'last_name')                        return `fake()->lastName()`
  if (n === 'phone' || n.endsWith('_phone'))    return `fake()->phoneNumber()`
  if (n === 'address')                          return `fake()->address()`
  if (n === 'city')                             return `fake()->city()`
  if (n === 'country')                          return `fake()->country()`
  if (n === 'url'   || n.endsWith('_url'))      return `fake()->url()`
  if (n === 'slug')                             return `fake()->slug()`
  if (n === 'title')                            return `fake()->sentence(3)`
  if (n === 'body'  || n === 'content' || n === 'description') return `fake()->paragraphs(3, true)`
  if (n === 'price' || n === 'amount')          return `fake()->randomFloat(2, 1, 999)`
  if (n === 'latitude'  || n === 'lat')         return `fake()->latitude()`
  if (n === 'longitude' || n === 'lng')         return `fake()->longitude()`
  if (n === 'token')                            return `fake()->sha256()`

  switch (field.type) {
    case 'string':      return `fake()->words(3, true)`
    case 'char':        return `fake()->lexify(str_repeat('?', ${field.length}))`
    case 'text': case 'mediumText': case 'longText': return `fake()->paragraph()`
    case 'tinyText':    return `fake()->sentence()`
    case 'integer': case 'smallInteger': case 'mediumInteger': case 'bigInteger': return `fake()->numberBetween(1, 1000)`
    case 'unsignedTinyInteger': case 'unsignedSmallInteger':
    case 'unsignedInteger': case 'unsignedBigInteger': return `fake()->numberBetween(0, 1000)`
    case 'tinyInteger': return `fake()->numberBetween(-128, 127)`
    case 'float': case 'double': return `fake()->randomFloat(${field.scale}, 0, 1000)`
    case 'decimal':     return `fake()->randomFloat(${field.scale}, 0, 1000)`
    case 'boolean':     return `fake()->boolean()`
    case 'date':        return `fake()->date()`
    case 'dateTime': case 'dateTimeTz': return `fake()->dateTime()`
    case 'timestamp': case 'timestampTz': return `fake()->dateTime()`
    case 'year':        return `fake()->year()`
    case 'uuid':        return `fake()->uuid()`
    case 'ulid':        return `(string) \\Illuminate\\Support\\Str::ulid()`
    case 'ipAddress':   return `fake()->ipv4()`
    case 'macAddress':  return `fake()->macAddress()`
    case 'json': case 'jsonb': return `[]`
    case 'enum':        return `fake()->randomElement([${field.values.map(v => `'${v}'`).join(', ')}])`
    case 'foreignId':
      return `fake()->randomDigitNotNull()`
    case 'foreignUuid': case 'foreignUlid':
      return `fake()->uuid()`
    default:            return `null`
  }
}
