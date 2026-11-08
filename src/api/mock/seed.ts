// Datos ficticios para desarrollo: ninguna persona, correo ni organización es real.
// Contraseña de ejemplo de TODAS las cuentas semilla: ejemplo-hila-2026
import type { Schemas } from '../client'
import type { Account, State } from './types'

export const examplePassword = 'ejemplo-hila-2026'
export const ids = { valentina: 1, camilo: 2, mariana: 3, admin: 4, semillas: 1, huerta: 2, caminoNuevo: 3 }
export const seedId = (group: number, n: number) => `${group.toString(16).padStart(8, '0')}-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const accountId = (n: number) => seedId(0xa, n), orgId = (n: number) => seedId(0xb, n), territoryId = (n: number) => seedId(0xc, n)

export const policies: Schemas['Policy'][] = [
  { type: 'DATA_PROCESSING', version: 'ejemplo-2026-01', title: 'Política de tratamiento de datos (ejemplo)', publishedAt: '2026-01-15T12:00:00Z',
    content: 'Esta es una política de ejemplo para el entorno de desarrollo de Hila. No describe ningún tratamiento real de datos: nada de lo que registres en este modo sale de tu navegador.' },
  { type: 'OPPORTUNITY_ALERTS', version: 'ejemplo-2026-01', title: 'Avisos de oportunidades (ejemplo)', publishedAt: '2026-01-15T12:00:00Z',
    content: 'Texto de ejemplo para probar la aceptación de avisos de oportunidades. No se envía ningún correo en el modo de datos de ejemplo.' },
]

const places: [number, string, string, Schemas['Territory']['type'], number | null][] = [
  [1, 'Valle de Aburrá', 'valle-de-aburra', 'VALLEY', null], [2, 'Medellín', 'medellin', 'MUNICIPALITY', 1], [3, 'Bello', 'bello', 'MUNICIPALITY', 1],
  [4, 'Envigado', 'envigado', 'MUNICIPALITY', 1], [5, 'Itagüí', 'itagui', 'MUNICIPALITY', 1], [6, 'Sabaneta', 'sabaneta', 'MUNICIPALITY', 1],
  [7, 'Copacabana', 'copacabana', 'MUNICIPALITY', 1], [8, 'La Estrella', 'la-estrella', 'MUNICIPALITY', 1], [9, 'Caldas', 'caldas', 'MUNICIPALITY', 1],
  [10, 'Girardota', 'girardota', 'MUNICIPALITY', 1], [11, 'Barbosa', 'barbosa', 'MUNICIPALITY', 1],
  [12, 'Comuna 1 · Popular', 'medellin-comuna-1-popular', 'COMMUNE', 2], [13, 'Comuna 3 · Manrique', 'medellin-comuna-3-manrique', 'COMMUNE', 2],
  [14, 'Comuna 8 · Villa Hermosa', 'medellin-comuna-8-villa-hermosa', 'COMMUNE', 2], [15, 'Comuna 13 · San Javier', 'medellin-comuna-13-san-javier', 'COMMUNE', 2],
  [16, 'Comuna 14 · El Poblado', 'medellin-comuna-14-el-poblado', 'COMMUNE', 2], [17, 'Comuna 16 · Belén', 'medellin-comuna-16-belen', 'COMMUNE', 2],
  [18, 'Santo Domingo Savio', 'medellin-santo-domingo-savio', 'NEIGHBORHOOD', 12],
]
export const territories: Schemas['Territory'][] = places.map(([n, name, slug, type, parent]) => ({ id: territoryId(n), slug, name, type, parentId: parent ? territoryId(parent) : null, active: true }))
export const territoryById = (id: string | null) => territories.find(item => item.id === id) ?? null

function account(n: number, email: string, displayName: string, verified: boolean, roles: Account['roles'], extra: Partial<Account> = {}): Account {
  const createdAt = '2026-07-20T15:00:00Z'
  return { id: accountId(n), email, displayName, password: examplePassword, verifiedAt: verified ? createdAt : null, roles, createdAt, alerts: null, profile: null,
    consents: [{ type: 'DATA_PROCESSING', version: policies[0].version, acceptedAt: createdAt, revokedAt: null }], ...extra }
}

export function seedState(): State {
  const base = { avatar: null, cover: null }
  const valentina = account(ids.valentina, 'valentina.restrepo@example.test', 'Valentina Restrepo Ochoa', true, ['USER'], { profile: {
    userId: accountId(ids.valentina), biography: 'Soy trabajadora social y acompaño procesos comunitarios en el sur del Valle de Aburrá. Me gustaría aportar en formación y organización de huertas urbanas.',
    profession: 'Trabajadora social', educationLevel: 'Profesional universitaria', preferredModality: 'HYBRID', emailOpportunityAlerts: false,
    createdAt: '2026-07-22T10:00:00Z', updatedAt: '2026-08-02T09:30:00Z', visibility: 'PUBLIC', ...base } })
  const camilo = account(ids.camilo, 'camilo.zapata@example.test', 'Camilo Zapata Ríos', true, ['USER'])
  const mariana = account(ids.mariana, 'mariana.londono@example.test', 'Mariana Londoño Cardona', false, ['USER'])
  const admin = account(ids.admin, 'admin.hila@example.test', 'Equipo de revisión Hila (ejemplo)', true, ['USER', 'ADMIN'])
  const org = (n: number, owner: number, rest: Omit<Schemas['Organization'], 'id' | 'createdBy' | 'avatar' | 'cover'>): Schemas['Organization'] => ({ id: orgId(n), createdBy: accountId(owner), ...base, ...rest })
  const organizations = [
    org(ids.semillas, ids.valentina, { name: 'Fundación Semillas del Aburrá', organizationType: 'FORMAL', legalIdentifier: '900000001-1', verificationContext: 'Doce años acompañando huertas escolares y formación ambiental en Envigado, Itagüí y Sabaneta.',
      description: 'Acompañamos huertas escolares y procesos de formación ambiental con familias y colegios del sur del Valle de Aburrá.', publicEmail: 'contacto@example.test', publicWebsite: 'https://semillas.example.test',
      serviceTerritoryId: territoryId(4), verificationStatus: 'APPROVED', statusReason: 'Documentos y trayectoria verificados.', createdAt: '2026-07-25T14:00:00Z', updatedAt: '2026-08-10T16:00:00Z', visibility: 'PUBLIC' }),
    org(ids.huerta, ids.camilo, { name: 'Colectivo Huerta y Memoria San Javier', organizationType: 'COLLECTIVE', legalIdentifier: null, verificationContext: 'Cultivamos una huerta comunitaria desde 2021 y organizamos encuentros de memoria con vecinas y vecinos de la comuna.',
      description: 'Colectivo de vecinas y vecinos que cuida una huerta comunitaria y un archivo de historias del barrio en la Comuna 13.', publicEmail: null, publicWebsite: null,
      serviceTerritoryId: territoryId(15), verificationStatus: 'PENDING', statusReason: null, createdAt: '2026-10-20T11:00:00Z', updatedAt: '2026-10-20T11:00:00Z', visibility: 'PRIVATE' }),
    org(ids.caminoNuevo, ids.camilo, { name: 'Corporación Camino Nuevo Itagüí', organizationType: 'FORMAL', legalIdentifier: '900000002-2', verificationContext: 'Apoyo escolar y recreación para niñas y niños de Itagüí.',
      description: 'Ofrecemos apoyo escolar y espacios de recreación para niñas y niños de barrios de Itagüí.', publicEmail: null, publicWebsite: null,
      serviceTerritoryId: territoryId(5), verificationStatus: 'REJECTED', statusReason: 'No pudimos validar el identificador legal con la información enviada. Puedes reenviar la solicitud con datos complementarios.',
      createdAt: '2026-09-05T08:00:00Z', updatedAt: '2026-09-12T10:00:00Z', visibility: 'PRIVATE' }),
  ]
  const membership = (n: number, owner: Account): Schemas['Membership'] => ({ organizationId: orgId(n), userId: owner.id, displayName: owner.displayName, role: 'ORG_OWNER', status: 'ACTIVE', createdAt: organizations.find(item => item.id === orgId(n))!.createdAt })
  const step = (key: number, n: number, decision: Schemas['OrganizationVerification']['decision'], decidedAt: string, reason: string | null): Schemas['OrganizationVerification'] =>
    ({ id: seedId(0xd, key), organizationId: orgId(n), reviewedBy: decision === 'SUBMITTED' ? null : accountId(ids.admin), decision, reason, decidedAt })
  return { version: 1, sessionId: null, accounts: [valentina, camilo, mariana, admin], organizations, tokens: [],
    memberships: [membership(ids.semillas, valentina), membership(ids.huerta, camilo), membership(ids.caminoNuevo, camilo)],
    verifications: [step(1, ids.semillas, 'SUBMITTED', '2026-07-25T14:00:00Z', null), step(2, ids.semillas, 'APPROVED', '2026-08-10T16:00:00Z', 'Documentos y trayectoria verificados.'),
      step(3, ids.huerta, 'SUBMITTED', '2026-10-20T11:00:00Z', null),
      step(4, ids.caminoNuevo, 'SUBMITTED', '2026-09-05T08:00:00Z', null), step(5, ids.caminoNuevo, 'REJECTED', '2026-09-12T10:00:00Z', organizations[2].statusReason)] }
}
