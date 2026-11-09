// Cuentas de usuarios para administración: estado y suspensión (planned: solo con features.adminTools).
import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { dayYear } from './activity-format'
import { api, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, StatusBadge, TextArea } from './components'
import { formValue } from './form-values'
import { explain } from './friendly-errors'
import { Dialog } from './needs-shared'
import { usePageTitle } from './page-title'
import { Pagination } from './Profiles'
import { useSession } from './session-context'
import { Avatar, Breadcrumbs, Card, Chip, ChipGroup, EmptyState, Icon, Notice } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './team.css'
import './admin.css'

type User = Schemas['AdminUser']
type Status = User['status']
type UserPage = { items: User[]; totalPages: number; totalElements: number }

const look: Record<Status, { label: string; tone: 'ok' | 'wait' | 'no' }> = { ACTIVE: { label: 'Activa', tone: 'ok' }, SUSPENDED: { label: 'Suspendida', tone: 'no' }, PENDING_EMAIL: { label: 'Pendiente de correo', tone: 'wait' } }
const filters: { value: '' | Status; label: string }[] = [{ value: '', label: 'Todas' }, { value: 'ACTIVE', label: 'Activas' }, { value: 'SUSPENDED', label: 'Suspendidas' }, { value: 'PENDING_EMAIL', label: 'Pendientes de correo' }]

function StatusDialog({ user, onClose, onSaved }: { user: User; onClose: () => void; onSaved: (message: string) => void }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), suspending = user.status === 'ACTIVE'
  async function save(data: FormData) {
    setBusy(true); setError(undefined)
    try {
      await api<User>(`/admin/users/${user.id}/status`, { method: 'PUT', body: { status: suspending ? 'SUSPENDED' : 'ACTIVE', reason: formValue(data, 'reason') } satisfies Schemas['AccountStatusUpdate'] })
      await Promise.all(['admin-users', 'admin-audit'].map(key => client.invalidateQueries({ queryKey: [key] }))); onSaved(suspending ? `Suspendiste la cuenta de ${user.displayName}.` : `Reactivaste la cuenta de ${user.displayName}.`)
    } catch (failure) { setError(explain(failure, { FORBIDDEN: 'No puedes suspender tu propia cuenta.' })) } finally { setBusy(false) }
  }
  return <Dialog wide title={suspending ? 'Suspender cuenta' : 'Reactivar cuenta'} confirmLabel={suspending ? 'Suspender cuenta' : 'Reactivar cuenta'} danger={suspending} busy={busy} error={error} onClose={onClose} onSubmit={data => void save(data)}>
    <p>{suspending ? <>Vas a suspender la cuenta de <strong>{user.displayName}</strong>. Se cerrará su sesión y no podrá ingresar hasta que la reactives.</> : <>Vas a reactivar la cuenta de <strong>{user.displayName}</strong>. Podrá ingresar de nuevo.</>}</p>
    <TextArea label="Motivo *" name="reason" required rows={4} maxLength={1000} autoFocus hint="Queda registrado en la trazabilidad con tu nombre y la fecha. No incluyas datos privados." error={error} />
  </Dialog>
}

export function AdminUsers() {
  usePageTitle('Usuarios')
  const session = useSession(), [typed, setTyped] = useState(''), [search, setSearch] = useState(''), [status, setStatus] = useState<'' | Status>(''), [page, setPage] = useState(0), [dialog, setDialog] = useState<User | null>(null), [message, setMessage] = useState(''), result = useRef<HTMLDivElement>(null)
  useEffect(() => { const timer = setTimeout(() => { setSearch(typed.trim()); setPage(0) }, 300); return () => clearTimeout(timer) }, [typed])
  const query = useQuery({ queryKey: ['admin-users', search, status, page], queryFn: () => api<UserPage>(`/admin/users?size=20&page=${page}${search ? `&q=${encodeURIComponent(search)}` : ''}${status ? `&status=${status}` : ''}`), retry: false, placeholderData: keepPreviousData })
  const items = query.data?.items ?? [], filtered = !!search || !!status
  const saved = (text: string) => { setDialog(null); setMessage(text); setTimeout(() => result.current?.focus(), 60) }
  return <div className="work admin-users">
    <Breadcrumbs items={[{ label: 'Administración', to: '/admin/organizaciones' }, { label: 'Usuarios' }]} />
    <PageHeading title="Usuarios" lead="Consulta las cuentas de Hila y suspende o reactiva el acceso cuando haga falta." />
    <div className="users-filters"><Field label="Buscar por nombre o correo" name="q" type="search" value={typed} onChange={event => setTyped(event.target.value)} maxLength={140} autoComplete="off" />
      <ChipGroup legend="Estado de la cuenta">{filters.map(item => <Chip key={item.value || 'all'} type="radio" name="status" value={item.value} checked={status === item.value} onChange={() => { setStatus(item.value); setPage(0) }}>{item.label}</Chip>)}</ChipGroup></div>
    <div ref={result} tabIndex={-1} className="act-result"><Feedback success={message} /></div>
    {query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
      : query.isPending ? <p className="loading-state" role="status">Cargando cuentas…</p>
        : items.length === 0 ? <EmptyState title={filtered ? 'No encontramos cuentas con esos filtros.' : 'Todavía no hay cuentas'} headingLevel={2} action={filtered ? <button type="button" className="action" onClick={() => { setTyped(''); setSearch(''); setStatus(''); setPage(0) }}>Quitar filtros</button> : undefined}>{filtered ? 'Prueba con otro nombre o correo, o cambia el estado.' : 'Cuando alguien cree una cuenta aparecerá aquí.'}</EmptyState>
          : <><p className="catalog-count" role="status">{query.data!.totalElements} {query.data!.totalElements === 1 ? 'cuenta' : 'cuentas'}{filtered ? ' con estos filtros' : ''}</p>
            <Card className="team-card"><table className="data-table users-table"><caption className="sr-only">Cuentas de usuarios</caption>
              <thead><tr><th scope="col">Nombre</th><th scope="col" className="col-status">Estado</th><th scope="col" className="col-wide">Registro</th><th scope="col" className="col-user-action">Acción</th></tr></thead>
              <tbody>{items.map(user => { const self = user.id === session.user?.id, state = look[user.status]; return <tr key={user.id} className={user.status === 'ACTIVE' ? undefined : 'is-revoked'}>
                <td><div className="person"><Avatar name={user.displayName} size="md" /><span className="person-text"><strong>{user.displayName}{self && <span className="you"> (tú)</span>}</strong><small>{user.email}</small><span className="status-inline"><StatusBadge tone={state.tone}>{state.label}</StatusBadge></span></span></div></td>
                <td className="col-status"><StatusBadge tone={state.tone}>{state.label}</StatusBadge></td><td className="col-wide">{dayYear(user.createdAt)}</td>
                <td className="col-user-action">{user.status === 'PENDING_EMAIL' ? <small className="muted-note">Aún no verifica su correo</small> : self ? <><button type="button" className="action danger" disabled aria-describedby={`self-${user.id}`}>Suspender</button><small id={`self-${user.id}`} className="muted-note">No puedes suspender tu propia cuenta.</small></>
                  : <button type="button" className={`action${user.status === 'ACTIVE' ? ' danger' : ''}`} aria-label={`${user.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'} a ${user.displayName}`} onClick={() => { setMessage(''); setDialog(user) }}><Icon name={user.status === 'ACTIVE' ? 'lock' : 'refresh'} size={20} />{user.status === 'ACTIVE' ? 'Suspender' : 'Reactivar'}</button>}</td></tr> })}</tbody></table></Card>
            <Pagination page={page} totalPages={query.data!.totalPages} setPage={setPage} /></>}
    <Notice icon="lock"><p>Suspender cierra la sesión de la cuenta y deja el motivo en la trazabilidad. Debe quedar siempre al menos una cuenta administradora activa.</p></Notice>
    {dialog && <StatusDialog user={dialog} onClose={() => setDialog(null)} onSaved={saved} />}
  </div>
}
