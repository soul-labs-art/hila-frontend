export const modalityName = (value: string | null) => ({ IN_PERSON: 'Presencial', REMOTE: 'Remoto', HYBRID: 'Híbrido' })[value ?? ''] ?? 'Modalidad por definir'
export const reviewName = (state: string) => ({ PENDING: 'En revisión', APPROVED: 'Aprobada en Hila', REJECTED: 'Solicitud rechazada', SUSPENDED: 'Suspendida' })[state] ?? state
