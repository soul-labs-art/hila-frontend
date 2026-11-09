import { seedState } from './seed'
import { plannedSeed } from './seed-planned'
import type { State } from './types'

const KEY = 'hila-mock'
let state: State | undefined
const fresh = () => plannedSeed(seedState())
type Stored = Omit<Partial<State>, 'version'> & { version: 1 | 2 }
function valid(value: unknown): value is Stored {
  return typeof value === 'object' && value !== null && ((value as Stored).version === 1 || (value as Stored).version === 2) && ['accounts', 'organizations', 'memberships', 'verifications', 'tokens'].every(key => Array.isArray((value as unknown as Record<string, unknown>)[key]))
}
// Un estado guardado por una versión anterior se conserva y se completa con los valores por defecto de lo nuevo (colecciones planned, cuentas y organizaciones semilla).
function migrate(stored: Stored): State {
  const base = fresh(), state = { ...base, ...stored, version: 2 } as State
  if (stored.version !== 1) return state
  for (const seed of base.accounts) {
    const own = state.accounts.find(item => item.id === seed.id)
    if (!own) state.accounts.push(seed)
    else { own.status ??= seed.status; own.capacities ??= seed.capacities }
  }
  for (const seed of base.organizations) if (!state.organizations.some(item => item.id === seed.id)) state.organizations.push(seed)
  for (const seed of base.verifications) if (!state.verifications.some(item => item.id === seed.id)) state.verifications.push(seed)
  for (const seed of base.memberships) if (!state.memberships.some(item => item.organizationId === seed.organizationId && item.userId === seed.userId)) state.memberships.push(seed)
  return state
}
function load(): State {
  try { const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null'); return valid(parsed) ? migrate(parsed) : fresh() }
  catch { return fresh() }
}
export const db = () => state ??= load()
export function persist() {
  if (!state) return
  try { localStorage.setItem(KEY, JSON.stringify(state)) }
  catch {
    try { localStorage.setItem(KEY, JSON.stringify(state, (key, value: unknown) => key === 'avatar' || key === 'cover' || key === 'dataUrl' ? null : value)) }
    catch { /* sin almacenamiento: el estado sigue en memoria */ }
  }
}
export function resetMock() {
  state = fresh()
  try { localStorage.removeItem(KEY) } catch { /* sin almacenamiento */ }
  persist()
}
