import type { Schemas } from '../client'

export type Token = { value: string; kind: 'verify' | 'reset'; accountId: string }
export type Account = {
  id: string; email: string; displayName: string; password: string; verifiedAt: string | null; roles: Schemas['CurrentUser']['roles']; createdAt: string
  consents: Schemas['Consent'][]; alerts: Schemas['OpportunityAlerts'] | null; profile: Schemas['VolunteerProfile'] | null
}
export type State = {
  version: 1; sessionId: string | null; accounts: Account[]; organizations: Schemas['Organization'][]
  memberships: Schemas['Membership'][]; verifications: Schemas['OrganizationVerification'][]; tokens: Token[]
}
export type ErrorCode = Schemas['ApiError']['code']
export type FieldError = Schemas['FieldError']
export type Ctx = { method: string; params: Record<string, string>; query: URLSearchParams; body: unknown; form: FormData | null }
export type Result = { status: number; body?: unknown; blob?: Blob }
export type Handler = (ctx: Ctx) => Result | Promise<Result>
export type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler }
