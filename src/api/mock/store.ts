import { seedState } from './seed'
import type { State } from './types'

const KEY = 'hila-mock'
let state: State | undefined
function valid(value: unknown): value is State {
  return typeof value === 'object' && value !== null && (value as State).version === 1 && ['accounts', 'organizations', 'memberships', 'verifications', 'tokens'].every(key => Array.isArray((value as unknown as Record<string, unknown>)[key]))
}
function load(): State {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return valid(parsed) ? parsed : seedState() }
  catch { return seedState() }
}
export const db = () => state ??= load()
export function persist() {
  if (!state) return
  try { localStorage.setItem(KEY, JSON.stringify(state)) }
  catch {
    try { localStorage.setItem(KEY, JSON.stringify(state, (key, value: unknown) => key === 'avatar' || key === 'cover' ? null : value)) }
    catch { /* sin almacenamiento: el estado sigue en memoria */ }
  }
}
export function resetMock() {
  state = seedState()
  try { localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
  persist()
}
