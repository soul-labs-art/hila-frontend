// Banderas por área. Cada una vale true solo en desarrollo con datos de ejemplo (VITE_API_MOCK=true);
// en producción la expresión se evalúa a false y el build elimina las pantallas y enlaces que dependen de ella.
// Poner a true cuando el backend implemente las operaciones del contrato (x-implementation-status: implemented).
const planned = import.meta.env.DEV && import.meta.env.VITE_API_MOCK === 'true'

export const features = {
  opportunities: planned, // Explorar oportunidades y detalle de necesidad
  applications: planned, // Postulaciones y Mi actividad
  notifications: planned, // Campana y bandeja de avisos
  capabilities: planned, // Habilidades y disponibilidad (indicador de pasos del perfil)
  needs: planned, // Causas y necesidades de la organización
  team: planned, // Equipo de la organización
  participation: planned, // Horas, cierre y feedback
  adminTools: planned, // Catálogos y trazabilidad de administración
}
export type FeatureName = keyof typeof features
