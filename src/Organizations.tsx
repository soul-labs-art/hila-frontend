import { formValue, nullableValue } from './form-values'
import { reviewName } from './labels'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Field, Select, TextArea, Feedback, Submit } from './components'
import { ImageEditor, ProfileCard, Publication, type Organization } from './ProfileCard'
import { Pagination, type OrganizationPage } from './Profiles'
import { useSession } from './session-context'

type Page<T> = { items: T[]; totalPages: number }
async function allTerritories() {
  const items: Schemas['Territory'][] = []
  for (let page = 0; ; page++) { const data = await api<Page<Schemas['Territory']>>(`/catalogs/territories?size=100&page=${page}`); items.push(...data.items); if (page + 1 >= data.totalPages) return items }
}
export function OrganizationForm({ organization, onSaved }: { organization?: Organization; onSaved?: () => void }) {
  const [type, setType] = useState(organization?.organizationType ?? 'FORMAL'), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>()
  const territories = useQuery({ queryKey: ['territories'], queryFn: allTerritories, retry: false })
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
  return <section className="edit-panel"><h1>{organization ? 'Editar organización' : 'Tu organización tiene un lugar en Hila.'}</h1><p>{organization ? 'Cuida la información que presenta a tu organización.' : 'Registra una fundación o colectivo. Su perfil comienza privado y pasará por una revisión antes de poder publicarse.'}</p><Feedback error={error || territories.error} /><form onSubmit={event => void save(event)}>
    <Field label="Nombre de la organización" name="name" required maxLength={180} defaultValue={organization?.name} error={error} />
    <Select label="Tipo de organización" name="organizationType" value={type} onChange={event => setType(event.target.value as 'FORMAL' | 'COLLECTIVE')} disabled={organization?.verificationStatus === 'APPROVED'}><option value="FORMAL">Organización formal / fundación</option><option value="COLLECTIVE">Colectivo comunitario</option></Select>
    {type === 'FORMAL' && <Field label="NIT o identificador legal" name="legalIdentifier" required maxLength={40} readOnly={organization?.verificationStatus === 'APPROVED'} defaultValue={organization?.legalIdentifier ?? ''} error={error} hint="Esta información se utiliza para la revisión y no se publica." />}
    <TextArea label="Presentación de la organización" name="description" required maxLength={2000} rows={5} defaultValue={organization?.description ?? ''} error={error} />
    <TextArea label={type === 'COLLECTIVE' ? 'Trayectoria y referencias del colectivo' : 'Contexto para la revisión (opcional)'} name="verificationContext" required={type === 'COLLECTIVE'} maxLength={2000} rows={4} defaultValue={organization?.verificationContext ?? ''} hint="Describe sus actividades y trayectoria. Solo el equipo y quienes revisan la solicitud tendrán acceso." error={error} />
    <Select label="Territorio principal" name="serviceTerritoryId" defaultValue={organization?.serviceTerritoryId ?? ''} error={error}><option value="">Por definir</option>{territories.data?.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</Select>
    <div className="form-columns"><Field label="Correo público (opcional)" name="publicEmail" type="email" maxLength={320} defaultValue={organization?.publicEmail ?? ''} error={error} /><Field label="Sitio web público (opcional)" name="publicWebsite" type="url" maxLength={500} placeholder="https://" defaultValue={organization?.publicWebsite ?? ''} error={error} /></div>
    <p>El correo y sitio web anteriores se mostrarán si publicas el perfil. No utilices información que deba permanecer privada.</p><Submit busy={busy}>{organization ? 'Guardar cambios' : 'Registrar y solicitar revisión'}</Submit>
  </form></section>
}
export function OrganizationDetail() {
  const { id } = useParams(), session = useSession(), [editing, setEditing] = useState(false)
  const query = useQuery({ queryKey: ['organization', id], queryFn: () => api<Organization>(`/organizations/${id}`), retry: false })
  const members = useQuery({ queryKey: ['memberships', id], queryFn: () => api<Page<Schemas['Membership']>>(`/organizations/${id}/memberships?size=100`), retry: false })
  const owner = members.data?.items.some(member => member.userId === session.user?.id && member.role === 'ORG_OWNER' && member.status === 'ACTIVE')
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const history = useQuery({ queryKey: ['organization-history', id], queryFn: () => api<Page<Schemas['OrganizationVerification']>>(`/organizations/${id}/verifications?size=100`), retry: false })
  const client = useQueryClient(), refresh = () => { void client.invalidateQueries({ queryKey: ['organization', id] }); void client.invalidateQueries({ queryKey: ['organization-history', id] }); setEditing(false) }
  if (query.isPending) return <p role="status">Cargando la organización…</p>
  if (query.error) return <Feedback error={query.error} />
  const org = query.data!
  if (editing && owner) return <><button className="text-button" onClick={() => setEditing(false)}>Volver al perfil</button><OrganizationForm organization={org} onSaved={() => setEditing(false)} /></>
  return <><div className="page-heading"><Link to="/mis-organizaciones">Mis organizaciones</Link>{owner && <button className="action" onClick={() => setEditing(true)}>Editar organización</button>}</div><Feedback error={members.error} />
    <div className="profile-layout"><ProfileCard name={org.name} subtitle={org.organizationType === 'FORMAL' ? 'Organización formal' : 'Colectivo comunitario'} description={org.description} avatar={org.avatar} cover={org.cover}><span className="status-label">{reviewName(org.verificationStatus)}</span>{org.publicWebsite && <p>{org.publicWebsite}</p>}</ProfileCard><aside className="profile-side"><h2>Estado de la revisión</h2><p>{reviewName(org.verificationStatus)}</p>{org.statusReason && <p>{org.statusReason}</p>}<p>La aprobación habilita el perfil público en el piloto; no constituye una certificación legal.</p></aside></div>
    {owner && <><ImageEditor base={`/organizations/${id}`} images={org} onSaved={refresh} /><Publication base={`/organizations/${id}`} visibility={org.visibility} disabled={org.verificationStatus !== 'APPROVED'} link={`/organizaciones/${id}`} onSaved={refresh} /></>}
    <section className="review-history"><h2>Historial de revisión</h2><Feedback error={history.error || error} success={notice} />{history.isPending ? <p role="status">Consultando el historial…</p> : <ol>{history.data?.items.map(item => <li key={item.id}><strong>{item.decision === 'SUBMITTED' ? 'Solicitud enviada' : item.decision === 'MORE_INFO' ? 'Hace falta información' : reviewName(item.decision)}</strong><time dateTime={item.decidedAt}>{new Date(item.decidedAt).toLocaleDateString('es-CO')}</time>{item.reason && <p>{item.reason}</p>}</li>)}</ol>}
      {owner && (org.verificationStatus === 'REJECTED' || (org.verificationStatus === 'PENDING' && history.data?.items[0]?.decision === 'MORE_INFO')) && <form onSubmit={async event => { event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(undefined); try { await api(`/organizations/${id}/verification-requests`, { method: 'POST', body: { context: formValue(data, 'context') } }); refresh(); setNotice('Enviamos la información para una nueva revisión.') } catch (value) { setError(value) } finally { setBusy(false) } }}><TextArea label="Información adicional para la revisión" name="context" required rows={4} maxLength={2000} error={error} /><Submit busy={busy}>Reenviar a revisión</Submit></form>}
    </section>
  </>
}

export function AdminOrganizations() {
  const [status, setStatus] = useState('PENDING'), [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['admin-organizations', status, page], queryFn: () => api<OrganizationPage>(`/admin/organizations?status=${status}&page=${page}`), retry: false })
  return <><div className="page-heading"><div><h1>Revisión de organizaciones</h1><p>Acompaña la incorporación de las organizaciones al piloto.</p></div><Select label="Estado" name="status" value={status} onChange={event => { setStatus(event.target.value); setPage(0) }}>{['PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED'].map(value => <option key={value} value={value}>{reviewName(value)}</option>)}</Select></div>{query.isPending ? <p role="status">Consultando solicitudes…</p> : query.error ? <Feedback error={query.error} /> : query.data?.items.length ? <><div className="organization-list">{query.data.items.map(org => <article key={org.id}><h2>{org.name}</h2><p>{org.description}</p><Link className="action" to={`/admin/organizaciones/${org.id}`}>Revisar solicitud</Link></article>)}</div><Pagination page={page} totalPages={query.data.totalPages} setPage={setPage} /></> : <p className="empty-state">No hay organizaciones en este estado.</p>}</>
}
export function AdminReview() {
  const { id } = useParams(), client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['organization', id], queryFn: () => api<Organization>(`/organizations/${id}`), retry: false })
  const history = useQuery({ queryKey: ['organization-history', id], queryFn: () => api<Page<Schemas['OrganizationVerification']>>(`/organizations/${id}/verifications?size=100`), retry: false })
  if (query.isPending) return <p role="status">Cargando la solicitud…</p>
  if (query.error) return <Feedback error={query.error} />
  const org = query.data!, decisions = org.verificationStatus === 'PENDING' ? ['MORE_INFO', 'APPROVED', 'REJECTED'] : org.verificationStatus === 'APPROVED' ? ['SUSPENDED'] : org.verificationStatus === 'SUSPENDED' ? ['APPROVED'] : []
  return <section className="review-detail"><Link to="/admin/organizaciones">Volver a la bandeja</Link><h1>{org.name}</h1><span className="status-label">{reviewName(org.verificationStatus)}</span><p>{org.description}</p><dl className="profile-facts"><div><dt>Tipo</dt><dd>{org.organizationType === 'FORMAL' ? 'Formal' : 'Colectivo'}</dd></div><div><dt>Identificador legal</dt><dd>{org.legalIdentifier || 'No aplica'}</dd></div></dl><h2>Contexto para revisión</h2><p className="preserve-lines">{org.verificationContext || 'No se adjuntó contexto adicional.'}</p><Feedback error={error || history.error} success={notice} />
    {decisions.length > 0 && <form onSubmit={async event => { event.preventDefault(); const submittedForm = event.currentTarget; const data = new FormData(submittedForm); setBusy(true); setError(undefined); try { await api(`/admin/organizations/${id}/reviews`, { method: 'POST', body: { decision: formValue(data, 'decision'), reason: formValue(data, 'reason') } }); submittedForm.reset(); await client.invalidateQueries({ queryKey: ['organization', id] }); await client.invalidateQueries({ queryKey: ['organization-history', id] }); await client.invalidateQueries({ queryKey: ['admin-organizations'] }); setNotice('La decisión quedó registrada.') } catch (value) { setError(value) } finally { setBusy(false) } }}><Select label="Decisión" name="decision">{decisions.map(value => <option key={value} value={value}>{({ MORE_INFO: 'Pedir información', APPROVED: org.verificationStatus === 'SUSPENDED' ? 'Rehabilitar' : 'Aprobar', REJECTED: 'Rechazar', SUSPENDED: 'Suspender' })[value]}</option>)}</Select><TextArea label="Motivo de la decisión" name="reason" rows={4} required maxLength={1000} error={error} /><Submit busy={busy}>Registrar decisión</Submit></form>}
    <h2>Decisiones anteriores</h2><ol className="review-history">{history.data?.items.map(item => <li key={item.id}><strong>{item.decision === 'SUBMITTED' ? 'Solicitud enviada' : item.decision === 'MORE_INFO' ? 'Información solicitada' : reviewName(item.decision)}</strong><time dateTime={item.decidedAt}>{new Date(item.decidedAt).toLocaleString('es-CO')}</time><p>{item.reason}</p></li>)}</ol>
  </section>
}
