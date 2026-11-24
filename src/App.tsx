import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router-dom'
import Landing from './Landing'
import { CheckEmail, ForgotAccess, Login, Register, ResetAccess, VerifyEmail } from './Access'
import { Account, OrganizationList, PublicProfile, VolunteerPage } from './Profiles'
import { Privacy } from './Privacy'
import { AdminOrganizations, AdminReview, OrganizationDetail, OrganizationForm } from './Organizations'
import { GuestOnly, Protected } from './session'
import Shell from './shell/Shell'
import { features } from './features'
import { EmptyState } from './ui'
import { usePageTitle } from './page-title'
import './App.css'
import './workspace.css'
import './ui/ui.css'

const Gallery = import.meta.env.DEV ? lazy(() => import('./ui/Gallery')) : null
const Explore = features.opportunities ? lazy(() => import('./Explore').then(module => ({ default: module.Explore }))) : null
const NeedDetail = features.opportunities ? lazy(() => import('./Explore').then(module => ({ default: module.NeedDetail }))) : null
const ActivityList = features.applications ? lazy(() => import('./Activity').then(module => ({ default: module.ActivityList }))) : null
const ActivityDetail = features.applications ? lazy(() => import('./Activity').then(module => ({ default: module.ActivityDetail }))) : null
const Causes = features.needs ? lazy(() => import('./Causes').then(module => ({ default: module.Causes }))) : null
const Needs = features.needs ? lazy(() => import('./Needs').then(module => ({ default: module.Needs }))) : null
const NeedEditor = features.needs ? lazy(() => import('./NeedEditor').then(module => ({ default: module.NeedEditor }))) : null
const ApplicationNeeds = features.applications ? lazy(() => import('./Applications').then(module => ({ default: module.ApplicationNeeds }))) : null
const ApplicationBoard = features.applications ? lazy(() => import('./Applications').then(module => ({ default: module.ApplicationBoard }))) : null
const ParticipationNeeds = features.participation ? lazy(() => import('./Closure').then(module => ({ default: module.ParticipationNeeds }))) : null
const Closure = features.participation ? lazy(() => import('./Closure').then(module => ({ default: module.Closure }))) : null
const Team = features.team ? lazy(() => import('./Team').then(module => ({ default: module.Team }))) : null
const AdminCatalogs = features.adminTools ? lazy(() => import('./AdminCatalogs').then(module => ({ default: module.AdminCatalogs }))) : null
const AdminUsers = features.adminTools ? lazy(() => import('./AdminUsers').then(module => ({ default: module.AdminUsers }))) : null
const AdminAudit = features.adminTools ? lazy(() => import('./AdminAudit').then(module => ({ default: module.AdminAudit }))) : null
const Notices = features.notifications ? lazy(() => import('./Notices').then(module => ({ default: module.Notices }))) : null

function NotFound() {
  usePageTitle('Página no encontrada')
  return <EmptyState headingLevel={1} title="No encontramos esta página." action={<Link className="action primary" to="/">Volver al inicio</Link>}>La dirección puede estar mal escrita o la página ya no existe.</EmptyState>
}
export default function App() {
  return <Routes><Route path="/" element={<Landing />} /><Route element={<Shell />}>
    <Route path="ingresar" element={<GuestOnly><Login /></GuestOnly>} /><Route path="registro" element={<GuestOnly><Register /></GuestOnly>} />
    <Route path="registro/enviado" element={<CheckEmail />} /><Route path="verificar-correo" element={<VerifyEmail />} />
    <Route path="recuperar-acceso" element={<ForgotAccess />} /><Route path="restablecer-acceso" element={<ResetAccess />} />
    <Route path="mi-cuenta" element={<Protected><Account /></Protected>} /><Route path="mi-cuenta/privacidad" element={<Protected><Privacy /></Protected>} /><Route path="mi-perfil" element={<Protected><VolunteerPage /></Protected>} />
    <Route path="mis-organizaciones" element={<Protected><OrganizationList /></Protected>} /><Route path="organizaciones/nueva" element={<Protected><OrganizationForm /></Protected>} />
    <Route path="organizaciones/:id/editar" element={<Protected><OrganizationDetail /></Protected>} />
    <Route path="voluntarios/:id" element={<PublicProfile />} /><Route path="organizaciones/:id" element={<PublicProfile organization />} />
    <Route path="admin/organizaciones" element={<Protected admin><AdminOrganizations /></Protected>} /><Route path="admin/organizaciones/:id" element={<Protected admin><AdminReview /></Protected>} />
    {Explore && NeedDetail && <><Route path="explorar" element={<Suspense fallback={null}><Explore /></Suspense>} /><Route path="explorar/:needId" element={<Suspense fallback={null}><NeedDetail /></Suspense>} /></>}
    {ActivityList && ActivityDetail && <><Route path="actividad" element={<Protected><Suspense fallback={null}><ActivityList /></Suspense></Protected>} /><Route path="actividad/:applicationId" element={<Protected><Suspense fallback={null}><ActivityDetail /></Suspense></Protected>} /></>}
    {Notices && <Route path="avisos" element={<Protected><Suspense fallback={null}><Notices /></Suspense></Protected>} />}
    {Causes && Needs && NeedEditor && <><Route path="organizaciones/:id/causas" element={<Protected><Suspense fallback={null}><Causes /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades" element={<Protected><Suspense fallback={null}><Needs /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/nueva" element={<Protected><Suspense fallback={null}><NeedEditor /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId" element={<Protected><Suspense fallback={null}><NeedEditor /></Suspense></Protected>} /></>}
    {ApplicationNeeds && ApplicationBoard && <><Route path="organizaciones/:id/postulaciones" element={<Protected><Suspense fallback={null}><ApplicationNeeds /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId/postulaciones" element={<Protected><Suspense fallback={null}><ApplicationBoard /></Suspense></Protected>} /></>}
    {ParticipationNeeds && Closure && <><Route path="organizaciones/:id/participacion" element={<Protected><Suspense fallback={null}><ParticipationNeeds /></Suspense></Protected>} /><Route path="organizaciones/:id/necesidades/:needId/cierre" element={<Protected><Suspense fallback={null}><Closure /></Suspense></Protected>} /></>}
    {Team && <Route path="organizaciones/:id/equipo" element={<Protected><Suspense fallback={null}><Team /></Suspense></Protected>} />}
    {AdminCatalogs && AdminUsers && AdminAudit && <><Route path="admin/catalogos" element={<Protected admin><Suspense fallback={null}><AdminCatalogs /></Suspense></Protected>} /><Route path="admin/usuarios" element={<Protected admin><Suspense fallback={null}><AdminUsers /></Suspense></Protected>} /><Route path="admin/trazabilidad" element={<Protected admin><Suspense fallback={null}><AdminAudit /></Suspense></Protected>} /></>}
    {Gallery && <Route path="guia-ui" element={<Suspense fallback={null}><Gallery /></Suspense>} />}
    <Route path="*" element={<NotFound />} />
  </Route></Routes>
}
