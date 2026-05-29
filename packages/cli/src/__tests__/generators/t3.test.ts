import { describe, it, expect } from 'vitest'
import { T3Generator } from '../../generators/t3/index'
import { t3Config } from '../fixtures'

describe('T3Generator', () => {
  it('generates the expected file paths', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('package.json includes Next.js, tRPC, Prisma and Zod', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const pkg    = result.files.find(f => f.outputPath === 'package.json')!
    const parsed = JSON.parse(pkg.content)
    const deps   = { ...parsed.dependencies, ...parsed.devDependencies }
    expect(deps).toHaveProperty('next')
    expect(deps).toHaveProperty('@trpc/server')
    expect(deps).toHaveProperty('@prisma/client')
    expect(deps).toHaveProperty('zod')
  })

  it('prisma/schema.prisma contains Post model', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const schema = result.files.find(f => f.outputPath === 'prisma/schema.prisma')!
    expect(schema.content).toContain('model Post')
    expect(schema.content).toContain('title')
    expect(schema.content).toContain('content')
  })

  it('prisma/schema.prisma uses postgresql datasource', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const schema = result.files.find(f => f.outputPath === 'prisma/schema.prisma')!
    expect(schema.content).toContain('provider = "postgresql"')
  })

  it('generates tRPC router for Post', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    expect(paths.some(p => p.includes('post') && p.includes('router'))).toBe(true)
  })

  it('root router at src/server/api/root.ts imports Post router', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const root   = result.files.find(f => f.outputPath === 'src/server/api/root.ts')!
    expect(root.content).toContain('post')
  })

  it('.env contains DATABASE_URL', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env')!
    expect(env.content).toContain('DATABASE_URL')
  })

  it('emits no warnings for a valid config', async () => {
    const gen    = new T3Generator()
    const result = await gen.generate(t3Config, '/tmp/out')
    expect(result.warnings).toHaveLength(0)
  })
})
