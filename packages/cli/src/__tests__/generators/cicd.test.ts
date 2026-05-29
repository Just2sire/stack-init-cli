import { describe, it, expect } from 'vitest'
import { generateCICD } from '../../generators/cicd/index'
import { expressConfig, fastapiConfig, nestConfig, laravelConfig, djangoConfig, t3Config } from '../fixtures'
import type { ProjectConfig } from '@stack-init/schema'

const expressReactConfig: ProjectConfig = {
  ...expressConfig,
  stack: 'express+react',
  react: { state_lib: 'none', form_lib: 'none', ui_lib: 'none', http_lib: 'fetch', router: 'react-router', css: 'none' },
}

describe('generateCICD — express/postgresql', () => {
  it('generates exactly one ci.yml file', () => {
    const files = generateCICD(expressConfig)
    expect(files).toHaveLength(1)
    expect(files[0].outputPath).toBe('.github/workflows/ci.yml')
  })

  it('ci.yml has Node.js backend job', () => {
    const [ci] = generateCICD(expressConfig)
    expect(ci.content).toContain('setup-node')
    expect(ci.content).toContain('npm ci')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(expressConfig)
    expect(ci.content).toMatchSnapshot()
  })
})

describe('generateCICD — fastapi/postgresql', () => {
  it('ci.yml has Python backend job', () => {
    const [ci] = generateCICD(fastapiConfig)
    expect(ci.content).toContain('setup-python')
    expect(ci.content).toContain('pip install')
    expect(ci.content).toContain('3.11')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(fastapiConfig)
    expect(ci.content).toMatchSnapshot()
  })
})

describe('generateCICD — laravel', () => {
  it('ci.yml has PHP backend job', () => {
    const [ci] = generateCICD(laravelConfig)
    expect(ci.content).toContain('setup-php')
    expect(ci.content).toContain('composer')
    expect(ci.content).toContain('8.2')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(laravelConfig)
    expect(ci.content).toMatchSnapshot()
  })
})

describe('generateCICD — django', () => {
  it('ci.yml has Python job with postgres service', () => {
    const [ci] = generateCICD(djangoConfig)
    expect(ci.content).toContain('setup-python')
    expect(ci.content).toContain('postgres:')
    expect(ci.content).toContain('python manage.py migrate')
    expect(ci.content).toContain('python manage.py test')
  })

  it('ci.yml uses python version 3.11', () => {
    const [ci] = generateCICD(djangoConfig)
    expect(ci.content).toContain('3.11')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(djangoConfig)
    expect(ci.content).toMatchSnapshot()
  })
})

describe('generateCICD — t3', () => {
  it('ci.yml has Node.js job with prisma generate step', () => {
    const [ci] = generateCICD(t3Config)
    expect(ci.content).toContain('setup-node')
    expect(ci.content).toContain('npm ci')
    expect(ci.content).toContain('prisma generate')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(t3Config)
    expect(ci.content).toMatchSnapshot()
  })
})

describe('generateCICD — express+react (mixed)', () => {
  it('ci.yml has separate backend and frontend jobs', () => {
    const [ci] = generateCICD(expressReactConfig)
    expect(ci.content).toContain('backend')
    expect(ci.content).toContain('frontend')
  })

  it('ci.yml snapshot', () => {
    const [ci] = generateCICD(expressReactConfig)
    expect(ci.content).toMatchSnapshot()
  })
})
