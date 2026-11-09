import type { Schemas } from '../client'
import { Fail } from './errors'
import type { Result } from './types'

export const now = () => new Date().toISOString()
export const uid = () => crypto.randomUUID()
export const ok = (body: unknown, status = 200): Result => ({ status, body })
export const noContent = (): Result => ({ status: 204 })
export const message = (text: string): Schemas['Message'] => ({ message: text })
export const sortNewest = <T extends { createdAt: string }>(items: T[]) => [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
export function integer(query: URLSearchParams, name: string, fallback: number, min: number, max: number) {
  const raw = query.get(name)
  if (raw === null) return fallback
  const value = Number(raw)
  if (!Number.isInteger(value) || value < min || value > max) throw new Fail(400, 'MALFORMED_REQUEST', `El parámetro «${name}» no es válido.`)
  return value
}
export function paginate<T>(items: T[], query: URLSearchParams) {
  const page = integer(query, 'page', 0, 0, 1_000_000), size = integer(query, 'size', 20, 1, 100)
  return { items: items.slice(page * size, page * size + size), page, size, totalElements: items.length, totalPages: Math.ceil(items.length / size) }
}
export const plain = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
