// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { audit, dateParam, enumParam, idParam, matches, newest, ordered } from '../../domain'
import { Fail, notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { Account } from '../../types'
import { ok, paginate } from '../../util'
import { choice, text, validate } from '../../validate'
import { requireAdmin } from '../../views'

const states = ['PENDING_EMAIL', 'ACTIVE', 'SUSPENDED'] as const
const view = (account: Account): Schemas['AdminUser'] => ({ id: account.id, email: account.email, displayName: account.displayName, status: account.verifiedAt ? account.status ?? 'ACTIVE' : 'PENDING_EMAIL', createdAt: account.createdAt })

export const adminPlannedRoutes = [
  route('GET', '/admin/users', ({ query }) => {
    requireAdmin()
    const q = query.get('q'), status = enumParam(query, 'status', states)
    if (q !== null && q.length > 140) throw new Fail(400, 'MALFORMED_REQUEST', 'El parámetro «q» no es válido.')
    const items = db().accounts.map(view).filter(item => (!status || item.status === status) && (!q || matches(item.displayName, q) || matches(item.email, q)))
    return ok(paginate(newest(items, item => item.createdAt), query) satisfies Schemas['AdminUserPage'])
  }),
  route('PUT', '/admin/users/{userId}/status', ({ params, body }) => {
    const admin = requireAdmin(), target = db().accounts.find(item => item.id === params.userId)
    if (!target) throw notFound()
    const data = validate<Schemas['AccountStatusUpdate']>(body, { status: choice(['ACTIVE', 'SUSPENDED']), reason: text(1000) })
    if (target.id === admin.id) throw new Fail(403, 'FORBIDDEN', 'No puedes suspender tu propia cuenta.')
    const current = view(target).status
    if (current === 'PENDING_EMAIL') throw new Fail(409, 'INVALID_TRANSITION', 'La cuenta aún no verificó su correo: no se puede activar ni suspender desde aquí.')
    if (current === data.status) throw new Fail(409, 'INVALID_TRANSITION', `La cuenta ya está ${data.status === 'ACTIVE' ? 'activa' : 'suspendida'}.`)
    if (data.status === 'SUSPENDED' && target.roles.includes('ADMIN') && !db().accounts.some(item => item !== target && item.roles.includes('ADMIN') && view(item).status === 'ACTIVE'))
      throw new Fail(409, 'LAST_ADMIN_REQUIRED', 'Debe quedar al menos una cuenta administradora activa.')
    target.status = data.status
    if (data.status === 'SUSPENDED' && db().sessionId === target.id) db().sessionId = null
    audit(admin.id, data.status === 'SUSPENDED' ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REINSTATED', 'USER', target.id)
    return ok(view(target))
  }),
  route('GET', '/admin/audit-events', ({ query }) => {
    requireAdmin()
    const actor = idParam(query, 'actorUserId'), resourceId = idParam(query, 'resourceId'), type = query.get('resourceType'), action = query.get('action'), from = dateParam(query, 'from'), to = dateParam(query, 'to')
    ordered(from, to, 'from')
    const items = db().audit.filter(item => (!actor || item.actorUserId === actor) && (!resourceId || item.resourceId === resourceId) && (!type || item.resourceType === type) && (!action || item.action === action)
      && (from === null || Date.parse(item.occurredAt) >= from) && (to === null || Date.parse(item.occurredAt) <= to))
    return ok(paginate(newest(items, item => item.occurredAt), query) satisfies Schemas['AuditEventPage'])
  }),
]
