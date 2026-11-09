// Trazabilidad: registro de eventos importantes con responsable y fecha (planned: solo con features.adminTools).
import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { dateTime } from './activity-format'
import { api, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, Select } from './components'
import { clientFailure, everyPage } from './needs-data'
import { usePageTitle } from './page-title'
import { Pagination } from './Profiles'
import { Breadcrumbs, Card, EmptyState, Notice, Timeline, type IconName, type TimelineItem } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './admin.css'

type Event = Schemas['AuditEvent']
type Page = { items: Event[]; totalPages: number; totalElements: number }
type Tone = NonNullable<TimelineItem['tone']>
const ok = 'ok', wait = 'wait', no = 'no', plum = 'plum', neutral = 'neutral'

/** Título legible, icono y tono de cada tipo de evento. El texto lleva el significado; el color solo acompaña. */
const kinds: Record<string, { title: string; icon: IconName; tone: Tone }> = {
  ACCOUNT_REGISTERED: { title: 'Cuenta creada', icon: 'person', tone: neutral },
  SESSION_CREATED: { title: 'Inicio de sesión', icon: 'logout', tone: neutral },
  ACCOUNT_SUSPENDED: { title: 'Cuenta suspendida', icon: 'lock', tone: no },
  ACCOUNT_REINSTATED: { title: 'Cuenta reactivada', icon: 'refresh', tone: ok },
  PROFILE_PUBLISHED: { title: 'Perfil publicado', icon: 'eye', tone: ok },
  PROFILE_HIDDEN: { title: 'Perfil ocultado', icon: 'eyeOff', tone: neutral },
  OPPORTUNITY_ALERTS_UPDATED: { title: 'Avisos de oportunidades actualizados', icon: 'bell', tone: neutral },
  ORGANIZATION_CREATED: { title: 'Organización registrada', icon: 'people', tone: plum },
  ORGANIZATION_UPDATED: { title: 'Organización actualizada', icon: 'document', tone: neutral },
  ORGANIZATION_SUBMITTED: { title: 'Organización enviada a revisión', icon: 'document', tone: plum },
  ORGANIZATION_APPROVED: { title: 'Organización aprobada', icon: 'checkCircle', tone: ok },
  ORGANIZATION_REJECTED: { title: 'Organización rechazada', icon: 'alert', tone: no },
  ORGANIZATION_MORE_INFO: { title: 'Información adicional solicitada', icon: 'info', tone: wait },
  ORGANIZATION_SUSPENDED: { title: 'Organización suspendida', icon: 'lock', tone: no },
  MEMBERSHIP_CREATED: { title: 'Integrante añadido al equipo', icon: 'userPlus', tone: ok },
  MEMBERSHIP_UPDATED: { title: 'Rol o acceso de integrante cambiado', icon: 'people', tone: wait },
  CAUSE_CREATED: { title: 'Causa creada', icon: 'leaf', tone: plum },
  CAUSE_UPDATED: { title: 'Causa actualizada', icon: 'leaf', tone: neutral },
  NEED_CREATED: { title: 'Necesidad creada', icon: 'document', tone: plum },
  NEED_UPDATED: { title: 'Necesidad actualizada', icon: 'document', tone: neutral },
  NEED_PUBLISHED: { title: 'Necesidad publicada', icon: 'document', tone: wait },
  NEED_CANCELLED: { title: 'Necesidad cancelada', icon: 'x', tone: no },
  NEED_CLOSED: { title: 'Necesidad cerrada', icon: 'checkCircle', tone: ok },
  APPLICATION_SUBMITTED: { title: 'Postulación enviada', icon: 'mail', tone: plum },
  APPLICATION_WITHDRAWN: { title: 'Postulación retirada', icon: 'x', tone: neutral },
  APPLICATION_ACCEPTED: { title: 'Postulación aceptada', icon: 'checkCircle', tone: ok },
  APPLICATION_REJECTED: { title: 'Postulación rechazada', icon: 'x', tone: no },
  COMMITMENT_CONFIRMED: { title: 'Compromiso confirmado', icon: 'people', tone: ok },
  COMMITMENT_CANCELLED: { title: 'Compromiso cancelado', icon: 'x', tone: no },
  PARTICIPATION_RECORDED: { title: 'Participación registrada', icon: 'calendar', tone: wait },
  PARTICIPATION_VERIFIED: { title: 'Horas verificadas', icon: 'clock', tone: plum },
  PARTICIPATION_DISPUTED: { title: 'Horas en revisión', icon: 'alert', tone: no },
  FEEDBACK_SUBMITTED: { title: 'Valoración enviada', icon: 'check', tone: neutral },
  CATALOG_SKILL_CREATED: { title: 'Habilidad creada en el catálogo', icon: 'folder', tone: plum },
  CATALOG_SKILL_UPDATED: { title: 'Habilidad actualizada en el catálogo', icon: 'folder', tone: plum },
  CATALOG_RESOURCE_CREATED: { title: 'Recurso creado en el catálogo', icon: 'folder', tone: plum },
  CATALOG_RESOURCE_UPDATED: { title: 'Recurso actualizado en el catálogo', icon: 'folder', tone: plum },
  CATALOG_TERRITORY_CREATED: { title: 'Territorio creado en el catálogo', icon: 'pin', tone: plum },
  CATALOG_TERRITORY_UPDATED: { title: 'Territorio actualizado en el catálogo', icon: 'pin', tone: plum },
}
const known = Object.entries(kinds).map(([value, item]) => ({ value, label: item.title })).sort((a, b) => a.label.localeCompare(b.label, 'es'))
const pageSize = 20
const bogota = (date: string, end: boolean) => `${date}T${end ? '23:59:59.999' : '00:00:00.000'}-05:00`

export function AdminAudit() {
  usePageTitle('Trazabilidad')
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [action, setAction] = useState(''), [actor, setActor] = useState(''), [page, setPage] = useState(0)
  const people = useQuery({ queryKey: ['admin-users', 'all'], queryFn: () => everyPage<Schemas['AdminUser']>('/admin/users'), retry: false, staleTime: 60_000 })
  const reversed = !!from && !!to && from > to
  const query = useQuery({ queryKey: ['admin-audit', from, to, action, actor, page], enabled: !reversed, retry: false, placeholderData: keepPreviousData,
    queryFn: () => api<Page>(`/admin/audit-events?size=${pageSize}&page=${page}${from ? `&from=${encodeURIComponent(bogota(from, false))}` : ''}${to ? `&to=${encodeURIComponent(bogota(to, true))}` : ''}${action ? `&action=${action}` : ''}${actor ? `&actorUserId=${actor}` : ''}`) })
  const name = (id: string | null) => id === null ? 'el sistema' : people.data?.find(item => item.id === id)?.displayName ?? 'una cuenta que ya no aparece'
  const items: TimelineItem[] = (query.data?.items ?? []).map(event => { const kind = kinds[event.action]; return { id: event.id, title: kind?.title ?? 'Evento registrado', icon: kind?.icon ?? 'document', tone: kind?.tone ?? neutral,
    meta: <><span>Por {name(event.actorUserId)}</span><time className="audit-time" dateTime={event.occurredAt}>{dateTime(event.occurredAt)}</time></>, text: kind ? undefined : `Tipo de evento: ${event.action}` } })
  const filtered = !!(from || to || action || actor), clear = () => { setFrom(''); setTo(''); setAction(''); setActor(''); setPage(0) }, rangeError = reversed ? clientFailure([{ field: 'audit-to', message: 'La fecha final debe ser igual o posterior a la inicial.' }]) : undefined
  return <div className="work admin-audit">
    <Breadcrumbs items={[{ label: 'Administración', to: '/admin/organizaciones' }, { label: 'Trazabilidad' }]} />
    <PageHeading title="Trazabilidad" lead="Registro de eventos importantes en Hila." />
    <Card as="section" tone="soft" className="audit-filters" aria-label="Filtros de la trazabilidad"><div className="audit-grid">
      <Field label="Desde" name="audit-from" type="date" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); setPage(0) }} />
      <Field label="Hasta" name="audit-to" type="date" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); setPage(0) }} error={rangeError} />
      <Select label="Tipo de evento" name="audit-action" value={action} onChange={event => { setAction(event.target.value); setPage(0) }}><option value="">Todos</option>{known.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</Select>
      <Select label="Responsable" name="audit-actor" value={actor} onChange={event => { setActor(event.target.value); setPage(0) }}><option value="">Cualquiera</option>{(people.data ?? []).map(item => <option key={item.id} value={item.id}>{item.displayName}</option>)}</Select>
    </div>{filtered && <button type="button" className="action" onClick={clear}>Quitar filtros</button>}</Card>
    <Card as="section" className="audit-card" aria-label="Eventos registrados">
      {reversed ? <p className="loading-state">Corrige el rango de fechas para ver los eventos.</p>
        : query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
          : query.isPending ? <p className="loading-state" role="status">Cargando el registro…</p>
            : items.length === 0 ? <EmptyState title={filtered ? 'No hay eventos con esos filtros.' : 'Todavía no hay eventos registrados.'} headingLevel={2} action={filtered ? <button type="button" className="action" onClick={clear}>Quitar filtros</button> : undefined}>{filtered ? 'Prueba con otro rango de fechas o con otro tipo de evento.' : 'Las acciones importantes aparecerán aquí con su responsable y fecha.'}</EmptyState>
              : <><p className="catalog-count" role="status">{query.data!.totalElements} {query.data!.totalElements === 1 ? 'evento' : 'eventos'}{filtered ? ' con estos filtros' : ''} · Hora de Bogotá</p><Timeline label="Eventos, del más reciente al más antiguo" items={items} /></>}
    </Card>
    {query.data && !reversed && <Pagination page={page} totalPages={query.data.totalPages} setPage={setPage} />}
    <Notice><p>Cada acción conserva responsable y fecha.</p></Notice>
  </div>
}
