import type { Schemas } from './api/client'
import { everyPage } from './needs-data'

export const myApplications = {
  queryKey: ['my-applications', 'all'],
  queryFn: () => everyPage<Schemas['Application']>('/me/applications'),
  retry: false,
}
