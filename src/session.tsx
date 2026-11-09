import { Context, safeReturnTo, useSession, type User, type Session } from './session-context'
import { useEffect, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { api, ApiFailure, clearCsrf } from './api/client'
import { EmptyState } from './ui'

export function SessionProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient()
  const query = useQuery({ queryKey: ['session'], queryFn: async () => {
    try { return await api<User>('/me') }
    catch (error) { if (error instanceof ApiFailure && error.status === 401) return null; throw error }
  }, retry: false, staleTime: 60_000 })
  useEffect(() => {
    const expire = () => { client.removeQueries({ predicate: entry => entry.queryKey[0] !== 'session' }); client.setQueryData(['session'], null) }
    window.addEventListener('hila:session-expired', expire)
    return () => window.removeEventListener('hila:session-expired', expire)
  }, [client])
  const value: Session = { user: query.data ?? null, loading: query.isPending, error: query.error,
    refresh: () => query.refetch(),
    login: async (email, password) => {
      const user = await api<User>('/auth/sessions', { method: 'POST', body: { email, password } })
      clearCsrf(); client.removeQueries({ predicate: entry => entry.queryKey[0] !== 'session' }); client.setQueryData(['session'], user)
    },
    logout: async () => {
      await api('/auth/sessions/current', { method: 'DELETE' })
      clearCsrf(); client.removeQueries({ predicate: entry => entry.queryKey[0] !== 'session' }); client.setQueryData(['session'], null)
    },
  }
  return <Context.Provider value={value}>{children}</Context.Provider>
}
export function GuestOnly({ children }: { children: ReactNode }) {
  const session = useSession(), [search] = useSearchParams()
  if (session.loading) return <p role="status">Consultando tu sesión…</p>
  if (session.user) return <Navigate replace to={safeReturnTo(search.get('returnTo'))} />
  return children
}
export function Protected({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const session = useSession(), location = useLocation()
  if (session.loading) return <p role="status">Consultando tu sesión…</p>
  if (session.error) return <div role="alert"><p>{session.error.message}</p><button onClick={() => void session.refresh()}>Volver a intentar</button></div>
  if (!session.user) return <Navigate replace to={`/ingresar?returnTo=${encodeURIComponent(location.pathname + location.search)}`} />
  if (admin && !session.user.roles.includes('ADMIN')) return <EmptyState headingLevel={1} title="Esta sección requiere acceso administrativo" action={<Link className="action primary" to="/mi-cuenta">Volver a mi cuenta</Link>}>Vuelve a tu cuenta para continuar.</EmptyState>
  return children
}
