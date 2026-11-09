// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { areasOf, availabilityOf, capacitiesOf, catalogErrors, resourcesOf, skillsOf } from '../../domain'
import { Fail, invalid } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { FieldError } from '../../types'
import { ok } from '../../util'
import { choice, list, optional, text, validate, whole } from '../../validate'
import { requireProfile, requireUser } from '../../views'
import { clockPattern, proficiencies, rows } from './common'

/** Las capacidades exigen sesión y perfil voluntario (404 PROFILE_NOT_FOUND si no existe). */
function owner() { const account = requireUser(); requireProfile(account); return account }
const minutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const throwIfAny = (errors: FieldError[]) => { if (errors.length) throw invalid(...errors) }

export const volunteerCapacityRoutes = [
  route('GET', '/me/skills', () => ok(skillsOf(owner()) satisfies Schemas['VolunteerSkill'][])),
  route('PUT', '/me/skills', ({ body }) => {
    const account = owner(), caps = capacitiesOf(account)
    const items = rows<Schemas['VolunteerSkillInput']>(validate<{ items: unknown[] }>(body, { items: list(100) }).items, 'items', { skillId: text(36, { format: 'uuid' }), proficiency: choice(proficiencies, true), yearsExperience: whole(0, 100, true) })
    throwIfAny(catalogErrors(db().skills, items.map(item => item.skillId), index => `items[${index}].skillId`, caps.skills.map(item => item.skillId)))
    caps.skills = items
    return ok(skillsOf(account) satisfies Schemas['VolunteerSkill'][])
  }),
  route('GET', '/me/availability', () => ok(availabilityOf(owner()) satisfies Schemas['Availability'])),
  route('PUT', '/me/availability', ({ body }) => {
    const account = owner(), data = validate<{ timezone: 'America/Bogota'; items: unknown[] }>(body, { timezone: choice(['America/Bogota']), items: list(100) })
    const items = rows<Schemas['AvailabilitySlot']>(data.items, 'items', { weekday: whole(1, 7), startsAt: text(5), endsAt: text(5) })
    const errors: FieldError[] = []
    items.forEach((item, index) => {
      for (const key of ['startsAt', 'endsAt'] as const) if (!clockPattern.test(item[key])) errors.push({ field: `items[${index}].${key}`, code: 'INVALID_FORMAT', message: 'Usa el formato HH:mm, por ejemplo 08:30.' })
    })
    throwIfAny(errors)
    items.forEach((item, index) => {
      if (minutes(item.endsAt) <= minutes(item.startsAt)) errors.push({ field: `items[${index}].endsAt`, code: 'OUT_OF_RANGE', message: 'La hora final debe ser posterior a la inicial. Divide los tramos nocturnos entre dos días.' })
      else if (items.some((other, at) => at < index && other.weekday === item.weekday && minutes(other.startsAt) < minutes(item.endsAt) && minutes(item.startsAt) < minutes(other.endsAt))) errors.push({ field: `items[${index}]`, code: 'OVERLAPPING', message: 'Este tramo se solapa con otro del mismo día.' })
    })
    throwIfAny(errors)
    capacitiesOf(account).availability = items
    return ok(availabilityOf(account) satisfies Schemas['Availability'])
  }),
  route('GET', '/me/service-areas', () => ok(areasOf(owner()) satisfies Schemas['Territory'][])),
  route('PUT', '/me/service-areas', ({ body }) => {
    const account = owner(), caps = capacitiesOf(account), values = validate<{ territoryIds: unknown[] }>(body, { territoryIds: list(100) }).territoryIds
    if (values.some(value => typeof value !== 'string')) throw new Fail(400, 'MALFORMED_REQUEST', 'La solicitud no tiene un formato válido.')
    const ids = values as string[], format = ids.flatMap((id, index): FieldError[] => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ? [] : [{ field: `territoryIds[${index}]`, code: 'INVALID_FORMAT', message: 'El identificador no es válido.' }])
    throwIfAny(format)
    throwIfAny(catalogErrors(db().territories, ids, index => `territoryIds[${index}]`, caps.serviceAreas))
    caps.serviceAreas = ids
    return ok(areasOf(account) satisfies Schemas['Territory'][])
  }),
  route('GET', '/me/resources', () => ok(resourcesOf(owner()) satisfies Schemas['VolunteerResource'][])),
  route('PUT', '/me/resources', ({ body }) => {
    const account = owner(), caps = capacitiesOf(account)
    const items = rows<Schemas['VolunteerResourceInput']>(validate<{ items: unknown[] }>(body, { items: list(100) }).items, 'items', { resourceId: text(36, { format: 'uuid' }), details: optional(280) })
    throwIfAny(catalogErrors(db().resources, items.map(item => item.resourceId), index => `items[${index}].resourceId`, caps.resources.map(item => item.resourceId)))
    caps.resources = items
    return ok(resourcesOf(account) satisfies Schemas['VolunteerResource'][])
  }),
]
