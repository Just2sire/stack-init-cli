import { describe, it, expect } from 'vitest'
import { DjangoGenerator } from '../../generators/django/index'
import { djangoConfig } from '../fixtures'

describe('DjangoGenerator', () => {
  it('generates the expected file paths', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('requirements.txt includes Django and djangorestframework', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const req    = result.files.find(f => f.outputPath === 'requirements.txt')!
    expect(req.content).toContain('Django')
    expect(req.content).toContain('djangorestframework')
  })

  it('manage.py sets DJANGO_SETTINGS_MODULE', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const manage = result.files.find(f => f.outputPath === 'manage.py')!
    expect(manage.content).toContain('DJANGO_SETTINGS_MODULE')
    expect(manage.content).toContain('settings')
  })

  it('settings.py includes DRF and corsheaders', async () => {
    const gen      = new DjangoGenerator()
    const result   = await gen.generate(djangoConfig, '/tmp/out')
    const settings = result.files.find(f => f.outputPath.includes('settings.py'))!
    expect(settings.content).toContain('rest_framework')
    expect(settings.content).toContain('corsheaders')
  })

  it('generates model app with all 6 required files for Post', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const paths  = result.files.map(f => f.outputPath)
    const appFiles = ['models.py', 'views.py', 'serializers.py', 'urls.py', 'apps.py', '__init__.py']
    for (const file of appFiles) {
      expect(paths.some(p => p.includes('post') && p.endsWith(file))).toBe(true)
    }
  })

  it('models.py declares Post class with title and content fields', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const model  = result.files.find(f => f.outputPath.includes('post') && f.outputPath.endsWith('models.py'))!
    expect(model.content).toContain('class Post(models.Model)')
    expect(model.content).toContain('title')
    expect(model.content).toContain('content')
  })

  it('views.py uses ModelViewSet', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const views  = result.files.find(f => f.outputPath.includes('post') && f.outputPath.endsWith('views.py'))!
    expect(views.content).toContain('ModelViewSet')
    expect(views.content).toContain('PostViewSet')
  })

  it('urls.py uses DefaultRouter', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const urls   = result.files.find(f => f.outputPath.includes('post') && f.outputPath.endsWith('urls.py'))!
    expect(urls.content).toContain('DefaultRouter')
    expect(urls.content).toContain('PostViewSet')
  })

  it('.env contains DATABASE_URL and SECRET_KEY', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    const env    = result.files.find(f => f.outputPath === '.env')!
    expect(env.content).toContain('DATABASE_URL')
    expect(env.content).toContain('SECRET_KEY')
  })

  it('emits no warnings for a valid config', async () => {
    const gen    = new DjangoGenerator()
    const result = await gen.generate(djangoConfig, '/tmp/out')
    expect(result.warnings).toHaveLength(0)
  })
})
