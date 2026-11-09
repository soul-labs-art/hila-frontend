// Mi actividad: postulaciones y compromisos de la persona voluntaria (planned: solo con features.applications).
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { dateTime, dayYear, hoursLabel, sizeLabel } from './activity-format'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, PageHeading, Submit, TextArea } from './components'
import { features } from './features'
import { modalityName } from './labels'
import { isPast, longDay, needPhoto, placeLabel, timeRange, whenLabel } from './need-format'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Pagination } from './Profiles'
import { useSession } from './session-context'
import { Breadcrumbs, Card, DefinitionList, EmptyState, Icon, Notice, RatingScale, Stepper, Tabs, Timeline, type IconName, type TimelineItem } from './ui'
import './explore.css'
import './activity.css'

type Application = Schemas['Application']
type Need = Schemas['PublicNeed']
type Participation = Schemas['Participation']
type Result = { error?: unknown; success?: string }
type Report = (result: Result) => void
type Tone = 'ok' | 'wait' | 'no' | 'neutral'
const pageSize = 6

async function loadAll() {
  const items: Application[] = []
  for (let page = 0; page < 10; page++) { const data = await api<Schemas['ApplicationPage']>(`/me/applications?size=100&page=${page}`); items.push(...data.items); if (page + 1 >= data.totalPages) break }
  return items
}
const myApplications = { queryKey: ['my-applications', 'all'], queryFn: loadAll, retry: false }
const territoriesQuery = { queryKey: ['catalog', 'territories'], queryFn: () => api<Schemas['TerritoryPage']>('/catalogs/territories?size=100'), staleTime: 300_000, retry: false }
const needQuery = (id: string) => ({ queryKey: ['need', id], queryFn: () => api<Need>(`/needs/${id}`), retry: false, staleTime: 60_000 })
const participationQuery = (id: string, enabled: boolean) => ({ queryKey: ['participation', id], enabled, retry: false, queryFn: async () => { try { return await api<Participation>(`/applications/${id}/participation`) } catch (error) { if (error instanceof ApiFailure && error.status === 404) return null; throw error } } })
const refresh = (client: QueryClient, app: Application) => Promise.all([['my-applications'], ['application', app.id], ['participation', app.id], ['needs'], ['need'], ['unread-count'], ['notifications']].map(queryKey => client.invalidateQueries({ queryKey })))

/** Abiertas: postulada, aceptada por confirmar o confirmada. El resto va al historial. */
const isOpen = (app: Application) => app.status === 'APPLIED' || (app.status === 'ACCEPTED' && (app.commitmentStatus === 'NOT_CONFIRMED' || app.commitmentStatus === 'CONFIRMED'))
const needsConfirm = (app: Application) => app.status === 'ACCEPTED' && app.commitmentStatus === 'NOT_CONFIRMED'
const isConfirmed = (app: Application) => app.status === 'ACCEPTED' && app.commitmentStatus === 'CONFIRMED'

type View = { label: string; tone: Tone; icon: IconName; lead: string }
/** Estado en lenguaje claro. El texto de la pastilla siempre dice el estado; el color y el icono solo acompañan. */
function stateOf(app: Application, need?: Need): View {
  const started = !!need && isPast(need.startsAt), ended = !!need && isPast(need.endsAt)
  if (app.commitmentStatus === 'COMPLETED') return { label: 'Participaste', tone: 'ok', icon: 'check', lead: 'Participaste en esta actividad. Gracias por tu tiempo.' }
  if (app.commitmentStatus === 'NO_SHOW') return { label: 'No asististe', tone: 'no', icon: 'alert', lead: 'La organización registró que no asististe a esta actividad.' }
  if (app.commitmentStatus === 'CANCELLED') return { label: 'Compromiso cancelado', tone: 'neutral', icon: 'x', lead: 'El compromiso se canceló y el cupo quedó libre.' }
  if (app.status === 'REJECTED') return { label: 'Postulación no aceptada', tone: 'no', icon: 'x', lead: 'Esta vez la organización no continuó con tu postulación.' }
  if (app.status === 'WITHDRAWN') return { label: 'Postulación retirada', tone: 'neutral', icon: 'x', lead: 'Retiraste tu postulación. Solo se permite una por persona en cada actividad.' }
  if (app.status === 'APPLIED') return { label: 'En revisión', tone: 'wait', icon: 'clock', lead: 'La organización revisa tu postulación. Te avisaremos cuando responda.' }
  if (app.commitmentStatus === 'NOT_CONFIRMED') return started ? { label: 'Sin confirmar', tone: 'neutral', icon: 'clock', lead: 'La actividad ya empezó y tu compromiso no se confirmó.' } : { label: 'Pendiente de tu confirmación', tone: 'wait', icon: 'clock', lead: 'Tu postulación fue aceptada. Ahora solo falta que confirmes tu participación.' }
  if (ended) return { label: 'Esperando registro de horas', tone: 'neutral', icon: 'calendar', lead: 'La actividad ya terminó. La organización registrará tus horas.' }
  if (started) return { label: 'En curso', tone: 'ok', icon: 'check', lead: 'La actividad está en curso.' }
  return { label: 'Compromiso confirmado', tone: 'ok', icon: 'checkCircle', lead: 'Confirmaste tu compromiso. Tu cupo está reservado.' }
}
function Pill({ view }: { view: View }) { return <span className={`badge badge-${view.tone} act-pill`}><Icon name={view.icon} size={16} />{view.label}</span> }

function Hours({ item }: { item: Participation }) {
  const noShow = item.attendance === 'NO_SHOW'
  const shown: { tone: Tone; icon: IconName; text: string } = noShow ? { tone: 'no', icon: 'alert', text: 'Inasistencia registrada' }
    : item.status === 'VERIFIED' ? { tone: 'ok', icon: 'checkCircle', text: `${hoursLabel(item.actualHours ?? 0)} verificadas` }
    : item.status === 'DISPUTED' ? { tone: 'no', icon: 'alert', text: 'Horas en disputa' }
    : { tone: 'wait', icon: 'clock', text: item.actualHours === null ? 'Participación registrada, sin horas todavía' : `${hoursLabel(item.actualHours)} reportadas, pendientes de verificar` }
  return <p className={`hours hours-${shown.tone}`}><Icon name={shown.icon} size={20} />{shown.text}</p>
}

/** Diálogo de confirmación con <dialog> nativo: foco atrapado, Escape y retorno del foco al botón que lo abrió. */
function ConfirmDialog({ title, confirmLabel, busy, onConfirm, onClose, children }: { title: string; confirmLabel: string; busy: boolean; onConfirm: (data: FormData) => void; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal() }, []) // al desmontarse, el navegador cierra el modal y devuelve el foco
  return <dialog ref={ref} className="dialog" aria-labelledby={`${id}-title`} onCancel={event => { if (busy) event.preventDefault() }} onClose={onClose} onClick={event => { if (event.target === ref.current && !busy) ref.current?.close() }}>
    <form className="dialog-body" onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onConfirm(new FormData(event.currentTarget)) }}>
      <h2 id={`${id}-title`}>{title}</h2>{children}
      <div className="dialog-actions"><button type="button" className="action" disabled={busy} onClick={() => ref.current?.close()}>Mejor no</button><button type="submit" className="action primary" disabled={busy}>{busy ? 'Un momento…' : confirmLabel}</button></div>
    </form>
  </dialog>
}

/** Confirmar, retirar o cancelar según el estado. Informa el resultado al contenedor, que lo anuncia. */
function ApplicationActions({ app, need, report }: { app: Application; need?: Need; report: Report }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [dialog, setDialog] = useState<'withdraw' | 'cancel' | null>(null)
  const started = !!need && isPast(need.startsAt), ended = !!need && isPast(need.endsAt)
  const confirm = needsConfirm(app) && !started, withdraw = app.status === 'APPLIED' || needsConfirm(app), cancel = isConfirmed(app) && !ended
  async function run(path: string, init: { method: 'PUT' | 'POST'; body?: unknown }, success: string) {
    setBusy(true); report({})
    try { await api(path, init); setDialog(null); await refresh(client, app); report({ success }) } catch (error) { setDialog(null); report({ error }); void refresh(client, app) } finally { setBusy(false) }
  }
  if (!confirm && !withdraw && !cancel) return null
  return <div className="act-actions">
    {confirm && <Notice icon="info">El cupo se reserva cuando confirmas.</Notice>}
    <div className="act-buttons">
      {confirm && <button type="button" className="action primary" disabled={busy} onClick={() => void run(`/applications/${app.id}/commitment`, { method: 'PUT' }, 'Confirmaste tu compromiso. Tu cupo quedó reservado.')}>{busy && !dialog ? 'Confirmando…' : 'Confirmar compromiso'}</button>}
      {withdraw && <button type="button" className="action" disabled={busy} onClick={() => setDialog('withdraw')}>Retirar postulación</button>}
      {cancel && <button type="button" className="action" disabled={busy} onClick={() => setDialog('cancel')}>Cancelar compromiso</button>}
    </div>
    {dialog === 'withdraw' && <ConfirmDialog title="¿Retirar tu postulación?" confirmLabel="Sí, retirar" busy={busy} onClose={() => setDialog(null)} onConfirm={() => void run(`/applications/${app.id}/withdrawal`, { method: 'POST' }, 'Retiraste tu postulación.')}>
      <p>Si la retiras, no podrás volver a postularte a esta actividad.</p></ConfirmDialog>}
    {dialog === 'cancel' && <ConfirmDialog title="¿Cancelar tu compromiso?" confirmLabel="Sí, cancelar compromiso" busy={busy} onClose={() => setDialog(null)} onConfirm={data => void run(`/applications/${app.id}/commitment/cancellation`, { method: 'POST', body: { reason: String(data.get('reason') ?? '').trim() || null } }, 'Cancelaste tu compromiso. Avisamos a la organización.')}>
      <p>Liberaremos tu cupo y avisaremos a la organización.</p><TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={1000} hint="Ayuda a la organización a reorganizarse." /></ConfirmDialog>}
  </div>
}

function Meta({ icon, children }: { icon: IconName; children: ReactNode }) { return <li><Icon name={icon} size={20} /><span>{children}</span></li> }
const fallbackPhoto = 'valle-aburra-panoramica'

function ApplicationCard({ app, territories, from, report }: { app: Application; territories: Schemas['Territory'][]; from: string; report: Report }) {
  const needQ = useQuery(needQuery(app.needId)), need = needQ.data, view = stateOf(app, need)
  const finished = app.commitmentStatus === 'COMPLETED' || app.commitmentStatus === 'NO_SHOW', part = useQuery(participationQuery(app.id, finished))
  const pic = need ? needPhoto(need) : fallbackPhoto, title = need?.title ?? (needQ.error ? 'Actividad que ya no está disponible' : 'Cargando actividad…')
  return <li><Card as="article" className="act-card" aria-labelledby={`act-${app.id}`}>
    <div className="act-top"><span className="act-thumb"><img src={photoSrc(pic, 800)} alt="" loading="lazy" style={{ objectPosition: photo(pic).focus }} /></span>
      <div className="act-titles"><h2 id={`act-${app.id}`}><Link to={`/actividad/${app.id}`} state={{ from }}>{title}</Link></h2>{need && <p>{need.organization.name}</p>}</div></div>
    {need ? <ul className="need-meta"><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="pin">{placeLabel(need, territories)}</Meta></ul> : needQ.isPending && <div aria-hidden="true" className="skeleton act-skeleton"><span className="sk-line w60" /><span className="sk-line w50" /></div>}
    <div><Pill view={view} /></div>
    {part.data && <Hours item={part.data} />}
    <ApplicationActions app={app} need={need} report={report} />
  </Card></li>
}
function Skeleton() { return <ul className="act-grid" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card act-card skeleton"><div className="act-top"><span className="act-thumb" /><div className="act-titles"><span className="sk-line w70" /><span className="sk-line w50" /></div></div><span className="sk-line w60" /><span className="sk-line w40" /></div></li>)}</ul> }

export function ActivityList() {
  usePageTitle('Mi actividad')
  const [params, setParams] = useSearchParams(), tab = params.get('vista') === 'historial' ? 'historial' : 'activos', page = Math.max(0, Number(params.get('pagina')) || 0)
  const query = useQuery(myApplications), territories = useQuery(territoriesQuery), [result, setResult] = useState<Result>({}), resultRef = useRef<HTMLDivElement>(null)
  const report: Report = value => { setResult(value); if (value.success) setTimeout(() => resultRef.current?.focus(), 60) } // tras cerrar el diálogo
  const items = query.data ?? [], open = items.filter(isOpen).sort((a, b) => Number(needsConfirm(b)) - Number(needsConfirm(a))), history = items.filter(app => !isOpen(app))
  const list = tab === 'activos' ? open : history, pages = Math.ceil(list.length / pageSize), shown = list.slice(page * pageSize, (page + 1) * pageSize), from = params.toString() ? `?${params}` : ''
  const toConfirm = open.filter(needsConfirm).length
  function pick(id: string) { const copy = new URLSearchParams(); if (id === 'historial') copy.set('vista', id); setParams(copy, { replace: true }); setResult({}) }
  const content = query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
    : query.isPending ? <><p className="sr-only" role="status">Cargando tu actividad…</p><Skeleton /></>
    : <>
      {tab === 'activos' && toConfirm > 0 && <div className="act-alert"><Icon name="checkCircle" size={28} /><div><h2>{toConfirm === 1 ? 'Tu postulación fue aceptada' : `Te aceptaron en ${toConfirm} actividades`}</h2><p>Ahora solo falta que {toConfirm === 1 ? 'confirmes tu participación' : 'confirmes tu participación en cada una'}.</p></div></div>}
      {shown.length === 0 ? (tab === 'activos'
        ? <EmptyState title={items.length ? 'No tienes actividades en curso' : 'Aún no tienes postulaciones'} action={features.opportunities ? <Link className="action primary" to="/explorar">Explorar oportunidades</Link> : undefined}>{items.length ? 'Tus actividades terminadas, retiradas o canceladas están en el historial.' : 'Cuando te postules a una actividad, la verás aquí con su estado.'}</EmptyState>
        : <EmptyState title="Tu historial aparecerá aquí">Aquí quedan las actividades que completes, retires o que se cancelen.</EmptyState>)
        : <ul className="act-grid">{shown.map(app => <ApplicationCard key={app.id} app={app} territories={territories.data?.items ?? []} from={from} report={report} />)}</ul>}
      <Pagination page={page} totalPages={pages} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} />
    </>
  return <div className="activity">
    <PageHeading title="Mi actividad" lead="Tus postulaciones y compromisos con las organizaciones." />
    <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback error={result.error} success={result.success} /></div>
    <Tabs label="Estado de tus postulaciones" value={tab} onChange={pick} tabs={[{ id: 'activos', label: 'Activos', panel: tab === 'activos' ? content : null }, { id: 'historial', label: 'Historial', panel: tab === 'historial' ? content : null }]} />
  </div>
}

/** Seguimiento con fechas: Postulación, Aceptación y Confirmación, y lo que sigue. */
function steps(app: Application): TimelineItem[] {
  const items: TimelineItem[] = [{ id: 'applied', title: 'Te postulaste', meta: dateTime(app.appliedAt), tone: 'ok', icon: 'document', text: app.message ? `Tu mensaje: ${app.message}` : undefined }]
  const at = (value: string | null) => value ? dateTime(value) : undefined
  if (app.status === 'REJECTED') items.push({ id: 'decision', title: 'La organización no continuó con tu postulación', meta: at(app.decidedAt), tone: 'no', icon: 'x', text: app.decisionReason ?? undefined })
  else if (app.status === 'WITHDRAWN') items.push({ id: 'withdrawn', title: 'Retiraste tu postulación', meta: at(app.finishedAt), tone: 'neutral', icon: 'x' })
  else if (app.status === 'APPLIED') items.push({ id: 'decision', title: 'Esperando la respuesta de la organización', tone: 'wait', icon: 'clock' })
  else {
    items.push({ id: 'accepted', title: 'Te aceptaron', meta: at(app.decidedAt), tone: 'ok', icon: 'people', text: app.decisionReason ?? undefined })
    if (app.confirmedAt) items.push({ id: 'confirmed', title: 'Confirmaste tu compromiso', meta: at(app.confirmedAt), tone: 'ok', icon: 'checkCircle' })
    else if (app.commitmentStatus === 'NOT_CONFIRMED') items.push({ id: 'confirm', title: 'Falta tu confirmación', tone: 'wait', icon: 'clock' })
    if (app.commitmentStatus === 'COMPLETED') items.push({ id: 'end', title: 'Participaste en la actividad', meta: at(app.finishedAt), tone: 'ok', icon: 'check' })
    if (app.commitmentStatus === 'NO_SHOW') items.push({ id: 'end', title: 'Registraron tu inasistencia', meta: at(app.finishedAt), tone: 'no', icon: 'alert' })
    if (app.commitmentStatus === 'CANCELLED') items.push({ id: 'end', title: 'Se canceló el compromiso', meta: at(app.finishedAt), tone: 'no', icon: 'x', text: app.cancellationReason ?? undefined })
  }
  return items
}
const stage = (app: Application) => app.status === 'APPLIED' ? 1 : needsConfirm(app) ? 2 : app.status === 'ACCEPTED' ? 3 : -1

function Instructions({ app }: { app: Application }) {
  const query = useQuery({ queryKey: ['instructions', app.id], queryFn: () => api<Schemas['ActivityInstructions']>(`/applications/${app.id}/activity-instructions`), retry: false })
  return <Card as="section" aria-labelledby="instructions-title"><h2 id="instructions-title">Instrucciones de la actividad</h2><p className="act-note">Solo las ves tú y la organización.</p>
    {query.isPending ? <p className="loading-state" role="status">Cargando las instrucciones…</p> : query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
      : query.data.instructions ? <p className="preserve-lines act-instructions">{query.data.instructions}</p> : <p>La organización aún no agregó instrucciones. Te avisaremos cuando lo haga.</p>}
  </Card>
}

const attendanceName = { COMPLETED: 'Asististe', NO_SHOW: 'No asististe' } as const
const verifyName = { PENDING: 'Pendiente de verificar', VERIFIED: 'Verificada', DISPUTED: 'En disputa' } as const
function ParticipationCard({ item }: { item: Participation }) {
  return <Card as="section" aria-labelledby="part-title"><h2 id="part-title">Mi participación</h2><Hours item={item} />
    <DefinitionList items={[{ icon: 'check', term: 'Asistencia', children: attendanceName[item.attendance] }, ...(item.actualHours !== null ? [{ icon: 'clock' as const, term: 'Horas reportadas', children: hoursLabel(item.actualHours) }] : []), { icon: 'checkCircle', term: 'Verificación', children: item.status === 'VERIFIED' && item.verifiedAt ? `Verificada el ${dayYear(item.verifiedAt)}` : verifyName[item.status] }, { icon: 'calendar', term: 'Registrada', children: dateTime(item.recordedAt) }, ...(item.notes ? [{ icon: 'document' as const, term: 'Notas', children: <span className="preserve-lines">{item.notes}</span> }] : [])]} />
    {item.status === 'DISPUTED' && <Notice tone="warning">La organización dejó este registro en disputa. Mientras no esté verificado, puede corregirlo.</Notice>}
    {item.status === 'PENDING' && <Notice>Tus horas cuentan cuando la organización las verifica.</Notice>}
  </Card>
}

const mediaName = { 'image/jpeg': 'Imagen JPEG', 'image/png': 'Imagen PNG', 'application/pdf': 'PDF' } as const
function EvidenceCard({ item }: { item: Participation }) {
  const query = useQuery({ queryKey: ['evidence', item.id], queryFn: () => api<Schemas['EvidencePage']>(`/participation/${item.id}/evidence?size=50`), retry: false }), [busy, setBusy] = useState(''), [error, setError] = useState<unknown>()
  async function download(evidence: Schemas['Evidence']) {
    setBusy(evidence.id); setError(undefined)
    try { const link = await api<Schemas['EvidenceDownload']>(`/evidence/${evidence.id}/download-url`), anchor = document.createElement('a'); anchor.href = link.url; anchor.download = evidence.originalFilename; anchor.rel = 'noopener'; document.body.append(anchor); anchor.click(); anchor.remove() } catch (failure) { setError(failure) } finally { setBusy('') }
  }
  if (query.isPending || (!query.error && query.data.items.length === 0)) return null
  return <Card as="section" aria-labelledby="evidence-title"><h2 id="evidence-title">Evidencias privadas</h2><p className="act-note">La organización las adjunta a tu participación. Solo las ven ustedes y la administración de Hila.</p>
    {query.error ? <Feedback error={query.error} /> : <ul className="evidence-list">{query.data.items.map(evidence => <li key={evidence.id}><span className="evidence-icon" aria-hidden="true"><Icon name={evidence.mediaType === 'application/pdf' ? 'document' : 'clip'} size={22} /></span><div><strong>{evidence.originalFilename}</strong><small>{mediaName[evidence.mediaType]} · {sizeLabel(evidence.sizeBytes)} · {dayYear(evidence.uploadedAt)}</small></div>
      <button type="button" className="action" disabled={busy === evidence.id} aria-label={`Descargar ${evidence.originalFilename}`} onClick={() => void download(evidence)}>{busy === evidence.id ? 'Preparando…' : 'Descargar'}</button></li>)}</ul>}
    <Feedback error={error} />
  </Card>
}

function FeedbackCard({ app, item }: { app: Application; item: Participation }) {
  const client = useQueryClient(), { user } = useSession(), [rating, setRating] = useState<number>(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [missing, setMissing] = useState(false), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['feedback', app.id], queryFn: () => api<Schemas['Feedback'][]>(`/applications/${app.id}/feedback`), retry: false, enabled: item.status === 'VERIFIED' })
  if (item.status !== 'VERIFIED') return <Card as="section" aria-labelledby="fb-title"><h2 id="fb-title">¿Cómo fue tu experiencia?</h2><Notice icon="clock">Podrás dejar tu feedback cuando la organización verifique tus horas.</Notice></Card>
  const mine = query.data?.find(entry => entry.authorUserId === user?.id)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setNotice('')
    if (!rating) { setMissing(true); return }
    setMissing(false); setBusy(true); const comment = String(new FormData(event.currentTarget).get('comment') ?? '').trim()
    try { await api(`/applications/${app.id}/feedback`, { method: 'POST', body: { rating, comment: comment || null } }); await client.invalidateQueries({ queryKey: ['feedback', app.id] }); setNotice('Enviamos tu feedback. Gracias por contarnos.') } catch (failure) { setError(failure); void client.invalidateQueries({ queryKey: ['feedback', app.id] }) } finally { setBusy(false) }
  }
  return <Card as="section" aria-labelledby="fb-title"><h2 id="fb-title">¿Cómo fue tu experiencia?</h2>
    {query.isPending ? <p className="loading-state" role="status">Consultando tu feedback…</p> : query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
      : mine ? <div className="feedback-sent"><Feedback success={notice} /><p><strong>Enviaste tu feedback.</strong> Calificaste esta experiencia con {mine.rating} de 5.</p>{mine.comment && <blockquote className="preserve-lines">{mine.comment}</blockquote>}</div>
      : <form className="feedback-form" noValidate onSubmit={event => void submit(event)}>
        <p className="act-note">Tu feedback es privado: solo lo ven la coordinación de la organización y la administración de Hila.</p>
        <div><RatingScale name="rating" legend="Califica tu experiencia: 1 es muy mala y 5 es muy buena" value={rating} onChange={value => { setRating(value); setMissing(false) }} lowLabel="Muy mala" highLabel="Muy buena" />{missing && <small className="field-error" role="alert">Elige una calificación del 1 al 5.</small>}</div>
        <TextArea label="¿Qué podríamos mejorar?" name="comment" rows={4} maxLength={1200} hint="Opcional. Hasta 1200 caracteres." error={error} />
        <Feedback error={error} /><div className="form-actions"><Submit busy={busy} busyLabel="Enviando…" arrow={false}>Enviar feedback</Submit></div></form>}
  </Card>
}

export function ActivityDetail() {
  const { applicationId = '' } = useParams(), location = useLocation(), { user } = useSession()
  const back = `/actividad${(location.state as { from?: string } | null)?.from ?? ''}`
  const query = useQuery({ queryKey: ['application', applicationId], queryFn: () => api<Application>(`/applications/${applicationId}`), retry: false })
  const app = query.data, needQ = useQuery({ ...needQuery(app?.needId ?? ''), enabled: !!app }), territories = useQuery(territoriesQuery), need = needQ.data
  const ended = !!need && isPast(need.endsAt), wantsParticipation = !!app && (app.commitmentStatus === 'COMPLETED' || app.commitmentStatus === 'NO_SHOW' || (isConfirmed(app) && ended))
  const part = useQuery(participationQuery(applicationId, wantsParticipation)), [result, setResult] = useState<Result>({}), resultRef = useRef<HTMLDivElement>(null)
  usePageTitle(need?.title ?? 'Mi actividad')
  const report: Report = value => { setResult(value); if (value.success) setTimeout(() => resultRef.current?.focus(), 60) } // tras cerrar el diálogo
  if (query.isPending) return <p className="loading-state" role="status">Cargando tu postulación…</p>
  if (query.error) return query.error instanceof ApiFailure && query.error.status === 404 ? <EmptyState headingLevel={1} title="No encontramos esta postulación." action={<Link className="action primary" to="/actividad">Ver mi actividad</Link>}>Puede que la dirección esté mal escrita o que la postulación no sea tuya.</EmptyState> : <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  if (app!.volunteerId !== user?.id) return <EmptyState headingLevel={1} title="Esta postulación es de otra persona." action={<Link className="action primary" to="/mis-organizaciones">Ir a mis organizaciones</Link>}>Las postulaciones recibidas se revisan desde la organización responsable.</EmptyState>
  const current = app!, view = stateOf(current, need), pic = need ? needPhoto(need) : fallbackPhoto, title = need?.title ?? (needQ.error ? 'Actividad que ya no está disponible' : 'Cargando actividad…'), at = stage(current)
  const participation = part.data ?? undefined
  return <article className="act-detail">
    <div className="act-head"><Breadcrumbs items={[{ label: 'Mi actividad', to: back }, { label: title }]} />
      <div className="need-hero act-hero"><img src={photoSrc(pic, 1600)} alt={photo(pic).alt} style={{ objectPosition: photo(pic).focus }} /></div>
      <h1>{title}</h1>
      {need && <ul className="need-meta"><Meta icon="people"><Link to={`/organizaciones/${need.organization.id}`}>{need.organization.name}</Link></Meta><Meta icon="pin">{placeLabel(need, territories.data?.items ?? [])}</Meta><Meta icon="calendar">{whenLabel(need)}</Meta></ul>}
    </div>
    <div className="act-main">
      <Card as="section" className="act-status" aria-labelledby="status-title"><h2 id="status-title">Estado de tu postulación</h2><div><Pill view={view} /></div><p className="act-lead">{view.lead}{current.status === 'REJECTED' && current.decisionReason && <> Motivo: {current.decisionReason}</>}</p>
        {at > 0 && <Stepper steps={['Postulación', 'Aceptación', 'Confirmación']} current={at} label="Etapas de tu postulación" />}
        <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback error={result.error} success={result.success} /></div>
        <ApplicationActions app={current} need={need} report={report} />
      </Card>
      {(isConfirmed(current) || current.commitmentStatus === 'COMPLETED') && <Instructions app={current} />}
      {wantsParticipation && (part.isPending ? <p className="loading-state" role="status">Consultando tu participación…</p> : part.error ? <><Feedback error={part.error} /><button type="button" className="action" onClick={() => void part.refetch()}>Volver a intentar</button></>
        : participation ? <><ParticipationCard item={participation} /><EvidenceCard item={participation} /><FeedbackCard app={current} item={participation} /></>
        : <Card as="section" aria-labelledby="part-title"><h2 id="part-title">Mi participación</h2><Notice icon="clock">La organización aún no registró tu participación. Cuando lo haga, verás aquí tus horas.</Notice></Card>)}
      <Card as="section" aria-labelledby="steps-title"><h2 id="steps-title">Seguimiento</h2><Timeline items={steps(current)} label="Seguimiento de tu postulación" /></Card>
    </div>
    <aside className="act-aside" aria-label="Sobre la actividad"><Card><h2>Sobre la actividad</h2>
      {need ? <><DefinitionList items={[{ icon: 'calendar', term: 'Fecha', children: longDay(need.startsAt) }, { icon: 'clock', term: 'Horario', children: timeRange(need.startsAt, need.endsAt) }, { icon: 'pin', term: 'Lugar', children: placeLabel(need, territories.data?.items ?? []) }, { icon: 'people', term: 'Modalidad', children: modalityName(need.modality) }]} />
        {features.opportunities && <Link className="action block" to={`/explorar/${need.id}`}>Ver la actividad<Icon name="arrowRight" size={20} /></Link>}</>
        : needQ.isPending ? <p className="loading-state" role="status">Cargando…</p> : <p>La organización pudo cerrar o retirar esta actividad. Tu historial se conserva.</p>}
      <p className="act-note">Te postulaste el {dayYear(current.appliedAt)}</p>
    </Card></aside>
  </article>
}
