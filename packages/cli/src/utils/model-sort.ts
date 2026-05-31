import type { Model } from '@stack-init/schema'

/**
 * Topological sort of models so that FK dependencies are always generated
 * before the models that reference them (migrations, schema files, seeders).
 *
 * Dependencies are detected from:
 *   - fields of type `foreignId` whose `references` matches another model's table
 *   - relations of type `belongsTo` whose `model` matches another model's name
 *
 * Falls back to the original YAML order on circular dependency.
 */
export function sortModelsByDependency(models: Model[]): Model[] {
  if (models.length <= 1) return models

  const byName  = new Map<string, Model>(models.map(m => [m.name,  m]))
  const byTable = new Map<string, Model>(models.map(m => [m.table, m]))

  // deps[A] = set of model names that A depends on (must be generated before A)
  const deps = new Map<string, Set<string>>(models.map(m => [m.name, new Set()]))

  for (const m of models) {
    for (const f of (m.fields ?? []) as any[]) {
      if (f.type === 'foreignId' && f.references) {
        const ref = byTable.get(f.references)
        if (ref && ref.name !== m.name) deps.get(m.name)!.add(ref.name)
      }
    }
    for (const rel of m.relations ?? []) {
      if (rel.type === 'belongsTo' && byName.has(rel.model) && rel.model !== m.name) {
        deps.get(m.name)!.add(rel.model)
      }
    }
  }

  // Kahn's algorithm
  const inDegree = new Map<string, number>(models.map(m => [m.name, 0]))
  const revDeps  = new Map<string, string[]>(models.map(m => [m.name, []]))
  for (const [name, depSet] of deps) {
    for (const dep of depSet) {
      inDegree.set(name, (inDegree.get(name) ?? 0) + 1)
      revDeps.get(dep)!.push(name)
    }
  }

  const queue = models.filter(m => inDegree.get(m.name) === 0).map(m => m.name)
  const sorted: Model[] = []
  while (queue.length > 0) {
    const name = queue.shift()!
    sorted.push(byName.get(name)!)
    for (const dep of revDeps.get(name) ?? []) {
      const d = (inDegree.get(dep) ?? 1) - 1
      inDegree.set(dep, d)
      if (d === 0) queue.push(dep)
    }
  }

  // Cycle detected — fall back to original YAML order
  return sorted.length === models.length ? sorted : models
}
