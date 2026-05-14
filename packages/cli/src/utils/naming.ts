export function pascalCase(str: string): string {
  return str.replace(/[-_](.)/g, (_, c) => c.toUpperCase()).replace(/^(.)/, c => c.toUpperCase())
}
export function camelCase(str: string): string {
  const p = pascalCase(str)
  return p.charAt(0).toLowerCase() + p.slice(1)
}
export function snakeCase(str: string): string {
  return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '')
}
export function kebabCase(str: string): string {
  return snakeCase(str).replace(/_/g, '-')
}
export function pluralize(str: string): string {
  if (str.endsWith('y') && !/[aeiou]y$/i.test(str)) return str.slice(0, -1) + 'ies'
  if (/(s|x|z|ch|sh)$/.test(str)) return str + 'es'
  return str + 's'
}
export function modelToTableName(name: string): string { return pluralize(snakeCase(name)) }
export function modelToRouteName(name: string): string { return pluralize(kebabCase(name)) }
export function modelToVarName(name: string): string   { return camelCase(name) }

export function migrationTimestamp(offsetSeconds = 0): string {
  const d = new Date(Date.now() + offsetSeconds * 1000)
  const p = (n: number, l = 2) => String(n).padStart(l, '0')
  return `${d.getFullYear()}_${p(d.getMonth()+1)}_${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
}
