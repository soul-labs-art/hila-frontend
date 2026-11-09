// Postulaciones que recibe la organización: elegir necesidad, revisar y decidir (planned: solo con features.applications).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { dateTime, dayYear } from './activity-format'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, StatusBadge, TextArea } from './components'
import { features } from './features'
import { formValue } from './form-values'
import { isPast, needPhoto, placeLabel, whenLabel } from './need-format'
import { clientFailure, isMember404, needLook, territoriesQuery, useOrgWork, type Managed, type Org } from './needs-data'
import { Dialog, OrgGate, Unavailable } from './needs-shared'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Pagination } from './Profiles'
import { appLook, byStage, counts, fitOf, managedQuery, needApplications, refreshTeam, useWide, type Look, type OrgApplication } from './team-data'
import { Avatar, Breadcrumbs, Card, Chip, ChipGroup, DefinitionList, EmptyState, Icon, Notice, Timeline, type IconName, type TimelineItem } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './applications.css'

type Result = { error?: unknown; success?: string }
const pageSize = 8
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`
const heldLabel = (need: Managed) => `${need.slotsRequired - need.slotsAvailable} de ${need.slotsRequired} ${need.slotsRequired === 1 ? 'cupo confirmado' : 'cupos confirmados'}`
const firstName = (name: string) => name.split(/\s+/)[0] ?? name
function Pill({ look }: { look: Look }) { return <span className={`badge badge-${look.tone} act-pill`}><Icon name={look.icon} size={16} />{look.label}</span> }
function Meta({ icon, children }: { icon: IconName; children: ReactNode }) { return <li><Icon name={icon} size={20} /><span>{children}</span></li> }
const retry = (refetch: () => unknown, error: unknown) => <><Feedback error={error} /><button type="button" className="action" onClick={() => void refetch()}>Volver a intentar</button></>

const filters = [{ id: 'todas', label: 'Todas', match: () => true }, { id: 'revisar', label: 'Por revisar', match: (app: OrgApplication) => appLook(app).stage === 'review' }, { id: 'confirmar', label: 'Por confirmar', match: (app: OrgApplication) => appLook(app).stage === 'confirm' },
  { id: 'confirmadas', label: 'Confirmadas', match: (app: OrgApplication) => appLook(app).stage === 'confirmed' }, { id: 'cerradas', label: 'Cerradas', match: (app: OrgApplication) => appLook(app).stage === 'closed' }]

/** Seguimiento con fechas, contado desde quien revisa. */
function steps(app: OrgApplication, name: string): TimelineItem[] {
  const at = (value: string | null) => value ? dateTime(value) : undefined
  const items: TimelineItem[] = [{ id: 'applied', title: 'Se postuló', meta: dateTime(app.appliedAt), tone: 'ok', icon: 'document' }]
  if (app.status === 'REJECTED') items.push({ id: 'decision', title: 'La postulación no continuó', meta: at(app.decidedAt), tone: 'no', icon: 'x', text: app.decisionReason ?? undefined })
  else if (app.status === 'WITHDRAWN') items.push({ id: 'withdrawn', title: `${firstName(name)} retiró su postulación`, meta: at(app.finishedAt), tone: 'neutral', icon: 'x' })
  else if (app.status === 'APPLIED') items.push({ id: 'decision', title: 'Esperando la decisión de la organización', tone: 'wait', icon: 'clock' })
  else {
    items.push({ id: 'accepted', title: 'Se aceptó la postulación', meta: at(app.decidedAt), tone: 'ok', icon: 'people', text: app.decisionReason ?? undefined })
    if (app.confirmedAt) items.push({ id: 'confirmed', title: `${firstName(name)} confirmó su compromiso`, meta: at(app.confirmedAt), tone: 'ok', icon: 'checkCircle' })
    else if (app.commitmentStatus === 'NOT_CONFIRMED') items.push({ id: 'confirm', title: `Falta que ${firstName(name)} confirme`, tone: 'wait', icon: 'clock' })
    if (app.commitmentStatus === 'COMPLETED') items.push({ id: 'end', title: 'Participó en la actividad', meta: at(app.finishedAt), tone: 'ok', icon: 'check' })
    if (app.commitmentStatus === 'NO_SHOW') items.push({ id: 'end', title: 'No asistió a la actividad', meta: at(app.finishedAt), tone: 'no', icon: 'alert' })
    if (app.commitmentStatus === 'CANCELLED') items.push({ id: 'end', title: 'Se canceló el compromiso', meta: at(app.finishedAt), tone: 'no', icon: 'x', text: app.cancellationReason ?? undefined })
  }
  return items
}

/** Decisión sobre una postulación y lo que sigue según su estado. */
function Decision({ app, need, org, report }: { app: OrgApplication; need: Managed; org: Org; report: (result: Result) => void }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [dialog, setDialog] = useState<'reject' | 'cancel' | null>(null), [dialogError, setDialogError] = useState<unknown>()
  const look = appLook(app), name = app.applicant.displayName, open = need.status === 'PUBLISHED', ended = isPast(need.endsAt), base = `/organizaciones/${org.id}/necesidades/${need.id}`
  async function run(path: string, init: { method: 'PUT' | 'POST'; body: unknown }, success: string) {
    setBusy(true); setDialogError(undefined); report({})
    try { await api(path, init); setDialog(null); await refreshTeam(client); report({ success }) }
    catch (error) { if (dialog && error instanceof ApiFailure && error.status === 422) setDialogError(error); else { setDialog(null); report({ error }); void refreshTeam(client) } }
    finally { setBusy(false) }
  }
  const decide = (decision: Schemas['ApplicationDecision']['decision'], reason: string | null, success: string) => run(`/applications/${app.id}/decision`, { method: 'PUT', body: { decision, reason } satisfies Schemas['ApplicationDecision'] }, success)
  const reject = (data: FormData) => { const reason = formValue(data, 'reason'); if (!reason) { setDialogError(clientFailure([{ field: 'reason', message: 'Cuéntale a la persona por qué la postulación no continúa.' }])); return } void decide('REJECTED', reason, `Rechazaste la postulación de ${name}. Le avisamos con tu motivo.`) }
  if (look.stage === 'review') return <div className="decision">
    {!open && <Notice tone="warning" icon="lock">Esta necesidad ya no está publicada, así que no se pueden decidir postulaciones nuevas.</Notice>}
    <div className="act-buttons"><button type="button" className="action primary" disabled={busy || !open} onClick={() => void decide('ACCEPTED', null, `Aceptaste la postulación de ${name}. Le avisamos para que confirme su compromiso.`)}>{busy && !dialog ? 'Aceptando…' : 'Aceptar postulación'}</button><button type="button" className="action" disabled={busy || !open} onClick={() => { setDialogError(undefined); setDialog('reject') }}>Rechazar</button></div>
    <Notice icon="info"><p><strong>Aceptar una postulación no reserva el cupo.</strong></p><p>El cupo se reserva cuando {firstName(name)} confirma su compromiso.</p></Notice>
    {dialog === 'reject' && <Dialog title={`¿Rechazar la postulación de ${name}?`} confirmLabel="Sí, rechazar" danger busy={busy} error={dialogError} onClose={() => setDialog(null)} onSubmit={reject}>
      <p>La persona recibirá un aviso con tu motivo. Rechazar no se puede deshacer.</p><TextArea label="Motivo *" name="reason" required rows={3} maxLength={1000} autoFocus hint="Con respeto y sin datos personales. Hasta 1000 caracteres." error={dialogError} /></Dialog>}
  </div>
  if (look.stage === 'confirm') return <Notice icon="clock"><p><strong>Falta que {firstName(name)} confirme su compromiso.</strong></p><p>El cupo se reserva solo cuando lo hace. Le enviamos un aviso al aceptar su postulación.</p></Notice>
  if (look.stage === 'confirmed') return <div className="decision">
    <Notice tone="success">El compromiso está confirmado y el cupo reservado.</Notice>
    {ended ? (features.participation && <Link className="action primary" to={`${base}/cierre?pestana=participacion&persona=${app.id}`}>Registrar participación<Icon name="arrowRight" size={20} /></Link>)
      : <><div className="act-buttons"><button type="button" className="action danger" disabled={busy} onClick={() => { setDialogError(undefined); setDialog('cancel') }}>Cancelar compromiso</button></div>
        {dialog === 'cancel' && <Dialog title={`¿Cancelar el compromiso de ${name}?`} confirmLabel="Sí, cancelar compromiso" danger busy={busy} error={dialogError} onClose={() => setDialog(null)} onSubmit={data => void run(`/applications/${app.id}/commitment/cancellation`, { method: 'POST', body: { reason: formValue(data, 'reason') || null } satisfies Schemas['CommitmentCancellationRequest'] }, `Cancelaste el compromiso de ${name}. El cupo quedó libre y le avisamos.`)}>
          <p>Liberaremos el cupo y avisaremos a la persona.</p><TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={1000} autoFocus hint="La persona lo leerá." error={dialogError} /></Dialog>}</>}
  </div>
  if (app.commitmentStatus === 'COMPLETED' || app.commitmentStatus === 'NO_SHOW') return features.participation ? <Link className="action" to={`${base}/cierre?pestana=participacion&persona=${app.id}`}>Ver su participación<Icon name="arrowRight" size={20} /></Link> : null
  const why = app.status === 'REJECTED' ? app.decisionReason : app.cancellationReason
  return why ? <Notice icon="info"><p><strong>Motivo</strong></p><p>{why}</p></Notice> : null
}

function Detail({ app, need, org, territories, headingRef, result, setResult }: { app: OrgApplication; need: Managed; org: Org; territories: Schemas['Territory'][]; headingRef: React.RefObject<HTMLHeadingElement | null>; result: Result; setResult: (value: Result) => void }) {
  const resultRef = useRef<HTMLDivElement>(null), look = appLook(app), person = app.applicant, fit = fitOf(app, need, territories.find(item => item.id === need.territoryId)?.name)
  const report = (value: Result) => { setResult(value); if (value.success) setTimeout(() => resultRef.current?.focus(), 60) }
  const about: { icon: IconName; term: string; children: ReactNode }[] = [...(person.profile.profession ? [{ icon: 'person' as const, term: 'Ocupación', children: person.profile.profession }] : []), ...(person.profile.educationLevel ? [{ icon: 'book' as const, term: 'Estudios', children: person.profile.educationLevel }] : []),
    ...(person.profile.preferredModality ? [{ icon: 'pin' as const, term: 'Prefiere', children: `Actividades ${({ IN_PERSON: 'presenciales', REMOTE: 'remotas', HYBRID: 'híbridas' })[person.profile.preferredModality]}` }] : [])]
  return <Card as="section" className="detail-card" aria-labelledby="detail-title"><h2 id="detail-title" tabIndex={-1} ref={headingRef}>Detalle de la postulación</h2>
    <div className="person-head"><Avatar name={person.displayName} size="lg" /><div><h3>{person.displayName}</h3><p>Se postuló el {dayYear(app.appliedAt)}</p></div><Pill look={look} /></div>
    <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback error={result.error} success={result.success} /></div>
    <section aria-labelledby="motive-title"><h3 id="motive-title">Motivación</h3>{app.message ? <p className="preserve-lines">{app.message}</p> : <p className="act-note">{firstName(person.displayName)} no dejó un mensaje.</p>}</section>
    <section aria-labelledby="fit-title"><h3 id="fit-title">Disponibilidad para esta actividad</h3>
      <DefinitionList items={[...(fit.skills.length ? [{ icon: 'tag' as const, term: 'Habilidades', children: <ul className="fit-skills">{fit.skills.map(skill => <li key={skill.id} className={skill.has ? 'has' : 'lacks'}><Icon name={skill.has ? 'check' : 'x'} size={16} /><span><strong>{skill.name}</strong> · {skill.required ? 'obligatoria' : 'deseable'}: {skill.has ? 'la tiene en su perfil' : 'no la indicó'}</span></li>)}</ul> }] : []),
        { icon: 'calendar', term: 'Horario', children: fit.schedule.text }, { icon: 'pin', term: 'Lugar', children: fit.place.text }]} /></section>
    {about.length > 0 && <section aria-labelledby="about-title"><h3 id="about-title">Sobre la persona</h3><DefinitionList items={about} />{person.profile.biography && <p className="preserve-lines about-bio">{person.profile.biography}</p>}</section>}
    <section aria-labelledby="next-title"><h3 id="next-title">{look.stage === 'review' ? 'Tu decisión' : 'Estado'}</h3><Decision key={`${app.id}-${app.status}-${app.commitmentStatus}`} app={app} need={need} org={org} report={report} /></section>
    <section aria-labelledby="steps-title"><h3 id="steps-title">Seguimiento</h3><Timeline items={steps(app, person.displayName)} label="Seguimiento de la postulación" /></section>
  </Card>
}

function Skeleton() { return <ul className="app-list" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card app-row skeleton"><span className="avatar avatar-md" /><span className="app-row-main"><span className="sk-line w40" /><span className="sk-line w60" /></span></div></li>)}</ul> }

function Board({ org, need }: { org: Org; need: Managed }) {
  const [params, setParams] = useSearchParams(), apps = useQuery(needApplications(need.id)), territories = useQuery(territoriesQuery), wide = useWide(), detailRef = useRef<HTMLHeadingElement>(null), listRef = useRef<HTMLHeadingElement>(null), was = useRef(false), [first, setFirst] = useState<string>(), [result, setResult] = useState<{ id: string; value: Result }>()
  usePageTitle('Postulaciones')
  const all = [...(apps.data ?? [])].sort(byStage), filter = filters.find(item => item.id === params.get('estado')) ?? filters[0], page = Math.max(0, Number(params.get('pagina')) || 0)
  const list = all.filter(filter.match), pages = Math.ceil(list.length / pageSize), shown = list.slice(page * pageSize, (page + 1) * pageSize)
  const chosen = all.find(item => item.id === params.get('postulacion'))
  const selected = chosen ?? (wide ? all.find(item => item.id === first) ?? shown[0] : undefined), count = (id: string) => all.filter(filters.find(item => item.id === id)!.match).length
  const chosenId = chosen?.id, firstShown = shown[0]?.id
  if (wide && !chosenId && !first && firstShown) setFirst(firstShown)
  useEffect(() => { if (!wide) { if (chosenId) detailRef.current?.focus(); else if (was.current) listRef.current?.focus() } was.current = !!chosenId }, [chosenId, wide])
  const edit = (change: (copy: URLSearchParams) => void, replace = false) => { const copy = new URLSearchParams(params); change(copy); setParams(copy, { replace }); window.scrollTo(0, 0) }
  const pick = (id: string) => { const copy = new URLSearchParams(params); copy.set('postulacion', id); return `?${copy}` }
  const crumbs = [{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `/organizaciones/${org.id}/editar` }, { label: 'Postulaciones', to: `/organizaciones/${org.id}/postulaciones` }, { label: need.title }]
  const list_ = apps.error ? retry(apps.refetch, apps.error) : apps.isPending ? <><p className="sr-only" role="status">Cargando las postulaciones…</p><Skeleton /></>
    : all.length === 0 ? <EmptyState title="Aún no hay postulaciones" action={need.status === 'PUBLISHED' ? undefined : <Link className="action" to={`/organizaciones/${org.id}/necesidades/${need.id}`}>Ver la necesidad</Link>}>{need.status === 'PUBLISHED' ? 'Cuando alguien se postule a esta necesidad, aparecerá aquí para que la revises.' : 'Esta necesidad no recibió postulaciones.'}</EmptyState>
    : shown.length === 0 ? <EmptyState title="No hay postulaciones en este estado" action={<button type="button" className="action" onClick={() => edit(copy => { copy.delete('estado'); copy.delete('pagina') }, true)}>Ver todas</button>}>Prueba con otro filtro.</EmptyState>
    : <><ul className="app-list">{shown.map(app => { const look = appLook(app), on = app.id === selected?.id
      return <li key={app.id}><Link to={pick(app.id)} className={`card app-row${on ? ' is-selected' : ''}`} aria-current={on ? 'true' : undefined}><Avatar name={app.applicant.displayName} size="md" /><span className="app-row-main"><strong>{app.applicant.displayName}</strong><Pill look={look} /></span><Icon name="chevronRight" size={22} /></Link></li> })}</ul>
      <Pagination page={page} totalPages={pages} setPage={next => edit(copy => { if (next) copy.set('pagina', String(next)); else copy.delete('pagina') })} /></>
  const detail = selected ? <Detail key={selected.id} app={selected} need={need} org={org} territories={territories.data?.items ?? []} headingRef={detailRef} result={result?.id === selected.id ? result.value : {}} setResult={value => setResult({ id: selected.id, value })} /> : null
  const listing = <section className="board-list" aria-labelledby="list-title"><h2 id="list-title" tabIndex={-1} ref={listRef}>{apps.data ? `Mostrando ${shown.length} de ${plural(list.length, 'postulación', 'postulaciones')}` : 'Postulaciones'}</h2>
    {all.length > 1 && <ChipGroup legend="Filtrar por estado" className="board-filters">{filters.filter(item => item.id === 'todas' || item.id === filter.id || count(item.id) > 0).map(item => <Chip key={item.id} type="radio" name="estado" checked={filter.id === item.id} onChange={() => edit(copy => { if (item.id === 'todas') copy.delete('estado'); else copy.set('estado', item.id); copy.delete('pagina') }, true)}>{item.label} ({count(item.id)})</Chip>)}</ChipGroup>}
    {list_}</section>
  return <div className="work board-page">
    {wide || !chosen ? <Breadcrumbs items={crumbs} /> : <button type="button" className="back-link" onClick={() => edit(copy => copy.delete('postulacion'))}><Icon name="arrowLeft" size={18} />Volver a las postulaciones</button>}
    <div className="board-head"><div><h1>Postulaciones</h1><p className="board-need"><Link to={`/organizaciones/${org.id}/necesidades/${need.id}`}>{need.title}</Link></p></div>
      <Card tone="soft" className="slots-card"><Icon name="people" size={32} /><p><strong>{heldLabel(need)}</strong><span>{plural(need.slotsAvailable, 'cupo disponible', 'cupos disponibles')}</span></p></Card></div>
    {need.status === 'CLOSED' && <Notice icon="info">Esta necesidad está cerrada: las postulaciones quedan como registro.</Notice>}
    {need.status === 'CANCELLED' && <Notice icon="info">Esta necesidad fue cancelada: las postulaciones quedan como registro.</Notice>}
    {wide ? <div className="board">{listing}{detail ?? <div />}</div> : chosen && detail ? detail : listing}
  </div>
}

function BoardLoad({ org, needId }: { org: Org; needId: string }) {
  const query = useQuery(managedQuery(needId))
  usePageTitle('Postulaciones')
  if (query.isPending) return <p className="loading-state" role="status">Cargando la necesidad…</p>
  if (query.error) return isMember404(query.error) ? <Unavailable /> : retry(query.refetch, query.error)
  if (query.data.organization.id !== org.id) return <Unavailable />
  return <Board org={org} need={query.data} />
}
export function ApplicationBoard() {
  const { id = '', needId = '' } = useParams()
  return <OrgGate id={id}>{org => <BoardLoad org={org} needId={needId} />}</OrgGate>
}

/** Ruta general: las necesidades de la organización con lo que espera una decisión primero. */
function NeedsView({ org }: { org: Org }) {
  const [params, setParams] = useSearchParams(), { causes, needs } = useOrgWork(org.id), territories = useQuery(territoriesQuery), page = Math.max(0, Number(params.get('pagina')) || 0)
  usePageTitle('Postulaciones')
  const open = (needs.data ?? []).filter(need => need.status !== 'DRAFT'), results = useQueries({ queries: open.map(need => needApplications(need.id)) })
  const rows = open.map((need, index) => ({ need, query: results[index], c: results[index]?.data ? counts(results[index].data!) : null })).sort((a, b) => (b.c?.review ?? 0) - (a.c?.review ?? 0) || (b.c?.confirm ?? 0) - (a.c?.confirm ?? 0) || needLook(a.need).rank - needLook(b.need).rank || b.need.startsAt.localeCompare(a.need.startsAt))
  const pages = Math.ceil(rows.length / pageSize), shown = rows.slice(page * pageSize, (page + 1) * pageSize), totalReview = rows.reduce((sum, row) => sum + (row.c?.review ?? 0), 0), withReview = rows.filter(row => row.c?.review).length
  const loading = causes.isPending || (!!causes.data && needs.isPending) || results.some(item => item.isPending), error = causes.error ?? needs.error ?? results.find(item => item.error)?.error
  const base = `/organizaciones/${org.id}`
  const content = error ? retry(() => { void causes.refetch(); void needs.refetch(); results.forEach(item => void item.refetch()) }, error)
    : loading ? <><p className="sr-only" role="status">Cargando las postulaciones…</p><ul className="need-rows" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card need-row skeleton"><span className="act-thumb" /><div className="need-row-main"><span className="sk-line w40" /><span className="sk-line w70" /><span className="sk-line w60" /></div></div></li>)}</ul></>
    : rows.length === 0 ? <EmptyState title="Aún no hay necesidades publicadas" action={<Link className="action primary" to={`${base}/necesidades`}>Ir a necesidades<Icon name="arrowRight" size={20} /></Link>}>Las postulaciones llegan cuando publicas una necesidad.</EmptyState>
    : <><ul className="need-rows">{shown.map(({ need, c }) => { const look = needLook(need), pic = needPhoto(need), link = `${base}/necesidades/${need.id}/postulaciones`
      return <li key={need.id}><Card as="article" className="need-row" aria-labelledby={`need-${need.id}`}>
        <span className="act-thumb"><img src={photoSrc(pic, 800)} alt="" loading="lazy" style={{ objectPosition: photo(pic).focus }} /></span>
        <div className="need-row-main"><div className="need-row-tags"><StatusBadge tone={look.tone}>{look.label}</StatusBadge>{c?.review ? <StatusBadge tone="wait">{plural(c.review, 'por revisar', 'por revisar')}</StatusBadge> : null}{c?.confirm ? <StatusBadge tone="wait">{plural(c.confirm, 'por confirmar', 'por confirmar')}</StatusBadge> : null}{c?.confirmed ? <StatusBadge tone="ok">{plural(c.confirmed, 'confirmada', 'confirmadas')}</StatusBadge> : null}{c && !c.review && !c.confirm && !c.confirmed && <StatusBadge>Sin postulaciones activas</StatusBadge>}</div>
          <h2 id={`need-${need.id}`}><Link to={link}>{need.title}</Link></h2>
          <ul className="need-meta"><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="people">{heldLabel(need)}</Meta><Meta icon="pin">{placeLabel(need, territories.data?.items ?? [])}</Meta></ul></div>
        <Link className={`action${c?.review ? ' primary' : ''}`} to={link} aria-label={`Ver postulaciones: ${need.title}`}>Ver postulaciones<Icon name="arrowRight" size={20} /></Link></Card></li> })}</ul>
      <Pagination page={page} totalPages={pages} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} /></>
  return <div className="work needs">
    <Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `${base}/editar` }, { label: 'Postulaciones' }]} />
    <div className="page-heading"><div><h1>Postulaciones</h1><p>Elige una necesidad para revisar a quienes se postularon.</p></div></div>
    {!loading && !error && totalReview > 0 && <Notice icon="clock"><strong>{totalReview === 1 ? 'Una postulación espera tu decisión' : `${totalReview} postulaciones esperan tu decisión`}</strong> en {withReview === 1 ? 'una necesidad' : `${withReview} necesidades`}. Aparecen primero.</Notice>}
    {content}
  </div>
}
export function ApplicationNeeds() {
  const { id = '' } = useParams()
  return <OrgGate id={id}>{org => <NeedsView org={org} />}</OrgGate>
}
