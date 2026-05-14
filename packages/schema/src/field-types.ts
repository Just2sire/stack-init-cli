import { z } from 'zod'

// ---------------------------------------------------------------------------
// Modificateurs communs applicables à (presque) tous les champs
// ---------------------------------------------------------------------------
const BaseFieldModifiers = z.object({
  nullable: z.boolean().default(false),
  unique:   z.boolean().default(false),
  index:    z.boolean().default(false),
  default:  z.union([z.string(), z.number(), z.boolean()]).optional(),
  comment:  z.string().optional(),
  unsigned: z.boolean().default(false),
})

// ---------------------------------------------------------------------------
// TEXTE
// ---------------------------------------------------------------------------
export const StringFieldSchema = BaseFieldModifiers.extend({
  type:   z.literal('string'),
  length: z.number().int().min(1).max(65535).default(255),
})
export const CharFieldSchema = BaseFieldModifiers.extend({
  type:   z.literal('char'),
  length: z.number().int().min(1).max(255).default(4),
})
export const TinyTextFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('tinyText') })
export const TextFieldSchema       = BaseFieldModifiers.extend({ type: z.literal('text') })
export const MediumTextFieldSchema = BaseFieldModifiers.extend({ type: z.literal('mediumText') })
export const LongTextFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('longText') })
export const EnumFieldSchema = BaseFieldModifiers.extend({
  type:   z.literal('enum'),
  values: z.array(z.string()).min(1, 'Un enum doit avoir au moins une valeur'),
})
export const SetFieldSchema = BaseFieldModifiers.extend({
  type:   z.literal('set'),
  values: z.array(z.string()).min(1),
})
export const JsonFieldSchema       = BaseFieldModifiers.extend({ type: z.literal('json') })
export const JsonbFieldSchema      = BaseFieldModifiers.extend({ type: z.literal('jsonb') })
export const UuidFieldSchema       = BaseFieldModifiers.extend({ type: z.literal('uuid') })
export const UlidFieldSchema       = BaseFieldModifiers.extend({ type: z.literal('ulid') })
export const IpAddressFieldSchema  = BaseFieldModifiers.extend({ type: z.literal('ipAddress') })
export const MacAddressFieldSchema = BaseFieldModifiers.extend({ type: z.literal('macAddress') })

// ---------------------------------------------------------------------------
// NOMBRES
// ---------------------------------------------------------------------------
export const TinyIntegerFieldSchema    = BaseFieldModifiers.extend({ type: z.literal('tinyInteger') })
export const SmallIntegerFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('smallInteger') })
export const MediumIntegerFieldSchema  = BaseFieldModifiers.extend({ type: z.literal('mediumInteger') })
export const IntegerFieldSchema        = BaseFieldModifiers.extend({ type: z.literal('integer') })
export const BigIntegerFieldSchema     = BaseFieldModifiers.extend({ type: z.literal('bigInteger') })
export const UnsignedTinyIntegerFieldSchema  = BaseFieldModifiers.extend({ type: z.literal('unsignedTinyInteger') })
export const UnsignedSmallIntegerFieldSchema = BaseFieldModifiers.extend({ type: z.literal('unsignedSmallInteger') })
export const UnsignedIntegerFieldSchema      = BaseFieldModifiers.extend({ type: z.literal('unsignedInteger') })
export const UnsignedBigIntegerFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('unsignedBigInteger') })
export const FloatFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('float'),
  precision: z.number().int().min(1).max(65).default(8),
  scale:     z.number().int().min(0).max(30).default(2),
})
export const DoubleFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('double'),
  precision: z.number().int().min(1).max(65).default(15),
  scale:     z.number().int().min(0).max(30).default(8),
})
export const DecimalFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('decimal'),
  precision: z.number().int().min(1).max(65).default(10),
  scale:     z.number().int().min(0).max(30).default(2),
})
export const YearFieldSchema = BaseFieldModifiers.extend({ type: z.literal('year') })

// ---------------------------------------------------------------------------
// DATE & TEMPS
// ---------------------------------------------------------------------------
export const DateFieldSchema = BaseFieldModifiers.extend({ type: z.literal('date') })
export const DateTimeFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('dateTime'),
  precision: z.number().int().min(0).max(6).default(0),
})
export const DateTimeTzFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('dateTimeTz'),
  precision: z.number().int().min(0).max(6).default(0),
})
export const TimeFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('time'),
  precision: z.number().int().min(0).max(6).default(0),
})
export const TimeTzFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('timeTz'),
  precision: z.number().int().min(0).max(6).default(0),
})
export const TimestampFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('timestamp'),
  precision: z.number().int().min(0).max(6).default(0),
})
export const TimestampTzFieldSchema = BaseFieldModifiers.extend({
  type:      z.literal('timestampTz'),
  precision: z.number().int().min(0).max(6).default(0),
})

// ---------------------------------------------------------------------------
// BOOLÉEN & BINAIRE
// ---------------------------------------------------------------------------
export const BooleanFieldSchema    = BaseFieldModifiers.extend({ type: z.literal('boolean') })
export const BinaryFieldSchema     = BaseFieldModifiers.extend({ type: z.literal('binary') })
export const TinyBlobFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('tinyBlob') })
export const BlobFieldSchema       = BaseFieldModifiers.extend({ type: z.literal('blob') })
export const MediumBlobFieldSchema = BaseFieldModifiers.extend({ type: z.literal('mediumBlob') })
export const LongBlobFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('longBlob') })

// ---------------------------------------------------------------------------
// RELATIONS / CLÉS
// ---------------------------------------------------------------------------
export const IdFieldSchema = z.object({ type: z.literal('id') })

export const ForeignIdFieldSchema = BaseFieldModifiers.extend({
  type:        z.literal('foreignId'),
  references:  z.string(),
  on_delete:   z.enum(['cascade', 'restrict', 'set null', 'no action']).default('cascade'),
  on_update:   z.enum(['cascade', 'restrict', 'set null', 'no action']).default('cascade'),
  constrained: z.boolean().default(true),
})
export const ForeignUuidFieldSchema = BaseFieldModifiers.extend({
  type:        z.literal('foreignUuid'),
  references:  z.string(),
  on_delete:   z.enum(['cascade', 'restrict', 'set null', 'no action']).default('cascade'),
  constrained: z.boolean().default(true),
})
export const ForeignUlidFieldSchema = BaseFieldModifiers.extend({
  type:        z.literal('foreignUlid'),
  references:  z.string(),
  on_delete:   z.enum(['cascade', 'restrict', 'set null', 'no action']).default('cascade'),
  constrained: z.boolean().default(true),
})
export const MorphsFieldSchema     = z.object({ type: z.literal('morphs'),     nullable: z.boolean().default(false) })
export const UuidMorphsFieldSchema = z.object({ type: z.literal('uuidMorphs'), nullable: z.boolean().default(false) })

// ---------------------------------------------------------------------------
// SPÉCIAUX
// ---------------------------------------------------------------------------
export const GeometryFieldSchema   = BaseFieldModifiers.extend({ type: z.literal('geometry') })
export const GeographyFieldSchema  = BaseFieldModifiers.extend({ type: z.literal('geography') })
export const PointFieldSchema      = BaseFieldModifiers.extend({ type: z.literal('point') })
export const LineStringFieldSchema = BaseFieldModifiers.extend({ type: z.literal('lineString') })
export const PolygonFieldSchema    = BaseFieldModifiers.extend({ type: z.literal('polygon') })
export const VectorFieldSchema = BaseFieldModifiers.extend({
  type:       z.literal('vector'),
  dimensions: z.number().int().min(1).default(1536),
})
export const RememberTokenFieldSchema = z.object({ type: z.literal('rememberToken') })

// ---------------------------------------------------------------------------
// UNION DISCRIMINÉE PRINCIPALE
// ---------------------------------------------------------------------------
export const FieldSchema = z.discriminatedUnion('type', [
  StringFieldSchema, CharFieldSchema, TinyTextFieldSchema, TextFieldSchema,
  MediumTextFieldSchema, LongTextFieldSchema, EnumFieldSchema, SetFieldSchema,
  JsonFieldSchema, JsonbFieldSchema, UuidFieldSchema, UlidFieldSchema,
  IpAddressFieldSchema, MacAddressFieldSchema,
  TinyIntegerFieldSchema, SmallIntegerFieldSchema, MediumIntegerFieldSchema,
  IntegerFieldSchema, BigIntegerFieldSchema,
  UnsignedTinyIntegerFieldSchema, UnsignedSmallIntegerFieldSchema,
  UnsignedIntegerFieldSchema, UnsignedBigIntegerFieldSchema,
  FloatFieldSchema, DoubleFieldSchema, DecimalFieldSchema, YearFieldSchema,
  DateFieldSchema, DateTimeFieldSchema, DateTimeTzFieldSchema,
  TimeFieldSchema, TimeTzFieldSchema, TimestampFieldSchema, TimestampTzFieldSchema,
  BooleanFieldSchema, BinaryFieldSchema, TinyBlobFieldSchema, BlobFieldSchema,
  MediumBlobFieldSchema, LongBlobFieldSchema,
  IdFieldSchema, ForeignIdFieldSchema, ForeignUuidFieldSchema, ForeignUlidFieldSchema,
  MorphsFieldSchema, UuidMorphsFieldSchema,
  GeometryFieldSchema, GeographyFieldSchema, PointFieldSchema,
  LineStringFieldSchema, PolygonFieldSchema, VectorFieldSchema,
  RememberTokenFieldSchema,
])

export type Field     = z.infer<typeof FieldSchema>
export type FieldType = Field['type']

export const FIELD_TYPES = [
  'string', 'char', 'tinyText', 'text', 'mediumText', 'longText',
  'enum', 'set', 'json', 'jsonb', 'uuid', 'ulid', 'ipAddress', 'macAddress',
  'tinyInteger', 'smallInteger', 'mediumInteger', 'integer', 'bigInteger',
  'unsignedTinyInteger', 'unsignedSmallInteger', 'unsignedInteger', 'unsignedBigInteger',
  'float', 'double', 'decimal', 'year',
  'date', 'dateTime', 'dateTimeTz', 'time', 'timeTz', 'timestamp', 'timestampTz',
  'boolean', 'binary', 'tinyBlob', 'blob', 'mediumBlob', 'longBlob',
  'id', 'foreignId', 'foreignUuid', 'foreignUlid', 'morphs', 'uuidMorphs',
  'geometry', 'geography', 'point', 'lineString', 'polygon', 'vector', 'rememberToken',
] as const satisfies FieldType[]

export const FIELD_TYPES_WITH_PARAMS: Partial<Record<FieldType, string[]>> = {
  string:      ['length'],
  char:        ['length'],
  enum:        ['values'],
  set:         ['values'],
  float:       ['precision', 'scale'],
  double:      ['precision', 'scale'],
  decimal:     ['precision', 'scale'],
  dateTime:    ['precision'],
  dateTimeTz:  ['precision'],
  time:        ['precision'],
  timeTz:      ['precision'],
  timestamp:   ['precision'],
  timestampTz: ['precision'],
  foreignId:   ['references', 'on_delete', 'constrained'],
  foreignUuid: ['references', 'on_delete', 'constrained'],
  foreignUlid: ['references', 'on_delete', 'constrained'],
  vector:      ['dimensions'],
}

export const FIELD_TYPE_CATEGORIES = {
  'Texte':        ['string', 'char', 'tinyText', 'text', 'mediumText', 'longText', 'enum', 'set', 'uuid', 'ulid', 'ipAddress', 'macAddress'],
  'JSON':         ['json', 'jsonb'],
  'Nombres':      ['tinyInteger', 'smallInteger', 'mediumInteger', 'integer', 'bigInteger', 'unsignedTinyInteger', 'unsignedSmallInteger', 'unsignedInteger', 'unsignedBigInteger', 'float', 'double', 'decimal', 'year'],
  'Date & Temps': ['date', 'dateTime', 'dateTimeTz', 'time', 'timeTz', 'timestamp', 'timestampTz'],
  'Bool & Blob':  ['boolean', 'binary', 'tinyBlob', 'blob', 'mediumBlob', 'longBlob'],
  'Relations':    ['id', 'foreignId', 'foreignUuid', 'foreignUlid', 'morphs', 'uuidMorphs'],
  'Spéciaux':     ['geometry', 'geography', 'point', 'lineString', 'polygon', 'vector', 'rememberToken'],
} as const satisfies Record<string, FieldType[]>
