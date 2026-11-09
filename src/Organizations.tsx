import { usePageTitle } from './page-title'
import { formValue, nullableValue } from './form-values'
import { reviewName, reviewTone } from './labels'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Field, Select, TextArea, Feedback, PageHeading, Row, StatusBadge, Submit } from './components'
import { ImageEditor, ProfileCard, Publication, VisibilityBadge, type Organization } from './ProfileCard'
import { photoFor } from './cover-photo'
import { Pagination, type OrganizationPage } from './Profiles'
import { photo, photoSrc } from './photos'
import { useSession } from './session-context'
import { Avatar, Breadcrumbs, Card, Chip, ChipGroup, DefinitionList, EmptyState, Icon, Notice, RadioCards, Timeline, type IconName, type TimelineItem } from './ui'

type Page<T> = { items: T[]; totalPages: number }
async function allTerritories() {
  const items: Schemas['Territory'][] = []
  for (let page = 0; ; page++) { const data = await api<Page<Schemas['Territory']>>(`/catalogs/territories?size=100&page=${page}`); items.push(...data.items); if (page + 1 >= data.totalPages) return items }
}
const useTerritories = () => useQuery({ queryKey: ['territories'], queryFn: allTerritories, retry: false })
const decisionStyle: Record<string, { tone: TimelineItem['tone']; icon: IconName }> = { SUBMITTED: { tone: 'plum', icon: 'document' }, MORE_INFO: { tone: 'wait', icon: 'info' }, APPROVED: { tone: 'ok', icon: 'checkCircle' }, REJECTED: { tone: 'no', icon: 'alert' }, SUSPENDED: { tone: 'no', icon: 'lock' } }
function historyItems(items: Schemas['OrganizationVerification'][], moreInfo: string, time: (value: string) => string): TimelineItem[] {
  return items.map(item => ({ id: item.id, title: item.decision === 'SUBMITTED' ? 'Solicitud enviada' : item.decision === 'MORE_INFO' ? moreInfo : reviewName(item.decision), meta: <time dateTime={item.decidedAt}>{time(item.decidedAt)}</time>, text: item.reason || undefined, ...(decisionStyle[item.decision] ?? { tone: 'neutral', icon: 'document' }) }))
}

export function OrganizationForm({ organization, onSaved }: { organization?: Organization; onSaved?: () => void }) {
  usePageTitle(organization ? 'Editar organización' : 'Registrar organización')
  const [type, setType] = useState(organization?.organizationType ?? 'FORMAL'), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>()
  const territories = useTerritories()
  const navigate = useNavigate(), client = useQueryClient()
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(undefined)
    try {
      const body: Schemas['OrganizationWrite'] = { name: formValue(data, 'name'), organizationType: type,
        legalIdentifier: nullableValue(data, 'legalIdentifier'), description: formValue(data, 'description'), verificationContext: nullableValue(data, 'verificationContext'),
        publicEmail: nullableValue(data, 'publicEmail'), publicWebsite: nullableValue(data, 'publicWebsite'), serviceTerritoryId: nullableValue(data, 'serviceTerritoryId') }
      const result = await api<Organization>(organization ? `/organizations/${organization.id}` : '/organizations', { method: organization ? 'PUT' : 'POST', body })
      await client.invalidateQueries({ queryKey: ['organizations'] }); await client.invalidateQueries({ queryKey: ['organization', result.id] }); onSaved?.(); navigate(`/organizaciones/${result.id}/editar`)
    } catch (value) { setError(value) } finally { setBusy(false) }
  }
  return <section className="org-form"><PageHeading title={organization ? 'Editar organización' : 'Tu organización tiene un lugar en Hila.'} lead={organization ? 'Cuida la información que presenta a tu organización.' : 'Registra una fundación o colectivo. Su perfil comienza privado y pasará por una revisión antes de poder publicarse.'} /><Feedback error={error || territories.error} /><Card><form onSubmit={event => void save(event)}>
    <RadioCards name="organizationType" legend="Tipo de organización" value={type} onChange={value => setType(value as 'FORMAL' | 'COLLECTIVE')} disabled={organization?.verificationStatus === 'APPROVED'} options={[{ value: 'FORMAL', label: 'Organización formal', hint: 'Fundación o entidad con NIT' }, { value: 'COLLECTIVE', label: 'Colectivo comunitario', hint: 'Grupo sin NIT' }]} />
    <Field label="Nombre de la organización" name="name" required maxLength={180} defaultValue={organization?.name} error={error} />
    {type === 'FORMAL' && <Field label="NIT o identificador legal" name="legalIdentifier" required maxLength={40} readOnly={organization?.verificationStatus === 'APPROVED'} defaultValue={organization?.legalIdentifier ?? ''} error={error} hint="Esta información se utiliza para la revisión y no se publica." />}
    <TextArea label="Presentación de la organización" name="description" required maxLength={2000} rows={5} defaultValue={organization?.description ?? ''} error={error} />
    <TextArea label={type === 'COLLECTIVE' ? 'Trayectoria y referencias del colectivo' : 'Contexto para la revisión (opcional)'} name="verificationContext" required={type === 'COLLECTIVE'} maxLength={2000} rows={4} defaultValue={organization?.verificationContext ?? ''} hint="Describe sus actividades y trayectoria. Solo el equipo y quienes revisan la solicitud tendrán acceso." error={error} />
    {type === 'COLLECTIVE' && <Notice>Un colectivo puede solicitar revisión sin NIT.</Notice>}
    <Select label="Territorio principal" name="serviceTerritoryId" defaultValue={organization?.serviceTerritoryId ?? ''} error={error}><option value="">Por definir</option>{territories.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <div className="form-columns"><Field label="Correo público (opcional)" name="publicEmail" type="email" maxLength={320} defaultValue={organization?.publicEmail ?? ''} error={error} /><Field label="Sitio web público (opcional)" name="publicWebsite" type="url" maxLength={500} placeholder="https://" defaultValue={organization?.publicWebsite ?? ''} error={error} /></div>
    <Notice icon="eye">El correo y sitio web anteriores se mostrarán si publicas el perfil. No utilices información que deba permanecer privada.</Notice>
    <div className="form-actions"><Submit busy={busy}>{organization ? 'Guardar cambios' : 'Registrar y solicitar revisión'}</Submit></div>
  </form></Card></section>
}
export function OrganizationDetail() {
  usePageTitle('Mi organización')
  const { id } = useParams(), session = useSession(), [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['organization', id], queryFn: () => api<Organization>(`/organizations/${id}`), retry: false })
  const members = useQuery({ queryKey: ['memberships', id], queryFn: () => api<Page<Schemas['Membership']>>(`/organizations/${id}/memberships?size=100`), retry: false })
  const territories = useTerritories()
  const owner = members.data?.items.some(member => member.userId === session.user?.id && member.role === 'ORG_OWNER' && member.status === 'ACTIVE')
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const history = useQuery({ queryKey: ['organization-history', id], queryFn: () => api<Page<Schemas['OrganizationVerification']>>(`/organizations/${id}/verifications?size=100`), retry: false })
  const client = useQueryClient(), refresh = () => { void client.invalidateQueries({ queryKey: ['organization', id] }); void client.invalidateQueries({ queryKey: ['organization-history', id] }); setEditing(false) }
  if (query.isPending) return <p role="status">Cargando la organización…</p>
  if (query.error) return <Feedback error={query.error} />
  const org = query.data!, territory = territories.data?.find(item => item.id === org.serviceTerritoryId)?.name
  if (editing && owner) return <><button className="text-button" onClick={() => setEditing(false)}><Icon name="arrowLeft" size={18} /> Volver al perfil</button><OrganizationForm organization={org} onSaved={() => setEditing(false)} /></>
  const badge = <StatusBadge tone={reviewTone(org.verificationStatus)}>{reviewName(org.verificationStatus)}</StatusBadge>
  return <><div className="page-top"><Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name }]} />{owner && <button className="action" onClick={() => setEditing(true)}><Icon name="gear" size={20} />Editar organización</button>}</div><Feedback error={members.error} />
    <div className="profile-layout"><ProfileCard name={org.name} subtitle={org.organizationType === 'FORMAL' ? 'Organización formal' : 'Colectivo comunitario'} description={org.description} avatar={org.avatar} cover={org.cover} fallbackPhoto={photoFor(org.id)}><div className="profile-badges">{badge}<VisibilityBadge visibility={org.visibility} /></div><DefinitionList items={[{ icon: 'pin', term: 'Territorio', children: territory ?? 'Por definir' }, ...(org.publicEmail ? [{ icon: 'mail' as const, term: 'Correo público', children: org.publicEmail }] : []), ...(org.publicWebsite ? [{ icon: 'eye' as const, term: 'Sitio web', children: org.publicWebsite }] : [])]} /></ProfileCard><Card as="aside" tone="soft" className="profile-side"><h2>Estado de la revisión</h2><div>{badge}</div>{org.statusReason && <p>{org.statusReason}</p>}<Notice>La aprobación habilita el perfil público en el piloto; no constituye una certificación legal.</Notice></Card></div>
    {owner && <><ImageEditor base={`/organizations/${id}`} images={org} onSaved={refresh} /><Publication base={`/organizations/${id}`} visibility={org.visibility} disabled={org.verificationStatus !== 'APPROVED'} link={`/organizaciones/${id}`} onSaved={refresh} /></>}
    <Card as="section" className="section-card history-card"><h2>Historial de revisión</h2><Feedback error={history.error || error} success={notice} />{history.isPending ? <p role="status">Consultando el historial…</p> : <Timeline label="Historial de revisión" items={historyItems(history.data?.items ?? [], 'Hace falta información', value => new Date(value).toLocaleDateString('es-CO'))} />}
      {owner && (org.verificationStatus === 'REJECTED' || (org.verificationStatus === 'PENDING' && history.data?.items[0]?.decision === 'MORE_INFO')) && <form onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(undefined); try { await api(`/organizations/${id}/verification-requests`, { method: 'POST', body: { context: formValue(data, 'context') } }); refresh(); setNotice('Enviamos la información para una nueva revisión.') } catch (value) { setError(value) } finally { setBusy(false) } }}><TextArea label="Información adicional para la revisión" name="context" required rows={4} maxLength={2000} error={error} /><div className="form-actions"><Submit busy={busy}>Reenviar a revisión</Submit></div></form>}
    </Card>
  </>
}

const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED']
export function AdminOrganizations() {
  usePageTitle('Revisión de organizaciones')
  const [status, setStatus] = useState('PENDING'), [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['admin-organizations', status, page], queryFn: () => api<OrganizationPage>(`/admin/organizations?status=${status}&page=${page}`), retry: false })
  return <><PageHeading title="Revisión de organizaciones" lead="Acompaña la incorporación de las organizaciones al piloto." /><div className="status-filter"><ChipGroup legend="Estado">{statuses.map(value => <Chip key={value} type="radio" name="status" value={value} checked={status === value} onChange={() => { setStatus(value); setPage(0) }}>{reviewName(value)}</Chip>)}</ChipGroup></div>{query.isPending ? <p role="status">Consultando solicitudes…</p> : query.error ? <Feedback error={query.error} /> : query.data?.items.length ? <><ul className="row-list">{query.data.items.map(org => <Row key={org.id} leading={<Avatar name={org.name} size="lg" />} badge={<StatusBadge tone={reviewTone(org.verificationStatus)}>{reviewName(org.verificationStatus)}</StatusBadge>} title={org.name} action={<Link className="action" to={`/admin/organizaciones/${org.id}`} aria-label={`Revisar solicitud de ${org.name}`}>Revisar solicitud<Icon name="arrowRight" size={20} /></Link>}>{org.description}</Row>)}</ul><Pagination page={page} totalPages={query.data.totalPages} setPage={setPage} /></> : <EmptyState title="No hay organizaciones en este estado.">Cuando lleguen nuevas solicitudes las verás aquí.</EmptyState>}</>
}
export function AdminReview() {
  usePageTitle('Revisión de organización')
  const { id } = useParams(), client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['organization', id], queryFn: () => api<Organization>(`/organizations/${id}`), retry: false })
  const history = useQuery({ queryKey: ['organization-history', id], queryFn: () => api<Page<Schemas['OrganizationVerification']>>(`/organizations/${id}/verifications?size=100`), retry: false })
  const territories = useTerritories()
  if (query.isPending) return <p role="status">Cargando la solicitud…</p>
  if (query.error) return <Feedback error={query.error} />
  const org = query.data!, decisions = org.verificationStatus === 'PENDING' ? ['APPROVED', 'MORE_INFO', 'REJECTED'] : org.verificationStatus === 'APPROVED' ? ['SUSPENDED'] : org.verificationStatus === 'SUSPENDED' ? ['APPROVED'] : []
  const labels: Record<string, string> = { MORE_INFO: 'Pedir información', APPROVED: org.verificationStatus === 'SUSPENDED' ? 'Rehabilitar' : 'Aprobar', REJECTED: 'Rechazar', SUSPENDED: 'Suspender' }
  const territory = territories.data?.find(item => item.id === org.serviceTerritoryId)?.name, picture = org.cover?.url ?? photoSrc(photoFor(org.id), 800)
  async function decide(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, decision = (event.nativeEvent as SubmitEvent).submitter?.getAttribute('value'), data = new FormData(form)
    if (!decision) return
    setBusy(true); setError(undefined); setNotice('')
    try { await api(`/admin/organizations/${id}/reviews`, { method: 'POST', body: { decision, reason: formValue(data, 'reason') } }); form.reset(); await client.invalidateQueries({ queryKey: ['organization', id] }); await client.invalidateQueries({ queryKey: ['organization-history', id] }); await client.invalidateQueries({ queryKey: ['admin-organizations'] }); setNotice('La decisión quedó registrada.') } catch (value) { setError(value) } finally { setBusy(false) }
  }
  return <section className="review-layout"><Breadcrumbs items={[{ label: 'Organizaciones', to: '/admin/organizaciones' }, { label: 'Revisar organización' }]} /><PageHeading title="Revisar organización" />
    <Card className="review-head"><div className="review-photo"><img src={picture} alt={org.cover ? 'Portada de la organización' : ''} style={org.cover ? undefined : { objectPosition: photo(photoFor(org.id)).focus }} /></div><div><h2>{org.name}</h2><StatusBadge tone={reviewTone(org.verificationStatus)}>{reviewName(org.verificationStatus)}</StatusBadge><p className="preserve-lines">{org.description}</p>
      <DefinitionList items={[{ icon: 'people', term: 'Tipo de organización', children: org.organizationType === 'FORMAL' ? 'Organización formal' : 'Colectivo comunitario' }, { icon: 'pin', term: 'Territorio', children: territory ?? 'Por definir' }, { icon: 'document', term: 'Identificador legal', children: org.legalIdentifier || 'No aplica' }, { icon: 'book', term: 'Contexto para revisión', children: <span className="preserve-lines">{org.verificationContext || 'No se adjuntó contexto adicional.'}</span> }]} /></div></Card>
    <Feedback error={error || history.error} success={notice} />
    {decisions.length > 0 && <form className="card decision-panel" onSubmit={event => void decide(event)}><h2>Decisión</h2><TextArea label="Motivo de la decisión" name="reason" rows={5} required maxLength={1000} placeholder="Escribe el motivo de la decisión…" error={error} /><div className="decision-buttons">{decisions.map((value, index) => <button key={value} type="submit" name="decision" value={value} disabled={busy} className={value === 'APPROVED' ? 'action primary' : decisions.length > 1 && index > 0 && value !== 'MORE_INFO' ? 'action tertiary' : 'action'}>{labels[value]}</button>)}</div><Notice>Solo las organizaciones aprobadas pueden publicar.</Notice></form>}
    <Card as="section" className="history-card"><h2>Decisiones anteriores</h2>{history.data?.items.length ? <Timeline label="Decisiones anteriores" items={historyItems(history.data.items, 'Información solicitada', value => new Date(value).toLocaleString('es-CO'))} /> : <p>Todavía no hay decisiones registradas.</p>}</Card>
  </section>
}
