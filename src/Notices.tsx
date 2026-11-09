// Avisos: bandeja de notificaciones y preferencia de correo (planned: solo con features.notifications).
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { ago, dateTime } from './activity-format'
import { api, type Schemas } from './api/client'
import { Feedback, PageHeading } from './components'
import { features } from './features'
import { usePageTitle } from './page-title'
import { Pagination } from './Profiles'
import { loadVolunteer } from './volunteer'
import { Card, Chip, ChipGroup, EmptyState, Icon, Notice, Toggle, type IconName } from './ui'
import './notices.css'

type Notification = Schemas['Notification']
const pageSize = 20
type Look = { icon: IconName; tone: 'ok' | 'wait' | 'no' | 'plum' | 'neutral' }
/** Cada tipo lleva icono y color; el título del aviso dice lo que pasó, así que el color solo acompaña. */
const looks: Record<Notification['type'], Look> = {
  APPLICATION_RECEIVED: { icon: 'people', tone: 'wait' }, APPLICATION_DECIDED: { icon: 'mail', tone: 'plum' }, COMMITMENT_CONFIRMED: { icon: 'checkCircle', tone: 'ok' }, COMMITMENT_CANCELLED: { icon: 'alert', tone: 'no' },
  NEED_UPDATED: { icon: 'calendar', tone: 'wait' }, NEED_CANCELLED: { icon: 'alert', tone: 'no' }, NEED_CLOSED: { icon: 'folder', tone: 'neutral' },
  PARTICIPATION_RECORDED: { icon: 'document', tone: 'plum' }, PARTICIPATION_VERIFIED: { icon: 'document', tone: 'plum' }, ORGANIZATION_REVIEWED: { icon: 'people', tone: 'plum' }, NEW_OPPORTUNITY: { icon: 'sprout', tone: 'ok' },
}
/** Recurso relacionado. No hay lectura de una participación por su id, así que esos avisos llevan al historial. */
function targetOf(item: Notification) {
  if (!item.resourceType || !item.resourceId) return null
  if (item.resourceType === 'NEED') return features.opportunities ? `/explorar/${item.resourceId}` : null
  if (item.resourceType === 'APPLICATION') return features.applications ? `/actividad/${item.resourceId}` : null
  if (item.resourceType === 'PARTICIPATION') return features.applications ? '/actividad?vista=historial' : null
  return `/organizaciones/${item.resourceId}`
}
const invalidate = (client: QueryClient) => Promise.all([client.invalidateQueries({ queryKey: ['notifications'] }), client.invalidateQueries({ queryKey: ['unread-count'] })])
const markRead = async (client: QueryClient, item: Notification) => { if (item.readAt) return; await api(`/me/notifications/${item.id}`, { method: 'PATCH', body: { read: true } }); await invalidate(client) }

function Row({ item, onError }: { item: Notification; onError: (error: unknown) => void }) {
  const client = useQueryClient(), look = looks[item.type], to = targetOf(item), unread = !item.readAt
  const body = <><span className={`nr-icon tone-${look.tone}`} aria-hidden="true"><Icon name={look.icon} size={22} /></span>
    <span className="nr-text"><strong>{item.title}{unread && <span className="sr-only"> (sin leer)</span>}</strong><span className="nr-body">{item.body}</span><time dateTime={item.createdAt} title={dateTime(item.createdAt)}>{ago(item.createdAt)}</time></span>
    {unread && <span className="nr-dot" aria-hidden="true" />}{to && <Icon name="chevronRight" size={20} className="nr-chevron" />}</>
  // Se marca como leído al abrir; la navegación no espera la respuesta.
  return <li className={unread ? 'is-unread' : undefined}>{to ? <Link className="notice-row" to={to} onClick={() => void markRead(client, item).catch(() => undefined)}>{body}</Link>
    : <div className="notice-row">{body}{unread && <button type="button" className="text-button" aria-label={`Marcar como leído: ${item.title}`} onClick={() => void markRead(client, item).catch(onError)}>Marcar como leído</button>}</div>}</li>
}

function Skeleton() { return <ul className="notice-list card" aria-hidden="true">{[0, 1, 2].map(item => <li key={item} className="skeleton"><div className="notice-row"><span className="nr-icon sk-line" /><span className="nr-text"><span className="sk-line w50" /><span className="sk-line w70" /><span className="sk-line w40" /></span></div></li>)}</ul> }

/** Preferencia de correo: misma lógica que Privacidad (PUT /me/opportunity-alerts con la versión vigente de la política). */
function Preferences() {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const volunteer = useQuery({ queryKey: ['volunteer'], queryFn: loadVolunteer, retry: false }), policies = useQuery({ queryKey: ['policies'], queryFn: () => api<Schemas['Policy'][]>('/policies/current'), retry: false })
  const policy = policies.data?.find(item => item.type === 'OPPORTUNITY_ALERTS')
  async function change(value: boolean) {
    if (!policy) return
    setBusy(true); setError(undefined); setNotice('')
    try { await api('/me/opportunity-alerts', { method: 'PUT', body: { enabled: value, policyVersion: policy.version } }); await Promise.all([client.invalidateQueries({ queryKey: ['volunteer'] }), client.invalidateQueries({ queryKey: ['consents'] })]); setNotice(value ? 'Activamos los avisos por correo.' : 'Desactivamos los avisos por correo.') } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  return <Card as="section" className="notice-prefs" aria-labelledby="prefs-title"><h2 id="prefs-title">Preferencias</h2>
    {volunteer.isPending || policies.isPending ? <p className="loading-state" role="status">Consultando tus preferencias…</p> : volunteer.error || policies.error ? <><Feedback error={volunteer.error ?? policies.error} /><button type="button" className="action" onClick={() => { void volunteer.refetch(); void policies.refetch() }}>Volver a intentar</button></>
      : volunteer.data ? <><Feedback error={error} success={notice} /><Toggle icon="mail" label="Nuevas oportunidades por correo" hint="Recibe avisos sobre nuevas necesidades que te pueden interesar." checked={!!volunteer.data.emailOpportunityAlerts} disabled={busy || !policy} onChange={value => void change(value)} onText="Activados" offText="Desactivados" />
        <p className="act-note">No afecta los correos de tu cuenta, como la verificación o la recuperación de acceso. También puedes cambiarlo en <Link to="/mi-cuenta/privacidad">Privacidad y avisos</Link>.</p></>
        : <Notice icon="person">Los avisos por correo se basan en tu perfil voluntario, así sabemos qué oportunidades te corresponden. <Link to="/mi-perfil">Crear mi perfil</Link></Notice>}
  </Card>
}

export function Notices() {
  usePageTitle('Avisos')
  const [params, setParams] = useSearchParams(), unreadOnly = params.get('filtro') === 'sin-leer', page = Math.max(0, Number(params.get('pagina')) || 0), [error, setError] = useState<unknown>()
  const search = new URLSearchParams({ size: String(pageSize), page: String(page) }); if (unreadOnly) search.set('unreadOnly', 'true')
  const query = useQuery({ queryKey: ['notifications', search.toString()], queryFn: () => api<Schemas['NotificationPage']>(`/me/notifications?${search}`), retry: false, placeholderData: keepPreviousData })
  const unread = useQuery({ queryKey: ['unread-count'], queryFn: () => api<{ count: number }>('/me/notifications/unread-count'), retry: false }), pending = unread.data?.count
  const items = query.data?.items ?? [], total = query.data?.totalElements ?? 0
  const filter = (value: boolean) => { const copy = new URLSearchParams(); if (value) copy.set('filtro', 'sin-leer'); setParams(copy, { replace: true }) }
  return <div className="notices">
    <PageHeading title="Avisos" lead="Respuestas a tus postulaciones, cambios en las actividades y horas verificadas." />
    <div className="notices-layout">
      <section className="notices-main" aria-labelledby="inbox-title" aria-busy={query.isFetching}><h2 id="inbox-title" className="sr-only">Bandeja de avisos</h2>
        <div className="notices-bar"><ChipGroup legend="Mostrar" className="notices-filter"><Chip type="radio" name="filtro" checked={!unreadOnly} onChange={() => filter(false)}>Todos</Chip><Chip type="radio" name="filtro" checked={unreadOnly} onChange={() => filter(true)}>Sin leer{pending ? ` (${pending})` : ''}</Chip></ChipGroup>
          <p className="result-count" role="status">{pending === undefined ? '' : pending === 0 ? 'No tienes avisos sin leer.' : `${pending} ${pending === 1 ? 'aviso sin leer' : 'avisos sin leer'}`}</p></div>
        <Feedback error={error} />
        {query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
          : query.isPending ? <><p className="sr-only" role="status">Cargando tus avisos…</p><Skeleton /></>
          : total === 0 ? (unreadOnly ? <EmptyState title="No tienes avisos sin leer" action={<button type="button" className="action primary" onClick={() => filter(false)}>Ver todos los avisos</button>}>Cuando haya novedades, las verás aquí.</EmptyState>
            : <EmptyState title="Aún no tienes avisos">Aquí verás las respuestas a tus postulaciones, los cambios de horario y tus horas verificadas.</EmptyState>)
          : <><ul className="notice-list card">{items.map(item => <Row key={item.id} item={item} onError={setError} />)}</ul>
            <Pagination page={page} totalPages={query.data?.totalPages ?? 0} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} /></>}
      </section>
      <Preferences />
    </div>
  </div>
}
