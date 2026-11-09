import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Landing from './Landing'
import { CheckEmail, ForgotAccess, Login, Register, ResetAccess, VerifyEmail } from './Access'
import { Account, OrganizationList, PublicProfile, VolunteerPage } from './Profiles'
import { Privacy } from './Privacy'
import { AdminOrganizations, AdminReview, OrganizationDetail, OrganizationForm } from './Organizations'
import { GuestOnly, Protected } from './session'
import Shell from './shell/Shell'
import { EmptyState } from './ui'
import { usePageTitle } from './page-title'
import './App.css'
import './workspace.css'
import './ui/ui.css'

const MockBanner = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true' ? lazy(() => import('./MockBanner')) : null
const Gallery = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true' ? lazy(() => import('./ui/Gallery')) : null

function NotFound() {
  usePageTitle('Página no encontrada')
  return <EmptyState headingLevel={1} title="No encontramos esta página." action={<Link className="action primary" to="/">Volver al inicio</Link>}>La dirección puede estar mal escrita o la página ya no existe.</EmptyState>
}
export default function App() {
  return <>{MockBanner && <Suspense fallback={null}><MockBanner /></Suspense>}<Routes><Route path="/" element={<Landing />} /><Route element={<Shell />}>
    <Route path="ingresar" element={<GuestOnly><Login /></GuestOnly>} /><Route path="registro" element={<GuestOnly><Register /></GuestOnly>} />
    <Route path="registro/enviado" element={<CheckEmail />} /><Route path="verificar-correo" element={<VerifyEmail />} />
    <Route path="recuperar-acceso" element={<ForgotAccess />} /><Route path="restablecer-acceso" element={<ResetAccess />} />
    <Route path="mi-cuenta" element={<Protected><Account /></Protected>} /><Route path="mi-cuenta/privacidad" element={<Protected><Privacy /></Protected>} /><Route path="mi-perfil" element={<Protected><VolunteerPage /></Protected>} />
    <Route path="mis-organizaciones" element={<Protected><OrganizationList /></Protected>} /><Route path="organizaciones/nueva" element={<Protected><OrganizationForm /></Protected>} />
    <Route path="organizaciones/:id/editar" element={<Protected><OrganizationDetail /></Protected>} />
    <Route path="voluntarios/:id" element={<PublicProfile />} /><Route path="organizaciones/:id" element={<PublicProfile organization />} />
    <Route path="admin/organizaciones" element={<Protected admin><AdminOrganizations /></Protected>} /><Route path="admin/organizaciones/:id" element={<Protected admin><AdminReview /></Protected>} />
    {Gallery && <Route path="guia-ui" element={<Suspense fallback={null}><Gallery /></Suspense>} />}
    <Route path="*" element={<NotFound />} />
  </Route></Routes></>
}
