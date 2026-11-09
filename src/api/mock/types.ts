import type { Schemas } from '../client'

export type Token = { value: string; kind: 'verify' | 'reset'; accountId: string }
// Capacidades del perfil voluntario (operaciones planned): se guardan como entradas y se resuelven contra los catálogos al responder.
export type Capacities = { skills: Schemas['VolunteerSkillInput'][]; availability: Schemas['AvailabilitySlot'][]; serviceAreas: string[]; resources: Schemas['VolunteerResourceInput'][] }
export type Account = {
  id: string; email: string; displayName: string; password: string; verifiedAt: string | null; roles: Schemas['CurrentUser']['roles']; createdAt: string
  consents: Schemas['Consent'][]; alerts: Schemas['OpportunityAlerts'] | null; profile: Schemas['VolunteerProfile'] | null
  status?: 'ACTIVE' | 'SUSPENDED'; capacities?: Capacities
}
// Necesidad tal como se guarda: habilidades y recursos como entradas; la vista ManagedNeed/PublicNeed se arma al responder.
export type NeedRecord = Omit<Schemas['ManagedNeed'], 'organization' | 'slotsAvailable' | 'skills' | 'resources'> & { skills: Schemas['NeedSkillInput'][]; resources: Schemas['NeedResourceInput'][] }
export type EvidenceRecord = Schemas['Evidence'] & { dataUrl: string | null }
export type NotificationRecord = Schemas['Notification'] & { userId: string }
export type State = {
  version: 2; sessionId: string | null; accounts: Account[]; organizations: Schemas['Organization'][]
  memberships: Schemas['Membership'][]; verifications: Schemas['OrganizationVerification'][]; tokens: Token[]
  // Colecciones de las operaciones planned del contrato.
  skills: Schemas['Skill'][]; resources: Schemas['Resource'][]; territories: Schemas['Territory'][]; causes: Schemas['Cause'][]; needs: NeedRecord[]
  applications: Schemas['Application'][]; participations: Schemas['Participation'][]; evidence: EvidenceRecord[]; feedback: Schemas['Feedback'][]
  notifications: NotificationRecord[]; audit: Schemas['AuditEvent'][]
}
export type ErrorCode = Schemas['ApiError']['code']
export type FieldError = Schemas['FieldError']
export type Ctx = { method: string; params: Record<string, string>; query: URLSearchParams; body: unknown; form: FormData | null }
export type Result = { status: number; body?: unknown; blob?: Blob }
export type Handler = (ctx: Ctx) => Result | Promise<Result>
export type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler }
