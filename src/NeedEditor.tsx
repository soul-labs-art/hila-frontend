// Nueva necesidad y edición de una necesidad existente (planned: solo con features.needs).
import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode, type SelectHTMLAttributes } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, StatusBadge, TextArea } from './components'
import { features } from './features'
import { formValue } from './form-values'
import { modalityName } from './labels'
import { clock, longDay, needPhoto, placeLabel, proficiencyName, shortDay, territoryGroups, timeRange } from './need-format'
import { clientFailure, everyPage, fieldMessage, needLook, refreshWork, remap, resourcesAll, skillsAll, territoriesQuery, isMember404, type Cause, type Managed, type Org } from './needs-data'
import { Dialog, ErrorSummary, OrgGate, OutcomeResult, Unavailable, ApprovalNotice } from './needs-shared'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Breadcrumbs, Card, Chip, ChipGroup, EmptyState, Icon, Notice, RadioCards, type IconName } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'

type Row = { id: string; name: string; required: boolean; extra: string }
type Draft = { causeId: string; title: string; summary: string; description: string; expectedOutcome: string; date: string; startTime: string; endTime: string; endDate: string; slots: string; modality: Schemas['NeedWrite']['modality']; territoryId: string; place: string; instructions: string; conditions: string; risk: Schemas['NeedWrite']['riskLevel']; skills: Row[]; resources: Row[] }
const zone = 'America/Bogota'
const bogota = (iso: string) => { const at = new Date(iso); return { date: new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(at), time: new Intl.DateTimeFormat('en-GB', { timeZone: zone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(at) } }
const instant = (date: string, time: string) => `${date}T${time}:00-05:00`
const blank = (causeId: string): Draft => ({ causeId, title: '', summary: '', description: '', expectedOutcome: '', date: '', startTime: '', endTime: '', endDate: '', slots: '', modality: 'IN_PERSON', territoryId: '', place: '', instructions: '', conditions: '', risk: 'LOW', skills: [], resources: [] })
function fromNeed(need: Managed): Draft {
  const start = bogota(need.startsAt), end = bogota(need.endsAt)
  return { causeId: need.causeId, title: need.title, summary: need.summary, description: need.description, expectedOutcome: need.expectedOutcome, date: start.date, startTime: start.time, endTime: end.time, endDate: end.date, slots: String(need.slotsRequired), modality: need.modality, territoryId: need.territoryId ?? '', place: need.publicLocationLabel ?? '', instructions: need.privateLocationInstructions ?? '', conditions: need.conditions ?? '', risk: need.riskLevel,
    skills: need.skills.map(item => ({ id: item.skill.id, name: item.skill.name, required: item.required, extra: item.minimumProficiency ?? '' })), resources: need.resources.map(item => ({ id: item.resource.id, name: item.resource.name, required: item.required, extra: item.details ?? '' })) }
}
const labels: Record<string, string> = { causeId: 'Causa', title: 'Título', summary: 'Resumen', description: 'Descripción', expectedOutcome: 'Resultado esperado', date: 'Fecha', startTime: 'Hora de inicio', endTime: 'Hora final', slotsRequired: 'Cupos', modality: 'Modalidad', territoryId: 'Territorio', publicLocationLabel: 'Lugar', privateLocationInstructions: 'Indicaciones privadas', conditions: 'Condiciones', skills: 'Habilidades', resources: 'Recursos', reason: 'Motivo', summaryOutcome: 'Resumen del resultado' }

/** Revisa en el navegador lo evidente y arma el cuerpo del contrato. Las reglas de fondo las decide el servidor. */
function build(d: Draft): { body?: Schemas['NeedWrite']; failure?: ApiFailure } {
  const errors: { field: string; message: string }[] = [], need = (field: string, message: string) => errors.push({ field, message })
  if (!d.causeId) need('causeId', 'Elige la causa de la necesidad.')
  if (!d.title.trim()) need('title', 'Escribe el título de la necesidad.')
  if (!d.expectedOutcome.trim()) need('expectedOutcome', 'Cuenta qué se espera lograr.')
  if (!d.summary.trim()) need('summary', 'Escribe un resumen corto.')
  if (!d.description.trim()) need('description', 'Describe la actividad.')
  if (!d.date) need('date', 'Elige la fecha de la actividad.')
  if (!d.startTime) need('startTime', 'Elige la hora de inicio.')
  if (!d.endTime) need('endTime', 'Elige la hora final.')
  if (d.date && d.startTime && d.endTime && Date.parse(instant(d.endDate || d.date, d.endTime)) <= Date.parse(instant(d.date, d.startTime))) need('endTime', 'La hora final debe ser posterior a la de inicio.')
  if (!(Number(d.slots) >= 1)) need('slotsRequired', 'Escribe cuántas personas necesitas, mínimo 1.')
  if (d.modality !== 'REMOTE' && !d.territoryId) need('territoryId', 'Elige el territorio: solo las actividades remotas pueden omitirlo.')
  if (errors.length) return { failure: clientFailure(errors) }
  return { body: { title: d.title.trim(), summary: d.summary.trim(), description: d.description.trim(), expectedOutcome: d.expectedOutcome.trim(), modality: d.modality, riskLevel: d.risk, startsAt: instant(d.date, d.startTime), endsAt: instant(d.endDate || d.date, d.endTime), timezone: 'America/Bogota',
    territoryId: d.territoryId || null, publicLocationLabel: d.place.trim() || null, conditions: d.conditions.trim() || null, slotsRequired: Number(d.slots), privateLocationInstructions: d.instructions.trim() || null,
    skills: d.skills.map(item => ({ skillId: item.id, required: item.required, minimumProficiency: (item.extra || null) as Schemas['NeedSkillInput']['minimumProficiency'] })), resources: d.resources.map(item => ({ resourceId: item.id, required: item.required, details: item.extra.trim() || null })) } }
}

function IconSelect({ label, name, icon, error, hint, children, ...props }: { label: string; name: string; icon: IconName; error?: unknown; hint?: string; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  const message = fieldMessage(error, name), help = message || hint
  return <div className="form-field"><label htmlFor={name}>{label}</label><div className="input-wrap"><select {...props} id={name} name={name} aria-invalid={!!message} aria-describedby={help ? `${name}-help` : undefined}>{children}</select><Icon name={icon} size={20} className="lead-icon" /></div>{help && <small id={`${name}-help`} className={message ? 'field-error' : ''}>{message || hint}</small>}</div>
}
const lead = (icon: IconName) => <Icon name={icon} size={20} className="lead-icon" />

/** Elección de habilidades o recursos del catálogo como fichas con «Obligatoria» / «Deseable» y un panel «Agregar». */
function Chooser({ id, title, lead: intro, catalog, rows, onChange, addLabel, kinds, extra, error }: { id: 'skills' | 'resources'; title: string; lead: string; catalog: { id: string; name: string; category: string; active: boolean }[]; rows: Row[]; onChange: (rows: Row[]) => void; addLabel: string; kinds: [string, string]; extra: 'level' | 'details'; error?: unknown }) {
  const [open, setOpen] = useState(false), [pick, setPick] = useState(''), [required, setRequired] = useState(false), [more, setMore] = useState(''), [said, setSaid] = useState(''), toggle = useRef<HTMLButtonElement>(null), select = useRef<HTMLSelectElement>(null)
  useEffect(() => { if (open) select.current?.focus() }, [open])
  const left = catalog.filter(item => item.active && !rows.some(row => row.id === item.id)), byCategory = [...left.reduce((map, item) => map.set(item.category, [...(map.get(item.category) ?? []), item]), new Map<string, typeof left>())].sort((a, b) => a[0].localeCompare(b[0], 'es'))
  const message = fieldMessage(error, id), detail = (row: Row) => extra === 'level' ? (row.extra ? ` · nivel ${proficiencyName(row.extra).toLowerCase()}` : '') : ''
  function add() {
    const item = catalog.find(entry => entry.id === pick); if (!item) return
    onChange([...rows, { id: item.id, name: item.name, required, extra: more.trim() }]); setSaid(`Agregamos ${item.name}.`); setPick(''); setMore(''); select.current?.focus()
  }
  return <div className="chooser"><h2 id={id} tabIndex={-1}>{title}</h2><p className="choice-hint">{intro}</p>
    {rows.length > 0 && <ul className="pick-chips" aria-label={`${title} elegidas`}>{rows.map(row => <li key={row.id} className={row.required ? 'is-required' : ''}><span className="pick-name">{row.name}</span>
      <button type="button" className="pick-kind" aria-label={`${row.required ? kinds[0] : kinds[1]}. Cambiar ${row.name} a ${(row.required ? kinds[1] : kinds[0]).toLowerCase()}`} onClick={() => onChange(rows.map(item => item.id === row.id ? { ...item, required: !item.required } : item))}>{row.required ? kinds[0] : kinds[1]}</button>
      {detail(row) && <span className="pick-level">{detail(row).replace(' · ', '')}</span>}
      <button type="button" className="pick-remove" aria-label={`Quitar ${row.name}`} onClick={() => { onChange(rows.filter(item => item.id !== row.id)); toggle.current?.focus() }}><Icon name="x" size={16} /></button>
      {extra === 'details' && row.extra && <small>{row.extra}</small>}</li>)}</ul>}
    {message && <small className="field-error" role="alert">{message}</small>}
    <button ref={toggle} type="button" className="action add-pick" aria-expanded={open} aria-controls={`${id}-panel`} onClick={() => setOpen(!open)}><Icon name={open ? 'chevronUp' : 'plus'} size={20} />{addLabel}</button>
    {open && <div id={`${id}-panel`} className="pick-panel" role="group" aria-label={addLabel}>
      <div className="form-field"><label htmlFor={`${id}-pick`}>{id === 'skills' ? 'Habilidad' : 'Recurso'}</label><select id={`${id}-pick`} ref={select} value={pick} onChange={event => setPick(event.target.value)}><option value="">{left.length ? 'Elige una opción' : 'Ya agregaste todas'}</option>{byCategory.map(([category, list]) => <optgroup key={category} label={category}>{list.sort((a, b) => a.name.localeCompare(b.name, 'es')).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</select></div>
      <ChipGroup legend={id === 'skills' ? '¿Qué tan necesaria es?' : '¿La persona debe llevarlo?'}><Chip type="radio" name={`${id}-kind`} checked={required} onChange={() => setRequired(true)}>{kinds[0]}</Chip><Chip type="radio" name={`${id}-kind`} checked={!required} onChange={() => setRequired(false)}>{kinds[1]}</Chip></ChipGroup>
      {extra === 'level' ? <div className="form-field"><label htmlFor={`${id}-more`}>Nivel mínimo (opcional)</label><select id={`${id}-more`} value={more} onChange={event => setMore(event.target.value)}><option value="">Sin nivel mínimo</option><option value="BASIC">Básico</option><option value="INTERMEDIATE">Intermedio</option><option value="ADVANCED">Avanzado</option></select></div>
        : <div className="form-field"><label htmlFor={`${id}-more`}>Detalle (opcional)</label><input id={`${id}-more`} value={more} maxLength={280} onChange={event => setMore(event.target.value)} aria-describedby={`${id}-more-help`} /><small id={`${id}-more-help`}>Por ejemplo, la cantidad o el estado. Hasta 280 caracteres.</small></div>}
      <div className="pick-actions"><button type="button" className="action primary" disabled={!pick} onClick={add}>Agregar</button><button type="button" className="action" onClick={() => { setOpen(false); toggle.current?.focus() }}>Cerrar</button></div>
      <p className="sr-only" role="status">{said}</p></div>}
  </div>
}

/** Cómo verá la necesidad quien explora oportunidades: mismo orden y mismos datos que el detalle público. */
function Preview({ d, need, cause, territories }: { d: Draft; need?: Managed; cause?: Cause; territories: Schemas['Territory'][] }) {
  const faux = { id: need?.id ?? 'nueva', title: d.title, summary: d.summary, skills: d.skills.map(row => ({ skill: { id: row.id, slug: '', name: row.name, category: '', active: true }, required: row.required, minimumProficiency: null })) }, pic = needPhoto(faux)
  const valid = !!d.date && !!d.startTime && !!d.endTime, start = valid ? instant(d.date, d.startTime) : '', end = valid ? instant(d.endDate || d.date, d.endTime) : ''
  const skills = [...d.skills].sort((a, b) => Number(b.required) - Number(a.required)), slots = Number(d.slots) >= 1 ? `${d.slots} ${Number(d.slots) === 1 ? 'cupo' : 'cupos'}` : 'Cupos por definir'
  return <section className="need-preview" aria-labelledby="preview-title"><h2 id="preview-title">Así la verá quien quiera sumarse</h2>
    <Card tone="flat" className="preview-card"><div className="preview-photo"><img src={photoSrc(pic, 800)} alt="" style={{ objectPosition: photo(pic).focus }} /></div>
      <div className="preview-body">{cause && <span className="cause-chip"><Icon name="leaf" size={16} />{cause.title}</span>}
        <h3 className={d.title.trim() ? '' : 'is-empty'}>{d.title.trim() || 'Aquí aparecerá el título'}</h3>
        <ul className="need-meta"><li><Icon name="calendar" size={20} /><span>{valid && Date.parse(end) > Date.parse(start) ? `${shortDay(start)} · ${timeRange(start, end)}` : valid ? `${shortDay(start)} · ${clock(start)}` : 'Fecha y horario por definir'}</span></li><li><Icon name="pin" size={20} /><span>{placeLabel({ modality: d.modality, territoryId: d.territoryId || null, publicLocationLabel: d.place.trim() || null }, territories)}</span></li><li><Icon name="people" size={20} /><span>{slots}</span></li></ul>
        <div className="preview-outcome"><Icon name="leaf" size={22} /><div><strong>Resultado esperado</strong><p>{d.expectedOutcome.trim() || 'Aquí aparecerá lo que se espera lograr.'}</p></div></div>
        {skills.length > 0 && <div><h4>Habilidades</h4><ul className="need-tags">{skills.map(row => <li key={row.id}><span className="tag-name">{row.name}</span><span className={`tag-kind${row.required ? ' is-required' : ''}`}>{row.required ? 'Obligatoria' : 'Deseable'}{row.extra && ` · nivel ${proficiencyName(row.extra).toLowerCase()}`}</span></li>)}</ul></div>}</div></Card></section>
}

function NeedForm({ org, need: initial }: { org: Org; need?: Managed }) {
  const client = useQueryClient(), navigate = useNavigate(), location = useLocation(), [params] = useSearchParams()
  const causes = useQuery({ queryKey: ['causes', org.id], queryFn: () => everyPage<Cause>(`/organizations/${org.id}/causes`), retry: false }), territories = useQuery(territoriesQuery), skills = useQuery(skillsAll), resources = useQuery(resourcesAll)
  const [need, setNeed] = useState(initial), arrived = location.state as { notice?: string; warning?: string } | null
  const [d, setD] = useState<Draft>(() => initial ? fromNeed(initial) : blank(params.get('causa') ?? '')), [busy, setBusy] = useState<'' | 'save' | 'publish'>(''), [error, setError] = useState<unknown>(), [notice, setNotice] = useState(arrived?.notice ?? ''), [cancel, setCancel] = useState(false), [cancelError, setCancelError] = useState<unknown>(), [cancelling, setCancelling] = useState(false)
  const resultRef = useRef<HTMLDivElement>(null)
  usePageTitle(need ? 'Editar necesidad' : 'Nueva necesidad')
  useEffect(() => { if (arrived?.notice || arrived?.warning) resultRef.current?.focus() }, [arrived])
  const status = need?.status ?? 'DRAFT', locked = status === 'CLOSED' || status === 'CANCELLED', look = need ? needLook(need) : { label: 'Borrador', tone: 'neutral' as const }
  const held = need ? need.slotsRequired - need.slotsAvailable : 0, fixed = status === 'PUBLISHED' && held > 0
  const list = (causes.data ?? []).filter(item => item.status !== 'ARCHIVED' || item.id === d.causeId).sort((a, b) => Number(b.status === 'ACTIVE') - Number(a.status === 'ACTIVE')), cause = causes.data?.find(item => item.id === d.causeId)
  const approved = org.verificationStatus === 'APPROVED', blockedEdit = status === 'PUBLISHED' && !approved, cannotPublish = !approved || (!!cause && cause.status !== 'ACTIVE') || !!busy
  const put = (key: keyof Draft) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setD(prev => ({ ...prev, [key]: event.target.value }))
  const shown = remap(error), base = `/organizaciones/${org.id}/necesidades`
  const territoryList = (territories.data?.items ?? []).filter(item => item.active || item.id === d.territoryId)
  function announce(text: string) { setNotice(text); setTimeout(() => resultRef.current?.focus(), 60) }
  async function run(publish: boolean) {
    setError(undefined); setNotice(''); const { body, failure } = build(d)
    if (!body) { setError(failure); return }
    setBusy(publish ? 'publish' : 'save')
    try {
      let saved = await api<Managed>(need ? `/needs/${need.id}/management` : `/causes/${d.causeId}/needs`, { method: need ? 'PUT' : 'POST', body })
      if (publish) {
        try { saved = await api<Managed>(`/needs/${saved.id}/publication`, { method: 'POST' }) }
        catch (failure) { await refreshWork(client); if (!need) navigate(`${base}/${saved.id}`, { replace: true, state: { warning: 'Guardamos tu borrador, pero no pudimos publicarlo.' } }); setNeed(saved); setError(failure); return }
      }
      await refreshWork(client)
      if (!need) { navigate(`${base}/${saved.id}`, { replace: true, state: { notice: publish ? 'Publicamos tu necesidad. Ya pueden verla las personas voluntarias.' : 'Guardamos tu borrador.' } }); return }
      client.setQueryData(['need-management', saved.id], saved); setNeed(saved); setD(fromNeed(saved)); announce(publish ? 'Publicamos tu necesidad. Ya pueden verla las personas voluntarias.' : status === 'PUBLISHED' ? 'Guardamos los cambios. Quienes se postularon recibirán un aviso si cambió algo importante.' : 'Guardamos tu borrador.')
    } catch (failure) { setError(failure) } finally { setBusy('') }
  }
  async function cancelNeed(data: FormData) {
    if (!need) return
    setCancelling(true); setCancelError(undefined)
    try { const saved = await api<Managed>(`/needs/${need.id}/cancellation`, { method: 'POST', body: { reason: formValue(data, 'reason') } satisfies Schemas['ReasonRequest'] }); await refreshWork(client); client.setQueryData(['need-management', saved.id], saved); setCancel(false); setNeed(saved); announce('Cancelamos la necesidad.') } catch (failure) { setCancelError(failure) } finally { setCancelling(false) }
  }
  const crumbs = [{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `/organizaciones/${org.id}/editar` }, { label: 'Necesidades', to: base }, { label: need ? 'Editar necesidad' : 'Nueva necesidad' }]
  if (causes.isPending) return <p className="loading-state" role="status">Preparando el formulario…</p>
  if (causes.error) return <><Feedback error={causes.error} /><button type="button" className="action" onClick={() => void causes.refetch()}>Volver a intentar</button></>
  if (!need && list.filter(item => item.status !== 'ARCHIVED').length === 0) return <div className="work"><Breadcrumbs items={crumbs} /><EmptyState headingLevel={1} title="Primero crea una causa" action={<Link className="action primary" to={`/organizaciones/${org.id}/causas`}>Ir a causas<Icon name="arrowRight" size={20} /></Link>}>Cada necesidad se publica dentro de una causa de tu organización.</EmptyState></div>
  const hint = !approved ? 'Publicar se habilita cuando Hila apruebe la organización.' : cause && cause.status !== 'ACTIVE' ? 'Para publicar, primero activa la causa elegida.' : ''
  return <div className="work need-editor">
    <Breadcrumbs items={crumbs} />
    <PageHeading title={need ? 'Editar necesidad' : 'Nueva necesidad'}><div className="heading-side"><StatusBadge tone={look.tone}>{look.label}</StatusBadge>{need && status !== 'DRAFT' && features.applications && <Link className="action" to={`${base}/${need.id}/postulaciones`}><Icon name="people" size={20} />Ver postulaciones</Link>}</div></PageHeading>
    <ApprovalNotice org={org} />
    {arrived?.warning && <Notice tone="warning">{arrived.warning} Revisa lo que dice abajo y vuelve a intentarlo.</Notice>}
    <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback success={notice} /></div>
    <ErrorSummary error={shown} labels={labels} />
    {status === 'CLOSED' && need && <><OutcomeResult need={need} />{features.participation && <p><Link className="action" to={`${base}/${need.id}/cierre`}>Ver el cierre de la actividad<Icon name="arrowRight" size={20} /></Link></p>}</>}
    {status === 'CANCELLED' && <Notice icon="info">Esta necesidad fue cancelada y ya no se puede editar. Puedes crear otra con los mismos datos.</Notice>}
    {status === 'CLOSED' && <Notice icon="info">Esta necesidad está cerrada: queda como registro y ya no se puede editar.</Notice>}
    {need && status === 'PUBLISHED' && (needLook(need).label === 'Por cerrar' ? <Notice icon="clock"><p><strong>La actividad ya terminó.</strong> Registra la participación y el resultado para cerrar la necesidad.</p>{features.participation && <p><Link className="action primary" to={`${base}/${need.id}/cierre`}>Ir al cierre de la actividad<Icon name="arrowRight" size={20} /></Link></p>}</Notice> : <Notice icon="clock">Podrás registrar el resultado cuando la actividad termine, el {longDay(need.endsAt).toLowerCase()} a las {clock(need.endsAt)}.</Notice>)}
    {fixed && <Notice tone="warning" icon="lock"><p><strong>Hay {held} {held === 1 ? 'compromiso confirmado' : 'compromisos confirmados'}.</strong> Por eso no puedes cambiar la fecha, el horario, la modalidad ni el territorio: las personas ya organizaron su tiempo. Si algo cambió, cancela la necesidad y crea otra.</p></Notice>}
    {blockedEdit && <Notice tone="warning" icon="lock">Mientras la organización no esté aprobada no puedes modificar necesidades publicadas.</Notice>}
    <form className="card ne-form" noValidate onSubmit={(event: FormEvent) => { event.preventDefault(); if (!locked && !blockedEdit) void run(false) }}>
      <fieldset className="ne-fields" disabled={locked}><legend className="sr-only">Datos de la necesidad</legend>
        <p className="req-note">Los campos con asterisco (*) son obligatorios.</p>
        <div className="ne-cause"><IconSelect label="Causa *" name="causeId" icon="leaf" required value={d.causeId} onChange={put('causeId')} disabled={!!need} error={shown} hint={need ? 'La causa no se puede cambiar después de crear la necesidad.' : 'Selecciona la causa de tu organización a la que contribuye esta necesidad.'}><option value="">Elige una causa</option>{list.map(item => <option key={item.id} value={item.id}>{item.title}{item.status === 'DRAFT' ? ' (borrador)' : ''}</option>)}</IconSelect>
          {!need && cause?.status === 'DRAFT' && <p className="inline-note"><Icon name="info" size={18} /><span>Esta causa está en borrador: puedes guardar la necesidad, pero para publicarla primero activa la causa en <Link to={`/organizaciones/${org.id}/causas`}>Causas</Link>.</span></p>}</div>
        <div className="ne-grid">
          <div className="f-half"><Field label="Título de la necesidad *" name="title" required maxLength={180} value={d.title} onChange={put('title')} error={shown} /></div>
          <div className="f-half"><TextArea label="Resultado esperado *" name="expectedOutcome" required rows={2} maxLength={1000} value={d.expectedOutcome} onChange={put('expectedOutcome')} hint="Describe de forma concreta qué se espera lograr." error={shown} /></div>
          <div className="f-full"><TextArea label="Resumen corto *" name="summary" required rows={2} maxLength={500} value={d.summary} onChange={put('summary')} hint="Es lo primero que lee quien explora oportunidades. Hasta 500 caracteres." error={shown} /></div>
          <div className="f-full"><TextArea label="Descripción *" name="description" required rows={5} maxLength={10000} value={d.description} onChange={put('description')} hint="Qué se hará, cómo y con quién." error={shown} /></div>
          <div className="f-date"><Field label="Fecha *" name="date" type="date" required value={d.date} onChange={put('date')} disabled={fixed} error={shown} adornment={lead('calendar')} /></div>
          <div className="f-time"><Field label="Desde *" name="startTime" type="time" required value={d.startTime} onChange={put('startTime')} disabled={fixed} error={shown} adornment={lead('clock')} /></div>
          <div className="f-time"><Field label="Hasta *" name="endTime" type="time" required value={d.endTime} onChange={put('endTime')} disabled={fixed} error={shown} adornment={lead('clock')} /></div>
          <div className="f-slots"><Field label="Cupos *" name="slotsRequired" type="number" inputMode="numeric" required min={Math.max(1, held)} max={32767} value={d.slots} onChange={put('slots')} error={shown} hint={held ? `Mínimo ${held}: ya están reservados.` : undefined} adornment={lead('people')} /></div>
          {d.endDate && d.endDate !== d.date && <div className="f-half"><Field label="Termina el" name="endDate" type="date" value={d.endDate} onChange={put('endDate')} disabled={fixed} hint="Esta actividad termina otro día." adornment={lead('calendar')} /></div>}
          <div className="f-third"><IconSelect label="Modalidad *" name="modality" icon="people" value={d.modality} onChange={put('modality')} disabled={fixed} error={shown}><option value="IN_PERSON">{modalityName('IN_PERSON')}</option><option value="REMOTE">{modalityName('REMOTE')}</option><option value="HYBRID">{modalityName('HYBRID')}</option></IconSelect></div>
          <div className="f-third"><IconSelect label={d.modality === 'REMOTE' ? 'Territorio' : 'Territorio *'} name="territoryId" icon="pin" value={d.territoryId} onChange={put('territoryId')} disabled={fixed} error={shown} hint={d.modality === 'REMOTE' ? 'Opcional si la actividad es remota.' : undefined}><option value="">{d.modality === 'REMOTE' ? 'Sin territorio' : 'Elige un territorio'}</option>{territoryGroups(territoryList).map(group => <optgroup key={group.label} label={group.label}>{group.items.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</optgroup>)}</IconSelect></div>
          <div className="f-third"><Field label="Lugar (opcional)" name="publicLocationLabel" maxLength={180} value={d.place} onChange={put('place')} hint="Lo ve cualquier persona, por ejemplo «Casa vecinal»." error={shown} adornment={lead('pin')} /></div>
          <div className="f-full"><TextArea label="Indicaciones privadas del lugar (opcional)" name="privateLocationInstructions" rows={2} maxLength={1000} value={d.instructions} onChange={put('instructions')} hint="Dirección exacta o cómo llegar. Solo las ven quienes tengan un compromiso confirmado." error={shown} /></div>
          <div className="f-half">{skills.error || skills.isPending ? <p className="loading-state" role={skills.error ? 'alert' : 'status'}>{skills.error ? 'No pudimos cargar las habilidades.' : 'Cargando habilidades…'}</p> : <Chooser id="skills" title="Habilidades requeridas" lead="Elige las habilidades que ayudan a esta actividad." catalog={skills.data} rows={d.skills} onChange={rows => setD(prev => ({ ...prev, skills: rows }))} addLabel="Agregar habilidad" kinds={['Obligatoria', 'Deseable']} extra="level" error={shown} />}</div>
          <div className="f-half">{resources.error || resources.isPending ? <p className="loading-state" role={resources.error ? 'alert' : 'status'}>{resources.error ? 'No pudimos cargar los recursos.' : 'Cargando recursos…'}</p> : <Chooser id="resources" title="Recursos" lead="Indica si las personas voluntarias deben llevar algo." catalog={resources.data} rows={d.resources} onChange={rows => setD(prev => ({ ...prev, resources: rows }))} addLabel="Agregar recurso" kinds={['Necesario', 'Deseable']} extra="details" error={shown} />}</div>
          <div className="f-full"><RadioCards className="risk-cards" name="risk" legend="Riesgo de la actividad" value={d.risk} onChange={value => setD(prev => ({ ...prev, risk: value as Draft['risk'] }))} options={[{ value: 'LOW', label: 'Bajo', hint: 'Sin exigencias especiales', icon: 'checkCircle' }, { value: 'MODERATE', label: 'Moderado', hint: 'Pide atención o cuidado', icon: 'alert' }]} /></div>
          <div className="f-full"><TextArea label="Condiciones (opcional)" name="conditions" rows={3} maxLength={10000} value={d.conditions} onChange={put('conditions')} hint="Lo que la persona debe saber o aceptar antes de postularse." error={shown} /></div>
        </div>
      </fieldset>
      <Preview d={d} need={need} cause={cause} territories={territories.data?.items ?? []} />
      {locked ? <div className="form-actions"><Link className="action" to={base}><Icon name="arrowLeft" size={20} />Volver a las necesidades</Link></div>
        : <div className="ne-actions"><div className="ne-actions-side">{need && <button type="button" className="action danger" disabled={!!busy} onClick={() => { setCancelError(undefined); setCancel(true) }}>Cancelar necesidad</button>}<Link className="text-button" to={base}>Volver sin guardar</Link></div>
          <div className="ne-actions-main">{status === 'DRAFT' ? <><button type="submit" className="action" disabled={!!busy}>{busy === 'save' ? 'Guardando…' : 'Guardar borrador'}</button><button type="button" className="action primary" disabled={cannotPublish} aria-describedby={hint ? 'publish-hint' : undefined} onClick={() => void run(true)}>{busy === 'publish' ? 'Publicando…' : 'Publicar necesidad'}</button></>
            : <button type="submit" className="action primary" disabled={!!busy || blockedEdit}>{busy ? 'Guardando…' : 'Guardar cambios'}</button>}</div>
          {hint && status === 'DRAFT' && <p id="publish-hint" className="ne-hint">{hint}</p>}</div>}
    </form>
    {cancel && <Dialog danger title="¿Cancelar esta necesidad?" confirmLabel="Sí, cancelar necesidad" busy={cancelling} error={cancelError} onClose={() => setCancel(false)} onSubmit={data => void cancelNeed(data)}>
      <p>{status === 'PUBLISHED' ? 'Avisaremos a quienes se postularon o ya confirmaron. La cancelación no se puede deshacer.' : 'Quedará como cancelada y ya no se podrá editar ni publicar.'}</p>
      <TextArea label="Motivo de la cancelación *" name="reason" required rows={3} maxLength={1000} autoFocus hint="Quienes se postularon lo leerán." error={cancelError} /></Dialog>}
  </div>
}

function Load({ org, needId }: { org: Org; needId: string }) {
  const query = useQuery({ queryKey: ['need-management', needId], queryFn: () => api<Managed>(`/needs/${needId}/management`), retry: false })
  usePageTitle('Editar necesidad')
  if (query.isPending) return <p className="loading-state" role="status">Cargando la necesidad…</p>
  if (query.error) return isMember404(query.error) ? <Unavailable /> : <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  if (query.data.organization.id !== org.id) return <Unavailable />
  return <NeedForm key={query.data.id} org={org} need={query.data} />
}

export function NeedEditor() {
  const { id = '', needId } = useParams()
  return <OrgGate id={id}>{org => needId ? <Load org={org} needId={needId} /> : <NeedForm org={org} />}</OrgGate>
}
