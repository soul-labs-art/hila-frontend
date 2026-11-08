import { Fail, invalid } from './errors'
import type { FieldError } from './types'

type Rule = { type: 'string' | 'boolean' | 'enum'; nullable?: boolean; min?: number; max?: number; format?: 'email' | 'uri' | 'uuid'; values?: readonly string[]; raw?: boolean; mustBeTrue?: boolean }
export const text = (max: number, extra: Partial<Rule> = {}): Rule => ({ type: 'string', min: 1, max, ...extra })
export const optional = (max: number, extra: Partial<Rule> = {}): Rule => ({ type: 'string', nullable: true, max, ...extra })
export const choice = (values: readonly string[], nullable = false): Rule => ({ type: 'enum', values, nullable })
export const flag = (mustBeTrue = false): Rule => ({ type: 'boolean', mustBeTrue })
const formats = {
  email: { test: (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value), message: 'Escribe un correo válido.' },
  uuid: { test: (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value), message: 'El identificador no es válido.' },
  uri: { test: (value: string) => { try { return ['http:', 'https:'].includes(new URL(value).protocol) } catch { return false } }, message: 'Escribe una dirección web completa, con http:// o https://.' },
}
const malformed = () => new Fail(400, 'MALFORMED_REQUEST', 'La solicitud no tiene un formato válido.')

export function validate<T>(body: unknown, rules: Record<string, Rule>): T {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) throw malformed()
  const source = body as Record<string, unknown>, result: Record<string, unknown> = {}, errors: FieldError[] = []
  if (Object.keys(source).some(key => !(key in rules))) throw malformed()
  for (const [field, rule] of Object.entries(rules)) {
    let value = source[field]
    if (value === undefined || (value === null && !rule.nullable)) { errors.push({ field, code: 'REQUIRED', message: 'Este campo es obligatorio.' }); continue }
    if (value === null) { result[field] = null; continue }
    if (rule.type === 'boolean') {
      if (typeof value !== 'boolean') throw malformed()
      if (rule.mustBeTrue && !value) errors.push({ field, code: 'MUST_BE_TRUE', message: 'Debes confirmar este dato para continuar.' })
    } else {
      if (typeof value !== 'string') throw malformed()
      if (!rule.raw) value = value.trim()
      if (rule.nullable && value === '') { result[field] = null; continue }
      const size = (value as string).length
      if (rule.type === 'enum' && !rule.values!.includes(value as string)) errors.push({ field, code: 'INVALID_FORMAT', message: 'Elige una opción válida.' })
      else if (size < (rule.min ?? 0)) errors.push({ field, code: size ? 'OUT_OF_RANGE' : 'REQUIRED', message: size ? `Usa al menos ${rule.min} caracteres.` : 'Este campo es obligatorio.' })
      else if (rule.max !== undefined && size > rule.max) errors.push({ field, code: 'TOO_LONG', message: `Usa máximo ${rule.max} caracteres.` })
      else if (rule.format && !formats[rule.format].test(value as string)) errors.push({ field, code: 'INVALID_FORMAT', message: formats[rule.format].message })
    }
    result[field] = value
  }
  if (errors.length) throw invalid(...errors)
  return result as T
}
