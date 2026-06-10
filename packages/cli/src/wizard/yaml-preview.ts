import yaml from 'js-yaml'
import pc from 'picocolors'

export function buildYamlPreview(raw: object, maxLines = 18): string {
  const full = yaml.dump(raw, { lineWidth: 60, noRefs: true })
  const lines = full.split('\n')
  const shown = lines.slice(0, maxLines)
  if (lines.length > maxLines) {
    shown.push(pc.dim(`  … +${lines.length - maxLines} lignes (voir le fichier complet)`))
  }
  return shown.join('\n')
}
