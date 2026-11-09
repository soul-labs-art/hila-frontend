import type { Schemas } from '../../client'
import { Fail } from '../errors'
import { csrfToken, route } from '../router'
import { policies } from '../seed'
import { db } from '../store'
import type { Account } from '../types'
import { message, noContent, now, ok, uid } from '../util'
import { text, flag, validate } from '../validate'
import { requireUser, toUser } from '../views'

const email = text(320, { format: 'email' }), password = (min: number) => text(128, { min, raw: true })
const findByEmail = (value: string) => db().accounts.find(item => item.email === value.toLowerCase())
function issueToken(account: Account, kind: 'verify' | 'reset') {
  const value = `ejemplo-${uid().slice(0, 8)}`
  db().tokens.push({ value, kind, accountId: account.id })
  console.info(`[hila-mock] Enlace de ${kind === 'verify' ? 'verificación' : 'restablecimiento'} para ${account.email}: ${location.origin}/${kind === 'verify' ? 'verificar-correo' : 'restablecer-acceso'}#token=${value}`)
}
function useToken(value: string, kind: 'verify' | 'reset') {
  const tokens = db().tokens, exact = tokens.findIndex(item => item.value === value && item.kind === kind)
  const index = exact >= 0 ? exact : tokens.findLastIndex(item => item.kind === kind)
  if (index < 0) return null
  const [token] = tokens.splice(index, 1)
  return db().accounts.find(item => item.id === token.accountId) ?? null
}
const linkSent = message('Si la dirección puede recibir este mensaje, te enviaremos un enlace. Revisa también la carpeta de correo no deseado.')
const invalidToken = () => new Fail(422, 'TOKEN_INVALID_OR_EXPIRED', 'El enlace no es válido o ya venció. Solicita uno nuevo.')
const checkToken = (body: unknown) => { if (typeof body === 'object' && body !== null && 'token' in body && typeof body.token === 'string' && !body.token.trim()) throw invalidToken() }

export const authRoutes = [
  route('GET', '/auth/csrf', () => ok({ headerName: 'X-CSRF-TOKEN', token: csrfToken } satisfies Schemas['CsrfToken'])),
  route('POST', '/auth/registrations', ({ body }) => {
    const data = validate<Schemas['RegistrationRequest']>(body, { displayName: text(140), email, password: password(12), adultConfirmed: flag(true), dataProcessingPolicyVersion: text(40) })
    if (data.dataProcessingPolicyVersion !== policies[0].version) throw new Fail(409, 'POLICY_VERSION_OUTDATED', 'La política de tratamiento de datos cambió. Léela de nuevo antes de continuar.')
    if (!findByEmail(data.email)) {
      const account: Account = { id: uid(), email: data.email.toLowerCase(), displayName: data.displayName, password: data.password, verifiedAt: null, roles: ['USER'], createdAt: now(), alerts: null, profile: null,
        consents: [{ type: 'DATA_PROCESSING', version: data.dataProcessingPolicyVersion, acceptedAt: now(), revokedAt: null }] }
      db().accounts.push(account); issueToken(account, 'verify')
    }
    return ok({ status: 'VERIFICATION_REQUIRED', message: 'Te enviamos un enlace para verificar tu correo. Revisa también la carpeta de correo no deseado.' } satisfies Schemas['RegistrationAccepted'], 202)
  }),
  route('POST', '/auth/email-verifications', ({ body }) => {
    checkToken(body)
    const { token } = validate<Schemas['TokenRequest']>(body, { token: text(512, { raw: true }) })
    const account = useToken(token, 'verify') ?? db().accounts.findLast(item => !item.verifiedAt)
    if (account) account.verifiedAt ??= now()
    return noContent()
  }),
  route('POST', '/auth/email-verification-requests', ({ body }) => {
    const account = findByEmail(validate<Schemas['EmailRequest']>(body, { email }).email)
    if (account && !account.verifiedAt) issueToken(account, 'verify')
    return ok(linkSent, 202)
  }),
  route('POST', '/auth/sessions', ({ body }) => {
    const data = validate<Schemas['SessionRequest']>(body, { email, password: password(1) })
    const account = findByEmail(data.email)
    if (!account || account.password !== data.password) throw new Fail(401, 'INVALID_CREDENTIALS', 'El correo o la contraseña no coinciden. Revísalos e inténtalo de nuevo.')
    if (!account.verifiedAt) throw new Fail(403, 'EMAIL_NOT_VERIFIED', 'Aún no verificaste tu correo. Revisa tu bandeja o solicita otro enlace.')
    if (account.status === 'SUSPENDED') throw new Fail(403, 'ACCOUNT_SUSPENDED', 'Tu cuenta está suspendida. Escríbenos si crees que se trata de un error.')
    db().sessionId = account.id
    return ok(toUser(account))
  }),
  route('DELETE', '/auth/sessions/current', () => { requireUser(); db().sessionId = null; return noContent() }),
  route('POST', '/auth/password-reset-requests', ({ body }) => {
    const account = findByEmail(validate<Schemas['EmailRequest']>(body, { email }).email)
    if (account?.verifiedAt) issueToken(account, 'reset')
    return ok(linkSent, 202)
  }),
  route('POST', '/auth/password-resets', ({ body }) => {
    checkToken(body)
    const data = validate<Schemas['PasswordResetRequest']>(body, { token: text(512, { raw: true }), password: password(12) })
    const account = useToken(data.token, 'reset')
    if (!account) throw invalidToken()
    account.password = data.password
    if (db().sessionId === account.id) db().sessionId = null
    return noContent()
  }),
]
