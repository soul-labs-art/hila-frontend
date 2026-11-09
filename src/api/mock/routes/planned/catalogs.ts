// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { audit, byName, flagParam, lineage, matches, uuid } from '../../domain'
import { Fail, invalid, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { FieldError } from '../../types'
import { ok, paginate, plain, uid } from '../../util'
import { choice, flag, optional, text, validate } from '../../validate'
import { requireAdmin } from '../../views'
import { slug } from './common'

type Kind = 'skills' | 'resources'
type Entry = Schemas['Skill'] | Schemas['Resource']
const entryRules = () => ({ slug: text(100), name: text(140), category: text(100), active: flag() })
const slugError = (value: string): FieldError[] => slug.test(value) ? [] : [{ field: 'slug', code: 'INVALID_FORMAT', message: 'Usa minúsculas, números y guiones, por ejemplo huertas-urbanas.' }]
const exists = () => new Fail(409, 'CATALOG_ENTRY_EXISTS', 'Ya existe una entrada con ese identificador de texto (slug).')
const publicList = (kind: Kind) => ({ query }: { query: URLSearchParams }) => {
  const q = query.get('q'), category = query.get('category')
  return ok(paginate(byName(db()[kind].filter(item => item.active && matches(item.name, q) && (!category || plain(item.category) === plain(category)))), query))
}
const adminList = (kind: Kind) => ({ query }: { query: URLSearchParams }) => {
  requireAdmin()
  const active = flagParam(query, 'active'), q = query.get('q')
  return ok(paginate(byName(db()[kind].filter(item => (active === null || item.active === active) && matches(item.name, q))), query))
}
function adminCreate(kind: Kind, resourceType: string) {
  return ({ body }: { body: unknown }) => {
    const admin = requireAdmin(), data = validate<Omit<Entry, 'id'>>(body, entryRules()), errors = slugError(data.slug)
    if (errors.length) throw invalid(...errors)
    if (db()[kind].some(item => item.slug === data.slug)) throw exists()
    const entry: Entry = { id: uid(), ...data }
    db()[kind].push(entry); audit(admin.id, `CATALOG_${resourceType}_CREATED`, resourceType, entry.id)
    return ok(entry, 201)
  }
}
function adminReplace(kind: Kind, resourceType: string) {
  return ({ params, body }: { params: Record<string, string>; body: unknown }) => {
    const admin = requireAdmin(), entry = db()[kind].find(item => item.id === uuid(params.entryId))
    if (!entry) throw notFound()
    const data = validate<Omit<Entry, 'id'>>(body, entryRules()), errors = slugError(data.slug)
    if (errors.length) throw invalid(...errors)
    if (db()[kind].some(item => item.id !== entry.id && item.slug === data.slug)) throw exists()
    Object.assign(entry, data); audit(admin.id, `CATALOG_${resourceType}_UPDATED`, resourceType, entry.id)
    return ok(entry)
  }
}

const levels: Record<Schemas['Territory']['type'], number> = { VALLEY: 0, MUNICIPALITY: 1, COMMUNE: 2, NEIGHBORHOOD: 3 }
function territoryData(body: unknown, current?: Schemas['Territory']) {
  const data = validate<Schemas['TerritoryWrite']>(body, { slug: text(100), name: text(140), type: choice(['VALLEY', 'MUNICIPALITY', 'COMMUNE', 'NEIGHBORHOOD']), parentId: optional(36, { format: 'uuid' }), active: flag() })
  const errors = slugError(data.slug), parent = data.parentId ? db().territories.find(item => item.id === data.parentId) : null
  if (data.type === 'VALLEY' && data.parentId) errors.push({ field: 'parentId', code: 'INVALID_REFERENCE', message: 'El valle es el nivel más alto y no tiene territorio padre.' })
  else if (data.type !== 'VALLEY' && !data.parentId) errors.push({ field: 'parentId', code: 'REQUIRED', message: 'Elige el territorio al que pertenece.' })
  else if (data.parentId && !parent) errors.push({ field: 'parentId', code: 'INVALID_REFERENCE', message: 'Elige un territorio de la lista.' })
  else if (parent && levels[parent.type] !== levels[data.type] - 1) errors.push({ field: 'parentId', code: 'INVALID_REFERENCE', message: 'El territorio padre debe ser del nivel inmediatamente superior.' })
  else if (parent && current && lineage(parent.id).includes(current.id)) errors.push({ field: 'parentId', code: 'INVALID_REFERENCE', message: 'Un territorio no puede quedar dentro de sí mismo ni de sus descendientes.' })
  else if (parent && !parent.active && data.active) errors.push({ field: 'parentId', code: 'INACTIVE_REFERENCE', message: 'El territorio padre está inactivo.' })
  if (current && db().territories.some(item => item.parentId === current.id && levels[item.type] !== levels[data.type] + 1)) errors.push({ field: 'type', code: 'INVALID_REFERENCE', message: 'Este territorio tiene hijos que no encajarían con el nuevo nivel.' })
  if (errors.length) throw invalid(...errors)
  return data
}

export const catalogRoutes = [
  route('GET', '/catalogs/skills', publicList('skills')),
  route('GET', '/catalogs/resources', publicList('resources')),
  route('GET', '/admin/catalogs/skills', adminList('skills')),
  route('POST', '/admin/catalogs/skills', adminCreate('skills', 'SKILL')),
  route('PUT', '/admin/catalogs/skills/{entryId}', adminReplace('skills', 'SKILL')),
  route('GET', '/admin/catalogs/resources', adminList('resources')),
  route('POST', '/admin/catalogs/resources', adminCreate('resources', 'RESOURCE')),
  route('PUT', '/admin/catalogs/resources/{entryId}', adminReplace('resources', 'RESOURCE')),
  route('GET', '/admin/catalogs/territories', ({ query }) => {
    requireAdmin()
    const active = flagParam(query, 'active'), q = query.get('q')
    return ok(paginate(byName(db().territories.filter(item => (active === null || item.active === active) && matches(item.name, q))), query) satisfies Schemas['TerritoryPage'])
  }),
  route('POST', '/admin/catalogs/territories', ({ body }) => {
    const admin = requireAdmin(), data = territoryData(body)
    if (db().territories.some(item => item.slug === data.slug)) throw exists()
    const entry: Schemas['Territory'] = { id: uid(), ...data }
    db().territories.push(entry); audit(admin.id, 'CATALOG_TERRITORY_CREATED', 'TERRITORY', entry.id)
    return ok(entry, 201)
  }),
  route('PUT', '/admin/catalogs/territories/{entryId}', ({ params, body }) => {
    const admin = requireAdmin(), entry = db().territories.find(item => item.id === uuid(params.entryId))
    if (!entry) throw notFound()
    const data = territoryData(body, entry)
    if (db().territories.some(item => item.id !== entry.id && item.slug === data.slug)) throw exists()
    Object.assign(entry, data); audit(admin.id, 'CATALOG_TERRITORY_UPDATED', 'TERRITORY', entry.id)
    return ok(entry)
  }),
]
