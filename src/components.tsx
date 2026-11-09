import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ApiFailure } from './api/client'
import { Icon, type IconName } from './icons'

export function Feedback({ error, success }: { error?: unknown; success?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  return <>{error ? <div ref={ref} tabIndex={-1} className="form-feedback error" role="alert"><Icon name="alert" size={22} /><div><p>{error instanceof Error ? error.message : 'No fue posible completar esta acción.'}</p>{error instanceof ApiFailure && error.detail.traceId && <small>Referencia: {error.detail.traceId}</small>}</div></div> : null}{success && <p className="form-feedback success" role="status"><Icon name="checkCircle" size={22} />{success}</p>}</>
}
function fieldError(error: unknown, name: string) { return error instanceof ApiFailure ? error.detail.fieldErrors?.filter(value => value.field === name).map(value => value.message).join(' ') : '' }
type FieldProps = { label: string; name: string; error?: unknown; hint?: string }
export function Field({ label, error, hint, adornment, footer, ...props }: FieldProps & { adornment?: ReactNode; footer?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const message = fieldError(error, props.name)
  const id = props.id ?? props.name
  const input = <input {...props} id={id} aria-invalid={!!message} aria-describedby={message || hint ? `${id}-help` : undefined} />
  return <div className="form-field"><label htmlFor={id}>{label}</label>{adornment ? <div className="input-wrap">{input}{adornment}</div> : input}{(message || hint) && <small id={`${id}-help`} className={message ? 'field-error' : ''}>{message || hint}</small>}{footer && <div className="field-footer">{footer}</div>}</div>
}
export function TextArea({ label, error, hint, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const message = fieldError(error, props.name), id = props.id ?? props.name
  return <div className="form-field"><label htmlFor={id}>{label}</label><textarea {...props} id={id} aria-invalid={!!message} aria-describedby={message || hint ? `${id}-help` : undefined} />{(message || hint) && <small id={`${id}-help`} className={message ? 'field-error' : ''}>{message || hint}</small>}</div>
}
export function Select({ label, error, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const message = fieldError(error, props.name), id = props.id ?? props.name
  return <div className="form-field"><label htmlFor={id}>{label}</label><select {...props} id={id} aria-invalid={!!message} aria-describedby={message ? `${id}-help` : undefined}>{children}</select>{message && <small className="field-error" id={`${id}-help`}>{message}</small>}</div>
}
export function Password({ label = 'Contraseña', toggleName = 'contraseña', footer, ...props }: FieldProps & { toggleName?: string; footer?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  const action = visible ? 'Ocultar' : 'Mostrar'
  return <Field {...props} label={label} type={visible ? 'text' : 'password'} footer={footer} adornment={<button type="button" className="field-toggle" aria-label={`${action} ${toggleName}`} onClick={() => setVisible(!visible)}><Icon name={visible ? 'eyeOff' : 'eye'} size={22} /></button>} />
}
export function Submit({ busy, busyLabel = 'Guardando…', disabled = false, arrow = true, children }: { busy: boolean; busyLabel?: string; disabled?: boolean; arrow?: boolean; children: ReactNode }) { return <button className="action primary" disabled={busy || disabled} type="submit">{busy ? busyLabel : <>{children}{arrow && <Icon name="arrowRight" size={20} />}</>}</button> }
export function StatusBadge({ tone = 'neutral', children }: { tone?: 'ok' | 'wait' | 'no' | 'neutral'; children: ReactNode }) { return <span className={`badge badge-${tone}`}>{children}</span> }
export function PageHeading({ title, lead, children }: { title: string; lead?: string; children?: ReactNode }) { return <div className="page-heading"><div><h1>{title}</h1>{lead && <p>{lead}</p>}</div>{children}</div> }
export function Row({ title, badge, action, icon, leading, children }: { title: ReactNode; badge?: ReactNode; action: ReactNode; icon?: IconName; leading?: ReactNode; children?: ReactNode }) { return <li className="row">{leading ?? <span className="row-icon" aria-hidden="true"><Icon name={icon ?? 'people'} size={26} /></span>}<div className="row-main">{badge}<h2>{title}</h2>{children && <p>{children}</p>}</div><div className="row-side">{action}</div></li> }
export function FilePicker({ id, label, file, disabled, accept, onChange }: { id: string; label: string; file?: File; disabled?: boolean; accept: string; onChange: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="file-picker"><input id={id} className="file-input" type="file" accept={accept} disabled={disabled} aria-describedby={`${id}-name`} onChange={onChange} /><label className="action" htmlFor={id}><Icon name="clip" size={20} />{label}</label><span id={`${id}-name`} className="file-name">{file ? file.name : 'Ningún archivo elegido'}</span></div>
}
