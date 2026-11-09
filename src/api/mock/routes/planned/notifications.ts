// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { flagParam, newest, uuid } from '../../domain'
import { notFound } from '../../errors'
import { route } from '../../router'
import { db } from '../../store'
import type { NotificationRecord } from '../../types'
import { now, ok, paginate } from '../../util'
import { flag, validate } from '../../validate'
import { requireUser } from '../../views'

const view = ({ userId: _user, ...notification }: NotificationRecord): Schemas['Notification'] => notification
const mine = (userId: string) => db().notifications.filter(item => item.userId === userId)

export const notificationRoutes = [
  route('GET', '/me/notifications', ({ query }) => {
    const account = requireUser(), unreadOnly = flagParam(query, 'unreadOnly')
    return ok(paginate(newest(mine(account.id).filter(item => !unreadOnly || item.readAt === null), item => item.createdAt).map(view), query) satisfies Schemas['NotificationPage'])
  }),
  route('GET', '/me/notifications/unread-count', () => ok({ count: mine(requireUser().id).filter(item => item.readAt === null).length } satisfies Schemas['UnreadCount'])),
  route('PATCH', '/me/notifications/{notificationId}', ({ params, body }) => {
    const account = requireUser(), entry = mine(account.id).find(item => item.id === uuid(params.notificationId))
    if (!entry) throw notFound()
    validate<Schemas['NotificationRead']>(body, { read: flag(true) })
    entry.readAt ??= now()
    return ok(view(entry))
  }),
]
