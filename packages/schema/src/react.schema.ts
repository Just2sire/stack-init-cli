import { z } from 'zod'

export const ReactPageOptionsSchema = z.object({
  list:   z.boolean().default(true),
  detail: z.boolean().default(true),
  create: z.boolean().default(true),
  edit:   z.boolean().default(true),
})
export type ReactPageOptions = z.infer<typeof ReactPageOptionsSchema>

export const ReactModelPagesSchema = z.record(z.string(), ReactPageOptionsSchema)

export const ReactOptionsSchema = z.object({
  architecture:  z.enum(['feature-based', 'layer-based', 'minimal']).default('feature-based'),
  state_lib:     z.enum(['zustand', 'redux-toolkit', 'jotai', 'none']).default('zustand'),
  form_lib:      z.enum(['react-hook-form', 'formik', 'zod', 'none']).default('react-hook-form'),
  ui_lib:        z.enum(['shadcn', 'mui', 'antd', 'chakra', 'none']).default('shadcn'),
  http_lib:      z.enum(['axios', 'ky', 'fetch']).default('axios'),
  data_fetching: z.enum(['tanstack-query', 'swr', 'none']).default('tanstack-query'),
  router:        z.enum(['react-router-v6', 'tanstack-router', 'none']).default('react-router-v6'),
  css:           z.enum(['tailwind', 'css-modules', 'styled-components', 'none']).default('tailwind'),
  typescript:    z.boolean().default(true),
  bundler:       z.enum(['vite', 'next', 'create-react-app']).default('vite'),
  testing:       z.enum(['vitest', 'jest', 'none']).default('vitest'),
  pages:         ReactModelPagesSchema.default({}),
})
export type ReactOptions = z.infer<typeof ReactOptionsSchema>
