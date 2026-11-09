import { usePageTitle } from './page-title'
import { formValue, nullableValue } from './form-values'
import { modalityName, reviewName, reviewTone } from './labels'
import { lazy, Suspense, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Field, Select, TextArea, Feedback, PageHeading, Row, StatusBadge, Submit } from './components'
import { features } from './features'
import { ImageEditor, ProfileCard, Publication, VisibilityBadge, type Organization } from './ProfileCard'
import { photoFor } from './cover-photo'
import { Avatar, Card, DefinitionList, EmptyState, Icon, Notice, Stepper, type IconName } from './ui'
import { useSession } from './session-context'
import { loadVolunteer, profileSteps } from './volunteer'

// Los pasos de capacidades solo existen en desarrollo con datos de ejemplo; el build de producción descarta el módulo.
const CapabilityStep = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true' ? lazy(() => import('./Capabilities').then(module => ({ default: module.CapabilityStep }))) : null
export function Account() {
  usePageTitle('Mi cuenta')
  const { user } = useSession()
  const hasProfile = !!user?.volunteerProfileExists
  return <section className="account-welcome"><div className="hello"><Avatar name={user?.displayName ?? ''} size="lg" /><PageHeading title={`Qué bueno encontrarte, ${user?.displayName}.`} lead="Este es tu espacio para compartir lo que puedes aportar y acompañar a tus organizaciones." /></div><ul className="feature-cards">
    <FeatureCard icon="person" title="Mi perfil voluntario" badge={<StatusBadge tone={hasProfile ? 'ok' : 'neutral'}>{hasProfile ? 'Perfil creado' : 'Sin crear'}</StatusBadge>} action={<Link className="action primary" to="/mi-perfil">{hasProfile ? 'Ver mi perfil' : 'Crear mi perfil'}<Icon name="arrowRight" size={20} /></Link>}>Cuenta quién eres, lo que sabes hacer y cómo te gustaría participar.</FeatureCard>
    <FeatureCard icon="people" title="Mis organizaciones" action={<Link className="action" to="/mis-organizaciones">Ver mis organizaciones<Icon name="arrowRight" size={20} /></Link>}>Registra una fundación o colectivo y prepara su presentación para el piloto.</FeatureCard>
    <FeatureCard icon="lock" title="Privacidad y avisos" action={<Link className="action" to="/mi-cuenta/privacidad">Revisar mi privacidad<Icon name="arrowRight" size={20} /></Link>}>Consulta lo que aceptaste y decide si quieres recibir avisos de oportunidades por correo.</FeatureCard>
  </ul>{!features.opportunities && <Notice icon="sprout">Las convocatorias todavía están en preparación. Puedes avanzar con tu perfil mientras se incorporan organizaciones del territorio.</Notice>}</section>
}
function FeatureCard({ icon, title, badge, action, children }: { icon: IconName; title: string; badge?: React.ReactNode; action: React.ReactNode; children: React.ReactNode }) {
  return <Card as="li" className="feature-card"><span className="row-icon" aria-hidden="true"><Icon name={icon} size={26} /></span><h2>{title}</h2>{badge}<p>{children}</p>{action}</Card>
}
export function VolunteerPage() {
  usePageTitle('Mi perfil')
  const session = useSession(), client = useQueryClient(), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['volunteer'], queryFn: loadVolunteer, retry: false }), [params, setParams] = useSearchParams()
  const profile = query.data, wizard = features.capabilities && !!profile, slugs = ['datos', 'capacidades', 'disponibilidad'], step = wizard ? Math.max(0, slugs.indexOf(params.get('paso') ?? '')) : 0
  function go(next: number) { setParams(next ? { paso: slugs[next] } : {}); setEditing(false); setError(undefined); setNotice(''); requestAnimationFrame(() => document.getElementById('step-panel')?.focus()) }
  const refresh = () => { void client.invalidateQueries({ queryKey: ['volunteer'] }); void session.refresh() }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setBusy(true); setError(undefined); setNotice('')
    try {
      if (formValue(data, 'displayName') !== session.user?.displayName) await api('/me', { method: 'PATCH', body: { displayName: formValue(data, 'displayName') } })
      await api('/me/volunteer-profile', { method: 'PUT', body: { biography: nullableValue(data, 'biography'), profession: nullableValue(data, 'profession'), educationLevel: nullableValue(data, 'educationLevel'), preferredModality: nullableValue(data, 'preferredModality') } })
      refresh(); setEditing(false); setNotice('Tu perfil quedó guardado.')
    } catch (value) { setError(value) } finally { setBusy(false) }
  }
  if (query.isPending) return <p className="loading-state" role="status">Cargando tu perfil…</p>
  if (query.error) return <><Feedback error={query.error} /><button className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  return <><PageHeading title="Mi perfil voluntario" lead={features.capabilities ? 'Cuéntanos sobre ti para encontrar oportunidades que se ajusten a tus intereses y disponibilidad.' : 'Tu forma de presentarte a la red.'}>{profile && step === 0 && <button className="action" onClick={() => { setEditing(!editing); setError(undefined) }}>{editing ? 'Volver al perfil' : 'Editar perfil'}</button>}</PageHeading>{features.capabilities && <Stepper steps={profileSteps} current={step} onStep={profile ? go : undefined} />}<Feedback error={error} success={notice} />
    <div id="step-panel" className="step-panel" tabIndex={-1} role="group" aria-label={wizard ? `Paso ${step + 1} de ${profileSteps.length}: ${profileSteps[step]}` : undefined}>
    {CapabilityStep && step > 0 && profile && <Suspense fallback={<p className="loading-state" role="status">Cargando…</p>}><CapabilityStep step={step} profile={profile} onStep={go} onSaved={refresh} /></Suspense>}
    {step === 0 && <>{(!profile || editing) ? <Card as="section" className="edit-panel"><h2>{profile ? 'Editar mi información' : 'Cuéntanos sobre ti'}</h2><p className="panel-lead">Tu perfil empieza privado. Podrás revisar su presentación antes de publicarlo.</p><form onSubmit={event => void save(event)}>
      <Field label="Tu nombre" name="displayName" defaultValue={session.user?.displayName} required maxLength={140} error={error} autoComplete="name" />
      <TextArea label="Presentación" name="biography" defaultValue={profile?.biography ?? ''} maxLength={1200} rows={5} hint="Qué te mueve y qué te gustaría aportar. Hasta 1200 caracteres." error={error} />
      <div className="form-columns"><Field label="Profesión u oficio (opcional)" name="profession" defaultValue={profile?.profession ?? ''} maxLength={140} error={error} /><Field label="Nivel educativo (opcional y privado)" name="educationLevel" defaultValue={profile?.educationLevel ?? ''} maxLength={80} error={error} /></div>
      <Select label="Modalidad preferida" name="preferredModality" defaultValue={profile?.preferredModality ?? ''} error={error}><option value="">Por definir</option><option value="IN_PERSON">Presencial</option><option value="REMOTE">Remoto</option><option value="HYBRID">Híbrido</option></Select>
      <div className="form-actions"><Submit busy={busy}>Guardar perfil</Submit></div>
    </form></Card> : <div className="profile-layout"><ProfileCard headingLevel={2} name={session.user!.displayName} description={profile.biography || 'Todavía no has escrito tu presentación.'} subtitle="Persona voluntaria" avatar={profile.avatar} cover={profile.cover}><DefinitionList items={[{ icon: 'tag', term: 'Profesión u oficio', children: profile.profession || 'Por completar' }, { icon: 'pin', term: 'Modalidad', children: modalityName(profile.preferredModality) }]} /></ProfileCard><Card as="aside" tone="soft" className="profile-side"><h2>Lo que compartes</h2><p>Tu nombre, presentación, oficio, modalidad e imágenes se verán si publicas el perfil.</p><p>Tu correo y nivel educativo permanecen privados.</p><div><VisibilityBadge visibility={profile.visibility} /></div></Card></div>}
    {profile && !editing && <><ImageEditor base="/me/volunteer-profile" images={profile} onSaved={refresh} /><Publication base="/me/volunteer-profile" visibility={profile.visibility} link={`/voluntarios/${profile.userId}`} onSaved={refresh} /></>}</>}
    {step === 0 && wizard && !editing && <div className="step-footer"><span /><button type="button" className="action" onClick={() => go(1)}>{profileSteps[1]}<Icon name="arrowRight" size={20} /></button></div>}
    </div>
  </>
}

export function PublicProfile({ organization = false }: { organization?: boolean }) {
  usePageTitle(organization ? 'Perfil de organización' : 'Perfil de voluntario')
  const { id } = useParams()
  const query = useQuery<Schemas['PublicOrganization'] | Schemas['PublicVolunteer']>({ queryKey: ['public-profile', organization, id], queryFn: () => organization
    ? api<Schemas['PublicOrganization']>(`/organizations/${id}/public-profile`)
    : api<Schemas['PublicVolunteer']>(`/volunteers/${id}/public-profile`), retry: false })
  if (query.isPending) return <p role="status">Cargando el perfil…</p>
  if (query.error) return query.error instanceof ApiFailure && query.error.status === 404 ? <EmptyState headingLevel={1} title="Este perfil no está disponible." action={<Link className="action primary" to="/">Volver al inicio</Link>}>Puede ser privado o ya no estar publicado. Sus datos no se muestran.</EmptyState> : <><Feedback error={query.error} /><button className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  const person = !organization ? query.data as Schemas['PublicVolunteer'] : null, org = organization ? query.data as Schemas['PublicOrganization'] : null
  return <div className="public-profile"><ProfileCard name={person?.displayName ?? org!.name} description={person?.biography ?? org?.description} subtitle={person ? 'Persona voluntaria' : 'Organización aprobada en Hila'} avatar={query.data!.avatar} cover={query.data!.cover} fallbackPhoto={org ? photoFor(id ?? org.name) : undefined}>
    {person && <DefinitionList items={[{ icon: 'tag', term: 'Profesión u oficio', children: person.profession || 'Por definir' }, { icon: 'pin', term: 'Modalidad', children: modalityName(person.preferredModality) }]} />}
    {org && <><DefinitionList items={[{ icon: 'pin', term: 'Territorio', children: org.serviceTerritory?.name || 'Territorio por definir' }]} /><div className="actions">{org.publicEmail && <a className="action primary" href={`mailto:${org.publicEmail}`}><Icon name="mail" size={20} />Escribir a la organización</a>}{org.publicWebsite && /^https?:\/\//i.test(org.publicWebsite) && <a className="action" href={org.publicWebsite} target="_blank" rel="noopener noreferrer">Visitar sitio web</a>}</div></>}
  </ProfileCard><p className="public-context">{org ? 'La aprobación habilita la participación en el piloto de Hila; no constituye una certificación legal.' : 'Cada persona decide qué compartir y cuándo publicar su perfil.'}</p></div>
}

export type OrganizationPage = { items: Organization[]; page: number; size: number; totalElements: number; totalPages: number }
export function OrganizationList() {
  usePageTitle('Mis organizaciones')
  const [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['organizations', page], queryFn: () => api<OrganizationPage>(`/me/organizations?page=${page}`), retry: false })
  return <><PageHeading title="Mis organizaciones" lead="Fundaciones y colectivos que acompañas."><Link className="action primary" to="/organizaciones/nueva"><Icon name="plus" size={20} />Registrar organización</Link></PageHeading>{query.isPending ? <p role="status">Cargando organizaciones…</p> : query.error ? <Feedback error={query.error} /> : query.data?.items.length ? <><ul className="row-list">{query.data.items.map(org => <Row key={org.id} leading={<Avatar name={org.name} size="lg" />} badge={<StatusBadge tone={reviewTone(org.verificationStatus)}>{reviewName(org.verificationStatus)}</StatusBadge>} title={org.name} action={<Link className="action" to={`/organizaciones/${org.id}/editar`} aria-label={`Abrir organización ${org.name}`}>Abrir organización<Icon name="arrowRight" size={20} /></Link>}>{org.description}</Row>)}</ul><Pagination page={page} totalPages={query.data.totalPages} setPage={setPage} /></> : <EmptyState title="Aquí comienza tu organización.">Puedes registrar una fundación formal o un colectivo sin NIT. Hila revisará su información antes de habilitar su perfil público.</EmptyState>}</>
}
export function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (page: number) => void }) { return totalPages > 1 ? <nav className="pagination" aria-label="Páginas de resultados"><button className="action" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {totalPages}</span><button className="action" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></nav> : null }
