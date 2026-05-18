import { z } from 'zod'

export const BackendArchitectureSchema = z.enum([
  'mvc',           // controllers + models + routes séparés
  'layered',       // routes → services → repositories → models
  'feature-based', // src/features/users/, src/features/posts/...
  'minimal',       // tout dans un seul niveau
]);

export const FrontendArchitectureSchema = z.enum([
  'feature-first',
  'domain-driven',
  'mvvm',
  'mvc',
  'atomic-design',
  'minimal',
]);

export type BackendArchitecture = z.infer<typeof BackendArchitectureSchema>;
export type FrontendArchitecture = z.infer<typeof FrontendArchitectureSchema>;
