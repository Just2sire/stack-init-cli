import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'
import * as clack from '@clack/prompts'
import yaml from 'js-yaml'
import pc from 'picocolors'
import type { ServiceId } from '@stack-init/schema'
import { PRESETS, PRESET_KEYS, type PresetKey, type Preset } from '../wizard/presets'
import { runModelWizard } from '../wizard/model-wizard'
import { runCustomWizard, BACKEND_STACKS, FRONTEND_STACKS } from '../wizard/framework-questions'
import { buildConfig, buildRawConfig } from '../wizard/config-builder'
import { buildYamlPreview } from '../wizard/yaml-preview'
import { generateFromConfig } from './generate'

export interface InitOptions {
  output?:   string
  name?:     string   // argument positionnel
  preset?:   string   // clé de PRESETS ou 'custom'
  stack?:    string   // stack brut (mode custom sans wizard)
  yes?:      boolean  // skip tous les prompts, utiliser les défauts
  generate?: boolean  // false → forcer yaml-only (via --no-generate)
}

function checkCancel<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel('Opération annulée.')
    process.exit(0)
  }
  return value as T
}

function resolveStack(backend: string, frontend: string): string {
  if (backend === 'none' && frontend === 'none') return 'react' // fallback
  if (backend === 'none') return frontend
  if (frontend === 'none') return backend
  if (backend === 'express' && frontend === 'react') return 'express+react'
  if (backend === 'nestjs'  && frontend === 'react') return 'nestjs+react'
  if (backend === 'fastapi' && frontend === 'react') return 'fastapi+react'
  if (backend === 'fastapi' && frontend === 'nextjs') return 'fastapi+nextjs'
  if (backend === 'laravel' && frontend === 'react') return 'laravel+react'
  if (backend === 'laravel' && frontend === 'nextjs') return 'laravel+nextjs'
  return backend
}

export async function runInit(opts: InitOptions): Promise<void> {
  const nonInteractive = opts.yes ?? false

  clack.intro(
    `${pc.bgCyan(pc.black(' stack-init '))}  ` +
    (nonInteractive ? pc.dim('Nouveau projet — mode non-interactif') : pc.dim('Nouveau projet — wizard interactif'))
  )

  // ── Nom du projet ──────────────────────────────────────────────────────────
  let projectName: string
  if (opts.name) {
    projectName = opts.name
    console.log(`  ${pc.green('✓')} Nom du projet : ${pc.bold(projectName)}`)
  } else if (nonInteractive) {
    projectName = 'my-app'
    console.log(`  ${pc.dim('→')} Nom du projet par défaut : ${pc.bold(projectName)}`)
  } else {
    projectName = checkCancel(await clack.text({
      message: 'Nom du projet',
      placeholder: 'my-app',
      validate: (v) => {
        if (!v?.trim()) return 'Le nom est requis.'
        if (!/^[a-z][a-z0-9_-]*$/.test(v.trim())) {
          return 'kebab-case uniquement (ex: my-app, blog_api).'
        }
      },
    })) as string
  }

  // ── Choix preset ou custom ─────────────────────────────────────────────────
  // --stack sans --preset → construire un preset Custom minimal
  if (opts.stack && !opts.preset) {
    opts.preset = 'custom'
  }

  let preset: Preset | null = null

  if (opts.preset && opts.preset !== 'custom') {
    const key = opts.preset as PresetKey
    if (!PRESETS[key]) {
      clack.cancel(`Preset inconnu : "${opts.preset}". Valeurs valides : ${PRESET_KEYS.join(', ')}`)
      process.exit(1)
    }
    preset = PRESETS[key]
    console.log(`  ${pc.green('✓')} Preset : ${pc.bold(preset.label)}`)
  } else if (opts.preset === 'custom' || opts.stack) {
    // Custom via --stack flag (no interactive wizard when --yes)
    const stack = opts.stack ?? 'express'
    if (nonInteractive) {
      preset = { label: 'Custom', hint: stack, stack, ...{} }
      console.log(`  ${pc.dim('→')} Stack par défaut : ${pc.bold(stack)}`)
    } else {
      const customPartial = await runCustomWizard(stack)
      preset = { label: 'Custom', hint: stack, stack, ...customPartial }
    }
  } else if (nonInteractive) {
    // --yes without --preset → use first preset (pern)
    preset = PRESETS[PRESET_KEYS[0]]
    console.log(`  ${pc.dim('→')} Preset par défaut : ${pc.bold(preset.label)}`)
  } else {
    // Full interactive
    const startingPoint = checkCancel(await clack.select({
      message: 'Point de départ',
      options: [
        ...PRESET_KEYS.map(k => ({
          value: k as string,
          label: PRESETS[k].label,
          hint:  PRESETS[k].hint,
        })),
        { value: 'custom', label: 'Custom…', hint: 'Configurer chaque option manuellement' },
      ],
    })) as string

    if (startingPoint === 'custom') {
      const backend = checkCancel(await clack.select({
        message: 'Backend',
        options: [...BACKEND_STACKS],
      })) as string

      const frontend = checkCancel(await clack.select({
        message: 'Frontend',
        options: [...FRONTEND_STACKS],
      })) as string

      const stack = resolveStack(backend, frontend)
      const customPartial = await runCustomWizard(stack)
      preset = { label: 'Custom', hint: stack, stack, ...customPartial }
    } else {
      preset = PRESETS[startingPoint as PresetKey]
    }
  }

  // ── Modèles ────────────────────────────────────────────────────────────────
  const models = nonInteractive ? [] : await runModelWizard()
  if (nonInteractive) console.log(`  ${pc.dim('→')} Modèles : aucun (ajoutez-en avec ${pc.cyan('stack-init add')})`)

  // ── Services optionnels ────────────────────────────────────────────────────
  let services: ServiceId[] = []
  if (!nonInteractive) {
    services = checkCancel(await clack.multiselect({
      message: 'Services optionnels',
      options: [
        { value: 'auth',        label: 'Auth',        hint: 'JWT / sessions' },
        { value: 'email',       label: 'Email',       hint: 'Nodemailer / SMTP' },
        { value: 'cache',       label: 'Cache',       hint: 'Redis' },
        { value: 'queue',       label: 'Queue',       hint: 'Bull / Celery' },
        { value: 'file-upload', label: 'File upload', hint: 'S3 / local disk' },
        { value: 'websockets',  label: 'WebSockets',  hint: 'Socket.io / WS' },
      ],
      required: false,
    })) as ServiceId[]
  }

  // ── Répertoire de sortie ───────────────────────────────────────────────────
  const defaultOutput = opts.output ?? `./${projectName}`
  let outputDir: string
  if (opts.output || nonInteractive) {
    outputDir = defaultOutput
    if (nonInteractive && !opts.output) {
      console.log(`  ${pc.dim('→')} Répertoire de sortie par défaut : ${pc.bold(outputDir)}`)
    }
  } else {
    outputDir = checkCancel(await clack.text({
      message: 'Répertoire de sortie',
      initialValue: defaultOutput,
      validate: (v) => { if (!v?.trim()) return 'Requis.' },
    })) as string
  }

  // ── Assemblage et validation ───────────────────────────────────────────────
  const answers = { name: projectName, preset: preset!, models, services }
  const rawConfig = buildRawConfig(answers)
  const parsed = buildConfig(answers)

  if (!parsed.success) {
    clack.note(
      parsed.errors.map(e => `  ${pc.red('✗')} ${e}`).join('\n'),
      pc.red('Erreurs de configuration')
    )
    clack.cancel('Impossible de continuer — corrigez les erreurs ci-dessus.')
    process.exit(1)
  }

  // ── Aperçu YAML ───────────────────────────────────────────────────────────
  clack.note(buildYamlPreview(rawConfig), 'Aperçu stack-init.yaml')

  // ── Action ────────────────────────────────────────────────────────────────
  // --no-generate forces yaml-only; --yes defaults to generate
  let action: string
  if (opts.generate === false) {
    action = 'yaml-only'
    console.log(`  ${pc.dim('→')} Action : sauvegarder YAML seulement (--no-generate)`)
  } else if (nonInteractive) {
    action = 'generate'
    console.log(`  ${pc.dim('→')} Action : générer le projet`)
  } else {
    action = checkCancel(await clack.select({
      message: 'Que faire ensuite ?',
      options: [
        { value: 'generate',     label: 'Sauvegarder YAML + générer le projet',       hint: 'recommandé' },
        { value: 'yaml-only',    label: 'Sauvegarder stack-init.yaml seulement',       hint: 'générer plus tard avec stack-init generate' },
        { value: 'open-and-gen', label: 'Sauvegarder YAML + ouvrir dans VS Code',      hint: 'puis générer manuellement' },
        { value: 'dry-run',      label: 'Dry-run (aperçu des fichiers sans écriture)', hint: '' },
      ],
    })) as string
  }

  // ── Écriture du YAML ──────────────────────────────────────────────────────
  const resolvedOutput = path.resolve(outputDir)
  fs.mkdirSync(resolvedOutput, { recursive: true })

  const yamlContent = yaml.dump(rawConfig, { noRefs: true })
  const yamlPath = path.join(resolvedOutput, 'stack-init.yaml')
  fs.writeFileSync(yamlPath, yamlContent, 'utf-8')
  console.log(`\n  ${pc.green('✓')} ${pc.bold('stack-init.yaml')} → ${pc.dim(yamlPath)}`)

  if (action === 'open-and-gen') {
    try { execSync(`code "${yamlPath}"`, { stdio: 'ignore' }) } catch {}
    clack.outro(
      `${pc.green('✓')} YAML sauvegardé.\n` +
      `  Lancez ${pc.cyan('stack-init generate')} dans ${pc.bold(outputDir)} pour générer le projet.`
    )
    return
  }

  if (action === 'yaml-only') {
    clack.outro(
      `${pc.green('✓')} stack-init.yaml sauvegardé.\n` +
      `  Lancez ${pc.cyan('stack-init generate')} dans ${pc.bold(outputDir)} pour générer le projet.`
    )
    return
  }

  // ── Génération ─────────────────────────────────────────────────────────────
  const isDryRun = action === 'dry-run'
  console.log('')
  await generateFromConfig(parsed.data, {
    output: resolvedOutput,
    dryRun: isDryRun,
    force: false,
  })

  if (!isDryRun) {
    clack.outro(
      `${pc.green('✓')} Projet généré dans ${pc.bold(outputDir)}\n\n` +
      `  Prochaines étapes :\n` +
      `    ${pc.cyan('1.')} cd ${outputDir}\n` +
      `    ${pc.cyan('2.')} bash setup.sh  ${pc.dim('(ou setup.ps1 sur Windows)')}\n` +
      `    ${pc.cyan('3.')} Configurer ${pc.bold('.env')}\n` +
      `    ${pc.cyan('4.')} npm run dev`
    )
  } else {
    clack.outro(`${pc.green('✓')} Dry-run terminé — aucun fichier écrit.`)
  }
}
