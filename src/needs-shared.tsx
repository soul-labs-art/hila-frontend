// Piezas visuales comunes de causas y necesidades de una organización (planned: solo con features.needs).
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dateTime } from './activity-format'
import { api, ApiFailure, type Schemas } from './api/client'
import { Feedback, StatusBadge, TextArea } from './components'
import { formValue } from './form-values'
import { clientFailure, fieldMessage, isMember404, orgQuery, refreshWork, type Managed, type Org } from './needs-data'
import { Card, EmptyState, Icon, Notice, RadioCards } from './ui'


/** Cuerpo del aviso sobre la aprobación de la organización: quién puede publicar y qué falta. Sin culpar a nadie. */
export function ApprovalNotice({ org, publishing = true }: { org: Org; publishing?: boolean }) {
  const status = org.verificationStatus
  if (status === 'APPROVED') return <Notice tone="success">Tu organización está aprobada para publicar.</Notice>
  const why = status === 'REJECTED' ? 'Hila no aprobó la solicitud por ahora.' : status === 'SUSPENDED' ? 'Hila suspendió la aprobación de la organización.' : 'Hila todavía revisa la solicitud de tu organización.'
  return <Notice tone="warning"><p><strong>Por ahora {publishing ? 'solo puedes guardar borradores' : 'las causas quedan en borrador'}.</strong> {why} {status === 'PENDING' ? 'Cuando la aprueben podrás publicar.' : 'Revisa el motivo y los pasos siguientes en el '}{status !== 'PENDING' && <Link to={`/organizaciones/${org.id}/editar`}>perfil de la organización</Link>}{status !== 'PENDING' && '.'}</p></Notice>
}

export function Unavailable() {
  return <EmptyState headingLevel={1} title="Esta sección no está disponible." action={<Link className="action primary" to="/mis-organizaciones">Ir a mis organizaciones</Link>}>Puede que la organización no exista o que no hagas parte de su equipo.</EmptyState>
}

/** Carga la organización y decide si se puede ver: el contrato responde 404 a quien no es de su equipo. */
export function OrgGate({ id, children }: { id: string; children: (org: Org) => ReactNode }) {
  const query = useQuery(orgQuery(id))
  if (query.isPending) return <p className="loading-state" role="status">Cargando tu organización…</p>
  if (query.error) return isMember404(query.error) ? <Unavailable /> : <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  return <>{children(query.data)}</>
}

/** Diálogo con <dialog> nativo: foco atrapado, Escape y retorno del foco. Los errores de validación quedan dentro, junto a sus campos. */
export function Dialog({ title, confirmLabel, busy, error, wide = false, danger = false, onSubmit, onClose, children }: { title: string; confirmLabel: string; busy: boolean; error?: unknown; wide?: boolean; danger?: boolean; onSubmit: (data: FormData) => void; onClose: () => void; children?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), id = useId()
  useEffect(() => { const dialog = ref.current; if (dialog && !dialog.open) dialog.showModal() }, [])
  return <dialog ref={ref} className={`dialog${wide ? ' dialog-wide' : ''}`} aria-labelledby={`${id}-title`} onCancel={event => { if (busy) event.preventDefault() }} onClose={onClose} onClick={event => { if (event.target === ref.current && !busy) ref.current?.close() }}>
    <form className="dialog-body" noValidate onSubmit={(event: FormEvent<HTMLFormElement>) => { event.preventDefault(); onSubmit(new FormData(event.currentTarget)) }}>
      <h2 id={`${id}-title`}>{title}</h2><Feedback error={error} />{children}
      <div className="dialog-actions"><button type="button" className="action" disabled={busy} onClick={() => ref.current?.close()}>Mejor no</button><button type="submit" className={`action ${danger ? 'danger solid' : 'primary'}`} disabled={busy}>{busy ? 'Un momento…' : confirmLabel}</button></div>
    </form>
  </dialog>
}

/** Resumen de errores de validación con enlaces a cada campo; recibe el foco al aparecer. Otros errores van al aviso común. */
export function ErrorSummary({ error, labels }: { error?: unknown; labels: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  const items = error instanceof ApiFailure && error.detail.code === 'VALIDATION_FAILED' ? error.detail.fieldErrors ?? [] : []
  if (!error) return null
  if (!items.length) return <Feedback error={error} />
  return <div ref={ref} tabIndex={-1} className="form-feedback error" role="alert"><Icon name="alert" size={22} /><div><p><strong>Revisa estos campos para continuar.</strong></p>
    <ul className="error-list">{items.map((item, index) => <li key={index}><a href={`#${item.field}`} onClick={event => { event.preventDefault(); document.getElementById(item.field)?.focus() }}>{labels[item.field] ? `${labels[item.field]}: ` : ''}{item.message}</a></li>)}</ul></div></div>
}

const remapOutcome = (error: unknown) => error instanceof ApiFailure ? new ApiFailure(error.status, { ...error.detail, fieldErrors: error.detail.fieldErrors?.map(item => ({ ...item, field: item.field === 'summary' ? 'summaryOutcome' : item.field })) ?? [] }) : error

/** Resultado de la actividad: Cumplida / Parcial / No cumplida y resumen. Cierra la necesidad; con `blocked` explica qué falta y no deja guardar. */
export function OutcomeCard({ need, blocked, onDone }: { need: Managed; blocked?: ReactNode; onDone: (value: Managed) => void }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [status, setStatus] = useState('')
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError(undefined)
    if (!status) { setError(clientFailure([{ field: 'outcomeStatus', message: 'Elige cómo terminó la actividad.' }])); return }
    setBusy(true)
    try { const saved = await api<Managed>(`/needs/${need.id}/outcome`, { method: 'PUT', body: { outcomeStatus: status as Schemas['CloseNeedRequest']['outcomeStatus'], summary: formValue(data, 'summaryOutcome') } satisfies Schemas['CloseNeedRequest'] }); await refreshWork(client); onDone(saved) } catch (failure) { setError(failure) } finally { setBusy(false) }
  }
  const shown = remapOutcome(error)
  return <Card as="section" className="outcome-card" aria-labelledby="outcome-title"><h2 id="outcome-title">Resultado de la actividad</h2><p className="outcome-lead">Indica si se cumplió el objetivo. Al guardarlo, la necesidad se cierra y el resultado no se puede cambiar.</p>
    {blocked && <div id="outcome-blocked">{blocked}</div>}
    <form noValidate onSubmit={event => void save(event)}><ErrorSummary error={shown} labels={{ outcomeStatus: 'Resultado', summaryOutcome: 'Resumen' }} />
      <div className="outcome-grid"><div><RadioCards name="outcomeStatus" legend="¿Cómo terminó la actividad?" value={status} onChange={setStatus} options={[{ value: 'FULFILLED', label: 'Cumplida', hint: 'Se logró lo esperado' }, { value: 'PARTIAL', label: 'Parcial', hint: 'Se logró en parte' }, { value: 'NOT_FULFILLED', label: 'No cumplida', hint: 'No se logró' }]} />{fieldMessage(error, 'outcomeStatus') && <small id="outcomeStatus" tabIndex={-1} className="field-error">{fieldMessage(error, 'outcomeStatus')}</small>}</div>
        <TextArea label="Resumen del resultado *" name="summaryOutcome" required rows={4} maxLength={2000} hint="Qué se hizo, qué quedó pendiente y qué aprendieron. Hasta 2000 caracteres." error={shown} /></div>
      <div className="form-actions"><button type="submit" className="action primary" disabled={busy || !!blocked} aria-describedby={blocked ? 'outcome-blocked' : undefined}>{busy ? 'Guardando…' : 'Guardar cierre'}</button></div></form></Card>
}
export function OutcomeResult({ need }: { need: Managed }) {
  const result = need.outcome, name = { FULFILLED: 'Cumplida', PARTIAL: 'Parcial', NOT_FULFILLED: 'No cumplida' } as const
  if (!result) return null
  return <Card as="section" className="outcome-card" aria-labelledby="outcome-title"><h2 id="outcome-title">Resultado registrado</h2><StatusBadge tone={result.status === 'FULFILLED' ? 'ok' : result.status === 'PARTIAL' ? 'wait' : 'no'}>{name[result.status]}</StatusBadge><p className="preserve-lines">{result.summary}</p><p className="act-note">Registrado el {dateTime(result.verifiedAt)}. Ya no se puede cambiar.</p></Card>
}
