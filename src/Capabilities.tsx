// Capacidades del perfil voluntario (planned, detrás de features.capabilities): habilidades, recursos, disponibilidad, territorio y modalidad.
// Cada sección carga sus valores del servidor y se guarda por separado.
import { useState, type FormEvent, type ReactNode } from 'react'
import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, Field, Select, Submit } from './components'
import { proficiencyName, territoryGroups, weekdays } from './need-format'
import type { Volunteer } from './ProfileCard'
import { Card, Chip, ChipGroup, Icon, Notice, RadioCards } from './ui'
import { profileSteps } from './volunteer'
import './capabilities.css'

type Save = { busy: boolean; error?: unknown; notice: string }
function useSave() {
  const [state, setState] = useState<Save>({ busy: false, notice: '' })
  const reset = () => setState(current => current.error || current.notice ? { busy: false, notice: '' } : current)
  async function run(task: () => Promise<void>, notice: string) {
    setState({ busy: true, notice: '' })
    try { await task(); setState({ busy: false, notice }) } catch (error) { setState({ busy: false, error, notice: '' }) }
  }
  return [state, run, reset] as const
}
const fieldMessage = (error: unknown, field: string) => error instanceof ApiFailure ? (error.detail.fieldErrors ?? []).filter(item => item.field === field).map(item => item.message).join(' ') : ''

/** Espera a que las consultas terminen; si una falla, muestra el error con reintento. */
function Gate({ queries, label, children }: { queries: UseQueryResult<unknown>[]; label: string; children: () => ReactNode }) {
  const failed = queries.find(query => query.error)
  if (failed) return <Card as="section" className="capacity-card"><Feedback error={failed.error} /><button type="button" className="action" onClick={() => queries.forEach(query => void query.refetch())}>Volver a intentar</button></Card>
  if (queries.some(query => query.isPending)) return <Card as="section" className="capacity-card"><p className="loading-state" role="status">{label}</p></Card>
  return <>{children()}</>
}
function Section({ id, title, lead, save, onSubmit, label, children }: { id: string; title: string; lead: string; save: Save; onSubmit: () => void; label: string; children: ReactNode }) {
  return <Card as="section" className="capacity-card" aria-labelledby={id}><h2 id={id}>{title}</h2><p className="panel-lead">{lead}</p>
    <form onSubmit={(event: FormEvent) => { event.preventDefault(); onSubmit() }} noValidate><div className="capacity-body">{children}</div><Feedback error={save.error} success={save.notice} /><div className="form-actions"><Submit busy={save.busy}>{label}</Submit></div></form></Card>
}
const byCategory = <T extends { category: string; name: string }>(entries: T[]) => [...entries.reduce((map, entry) => map.set(entry.category, [...(map.get(entry.category) ?? []), entry]), new Map<string, T[]>())].map(([category, items]) => ({ category, items: items.sort((a, b) => a.name.localeCompare(b.name, 'es')) })).sort((a, b) => a.category.localeCompare(b.category, 'es'))
function CategoryChips({ entries, selected, onToggle }: { entries: Schemas['Skill'][]; selected: (id: string) => boolean; onToggle: (id: string, on: boolean) => void }) {
  return <div className="chip-sections">{byCategory(entries).map(group => <ChipGroup key={group.category} legend={group.category} className="chip-section">{group.items.map(entry => <Chip key={entry.id} name={`${group.category}-${entry.slug}`} checked={selected(entry.id)} onChange={event => onToggle(entry.id, event.target.checked)}>{entry.name}</Chip>)}</ChipGroup>)}</div>
}
const catalog = (kind: 'skills' | 'resources') => ({ queryKey: ['catalog', kind], queryFn: () => api<Schemas['SkillPage']>(`/catalogs/${kind}?size=100`), staleTime: 300_000, retry: false })
const hint = (count: number, one: string, many: string) => <p className="capacity-count" aria-live="polite">{count ? `${count} ${count === 1 ? one : many}` : 'Aún no has elegido ninguna.'}</p>

export function SkillsSection() {
  const skills = useQuery(catalog('skills')), mine = useQuery({ queryKey: ['me', 'skills'], queryFn: () => api<Schemas['VolunteerSkill'][]>('/me/skills'), retry: false })
  return <Gate queries={[skills, mine]} label="Cargando tus habilidades…">{() => <SkillsForm options={skills.data!.items} current={mine.data!} />}</Gate>
}
function SkillsForm({ options, current }: { options: Schemas['Skill'][]; current: Schemas['VolunteerSkill'][] }) {
  const client = useQueryClient(), [save, run, reset] = useSave()
  const [items, setItems] = useState<Schemas['VolunteerSkillInput'][]>(() => current.map(item => ({ skillId: item.skill.id, proficiency: item.proficiency, yearsExperience: item.yearsExperience })))
  const entries = [...options, ...current.map(item => item.skill).filter(skill => !options.some(option => option.id === skill.id))], nameOf = (id: string) => entries.find(entry => entry.id === id)?.name ?? 'Habilidad'
  const toggle = (id: string, on: boolean) => { reset(); setItems(list => on ? [...list, { skillId: id, proficiency: null, yearsExperience: null }] : list.filter(item => item.skillId !== id)) }
  const edit = (index: number, patch: Partial<Schemas['VolunteerSkillInput']>) => { reset(); setItems(list => list.map((item, at) => at === index ? { ...item, ...patch } : item)) }
  return <Section id="skills-title" title="¿En qué te gustaría apoyar?" lead="Elige lo que sabes hacer. Las organizaciones lo usan para ver si encajas; tú decides a qué te postulas." save={save} label="Guardar habilidades" onSubmit={() => void run(async () => { client.setQueryData(['me', 'skills'], await api<Schemas['VolunteerSkill'][]>('/me/skills', { method: 'PUT', body: { items } })) }, 'Tus habilidades quedaron guardadas.')}>
    <CategoryChips entries={entries} selected={id => items.some(item => item.skillId === id)} onToggle={toggle} />
    {hint(items.length, 'habilidad elegida.', 'habilidades elegidas.')}
    {items.length > 0 && <div className="level-list"><h3>Tu nivel en cada una</h3><p className="capacity-note">Opcional. Ayuda a la organización a saber cómo apoyarte.</p>{items.map((item, index) => <fieldset key={item.skillId} className="level-row"><legend>{nameOf(item.skillId)}</legend>
      <Select label="Nivel" name={`items[${index}].proficiency`} value={item.proficiency ?? ''} error={save.error} onChange={event => edit(index, { proficiency: (event.target.value || null) as Schemas['VolunteerSkillInput']['proficiency'] })}><option value="">Sin indicar</option>{(['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const).map(level => <option key={level} value={level}>{proficiencyName(level)}</option>)}</Select>
      <Field label="Años de experiencia" name={`items[${index}].yearsExperience`} type="number" inputMode="numeric" min={0} max={100} step={1} value={item.yearsExperience ?? ''} error={save.error} onChange={event => edit(index, { yearsExperience: event.target.value === '' ? null : Number(event.target.value) })} /></fieldset>)}</div>}
  </Section>
}

export function ResourcesSection() {
  const resources = useQuery(catalog('resources')), mine = useQuery({ queryKey: ['me', 'resources'], queryFn: () => api<Schemas['VolunteerResource'][]>('/me/resources'), retry: false })
  return <Gate queries={[resources, mine]} label="Cargando tus recursos…">{() => <ResourcesForm options={resources.data!.items} current={mine.data!} />}</Gate>
}
function ResourcesForm({ options, current }: { options: Schemas['Resource'][]; current: Schemas['VolunteerResource'][] }) {
  const client = useQueryClient(), [save, run, reset] = useSave()
  const [items, setItems] = useState<Schemas['VolunteerResourceInput'][]>(() => current.map(item => ({ resourceId: item.resource.id, details: item.details })))
  const entries = [...options, ...current.map(item => item.resource).filter(resource => !options.some(option => option.id === resource.id))], nameOf = (id: string) => entries.find(entry => entry.id === id)?.name ?? 'Recurso'
  const toggle = (id: string, on: boolean) => { reset(); setItems(list => on ? [...list, { resourceId: id, details: null }] : list.filter(item => item.resourceId !== id)) }
  return <Section id="resources-title" title="Recursos que puedes aportar" lead="Opcional. Si tienes equipo, herramientas o un espacio que prestarías, cuéntalo. Nadie te lo exige para postularte." save={save} label="Guardar recursos" onSubmit={() => void run(async () => { client.setQueryData(['me', 'resources'], await api<Schemas['VolunteerResource'][]>('/me/resources', { method: 'PUT', body: { items } })) }, 'Tus recursos quedaron guardados.')}>
    <CategoryChips entries={entries} selected={id => items.some(item => item.resourceId === id)} onToggle={toggle} />
    {hint(items.length, 'recurso elegido.', 'recursos elegidos.')}
    {items.length > 0 && <div className="level-list"><h3>Detalles</h3><p className="capacity-note">Opcional. Por ejemplo, la marca, la cantidad o cuándo lo puedes llevar.</p>{items.map((item, index) => <fieldset key={item.resourceId} className="level-row is-single"><legend>{nameOf(item.resourceId)}</legend>
      <Field label="Detalle" name={`items[${index}].details`} maxLength={280} value={item.details ?? ''} error={save.error} onChange={event => { reset(); setItems(list => list.map((entry, at) => at === index ? { ...entry, details: event.target.value || null } : entry)) }} /></fieldset>)}</div>}
  </Section>
}

const toMinutes = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5))
const toClock = (minutes: number) => `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
export function AvailabilitySection() {
  const mine = useQuery({ queryKey: ['me', 'availability'], queryFn: () => api<Schemas['Availability']>('/me/availability'), retry: false })
  return <Gate queries={[mine]} label="Cargando tu disponibilidad…">{() => <AvailabilityForm current={mine.data!} />}</Gate>
}
function AvailabilityForm({ current }: { current: Schemas['Availability'] }) {
  const client = useQueryClient(), [save, run, reset] = useSave(), [items, setItems] = useState(current.items)
  const add = (weekday: number) => { reset(); setItems(list => { const last = list.filter(item => item.weekday === weekday).map(item => toMinutes(item.endsAt)).sort((a, b) => a - b).pop(), start = last === undefined ? 9 * 60 : Math.min(last, 23 * 60); return [...list, { weekday, startsAt: toClock(start), endsAt: toClock(last === undefined ? 12 * 60 : Math.min(start + 120, 23 * 60 + 59)) }] }) }
  const edit = (index: number, patch: Partial<Schemas['AvailabilitySlot']>) => { reset(); setItems(list => list.map((item, at) => at === index ? { ...item, ...patch } : item)) }
  const remove = (index: number) => { reset(); setItems(list => list.filter((_, at) => at !== index)) }
  return <Section id="availability-title" title="Tu disponibilidad" lead="Cuándo puedes participar, en hora de Colombia. Cada franja va de una hora a otra el mismo día; si cruza la medianoche, divídela entre dos días." save={save} label="Guardar disponibilidad" onSubmit={() => void run(async () => { client.setQueryData(['me', 'availability'], await api<Schemas['Availability']>('/me/availability', { method: 'PUT', body: { timezone: 'America/Bogota', items } })) }, 'Tu disponibilidad quedó guardada.')}>
    <div className="week">{weekdays.map((day, offset) => { const weekday = offset + 1, slots = items.map((item, index) => ({ item, index })).filter(entry => entry.item.weekday === weekday)
      return <fieldset key={day} className="day-row"><legend>{day}</legend>
        {slots.length === 0 && <p className="day-empty">Sin franjas</p>}
        {slots.map(({ item, index }, order) => { const extra = fieldMessage(save.error, `items[${index}]`)
          return <div key={index} className="slot"><div className="slot-fields"><Field label="Desde" name={`items[${index}].startsAt`} type="time" value={item.startsAt} error={save.error} onChange={event => edit(index, { startsAt: event.target.value })} /><Field label="Hasta" name={`items[${index}].endsAt`} type="time" value={item.endsAt} error={save.error} onChange={event => edit(index, { endsAt: event.target.value })} />
            <button type="button" className="icon-button" aria-label={`Quitar franja ${order + 1} del ${day.toLowerCase()}`} onClick={() => remove(index)}><Icon name="x" size={20} /></button></div>{extra && <small className="field-error">{extra}</small>}</div> })}
        <button type="button" className="text-button add-slot" aria-label={`Agregar franja el ${day.toLowerCase()}`} onClick={() => add(weekday)}><Icon name="plus" size={18} />Agregar franja</button></fieldset> })}</div>
    {items.length === 0 && <Notice icon="calendar">Sin franjas, las organizaciones verán que no indicaste cuándo puedes. Puedes guardarlo así y completarlo después.</Notice>}
  </Section>
}

export function AreasSection() {
  const territories = useQuery({ queryKey: ['catalog', 'territories'], queryFn: () => api<Schemas['TerritoryPage']>('/catalogs/territories?size=100'), staleTime: 300_000, retry: false }), mine = useQuery({ queryKey: ['me', 'service-areas'], queryFn: () => api<Schemas['Territory'][]>('/me/service-areas'), retry: false })
  return <Gate queries={[territories, mine]} label="Cargando territorios…">{() => <AreasForm options={territories.data!.items} current={mine.data!} />}</Gate>
}
function AreasForm({ options, current }: { options: Schemas['Territory'][]; current: Schemas['Territory'][] }) {
  const client = useQueryClient(), [save, run, reset] = useSave(), [ids, setIds] = useState(() => current.map(item => item.id))
  const all = [...options, ...current.filter(item => !options.some(option => option.id === item.id))]
  return <Section id="areas-title" title="Tu territorio" lead="Dónde te gustaría participar. Puedes elegir varios." save={save} label="Guardar territorio" onSubmit={() => void run(async () => { client.setQueryData(['me', 'service-areas'], await api<Schemas['Territory'][]>('/me/service-areas', { method: 'PUT', body: { territoryIds: ids } })) }, 'Tu territorio quedó guardado.')}>
    <div className="chip-sections">{territoryGroups(all).map(group => <ChipGroup key={group.label} legend={group.label} className="chip-section">{group.items.map(item => <Chip key={item.id} name={`territory-${item.slug}`} checked={ids.includes(item.id)} onChange={event => { reset(); setIds(list => event.target.checked ? [...list, item.id] : list.filter(id => id !== item.id)) }}>{item.name}</Chip>)}</ChipGroup>)}</div>
    {hint(ids.length, 'territorio elegido.', 'territorios elegidos.')}
  </Section>
}

export function ModalitySection({ profile, onSaved }: { profile: Volunteer; onSaved: () => void }) {
  const [save, run, reset] = useSave(), [value, setValue] = useState(profile.preferredModality ?? '')
  return <Section id="modality-title" title="Modalidad preferida" lead="Cómo te resulta más cómodo participar." save={save} label="Guardar modalidad" onSubmit={() => void run(async () => {
    await api('/me/volunteer-profile', { method: 'PUT', body: { biography: profile.biography, profession: profile.profession, educationLevel: profile.educationLevel, preferredModality: value || null } }); onSaved()
  }, 'Tu modalidad quedó guardada.')}>
    <RadioCards name="preferredModality" legend="Modalidad" hideLegend value={value} onChange={next => { reset(); setValue(next) }} options={[{ value: 'IN_PERSON', label: 'Presencial', hint: 'En el lugar de la actividad' }, { value: 'REMOTE', label: 'Remoto', hint: 'Desde donde estés' }, { value: 'HYBRID', label: 'Híbrido', hint: 'Un poco de cada una' }, { value: '', label: 'Por definir', hint: 'Lo decido con cada actividad' }]} />
  </Section>
}

/** Botones para avanzar y volver entre pasos. */
export function StepFooter({ step, onStep }: { step: number; onStep: (step: number) => void }) {
  return <div className="step-footer">{step > 0 ? <button type="button" className="action" onClick={() => onStep(step - 1)}><Icon name="arrowLeft" size={20} />{profileSteps[step - 1]}</button> : <span />}{step < profileSteps.length - 1 && <button type="button" className="action" onClick={() => onStep(step + 1)}>{profileSteps[step + 1]}<Icon name="arrowRight" size={20} /></button>}</div>
}

/** Pasos 2 y 3 del perfil (carga diferida desde Profiles). */
export function CapabilityStep({ step, profile, onStep, onSaved }: { step: number; profile: Volunteer; onStep: (step: number) => void; onSaved: () => void }) {
  return step === 1 ? <div className="capacity-stack"><SkillsSection /><ResourcesSection /><StepFooter step={step} onStep={onStep} /></div> : <div className="capacity-stack"><AvailabilitySection /><AreasSection /><ModalitySection profile={profile} onSaved={onSaved} /><StepFooter step={step} onStep={onStep} /></div>
}
