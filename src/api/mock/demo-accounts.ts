// Debe coincidir con las cuentas de seed.ts. La contraseña común es examplePassword.
export const demoAccounts = [
  { email: 'valentina.restrepo@example.test', name: 'Valentina Restrepo Ochoa', note: 'Voluntaria con perfil público y dueña de la Fundación Semillas del Aburrá (aprobada).' },
  { email: 'camilo.zapata@example.test', name: 'Camilo Zapata Ríos', note: 'Sin perfil de voluntario. Sus organizaciones están una en revisión y otra rechazada.' },
  { email: 'mariana.londono@example.test', name: 'Mariana Londoño Cardona', note: 'Correo sin verificar: prueba el aviso para pedir otro enlace.' },
  { email: 'admin.hila@example.test', name: 'Equipo de revisión Hila (ejemplo)', note: 'Administración: revisa y decide sobre las organizaciones.' },
] as const
