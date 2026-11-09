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
const planned = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true'
const Explore = planned ? lazy(() => import('./Explore').then(module => ({ default: module.Explore }))) : null
const NeedDetail = planned ? lazy(() => import('./Explore').then(module => ({ default: module.NeedDetail }))) : null
const ActivityList = planned ? lazy(() => import('./Activity').then(module => ({ default: module.ActivityList }))) : null
const ActivityDetail = planned ? lazy(() => import('./Activity').then(module => ({ default: module.ActivityDetail }))) : null
const Causes = planned ? lazy(() => import('./Causes').then(module => ({ default: module.Causes }))) : null
const Needs = planned ? lazy(() => import('./Needs').then(module => ({ default: module.Needs }))) : null
const NeedEditor = planned ? lazy(() => import('./NeedEditor').then(module => ({ default: module.NeedEditor }))) : null
const ApplicationNeeds = planned ? lazy(() => import('./Applications').then(module => ({ default: module.ApplicationNeeds }))) : null
const ApplicationBoard = planned ? lazy(() => import('./Applications').then(module => ({ default: module.ApplicationBoard }))) : null
const ParticipationNeeds = planned ? lazy(() => import('./Closure').then(module => ({ default: module.ParticipationNeeds }))) : null
const Closure = planned ? lazy(() => import('./Closure').then(module => ({ default: module.Closure }))) : null
const Notices = planned ? lazy(() => import('./Notices').then(module => ({ default: module.Notices }))) : null

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
    {Explore && NeedDetail && <><Route path="explorar" element={<Protected><Suspense fallback={null}><Explore /></Suspense></Protected>} /><Route path="explorar/:needId" element={<Protected><Suspense fallback={null}><NeedDetail /></Suspense></Protected>} /></>}
    {ActivityList && ActivityDetail && <><Route path="actividad" element={<Protected><Suspense fallback={null}><ActivityList /></Suspense></Protected>} /><Route path="actividad/:applicationId" element={<Protected><Suspense fallback={null}><ActivityDetail /></Suspense></Protected>} /></>}
    {Notices && <Route path="avisos" element={<Protected><Suspense fallback={null}><Notices /></Suspense></Protected>} />}
    {Causes && Needs && NeedEditor && <><Route path="organizaciones/:id/causas" element={<Protected><Suspense fallback={null}><Causes /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades" element={<Protected><Suspense fallback={null}><Needs /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/nueva" element={<Protected><Suspense fallback={null}><NeedEditor /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId" element={<Protected><Suspense fallback={null}><NeedEditor /></Suspense></Protected>} /></>}
    {ApplicationNeeds && ApplicationBoard && <><Route path="organizaciones/:id/postulaciones" element={<Protected><Suspense fallback={null}><ApplicationNeeds /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId/postulaciones" element={<Protected><Suspense fallback={null}><ApplicationBoard /></Suspense></Protected>} /></>}
    {ParticipationNeeds && Closure && <><Route path="organizaciones/:id/participacion" element={<Protected><Suspense fallback={null}><ParticipationNeeds /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId/cierre" element={<Protected><Suspense fallback={null}><Closure /></Suspense></Protected>} /></>}
    {Gallery && <Route path="guia-ui" element={<Suspense fallback={null}><Gallery /></Suspense>} />}
    <Route path="*" element={<NotFound />} />
  </Route></Routes></>
}
