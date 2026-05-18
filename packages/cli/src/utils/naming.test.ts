import { describe, expect, it } from 'vitest'
import {
  camelCase,
  kebabCase,
  modelToRouteName,
  modelToTableName,
  modelToVarName,
  pascalCase,
  pluralize,
  snakeCase,
} from './naming'

describe('pascalCase', () => {
  it('converts snake_case to PascalCase', () => {
    expect(pascalCase('user_profile')).toBe('UserProfile')
  })
  it('converts kebab-case to PascalCase', () => {
    expect(pascalCase('my-model')).toBe('MyModel')
  })
  it('leaves already PascalCase unchanged', () => {
    expect(pascalCase('User')).toBe('User')
  })
  it('uppercases single word', () => {
    expect(pascalCase('user')).toBe('User')
  })
})

describe('camelCase', () => {
  it('converts snake_case to camelCase', () => {
    expect(camelCase('user_profile')).toBe('userProfile')
  })
  it('lowercases first char of PascalCase input', () => {
    expect(camelCase('UserProfile')).toBe('userProfile')
  })
  it('lowercases single uppercase word', () => {
    expect(camelCase('User')).toBe('user')
  })
})

describe('snakeCase', () => {
  it('converts PascalCase to snake_case', () => {
    expect(snakeCase('UserProfile')).toBe('user_profile')
  })
  it('leaves snake_case unchanged', () => {
    expect(snakeCase('user_profile')).toBe('user_profile')
  })
  it('converts single PascalCase word', () => {
    expect(snakeCase('User')).toBe('user')
  })
})

describe('kebabCase', () => {
  it('converts PascalCase to kebab-case', () => {
    expect(kebabCase('UserProfile')).toBe('user-profile')
  })
  it('converts single PascalCase word', () => {
    expect(kebabCase('User')).toBe('user')
  })
})

describe('pluralize', () => {
  it('appends s for regular words', () => {
    expect(pluralize('user')).toBe('users')
  })
  it('replaces y with ies for consonant+y words', () => {
    expect(pluralize('category')).toBe('categories')
    expect(pluralize('story')).toBe('stories')
  })
  it('does not replace y when preceded by a vowel', () => {
    expect(pluralize('day')).toBe('days')
  })
  it('appends es for words ending in s', () => {
    expect(pluralize('status')).toBe('statuses')
  })
  it('appends es for words ending in x', () => {
    expect(pluralize('box')).toBe('boxes')
  })
  it('appends es for words ending in ch', () => {
    expect(pluralize('branch')).toBe('branches')
  })
})

describe('modelToTableName', () => {
  it('converts PascalCase model to plural snake_case', () => {
    expect(modelToTableName('UserProfile')).toBe('user_profiles')
  })
  it('handles irregular plurals', () => {
    expect(modelToTableName('Category')).toBe('categories')
  })
})

describe('modelToRouteName', () => {
  it('converts PascalCase model to plural kebab-case', () => {
    expect(modelToRouteName('UserProfile')).toBe('user-profiles')
  })
  it('handles irregular plurals', () => {
    expect(modelToRouteName('Category')).toBe('categories')
  })
})

describe('modelToVarName', () => {
  it('converts PascalCase model to camelCase variable', () => {
    expect(modelToVarName('UserProfile')).toBe('userProfile')
  })
  it('lowercases simple model name', () => {
    expect(modelToVarName('User')).toBe('user')
  })
})
