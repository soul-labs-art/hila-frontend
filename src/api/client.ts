import type { components } from './schema'

export type Schemas = components['schemas']
export class ApiFailure extends Error {
  status: number
  detail: Schemas['ApiError']
  constructor(status: number, detail: Schemas['ApiError']) {
    super(detail.message); this.status = status; this.detail = detail
  }
}

let csrf: string | undefined
let csrfRequest: Promise<string> | undefined
export function clearCsrf() { csrf = undefined; csrfRequest = undefined }
async function csrfToken() {
  if (csrf) return csrf
  if (!csrfRequest) csrfRequest = fetch('/api/v1/auth/csrf', { credentials: 'include', cache: 'no-store' })
    .then(async response => {
      if (!response.ok) throw new Error('No fue posible preparar una conexión segura. Recarga e inténtalo otra vez.')
      const value = await response.json() as Schemas['CsrfToken']
      csrf = value.token
      return value.token
    }).finally(() => { csrfRequest = undefined })
  return csrfRequest
}

export async function api<T>(path: string, options: { method?: string; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  const method = options.method ?? 'GET'
  const headers = new Headers({ Accept: 'application/json' })
  const form = options.body instanceof FormData
  if (options.body !== undefined && !form) headers.set('Content-Type', 'application/json')
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) headers.set('X-CSRF-TOKEN', await csrfToken())
  let response: Response
  try {
    response = await fetch(`/api/v1${path}`, { method, headers, credentials: 'include', cache: 'no-store', signal: options.signal,
      body: options.body === undefined ? undefined : form ? options.body as FormData : JSON.stringify(options.body) })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new Error('No pudimos conectar con Hila. Comprueba tu conexión. Si estabas guardando, revisa el resultado antes de repetir.')
  }
  if (!response.ok) {
    let detail: Schemas['ApiError']
    try { detail = await response.json() as Schemas['ApiError'] }
    catch { detail = { code: 'INTERNAL_ERROR', message: 'No pudimos completar la solicitud. Inténtalo de nuevo más tarde.', fieldErrors: [], traceId: '' } }
    if (detail.code === 'CSRF_INVALID') clearCsrf()
    if (response.status === 401 && path !== '/auth/sessions' && path !== '/me') {
      clearCsrf()
      window.dispatchEvent(new Event('hila:session-expired'))
    }
    throw new ApiFailure(response.status, detail)
  }
  return response.status === 204 ? undefined as T : await response.json() as T
}
