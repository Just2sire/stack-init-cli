import pc from 'picocolors'
import { runGenerate } from './generate'

export interface DiffOptions {
  config: string
  output: string
}

export async function runDiff(opts: DiffOptions): Promise<void> {
  console.log(pc.cyan('\n  stack-init diff — fichiers qui seraient générés\n'))
  console.log(pc.dim('  (Aucun fichier ne sera écrit)\n'))
  await runGenerate({ config: opts.config, output: opts.output, dryRun: true, force: false })
}
