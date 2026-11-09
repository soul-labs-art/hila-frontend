import { Fail } from './errors'
import { persist } from './store'
import type { Ctx, Handler, Route } from './types'

export const csrfToken = 'mock-csrf-token'
export function route(method: string, path: string, handler: Handler): Route {
  const keys: string[] = []
  const source = path.replace(/\{(\w+)\}/g, (_, key: string) => { keys.push(key); return '([^/]+)' })
  return { method, pattern: new RegExp(`^${source}$`), keys, handler }
}
function parseBody(init: RequestInit): { body: unknown; form: FormData | null } {
  if (init.body instanceof FormData) return { body: undefined, form: init.body }
  if (typeof init.body !== 'string') return { body: undefined, form: null }
  try { return { body: JSON.parse(init.body) as unknown, form: null } }
  catch { throw new Fail(400, 'MALFORMED_REQUEST', 'La solicitud no tiene un formato válido.') }
}
const json = (status: number, body?: unknown) => new Response(status === 204 ? null : JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

export async function dispatch(routes: Route[], input: string, init: RequestInit = {}): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase(), url = new URL(input, location.origin), path = url.pathname.replace(/^\/api\/v1/, '')
  await new Promise(resolve => setTimeout(resolve, 60))
  if (init.signal?.aborted) throw new DOMException('Solicitud cancelada', 'AbortError')
  try {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && new Headers(init.headers).get('X-CSRF-TOKEN') !== csrfToken) throw new Fail(403, 'CSRF_INVALID', 'La sesión de seguridad venció. Recarga la página e inténtalo otra vez.')
    let params: Record<string, string> | undefined, found: Route | undefined
    for (const candidate of routes) {
      if (candidate.method !== method) continue
      const match = candidate.pattern.exec(path)
      if (match) { found = candidate; params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])])); break }
    }
    if (!found || !params) throw new Fail(404, 'RESOURCE_NOT_FOUND', routes.some(item => item.pattern.test(path)) ? 'Método no permitido.' : 'Esta operación todavía no está disponible con datos de ejemplo.')
    const ctx: Ctx = { method, params, query: url.searchParams, ...parseBody(init) }
    const result = await found.handler(ctx)
    if (method !== 'GET') persist()
    if (result.blob) return new Response(result.blob, { status: result.status, headers: { 'Content-Type': result.blob.type } })
    return json(result.status, result.body)
  } catch (error) {
    if (!(error instanceof Fail)) throw error
    if (method !== 'GET') persist()
    return json(error.status, { code: error.code, message: error.message, fieldErrors: error.fieldErrors, traceId: `ejemplo-${Math.random().toString(16).slice(2, 10)}` })
  }
}
