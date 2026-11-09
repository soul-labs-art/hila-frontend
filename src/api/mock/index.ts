import { dispatch } from './router'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { organizationRoutes } from './routes/organizations'
import { publicRoutes } from './routes/public'
import { adminPlannedRoutes } from './routes/planned/admin-planned'
import { catalogRoutes } from './routes/planned/catalogs'
import { evidenceRoutes } from './routes/planned/evidence'
import { feedbackRoutes } from './routes/planned/feedback'
import { membershipRoutes } from './routes/planned/memberships'
import { notificationRoutes } from './routes/planned/notifications'
import { opportunityRoutes } from './routes/planned/opportunities'
import { participationRoutes } from './routes/planned/participation'
import { volunteerCapacityRoutes } from './routes/planned/volunteer-capacities'
import type { Route } from './types'

export { resetMock } from './store'
// Operaciones `planned` del contrato (./routes/planned): retirar cada archivo cuando el backend implemente su operación.
const planned: Route[] = [...volunteerCapacityRoutes, ...catalogRoutes, ...adminPlannedRoutes, ...membershipRoutes, ...opportunityRoutes, ...participationRoutes, ...evidenceRoutes, ...feedbackRoutes, ...notificationRoutes]
const routes: Route[] = [...authRoutes, ...accountRoutes, ...organizationRoutes, ...adminRoutes, ...publicRoutes, ...planned]
export const mockFetch: typeof fetch = (input, init) => dispatch(routes, input instanceof Request ? input.url : String(input), init)
