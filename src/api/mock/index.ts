import { dispatch } from './router'
import { accountRoutes } from './routes/account'
import { adminRoutes } from './routes/admin'
import { authRoutes } from './routes/auth'
import { organizationRoutes } from './routes/organizations'
import { publicRoutes } from './routes/public'
import type { Route } from './types'

export { resetMock } from './store'
// Las operaciones `planned` del contrato se añaden aquí como nuevos archivos en ./routes.
const routes: Route[] = [...authRoutes, ...accountRoutes, ...organizationRoutes, ...adminRoutes, ...publicRoutes]
export const mockFetch: typeof fetch = (input, init) => dispatch(routes, input instanceof Request ? input.url : String(input), init)
