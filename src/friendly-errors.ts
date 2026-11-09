// Mensajes claros para los códigos de error del contrato que el equipo y la administración pueden ver (planned: team y adminTools).
import { ApiFailure } from './api/client'

const messages: Record<string, string> = {
  MEMBERSHIP_EXISTS: 'Esta persona ya está en el equipo. Si aparece como retirada, reactívala desde la tabla.',
  MEMBER_UNAVAILABLE: 'No pudimos añadir esta cuenta. Debe existir en Hila, tener el correo verificado y estar activa.',
  LAST_OWNER_REQUIRED: 'La organización necesita al menos una persona responsable activa. Nombra a otra persona como responsable antes de cambiar este rol o de retirar a esta persona.',
  LAST_ADMIN_REQUIRED: 'Debe quedar al menos una cuenta administradora activa. Nombra a otra administradora antes de suspender esta cuenta.',
  CATALOG_ENTRY_EXISTS: 'Ya existe una entrada con ese identificador de texto. Cambia el identificador para guardarla.',
}
/** Cambia el mensaje de los códigos conocidos por uno directo; los demás errores pasan igual. Los clientes se guían por `code`, no por `message`. */
export function explain(error: unknown, extra: Record<string, string> = {}) {
  if (!(error instanceof ApiFailure)) return error
  const text = { ...messages, ...extra }[error.detail.code]
  return text ? new ApiFailure(error.status, { ...error.detail, message: text }) : error
}
