import type { Model, ProjectConfig, NamedField } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'
import { kebabCase, pascalCase, camelCase } from '../../utils/naming'
import { npmVersion } from '../../config/versions'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class T3Generator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const { models, name: projectName } = config

    // package.json
    result.files.push({
      outputPath: 'package.json',
      content: JSON.stringify(this.buildPackageJson(projectName), null, 2),
    })

    // tsconfig.json
    result.files.push({
      outputPath: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2022',
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
          paths: { '~/*': ['./src/*'] },
        },
        include: ['next-env.d.ts', '**/*.ts', '**/*.tsx', '.next/types/**/*.ts'],
        exclude: ['node_modules'],
      }, null, 2),
    })

    // next.config.ts
    result.files.push({
      outputPath: 'next.config.ts',
      content: `import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  typescript: { ignoreBuildErrors: false },
  eslint: { ignoreDuringBuilds: false },
};

export default nextConfig;
`,
    })

    // tailwind.config.ts
    result.files.push({
      outputPath: 'tailwind.config.ts',
      content: `import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
};

export default config;
`,
    })

    // postcss.config.mjs
    result.files.push({
      outputPath: 'postcss.config.mjs',
      content: `const config = { plugins: { '@tailwindcss/postcss': {} } };\nexport default config;\n`,
    })

    // .env
    result.files.push({
      outputPath: '.env',
      content: `DATABASE_URL="postgresql://user:password@localhost:5432/${projectName}?schema=public"\nNEXTAUTH_SECRET="your-secret-here"\nNEXTAUTH_URL="http://localhost:3000"\n`,
    })

    // .gitignore
    result.files.push({
      outputPath: '.gitignore',
      content: `node_modules\n.next\ndist\n.env\n*.log\n`,
    })

    // Prisma schema
    result.files.push({
      outputPath: 'prisma/schema.prisma',
      content: this.generatePrismaSchema(models),
    })

    // src/app/globals.css
    result.files.push({
      outputPath: 'src/app/globals.css',
      content: `@import "tailwindcss";\n`,
    })

    // src/app/layout.tsx
    result.files.push({
      outputPath: 'src/app/layout.tsx',
      content: this.generateLayout(projectName),
    })

    // src/app/page.tsx
    result.files.push({
      outputPath: 'src/app/page.tsx',
      content: this.generateHomePage(projectName, models),
    })

    // tRPC server infrastructure
    result.files.push({
      outputPath: 'src/server/db.ts',
      content: this.generateDbTs(),
    })
    result.files.push({
      outputPath: 'src/server/api/trpc.ts',
      content: this.generateTrpcTs(),
    })
    result.files.push({
      outputPath: 'src/server/api/root.ts',
      content: this.generateRootTs(models),
    })

    // tRPC client
    result.files.push({
      outputPath: 'src/trpc/query-client.ts',
      content: this.generateQueryClientTs(),
    })
    result.files.push({
      outputPath: 'src/trpc/react.tsx',
      content: this.generateTrpcReactTs(),
    })
    result.files.push({
      outputPath: 'src/trpc/server.ts',
      content: this.generateTrpcServerTs(),
    })

    // Next.js API route for tRPC
    result.files.push({
      outputPath: 'src/app/api/trpc/[trpc]/route.ts',
      content: this.generateTrpcRoute(),
    })

    // Per-model files
    for (const model of models) {
      const slug    = kebabCase(model.name)
      const mLow    = model.name.toLowerCase()
      const mCamel  = camelCase(model.name)

      result.files.push({
        outputPath: `src/server/api/routers/${slug}.ts`,
        content: this.generateRouter(model, mLow),
      })
      result.files.push({
        outputPath: `src/app/${slug}/page.tsx`,
        content: this.generateListPage(model, slug, mCamel),
      })
      result.files.push({
        outputPath: `src/app/${slug}/new/page.tsx`,
        content: this.generateCreatePage(model, slug, mCamel),
      })
    }

    return result
  }

  private buildPackageJson(name: string): Record<string, unknown> {
    return {
      name: name.toLowerCase().replace(/\s+/g, '-'),
      version: '0.1.0',
      private: true,
      scripts: {
        dev: 'next dev',
        build: 'next build',
        start: 'next start',
        'db:generate': 'prisma generate',
        'db:push': 'prisma db push',
        'db:studio': 'prisma studio',
      },
      dependencies: {
        next:                        npmVersion('next'),
        react:                       npmVersion('react'),
        'react-dom':                 npmVersion('react-dom'),
        '@prisma/client':            npmVersion('@prisma/client'),
        '@trpc/server':              npmVersion('@trpc/server'),
        '@trpc/client':              npmVersion('@trpc/client'),
        '@trpc/react-query':         npmVersion('@trpc/react-query'),
        '@tanstack/react-query':     npmVersion('@tanstack/react-query'),
        superjson:                   npmVersion('superjson'),
        zod:                         npmVersion('zod'),
        tailwindcss:                 npmVersion('tailwindcss'),
        '@tailwindcss/postcss':      npmVersion('@tailwindcss/postcss'),
      },
      devDependencies: {
        typescript:          npmVersion('typescript'),
        '@types/node':       npmVersion('@types/node'),
        '@types/react':      npmVersion('@types/react'),
        '@types/react-dom':  npmVersion('@types/react-dom'),
        prisma:              npmVersion('prisma'),
      },
    }
  }

  private generatePrismaSchema(models: Model[]): string {
    let schema = `generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

`
    for (const model of models) {
      schema += `model ${pascalCase(model.name)} {\n`
      schema += `  id        Int      @id @default(autoincrement())\n`
      for (const field of model.fields as NamedField[]) {
        if (['id', 'uuid', 'ulid'].includes(field.type)) continue
        const prismaType = this.toPrismaType(field)
        const nullable   = 'nullable' in field && field.nullable ? '?' : ''
        const unique     = 'unique'   in field && field.unique   ? ' @unique' : ''
        schema += `  ${field.name} ${prismaType}${nullable}${unique}\n`
      }
      schema += `  createdAt DateTime @default(now())\n`
      schema += `  updatedAt DateTime @updatedAt\n`
      if (model.table) schema += `\n  @@map("${model.table}")\n`
      schema += `}\n\n`
    }
    return schema
  }

  private toPrismaType(field: NamedField): string {
    switch (field.type) {
      case 'boolean':                                              return 'Boolean'
      case 'integer': case 'smallInteger': case 'mediumInteger':
      case 'unsignedInteger': case 'foreignId':                   return 'Int'
      case 'bigInteger': case 'unsignedBigInteger':               return 'BigInt'
      case 'float': case 'double':                                return 'Float'
      case 'decimal':                                             return 'Decimal'
      case 'date': case 'dateTime': case 'timestamp':             return 'DateTime'
      case 'json': case 'jsonb':                                  return 'Json'
      default:                                                    return 'String'
    }
  }

  private generateLayout(projectName: string): string {
    return `import type { Metadata } from 'next';
import './globals.css';
import { TRPCReactProvider } from '~/trpc/react';

export const metadata: Metadata = {
  title: '${projectName}',
  description: 'Generated by Stack-Init — T3 Stack',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <TRPCReactProvider>{children}</TRPCReactProvider>
      </body>
    </html>
  );
}
`
  }

  private generateHomePage(projectName: string, models: Model[]): string {
    const links = models.map(m => {
      const slug = kebabCase(m.name)
      return `        <a href="/${slug}" className="block px-4 py-3 border rounded-lg hover:bg-gray-50 text-indigo-600 font-medium no-underline">${m.name}s</a>`
    }).join('\n')

    return `export default function Home() {
  return (
    <main className="p-8 max-w-lg mx-auto">
      <h1 className="text-3xl font-bold mb-2">${projectName}</h1>
      <p className="text-gray-600 mb-6">
        Powered by{' '}
        <a href="https://create.t3.gg" className="text-indigo-500 hover:underline">T3 Stack</a>
        {' '}— Generated by Stack-Init
      </p>
      <div className="flex flex-col gap-2">
${links}
      </div>
    </main>
  );
}
`
  }

  private generateDbTs(): string {
    return `import { PrismaClient } from '@prisma/client';

const createPrismaClient = () =>
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrismaClient> | undefined;
};

export const db = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
`
  }

  private generateTrpcTs(): string {
    return `import { initTRPC } from '@trpc/server';
import superjson from 'superjson';
import { ZodError } from 'zod';
import { db } from '~/server/db';

export const createTRPCContext = async (opts: { headers: Headers }) => ({
  db,
  headers: opts.headers,
});

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createCallerFactory = t.createCallerFactory;
export const createTRPCRouter   = t.router;
export const publicProcedure    = t.procedure;
`
  }

  private generateRootTs(models: Model[]): string {
    const imports   = models.map(m => `import { ${camelCase(m.name)}Router } from './routers/${kebabCase(m.name)}';`).join('\n')
    const routerMap = models.map(m => `  ${camelCase(m.name)}: ${camelCase(m.name)}Router,`).join('\n')
    return `import { createCallerFactory, createTRPCRouter } from '~/server/api/trpc';
${imports}

export const appRouter = createTRPCRouter({
${routerMap}
});

export type AppRouter = typeof appRouter;
export const createCaller = createCallerFactory(appRouter);
`
  }

  private generateQueryClientTs(): string {
    return `import { defaultShouldDehydrateQuery, QueryClient } from '@tanstack/react-query';
import superjson from 'superjson';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { staleTime: 30 * 1000 },
      dehydrate: {
        serializeData: superjson.serialize,
        shouldDehydrateQuery: (q) =>
          defaultShouldDehydrateQuery(q) || q.state.status === 'pending',
      },
      hydrate: { deserializeData: superjson.deserialize },
    },
  });
}
`
  }

  private generateTrpcReactTs(): string {
    return `'use client';

import { type QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { loggerLink, unstable_httpBatchStreamLink } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { type inferRouterInputs, type inferRouterOutputs } from '@trpc/server';
import { useState } from 'react';
import superjson from 'superjson';
import { type AppRouter } from '~/server/api/root';
import { createQueryClient } from './query-client';

let clientQueryClientSingleton: QueryClient | undefined;
const getQueryClient = () => {
  if (typeof window === 'undefined') return createQueryClient();
  return (clientQueryClientSingleton ??= createQueryClient());
};

export const api = createTRPCReact<AppRouter>();
export type RouterInputs  = inferRouterInputs<AppRouter>;
export type RouterOutputs = inferRouterOutputs<AppRouter>;

export function TRPCReactProvider({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();
  const [trpcClient] = useState(() =>
    api.createClient({
      links: [
        loggerLink({ enabled: (op) => process.env.NODE_ENV === 'development' || (op.direction === 'down' && op.result instanceof Error) }),
        unstable_httpBatchStreamLink({
          transformer: superjson,
          url: \`\${getBaseUrl()}/api/trpc\`,
          headers() {
            const h = new Headers();
            h.set('x-trpc-source', 'nextjs-react');
            return h;
          },
        }),
      ],
    })
  );
  return (
    <QueryClientProvider client={queryClient}>
      <api.Provider client={trpcClient} queryClient={queryClient}>
        {children}
      </api.Provider>
    </QueryClientProvider>
  );
}

function getBaseUrl() {
  if (typeof window !== 'undefined') return window.location.origin;
  if (process.env.VERCEL_URL) return \`https://\${process.env.VERCEL_URL}\`;
  return \`http://localhost:\${process.env.PORT ?? 3000}\`;
}
`
  }

  private generateTrpcServerTs(): string {
    return `import 'server-only';
import { createHydrationHelpers } from '@trpc/react-query/rsc';
import { headers } from 'next/headers';
import { cache } from 'react';
import { createCaller, type AppRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';
import { createQueryClient } from './query-client';

const createContext = cache(async () => {
  const h = await headers();
  return createTRPCContext({ headers: h });
});

const getQueryClient = cache(createQueryClient);
const caller = createCaller(createContext);

export const { trpc: api, HydrateClient } = createHydrationHelpers<AppRouter>(caller, getQueryClient);
`
  }

  private generateTrpcRoute(): string {
    return `import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { type NextRequest } from 'next/server';
import { appRouter } from '~/server/api/root';
import { createTRPCContext } from '~/server/api/trpc';

const handler = (req: NextRequest) =>
  fetchRequestHandler({
    endpoint: '/api/trpc',
    req,
    router: appRouter,
    createContext: () => createTRPCContext({ headers: req.headers }),
    onError:
      process.env.NODE_ENV === 'development'
        ? ({ path, error }) => console.error(\`❌ tRPC failed on \${path ?? '<no-path>'}: \${error.message}\`)
        : undefined,
  });

export { handler as GET, handler as POST };
`
  }

  private generateRouter(model: Model, mLow: string): string {
    const Name   = model.name
    const fields = (model.fields as NamedField[]).filter(f => !['id', 'uuid', 'ulid'].includes(f.type))
    const inputFields = fields.slice(0, 8).map(f => {
      const nullable = 'nullable' in f && f.nullable
      switch (f.type) {
        case 'integer': case 'smallInteger': case 'mediumInteger': case 'bigInteger':
        case 'float': case 'double': case 'decimal': case 'foreignId':
          return `    ${f.name}: z.number()${nullable ? '.optional()' : ''},`
        case 'boolean':
          return `    ${f.name}: z.boolean()${nullable ? '.optional()' : ''},`
        default:
          return `    ${f.name}: z.string()${nullable ? '.optional()' : ''},`
      }
    }).join('\n')

    return `import { z } from 'zod';
import { createTRPCRouter, publicProcedure } from '~/server/api/trpc';

export const ${camelCase(Name)}Router = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.${mLow}.findMany({ orderBy: { createdAt: 'desc' } });
  }),

  getById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.${mLow}.findUnique({ where: { id: input.id } });
    }),

  create: publicProcedure
    .input(z.object({
${inputFields}
    }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.${mLow}.create({ data: input });
    }),

  update: publicProcedure
    .input(z.object({ id: z.number(),
${inputFields.replace(/,$/mg, '.optional(),')}
    }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.${mLow}.update({ where: { id }, data });
    }),

  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.${mLow}.delete({ where: { id: input.id } });
    }),
});
`
  }

  private generateListPage(model: Model, slug: string, mCamel: string): string {
    const Name       = model.name
    const firstField = (model.fields as NamedField[])[0]?.name ?? 'id'

    return `'use client';
import Link from 'next/link';
import { api } from '~/trpc/react';

export default function ${Name}ListPage() {
  const { data: items = [], isLoading } = api.${mCamel}.getAll.useQuery();
  const utils = api.useUtils();
  const del = api.${mCamel}.delete.useMutation({
    onSuccess: () => utils.${mCamel}.getAll.invalidate(),
  });

  if (isLoading) return <p className="p-8 text-gray-500">Loading…</p>;

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${Name}s</h1>
        <Link href="/${slug}/new" className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 no-underline">
          + New
        </Link>
      </div>
      <ul className="flex flex-col gap-2 list-none p-0">
        {items.map((item) => (
          <li key={item.id} className="border rounded-lg px-4 py-3 flex justify-between items-center hover:bg-gray-50">
            <span className="text-sm font-medium">#{item.id} — {String(item.${firstField})}</span>
            <div className="flex gap-2">
              <Link href={\`/${slug}/\${item.id}\`} className="text-xs text-indigo-500 hover:underline">View</Link>
              <button
                onClick={() => del.mutate({ id: item.id })}
                className="text-xs text-red-500 hover:underline"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <p className="text-gray-400 text-sm">No ${Name.toLowerCase()}s yet.</p>}
      </ul>
    </main>
  );
}
`
  }

  private generateCreatePage(model: Model, slug: string, mCamel: string): string {
    const Name   = model.name
    const fields = (model.fields as NamedField[]).filter(f => !['id', 'uuid', 'ulid'].includes(f.type)).slice(0, 10)
    const stateInit = fields.map(f => `${f.name}: ''`).join(', ')
    const inputs    = fields.map(f => `
          <div>
            <label className="block text-sm font-medium mb-1">${f.name}</label>
            <input
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={form.${f.name}}
              onChange={e => setForm(p => ({ ...p, ${f.name}: e.target.value }))}
            />
          </div>`).join('')

    return `'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '~/trpc/react';

export default function ${Name}CreatePage() {
  const router = useRouter();
  const [form, setForm] = useState({ ${stateInit} });
  const utils = api.useUtils();
  const create = api.${mCamel}.create.useMutation({
    onSuccess: () => { utils.${mCamel}.getAll.invalidate(); router.push('/${slug}'); },
  });

  return (
    <main className="p-8 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">New ${Name}</h1>
      <form
        onSubmit={e => { e.preventDefault(); create.mutate(form as any); }}
        className="flex flex-col gap-4"
      >
${inputs}
        <div className="flex gap-3 mt-2">
          <button type="submit" disabled={create.isPending}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-50">
            {create.isPending ? 'Saving…' : 'Create'}
          </button>
          <button type="button" onClick={() => router.push('/${slug}')}
            className="px-4 py-2 bg-gray-100 rounded-lg text-sm hover:bg-gray-200">
            Cancel
          </button>
        </div>
        {create.error && <p className="text-red-500 text-sm">{create.error.message}</p>}
      </form>
    </main>
  );
}
`
  }
}
