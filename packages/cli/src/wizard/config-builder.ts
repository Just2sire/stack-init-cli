import { parseProjectConfig } from '@stack-init/schema'
import type { Model, ServiceId } from '@stack-init/schema'
import type { Preset } from './presets'

export interface WizardAnswers {
  name: string
  preset: Preset
  models: Model[]
  services: ServiceId[]
}

export function buildRawConfig(answers: WizardAnswers): Record<string, unknown> {
  const { name, preset, models, services } = answers
  const raw: Record<string, unknown> = {
    name: name.toLowerCase().replace(/\s+/g, '-'),
    version: '0.1.0',
    stack: preset.stack,
    models,
    generated_at: new Date().toISOString(),
  }
  if (services.length > 0) raw.services = services
  if (preset.express)  raw.express  = preset.express
  if (preset.react)    raw.react    = preset.react
  if (preset.laravel)  raw.laravel  = preset.laravel
  if (preset.nestjs)   raw.nestjs   = preset.nestjs
  if (preset.fastapi)  raw.fastapi  = preset.fastapi
  return raw
}

export function buildConfig(answers: WizardAnswers): ReturnType<typeof parseProjectConfig> {
  return parseProjectConfig(buildRawConfig(answers))
}
