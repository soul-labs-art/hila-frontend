import type { Schemas } from '../../client'
import { notFound, profileNotFound } from '../errors'
import { route } from '../router'
import { policies } from '../seed'
import { db } from '../store'
import { ok, paginate, plain } from '../util'
import { publicOrganization, publicVolunteer, signedIn } from '../views'

const types = ['VALLEY', 'MUNICIPALITY', 'COMMUNE', 'NEIGHBORHOOD']
function visibleImage(id: string) {
  const user = signedIn(), state = db()
  for (const account of state.accounts) for (const image of [account.profile?.avatar, account.profile?.cover]) {
    if (image?.id === id && (account.profile?.visibility === 'PUBLIC' && account.verifiedAt || account.id === user?.id || user?.roles.includes('ADMIN'))) return image
  }
  for (const org of state.organizations) for (const image of [org.avatar, org.cover]) {
    if (image?.id === id && (org.visibility === 'PUBLIC' && org.verificationStatus === 'APPROVED' || user && (user.roles.includes('ADMIN') || state.memberships.some(item => item.organizationId === org.id && item.userId === user.id && item.status === 'ACTIVE')))) return image
  }
  throw notFound()
}

export const publicRoutes = [
  route('GET', '/health', () => ok({ status: 'UP', service: 'hila-api' } satisfies Schemas['Health'])),
  route('GET', '/policies/current', () => ok(policies)),
  route('GET', '/catalogs/territories', ({ query }) => {
    const q = plain(query.get('q') ?? ''), parentId = query.get('parentId'), type = query.get('type')
    if (type !== null && !types.includes(type)) return ok(paginate([], query))
    const items = db().territories.filter(item => item.active && (!q || plain(item.name).includes(q)) && (!parentId || item.parentId === parentId) && (!type || item.type === type))
    return ok(paginate([...items].sort((a, b) => a.name.localeCompare(b.name, 'es')), query) satisfies Schemas['TerritoryPage'])
  }),
  route('GET', '/volunteers/{userId}/public-profile', ({ params }) => {
    const account = db().accounts.find(item => item.id === params.userId)
    if (!account?.verifiedAt || account.profile?.visibility !== 'PUBLIC') throw profileNotFound()
    return ok(publicVolunteer(account))
  }),
  route('GET', '/organizations/{organizationId}/public-profile', ({ params }) => {
    const org = db().organizations.find(item => item.id === params.organizationId)
    if (!org || org.verificationStatus !== 'APPROVED' || org.visibility !== 'PUBLIC') throw profileNotFound()
    return ok(publicOrganization(org))
  }),
  route('GET', '/profile-images/{imageId}', async ({ params }) => {
    const image = visibleImage(params.imageId)
    return { status: 200, blob: await (await fetch(image.url)).blob() }
  }),
]
