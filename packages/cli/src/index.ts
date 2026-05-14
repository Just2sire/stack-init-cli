#!/usr/bin/env node
import { Command } from 'commander'
import { runGenerate } from './commands/generate'

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

program.parse()
