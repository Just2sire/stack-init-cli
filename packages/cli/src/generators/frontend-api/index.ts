import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

function toPascalCase(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function toKebabCase(str: string): string {
  return str
    .replace(/([A-Z])/g, '-$1')
    .toLowerCase()
    .replace(/^-/, '')
}

function tsType(fieldType: string): string {
  switch (fieldType) {
    case 'integer': case 'bigInteger': case 'unsignedBigInteger': case 'tinyInteger':
    case 'smallInteger': case 'mediumInteger': case 'float': case 'double': case 'decimal':
      return 'number'
    case 'boolean':
      return 'boolean'
    case 'json': case 'jsonb': case 'object':
      return 'Record<string, unknown>'
    case 'date': case 'dateTime': case 'dateTimeTz': case 'timestamp': case 'timestampTz':
      return 'string'
    default:
      return 'string'
  }
}

function backendPort(stack: string): number {
  if (stack.includes('fastapi')) return 8000
  if (stack.includes('laravel')) return 8000
  return 3000
}

export function generateFrontendApi(config: ProjectConfig, files: GeneratedFile[]): void {
  const stack = config.stack as string
  const port = backendPort(stack)
  const prefix = stack.includes('react') && !stack.includes('nextjs')
    ? 'REACT_APP_API_URL'
    : 'NEXT_PUBLIC_API_URL'

  // client.ts
  files.push({
    outputPath: 'frontend/src/api/client.ts',
    content: `import axios from 'axios'

export const api = axios.create({
  baseURL: (process.env.${prefix} ?? 'http://localhost:${port}') + '/api',
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('token')
  if (token) cfg.headers.Authorization = \`Bearer \${token}\`
  return cfg
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return Promise.reject(err)
  },
)
`,
  })

  // types.ts — one interface per model
  const interfaces = config.models.map((model) => {
    const name = toPascalCase(model.name)
    const fields = [
      '  id: number;',
      ...model.fields.map((f) => {
        const field = f as any
        const optional = field.nullable ? '?' : ''
        return `  ${f.name}${optional}: ${tsType(f.type)};`
      }),
      '  created_at?: string;',
      '  updated_at?: string;',
    ]
    return `export interface ${name} {\n${fields.join('\n')}\n}`
  })

  files.push({
    outputPath: 'frontend/src/api/types.ts',
    content: interfaces.join('\n\n') + '\n',
  })

  // One api file per model
  const modelExports: string[] = []
  for (const model of config.models) {
    const name = toPascalCase(model.name)
    const plural = toKebabCase(model.name) + 's'
    const filename = `${toKebabCase(model.name)}.api.ts`
    modelExports.push(filename.replace('.ts', ''))

    files.push({
      outputPath: `frontend/src/api/${filename}`,
      content: `import { api } from './client'
import type { ${name} } from './types'

export const get${name}s = () =>
  api.get<${name}[]>('/${plural}').then((r) => r.data)

export const get${name} = (id: number) =>
  api.get<${name}>(\`/${plural}/\${id}\`).then((r) => r.data)

export const create${name} = (data: Omit<${name}, 'id' | 'created_at' | 'updated_at'>) =>
  api.post<${name}>('/${plural}', data).then((r) => r.data)

export const update${name} = (id: number, data: Partial<${name}>) =>
  api.patch<${name}>(\`/${plural}/\${id}\`, data).then((r) => r.data)

export const delete${name} = (id: number) =>
  api.delete(\`/${plural}/\${id}\`)
`,
    })
  }

  // index.ts — re-exports
  files.push({
    outputPath: 'frontend/src/api/index.ts',
    content:
      `export * from './client'\n` +
      `export * from './types'\n` +
      modelExports.map((m) => `export * from './${m}'`).join('\n') +
      '\n',
  })

  // .env.example
  files.push({
    outputPath: 'frontend/.env.example',
    content: `${prefix}=http://localhost:${port}
`,
  })
}
