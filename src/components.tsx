import { useEffect, useRef, useState, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { ApiFailure } from './api/client'

export function Feedback({ error, success }: { error?: unknown; success?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error) ref.current?.focus() }, [error])
  return <>{error ? <div ref={ref} tabIndex={-1} className="form-feedback error" role="alert"><p>{error instanceof Error ? error.message : 'No fue posible completar esta acción.'}</p>{error instanceof ApiFailure && error.detail.traceId && <small>Referencia: {error.detail.traceId}</small>}</div> : null}{success && <p className="form-feedback success" role="status">{success}</p>}</>
}
function fieldError(error: unknown, name: string) { return error instanceof ApiFailure ? error.detail.fieldErrors?.filter(value => value.field === name).map(value => value.message).join(' ') : '' }
type FieldProps = { label: string; name: string; error?: unknown; hint?: string }
export function Field({ label, error, hint, ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const message = fieldError(error, props.name)
  const id = props.id ?? props.name
  return <div className="form-field"><label htmlFor={id}>{label}</label><input {...props} id={id} aria-invalid={!!message} aria-describedby={message || hint ? `${id}-help` : undefined} />{(message || hint) && <small id={`${id}-help`} className={message ? 'field-error' : ''}>{message || hint}</small>}</div>
}
export function TextArea({ label, error, hint, ...props }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const message = fieldError(error, props.name), id = props.id ?? props.name
  return <div className="form-field"><label htmlFor={id}>{label}</label><textarea {...props} id={id} aria-invalid={!!message} aria-describedby={message || hint ? `${id}-help` : undefined} />{(message || hint) && <small id={`${id}-help`} className={message ? 'field-error' : ''}>{message || hint}</small>}</div>
}
export function Select({ label, error, children, ...props }: FieldProps & SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  const message = fieldError(error, props.name), id = props.id ?? props.name
  return <div className="form-field"><label htmlFor={id}>{label}</label><select {...props} id={id} aria-invalid={!!message} aria-describedby={message ? `${id}-help` : undefined}>{children}</select>{message && <small className="field-error" id={`${id}-help`}>{message}</small>}</div>
}
export function Password({ label = 'Contraseña', ...props }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false)
  return <div className="password-field"><Field {...props} label={label} type={visible ? 'text' : 'password'} /><button type="button" className="text-button" aria-pressed={visible} onClick={() => setVisible(!visible)}>{visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button></div>
}
export function Submit({ busy, busyLabel = 'Guardando…', disabled = false, children }: { busy: boolean; busyLabel?: string; disabled?: boolean; children: ReactNode }) { return <button className="action primary" disabled={busy || disabled} type="submit">{busy ? busyLabel : children}</button> }
