import type { Model, ProjectConfig, NamedField } from '@stack-init/schema'
import { type GeneratedFile } from '../../utils/fs'
import { kebabCase, pascalCase, camelCase } from '../../utils/naming'
import { npmVersion } from '../../config/versions'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

export class ReactGenerator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const { models, name: projectName, react: opts } = config

    const stateLib = opts?.state_lib     ?? 'zustand'
    const formLib  = opts?.form_lib      ?? 'react-hook-form'
    const uiLib    = opts?.ui_lib        ?? 'shadcn'
    const httpLib  = opts?.http_lib      ?? 'axios'
    const router   = opts?.router        ?? 'react-router-v6'
    const css      = opts?.css           ?? 'tailwind'
    const query    = opts?.data_fetching ?? 'tanstack-query'

    // ── package.json ──────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'package.json',
      content: JSON.stringify(this.buildPackageJson(projectName, { stateLib, formLib, uiLib, httpLib, router, css, query }), null, 2),
    })

    // ── Vite config ───────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'vite.config.ts',
      content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
});
`,
    })

    // ── tsconfig ──────────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'tsconfig.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2020',
          useDefineForClassFields: true,
          lib: ['ES2020', 'DOM', 'DOM.Iterable'],
          module: 'ESNext',
          skipLibCheck: true,
          moduleResolution: 'bundler',
          allowImportingTsExtensions: true,
          isolatedModules: true,
          moduleDetection: 'force',
          noEmit: true,
          jsx: 'react-jsx',
          strict: true,
          baseUrl: '.',
          paths: { '@/*': ['src/*'] },
        },
        include: ['src'],
        references: [{ path: './tsconfig.node.json' }],
      }, null, 2),
    })

    result.files.push({
      outputPath: 'tsconfig.node.json',
      content: JSON.stringify({
        compilerOptions: {
          target: 'ES2022', lib: ['ES2023'], module: 'ESNext', skipLibCheck: true,
          moduleResolution: 'bundler', allowImportingTsExtensions: true,
          isolatedModules: true, moduleDetection: 'force', noEmit: true, strict: true,
        },
        include: ['vite.config.ts'],
      }, null, 2),
    })

    // ── index.html ────────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'index.html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    })

    // ── .gitignore + .env.example ─────────────────────────────────────────────
    result.files.push({ outputPath: '.gitignore',   content: 'node_modules\ndist\ndist-ssr\n*.local\n.env\n.DS_Store\n' })
    result.files.push({ outputPath: '.env.example', content: 'VITE_API_URL=http://localhost:3000\n' })

    // ── CSS ───────────────────────────────────────────────────────────────────
    if (css === 'tailwind') {
      result.files.push({
        outputPath: 'tailwind.config.js',
        content: `/** @type {import('tailwindcss').Config} */\nexport default {\n  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],\n  theme: { extend: {} },\n  plugins: [],\n};\n`,
      })
      result.files.push({
        outputPath: 'postcss.config.js',
        content: `export default { plugins: { tailwindcss: {}, autoprefixer: {} } };\n`,
      })
      result.files.push({ outputPath: 'src/index.css', content: '@tailwind base;\n@tailwind components;\n@tailwind utilities;\n' })
    } else {
      result.files.push({ outputPath: 'src/index.css', content: '* { box-sizing: border-box; }\nbody { margin: 0; font-family: system-ui, sans-serif; }\n' })
    }

    // ── API client ────────────────────────────────────────────────────────────
    const apiBase = `(import.meta.env.VITE_API_URL ?? 'http://localhost:3000') + '/api'`
    result.files.push({ outputPath: 'src/api/client.ts', content: this.buildApiClient(httpLib, apiBase) })

    for (const model of models) {
      result.files.push({ outputPath: `src/api/${model.name.toLowerCase()}.api.ts`, content: this.buildModelApi(model, httpLib) })
    }

    // ── State ─────────────────────────────────────────────────────────────────
    if (stateLib === 'zustand') {
      result.files.push({
        outputPath: 'src/store/index.ts',
        content: `import { create } from 'zustand';\n\ninterface AppStore {}\n\nexport const useAppStore = create<AppStore>(() => ({}));\n`,
      })
    } else if (stateLib === 'redux-toolkit') {
      result.files.push({
        outputPath: 'src/store/index.ts',
        content: `import { configureStore } from '@reduxjs/toolkit';\nimport { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';\n\nexport const store = configureStore({ reducer: {} });\n\nexport type RootState   = ReturnType<typeof store.getState>;\nexport type AppDispatch = typeof store.dispatch;\nexport const useAppDispatch: () => AppDispatch = useDispatch;\nexport const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;\n`,
      })
    } else if (stateLib === 'jotai') {
      result.files.push({
        outputPath: 'src/store/atoms.ts',
        content: `import { atom } from 'jotai';\nexport const exampleAtom = atom(0);\n`,
      })
    }

    // ── main.tsx ──────────────────────────────────────────────────────────────
    result.files.push({ outputPath: 'src/main.tsx', content: this.buildMainTsx({ stateLib, uiLib, query }) })

    // ── App.tsx ───────────────────────────────────────────────────────────────
    result.files.push({ outputPath: 'src/App.tsx', content: this.buildAppTsx(projectName, models, router) })

    // ── Pages ─────────────────────────────────────────────────────────────────
    result.files.push({ outputPath: 'src/pages/HomePage.tsx', content: this.buildHomePage(projectName, models) })

    for (const model of models) {
      const pascal = pascalCase(model.name)
      const slug   = kebabCase(model.name)
      const mLow   = model.name.toLowerCase()
      result.files.push({ outputPath: `src/pages/${pascal}/${pascal}ListPage.tsx`, content: buildListPage(pascal, mLow, slug, query) })
      result.files.push({ outputPath: `src/pages/${pascal}/${pascal}FormPage.tsx`, content: buildFormPage(pascal, mLow, slug, model.fields, formLib) })
    }

    return result
  }

  // ── Private builders ────────────────────────────────────────────────────────

  private buildPackageJson(projectName: string, o: Record<string, string>) {
    const { stateLib, formLib, uiLib, httpLib, router, css, query } = o
    return {
      name:    kebabCase(projectName),
      version: '0.1.0',
      private: true,
      type:    'module',
      scripts: { dev: 'vite', build: 'tsc -b && vite build', preview: 'vite preview', lint: 'tsc --noEmit' },
      dependencies: {
        react:       npmVersion('react')       ?? '^19.1.0',
        'react-dom': npmVersion('react-dom')   ?? '^19.1.0',
        ...(router   === 'react-router-v6'  && { 'react-router-dom':          npmVersion('react-router-dom')          ?? '^7.6.0'  }),
        ...(router   === 'tanstack-router'  && { '@tanstack/react-router':     npmVersion('@tanstack/react-router')    ?? '^1.114.0' }),
        ...(stateLib === 'zustand'          && { zustand:                      npmVersion('zustand')                   ?? '^5.0.4'  }),
        ...(stateLib === 'redux-toolkit'    && { '@reduxjs/toolkit':            npmVersion('@reduxjs/toolkit')          ?? '^2.6.1', 'react-redux': npmVersion('react-redux') ?? '^9.2.0' }),
        ...(stateLib === 'jotai'            && { jotai:                        npmVersion('jotai')                     ?? '^2.12.3' }),
        ...(httpLib  === 'axios'            && { axios:                        npmVersion('axios')                     ?? '^1.9.0'  }),
        ...(httpLib  === 'ky'               && { ky:                           npmVersion('ky')                        ?? '^1.8.1'  }),
        ...(query    === 'tanstack-query'   && { '@tanstack/react-query':      npmVersion('@tanstack/react-query')     ?? '^5.76.1' }),
        ...(query    === 'swr'              && { swr:                          npmVersion('swr')                       ?? '^2.3.3'  }),
        ...(formLib  === 'react-hook-form'  && { 'react-hook-form':            npmVersion('react-hook-form')           ?? '^7.56.4', zod: npmVersion('zod') ?? '^3.24.0' }),
        ...(formLib  === 'formik'           && { formik:                       npmVersion('formik')                    ?? '^2.4.6',  yup: npmVersion('yup') ?? '^1.6.1' }),
        ...(uiLib    === 'shadcn'           && { 'class-variance-authority':   npmVersion('class-variance-authority')  ?? '^0.7.1',  clsx: npmVersion('clsx') ?? '^2.1.1', 'tailwind-merge': npmVersion('tailwind-merge') ?? '^3.3.0', 'lucide-react': npmVersion('lucide-react') ?? '^0.511.0' }),
        ...(uiLib    === 'mui'              && { '@mui/material':              npmVersion('@mui/material')              ?? '^6.4.8',  '@emotion/react': npmVersion('@emotion/react') ?? '^11.14.0', '@emotion/styled': npmVersion('@emotion/styled') ?? '^11.14.0', '@mui/icons-material': npmVersion('@mui/icons-material') ?? '^6.4.8' }),
        ...(uiLib    === 'antd'             && { antd:                         npmVersion('antd')                      ?? '^5.24.7' }),
      },
      devDependencies: {
        '@vitejs/plugin-react': npmVersion('@vitejs/plugin-react') ?? '^4.5.1',
        vite:                   npmVersion('vite')                 ?? '^6.3.5',
        typescript:             npmVersion('typescript')           ?? '^5.8.3',
        '@types/react':         npmVersion('@types/react')         ?? '^19.1.4',
        '@types/react-dom':     npmVersion('@types/react-dom')     ?? '^19.1.4',
        ...(css === 'tailwind' && {
          tailwindcss:  npmVersion('tailwindcss')  ?? '^4.1.7',
          autoprefixer: npmVersion('autoprefixer') ?? '^10.4.21',
          postcss:      npmVersion('postcss')      ?? '^8.5.3',
        }),
      },
    }
  }

  private buildApiClient(httpLib: string, apiBase: string): string {
    if (httpLib === 'axios') {
      return `import axios from 'axios';\n\nconst client = axios.create({\n  baseURL: ${apiBase},\n  headers: { 'Content-Type': 'application/json' },\n});\n\nexport default client;\n`
    }
    if (httpLib === 'ky') {
      return `import ky from 'ky';\n\nconst client = ky.extend({\n  prefixUrl: ${apiBase},\n  headers: { 'Content-Type': 'application/json' },\n});\n\nexport default client;\n`
    }
    return `const BASE_URL = ${apiBase};\n\nasync function req<T>(path: string, init?: RequestInit): Promise<T> {\n  const res = await fetch(\`\${BASE_URL}/\${path}\`, { headers: { 'Content-Type': 'application/json' }, ...init });\n  if (!res.ok) throw new Error(await res.text());\n  return res.json() as Promise<T>;\n}\n\nexport const getAll = <T>(path: string)                => req<T>(path);\nexport const getOne = <T>(path: string)                => req<T>(path);\nexport const create = <T>(path: string, body: unknown) => req<T>(path, { method: 'POST',   body: JSON.stringify(body) });\nexport const update = <T>(path: string, body: unknown) => req<T>(path, { method: 'PUT',    body: JSON.stringify(body) });\nexport const remove = (path: string)                   => req<void>(path, { method: 'DELETE' });\n`
  }

  private buildModelApi(model: Model, httpLib: string): string {
    const mLow = model.name.toLowerCase()
    const slug = kebabCase(model.name)
    if (httpLib === 'axios') {
      return `import client from './client';\nexport const ${mLow}Api = {\n  findAll: ()                      => client.get<any[]>('/${slug}').then(r => r.data),\n  findOne: (id: number)            => client.get<any>(\`/${slug}/\${id}\`).then(r => r.data),\n  create:  (data: any)             => client.post<any>('/${slug}', data).then(r => r.data),\n  update:  (id: number, data: any) => client.put<any>(\`/${slug}/\${id}\`, data).then(r => r.data),\n  remove:  (id: number)            => client.delete(\`/${slug}/\${id}\`),\n};\n`
    }
    if (httpLib === 'ky') {
      return `import client from './client';\nexport const ${mLow}Api = {\n  findAll: ()                      => client.get('${slug}').json<any[]>(),\n  findOne: (id: number)            => client.get(\`${slug}/\${id}\`).json<any>(),\n  create:  (data: any)             => client.post('${slug}', { json: data }).json<any>(),\n  update:  (id: number, data: any) => client.put(\`${slug}/\${id}\`, { json: data }).json<any>(),\n  remove:  (id: number)            => client.delete(\`${slug}/\${id}\`),\n};\n`
    }
    return `import { getAll, getOne, create, update, remove } from './client';\nexport const ${mLow}Api = {\n  findAll: ()                      => getAll<any[]>('${slug}'),\n  findOne: (id: number)            => getOne<any>(\`${slug}/\${id}\`),\n  create:  (data: any)             => create<any>('${slug}', data),\n  update:  (id: number, data: any) => update<any>(\`${slug}/\${id}\`, data),\n  remove:  (id: number)            => remove(\`${slug}/\${id}\`),\n};\n`
  }

  private buildMainTsx(o: { stateLib: string; uiLib: string; query: string }): string {
    const { stateLib, uiLib, query } = o
    const lines: string[] = [
      `import { StrictMode } from 'react';`,
      `import { createRoot } from 'react-dom/client';`,
      `import './index.css';`,
    ]
    const open:  string[] = []
    const close: string[] = []

    if (query === 'tanstack-query') {
      lines.push(`import { QueryClient, QueryClientProvider } from '@tanstack/react-query';`)
      lines.push(`const queryClient = new QueryClient();`)
      open.push(`<QueryClientProvider client={queryClient}>`)
      close.unshift(`</QueryClientProvider>`)
    }
    if (stateLib === 'redux-toolkit') {
      lines.push(`import { Provider } from 'react-redux';`, `import { store } from './store';`)
      open.push(`<Provider store={store}>`)
      close.unshift(`</Provider>`)
    }
    if (uiLib === 'mui') {
      lines.push(`import { ThemeProvider, CssBaseline, createTheme } from '@mui/material';`)
      lines.push(`const theme = createTheme();`)
      open.push(`<ThemeProvider theme={theme}><CssBaseline />`)
      close.unshift(`</ThemeProvider>`)
    }
    if (uiLib === 'antd') {
      lines.push(`import { ConfigProvider } from 'antd';`)
      open.push(`<ConfigProvider>`)
      close.unshift(`</ConfigProvider>`)
    }
    lines.push(`import App from './App';`)

    const inner = [...open, `      <App />`, ...close].join('\n      ')
    return `${lines.join('\n')}\n\ncreateRoot(document.getElementById('root')!).render(\n  <StrictMode>\n      ${inner}\n  </StrictMode>,\n);\n`
  }

  private buildAppTsx(projectName: string, models: Model[], router: string): string {
    if (router === 'react-router-v6') {
      const imports = models.map(m => {
        const p = pascalCase(m.name)
        return `import ${p}ListPage from './pages/${p}/${p}ListPage';\nimport ${p}FormPage from './pages/${p}/${p}FormPage';`
      }).join('\n')
      const routes = models.map(m => {
        const p = pascalCase(m.name)
        const s = kebabCase(m.name)
        return `        <Route path="/${s}"     element={<${p}ListPage />} />\n        <Route path="/${s}/new" element={<${p}FormPage />} />\n        <Route path="/${s}/:id" element={<${p}FormPage />} />`
      }).join('\n')
      return `import { BrowserRouter, Routes, Route } from 'react-router-dom';\n${imports}\nimport HomePage from './pages/HomePage';\n\nexport default function App() {\n  return (\n    <BrowserRouter>\n      <Routes>\n        <Route path="/" element={<HomePage />} />\n${routes}\n      </Routes>\n    </BrowserRouter>\n  );\n}\n`
    }
    if (router === 'tanstack-router') {
      return `import { RouterProvider, createRouter, createRootRoute, createRoute, Outlet } from '@tanstack/react-router';\n\nconst rootRoute  = createRootRoute({ component: Outlet });\nconst indexRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: () => <h1>${projectName}</h1> });\nconst routeTree  = rootRoute.addChildren([indexRoute]);\nconst router     = createRouter({ routeTree });\n\ndeclare module '@tanstack/react-router' { interface Register { router: typeof router } }\n\nexport default function App() { return <RouterProvider router={router} />; }\n`
    }
    return `export default function App() {\n  return (\n    <div className="min-h-screen p-8">\n      <h1 className="text-3xl font-bold">${projectName}</h1>\n    </div>\n  );\n}\n`
  }

  private buildHomePage(projectName: string, models: Model[]): string {
    const links = models.map(m => `        <a href="/${kebabCase(m.name)}" className="text-blue-600 hover:underline">${m.name}s</a>`).join('\n')
    return `export default function HomePage() {\n  return (\n    <main className="p-8">\n      <h1 className="text-3xl font-bold mb-4">${projectName}</h1>\n      <nav className="mt-6 flex flex-col gap-2">\n${links}\n      </nav>\n    </main>\n  );\n}\n`
  }
}

// ── Standalone page builders (reused in tests + ZIP) ──────────────────────────

export function buildListPage(pascal: string, mLow: string, slug: string, query: string): string {
  if (query === 'tanstack-query') {
    return `import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ${mLow}Api } from '../../api/${mLow}.api';

export default function ${pascal}ListPage() {
  const queryClient = useQueryClient();
  const { data: items = [], isLoading } = useQuery({ queryKey: ['${mLow}s'], queryFn: ${mLow}Api.findAll });
  const removeMutation = useMutation({
    mutationFn: ${mLow}Api.remove,
    onSuccess:  () => queryClient.invalidateQueries({ queryKey: ['${mLow}s'] }),
  });

  if (isLoading) return <p className="p-8">Loading…</p>;

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${pascal}s</h1>
        <a href="/${slug}/new" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">New ${pascal}</a>
      </div>
      <table className="w-full border-collapse border border-gray-200">
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="py-3 px-4">{item.id}</td>
              <td className="py-3 px-4 flex gap-3">
                <a href={\`/${slug}/\${item.id}\`} className="text-blue-600 hover:underline">Edit</a>
                <button onClick={() => removeMutation.mutate(item.id)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`
  }
  return `import { useEffect, useState } from 'react';
import { ${mLow}Api } from '../../api/${mLow}.api';

export default function ${pascal}ListPage() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => { ${mLow}Api.findAll().then(setItems); }, []);
  const handleDelete = async (id: number) => {
    await ${mLow}Api.remove(id);
    setItems(prev => prev.filter((i: any) => i.id !== id));
  };
  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">${pascal}s</h1>
        <a href="/${slug}/new" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">New ${pascal}</a>
      </div>
      <table className="w-full border-collapse border border-gray-200">
        <tbody>
          {items.map((item: any) => (
            <tr key={item.id} className="border-b border-gray-200 hover:bg-gray-50">
              <td className="py-3 px-4">{item.id}</td>
              <td className="py-3 px-4 flex gap-3">
                <a href={\`/${slug}/\${item.id}\`} className="text-blue-600 hover:underline">Edit</a>
                <button onClick={() => handleDelete(item.id)} className="text-red-600 hover:underline">Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
`
}

export function buildFormPage(pascal: string, mLow: string, slug: string, fields: NamedField[], formLib: string): string {
  const isNum  = (f: NamedField) => ['integer','bigInteger','tinyInteger','smallInteger','mediumInteger','unsignedInteger','float','double','decimal'].includes(f.type)
  const isBool = (f: NamedField) => f.type === 'boolean'

  if (formLib === 'react-hook-form') {
    const inputs = fields.map(f => {
      if (isBool(f)) return `        <label className="flex items-center gap-2"><input type="checkbox" {...register('${f.name}')} /> ${f.name}</label>`
      return `        <div>\n          <label className="block text-sm font-medium mb-1">${f.name}</label>\n          <input type="${isNum(f) ? 'number' : 'text'}" {...register('${f.name}'${isNum(f) ? ", { valueAsNumber: true }" : ""})} className="w-full px-3 py-2 border rounded" />\n        </div>`
    }).join('\n')
    return `import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ${mLow}Api } from '../../api/${mLow}.api';

export default function ${pascal}FormPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => { if (id) ${mLow}Api.findOne(Number(id)).then(reset); }, [id, reset]);

  const onSubmit = async (data: any) => {
    if (id) await ${mLow}Api.update(Number(id), data);
    else    await ${mLow}Api.create(data);
    navigate('/${slug}');
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">{id ? 'Edit' : 'New'} ${pascal}</h1>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
${inputs}
        <div className="flex gap-3">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
          <button type="button" onClick={() => navigate('/${slug}')} className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
`
  }

  const stateInit = fields.map(f => `${f.name}: ${isNum(f) ? '0' : isBool(f) ? 'false' : "''"} as any`).join(', ')
  const inputs    = fields.map(f => {
    if (isBool(f)) return `        <label className="flex items-center gap-2">\n          <input type="checkbox" checked={!!form.${f.name}} onChange={e => setForm(p => ({ ...p, ${f.name}: e.target.checked }))} />\n          ${f.name}\n        </label>`
    return `        <div>\n          <label className="block text-sm font-medium mb-1">${f.name}</label>\n          <input type="${isNum(f) ? 'number' : 'text'}" value={form.${f.name}} onChange={e => setForm(p => ({ ...p, ${f.name}: e.target.value }))} className="w-full px-3 py-2 border rounded" />\n        </div>`
  }).join('\n')

  return `import { useEffect, useState } from 'react';
import { ${mLow}Api } from '../../api/${mLow}.api';

export default function ${pascal}FormPage() {
  const id = window.location.pathname.includes('/new') ? null : Number(window.location.pathname.split('/').pop());
  const [form, setForm] = useState({ ${stateInit} });
  useEffect(() => { if (id) ${mLow}Api.findOne(id).then(setForm); }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (id) await ${mLow}Api.update(id, form);
    else    await ${mLow}Api.create(form);
    window.location.href = '/${slug}';
  };

  return (
    <div className="p-8 max-w-lg">
      <h1 className="text-2xl font-bold mb-6">{id ? 'Edit' : 'New'} ${pascal}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
${inputs}
        <div className="flex gap-3">
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">Save</button>
          <a href="/${slug}" className="px-4 py-2 border rounded hover:bg-gray-50">Cancel</a>
        </div>
      </form>
    </div>
  );
}
`
}
