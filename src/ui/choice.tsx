import type { InputHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '../icons'

type NativeProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'children'>

/** Opción seleccionable. Con checkbox (varias) o radio (una). Al estar activa muestra check y relleno arcilla. */
export function Chip({ type = 'checkbox', children, className = '', ...props }: NativeProps & { type?: 'checkbox' | 'radio'; children: ReactNode }) {
  return <label className={`chip ${className}`.trim()}><input type={type} {...props} /><span><Icon name="check" size={16} />{children}</span></label>
}
export function ChipGroup({ legend, hint, children, className = '' }: { legend: string; hint?: string; children: ReactNode; className?: string }) {
  return <fieldset className={`choice-group ${className}`.trim()}><legend>{legend}</legend>{hint && <p className="choice-hint">{hint}</p>}<div className="chip-group">{children}</div></fieldset>
}

/** Interruptor real (checkbox con role="switch"). El texto de estado evita depender solo del color. */
export function Toggle({ label, hint, checked, onChange, disabled, onText = 'Activado', offText = 'Desactivado', icon }: { label: string; hint?: string; checked: boolean; onChange: (value: boolean) => void; disabled?: boolean; onText?: string; offText?: string; icon?: IconName }) {
  return <label className={`toggle${disabled ? ' is-disabled' : ''}`}>{icon && <Icon name={icon} size={22} />}<span className="toggle-copy"><strong>{label}</strong>{hint && <small>{hint}</small>}</span><span className="toggle-state">{checked ? onText : offText}</span><input type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={event => onChange(event.target.checked)} /><span className="toggle-track" aria-hidden="true"><span /></span></label>
}

export type RadioOption = { value: string; label: string; hint?: string; icon?: IconName }
/** Opciones tipo tarjeta con radio nativo (p. ej. Organización formal / Colectivo comunitario, Cumplida / Parcial / No cumplida). */
export function RadioCards({ name, legend, options, value, defaultValue, onChange, disabled, className = '', hideLegend }: { name: string; legend: string; options: RadioOption[]; value?: string; defaultValue?: string; onChange?: (value: string) => void; disabled?: boolean; className?: string; hideLegend?: boolean }) {
  return <fieldset className={`choice-group ${className}`.trim()} disabled={disabled}><legend className={hideLegend ? 'sr-only' : undefined}>{legend}</legend><div className="radio-cards">{options.map(option => <label key={option.value} className="radio-card"><input type="radio" name={name} value={option.value} checked={value === undefined ? undefined : value === option.value} defaultChecked={value === undefined ? defaultValue === option.value : undefined} onChange={() => onChange?.(option.value)} /><span className="radio-card-body">{option.icon && <Icon name={option.icon} size={22} />}<span className="radio-dot" aria-hidden="true" /><span><strong>{option.label}</strong>{option.hint && <small>{option.hint}</small>}</span></span></label>)}</div></fieldset>
}

/** Escala de valoración en círculos (1–5) con radios nativos y extremos rotulados. */
export function RatingScale({ name, legend, value, onChange, min = 1, max = 5, lowLabel, highLabel }: { name: string; legend: string; value?: number; onChange?: (value: number) => void; min?: number; max?: number; lowLabel?: string; highLabel?: string }) {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index)
  return <fieldset className="choice-group rating"><legend>{legend}</legend><div className="rating-scale">{values.map(item => <label key={item}><input type="radio" name={name} value={item} checked={value === undefined ? undefined : value === item} onChange={() => onChange?.(item)} /><span>{item}</span></label>)}</div>{(lowLabel || highLabel) && <div className="rating-labels" aria-hidden="true"><span>{lowLabel}</span><span>{highLabel}</span></div>}</fieldset>
}
