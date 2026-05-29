import { describe, it, expect } from 'vitest'
import { NestGenerator } from '../../generators/nest/index'
import { nestConfig, nestCqrsConfig } from '../fixtures'

describe('NestGenerator — modular/typeorm', () => {
  it('generates the expected file paths', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('generates Post module and controller', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    expect(paths).toContain('src/modules/post/post.module.ts')
    expect(paths).toContain('src/modules/post/post.controller.ts')
  })

  it('Post entity uses @Entity decorator', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestConfig, '/tmp/out')
    const entity = result.files.find(f => f.outputPath === 'src/modules/post/entities/post.entity.ts')!
    expect(entity.content).toContain('@Entity(')
    expect(entity.content).toContain('title')
  })

  it('emits no warnings', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestConfig, '/tmp/out')
    expect(result.warnings).toHaveLength(0)
  })
})

describe('NestGenerator — CQRS architecture', () => {
  it('generates command and query handler files', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestCqrsConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)

    expect(paths).toContain('src/modules/post/commands/create-post.command.ts')
    expect(paths).toContain('src/modules/post/commands/handlers/create-post.handler.ts')
    expect(paths).toContain('src/modules/post/queries/get-all-post.query.ts')
    expect(paths).toContain('src/modules/post/queries/handlers/get-all-post.handler.ts')
  })

  it('CQRS module imports CqrsModule and registers all handlers', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestCqrsConfig, '/tmp/out')
    const module = result.files.find(f => f.outputPath === 'src/modules/post/post.module.ts')!
    expect(module.content).toContain('CqrsModule')
    expect(module.content).toContain('CreatePostHandler')
    expect(module.content).toContain('GetAllPostHandler')
  })

  it('CQRS file paths snapshot', async () => {
    const gen    = new NestGenerator()
    const result = await gen.generate(nestCqrsConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })
})
