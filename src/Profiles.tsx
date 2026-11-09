import { usePageTitle } from './page-title'
import { formValue, nullableValue } from './form-values'
import { modalityName, reviewName, reviewTone } from './labels'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Field, Select, TextArea, Feedback, PageHeading, Row, StatusBadge, Submit } from './components'
import { ImageEditor, ProfileCard, Publication, VisibilityBadge, type Organization } from './ProfileCard'
import { useSession } from './session-context'
import { loadVolunteer } from './volunteer'

export function Account() {
  usePageTitle('Mi cuenta')
  const { user } = useSession()
  const hasProfile = !!user?.volunteerProfileExists
  return <section className="account-welcome"><PageHeading title={`Qué bueno encontrarte, ${user?.displayName}.`} lead="Este es tu espacio para compartir lo que puedes aportar y acompañar a tus organizaciones." /><ul className="row-list">
    <Row title="Mi perfil voluntario" badge={<StatusBadge tone={hasProfile ? 'ok' : 'neutral'}>{hasProfile ? 'Perfil creado' : 'Sin crear'}</StatusBadge>} action={<Link className="action primary" to="/mi-perfil">{hasProfile ? 'Ver mi perfil' : 'Crear mi perfil'}</Link>}>Cuenta quién eres, lo que sabes hacer y cómo te gustaría participar.</Row>
    <Row title="Mis organizaciones" action={<Link className="action" to="/mis-organizaciones">Ver mis organizaciones</Link>}>Registra una fundación o colectivo y prepara su presentación para el piloto.</Row>
    <Row title="Privacidad y avisos" action={<Link className="action" to="/mi-cuenta/privacidad">Revisar mi privacidad</Link>}>Consulta lo que aceptaste y decide si quieres recibir avisos de oportunidades por correo.</Row>
  </ul><p className="callout">Las convocatorias todavía están en preparación. Puedes avanzar con tu perfil mientras se incorporan organizaciones del territorio.</p></section>
}
export function VolunteerPage() {
  usePageTitle('Mi perfil')
  const session = useSession(), client = useQueryClient(), [editing, setEditing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['volunteer'], queryFn: loadVolunteer, retry: false })
  const profile = query.data
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
  return <><PageHeading title="Mi perfil voluntario" lead="Tu forma de presentarte a la red.">{profile && <button className="action" onClick={() => { setEditing(!editing); setError(undefined) }}>{editing ? 'Volver al perfil' : 'Editar perfil'}</button>}</PageHeading><Feedback error={error} success={notice} />
    {(!profile || editing) ? <section className="edit-panel"><h2>{profile ? 'Editar mi información' : 'Cuéntanos sobre ti'}</h2><p>Tu perfil empieza privado. Podrás revisar su presentación antes de publicarlo.</p><form onSubmit={event => void save(event)}>
      <Field label="Tu nombre" name="displayName" defaultValue={session.user?.displayName} required maxLength={140} error={error} autoComplete="name" />
      <TextArea label="Presentación" name="biography" defaultValue={profile?.biography ?? ''} maxLength={1200} rows={5} hint="Qué te mueve y qué te gustaría aportar. Hasta 1200 caracteres." error={error} />
      <div className="form-columns"><Field label="Profesión u oficio (opcional)" name="profession" defaultValue={profile?.profession ?? ''} maxLength={140} error={error} /><Field label="Nivel educativo (opcional y privado)" name="educationLevel" defaultValue={profile?.educationLevel ?? ''} maxLength={80} error={error} /></div>
      <Select label="Modalidad preferida" name="preferredModality" defaultValue={profile?.preferredModality ?? ''} error={error}><option value="">Por definir</option><option value="IN_PERSON">Presencial</option><option value="REMOTE">Remoto</option><option value="HYBRID">Híbrido</option></Select>
      <Submit busy={busy}>Guardar perfil</Submit>
    </form></section> : <div className="profile-layout"><ProfileCard headingLevel={2} name={session.user!.displayName} description={profile.biography || 'Todavía no has escrito tu presentación.'} subtitle="Persona voluntaria" avatar={profile.avatar} cover={profile.cover}><dl className="profile-facts"><div><dt>Profesión u oficio</dt><dd>{profile.profession || 'Por completar'}</dd></div><div><dt>Modalidad</dt><dd>{modalityName(profile.preferredModality)}</dd></div></dl></ProfileCard><aside className="profile-side"><h2>Lo que compartes</h2><p>Tu nombre, presentación, oficio, modalidad e imágenes se verán si publicas el perfil.</p><p>Tu correo y nivel educativo permanecen privados.</p><VisibilityBadge visibility={profile.visibility} /></aside></div>}
    {profile && !editing && <><ImageEditor base="/me/volunteer-profile" images={profile} onSaved={refresh} /><Publication base="/me/volunteer-profile" visibility={profile.visibility} link={`/voluntarios/${profile.userId}`} onSaved={refresh} /></>}
  </>
}

export function PublicProfile({ organization = false }: { organization?: boolean }) {
  usePageTitle(organization ? 'Perfil de organización' : 'Perfil de voluntario')
  const { id } = useParams()
  const query = useQuery<Schemas['PublicOrganization'] | Schemas['PublicVolunteer']>({ queryKey: ['public-profile', organization, id], queryFn: () => organization
    ? api<Schemas['PublicOrganization']>(`/organizations/${id}/public-profile`)
    : api<Schemas['PublicVolunteer']>(`/volunteers/${id}/public-profile`), retry: false })
  if (query.isPending) return <p role="status">Cargando el perfil…</p>
  if (query.error) return query.error instanceof ApiFailure && query.error.status === 404 ? <section className="empty-state"><h1>Este perfil no está disponible.</h1><p>Puede ser privado o ya no estar publicado. Sus datos no se muestran.</p><Link className="action" to="/">Volver al inicio</Link></section> : <><Feedback error={query.error} /><button className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  const person = !organization ? query.data as Schemas['PublicVolunteer'] : null, org = organization ? query.data as Schemas['PublicOrganization'] : null
  return <div className="public-profile"><ProfileCard name={person?.displayName ?? org!.name} description={person?.biography ?? org?.description} subtitle={person ? 'Persona voluntaria' : 'Organización aprobada en Hila'} avatar={query.data!.avatar} cover={query.data!.cover}>
    {person && <dl className="profile-facts"><div><dt>Profesión u oficio</dt><dd>{person.profession || 'Por definir'}</dd></div><div><dt>Modalidad</dt><dd>{modalityName(person.preferredModality)}</dd></div></dl>}
    {org && <><p>{org.serviceTerritory?.name || 'Territorio por definir'}</p><div className="actions">{org.publicEmail && <a className="action primary" href={`mailto:${org.publicEmail}`}>Escribir a la organización</a>}{org.publicWebsite && /^https?:\/\//i.test(org.publicWebsite) && <a className="action" href={org.publicWebsite} target="_blank" rel="noopener noreferrer">Visitar sitio web</a>}</div></>}
  </ProfileCard><p className="public-context">{org ? 'La aprobación habilita la participación en el piloto de Hila; no constituye una certificación legal.' : 'Cada persona decide qué compartir y cuándo publicar su perfil.'}</p></div>
}

export type OrganizationPage = { items: Organization[]; page: number; size: number; totalElements: number; totalPages: number }
export function OrganizationList() {
  usePageTitle('Mis organizaciones')
  const [page, setPage] = useState(0)
  const query = useQuery({ queryKey: ['organizations', page], queryFn: () => api<OrganizationPage>(`/me/organizations?page=${page}`), retry: false })
  return <><PageHeading title="Mis organizaciones" lead="Fundaciones y colectivos que acompañas."><Link className="action primary" to="/organizaciones/nueva">Registrar organización</Link></PageHeading>{query.isPending ? <p role="status">Cargando organizaciones…</p> : query.error ? <Feedback error={query.error} /> : query.data?.items.length ? <><ul className="row-list">{query.data.items.map(org => <Row key={org.id} badge={<StatusBadge tone={reviewTone(org.verificationStatus)}>{reviewName(org.verificationStatus)}</StatusBadge>} title={org.name} action={<Link className="action" to={`/organizaciones/${org.id}/editar`} aria-label={`Abrir organización ${org.name}`}>Abrir organización</Link>}>{org.description}</Row>)}</ul><Pagination page={page} totalPages={query.data.totalPages} setPage={setPage} /></> : <section className="empty-state"><h2>Aquí comienza tu organización.</h2><p>Puedes registrar una fundación formal o un colectivo sin NIT. Hila revisará su información antes de habilitar su perfil público.</p></section>}</>
}
export function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (page: number) => void }) { return totalPages > 1 ? <nav className="pagination" aria-label="Páginas de resultados"><button className="action" disabled={!page} onClick={() => setPage(page - 1)}>Anterior</button><span>Página {page + 1} de {totalPages}</span><button className="action" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Siguiente</button></nav> : null }
