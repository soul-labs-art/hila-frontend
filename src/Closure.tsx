// Participación y cierre de una actividad: horas, verificación, resultado, evidencias y feedback (planned: solo con features.participation).
import { useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { dayYear, hoursLabel, sizeLabel } from './activity-format'
import { api, ApiFailure, type Schemas } from './api/client'
import { FilePicker, Feedback, Field, StatusBadge, TextArea } from './components'
import { features } from './features'
import { formValue, nullableValue } from './form-values'
import { modalityName } from './labels'
import { clock, isPast, longDay, needPhoto, placeLabel, whenLabel } from './need-format'
import { clientFailure, isMember404, needLook, territoriesQuery, useOrgWork, type Managed, type Org } from './needs-data'
import { Dialog, ErrorSummary, OrgGate, OutcomeCard, OutcomeResult, Unavailable } from './needs-shared'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Pagination } from './Profiles'
import { useSession } from './session-context'
import { downloadEvidence, isCommitted, managedQuery, needApplications, participationOf, refreshTeam, counts, type Evidence, type OrgApplication, type Participation } from './team-data'
import { Avatar, Breadcrumbs, Card, DataTable, EmptyState, Icon, Notice, RadioCards, RatingScale, Tabs, type IconName } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './closure.css'

const pageSize = 8, maxBytes = 20 * 1024 * 1024, kinds = ['image/png', 'image/jpeg', 'application/pdf']
const plural = (value: number, one: string, many: string) => `${value} ${value === 1 ? one : many}`
const retry = (refetch: () => unknown, error: unknown) => <><Feedback error={error} /><button type="button" className="action" onClick={() => void refetch()}>Volver a intentar</button></>
const mediaName = { 'image/jpeg': 'Imagen JPEG', 'image/png': 'Imagen PNG', 'application/pdf': 'PDF' } as const
function Meta({ icon, children }: { icon: IconName; children: ReactNode }) { return <li><Icon name={icon} size={20} /><span>{children}</span></li> }
const verification = (part?: Participation | null) => !part ? { label: 'Sin registro', tone: 'neutral' as const, note: 'Falta registrar la participación' } : part.status === 'VERIFIED' ? { label: 'Verificada', tone: 'ok' as const, note: part.verifiedAt ? `Verificada el ${dayYear(part.verifiedAt)}` : 'Verificada' } : part.status === 'DISPUTED' ? { label: 'En disputa', tone: 'no' as const, note: 'Registro en disputa' } : { label: 'Pendiente', tone: 'wait' as const, note: 'Sin verificación' }
const attendanceOf = (app: OrgApplication, part?: Participation | null) => part ? (part.attendance === 'COMPLETED' ? { label: 'Realizada', tone: 'ok' as const } : { label: 'No asistió', tone: 'no' as const }) : app.commitmentStatus === 'CONFIRMED' ? { label: 'Sin registrar', tone: 'wait' as const } : { label: 'Sin registrar', tone: 'neutral' as const }

/** Registro de la participación: asistió o no, horas y notas. También sirve para corregir mientras no esté verificada. */
function RecordForm({ app, part, onSaved, onCancel }: { app: OrgApplication; part?: Participation | null; onSaved: (value: Participation) => void; onCancel?: () => void }) {
  const [attendance, setAttendance] = useState<Participation['attendance']>(part?.attendance ?? 'COMPLETED'), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>()
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError(undefined)
    const raw = formValue(data, 'actualHours').replace(',', '.'), hours = attendance === 'NO_SHOW' ? 0 : raw === '' ? null : Number(raw)
    if (hours !== null && (!Number.isFinite(hours) || hours < 0 || hours > 999.99)) { setError(clientFailure([{ field: 'actualHours', message: 'Escribe las horas como un número entre 0 y 999,99.' }])); return }
    setBusy(true)
    try { onSaved(await api<Participation>(`/applications/${app.id}/participation`, { method: 'PUT', body: { attendance, actualHours: hours === null ? null : Math.round(hours * 100) / 100, notes: nullableValue(data, 'notes') } satisfies Schemas['ParticipationWrite'] })) } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  return <form className="record-form" noValidate onSubmit={event => void save(event)}><h3>{part ? 'Corregir el registro' : 'Registrar participación'}</h3><ErrorSummary error={error} labels={{ actualHours: 'Horas', notes: 'Notas', attendance: 'Asistencia' }} />
    <RadioCards name="attendance" legend="¿Asistió a la actividad?" value={attendance} onChange={value => setAttendance(value as Participation['attendance'])} options={[{ value: 'COMPLETED', label: 'Sí, asistió', icon: 'checkCircle' }, { value: 'NO_SHOW', label: 'No asistió', icon: 'x' }]} />
    {attendance === 'COMPLETED' ? <Field label="Horas dedicadas" name="actualHours" type="number" inputMode="decimal" min={0} max={999.99} step={0.25} defaultValue={part?.actualHours ?? ''} error={error} hint="Por ejemplo 3 o 2,5. Puedes dejarlas vacías y completarlas después, pero sin horas no se pueden verificar." />
      : <p className="act-note">Si no asistió, registramos 0 horas.</p>}
    <TextArea label="Notas (opcional)" name="notes" rows={3} maxLength={1200} defaultValue={part?.notes ?? ''} hint="Qué hizo o algo que quieras dejar anotado. Hasta 1200 caracteres." error={error} />
    <div className="form-actions"><button type="submit" className="action primary" disabled={busy}>{busy ? 'Guardando…' : part ? 'Guardar corrección' : 'Registrar participación'}</button>{onCancel && <button type="button" className="action" disabled={busy} onClick={onCancel}>Cancelar</button>}</div></form>
}

/** Feedback privado del equipo hacia la persona. Solo cuando las horas ya están verificadas. */
function TeamFeedback({ app }: { app: OrgApplication }) {
  const client = useQueryClient(), { user } = useSession(), [rating, setRating] = useState(0), [missing, setMissing] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const query = useQuery({ queryKey: ['feedback', app.id], queryFn: () => api<Schemas['Feedback'][]>(`/applications/${app.id}/feedback`), retry: false }), name = app.applicant.displayName, mine = query.data?.find(entry => entry.authorUserId === user?.id)
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(undefined); setNotice('')
    if (!rating) { setMissing(true); return }
    setMissing(false); setBusy(true)
    try { await api(`/applications/${app.id}/feedback`, { method: 'POST', body: { rating, comment: nullableValue(new FormData(event.currentTarget), 'comment') } satisfies Schemas['FeedbackCreate'] }); await client.invalidateQueries({ queryKey: ['feedback', app.id] }); setNotice('Guardamos tu feedback.') } catch (failure) { setError(failure); void client.invalidateQueries({ queryKey: ['feedback', app.id] }) } finally { setBusy(false) }
  }
  return <section aria-labelledby={`fb-${app.id}`} className="person-section"><h3 id={`fb-${app.id}`}>Feedback para {name}</h3>
    {query.isPending ? <p className="loading-state" role="status">Consultando el feedback…</p> : query.error ? retry(query.refetch, query.error)
      : mine ? <div className="feedback-sent"><Feedback success={notice} /><p><strong>Ya dejaste tu feedback.</strong> Calificaste esta participación con {mine.rating} de 5.</p>{mine.comment && <blockquote className="preserve-lines">{mine.comment}</blockquote>}<p className="act-note">No se puede cambiar. {name} no lo recibe automáticamente.</p></div>
      : <form noValidate onSubmit={event => void submit(event)} className="feedback-form"><p className="act-note">Es privado: solo lo ven la coordinación de la organización y la administración de Hila. {name} no lo recibe automáticamente.</p>
        <div><RatingScale name={`rating-${app.id}`} legend="¿Cómo fue su participación? 1 es muy mala y 5 es muy buena" value={rating} onChange={value => { setRating(value); setMissing(false) }} lowLabel="Muy mala" highLabel="Muy buena" />{missing && <small className="field-error" role="alert">Elige una calificación del 1 al 5.</small>}</div>
        <TextArea label="Comentario (opcional)" name="comment" rows={3} maxLength={1200} hint="Hasta 1200 caracteres." error={error} /><Feedback error={error} /><div className="form-actions"><button type="submit" className="action primary" disabled={busy}>{busy ? 'Enviando…' : 'Guardar feedback'}</button></div></form>}
  </section>
}

type Result = { error?: unknown; success?: string }
/** Ficha de la persona elegida: resumen, verificación y corrección. */
function PersonCard({ app, part, ended }: { app: OrgApplication; part?: Participation | null; ended: boolean }) {
  const client = useQueryClient(), { user } = useSession(), [dialog, setDialog] = useState<'verify' | 'dispute' | null>(null), [dialogError, setDialogError] = useState<unknown>(), [busy, setBusy] = useState(false), [editing, setEditing] = useState(false), [result, setResult] = useState<Result>({}), resultRef = useRef<HTMLDivElement>(null)
  const name = app.applicant.displayName, state = verification(part), own = app.volunteerId === user?.id, noHours = !!part && part.actualHours === null, locked = !part || part.status === 'VERIFIED'
  const report = (value: Result) => { setResult(value); if (value.success) setTimeout(() => resultRef.current?.focus(), 60) }
  async function verify(decision: Schemas['ParticipationVerification']['decision'], reason: string | null) {
    if (!part) return
    setBusy(true); setDialogError(undefined); report({})
    try { const saved = await api<Participation>(`/participation/${part.id}/verification`, { method: 'PUT', body: { decision, reason } satisfies Schemas['ParticipationVerification'] }); client.setQueryData(['participation', app.id], saved); setDialog(null); await refreshTeam(client); report({ success: decision === 'VERIFIED' ? `Verificaste las horas de ${name}. Quedaron registradas y ya no se pueden cambiar.` : `Dejaste en disputa el registro de ${name}. Puedes corregirlo y volver a verificarlo.` }) }
    catch (error) { if (dialog && error instanceof ApiFailure && error.status === 422) setDialogError(error); else { setDialog(null); report({ error }); void refreshTeam(client) } } finally { setBusy(false) }
  }
  const dispute = (data: FormData) => { const reason = formValue(data, 'reason'); if (!reason) { setDialogError(clientFailure([{ field: 'reason', message: 'Cuéntanos qué no cuadra para dejarlo en disputa.' }])); return } void verify('DISPUTED', reason) }
  const saved = async (value: Participation) => { client.setQueryData(['participation', app.id], value); setEditing(false); await refreshTeam(client); report({ success: part ? `Guardamos la corrección del registro de ${name}.` : `Registramos la participación de ${name}. Ahora falta verificar sus horas.` }) }
  const why = own ? 'Son tus propias horas: pide a otra persona del equipo que las verifique.' : noHours ? 'Agrega las horas en «Corregir registro» para poder verificar.' : ''
  return <Card as="section" className="person-card" id="person-detail" aria-labelledby="person-title"><h2 id="person-title" className="sr-only">Participación de {name}</h2>
    <div className="person-strip"><div className="strip-person"><Avatar name={name} size="lg" /><div><strong>{name}</strong><span>{part ? (part.attendance === 'COMPLETED' ? 'Participación realizada' : 'No asistió') : 'Participación sin registrar'}</span></div></div>
      <div className="strip-stat"><Icon name="clock" size={24} /><div><strong>{part ? (part.actualHours === null ? 'Sin horas' : hoursLabel(part.actualHours)) : '—'}</strong><span>Horas reportadas</span></div></div>
      <div className="strip-stat"><Icon name={part?.status === 'VERIFIED' ? 'checkCircle' : 'document'} size={24} /><div><strong>{state.label}</strong><span>{state.note}</span></div></div>
      {part && part.status !== 'VERIFIED' && <button type="button" className="action primary strip-action" disabled={busy || own || noHours} aria-describedby={why ? 'verify-why' : undefined} onClick={() => { setDialogError(undefined); setDialog('verify') }}>Verificar horas</button>}</div>
    {why && <div id="verify-why"><Notice tone="warning" icon="lock">{why}</Notice></div>}
    <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback error={result.error} success={result.success} /></div>
    {part?.notes && <section className="person-section" aria-labelledby={`notes-${app.id}`}><h3 id={`notes-${app.id}`}>Notas del registro</h3><p className="preserve-lines">{part.notes}</p></section>}
    {part?.status === 'DISPUTED' && <Notice tone="warning">Este registro quedó en disputa. Puedes corregirlo y volver a verificarlo.</Notice>}
    {part?.status === 'VERIFIED' && <Notice tone="success">Las horas están verificadas y ya no se pueden cambiar.</Notice>}
    {!part && !ended && <Notice icon="clock">La actividad aún no termina. Podrás registrar la participación cuando termine.</Notice>}
    {!locked && !editing && <div className="act-buttons person-actions"><button type="button" className="action" disabled={busy} onClick={() => setEditing(true)}>Corregir registro</button><button type="button" className="action danger" disabled={busy || own} onClick={() => { setDialogError(undefined); setDialog('dispute') }}>Dejar en disputa</button></div>}
    {(editing || (!part && ended)) && <RecordForm key={`${app.id}-${part?.id ?? 'new'}`} app={app} part={part} onSaved={value => void saved(value)} onCancel={editing ? () => setEditing(false) : undefined} />}
    {part?.status === 'VERIFIED' && <TeamFeedback app={app} />}
    {dialog === 'verify' && part && <Dialog title={`¿Verificar las horas de ${name}?`} confirmLabel="Sí, verificar horas" busy={busy} error={dialogError} onClose={() => setDialog(null)} onSubmit={() => void verify('VERIFIED', null)}><p>Vas a verificar {part.actualHours === 0 ? 'el registro sin horas' : hoursLabel(part.actualHours ?? 0)} de participación. Una vez verificadas, no se pueden cambiar.</p></Dialog>}
    {dialog === 'dispute' && <Dialog title={`¿Dejar en disputa el registro de ${name}?`} confirmLabel="Dejar en disputa" danger busy={busy} error={dialogError} onClose={() => setDialog(null)} onSubmit={dispute}><p>El registro queda sin verificar hasta que se corrija. La persona recibirá un aviso con tu motivo.</p><TextArea label="Motivo *" name="reason" required rows={3} maxLength={1200} autoFocus hint="Qué no cuadra y qué hay que revisar." error={dialogError} /></Dialog>}
  </Card>
}

function ParticipationTab({ need, committed, parts, loading, error, onRetry, ended }: { need: Managed; committed: OrgApplication[]; parts: Map<string, Participation | null>; loading: boolean; error: unknown; onRetry: () => void; ended: boolean }) {
  const [params, setParams] = useSearchParams(), selected = committed.find(app => app.id === params.get('persona')) ?? committed[0]
  if (error) return retry(onRetry, error)
  if (loading) return <p className="loading-state" role="status">Cargando los compromisos…</p>
  if (!committed.length) return <EmptyState title="No hay compromisos confirmados" action={features.applications ? <Link className="action" to={`/organizaciones/${need.organization.id}/necesidades/${need.id}/postulaciones`}>Ver postulaciones</Link> : undefined}>Nadie confirmó su participación en esta actividad, así que no hay horas por registrar.</EmptyState>
  const choose = (id: string) => { const copy = new URLSearchParams(params); copy.set('persona', id); setParams(copy, { replace: true }) }
  return <div className="part-tab"><DataTable caption="Compromisos confirmados de la actividad" rows={committed} rowKey={app => app.id} highlight={app => app.id === selected?.id} columns={[
    { key: 'person', header: 'Persona', render: app => <button type="button" className="person-pick" aria-pressed={app.id === selected?.id} aria-controls="person-detail" onClick={() => choose(app.id)}><Avatar name={app.applicant.displayName} size="sm" /><span>{app.applicant.displayName}</span></button> },
    { key: 'att', header: 'Participación', render: app => { const look = attendanceOf(app, parts.get(app.id)); return <StatusBadge tone={look.tone}>{look.label}</StatusBadge> } },
    { key: 'hours', header: 'Horas', render: app => { const part = parts.get(app.id); return part ? (part.actualHours === null ? <span className="muted">Sin horas</span> : hoursLabel(part.actualHours)) : <span className="muted" aria-label="Sin registrar">—</span> } },
    { key: 'ver', header: 'Verificación', render: app => { const state = verification(parts.get(app.id)); return <StatusBadge tone={state.tone}>{state.label}</StatusBadge> } }]} />
    {selected && <PersonCard key={selected.id} app={selected} part={parts.get(selected.id)} ended={ended} />}</div>
}

/** Un conjunto de evidencias privadas con su lista, descarga y subida. */
function EvidenceBlock({ id, title, hint, queryKey, listPath, uploadPath, lockedText }: { id: string; title: string; hint?: string; queryKey: unknown[]; listPath: string; uploadPath: string; lockedText?: string }) {
  const client = useQueryClient(), query = useQuery({ queryKey, queryFn: () => api<Schemas['EvidencePage']>(`${listPath}?size=50`), retry: false }), [file, setFile] = useState<File>(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [done, setDone] = useState(''), [loading, setLoading] = useState(''), fid = `file-${id}`
  function pick(event: ChangeEvent<HTMLInputElement>) { setFile(event.target.files?.[0]); setError(undefined); setDone('') }
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; setError(undefined); setDone('')
    if (!file) { setError(new Error('Elige un archivo para adjuntar.')); return }
    if (file.size > maxBytes) { setError(new Error('El archivo supera el tamaño permitido (20 MiB). Elige uno más liviano.')); return }
    if (!kinds.includes(file.type)) { setError(new Error('Solo aceptamos archivos PNG, JPEG o PDF.')); return }
    setBusy(true)
    try { const body = new FormData(); body.append('file', file); await api(uploadPath, { method: 'POST', body }); form.reset(); setFile(undefined); await client.invalidateQueries({ queryKey }); setDone(`Adjuntamos «${file.name}». Solo la ve quien tiene acceso.`) } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  async function get(evidence: Evidence) { setLoading(evidence.id); setError(undefined); try { await downloadEvidence(evidence) } catch (failure) { setError(failure) } finally { setLoading('') } }
  return <Card as="section" className="evidence-block" aria-labelledby={`ev-${id}`}><h3 id={`ev-${id}`}>{title}</h3>{hint && <p className="act-note">{hint}</p>}
    {query.isPending ? <p className="loading-state" role="status">Cargando las evidencias…</p> : query.error ? retry(query.refetch, query.error)
      : query.data.items.length === 0 ? <p className="act-note">Todavía no hay archivos adjuntos.</p>
      : <ul className="evidence-list">{query.data.items.map(item => <li key={item.id}><span className="evidence-icon" aria-hidden="true"><Icon name={item.mediaType === 'application/pdf' ? 'document' : 'clip'} size={22} /></span><div><strong>{item.originalFilename}</strong><small>{mediaName[item.mediaType]} · {sizeLabel(item.sizeBytes)} · {dayYear(item.uploadedAt)}</small><small className="restricted"><Icon name="lock" size={14} />Acceso restringido</small></div>
        <button type="button" className="action" disabled={loading === item.id} aria-label={`Descargar ${item.originalFilename}`} onClick={() => void get(item)}>{loading === item.id ? 'Preparando…' : 'Descargar'}</button></li>)}</ul>}
    {lockedText ? <Notice icon="clock">{lockedText}</Notice>
      : <form className="evidence-upload" noValidate onSubmit={event => void upload(event)}><FilePicker id={fid} label="Elegir archivo" file={file} disabled={busy} accept="image/png,image/jpeg,application/pdf" onChange={pick} /><p className="act-note">PNG, JPEG o PDF, hasta 20 MiB. Se guarda como privada.</p><Feedback error={error} success={done} /><button type="submit" className="action primary" disabled={busy}>{busy ? 'Adjuntando…' : 'Adjuntar archivo'}</button></form>}
  </Card>
}

function EvidenceTab({ need, committed, parts }: { need: Managed; committed: OrgApplication[]; parts: Map<string, Participation | null> }) {
  const withPart = committed.filter(app => parts.get(app.id))
  return <div className="evidence-tab"><div><h2>Evidencia privada</h2><p className="act-note">Actas, listas y fotos de la actividad. Solo las ven la coordinación responsable y la administración de Hila; la evidencia de una participación también la ve su titular.</p></div>
    <EvidenceBlock id="need" title="De la actividad" hint="Documento de cierre o registro de la actividad." queryKey={['evidence', 'need', need.id]} listPath={`/needs/${need.id}/evidence`} uploadPath={`/needs/${need.id}/evidence`} lockedText={need.status === 'CLOSED' ? undefined : 'Podrás adjuntar la evidencia de la actividad cuando la cierres.'} />
    {withPart.length === 0 ? <Notice icon="info">Cuando registres la participación de alguien, podrás adjuntar evidencia a su nombre.</Notice>
      : withPart.map(app => <EvidenceBlock key={app.id} id={app.id} title={`De ${app.applicant.displayName}`} queryKey={['evidence', parts.get(app.id)!.id]} listPath={`/participation/${parts.get(app.id)!.id}/evidence`} uploadPath={`/participation/${parts.get(app.id)!.id}/evidence`} />)}
  </div>
}

const tabIds = ['participacion', 'resultado', 'evidencias'] as const
function ClosureView({ org, need }: { org: Org; need: Managed }) {
  const client = useQueryClient(), [params, setParams] = useSearchParams(), apps = useQuery(needApplications(need.id)), territories = useQuery(territoriesQuery), [notice, setNotice] = useState(''), noticeRef = useRef<HTMLDivElement>(null)
  usePageTitle('Cierre de la actividad')
  const tab = tabIds.find(id => id === params.get('pestana')) ?? 'participacion', committed = (apps.data ?? []).filter(isCommitted).sort((a, b) => a.applicant.displayName.localeCompare(b.applicant.displayName, 'es'))
  const results = useQueries({ queries: committed.map(app => participationOf(app.id, app.commitmentStatus === 'COMPLETED' || app.commitmentStatus === 'NO_SHOW')) }), parts = new Map(committed.map((app, index) => [app.id, results[index]?.data ?? null]))
  const ended = isPast(need.endsAt), missing = counts(apps.data ?? []).missing, loading = apps.isPending || results.some(item => item.isPending && item.fetchStatus !== 'idle'), error = apps.error ?? results.find(item => item.error)?.error
  const base = `/organizaciones/${org.id}`, pic = needPhoto(need)
  const go = (id: string) => { const copy = new URLSearchParams(params); copy.set('pestana', id); setParams(copy, { replace: true }) }
  const crumbs = [{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `${base}/editar` }, { label: 'Participación', to: `${base}/participacion` }, { label: need.title }]
  if (need.status === 'DRAFT' || need.status === 'CANCELLED') return <div className="work"><Breadcrumbs items={crumbs} /><EmptyState headingLevel={1} title="Esta actividad no tiene cierre" action={<Link className="action primary" to={`${base}/necesidades/${need.id}`}>Ver la necesidad</Link>}>{need.status === 'DRAFT' ? 'Es un borrador: el cierre existe cuando se publica y la actividad termina.' : 'Se canceló, así que no hay participación ni resultado por registrar.'}</EmptyState></div>
  const announce = (text: string) => { setNotice(text); setTimeout(() => noticeRef.current?.focus(), 60) }
  const status = need.status === 'PUBLISHED' && !apps.isPending && !error && (!ended ? <Notice icon="clock"><p><strong>La actividad aún no termina.</strong> Termina el {longDay(need.endsAt).toLowerCase()} a las {clock(need.endsAt)}; desde ahí podrás registrar la participación y el resultado.</p></Notice>
    : missing > 0 ? <Notice tone="warning" icon="alert"><p><strong>{missing === 1 ? 'Falta registrar a una persona.' : `Faltan ${missing} personas por registrar.`}</strong> Para cerrar la actividad, registra la participación de cada compromiso confirmado.</p>{tab !== 'participacion' && <p><button type="button" className="action" onClick={() => go('participacion')}>Ir a la participación</button></p>}</Notice>
      : committed.length ? <Notice tone="success">Todos los compromisos tienen la participación registrada. Ya puedes registrar el resultado.{tab !== 'resultado' && <> <button type="button" className="text-button" onClick={() => go('resultado')}>Ir al resultado</button></>}</Notice> : <Notice icon="info">Nadie confirmó su participación, así que puedes registrar el resultado directamente.</Notice>)
  const result = need.status === 'CLOSED' ? <OutcomeResult need={need} /> : !ended ? <Notice icon="clock">Podrás registrar el resultado cuando la actividad termine.</Notice>
    : <OutcomeCard need={need} blocked={missing > 0 ? <Notice tone="warning" icon="alert">{missing === 1 ? 'Falta registrar la participación de una persona.' : `Faltan ${missing} personas por registrar.`} Hazlo en la pestaña Participación antes de guardar el cierre.</Notice> : undefined} onDone={saved => { client.setQueryData(['need-management', saved.id], saved); announce('Registramos el resultado y cerramos la actividad.') }} />
  const place = placeLabel(need, territories.data?.items ?? [])
  return <div className="work closure">
    <Breadcrumbs items={crumbs} />
    <div className="closure-head"><span className="act-thumb"><img src={photoSrc(pic, 800)} alt="" style={{ objectPosition: photo(pic).focus }} /></span><div><h1>Cierre de la actividad</h1><p className="board-need"><Link to={`${base}/necesidades/${need.id}`}>{need.title}</Link></p>
      <ul className="need-meta closure-meta"><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="pin">{place}</Meta><Meta icon="people">Actividad {modalityName(need.modality).toLowerCase()}</Meta></ul></div><StatusBadge tone={needLook(need).tone}>{needLook(need).label}</StatusBadge></div>
    <div ref={noticeRef} tabIndex={-1} className="act-result"><Feedback success={notice} /></div>
    {status}
    <Tabs label="Secciones del cierre" value={tab} onChange={go} tabs={[
      { id: 'participacion', label: 'Participación', panel: tab === 'participacion' ? <ParticipationTab need={need} committed={committed} parts={parts} loading={loading} error={error} onRetry={() => { void apps.refetch(); results.forEach(item => void item.refetch()) }} ended={ended} /> : null },
      { id: 'resultado', label: 'Resultado', panel: tab === 'resultado' ? (apps.isPending ? <p className="loading-state" role="status">Revisando los compromisos…</p> : error ? retry(() => void apps.refetch(), error) : result) : null },
      { id: 'evidencias', label: 'Evidencias', panel: tab === 'evidencias' ? (loading ? <p className="loading-state" role="status">Cargando…</p> : <EvidenceTab need={need} committed={committed} parts={parts} />) : null }]} />
  </div>
}

function Load({ org, needId }: { org: Org; needId: string }) {
  const query = useQuery(managedQuery(needId))
  usePageTitle('Cierre de la actividad')
  if (query.isPending) return <p className="loading-state" role="status">Cargando la actividad…</p>
  if (query.error) return isMember404(query.error) ? <Unavailable /> : retry(query.refetch, query.error)
  if (query.data.organization.id !== org.id) return <Unavailable />
  return <ClosureView org={org} need={query.data} />
}
export function Closure() {
  const { id = '', needId = '' } = useParams()
  return <OrgGate id={id}>{org => <Load org={org} needId={needId} />}</OrgGate>
}

/** Ruta general: actividades que ya terminaron y esperan cierre, y las ya cerradas. */
function ListView({ org }: { org: Org }) {
  const [params, setParams] = useSearchParams(), { causes, needs } = useOrgWork(org.id), territories = useQuery(territoriesQuery), page = Math.max(0, Number(params.get('pagina')) || 0), tab = params.get('vista') === 'cerradas' ? 'cerradas' : 'porcerrar'
  usePageTitle('Participación')
  const all = needs.data ?? [], toClose = all.filter(need => needLook(need).label === 'Por cerrar').sort((a, b) => a.endsAt.localeCompare(b.endsAt)), closed = all.filter(need => need.status === 'CLOSED').sort((a, b) => (b.closedAt ?? '').localeCompare(a.closedAt ?? ''))
  const list = tab === 'cerradas' ? closed : toClose, pages = Math.ceil(list.length / pageSize), shown = list.slice(page * pageSize, (page + 1) * pageSize), results = useQueries({ queries: shown.map(need => needApplications(need.id)) })
  const loading = causes.isPending || (!!causes.data && needs.isPending), error = causes.error ?? needs.error, base = `/organizaciones/${org.id}`
  const pick = (id: string) => { const copy = new URLSearchParams(); if (id === 'cerradas') copy.set('vista', id); setParams(copy, { replace: true }) }
  const content = error ? retry(() => { void causes.refetch(); void needs.refetch() }, error)
    : loading ? <><p className="sr-only" role="status">Cargando las actividades…</p><ul className="need-rows" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card need-row skeleton"><span className="act-thumb" /><div className="need-row-main"><span className="sk-line w40" /><span className="sk-line w70" /><span className="sk-line w60" /></div></div></li>)}</ul></>
    : shown.length === 0 ? <EmptyState title={tab === 'cerradas' ? 'Aún no has cerrado actividades' : 'No hay actividades por cerrar'} action={<Link className="action" to={`${base}/necesidades`}>Ver necesidades</Link>}>{tab === 'cerradas' ? 'Cuando registres el resultado de una actividad, quedará aquí con su participación y evidencias.' : 'Las actividades aparecen aquí cuando terminan y falta registrar su participación y resultado.'}</EmptyState>
    : <><ul className="need-rows">{shown.map((need, index) => { const look = needLook(need), pic = needPhoto(need), apps = results[index]?.data, committedCount = apps?.filter(isCommitted).length, missing = apps ? counts(apps).missing : 0, link = `${base}/necesidades/${need.id}/cierre`
      return <li key={need.id}><Card as="article" className="need-row" aria-labelledby={`need-${need.id}`}>
        <span className="act-thumb"><img src={photoSrc(pic, 800)} alt="" loading="lazy" style={{ objectPosition: photo(pic).focus }} /></span>
        <div className="need-row-main"><div className="need-row-tags"><StatusBadge tone={look.tone}>{look.label}</StatusBadge>{missing > 0 && <StatusBadge tone="wait">{plural(missing, 'persona sin registrar', 'personas sin registrar')}</StatusBadge>}{apps && need.status === 'PUBLISHED' && missing === 0 && committedCount ? <StatusBadge tone="ok">Todo registrado</StatusBadge> : null}{need.outcome && <StatusBadge tone={need.outcome.status === 'FULFILLED' ? 'ok' : need.outcome.status === 'PARTIAL' ? 'wait' : 'no'}>{({ FULFILLED: 'Cumplida', PARTIAL: 'Parcial', NOT_FULFILLED: 'No cumplida' })[need.outcome.status]}</StatusBadge>}</div>
          <h2 id={`need-${need.id}`}><Link to={link}>{need.title}</Link></h2>
          <ul className="need-meta"><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="people">{committedCount === undefined ? 'Contando compromisos…' : plural(committedCount, 'compromiso', 'compromisos')}</Meta><Meta icon="pin">{placeLabel(need, territories.data?.items ?? [])}</Meta></ul></div>
        <Link className={`action${tab === 'porcerrar' ? ' primary' : ''}`} to={link} aria-label={`${tab === 'porcerrar' ? 'Cerrar actividad' : 'Ver cierre'}: ${need.title}`}>{tab === 'porcerrar' ? 'Cerrar actividad' : 'Ver cierre'}<Icon name="arrowRight" size={20} /></Link></Card></li> })}</ul>
      <Pagination page={page} totalPages={pages} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} /></>
  return <div className="work needs">
    <Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `${base}/editar` }, { label: 'Participación' }]} />
    <div className="page-heading"><div><h1>Participación</h1><p>Registra las horas, el resultado y las evidencias de las actividades que ya terminaron.</p></div></div>
    {!loading && !error && toClose.length > 0 && tab === 'porcerrar' && <Notice icon="clock"><strong>{toClose.length === 1 ? 'Una actividad ya terminó.' : `${toClose.length} actividades ya terminaron.`}</strong> Registra su participación y resultado para cerrarlas.</Notice>}
    <Tabs label="Estado del cierre" value={tab} onChange={pick} tabs={[{ id: 'porcerrar', label: `Por cerrar${needs.data ? ` (${toClose.length})` : ''}`, panel: tab === 'porcerrar' ? content : null }, { id: 'cerradas', label: `Cerradas${needs.data ? ` (${closed.length})` : ''}`, panel: tab === 'cerradas' ? content : null }]} />
  </div>
}
export function ParticipationNeeds() {
  const { id = '' } = useParams()
  return <OrgGate id={id}>{org => <ListView org={org} />}</OrgGate>
}
