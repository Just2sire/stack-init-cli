import { describe, it, expect } from 'vitest'
import { ExpressGenerator } from '../../generators/express/index'
import { expressConfig, expressMongoConfig } from '../fixtures'

describe('ExpressGenerator — prisma/postgresql', () => {
  it('generates the expected file paths', async () => {
    const gen    = new ExpressGenerator()
    const result = await gen.generate(expressConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('prisma schema contains Post model', async () => {
    const gen    = new ExpressGenerator()
    const result = await gen.generate(expressConfig, '/tmp/out')
    const schema = result.files.find(f => f.outputPath === 'prisma/schema.prisma')!
    expect(schema.content).toContain('model Post {')
    expect(schema.content).toContain('title')
  })

  it('emits no warnings for prisma', async () => {
    const gen    = new ExpressGenerator()
    const result = await gen.generate(expressConfig, '/tmp/out')
    expect(result.warnings).toHaveLength(0)
  })
})

describe('ExpressGenerator — mongoose/mongodb (MERN)', () => {
  it('generates the expected file paths', async () => {
    const gen    = new ExpressGenerator()
    const result = await gen.generate(expressMongoConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('.env.example uses MONGODB_URI', async () => {
    const gen    = new ExpressGenerator()
    const result = await gen.generate(expressMongoConfig, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env.example')!
    expect(env.content).toContain('MONGODB_URI')
  })
})
