import { describe, it, expect } from 'vitest'
import { FastAPIGenerator } from '../../generators/fastapi/index'
import { fastapiConfig, fastapiBeanieConfig } from '../fixtures'

describe('FastAPIGenerator — sqlalchemy/postgresql', () => {
  it('generates the expected file paths', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('requirements.txt includes sqlalchemy and alembic', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiConfig, '/tmp/out')
    const req    = result.files.find(f => f.outputPath === 'requirements.txt')!
    expect(req.content).toContain('sqlalchemy')
    expect(req.content).toContain('alembic')
    expect(req.content).not.toContain('beanie')
  })

  it('main.py creates FastAPI app and mounts routers for Post', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiConfig, '/tmp/out')
    const main   = result.files.find(f => f.outputPath === 'app/main.py')!
    expect(main.content).toContain('FastAPI(')
    expect(main.content).toContain('post')
  })

  it('generates Post model and router', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    expect(paths.some(p => p.includes('post') && p.includes('router'))).toBe(true)
    expect(paths.some(p => p.includes('post') && p.includes('model'))).toBe(true)
  })

  it('.env uses postgresql DATABASE_URL', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiConfig, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env')!
    expect(env.content).toContain('postgresql')
  })
})

describe('FastAPIGenerator — beanie/mongodb', () => {
  it('generates the expected file paths', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiBeanieConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('requirements.txt includes beanie and motor', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiBeanieConfig, '/tmp/out')
    const req    = result.files.find(f => f.outputPath === 'requirements.txt')!
    expect(req.content).toContain('beanie')
    expect(req.content).toContain('motor')
    expect(req.content).not.toContain('sqlalchemy')
  })

  it('main.py uses lifespan pattern with init_db', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiBeanieConfig, '/tmp/out')
    const main   = result.files.find(f => f.outputPath === 'app/main.py')!
    expect(main.content).toContain('lifespan')
    expect(main.content).toContain('init_db')
    expect(main.content).toContain('asynccontextmanager')
  })

  it('Post model extends Document', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiBeanieConfig, '/tmp/out')
    const model  = result.files.find(f => f.outputPath.includes('post') && f.outputPath.includes('model'))!
    expect(model.content).toContain('Document')
  })

  it('.env uses mongodb MONGODB_URI', async () => {
    const gen    = new FastAPIGenerator()
    const result = await gen.generate(fastapiBeanieConfig, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env')!
    expect(env.content).toContain('mongodb')
  })
})
