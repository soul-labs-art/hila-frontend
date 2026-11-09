import type { Schemas } from '../client'
import { Fail, forbidden, notFound } from './errors'
import { db } from './store'
import type { Account } from './types'

export const territoryById = (id: string | null) => db().territories.find(item => item.id === id) ?? null
export const toUser = (account: Account): Schemas['CurrentUser'] => ({ id: account.id, email: account.email, displayName: account.displayName, status: 'ACTIVE',
  emailVerifiedAt: account.verifiedAt!, roles: account.roles, volunteerProfileExists: account.profile !== null, createdAt: account.createdAt })
export function signedIn(): Account | null { const state = db(); return state.accounts.find(item => item.id === state.sessionId && item.verifiedAt && item.status !== 'SUSPENDED') ?? null }
export function requireUser(): Account {
  const account = signedIn()
  if (!account) throw new Fail(401, 'AUTHENTICATION_REQUIRED', 'Inicia sesión para continuar.')
  return account
}
export function requireAdmin(): Account { const account = requireUser(); if (!account.roles.includes('ADMIN')) throw forbidden(); return account }
export function requireProfile(account: Account) {
  if (!account.profile) throw new Fail(404, 'PROFILE_NOT_FOUND', 'Todavía no has creado tu perfil voluntario.')
  return account.profile
}
export function publicVolunteer(account: Account): Schemas['PublicVolunteer'] {
  const { biography, profession, preferredModality, avatar, cover } = account.profile!
  return { id: account.id, displayName: account.displayName, biography, profession, preferredModality, avatar, cover }
}
export function publicOrganization(org: Schemas['Organization']): Schemas['PublicOrganization'] {
  return { id: org.id, name: org.name, organizationType: org.organizationType, description: org.description, publicEmail: org.publicEmail, publicWebsite: org.publicWebsite,
    serviceTerritory: territoryById(org.serviceTerritoryId), avatar: org.avatar, cover: org.cover, verificationStatus: 'APPROVED' }
}
export function findOrganization(id: string) { const org = db().organizations.find(item => item.id === id); if (!org) throw notFound(); return org }
export function membershipOf(org: Schemas['Organization'], account: Account) { return db().memberships.find(item => item.organizationId === org.id && item.userId === account.id && item.status === 'ACTIVE') }
export function readableOrganization(id: string, account: Account) {
  const org = findOrganization(id)
  if (!membershipOf(org, account) && !account.roles.includes('ADMIN')) throw notFound()
  return org
}
export function ownedOrganization(id: string, account: Account) {
  const org = findOrganization(id), membership = membershipOf(org, account)
  if (!membership) throw notFound()
  if (membership.role !== 'ORG_OWNER') throw forbidden()
  return org
}
