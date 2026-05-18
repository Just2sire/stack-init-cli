import { Command } from 'commander'
import { runGenerate } from './commands/generate'
import { runAdd } from './commands/add'
import { runRollback } from './commands/rollback'

const program = new Command()

program
  .name('stack-init')
  .description('Génère modèles, migrations et fichiers Laravel depuis stack-init.yaml')
  .version('0.1.0')

program
  .command('generate')
  .description('Génère tous les fichiers selon stack-init.yaml')
  .option('-c, --config <path>', 'Chemin vers stack-init.yaml', 'stack-init.yaml')
  .option('-o, --output <path>', 'Racine du projet cible',      '.')
  .option('--dry-run',           'Affiche les fichiers sans écrire', false)
  .action(async (opts) => {
    await runGenerate({ config: opts.config, output: opts.output, dryRun: opts.dryRun })
  })

program
  .command('add <modelName>')
  .description('Ajoute un nouveau modèle au projet')
  .option('-f, --fields <string>', 'Champs du modèle (ex: "title:string,body:text")')
  .option('-c, --config <path>',   'Chemin vers stack-init.yaml', 'stack-init.yaml')
  .option('-o, --output <path>',   'Racine du projet cible',      '.')
  .option('--dry-run',             'Affiche les fichiers sans écrire', false)
  .action(async (modelName, opts) => {
    await runAdd({
      modelName,
      fields: opts.fields,
      config: opts.config,
      output: opts.output,
      dryRun: opts.dryRun
    })
  })

program
  .command('rollback')
  .description('Supprime les fichiers générés lors de la dernière exécution')
  .option('-o, --output <path>', 'Racine du projet cible', '.')
  .action(async (opts) => {
    await runRollback({ output: opts.output })
  })

program.parse()
