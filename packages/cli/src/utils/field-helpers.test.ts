import { describe, expect, it } from 'vitest'
import type { NamedField } from '@stack-init/schema'
import { fieldToCast, fieldToFaker, fieldToMigrationLine, fieldToValidationRule } from './field-helpers'

const f = (obj: Record<string, unknown>) => obj as unknown as NamedField

const base = { nullable: false, unique: false, index: false, unsigned: false }

describe('fieldToMigrationLine', () => {
  it('generates string column with default length', () => {
    const field = f({ ...base, type: 'string', name: 'title', length: 255 })
    expect(fieldToMigrationLine(field)).toBe("$table->string('title');")
  })

  it('generates string column with custom length', () => {
    const field = f({ ...base, type: 'string', name: 'code', length: 50 })
    expect(fieldToMigrationLine(field)).toBe("$table->string('code', 50);")
  })

  it('generates integer column', () => {
    const field = f({ ...base, type: 'integer', name: 'age' })
    expect(fieldToMigrationLine(field)).toBe("$table->integer('age');")
  })

  it('generates boolean column', () => {
    const field = f({ ...base, type: 'boolean', name: 'is_active' })
    expect(fieldToMigrationLine(field)).toBe("$table->boolean('is_active');")
  })

  it('adds nullable modifier', () => {
    const field = f({ ...base, type: 'string', name: 'bio', length: 255, nullable: true })
    expect(fieldToMigrationLine(field)).toBe("$table->string('bio')->nullable();")
  })

  it('adds unique modifier', () => {
    const field = f({ ...base, type: 'string', name: 'email', length: 255, unique: true })
    expect(fieldToMigrationLine(field)).toBe("$table->string('email')->unique();")
  })

  it('adds default modifier for string', () => {
    const field = f({ ...base, type: 'string', name: 'status', length: 255, default: 'active' })
    expect(fieldToMigrationLine(field)).toBe("$table->string('status')->default('active');")
  })

  it('generates foreignId with constrained and cascadeOnDelete', () => {
    const field = f({
      ...base,
      type: 'foreignId',
      name: 'user_id',
      references: 'users',
      constrained: true,
      on_delete: 'cascade',
      on_update: 'cascade',
    })
    expect(fieldToMigrationLine(field)).toBe(
      "$table->foreignId('user_id')->constrained('users')->cascadeOnDelete();"
    )
  })

  it('generates text column', () => {
    const field = f({ ...base, type: 'text', name: 'description' })
    expect(fieldToMigrationLine(field)).toBe("$table->text('description');")
  })
})

describe('fieldToCast', () => {
  it('returns boolean cast for boolean type', () => {
    expect(fieldToCast(f({ ...base, type: 'boolean', name: 'active' }))).toBe("'boolean'")
  })

  it('returns integer cast for integer type', () => {
    expect(fieldToCast(f({ ...base, type: 'integer', name: 'count' }))).toBe("'integer'")
  })

  it('returns datetime cast for dateTime type', () => {
    expect(
      fieldToCast(f({ ...base, type: 'dateTime', name: 'created_at', precision: 0 }))
    ).toBe("'datetime'")
  })

  it('returns array cast for json type', () => {
    expect(fieldToCast(f({ ...base, type: 'json', name: 'metadata' }))).toBe("'array'")
  })

  it('returns float cast for float type', () => {
    expect(fieldToCast(f({ ...base, type: 'float', name: 'score', precision: 8, scale: 2 }))).toBe(
      "'float'"
    )
  })

  it('returns null for types without a cast', () => {
    expect(fieldToCast(f({ ...base, type: 'string', name: 'title', length: 255 }))).toBeNull()
  })

  it('returns null for text type', () => {
    expect(fieldToCast(f({ ...base, type: 'text', name: 'body' }))).toBeNull()
  })
})

describe('fieldToValidationRule', () => {
  it('returns required + string + max for string field', () => {
    const field = f({ ...base, type: 'string', name: 'title', length: 255 })
    expect(fieldToValidationRule(field, 'posts')).toEqual(['required', 'string', 'max:255'])
  })

  it('returns nullable prefix for nullable field', () => {
    const field = f({ ...base, type: 'integer', name: 'age', nullable: true })
    expect(fieldToValidationRule(field, 'users')).toEqual(['nullable', 'integer'])
  })

  it('appends unique rule for unique field', () => {
    const field = f({ ...base, type: 'string', name: 'slug', length: 100, unique: true })
    expect(fieldToValidationRule(field, 'posts')).toEqual([
      'required',
      'string',
      'max:100',
      'unique:posts,slug',
    ])
  })

  it('returns boolean rule for boolean field', () => {
    const field = f({ ...base, type: 'boolean', name: 'is_active' })
    expect(fieldToValidationRule(field, 'users')).toEqual(['required', 'boolean'])
  })

  it('returns date rule for date field', () => {
    const field = f({ ...base, type: 'date', name: 'birth_date' })
    expect(fieldToValidationRule(field, 'users')).toEqual(['required', 'date'])
  })

  it('returns array rule for json field', () => {
    const field = f({ ...base, type: 'json', name: 'metadata' })
    expect(fieldToValidationRule(field, 'products')).toEqual(['required', 'array'])
  })
})

describe('fieldToFaker', () => {
  it('uses email faker for email-named field', () => {
    const field = f({ ...base, type: 'string', name: 'email', length: 255 })
    expect(fieldToFaker(field)).toBe('fake()->unique()->safeEmail()')
  })

  it('uses sentence faker for title-named field', () => {
    const field = f({ ...base, type: 'string', name: 'title', length: 255 })
    expect(fieldToFaker(field)).toBe('fake()->sentence(3)')
  })

  it('uses boolean faker for boolean type', () => {
    const field = f({ ...base, type: 'boolean', name: 'is_active' })
    expect(fieldToFaker(field)).toBe('fake()->boolean()')
  })

  it('uses date faker for date type', () => {
    const field = f({ ...base, type: 'date', name: 'birth_date' })
    expect(fieldToFaker(field)).toBe('fake()->date()')
  })

  it('uses words faker as fallback for generic string field', () => {
    const field = f({ ...base, type: 'string', name: 'color', length: 255 })
    expect(fieldToFaker(field)).toBe('fake()->words(3, true)')
  })

  it('uses numberBetween faker for integer type', () => {
    const field = f({ ...base, type: 'integer', name: 'quantity' })
    expect(fieldToFaker(field)).toBe('fake()->numberBetween(1, 1000)')
  })

  it('uses uuid faker for uuid type', () => {
    const field = f({ ...base, type: 'uuid', name: 'external_id' })
    expect(fieldToFaker(field)).toBe('fake()->uuid()')
  })
})
