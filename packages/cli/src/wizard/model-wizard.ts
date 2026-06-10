import * as clack from '@clack/prompts'
import pc from 'picocolors'
import { ModelSchema } from '@stack-init/schema'
import type { Model } from '@stack-init/schema'
import { parseFieldsInput, formatParsedFields } from './field-parser'

function checkCancel<T>(value: T | symbol): T {
  if (clack.isCancel(value)) {
    clack.cancel('Opération annulée.')
    process.exit(0)
  }
  return value as T
}

export async function runModelWizard(): Promise<Model[]> {
  const models: Model[] = []

  clack.note(
    [
      pc.bold('Syntaxe des champs :'),
      '  title:string',
      '  body:text:nullable',
      '  slug:string:unique',
      '  role:enum:admin|user|guest',
      '  user_id:foreignId:users',
      '  price:decimal:10:2',
      pc.dim('  Séparateur de champs : virgule (,)'),
      pc.dim('  Valeurs enum/set : pipe (|)'),
    ].join('\n'),
    'Aide — définition de modèles'
  )

  let addAnother = true

  while (addAnother) {
    const modelNum = models.length + 1

    const modelName = checkCancel(await clack.text({
      message: `Modèle ${modelNum} — Nom ${pc.dim('(PascalCase)')}`,
      placeholder: 'Post',
      validate: (v) => {
        if (!v) return 'Le nom est requis.'
        if (!/^[A-Z][a-zA-Z0-9]*$/.test(v)) return 'PascalCase uniquement (ex: BlogPost, User).'
        if (models.find(m => m.name === v)) return `"${v}" existe déjà.`
      },
    }))

    let fieldsRaw = ''
    let parsedFields: ReturnType<typeof parseFieldsInput> = []
    let fieldsConfirmed = false

    while (!fieldsConfirmed) {
      fieldsRaw = checkCancel(await clack.text({
        message: `Champs ${pc.dim('(nom:type, …)')}`,
        placeholder: 'title:string, body:text, published_at:timestamp:nullable',
        validate: (v) => {
          if (!v?.trim()) return 'Définit au moins un champ.'
        },
      }))

      parsedFields = parseFieldsInput(fieldsRaw)

      if (parsedFields.length === 0) continue

      clack.note(
        `    ${formatParsedFields(parsedFields)}`,
        `${parsedFields.length} champ(s) parsé(s)`
      )

      const ok = checkCancel(await clack.confirm({
        message: 'Correct ?',
        initialValue: true,
      }))

      fieldsConfirmed = ok as boolean
    }

    const softDeletes = checkCancel(await clack.confirm({
      message: 'Soft deletes ?',
      initialValue: false,
    }))

    const raw: Record<string, unknown> = {
      name: modelName,
      fields: parsedFields,
      relations: [],
      migration: {
        timestamps: true,
        softDeletes: softDeletes as boolean,
        primary_key: 'id',
      },
      generate: {
        migration: true, controller: true, resource: true, request: true,
        factory: true, tests: true, routes: true, seeder: false,
        policy: false, swagger: false, softDelete: softDeletes as boolean,
        repository: false, service: false, dto: true, module: true, schema: true,
        observer: false, events: false, actions: false, collection: false,
      },
    }

    const parsed = ModelSchema.safeParse(raw)
    if (!parsed.success) {
      const errs = parsed.error.issues.map(i => `  ${pc.red('✗')} [${i.path.join('.')}] ${i.message}`)
      clack.note(errs.join('\n'), pc.red('Erreurs de validation'))
    } else {
      models.push(parsed.data)
      console.log(`  ${pc.green('✓')} Modèle "${pc.bold(modelName)}" ajouté`)
    }

    if (models.length > 0) {
      addAnother = checkCancel(await clack.confirm({
        message: 'Ajouter un autre modèle ?',
        initialValue: false,
      })) as boolean
    }
  }

  return models
}
