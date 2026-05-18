import { describe, it, expect } from 'vitest'
import { ProjectConfigSchema } from '../src/project.schema'

describe('ProjectConfigSchema Phase 2', () => {
  it('should validate a valid Express configuration', () => {
    const config = {
      name: 'my-express-app',
      stack: 'express',
      models: [
        {
          name: 'User',
          fields: [{ name: 'email', type: 'string' }]
        }
      ],
      express: {
        architecture: 'layered',
        orm: 'prisma',
        db_engine: 'postgresql'
      }
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should fail if express stack is used without express config', () => {
    const config = {
      name: 'my-express-app',
      stack: 'express',
      models: [
        {
          name: 'User',
          fields: [{ name: 'email', type: 'string' }]
        }
      ]
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should fail if express uses mongoose with postgresql', () => {
    const config = {
      name: 'my-express-app',
      stack: 'express',
      models: [
        {
          name: 'User',
          fields: [{ name: 'email', type: 'string' }]
        }
      ],
      express: {
        orm: 'mongoose',
        db_engine: 'postgresql'
      }
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should validate a valid NestJS configuration', () => {
    const config = {
      name: 'my-nest-app',
      stack: 'nestjs',
      models: [
        {
          name: 'User',
          fields: [{ name: 'email', type: 'string' }]
        }
      ],
      nestjs: {
        architecture: 'modular',
        orm: 'typeorm'
      }
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should validate a valid FastAPI configuration', () => {
    const config = {
      name: 'my-fastapi-app',
      stack: 'fastapi',
      models: [
        {
          name: 'Task',
          fields: [{ name: 'title', type: 'string' }]
        }
      ],
      fastapi: {
        architecture: 'layered',
        orm: 'sqlmodel',
        db_engine: 'postgresql'
      }
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should fail if fastapi stack is used without fastapi config', () => {
    const config = {
      name: 'my-fastapi-app',
      stack: 'fastapi',
      models: [
        {
          name: 'Task',
          fields: [{ name: 'title', type: 'string' }]
        }
      ]
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })

  it('should validate a valid MERN configuration', () => {
    // Note: For MERN, we currently expect 'express' config to be present if it's considered an express stack
    const config = {
      name: 'my-mern-app',
      stack: 'mern',
      models: [
        {
          name: 'Product',
          fields: [{ name: 'price', type: 'float' }]
        }
      ],
      express: {
        orm: 'mongoose',
        db_engine: 'mongodb'
      },
      react: {
        state_lib: 'zustand'
      }
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(true)
  })

  it('should fail if MERN is missing react config', () => {
    const config = {
      name: 'my-mern-app',
      stack: 'mern',
      models: [
        {
          name: 'Product',
          fields: [{ name: 'price', type: 'float' }]
        }
      ],
      express: {
        orm: 'mongoose',
        db_engine: 'mongodb'
      }
      // react is missing
    }
    const result = ProjectConfigSchema.safeParse(config)
    expect(result.success).toBe(false)
  })
})
