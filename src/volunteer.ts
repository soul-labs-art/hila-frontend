import { api, ApiFailure } from './api/client'
import type { Volunteer } from './ProfileCard'

export async function loadVolunteer() {
  try { return await api<Volunteer>('/me/volunteer-profile') }
  catch (error) { if (error instanceof ApiFailure && error.detail.code === 'PROFILE_NOT_FOUND') return null; throw error }
}

export const profileSteps = ['Datos', 'Capacidades', 'Disponibilidad']
