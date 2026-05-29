import type { ProjectConfig } from '@stack-init/schema'
import type { GeneratedFile } from '../../utils/fs'

export interface GeneratorResult {
  files: GeneratedFile[]
  warnings: string[]
}

function pascal(s: string) { return s.charAt(0).toUpperCase() + s.slice(1) }
function camel(s: string)  { return s.charAt(0).toLowerCase() + s.slice(1) }
function kebab(s: string)  { return s.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '') }
function plural(s: string) { return s.endsWith('s') ? s : s + 's' }

export class VueGenerator {
  async generate(config: ProjectConfig, _projectRoot: string): Promise<GeneratorResult> {
    const result: GeneratorResult = { files: [], warnings: [] }
    const projectName = config.name
    const backendUrl  = (config as any).backendUrl ?? 'http://localhost:3000'
    const routable    = config.models.filter(m => m.generate?.routes !== false)

    // ── package.json ───────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'package.json',
      content: JSON.stringify({
        name: 'frontend',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
          dev: 'vite',
          build: 'vue-tsc && vite build',
          preview: 'vite preview',
          typecheck: 'vue-tsc --noEmit',
          lint: 'eslint . --ext .vue,.ts --fix',
        },
        dependencies: {
          vue: '^3.5.13',
          'vue-router': '^4.5.0',
          pinia: '^2.3.1',
          axios: '^1.9.0',
        },
        devDependencies: {
          '@vitejs/plugin-vue': '^5.2.1',
          vite: '^6.3.5',
          'vue-tsc': '^2.2.10',
          typescript: '^5.8.3',
        },
      }, null, 2),
    })

    // ── vite.config.ts ─────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'vite.config.ts',
      content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
`,
    })

    // ── tsconfig files ─────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'tsconfig.json',
      content: JSON.stringify({ files: [], references: [{ path: './tsconfig.node.json' }, { path: './tsconfig.app.json' }] }, null, 2),
    })
    result.files.push({
      outputPath: 'tsconfig.app.json',
      content: JSON.stringify({
        extends: '@vue/tsconfig/tsconfig.dom.json',
        include: ['env.d.ts', 'src/**/*', 'src/**/*.vue'],
        exclude: ['src/**/__tests__/*'],
        compilerOptions: {
          tsBuildInfoFile: './node_modules/.tmp/tsconfig.app.tsbuildinfo',
          paths: { '@/*': ['./src/*'] },
        },
      }, null, 2),
    })
    result.files.push({
      outputPath: 'tsconfig.node.json',
      content: JSON.stringify({
        extends: '@tsconfig/node22/tsconfig.json',
        include: ['vite.config.*'],
        compilerOptions: {
          tsBuildInfoFile: './node_modules/.tmp/tsconfig.node.tsbuildinfo',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          types: ['node'],
        },
      }, null, 2),
    })

    // ── index.html ─────────────────────────────────────────────────────────────
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
    <div id="app"></div>
    <script type="module" src="/src/main.ts"><\/script>
  </body>
</html>
`,
    })

    // ── src/env.d.ts ───────────────────────────────────────────────────────────
    result.files.push({ outputPath: 'src/env.d.ts', content: `/// <reference types="vite/client" />\n` })

    // ── src/main.ts ────────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'src/main.ts',
      content: `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
`,
    })

    // ── src/App.vue ────────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'src/App.vue',
      content: `<template>
  <RouterView />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>
`,
    })

    // ── Router ─────────────────────────────────────────────────────────────────
    const routerRoutes = routable.map(m => {
      const slug = plural(kebab(m.name))
      return `  { path: '/${slug}', component: () => import('../views/${m.name}ListView.vue') },
  { path: '/${slug}/new', component: () => import('../views/${m.name}FormView.vue') },
  { path: '/${slug}/:id/edit', component: () => import('../views/${m.name}FormView.vue') },`
    }).join('\n')

    result.files.push({
      outputPath: 'src/router/index.ts',
      content: `import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
${routerRoutes}
  ],
})

export default router
`,
    })

    // ── API client ─────────────────────────────────────────────────────────────
    result.files.push({
      outputPath: 'src/api/client.ts',
      content: `import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '${backendUrl}',
  headers: { 'Content-Type': 'application/json' },
})

export default api
`,
    })

    for (const model of routable) {
      const mCamel = camel(model.name)
      const slug   = plural(kebab(model.name))
      result.files.push({
        outputPath: `src/api/${mCamel}.ts`,
        content: `import api from './client'

export async function getAll${model.name}s() {
  const res = await api.get('/${slug}')
  return res.data
}

export async function get${model.name}(id: number | string) {
  const res = await api.get(\`/${slug}/\${id}\`)
  return res.data
}

export async function create${model.name}(data: Record<string, unknown>) {
  const res = await api.post('/${slug}', data)
  return res.data
}

export async function update${model.name}(id: number | string, data: Record<string, unknown>) {
  const res = await api.patch(\`/${slug}/\${id}\`, data)
  return res.data
}

export async function delete${model.name}(id: number | string) {
  await api.delete(\`/${slug}/\${id}\`)
}
`,
      })
    }

    // ── Pinia stores ───────────────────────────────────────────────────────────
    for (const model of routable) {
      const mCamel  = camel(model.name)
      const mPlural = plural(mCamel)
      result.files.push({
        outputPath: `src/stores/${mCamel}.ts`,
        content: `import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getAll${model.name}s, get${model.name}, create${model.name}, update${model.name}, delete${model.name} } from '@/api/${mCamel}'

export const use${model.name}Store = defineStore('${mCamel}', () => {
  const ${mPlural} = ref<any[]>([])
  const current = ref<any | null>(null)
  const loading = ref(false)

  async function fetchAll() {
    loading.value = true
    try { ${mPlural}.value = await getAll${model.name}s() }
    finally { loading.value = false }
  }

  async function fetchOne(id: number | string) {
    loading.value = true
    try { current.value = await get${model.name}(id) }
    finally { loading.value = false }
  }

  async function create(data: Record<string, unknown>) {
    const item = await create${model.name}(data)
    ${mPlural}.value.push(item)
    return item
  }

  async function update(id: number | string, data: Record<string, unknown>) {
    const item = await update${model.name}(id, data)
    const idx = ${mPlural}.value.findIndex((i: any) => i.id === id)
    if (idx !== -1) ${mPlural}.value[idx] = item
    return item
  }

  async function remove(id: number | string) {
    await delete${model.name}(id)
    ${mPlural}.value = ${mPlural}.value.filter((i: any) => i.id !== id)
  }

  return { ${mPlural}, current, loading, fetchAll, fetchOne, create, update, remove }
})
`,
      })
    }

    // ── Views ──────────────────────────────────────────────────────────────────
    const homeLinks = routable.map(m =>
      `  { to: '/${plural(kebab(m.name))}', label: '${plural(m.name)}' },`
    ).join('\n')

    result.files.push({
      outputPath: 'src/views/HomeView.vue',
      content: `<template>
  <div>
    <h1>${projectName}</h1>
    <nav>
      <RouterLink v-for="link in links" :key="link.to" :to="link.to">
        {{ link.label }}
      </RouterLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { RouterLink } from 'vue-router'
const links = [
${homeLinks}
]
</script>
`,
    })

    for (const model of routable) {
      const mCamel  = camel(model.name)
      const slug    = plural(kebab(model.name))
      const mPlural = plural(model.name)
      const pStore  = plural(mCamel)

      result.files.push({
        outputPath: `src/views/${model.name}ListView.vue`,
        content: `<template>
  <div>
    <h1>${mPlural}</h1>
    <RouterLink to="/${slug}/new">New ${model.name}</RouterLink>
    <div v-if="store.loading">Loading…</div>
    <ul v-else>
      <li v-for="item in store.${pStore}" :key="item.id">
        <span>{{ item.id }}</span>
        <RouterLink :to="\`/${slug}/\${item.id}/edit\`">Edit</RouterLink>
        <button @click="remove(item.id)">Delete</button>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { use${model.name}Store } from '@/stores/${mCamel}'

const store = use${model.name}Store()
onMounted(() => store.fetchAll())

async function remove(id: number | string) {
  if (confirm('Delete this ${model.name}?')) await store.remove(id)
}
</script>
`,
      })

      const formFields = model.fields.map(f => {
        const fAny = f as any
        return `      <div>\n        <label>${fAny.name}</label>\n        <input v-model="form.${fAny.name}" type="text" />\n      </div>`
      }).join('\n')

      const formInit = model.fields.map(f => {
        const fAny = f as any
        return `    ${fAny.name}: '',`
      }).join('\n')

      result.files.push({
        outputPath: `src/views/${model.name}FormView.vue`,
        content: `<template>
  <div>
    <h1>{{ isEdit ? 'Edit' : 'New' }} ${model.name}</h1>
    <form @submit.prevent="submit">
${formFields}
      <button type="submit">{{ isEdit ? 'Update' : 'Create' }}</button>
      <RouterLink to="/${slug}">Cancel</RouterLink>
    </form>
  </div>
</template>

<script setup lang="ts">
import { reactive, onMounted, computed } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { use${model.name}Store } from '@/stores/${mCamel}'

const route  = useRoute()
const router = useRouter()
const store  = use${model.name}Store()
const isEdit = computed(() => !!route.params.id)

const form = reactive({
${formInit}
})

onMounted(async () => {
  if (isEdit.value) {
    await store.fetchOne(route.params.id as string)
    Object.assign(form, store.current)
  }
})

async function submit() {
  if (isEdit.value) {
    await store.update(route.params.id as string, form)
  } else {
    await store.create(form)
  }
  router.push('/${slug}')
}
</script>
`,
      })
    }

    // ── .env ───────────────────────────────────────────────────────────────────
    result.files.push({ outputPath: '.env.example', content: `VITE_API_URL=${backendUrl}\n` })
    result.files.push({ outputPath: '.env',         content: `VITE_API_URL=${backendUrl}\n` })

    return result
  }
}
