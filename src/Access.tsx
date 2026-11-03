import { formValue } from './form-values'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Field, Feedback, Password, Submit } from './components'
import { useSession } from './session-context'

function useEmailToken() {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('token') ?? '')
  useEffect(() => { if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search) }, [])
  return token
}
export function Access({ mode }: { mode: 'login' | 'register' | 'verify' | 'forgot' | 'reset' | 'sent' }) {
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [success, setSuccess] = useState('')
  const [email, setEmail] = useState('')
  const navigate = useNavigate(), [search] = useSearchParams(), session = useSession(), token = useEmailToken()
  const policies = useQuery({ queryKey: ['policies'], queryFn: () => api<Schemas['Policy'][]>('/policies/current'), enabled: mode === 'register', retry: false })
  const policy = policies.data?.find(value => value.type === 'DATA_PROCESSING')
  const titles = { login: 'Vuelve a tu espacio en Hila.', register: 'Tu aporte empieza contigo.', verify: 'Verifica tu correo.', forgot: 'Recupera tu acceso.', reset: 'Elige una nueva contraseña.', sent: 'Revisa tu correo.' }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const data = new FormData(event.currentTarget); setError(undefined); setSuccess(''); setBusy(true)
    try {
      if (mode === 'login') {
        await session.login(formValue(data, 'email'), String(data.get('password')))
        const target = search.get('returnTo')
        navigate(target?.startsWith('/') && !target.startsWith('//') && !target.includes('\\') ? target : '/mi-cuenta', { replace: true })
      } else if (mode === 'register') {
        if (!policy) throw new Error('No pudimos cargar la política vigente. Vuelve a intentarlo.')
        await api('/auth/registrations', { method: 'POST', body: { displayName: formValue(data, 'displayName'), email: formValue(data, 'email'), password: String(data.get('password')), adultConfirmed: data.get('adultConfirmed') === 'on', dataProcessingPolicyVersion: policy.version } })
        navigate('/registro/enviado')
      } else if (mode === 'forgot' || mode === 'sent') {
        await api(mode === 'forgot' ? '/auth/password-reset-requests' : '/auth/email-verification-requests', { method: 'POST', body: { email: formValue(data, 'email') } })
        setSuccess('Si la dirección puede recibir este mensaje, te enviaremos un enlace. Revisa también la carpeta de correo no deseado.')
      } else if (mode === 'verify') {
        if (!token) throw new Error('Abre el enlace completo que recibiste por correo. Puedes solicitar uno nuevo más abajo.')
        await api('/auth/email-verifications', { method: 'POST', body: { token } }); setSuccess('Tu correo está verificado. Ya puedes ingresar a Hila.')
      } else {
        if (!token) throw new Error('Abre el enlace completo del correo o solicita uno nuevo.')
        if (data.get('password') !== data.get('confirmation')) throw new Error('Las contraseñas no coinciden. Revisa ambos campos.')
        await api('/auth/password-resets', { method: 'POST', body: { token, password: String(data.get('password')) } }); setSuccess('Guardamos tu nueva contraseña. Ingresa de nuevo para continuar.')
      }
    } catch (value) { setError(value) } finally { setBusy(false) }
  }
  return <div className="access-layout"><aside className="access-story"><img src="/brand/hila-emblema.png" alt="Emblema de Hila" /><h2>Lo que sabes hacer puede encontrar dónde hace falta.</h2><p>Un espacio para acercar tus capacidades a las causas de tu territorio.</p></aside><section className="access-form"><h1>{titles[mode]}</h1>
    {mode === 'register' && <p>Crea una cuenta personal. Desde ella puedes participar como voluntario o representar una organización.</p>}
    {mode === 'login' && <p>Ingresa para cuidar tu perfil y acompañar tus organizaciones.</p>}
    {(mode === 'sent' || mode === 'verify') && <p>El enlace verifica que esta dirección te pertenece. No compartas ese enlace con otras personas.</p>}
    {mode === 'forgot' && <p>Escribe el correo de tu cuenta para solicitar un enlace de recuperación.</p>}
    <Feedback error={error || policies.error} success={success} />
    {success && (mode === 'verify' || mode === 'reset') ? <Link className="action primary" to="/ingresar">Ingresar</Link> : <form onSubmit={event => void submit(event)}>
      {mode === 'register' && <Field label="Tu nombre" name="displayName" required maxLength={140} autoComplete="name" error={error} />}
      {['login', 'register', 'forgot', 'sent'].includes(mode) && <Field label="Correo electrónico" name="email" type="email" required autoComplete="email" maxLength={320} error={error} value={email} onChange={event => setEmail(event.target.value)} />}
      {['login', 'register', 'reset'].includes(mode) && <Password label={mode === 'reset' ? 'Nueva contraseña' : 'Contraseña'} name="password" required minLength={mode === 'login' ? 1 : 12} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} error={error} hint={mode === 'login' ? undefined : 'Entre 12 y 128 caracteres. Puedes utilizar una frase larga.'} />}
      {mode === 'reset' && <Password label="Repite la nueva contraseña" name="confirmation" required autoComplete="new-password" />}
      {mode === 'register' && <><label className="check-field"><input name="adultConfirmed" type="checkbox" required /> Soy mayor de 18 años.</label>{policy ? <><details className="policy"><summary>{policy.title} · versión {policy.version}</summary><div>{policy.content}</div></details><label className="check-field"><input name="consent" type="checkbox" required /> He leído y acepto esta política de tratamiento de datos.</label></> : <p role="status">{policies.isPending ? 'Cargando la política vigente…' : 'La política no está disponible.'}</p>}</>}
      {mode === 'verify' && !token && <p>Este enlace no contiene un token de verificación.</p>}
      {mode === 'reset' && !token && <p>Este enlace no contiene un token de recuperación. <Link to="/recuperar-acceso">Solicitar otro enlace</Link></p>}
      <Submit busy={busy || (mode === 'register' && !policy)}>{({ login: 'Ingresar', register: 'Crear mi cuenta', verify: 'Verificar mi correo', forgot: 'Enviar enlace', reset: 'Guardar contraseña', sent: 'Reenviar verificación' })[mode]}</Submit>
    </form>}
    <div className="access-links">{mode === 'login' ? <><Link to="/recuperar-acceso">Olvidé mi contraseña</Link><Link to="/registro">Crear una cuenta</Link><Link to="/registro/enviado">Necesito verificar mi correo</Link></> : <Link to="/ingresar">Volver a ingresar</Link>}{mode === 'verify' && <Link to="/registro/enviado">Solicitar otro enlace de verificación</Link>}</div>
  </section></div>
}
