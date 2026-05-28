import type { Model, ProjectConfig, NamedField, ReactOptions } from '@stack-init/schema'
import { type GeneratedFile } from '../../utils/fs'
import { kebabCase, pascalCase } from '../../utils/naming'
import { npmVersion } from '../../config/versions'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class NextJSGenerator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const { models, name: projectName, react: opts } = config

    const css = opts?.css ?? 'tailwind'
    const uiLib = opts?.ui_lib ?? 'none'

    // package.json
    result.files.push({
      outputPath: 'package.json',
      content: JSON.stringify(this.buildPackageJson(projectName, opts), null, 2)
    })

    // tsconfig.json
    result.files.push({
      outputPath: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2017',
          lib: ['dom', 'dom.iterable', 'esnext'],
          allowJs: true,
          skipLibCheck: true,
          strict: true,
          noEmit: true,
          esModuleInterop: true,
          module: 'esnext',
          moduleResolution: 'bundler',
          resolveJsonModule: true,
          isolatedModules: true,
          jsx: 'preserve',
          incremental: true,
          paths: { '@/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx'],
        exclude: ['node_modules'],
      }, null, 2)
    })

    // next.config.ts
    result.files.push({
      outputPath: 'next.config.ts',
      content: `import type { NextConfig } from 'next';\n\nconst nextConfig: NextConfig = {};\n\nexport default nextConfig;\n`
    })

    // .env.local
    result.files.push({
      outputPath: '.env.local',
      content: `DATABASE_URL="postgresql://user:password@localhost:5432/${projectName}?schema=public"\n`
    })

    // .gitignore
    result.files.push({
      outputPath: '.gitignore',
      content: `node_modules\n.next\ndist\n.env*.local\n*.log\n`
    })

    // Tailwind config
    if (css === 'tailwind') {
      result.files.push({
        outputPath: 'tailwind.config.ts',
        content: `import type { Config } from 'tailwindcss';\n\nconst config: Config = {\n  content: ['./src/**/*.{ts,tsx}'],\n};\n\nexport default config;\n`
      })
      result.files.push({
        outputPath: 'postcss.config.mjs',
        content: `const config = {\n  plugins: { '@tailwindcss/postcss': {} },\n};\n\nexport default config;\n`
      })
    }

    // Prisma
    result.files.push({
      outputPath: 'prisma/schema.prisma',
      content: this.generatePrismaSchema(config)
    })
    result.files.push({
      outputPath: 'prisma/seed.ts',
      content: this.generateSeed(models)
    })
    result.files.push({
      outputPath: 'src/lib/prisma.ts',
      content: `import { PrismaClient } from '@prisma/client';\n\nconst globalForPrisma = global as unknown as { prisma: PrismaClient };\n\nexport const prisma = globalForPrisma.prisma || new PrismaClient();\n\nif (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;\n`
    })

    // App shell
    result.files.push({
      outputPath: 'src/app/globals.css',
      content: css === 'tailwind' ? `@import "tailwindcss";\n` : `* { box-sizing: border-box; margin: 0; padding: 0; }\nbody { font-family: system-ui, sans-serif; }\n`
    })
    result.files.push({
      outputPath: 'src/app/layout.tsx',
      content: this.generateLayout(projectName, css)
    })
    result.files.push({
      outputPath: 'src/app/page.tsx',
      content: this.generateHomePage(projectName, models)
    })

    // Per-model files
    for (const model of models) {
      const slug = kebabCase(model.name)
      const mLow = model.name.toLowerCase()

      // TypeScript interface
      result.files.push({
        outputPath: `src/types/${model.name}.ts`,
        content: this.generateTypeFile(model)
      })

      // API routes
      result.files.push({
        outputPath: `src/app/api/${slug}/route.ts`,
        content: this.generateApiRoute(mLow)
      })
      result.files.push({
        outputPath: `src/app/api/${slug}/[id]/route.ts`,
        content: this.generateApiIdRoute(mLow)
      })

      // List page
      result.files.push({
        outputPath: `src/app/${slug}/page.tsx`,
        content: this.generateListPage(model, slug, uiLib)
      })

      // Detail page
      result.files.push({
        outputPath: `src/app/${slug}/[id]/page.tsx`,
        content: this.generateDetailPage(model, slug)
      })

      // Create page
      result.files.push({
        outputPath: `src/app/${slug}/new/page.tsx`,
        content: this.generateCreatePage(model, slug)
      })

      // Edit page
      result.files.push({
        outputPath: `src/app/${slug}/[id]/edit/page.tsx`,
        content: this.generateEditPage(model, slug)
      })
    }

    return result
  }

  private buildPackageJson(projectName: string, opts?: ReactOptions | null): Record<string, unknown> {
    const uiLib = opts?.ui_lib ?? 'none'
    const deps: Record<string, string> = {
      next: npmVersion('next'),
      react: npmVersion('react'),
      'react-dom': npmVersion('react-dom'),
      '@prisma/client': npmVersion('@prisma/client'),
    }

    if (uiLib === 'shadcn')      { deps['tailwindcss'] = npmVersion('tailwindcss'); deps['@tailwindcss/postcss'] = npmVersion('@tailwindcss/postcss'); }
    if (uiLib === 'mui')         { deps['@mui/material'] = npmVersion('@mui/material'); deps['@emotion/react'] = npmVersion('@emotion/react'); deps['@emotion/styled'] = npmVersion('@emotion/styled'); }
    if (uiLib === 'antd')        { deps['antd'] = npmVersion('antd'); }
    if (opts?.css === 'tailwind' && uiLib !== 'shadcn') { deps['tailwindcss'] = npmVersion('tailwindcss'); deps['@tailwindcss/postcss'] = npmVersion('@tailwindcss/postcss'); }

    return {
      name: projectName.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        'prisma:generate': 'prisma generate',
        'prisma:studio': 'prisma studio',
        'db:seed': 'tsx prisma/seed.ts',
      },
      dependencies: deps,
      devDependencies: {
        typescript: npmVersion('typescript'),
        '@types/node': npmVersion('@types/node'),
        '@types/react': npmVersion('@types/react'),
        '@types/react-dom': npmVersion('@types/react-dom'),
        prisma: npmVersion('prisma'),
        tsx: npmVersion('tsx'),
      }
    }
  }

  private generatePrismaSchema(config: ProjectConfig): string {
    const db = config.react ? 'postgresql' : 'postgresql'
    let schema = `generator client {\n  provider = "prisma-client-js"\n}\n\ndatasource db {\n  provider = "${db}"\n  url      = env("DATABASE_URL")\n}\n\n`

    for (const model of config.models) {
      schema += `model ${pascalCase(model.name)} {\n`
      let hasPk = false

      for (const field of model.fields as NamedField[]) {
        const { name, prismaType, attrs } = this.mapFieldToPrisma(field)
        if (attrs.includes('@id')) hasPk = true
        const nullable = ('nullable' in field && field.nullable) ? '?' : ''
        schema += `  ${name} ${prismaType}${nullable} ${attrs}\n`
      }

      if (!hasPk) {
        schema = schema.replace(`model ${pascalCase(model.name)} {\n`, `model ${pascalCase(model.name)} {\n  id Int @id @default(autoincrement())\n`)
      }

      if (model.table) schema += `\n  @@map("${model.table}")\n`
      schema += `}\n\n`
    }

    return schema
  }

  private mapFieldToPrisma(field: NamedField): { name: string; prismaType: string; attrs: string } {
    const name = field.name
    let prismaType = 'String'
    let attrs = ''

    switch (field.type) {
      case 'id':        prismaType = 'Int';      attrs = '@id @default(autoincrement())'; break
      case 'uuid':      prismaType = 'String';   attrs = '@id @default(uuid())'; break
      case 'ulid':      prismaType = 'String';   attrs = '@id @default(cuid())'; break
      case 'tinyInteger': case 'smallInteger': case 'mediumInteger':
      case 'integer': case 'unsignedInteger': case 'unsignedSmallInteger':
      case 'unsignedTinyInteger':
        prismaType = 'Int'; break
      case 'bigInteger': case 'unsignedBigInteger': prismaType = 'BigInt'; break
      case 'float': case 'double': prismaType = 'Float'; break
      case 'decimal':   prismaType = 'Decimal'; break
      case 'boolean':   prismaType = 'Boolean'; break
      case 'date': case 'dateTime': case 'dateTimeTz':
      case 'timestamp': case 'timestampTz':
        prismaType = 'DateTime'; break
      case 'json': case 'jsonb': prismaType = 'Json'; break
      case 'foreignId': prismaType = 'Int'; break
      case 'foreignUuid': case 'foreignUlid': prismaType = 'String'; break
      default:          prismaType = 'String'; break
    }

    if ('unique' in field && field.unique) attrs += (attrs ? ' ' : '') + '@unique'

    return { name, prismaType, attrs }
  }

  private generateSeed(models: Model[]): string {
    const blocks = models.map(m => {
      const mLow = m.name.toLowerCase()
      const sampleFields = (m.fields as NamedField[])
        .filter(f => f.type !== 'id' && f.type !== 'uuid' && f.type !== 'ulid')
        .slice(0, 4)
        .map(f => {
          switch (f.type) {
            case 'boolean': return `    ${f.name}: false,`
            case 'integer': case 'bigInteger': case 'smallInteger':
            case 'float': case 'double': case 'decimal': return `    ${f.name}: 0,`
            case 'date': case 'dateTime': case 'timestamp': return `    ${f.name}: new Date(),`
            case 'enum': return `    ${f.name}: ${('values' in f && f.values?.length) ? `'${f.values[0]}'` : `''`},`
            default: return `    ${f.name}: 'sample ${f.name}',`
          }
        }).join('\n')
      return `  await prisma.${mLow}.create({\n    data: {\n${sampleFields}\n    },\n  });`
    }).join('\n\n')

    return `import { PrismaClient } from '@prisma/client';\n\nconst prisma = new PrismaClient();\n\nasync function main() {\n${blocks}\n  console.log('Seed complete.');\n}\n\nmain()\n  .catch(console.error)\n  .finally(() => prisma.$disconnect());\n`
  }

  private generateLayout(projectName: string, css: string): string {
    return `import type { Metadata } from 'next';
${css === 'tailwind' ? "import './globals.css';" : ''}

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated by Stack-Init',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`
  }

  private generateHomePage(projectName: string, models: Model[]): string {
    const links = models.map(m => {
      const slug = kebabCase(m.name)
      return `      <li><a href="/${slug}">${m.name}</a></li>`
    }).join('\n')

    return `export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>${projectName}</h1>
      <p>Generated by <a href="https://stackinit.dev">Stack-Init</a>.</p>
      <ul style={{ marginTop: '1rem' }}>
${links}
      </ul>
    </main>
  );
}
`
  }

  private generateTypeFile(model: Model): string {
    const fieldLines = (model.fields as NamedField[])
      .map(f => {
        const optional = ('nullable' in f && f.nullable) ? '?' : ''
        const tsType = this.toTsType(f)
        return `  ${f.name}${optional}: ${tsType};`
      })
      .join('\n')

    return `export interface ${model.name} {\n  id: number;\n${fieldLines}\n  createdAt: string;\n  updatedAt: string;\n}\n`
  }

  private toTsType(field: NamedField): string {
    switch (field.type) {
      case 'boolean': return 'boolean'
      case 'id': case 'tinyInteger': case 'smallInteger': case 'mediumInteger':
      case 'integer': case 'bigInteger': case 'float': case 'double':
      case 'decimal': case 'foreignId': return 'number'
      case 'date': case 'dateTime': case 'timestamp': return 'string'
      case 'json': case 'jsonb': return 'Record<string, unknown>'
      case 'enum': return ('values' in field && field.values?.length) ? field.values.map(v => `'${v}'`).join(' | ') : 'string'
      default: return 'string'
    }
  }

  private generateApiRoute(modelLow: string): string {
    return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET() {
  const items = await prisma.${modelLow}.findMany();
  return NextResponse.json(items);
}

export async function POST(req: Request) {
  const data = await req.json();
  const item = await prisma.${modelLow}.create({ data });
  return NextResponse.json(item, { status: 201 });
}
`
  }

  private generateApiIdRoute(modelLow: string): string {
    return `import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await prisma.${modelLow}.findUnique({ where: { id: Number(id) } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await req.json();
  const item = await prisma.${modelLow}.update({ where: { id: Number(id) }, data });
  return NextResponse.json(item);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.${modelLow}.delete({ where: { id: Number(id) } });
  return new NextResponse(null, { status: 204 });
}
`
  }

  private generateDetailPage(model: Model, slug: string): string {
    const fieldRows = (model.fields as NamedField[])
      .slice(0, 8)
      .map(f => `      <tr><td style={{ padding: '8px 12px', fontWeight: 600, color: '#6b7280', whiteSpace: 'nowrap' }}>${f.name}</td><td style={{ padding: '8px 12px' }}>{String(item.${f.name} ?? '')}</td></tr>`)
      .join('\n')

    return `import Link from 'next/link';
import type { ${model.name} } from '@/types/${model.name}';

async function getData(id: string): Promise<${model.name}> {
  const res = await fetch(\`\${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/${slug}/\${id}\`, { cache: 'no-store' });
  if (!res.ok) throw new Error('${model.name} not found');
  return res.json();
}

export default async function ${model.name}DetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getData(id);
  return (
    <main style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>${model.name} #{id}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link href={\`/${slug}/\${id}/edit\`} style={{ padding: '8px 16px', background: '#f3f4f6', borderRadius: 6, textDecoration: 'none', color: '#111' }}>Edit</Link>
          <Link href="/${slug}" style={{ padding: '8px 16px', background: '#f3f4f6', borderRadius: 6, textDecoration: 'none', color: '#111' }}>← Back</Link>
        </div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid #e5e7eb', borderRadius: 8 }}>
        <tbody>
${fieldRows}
        </tbody>
      </table>
    </main>
  );
}
`
  }

  private generateCreatePage(model: Model, slug: string): string {
    const fields = (model.fields as NamedField[]).filter(
      f => !['id', 'uuid', 'ulid', 'rememberToken'].includes(f.type)
    )
    const inputRows = fields
      .slice(0, 10)
      .map(f => {
        const inputType =
          f.type === 'boolean'
            ? 'checkbox'
            : ['integer', 'bigInteger', 'smallInteger', 'float', 'double', 'decimal', 'foreignId'].includes(f.type)
            ? 'number'
            : f.type === 'date'
            ? 'date'
            : f.type === 'dateTime' || f.type === 'timestamp'
            ? 'datetime-local'
            : 'text'
        const nullable = (f as any).nullable as boolean | undefined
        const inputEl =
          f.type === 'text' || f.type === 'mediumText' || f.type === 'longText'
            ? `          <textarea name="${f.name}" required={${!nullable}} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6, minHeight: 100 }} />`
            : f.type === 'enum' && 'values' in f && (f as any).values?.length
            ? `          <select name="${f.name}" required={${!nullable}} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }}>\n            ${(f as any).values.map((v: string) => `<option value="${v}">${v}</option>`).join('\n            ')}\n          </select>`
            : `          <input type="${inputType}" name="${f.name}" required={${!nullable}} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }} />`
        return `        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>${f.name}</label>
${inputEl}
        </div>`
      })
      .join('\n')

    return `'use client';
import { useRouter } from 'next/navigation';

export default function ${model.name}CreatePage() {
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form).entries());
    await fetch('/api/${slug}', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    router.push('/${slug}');
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 560 }}>
      <h1 style={{ marginBottom: '1.5rem' }}>New ${model.name}</h1>
      <form onSubmit={handleSubmit}>
${inputRows}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Create</button>
          <button type="button" onClick={() => router.push('/${slug}')} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        </div>
      </form>
    </main>
  );
}
`
  }

  private generateEditPage(model: Model, slug: string): string {
    const fields = (model.fields as NamedField[]).filter(
      f => !['id', 'uuid', 'ulid'].includes(f.type)
    )
    const inputRows = fields.slice(0, 10).map(f => {
      const inputType =
        f.type === 'boolean' ? 'checkbox'
        : ['integer', 'bigInteger', 'smallInteger', 'float', 'double', 'decimal', 'foreignId'].includes(f.type) ? 'number'
        : f.type === 'date' ? 'date'
        : f.type === 'dateTime' || f.type === 'timestamp' ? 'datetime-local'
        : 'text'
      const nullable = ('nullable' in f && (f as any).nullable) as boolean | undefined
      return `        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 4, fontWeight: 600, fontSize: 14 }}>${f.name}</label>
          <input type="${inputType}" name="${f.name}" required={${!nullable}} defaultValue={String(item?.${f.name} ?? '')} style={{ width: '100%', padding: '8px 12px', border: '1px solid #e5e7eb', borderRadius: 6 }} />
        </div>`
    }).join('\n')

    return `'use client';
import { useRouter, useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function ${model.name}EditPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [item, setItem] = useState<any>(null);

  useEffect(() => {
    fetch(\`/api/${slug}/\${id}\`).then(r => r.json()).then(setItem);
  }, [id]);

  if (!item) return <p style={{ padding: '2rem' }}>Loading...</p>;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    await fetch(\`/api/${slug}/\${id}\`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    router.push(\`/${slug}/\${id}\`);
  }

  return (
    <main style={{ padding: '2rem', maxWidth: 560 }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Edit ${model.name}</h1>
      <form onSubmit={handleSubmit}>
${inputRows}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Save</button>
          <button type="button" onClick={() => router.push(\`/${slug}/\${id}\`)} style={{ padding: '10px 20px', background: '#f3f4f6', border: 'none', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
        </div>
      </form>
    </main>
  );
}
`
  }

  private generateListPage(model: Model, slug: string, _uiLib: string): string {
    const firstField = (model.fields as NamedField[])[0]?.name ?? 'id'
    return `import Link from 'next/link';
import type { ${model.name} } from '@/types/${model.name}';

async function getData(): Promise<${model.name}[]> {
  const res = await fetch(\`\${process.env.NEXT_PUBLIC_APP_URL ?? ''}/api/${slug}\`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch ${model.name}s');
  return res.json();
}

export default async function ${model.name}ListPage() {
  const items = await getData();
  return (
    <main style={{ padding: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1>${model.name}s</h1>
        <Link href="/${slug}/new" style={{ padding: '8px 16px', background: '#000', color: '#fff', borderRadius: 6, textDecoration: 'none' }}>
          + New
        </Link>
      </div>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <li key={item.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>#{item.id} — {String(item.${firstField})}</span>
            <Link href={\`/${slug}/\${item.id}\`} style={{ fontSize: 14, color: '#6366f1' }}>View →</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
`
  }
}
