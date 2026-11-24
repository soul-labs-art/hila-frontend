// Controles por área, independientes del entorno en que se sirve la aplicación.
export const features = {
  opportunities: true, // Explorar oportunidades y detalle de necesidad
  applications: true, // Postulaciones y Mi actividad
  notifications: true, // Campana y bandeja de avisos
  capabilities: true, // Habilidades y disponibilidad (indicador de pasos del perfil)
  needs: true, // Causas y necesidades de la organización
  team: true, // Equipo de la organización
  participation: true, // Horas, cierre y feedback
  adminTools: true, // Catálogos y trazabilidad de administración
}
export type FeatureName = keyof typeof features
