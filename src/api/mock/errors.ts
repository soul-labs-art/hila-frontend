import type { ErrorCode, FieldError } from './types'

export class Fail extends Error {
  status: number; code: ErrorCode; fieldErrors: FieldError[]
  constructor(status: number, code: ErrorCode, message: string, fieldErrors: FieldError[] = []) {
    super(message); this.status = status; this.code = code; this.fieldErrors = fieldErrors
  }
}
export const invalid = (...fieldErrors: FieldError[]) => new Fail(422, 'VALIDATION_FAILED', 'Revisa los campos indicados.', fieldErrors)
export const notFound = () => new Fail(404, 'RESOURCE_NOT_FOUND', 'No encontramos lo que buscas.')
export const profileNotFound = () => new Fail(404, 'PROFILE_NOT_FOUND', 'Este perfil no está disponible.')
export const forbidden = () => new Fail(403, 'FORBIDDEN', 'No tienes permiso para realizar esta acción.')
export const badTransition = (text: string) => new Fail(409, 'INVALID_TRANSITION', text)
