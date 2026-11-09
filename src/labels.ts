export const modalityName = (value: string | null) => ({ IN_PERSON: 'Presencial', REMOTE: 'Remoto', HYBRID: 'Híbrido' })[value ?? ''] ?? 'Modalidad por definir'
export const reviewName = (state: string) => ({ PENDING: 'En revisión', APPROVED: 'Aprobada en Hila', REJECTED: 'Solicitud rechazada', SUSPENDED: 'Suspendida' })[state] ?? state

const tones: Record<string, 'ok' | 'wait' | 'no'> = { PENDING: 'wait', MORE_INFO: 'wait', APPROVED: 'ok', REJECTED: 'no', SUSPENDED: 'no' }
export const reviewTone = (state: string) => tones[state] ?? 'neutral'
