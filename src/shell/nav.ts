import { matchPath } from 'react-router-dom'
import { features } from '../features'
import type { IconName } from '../icons'
import type { User } from '../session-context'

/** Una entrada de navegación. `match` lista rutas (patrones de React Router) que la marcan como activa. */
export type NavItem = { to: string; label: string; icon: IconName; match?: string[] }
export type Area = 'plain' | 'org' | 'admin'

const orgSection = (pathname: string) => matchPath('/organizaciones/:id/:section', pathname)
/** Qué barra lateral pide la ruta. */
export function areaOf(pathname: string, admin = false): Area {
  if (pathname.startsWith('/admin')) return admin ? 'admin' : 'plain'
  if (pathname === '/mis-organizaciones' || pathname === '/organizaciones/nueva' || orgSection(pathname)) return 'org'
  return 'plain'
}
/** Id de la organización en curso (rutas /organizaciones/:id/...), si hay una. */
export const orgIdOf = (pathname: string) => orgSection(pathname)?.params.id

export const isActive = (item: NavItem, pathname: string) => (item.match ?? [item.to]).some(pattern => !!matchPath({ path: pattern, end: false }, pathname))

/** Navegación superior (escritorio). Las entradas de funciones pendientes solo existen con su bandera. */
export function topNav(): NavItem[] {
  const planned: NavItem[] = [
    ...(features.opportunities ? [{ to: '/explorar', label: 'Explorar', icon: 'search' as const }] : []),
    ...(features.applications ? [{ to: '/actividad', label: 'Mi actividad', icon: 'calendar' as const }] : []),
    ...(features.notifications ? [{ to: '/avisos', label: 'Avisos', icon: 'bell' as const }] : []),
  ]
  const orgs: NavItem = { to: '/mis-organizaciones', label: 'Mis organizaciones', icon: 'people', match: ['/mis-organizaciones', '/organizaciones/nueva', '/organizaciones/:id/:section'] }
  // Con las funciones de oportunidades la barra se acorta (como en la referencia); Mis organizaciones queda en el selector de contexto y el menú de usuario.
  return planned.length ? [...planned, { to: '/mi-perfil', label: 'Mi perfil', icon: 'person' }] : [{ to: '/mi-cuenta', label: 'Mi cuenta', icon: 'home' }, { to: '/mi-perfil', label: 'Mi perfil', icon: 'person' }, orgs]
}

/** Pestañas de la barra inferior (móvil). */
export function tabBar(user: User): NavItem[] {
  const profile: NavItem = { to: '/mi-perfil', label: features.opportunities || features.applications || features.notifications ? 'Perfil' : 'Mi perfil', icon: 'person' }
  const orgs: NavItem = { to: '/mis-organizaciones', label: 'Organizaciones', icon: 'people', match: ['/mis-organizaciones', '/organizaciones/nueva', '/organizaciones/:id/:section'] }
  const planned: NavItem[] = [
    ...(features.opportunities ? [{ to: '/explorar', label: 'Explorar', icon: 'search' as const }] : []),
    ...(features.applications ? [{ to: '/actividad', label: 'Actividad', icon: 'calendar' as const }] : []),
    ...(features.notifications ? [{ to: '/avisos', label: 'Avisos', icon: 'bell' as const }] : []),
  ]
  if (!planned.length) return [{ to: '/mi-cuenta', label: 'Mi cuenta', icon: 'home', match: ['/mi-cuenta'] }, profile, orgs, ...(user.roles.includes('ADMIN') ? [{ to: '/admin/organizaciones', label: 'Revisión', icon: 'checkCircle' as const, match: ['/admin'] }] : [])]
  return [...planned, ...(planned.length < 3 ? [orgs] : []), profile]
}

/** Barra lateral de organización (con id de organización añade sus secciones) o de administración. */
export function sideNav(area: Area, orgId?: string): NavItem[] {
  if (area === 'admin') return [{ to: '/admin/organizaciones', label: 'Organizaciones', icon: 'people', match: ['/admin/organizaciones'] },
    ...(features.adminTools ? [{ to: '/admin/catalogos', label: 'Catálogos', icon: 'folder' as const }, { to: '/admin/trazabilidad', label: 'Trazabilidad', icon: 'trace' as const }] : [])]
  const own = orgId ? `/organizaciones/${orgId}` : ''
  return [
    ...(orgId ? [{ to: `${own}/editar`, label: 'Resumen', icon: 'home' as const }] : []),
    ...(orgId && features.needs ? [{ to: `${own}/causas`, label: 'Causas', icon: 'leaf' as const }, { to: `${own}/necesidades`, label: 'Necesidades', icon: 'document' as const }] : []),
    ...(orgId && features.applications ? [{ to: `${own}/postulaciones`, label: 'Postulaciones', icon: 'people' as const }] : []),
    ...(orgId && features.participation ? [{ to: `${own}/participacion`, label: 'Participación', icon: 'calendar' as const }] : []),
    ...(orgId && features.team ? [{ to: `${own}/equipo`, label: 'Equipo', icon: 'userPlus' as const }] : []),
    { to: '/mis-organizaciones', label: 'Mis organizaciones', icon: 'folder', match: ['/mis-organizaciones'] },
    { to: '/organizaciones/nueva', label: 'Nueva organización', icon: 'plus' },
  ]
}
