import { formValue } from './form-values'
import { lazy, Suspense, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, ApiFailure, type Schemas } from './api/client'
import { Field, Feedback, Password, Submit } from './components'
import { usePageTitle } from './page-title'
import { safeReturnTo, useSession } from './session-context'

const MockAccounts = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true' ? lazy(() => import('./MockAccounts')) : null
const linkSent ='Si la dirección puede recibir este mensaje, te enviaremos un enlace. Revisa también la carpeta de correo no deseado.'

function useEmailToken() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  useEffect(() => { if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search) }, [])
  return token
}
function useSubmit() {
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [success, setSuccess] = useState('')
  async function run(event: FormEvent<HTMLFormElement>, action: (data: FormData) => Promise<void>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError(undefined); setSuccess(''); setBusy(true)
    try { await action(data) } catch (value) { setError(value) } finally { setBusy(false) }
  }
  return { error, busy, success, setSuccess, run }
}
function emailFromState(state: unknown) { return state && typeof state === 'object' && 'email' in state && typeof state.email === 'string' ? state.email : '' }
function AccessLayout({ title, tab, intro, children }: { title: string; tab: string; intro?: string; children: ReactNode }) {
  usePageTitle(tab)
  return <div className="access-layout"><aside className="access-story"><img src="/brand/hila-emblema.png" alt="" /><p className="access-story-title">Lo que sabes hacer puede encontrar dónde hace falta.</p><p>Un espacio para acercar tus capacidades a las causas de tu territorio.</p></aside><section className="access-form"><h1>{title}</h1>{intro && <p>{intro}</p>}{children}</section></div>
}

export function Login() {
  const form = useSubmit(), [email, setEmail] = useState(''), navigate = useNavigate(), [search] = useSearchParams(), session = useSession()
  const unverified = form.error instanceof ApiFailure && form.error.detail.code === 'EMAIL_NOT_VERIFIED'
  function fill(value: string, password: string) { setEmail(value); const input = document.getElementById('password') as HTMLInputElement | null; if (input) { input.value = password; input.focus() } }
  return <AccessLayout tab="Ingresar" title="Vuelve a tu espacio en Hila." intro="Ingresa para cuidar tu perfil y acompañar tus organizaciones.">
    <Feedback error={form.error} />
    {unverified && <p>Aún no verificaste tu correo. <Link to="/registro/enviado" state={{ email }}>Enviar otro enlace de verificación</Link></p>}
    <form onSubmit={event => void form.run(event, async data => { await session.login(formValue(data, 'email'), String(data.get('password'))); navigate(safeReturnTo(search.get('returnTo')), { replace: true }) })}>
      <Field label="Correo electrónico" name="email" type="email" required autoComplete="email" maxLength={320} error={form.error} value={email} onChange={event => setEmail(event.target.value)} />
      <Password label="Contraseña" name="password" required minLength={1} maxLength={128} autoComplete="current-password" error={form.error} footer={<Link to="/recuperar-acceso">Olvidé mi contraseña</Link>} />
      <Submit busy={form.busy} busyLabel="Ingresando…">Ingresar</Submit>
    </form>
    <div className="access-links"><p>¿Primera vez en Hila? <Link to="/registro">Crear una cuenta</Link></p><p>¿No llegó el correo de verificación? <Link to="/registro/enviado" state={{ email }}>Pedir otro enlace</Link></p></div>
    {MockAccounts && <Suspense fallback={null}><MockAccounts onPick={fill} /></Suspense>}
  </AccessLayout>
}

export function Register() {
  const form = useSubmit(), navigate = useNavigate()
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api<Schemas['Policy'][]>('/policies/current'), retry: false })
  const policy = policies.data?.find(value => value.type === 'DATA_PROCESSING')
  return <AccessLayout tab="Crear cuenta" title="Tu aporte empieza contigo." intro="Crea una cuenta personal. Desde ella puedes participar como voluntario o representar una organización.">
    <Feedback error={form.error || policies.error} />
    <form onSubmit={event => void form.run(event, async data => {
      if (!policy) throw new Error('No pudimos cargar la política vigente. Vuelve a intentarlo.')
      try { await api('/auth/registrations', { method: 'POST', body: { displayName: formValue(data, 'displayName'), email: formValue(data, 'email'), password: String(data.get('password')), adultConfirmed: data.get('adultConfirmed') === 'on', dataProcessingPolicyVersion: policy.version } }) }
      catch (value) { if (value instanceof ApiFailure && value.detail.code === 'POLICY_VERSION_OUTDATED') void policies.refetch(); throw value }
      navigate('/registro/enviado', { state: { email: formValue(data, 'email') } })
    })}>
      <Field label="Tu nombre" name="displayName" required maxLength={140} autoComplete="name" error={form.error} />
      <Field label="Correo electrónico" name="email" type="email" required autoComplete="email" maxLength={320} error={form.error} />
      <Password label="Contraseña" name="password" required minLength={12} maxLength={128} autoComplete="new-password" error={form.error} hint="Entre 12 y 128 caracteres. Puedes utilizar una frase larga." />
      <label className="check-field"><input name="adultConfirmed" type="checkbox" required /> Soy mayor de 18 años.</label>
      {policy ? <><details className="policy"><summary>{policy.title} · versión {policy.version}</summary><div>{policy.content}</div></details><label className="check-field"><input name="consent" type="checkbox" required /> He leído y acepto esta política de tratamiento de datos.</label></> : <p role="status">{policies.isPending ? 'Cargando la política vigente…' : 'La política no está disponible.'}</p>}
      <Submit busy={form.busy} disabled={!policy} busyLabel="Creando tu cuenta…">Crear mi cuenta</Submit>
    </form>
    <div className="access-links"><p>¿Ya tienes cuenta? <Link to="/ingresar">Ingresar</Link></p></div>
  </AccessLayout>
}

export function CheckEmail() {
  const form = useSubmit(), email = emailFromState(useLocation().state)
  return <AccessLayout tab="Revisa tu correo" title="Revisa tu correo." intro="El enlace verifica que esta dirección te pertenece. No compartas ese enlace con otras personas.">
    <Feedback error={form.error} success={form.success} />
    <form onSubmit={event => void form.run(event, async data => { await api('/auth/email-verification-requests', { method: 'POST', body: { email: formValue(data, 'email') } }); form.setSuccess(linkSent) })}>
      <Field label="Correo electrónico" name="email" type="email" required autoComplete="email" maxLength={320} error={form.error} defaultValue={email} />
      <Submit busy={form.busy} busyLabel="Enviando…">Reenviar verificación</Submit>
    </form>
    <div className="access-links"><p><Link to="/ingresar">Volver a ingresar</Link></p></div>
  </AccessLayout>
}

export function VerifyEmail() {
  const form = useSubmit(), token = useEmailToken()
  return <AccessLayout tab="Verificar correo" title="Verifica tu correo." intro="El enlace verifica que esta dirección te pertenece. No compartas ese enlace con otras personas.">
    <Feedback error={form.error} success={form.success} />
    {form.success ? <Link className="action primary" to="/ingresar">Ingresar</Link> : <form onSubmit={event => void form.run(event, async () => {
      if (!token) throw new Error('Abre el enlace completo que recibiste por correo. Puedes solicitar uno nuevo más abajo.')
      await api('/auth/email-verifications', { method: 'POST', body: { token } }); form.setSuccess('Tu correo está verificado. Ya puedes ingresar a Hila.')
    })}>
      {!token && <p>Este enlace no contiene un token de verificación.</p>}
      <Submit busy={form.busy} busyLabel="Verificando…">Verificar mi correo</Submit>
    </form>}
    <div className="access-links"><p><Link to="/ingresar">Volver a ingresar</Link></p><p><Link to="/registro/enviado">Solicitar otro enlace de verificación</Link></p></div>
  </AccessLayout>
}

export function ForgotAccess() {
  const form = useSubmit(), email = emailFromState(useLocation().state)
  return <AccessLayout tab="Recuperar acceso" title="Recupera tu acceso." intro="Escribe el correo de tu cuenta para solicitar un enlace de recuperación.">
    <Feedback error={form.error} success={form.success} />
    <form onSubmit={event => void form.run(event, async data => { await api('/auth/password-reset-requests', { method: 'POST', body: { email: formValue(data, 'email') } }); form.setSuccess(linkSent) })}>
      <Field label="Correo electrónico" name="email" type="email" required autoComplete="email" maxLength={320} error={form.error} defaultValue={email} />
      <Submit busy={form.busy} busyLabel="Enviando…">Enviar enlace</Submit>
    </form>
    <div className="access-links"><p><Link to="/ingresar">Volver a ingresar</Link></p></div>
  </AccessLayout>
}

export function ResetAccess() {
  const form = useSubmit(), token = useEmailToken()
  return <AccessLayout tab="Nueva contraseña" title="Elige una nueva contraseña.">
    <Feedback error={form.error} success={form.success} />
    {form.success ? <Link className="action primary" to="/ingresar">Ingresar</Link> : <form onSubmit={event => void form.run(event, async data => {
      if (!token) throw new Error('Abre el enlace completo del correo o solicita uno nuevo.')
      if (data.get('password') !== data.get('confirmation')) throw new ApiFailure(422, { code: 'VALIDATION_FAILED', message: 'Las contraseñas no coinciden. Revisa ambos campos.', traceId: '', fieldErrors: [{ code: 'INVALID_FORMAT', field: 'confirmation', message: 'Escribe la misma contraseña en los dos campos.' }] })
      await api('/auth/password-resets', { method: 'POST', body: { token, password: String(data.get('password')) } }); form.setSuccess('Guardamos tu nueva contraseña. Ingresa de nuevo para continuar.')
    })}>
      <Password label="Nueva contraseña" toggleName="nueva contraseña" name="password" required minLength={12} maxLength={128} autoComplete="new-password" error={form.error} hint="Entre 12 y 128 caracteres. Puedes utilizar una frase larga." />
      <Password label="Repite la nueva contraseña" toggleName="contraseña repetida" name="confirmation" required minLength={12} maxLength={128} autoComplete="new-password" error={form.error} />
      {!token && <p>Este enlace no contiene un token de recuperación. <Link to="/recuperar-acceso">Solicitar otro enlace</Link></p>}
      <Submit busy={form.busy} busyLabel="Guardando…">Guardar contraseña</Submit>
    </form>}
    <div className="access-links"><p><Link to="/ingresar">Volver a ingresar</Link></p></div>
  </AccessLayout>
}
