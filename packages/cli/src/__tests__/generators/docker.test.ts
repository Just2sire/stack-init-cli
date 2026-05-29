import { describe, it, expect } from 'vitest'
import { generateDockerFiles } from '../../generators/docker/index'
import { expressConfig, fastapiConfig, nextjsConfig, djangoConfig, t3Config } from '../fixtures'
import type { ProjectConfig } from '@stack-init/schema'

const expressReactConfig: ProjectConfig = {
  ...expressConfig,
  stack: 'express+react',
  react: { state_lib: 'none', form_lib: 'none', ui_lib: 'none', http_lib: 'fetch', router: 'react-router', css: 'none' },
}

describe('generateDockerFiles — express/postgresql (solo)', () => {
  it('generates the expected file paths', () => {
    const files = generateDockerFiles(expressConfig, false)
    const paths = files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('docker-compose includes postgres service with healthcheck', () => {
    const files   = generateDockerFiles(expressConfig, false)
    const compose = files.find(f => f.outputPath === 'docker-compose.yml')!
    expect(compose.content).toContain('postgres:')
    expect(compose.content).toContain('healthcheck:')
    expect(compose.content).toContain('service_healthy')
  })

  it('Dockerfile uses multi-stage build with production target', () => {
    const files      = generateDockerFiles(expressConfig, false)
    const dockerfile = files.find(f => f.outputPath === 'Dockerfile')!
    expect(dockerfile.content).toContain('AS builder')
    expect(dockerfile.content).toContain('AS production')
  })
})

describe('generateDockerFiles — fastapi/postgresql (solo)', () => {
  it('generates the expected file paths', () => {
    const files = generateDockerFiles(fastapiConfig, false)
    const paths = files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('Dockerfile uses Python slim base image', () => {
    const files      = generateDockerFiles(fastapiConfig, false)
    const dockerfile = files.find(f => f.outputPath === 'Dockerfile')!
    expect(dockerfile.content).toContain('python:3.11-slim')
    expect(dockerfile.content).toContain('uvicorn')
  })
})

describe('generateDockerFiles — express+react (mixed)', () => {
  it('generates the expected file paths', () => {
    const files = generateDockerFiles(expressReactConfig, true)
    const paths = files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('docker-compose has frontend service depending on backend', () => {
    const files   = generateDockerFiles(expressReactConfig, true)
    const compose = files.find(f => f.outputPath === 'docker-compose.yml')!
    expect(compose.content).toContain('frontend:')
    expect(compose.content).toContain('depends_on:')
    expect(compose.content).toContain('- backend')
  })

  it('frontend Dockerfile uses nginx', () => {
    const files      = generateDockerFiles(expressReactConfig, true)
    const dockerfile = files.find(f => f.outputPath === 'frontend/Dockerfile')!
    expect(dockerfile.content).toContain('nginx:alpine')
    expect(dockerfile.content).toContain('/usr/share/nginx/html')
  })

  it('nginx.conf has SPA fallback routing', () => {
    const files = generateDockerFiles(expressReactConfig, true)
    const nginx = files.find(f => f.outputPath === 'frontend/nginx.conf')!
    expect(nginx.content).toContain('try_files')
    expect(nginx.content).toContain('/index.html')
  })
})

describe('generateDockerFiles — nextjs (standalone, no compose)', () => {
  it('does not generate docker-compose.yml (no backend services)', () => {
    const files = generateDockerFiles(nextjsConfig, false)
    const paths = files.map(f => f.outputPath)
    expect(paths).not.toContain('docker-compose.yml')
  })

  it('Dockerfile uses Next.js standalone output', () => {
    const files      = generateDockerFiles(nextjsConfig, false)
    const dockerfile = files.find(f => f.outputPath === 'Dockerfile')!
    expect(dockerfile.content).toContain('standalone')
    expect(dockerfile.content).toContain('server.js')
  })
})

describe('generateDockerFiles — django/postgresql', () => {
  it('generates the expected file paths', () => {
    const files = generateDockerFiles(djangoConfig, false)
    const paths = files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('docker-compose includes postgres service with healthcheck', () => {
    const files   = generateDockerFiles(djangoConfig, false)
    const compose = files.find(f => f.outputPath === 'docker-compose.yml')!
    expect(compose.content).toContain('postgres:')
    expect(compose.content).toContain('healthcheck:')
    expect(compose.content).toContain('service_healthy')
  })

  it('docker-compose backend service uses port 8000', () => {
    const files   = generateDockerFiles(djangoConfig, false)
    const compose = files.find(f => f.outputPath === 'docker-compose.yml')!
    expect(compose.content).toContain('8000:8000')
  })

  it('Dockerfile uses Python slim base image', () => {
    const files      = generateDockerFiles(djangoConfig, false)
    const dockerfile = files.find(f => f.outputPath === 'Dockerfile')!
    expect(dockerfile.content).toContain('python:3.11-slim')
    expect(dockerfile.content).toContain('manage.py')
  })
})

describe('generateDockerFiles — t3/postgresql', () => {
  it('generates the expected file paths', () => {
    const files = generateDockerFiles(t3Config, false)
    const paths = files.map(f => f.outputPath).sort()
    expect(paths).toMatchSnapshot()
  })

  it('docker-compose includes postgres and app services', () => {
    const files   = generateDockerFiles(t3Config, false)
    const compose = files.find(f => f.outputPath === 'docker-compose.yml')!
    expect(compose.content).toContain('postgres:')
    expect(compose.content).toContain('app:')
    expect(compose.content).toContain('service_healthy')
  })

  it('Dockerfile runs prisma generate before build', () => {
    const files      = generateDockerFiles(t3Config, false)
    const dockerfile = files.find(f => f.outputPath === 'Dockerfile')!
    expect(dockerfile.content).toContain('prisma generate')
    expect(dockerfile.content).toContain('standalone')
  })
})
