// Explorar oportunidades y detalle de una necesidad (planned: solo con features.opportunities; la postulación, con features.applications).
import { useState, type FormEvent } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, Select, StatusBadge, Submit, TextArea } from './components'
import { features } from './features'
import { modalityName } from './labels'
import { dayEnd, dayStart, needPhoto, placeLabel, proficiencyName, slotsLabel, territoryGroups, whenLabel, isPast } from './need-format'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Pagination } from './Profiles'
import { useSession } from './session-context'
import { loadVolunteer } from './volunteer'
import { Breadcrumbs, Card, DefinitionList, EmptyState, Icon, Notice, Toggle, type IconName } from './ui'
import './explore.css'

type Need = Schemas['PublicNeed']
const pageSize = 12
const territoriesQuery = { queryKey: ['catalog', 'territories'], queryFn: () => api<Schemas['TerritoryPage']>('/catalogs/territories?size=100'), staleTime: 300_000, retry: false }
const skillsQuery = { queryKey: ['catalog', 'skills'], queryFn: () => api<Schemas['SkillPage']>('/catalogs/skills?size=100'), staleTime: 300_000, retry: false }
const keys = ['q', 'territorio', 'modalidad', 'habilidad', 'desde', 'hasta'] as const

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) { return <li><Icon name={icon} size={20} /><span>{children}</span></li> }

function NeedCard({ need, territories, from }: { need: Need; territories: Schemas['Territory'][]; from: string }) {
  const pic = needPhoto(need), full = need.slotsAvailable === 0
  return <li><Card as="article" className="need-card" aria-labelledby={`need-${need.id}`}>
    <div className="need-photo"><img src={photoSrc(pic, 800)} alt="" loading="lazy" style={{ objectPosition: photo(pic).focus }} /></div>
    <div className="need-body"><h2 id={`need-${need.id}`}>{need.title}</h2>
      <ul className="need-meta"><Meta icon="people">{need.organization.name}</Meta><Meta icon="pin">{placeLabel(need, territories)}</Meta><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="person">{full ? <StatusBadge tone="wait">Cupos completos</StatusBadge> : slotsLabel(need)}</Meta></ul>
      <Link className="action primary" to={`/explorar/${need.id}`} state={{ from }} aria-label={`Ver necesidad: ${need.title}`}>Ver necesidad<Icon name="arrowRight" size={20} /></Link></div>
  </Card></li>
}
function Skeleton() {
  return <ul className="need-grid" aria-hidden="true">{[0, 1, 2, 3].map(item => <li key={item}><div className="card need-card skeleton"><div className="need-photo" /><div className="need-body"><span className="sk-line w70" /><span className="sk-line w50" /><span className="sk-line w60" /><span className="sk-line w40" /><span className="sk-button" /></div></div></li>)}</ul>
}

/** Aviso por correo desde el estado vacío: mismo interruptor que Privacidad y avisos. */
function AlertsBox() {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const volunteer = useQuery({ queryKey: ['volunteer'], queryFn: loadVolunteer, retry: false }), policies = useQuery({ queryKey: ['policies'], queryFn: () => api<Schemas['Policy'][]>('/policies/current'), retry: false })
  const policy = policies.data?.find(item => item.type === 'OPPORTUNITY_ALERTS')
  async function change(value: boolean) {
    if (!policy) return
    setBusy(true); setError(undefined); setNotice('')
    try { await api('/me/opportunity-alerts', { method: 'PUT', body: { enabled: value, policyVersion: policy.version } }); await client.invalidateQueries({ queryKey: ['volunteer'] }); setNotice(value ? 'Activamos los avisos por correo.' : 'Desactivamos los avisos por correo.') } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  if (volunteer.isPending || policies.isPending) return null
  if (volunteer.error || policies.error) return <Feedback error={volunteer.error ?? policies.error} />
  return <div className="alerts-box"><Notice icon="sprout">Puedes preparar tu perfil sin pertenecer a una organización. <Link to="/mi-perfil">Ir a mi perfil</Link></Notice>
    {volunteer.data ? <><Feedback error={error} success={notice} /><Card tone="flat" className="alerts-card"><Toggle icon="mail" label="Recibir avisos por correo" hint="Te escribimos cuando haya oportunidades que encajen con tu perfil." checked={!!volunteer.data.emailOpportunityAlerts} disabled={busy || !policy} onChange={value => void change(value)} onText="Activados" offText="Desactivados" /></Card></>
      : <Notice icon="person">Para recibir avisos necesitas tu perfil voluntario. <Link to="/mi-perfil">Crear mi perfil</Link></Notice>}
  </div>
}

export function Explore() {
  usePageTitle('Explorar oportunidades')
  const [params, setParams] = useSearchParams(), [open, setOpen] = useState(false)
  const value = (key: (typeof keys)[number]) => params.get(key) ?? '', page = Math.max(0, Number(params.get('pagina')) || 0)
  const active = keys.filter(key => value(key)).length, badRange = !!value('desde') && !!value('hasta') && value('hasta') < value('desde')
  const territories = useQuery(territoriesQuery), skills = useQuery(skillsQuery)
  const search = new URLSearchParams({ size: String(pageSize), page: String(page) })
  if (value('q')) search.set('q', value('q')); if (value('territorio')) search.set('territoryId', value('territorio')); if (value('modalidad')) search.set('modality', value('modalidad')); if (value('habilidad')) search.set('skillId', value('habilidad'))
  if (value('desde')) search.set('startsFrom', dayStart(value('desde'))); if (value('hasta') && !badRange) search.set('startsTo', dayEnd(value('hasta')))
  const needs = useQuery({ queryKey: ['needs', search.toString()], queryFn: () => api<Schemas['PublicNeedPage']>(`/needs?${search}`), retry: false, placeholderData: keepPreviousData, enabled: !badRange })
  function change(key: string, next: string) { const copy = new URLSearchParams(params); if (next) copy.set(key, next); else copy.delete(key); copy.delete('pagina'); setParams(copy, { replace: true }) }
  const clear = () => setParams({}, { replace: true }), items = needs.data?.items ?? [], total = needs.data?.totalElements ?? 0
  const empty = !needs.isPending && !needs.error && !badRange && total === 0, bare = empty && active === 0
  const groups = territoryGroups(territories.data?.items ?? []), byCategory = [...(skills.data?.items ?? []).reduce((map, skill) => map.set(skill.category, [...(map.get(skill.category) ?? []), skill]), new Map<string, Schemas['Skill'][]>())].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  const from = params.toString() ? `?${params}` : ''
  const filters = <section className="filters" aria-labelledby="filters-title"><h2 id="filters-title" className="sr-only">Filtros</h2>
    <button type="button" className="action filters-toggle" aria-expanded={open} aria-controls="filters-panel" onClick={() => setOpen(!open)}><Icon name="filter" size={20} />Filtros{active > 0 && ` (${active})`}<Icon name={open ? 'chevronUp' : 'chevronDown'} size={18} /></button>
    <Card as="div" id="filters-panel" className={`filters-panel${open ? ' is-open' : ''}`}>
      <form role="search" aria-label="Buscar oportunidades" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); change('q', String(new FormData(event.currentTarget).get('q') ?? '').trim()) }}>
        <Field key={value('q')} label="Buscar" name="q" type="search" defaultValue={value('q')} maxLength={140} placeholder="Palabra o tema" adornment={<button type="submit" className="field-toggle" aria-label="Buscar"><Icon name="search" size={22} /></button>} />
      </form>
      <div className="filter-fields">
        <div className="filter-field"><Icon name="pin" size={20} /><Select label="Territorio" name="territorio" value={value('territorio')} onChange={event => change('territorio', event.target.value)}><option value="">Todos</option>{groups.map(group => <optgroup key={group.label} label={group.label}>{group.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</Select></div>
        <div className="filter-field"><Icon name="people" size={20} /><Select label="Modalidad" name="modalidad" value={value('modalidad')} onChange={event => change('modalidad', event.target.value)}><option value="">Todas</option><option value="IN_PERSON">Presencial</option><option value="REMOTE">Remoto</option><option value="HYBRID">Híbrido</option></Select></div>
        <div className="filter-field"><Icon name="tag" size={20} /><Select label="Habilidad requerida o deseable" name="habilidad" value={value('habilidad')} onChange={event => change('habilidad', event.target.value)}><option value="">Todas</option>{byCategory.map(([category, list]) => <optgroup key={category} label={category}>{list.sort((a, b) => a.name.localeCompare(b.name, 'es')).map(skill => <option key={skill.id} value={skill.id}>{skill.name}</option>)}</optgroup>)}</Select></div>
        <fieldset className="filter-dates"><legend>Horario</legend><div className="filter-field"><Icon name="calendar" size={20} /><Field label="Desde" name="desde" type="date" value={value('desde')} onChange={event => change('desde', event.target.value)} /></div><div className="filter-field"><Icon name="calendar" size={20} /><Field label="Hasta" name="hasta" type="date" min={value('desde') || undefined} value={value('hasta')} onChange={event => change('hasta', event.target.value)} /></div>{badRange && <small className="field-error" role="alert">La fecha final no puede ser anterior a la inicial.</small>}</fieldset>
      </div>
      <button type="button" className="clear-filters" disabled={active === 0} onClick={clear}><Icon name="refresh" size={20} />Limpiar filtros</button>
    </Card></section>
  return <div className="explore">
    <PageHeading title="Oportunidades en tu territorio" lead="Encuentra actividades de voluntariado en Medellín y el Valle de Aburrá." />
    {territories.error || skills.error ? <Feedback error={territories.error ?? skills.error} /> : null}
    <div className={`explore-layout${bare ? ' is-bare' : ''}`}>
      {!bare && filters}
      <div className="explore-results" aria-busy={needs.isFetching}>
        {needs.error ? <><Feedback error={needs.error} /><button type="button" className="action" onClick={() => void needs.refetch()}>Volver a intentar</button></>
          : needs.isPending ? <><p className="sr-only" role="status">Cargando oportunidades…</p><Skeleton /></>
          : bare ? <EmptyState className="explore-empty" title="Aún no hay oportunidades publicadas">Cuando las organizaciones publiquen necesidades, las verás aquí.{features.notifications && ' Activa los avisos si quieres enterarte primero.'}</EmptyState>
          : <><div className="result-bar"><p className="result-count" role="status">{badRange ? 'Revisa el rango de fechas.' : `${total} ${total === 1 ? 'oportunidad encontrada' : 'oportunidades encontradas'}`}</p><p className="result-order">Primero las más próximas</p></div>
            {empty ? <EmptyState title="Ninguna oportunidad coincide con tus filtros" action={<button type="button" className="action primary" onClick={clear}>Limpiar filtros</button>}>Prueba con otro territorio, otra fecha o quita alguna habilidad.</EmptyState>
              : <ul className="need-grid">{items.map(need => <NeedCard key={need.id} need={need} territories={territories.data?.items ?? []} from={from} />)}</ul>}
            <Pagination page={page} totalPages={needs.data?.totalPages ?? 0} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} /></>}
        {bare && features.notifications && <AlertsBox />}
      </div>
    </div>
  </div>
}

const criteria: Record<Schemas['MatchCriterion']['criterion'], string> = { SKILLS: 'Habilidades', AVAILABILITY: 'Horario', MODALITY: 'Modalidad', TERRITORY: 'Territorio', RESOURCES: 'Recursos' }
const verdict = { MATCH: { text: 'Compatible', icon: 'check' }, PARTIAL: { text: 'En parte', icon: 'alert' }, MISSING: { text: 'No coincide', icon: 'alert' }, NOT_APPLICABLE: { text: 'No aplica', icon: 'info' } } as const

function Compatibility({ needId, hasProfile }: { needId: string; hasProfile: boolean }) {
  const query = useQuery({ queryKey: ['compatibility', needId], queryFn: () => api<Schemas['Compatibility']>(`/needs/${needId}/compatibility`), retry: false, enabled: hasProfile })
  if (!hasProfile || (query.error instanceof ApiFailure && query.error.detail.code === 'PROFILE_NOT_FOUND')) return <section aria-labelledby="compat-title"><h2 id="compat-title">Tu compatibilidad</h2><Notice icon="person">Con tu perfil verás qué tanto encajas con esta actividad.{!features.applications && <> <Link to="/mi-perfil">Crear mi perfil</Link></>}</Notice></section>
  return <section aria-labelledby="compat-title"><h2 id="compat-title">Tu compatibilidad</h2>
    {query.isPending ? <p className="loading-state" role="status">Calculando tu compatibilidad…</p> : query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
      : <ul className="compat-list">{query.data.criteria.map(item => { const shown = verdict[item.status]
        return <li key={item.criterion} className={`compat-${item.status.toLowerCase().replace('_', '-')}`}><span className="compat-icon" aria-hidden="true"><Icon name={shown.icon} size={16} /></span><div><p><strong>{criteria[item.criterion]}</strong><span className="compat-state">{shown.text}{item.status !== 'NOT_APPLICABLE' && <> · {item.required ? 'obligatoria' : 'deseable'}</>}</span></p><p className="compat-reason">{item.reason}</p></div></li> })}</ul>}
  </section>
}

const statusCopy = { ACCEPTED: 'Te aceptaron en esta actividad', REJECTED: 'Esta vez no continuaron con tu postulación', WITHDRAWN: 'Retiraste tu postulación' } as const
function Apply({ need, hasProfile }: { need: Need; hasProfile: boolean }) {
  const client = useQueryClient(), [form, setForm] = useState(false), [confirm, setConfirm] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const mine = useQuery({ queryKey: ['my-applications'], queryFn: () => api<Schemas['ApplicationPage']>('/me/applications?size=100'), retry: false })
  const current = mine.data?.items.find(item => item.needId === need.id)
  const code = error instanceof ApiFailure ? error.detail.code : undefined
  const refresh = () => Promise.all([client.invalidateQueries({ queryKey: ['my-applications'] }), client.invalidateQueries({ queryKey: ['need', need.id] }), client.invalidateQueries({ queryKey: ['needs'] })])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const message = String(new FormData(event.currentTarget).get('message') ?? '').trim(); setBusy(true); setError(undefined); setNotice('')
    try { await api(`/needs/${need.id}/applications`, { method: 'POST', body: { message: message || null } }); await refresh(); setForm(false); setNotice('Enviamos tu postulación.') } catch (failure) { setError(failure); if (failure instanceof ApiFailure && ['APPLICATION_EXISTS', 'NO_SLOTS_AVAILABLE'].includes(failure.detail.code)) { setForm(false); void refresh() } } finally { setBusy(false) }
  }
  async function withdraw(id: string) {
    setBusy(true); setError(undefined); setNotice('')
    try { await api(`/applications/${id}/withdrawal`, { method: 'POST' }); await refresh(); setConfirm(false) } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  if (mine.isPending) return <p className="loading-state" role="status">Consultando tu postulación…</p>
  if (mine.error) return <><Feedback error={mine.error} /><button type="button" className="action" onClick={() => void mine.refetch()}>Volver a intentar</button></>
  const feedback = <><Feedback error={error} success={notice} />{code === 'PROFILE_NOT_FOUND' && <p><Link to="/mi-perfil">Crear mi perfil</Link></p>}</>
  if (current) return <div className="apply-box">{feedback}
    {current.status === 'APPLIED' ? <><Notice icon="people"><strong>La organización revisa tu postulación.</strong> Te avisaremos cuando responda.</Notice>
      {confirm ? <div className="confirm-box" role="group" aria-label="Confirmar retiro"><Notice tone="warning">Si retiras tu postulación no podrás volver a postularte a esta actividad.</Notice><div className="actions"><button type="button" className="action primary" disabled={busy} onClick={() => void withdraw(current.id)}>{busy ? 'Retirando…' : 'Sí, retirar'}</button><button type="button" className="action" disabled={busy} onClick={() => setConfirm(false)}>Mejor no</button></div></div>
        : <button type="button" className="action block" onClick={() => { setConfirm(true); setNotice('') }}>Retirar postulación</button>}</>
      : <><div role="status"><Notice tone={current.status === 'ACCEPTED' ? 'success' : 'info'} icon={current.status === 'ACCEPTED' ? 'checkCircle' : 'info'}><strong>{statusCopy[current.status]}.</strong>{current.status === 'ACCEPTED' && ' Confirma tu compromiso si puedes asistir: aceptar no reserva tu cupo.'}{current.status === 'WITHDRAWN' && ' Solo se permite una postulación por persona en cada actividad.'}{current.decisionReason && <> Motivo: {current.decisionReason}</>}</Notice></div>
        {current.status === 'ACCEPTED' && <Link className="action primary block" to="/actividad">Ver mi actividad<Icon name="arrowRight" size={20} /></Link>}</>}</div>
  if (isPast(need.startsAt)) return <div className="apply-box">{feedback}<Notice icon="clock">Esta actividad ya empezó, así que no recibe más postulaciones.</Notice></div>
  if (!hasProfile) return <div className="apply-box">{feedback}<Notice icon="person">Para postularte necesitas tu perfil voluntario.</Notice><Link className="action primary block" to="/mi-perfil">Crear mi perfil<Icon name="arrowRight" size={20} /></Link></div>
  return <div className="apply-box">{feedback}
    {need.slotsAvailable === 0 ? <Notice tone="warning" icon="people">Los cupos de esta actividad están completos por ahora.</Notice> : <Notice icon="people">La organización revisa tu postulación y decide. Postularte no reserva un cupo.</Notice>}
    {form ? <form className="apply-form" onSubmit={event => void submit(event)}><TextArea label="Mensaje para la organización (opcional)" name="message" rows={4} maxLength={1200} autoFocus hint="Cuéntales por qué te interesa. Hasta 1200 caracteres." error={error} /><div className="form-actions"><Submit busy={busy} busyLabel="Enviando…">Enviar postulación</Submit><button type="button" className="text-button" disabled={busy} onClick={() => setForm(false)}>Cancelar</button></div></form>
      : <button type="button" className="action primary block" disabled={need.slotsAvailable === 0} onClick={() => { setForm(true); setNotice(''); setError(undefined) }}>Postularme<Icon name="arrowRight" size={20} /></button>}
  </div>
}

export function NeedDetail() {
  const { needId = '' } = useParams(), location = useLocation(), { user } = useSession(), hasProfile = !!user?.volunteerProfileExists
  const back = `/explorar${(location.state as { from?: string } | null)?.from ?? ''}`
  const query = useQuery({ queryKey: ['need', needId], queryFn: () => api<Need>(`/needs/${needId}`), retry: false }), territories = useQuery(territoriesQuery)
  usePageTitle(query.data?.title ?? 'Oportunidad')
  if (query.isPending) return <p className="loading-state" role="status">Cargando la oportunidad…</p>
  if (query.error) return query.error instanceof ApiFailure && query.error.status === 404 ? <EmptyState headingLevel={1} title="Esta oportunidad ya no está disponible." action={<Link className="action primary" to="/explorar">Ver otras oportunidades</Link>}>Pudo cerrarse, cancelarse o dejar de estar publicada.</EmptyState> : <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  const need = query.data, pic = needPhoto(need), skills = [...need.skills].sort((a, b) => Number(b.required) - Number(a.required) || a.skill.name.localeCompare(b.skill.name, 'es'))
  return <article className="need-detail">
    <div className="need-head"><Breadcrumbs items={[{ label: 'Explorar', to: back }, { label: need.title }]} />
      <div className="need-hero"><img src={photoSrc(pic, 1600)} alt={photo(pic).alt} style={{ objectPosition: photo(pic).focus }} /></div>
      <h1>{need.title}</h1>
      <ul className="need-meta"><Meta icon="people"><Link to={`/organizaciones/${need.organization.id}`}>{need.organization.name}</Link></Meta><Meta icon="pin">{placeLabel(need, territories.data?.items ?? [])}</Meta><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="person">{slotsLabel(need)}</Meta></ul></div>
    <aside className="need-aside" aria-label="Tu participación"><Card><Compatibility needId={need.id} hasProfile={hasProfile} />{features.applications && <Apply need={need} hasProfile={hasProfile} />}</Card></aside>
    <div className="need-main">
      <Card as="section" aria-labelledby="about-title"><h2 id="about-title">Sobre esta actividad</h2><p className="need-summary">{need.summary}</p><p className="preserve-lines">{need.description}</p>
        <DefinitionList items={[{ icon: 'pin', term: 'Modalidad', children: modalityName(need.modality) }, { icon: 'alert', term: 'Nivel de riesgo', children: need.riskLevel === 'LOW' ? 'Bajo' : 'Moderado' }, { icon: 'people', term: 'Organización', children: <>{need.organization.organizationType === 'FORMAL' ? 'Organización formal' : 'Colectivo comunitario'}: <Link to={`/organizaciones/${need.organization.id}`}>{need.organization.name}</Link></> }]} /></Card>
      <Card as="section" aria-labelledby="outcome-title"><h2 id="outcome-title">Resultado esperado</h2><p className="preserve-lines">{need.expectedOutcome}</p></Card>
      {(skills.length > 0 || need.resources.length > 0) && <Card as="section" aria-labelledby="needs-title"><h2 id="needs-title">Lo que se busca</h2>
        {skills.length > 0 && <><h3>Habilidades</h3><ul className="need-tags">{skills.map(item => <li key={item.skill.id}><span className="tag-name">{item.skill.name}</span><span className={`tag-kind${item.required ? ' is-required' : ''}`}>{item.required ? 'Obligatoria' : 'Deseable'}{item.minimumProficiency && ` · nivel ${proficiencyName(item.minimumProficiency).toLowerCase()}`}</span></li>)}</ul></>}
        {need.resources.length > 0 && <><h3>Recursos</h3><ul className="need-tags">{need.resources.map(item => <li key={item.resource.id}><span className="tag-name">{item.resource.name}</span><span className={`tag-kind${item.required ? ' is-required' : ''}`}>{item.required ? 'Necesario' : 'Deseable'}</span>{item.details && <small>{item.details}</small>}</li>)}</ul></>}</Card>}
      {need.conditions && <Card as="section" aria-labelledby="conditions-title"><h2 id="conditions-title">Condiciones</h2><p className="preserve-lines">{need.conditions}</p></Card>}
    </div>
  </article>
}
