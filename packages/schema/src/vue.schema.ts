import { z } from 'zod'

export const VueOptionsSchema = z.object({
  ui_lib:    z.enum(['none', 'vuetify', 'primevue']).default('none'),
  state_lib: z.enum(['pinia', 'vuex', 'none']).default('pinia'),
  router:    z.enum(['vue-router', 'none']).default('vue-router'),
  css:       z.enum(['tailwind', 'css-modules', 'none']).default('none'),
})
export type VueOptions = z.infer<typeof VueOptionsSchema>
