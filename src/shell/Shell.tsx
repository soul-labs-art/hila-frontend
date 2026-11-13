import { useEffect, useRef, useState } from 'react'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'
import { Feedback } from '../components'
import { features } from '../features'
import { Icon } from '../icons'
import { LeavesBackdrop, Leaves } from '../Leaves'
import { useSession } from '../session-context'
import { Avatar } from '../ui'
import { Menu } from './Menu'
import { areaOf, isActive, orgIdOf, sideNav, tabBar, topNav, type NavItem } from './nav'
import './shell.css'

type OrgSummary = { id: string; name: string }

function Brand({ dark = false, className = '' }: { dark?: boolean; className?: string }) {
  return <Link className={`brand ${className}`.trim()} to="/" aria-label="Hila, inicio"><img src={dark ? '/brand/hila-wordmark-lino.png' : '/brand/hila-wordmark-delgado.png'} alt="" /></Link>
}
function Item({ item, pathname, icon = true, className = '' }: { item: NavItem; pathname: string; icon?: boolean; className?: string }) {
  return <Link to={item.to} className={className} aria-current={isActive(item, pathname) ? 'page' : undefined}>{icon && <Icon name={item.icon} size={22} />}<span>{item.label}</span></Link>
}

export default function Shell() {
  const session = useSession(), navigate = useNavigate(), location = useLocation(), { pathname } = location, user = session.user
  const [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false), [drawerAt, setDrawerAt] = useState<string | null>(null), burger = useRef<HTMLButtonElement>(null)
  const area = user ? areaOf(pathname, user.roles.includes('ADMIN')) : 'plain', orgId = orgIdOf(pathname)
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('workspace-content')?.focus({ preventScroll: true }) }, [pathname])
  const drawer = drawerAt === pathname, setDrawer = (open: boolean) => setDrawerAt(open ? pathname : null)
  useEffect(() => {
    if (!drawer) return
    const key = (event: KeyboardEvent) => { if (event.key === 'Escape') { setDrawerAt(null); burger.current?.focus() } }
    document.addEventListener('keydown', key); return () => document.removeEventListener('keydown', key)
  }, [drawer])
  const orgs = useQuery({ queryKey: ['organizations', 'menu'], queryFn: () => api<{ items: OrgSummary[] }>('/me/organizations?size=50'), enabled: !!user, staleTime: 60_000, retry: false })
  const unread = useQuery({ queryKey: ['unread-count'], queryFn: () => api<{ count: number }>('/me/notifications/unread-count'), enabled: !!user && features.notifications, retry: false })
  const myOrgs = orgs.data?.items ?? [], current = myOrgs.find(org => org.id === orgId), pending = unread.data?.count ?? 0
  async function logout() { setBusy(true); setError(undefined); try { await session.logout(); navigate('/ingresar') } catch (value) { setError(value) } finally { setBusy(false) } }
  const side = user && area !== 'plain' ? sideNav(area, orgId) : []
  const orgLabel = current?.name ?? 'Mi perfil voluntario'
  const contextMenu = user && myOrgs.length > 0 && <Menu className="context-menu" panelClass="context-panel" trigger={<><span className={`context-icon${current ? '' : ' is-person'}`}>{current ? <Avatar name={current.name} size="sm" /> : <Icon name="person" size={20} />}</span><span className="context-name">{orgLabel}</span></>}>
    <ul aria-label="Cambiar de espacio"><li><Link to="/mi-perfil" aria-current={!current && pathname === '/mi-perfil' ? 'page' : undefined}><Icon name="person" size={20} />Mi perfil voluntario{!current && pathname === '/mi-perfil' && <Icon name="check" size={18} className="menu-check" />}</Link></li>{myOrgs.map(org => <li key={org.id}><Link to={`/organizaciones/${org.id}/editar`} aria-current={org.id === orgId ? 'page' : undefined}><Icon name="people" size={20} />{org.name}{org.id === orgId && <Icon name="check" size={18} className="menu-check" />}</Link></li>)}<li><Link to="/organizaciones/nueva"><Icon name="plus" size={20} />Nueva organización</Link></li></ul>
  </Menu>
  const userMenu = user && <Menu className="user-menu" trigger={<><Avatar name={user.displayName} size="sm" /><span className="user-name">{user.displayName}</span></>}>
    <ul aria-label="Cuenta"><li><Link to="/mi-cuenta"><Icon name="home" size={20} />Mi cuenta</Link></li><li><Link to="/mi-perfil"><Icon name="person" size={20} />Mi perfil voluntario</Link></li><li><Link to="/mis-organizaciones"><Icon name="people" size={20} />Mis organizaciones</Link></li><li><Link to="/mi-cuenta/privacidad"><Icon name="lock" size={20} />Privacidad y avisos</Link></li>{user.roles.includes('ADMIN') && <li><Link to="/admin/organizaciones"><Icon name="checkCircle" size={20} />Revisión de organizaciones</Link></li>}</ul>
  </Menu>
  const bell = user && features.notifications && <Link className="bell" to="/avisos" aria-label={pending ? `Avisos, ${pending} sin leer` : 'Avisos'}><Icon name="bell" size={24} />{pending > 0 && <span className="bell-dot" aria-hidden="true" />}</Link>
  const tabs = user ? tabBar(user) : []
  const isRegister = pathname === '/registro'
  const isLogin = pathname === '/ingresar'
  const isRecovery = pathname === '/recuperar-acceso'
  return <div className={`app-shell area-${area}${isRegister ? ' is-register-shell' : ''}${isLogin ? ' is-login-shell' : ''}${isRecovery ? ' is-recovery-shell' : ''}`}><a className="skip-link" href="#workspace-content">Saltar al contenido</a>
    {area === 'plain' && !isRegister && !isLogin && !isRecovery && <LeavesBackdrop />}
    {side.length > 0 && <div className={`side side-${area}`}><nav aria-label={area === 'admin' ? 'Administración' : 'Mi organización'}><Brand dark={area === 'admin'} className="side-brand" /><ul>{side.map(item => <li key={item.to}><Item item={item} pathname={pathname} className="side-link" /></li>)}</ul></nav><Leaves variant="left" className="side-leaves" /></div>}
    <div className="app-main">
      <header className="topbar"><div className={`topbar-inner${user ? "" : " is-guest"}`}>
        {user ? <>
          <div className="topbar-left">{bell && <span className="mobile-only">{bell}</span>}</div>
          <Brand className="topbar-brand" />
          {area === 'plain' && <nav className="topnav" aria-label="Navegación principal">{topNav().map(item => <Item key={item.to} item={item} pathname={pathname} icon={false} className="topnav-link" />)}</nav>}
          <div className="topbar-tools">{contextMenu}<span className="desktop-only">{bell}</span><span className="desktop-only">{userMenu}</span><button className="signout desktop-only" type="button" disabled={busy} onClick={() => void logout()}><Icon name="logout" size={20} /><span>{busy ? 'Cerrando…' : 'Salir'}</span></button>
            <button ref={burger} type="button" className="burger" aria-expanded={drawer} aria-controls="mobile-menu" onClick={() => setDrawer(!drawer)}><Icon name={drawer ? 'x' : 'menu'} size={26} /><span className="sr-only">{drawer ? 'Cerrar menú' : 'Abrir menú'}</span></button></div>
        </> : isRegister ? <>
          <div className="register-brand-lockup"><img className="register-brand-sprig" src="/brand/hila_rama_botanica.svg" alt="" /><Brand className="register-brand" /></div>
          <div className="register-header-actions">
            <span className="register-header-prompt">¿Ya tienes una cuenta?</span>
            <Link className="btn-iniciar-sesion" to="/ingresar">Iniciar sesión</Link>
          </div>
        </> : <>
          {isRecovery ? <div className="recovery-brand"><img src="/brand/hila_rama_botanica.svg" alt="" /><Brand className="topbar-brand" /></div> : <Brand className="topbar-brand" />}
          <nav className="guestnav" aria-label="Navegación principal"><Link to="/ingresar" aria-current={pathname === '/ingresar' ? 'page' : undefined}>Ingresar</Link><Link className="guest-cta" to="/registro" aria-current={pathname === '/registro' ? 'page' : undefined}>Crear cuenta</Link></nav>
        </>}
      </div>
      {user && drawer && <div id="mobile-menu" className="drawer"><nav aria-label="Menú móvil"><p className="drawer-user"><Avatar name={user.displayName} size="md" /><span><strong>{user.displayName}</strong></span></p>
        <ul>{[...topNav(), ...(area !== 'plain' ? side : [])].filter((item, index, all) => all.findIndex(other => other.to === item.to) === index).map(item => <li key={item.to}><Item item={item} pathname={pathname} className="drawer-link" /></li>)}
          <li><Link className="drawer-link" to="/mi-cuenta/privacidad"><Icon name="lock" size={22} /><span>Privacidad y avisos</span></Link></li>
          {myOrgs.length > 0 && <li className="drawer-label">Mis organizaciones</li>}{myOrgs.map(org => <li key={org.id}><Link className="drawer-link" to={`/organizaciones/${org.id}/editar`}><Avatar name={org.name} size="sm" /><span>{org.name}</span></Link></li>)}
          {user.roles.includes('ADMIN') && <li><Link className="drawer-link" to="/admin/organizaciones"><Icon name="checkCircle" size={22} /><span>Revisión de organizaciones</span></Link></li>}
          <li><button type="button" className="drawer-link" disabled={busy} onClick={() => void logout()}><Icon name="logout" size={22} /><span>{busy ? 'Cerrando…' : 'Salir'}</span></button></li></ul></nav></div>}
      </header>
      <main id="workspace-content" className="workspace-content" tabIndex={-1}><Feedback error={error} /><Outlet /></main>
      {!isRegister && !isLogin && <footer className="workspace-footer"><Link to="/">Hila</Link><p>Capacidades que se encuentran con causas de tu territorio.</p></footer>}
    </div>
    {tabs.length > 0 && <nav className="tabbar" aria-label="Pestañas de la aplicación"><ul>{tabs.map(item => <li key={item.to}><Item item={item} pathname={pathname} className="tab" /></li>)}</ul></nav>}
  </div>
}
