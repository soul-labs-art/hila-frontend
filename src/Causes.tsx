// Causas de la organización: lista, creación y edición (planned: solo con features.needs).
import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, StatusBadge, TextArea } from './components'
import { formValue, nullableValue } from './form-values'
import { usePageTitle } from './page-title'
import { causeLook, refreshWork, useOrgWork, type Cause, type Managed, type Org } from './needs-data'
import { ApprovalNotice, Dialog, OrgGate } from './needs-shared'
import { Breadcrumbs, Card, EmptyState, Icon, RadioCards } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'

type Result = { error?: unknown; success?: string }
const order: Cause['status'][] = ['DRAFT', 'ACTIVE', 'ARCHIVED']
const statusName: Record<Cause['status'], { label: string; hint: string }> = { DRAFT: { label: 'Borrador', hint: 'Solo tu equipo la ve' }, ACTIVE: { label: 'Activa', hint: 'Permite publicar necesidades' }, ARCHIVED: { label: 'Archivada', hint: 'Ya no admite necesidades nuevas' } }

/** Una causa solo avanza: borrador, activa, archivada. Activarla pide una organización aprobada. */
function statusOptions(org: Org, cause?: Cause) {
  const from = cause ? order.indexOf(cause.status) : 0
  return order.filter((value, index) => index >= from && (cause ? true : value !== 'ARCHIVED') && (value !== 'ACTIVE' || org.verificationStatus === 'APPROVED' || cause?.status === 'ACTIVE'))
}

function CauseDialog({ org, cause, onClose, onSaved }: { org: Org; cause?: Cause; onClose: () => void; onSaved: (cause: Cause) => void }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), options = statusOptions(org, cause)
  async function save(data: FormData) {
    setBusy(true); setError(undefined)
    try {
      const body: Schemas['CauseWrite'] = { title: formValue(data, 'title'), summary: formValue(data, 'summary'), description: nullableValue(data, 'description'), status: (formValue(data, 'status') || options[0]) as Cause['status'] }
      const saved = await api<Cause>(cause ? `/causes/${cause.id}` : `/organizations/${org.id}/causes`, { method: cause ? 'PUT' : 'POST', body })
      await refreshWork(client); onSaved(saved)
    } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  return <Dialog wide title={cause ? 'Editar causa' : 'Nueva causa'} confirmLabel="Guardar causa" busy={busy} error={error} onClose={onClose} onSubmit={data => void save(data)}>
    <p className="dialog-note">Los campos con asterisco (*) son obligatorios.</p><p>Una causa es la razón por la que tu organización pide apoyo, por ejemplo «Huerta escolar». Dentro de ella publicas las necesidades concretas.</p>
    <Field label="Nombre de la causa *" name="title" required maxLength={180} autoFocus defaultValue={cause?.title ?? ''} error={error} />
    <TextArea label="Resumen *" name="summary" required rows={3} maxLength={500} defaultValue={cause?.summary ?? ''} hint="Una o dos frases que expliquen la causa. Hasta 500 caracteres." error={error} />
    <TextArea label="Descripción (opcional)" name="description" rows={5} maxLength={10000} defaultValue={cause?.description ?? ''} hint="Contexto, historia o razones de la causa." error={error} />
    <RadioCards key={options.join()} name="status" legend="Estado" defaultValue={cause && options.includes(cause.status) ? cause.status : options[0]} options={options.map(value => ({ value, ...statusName[value] }))} />
    {org.verificationStatus !== 'APPROVED' && !cause && <p className="dialog-note">Se guarda como borrador porque Hila aún no aprueba la organización.</p>}
  </Dialog>
}

function CauseCard({ cause, needs, onEdit }: { cause: Cause; needs?: Managed[]; onEdit: (cause: Cause) => void }) {
  const look = causeLook(cause.status), mine = needs?.filter(item => item.causeId === cause.id), live = mine?.filter(item => item.status === 'PUBLISHED').length ?? 0
  return <li><Card as="article" className="cause-card" aria-labelledby={`cause-${cause.id}`}>
    <span className="cause-icon" aria-hidden="true"><Icon name="leaf" size={26} /></span>
    <div className="cause-main"><StatusBadge tone={look.tone}>{look.label}</StatusBadge><h2 id={`cause-${cause.id}`}>{cause.title}</h2><p>{cause.summary}</p>
      {mine && <p className="cause-count"><Icon name="document" size={18} />{mine.length === 0 ? 'Sin necesidades todavía' : `${mine.length} ${mine.length === 1 ? 'necesidad' : 'necesidades'}${live ? ` · ${live} ${live === 1 ? 'publicada' : 'publicadas'}` : ''}`}</p>}</div>
    <div className="cause-actions"><button type="button" className="action" onClick={() => onEdit(cause)} aria-label={`Editar causa: ${cause.title}`}><Icon name="gear" size={20} />Editar</button>
      {mine && mine.length > 0 && <Link className="action" to={`/organizaciones/${cause.organizationId}/necesidades?causa=${cause.id}`} aria-label={`Ver necesidades de ${cause.title}`}>Ver necesidades</Link>}
      {cause.status !== 'ARCHIVED' && <Link className="action primary" to={`/organizaciones/${cause.organizationId}/necesidades/nueva?causa=${cause.id}`} aria-label={`Nueva necesidad en ${cause.title}`}><Icon name="plus" size={20} />Nueva necesidad</Link>}</div>
  </Card></li>
}
function Skeleton() { return <ul className="cause-list" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card cause-card skeleton"><span className="cause-icon sk-line" /><div className="cause-main"><span className="sk-line w40" /><span className="sk-line w70" /><span className="sk-line w60" /></div></div></li>)}</ul> }

function CausesView({ org }: { org: Org }) {
  const { causes, needs } = useOrgWork(org.id), [dialog, setDialog] = useState<Cause | 'new' | null>(null), [result, setResult] = useState<Result>({}), resultRef = useRef<HTMLDivElement>(null)
  const items = causes.data ?? [], rank = (cause: Cause) => cause.status === 'ARCHIVED' ? 1 : 0, sorted = [...items].sort((a, b) => rank(a) - rank(b) || b.createdAt.localeCompare(a.createdAt))
  const saved = (cause: Cause) => { setDialog(null); setResult({ success: `Guardamos la causa «${cause.title}».` }); setTimeout(() => resultRef.current?.focus(), 60) }
  return <div className="work causes">
    <Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `/organizaciones/${org.id}/editar` }, { label: 'Causas' }]} />
    <PageHeading title="Causas" lead="Las causas agrupan tus necesidades: son la razón por la que pides apoyo."><button type="button" className="action primary" onClick={() => { setResult({}); setDialog('new') }}><Icon name="plus" size={20} />Nueva causa</button></PageHeading>
    {org.verificationStatus !== 'APPROVED' && <ApprovalNotice org={org} publishing={false} />}
    <div ref={resultRef} tabIndex={-1} className="act-result"><Feedback error={result.error} success={result.success} /></div>
    {causes.error ? <><Feedback error={causes.error} /><button type="button" className="action" onClick={() => void causes.refetch()}>Volver a intentar</button></>
      : causes.isPending ? <><p className="sr-only" role="status">Cargando tus causas…</p><Skeleton /></>
      : sorted.length === 0 ? <EmptyState title="Aún no tienes causas" action={<button type="button" className="action primary" onClick={() => setDialog('new')}><Icon name="plus" size={20} />Crear mi primera causa</button>}>Crea una causa para empezar a publicar las necesidades de tu organización.</EmptyState>
      : <><Feedback error={needs.error} /><ul className="cause-list">{sorted.map(cause => <CauseCard key={cause.id} cause={cause} needs={needs.data} onEdit={setDialog} />)}</ul></>}
    {dialog && <CauseDialog org={org} cause={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} onSaved={saved} />}
  </div>
}

export function Causes() {
  const { id = '' } = useParams()
  usePageTitle('Causas')
  return <OrgGate id={id}>{org => <CausesView org={org} />}</OrgGate>
}
