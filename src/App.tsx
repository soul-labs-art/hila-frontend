import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Landing from './Landing'
import { CheckEmail, ForgotAccess, Login, Register, ResetAccess, VerifyEmail } from './Access'
import { Account, OrganizationList, PublicProfile, VolunteerPage } from './Profiles'
import { AdminOrganizations, AdminReview, OrganizationDetail, OrganizationForm } from './Organizations'
import { GuestOnly, Protected } from './session'
import { useSession } from './session-context'
import { Feedback } from './components'
import { usePageTitle } from './page-title'
import './App.css'
import './workspace.css'

function Shell() {
  const session = useSession(), navigate = useNavigate(), location = useLocation(), [error, setError] = useState<unknown>(), [busy, setBusy] = useState(false)
  useEffect(() => { window.scrollTo(0, 0); document.getElementById('workspace-content')?.focus({ preventScroll: true }) }, [location.pathname])
  return <div className="workspace-shell"><a className="skip-link" href="#workspace-content">Saltar al contenido</a><header className="workspace-header"><Link className="brand" to="/" aria-label="Hila, inicio"><img src="/brand/hila-wordmark-delgado.png" alt="" /></Link><nav aria-label="Navegación principal">{session.user ? <><NavLink to="/mi-cuenta">Mi cuenta</NavLink><NavLink to="/mi-perfil">Mi perfil</NavLink><NavLink to="/mis-organizaciones">Mis organizaciones</NavLink>{session.user.roles.includes('ADMIN') && <NavLink to="/admin/organizaciones">Revisión</NavLink>}<button className="text-button" disabled={busy} onClick={async () => { setBusy(true); setError(undefined); try { await session.logout(); navigate('/ingresar') } catch (value) { setError(value) } finally { setBusy(false) } }}>{busy ? 'Cerrando…' : 'Salir'}</button></> : <><NavLink to="/ingresar">Ingresar</NavLink><NavLink className="action primary" to="/registro">Crear cuenta</NavLink></>}</nav></header><main id="workspace-content" className="workspace-content" tabIndex={-1}><Feedback error={error} /><Outlet /></main><footer className="workspace-footer"><Link to="/">Hila</Link><p>Capacidades que se encuentran con causas de tu territorio.</p></footer></div>
}
function NotFound() {
  usePageTitle('Página no encontrada')
  return <section className="empty-state"><h1>No encontramos esta página.</h1><Link className="action" to="/">Volver al inicio</Link></section>
}
export default function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route element={<Shell />}>
    <Route path="ingresar" element={<GuestOnly><Login /></GuestOnly>} /><Route path="registro" element={<GuestOnly><Register /></GuestOnly>} />
    <Route path="registro/enviado" element={<CheckEmail />} /><Route path="verificar-correo" element={<VerifyEmail />} />
    <Route path="recuperar-acceso" element={<ForgotAccess />} /><Route path="restablecer-acceso" element={<ResetAccess />} />
    <Route path="mi-cuenta" element={<Protected><Account /></Protected>} /><Route path="mi-perfil" element={<Protected><VolunteerPage /></Protected>} />
    <Route path="mis-organizaciones" element={<Protected><OrganizationList /></Protected>} /><Route path="organizaciones/nueva" element={<Protected><OrganizationForm /></Protected>} />
    <Route path="organizaciones/:id/editar" element={<Protected><OrganizationDetail /></Protected>} />
    <Route path="voluntarios/:id" element={<PublicProfile />} /><Route path="organizaciones/:id" element={<PublicProfile organization />} />
    <Route path="admin/organizaciones" element={<Protected admin><AdminOrganizations /></Protected>} /><Route path="admin/organizaciones/:id" element={<Protected admin><AdminReview /></Protected>} />
    <Route path="*" element={<NotFound />} />
  </Route></Routes>
}
