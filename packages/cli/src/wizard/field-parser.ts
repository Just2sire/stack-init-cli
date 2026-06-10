export interface ParsedField {
  name: string
  type: string
  nullable?: boolean
  unique?: boolean
  index?: boolean
  unsigned?: boolean
  values?: string[]
  references?: string
  precision?: number
  scale?: number
  [key: string]: unknown
}

// Syntaxe : title:string, body:text:nullable, role:enum:admin|user, user_id:foreignId:users, price:decimal:10:2
// Les champs sont séparés par des virgules ; les valeurs enum/set par des pipes (|)
export function parseFieldsInput(input: string): ParsedField[] {
  return input
    .split(',')
    .map(t => t.trim())
    .filter(Boolean)
    .map(parseOneField)
}

export function parseOneField(token: string): ParsedField {
  const parts = token.trim().split(':')
  const name = (parts[0] ?? '').trim()
  const type = (parts[1] ?? 'string').trim()
  const rest = parts.slice(2)

  const field: ParsedField = { name, type }

  for (const mod of rest) {
    const m = mod.trim()
    if (m === 'nullable') { field.nullable = true; continue }
    if (m === 'unique')   { field.unique = true;   continue }
    if (m === 'index')    { field.index = true;    continue }
    if (m === 'unsigned') { field.unsigned = true; continue }

    if (type === 'enum' || type === 'set') {
      field.values = m.split('|').map(v => v.trim()).filter(Boolean)
      continue
    }
    if (type === 'foreignId' || type === 'foreignUuid' || type === 'foreignUlid') {
      if (field.references === undefined) { field.references = m; continue }
    }
    if (type === 'decimal' || type === 'float' || type === 'double') {
      const n = parseInt(m, 10)
      if (!isNaN(n)) {
        if (field.precision === undefined) { field.precision = n; continue }
        if (field.scale === undefined)     { field.scale = n;     continue }
      }
    }
  }

  if ((type === 'enum' || type === 'set') && !field.values) field.values = []

  return field
}

export function formatParsedFields(fields: ParsedField[]): string {
  return fields.map(f => {
    const parts = [`${pc(f.name)}:${f.type}`]
    if (f.nullable) parts.push('nullable')
    if (f.unique)   parts.push('unique')
    if ((f.type === 'enum' || f.type === 'set') && Array.isArray(f.values) && f.values.length > 0) {
      parts.push(`[${(f.values as string[]).join(', ')}]`)
    }
    if ((f.type === 'foreignId' || f.type === 'foreignUuid' || f.type === 'foreignUlid') && f.references) {
      parts.push(`→ ${f.references}`)
    }
    return parts.join(' ')
  }).join('\n    ')
}

function pc(s: string): string { return s }
