// Operaciones planned del contrato; retirar cuando el backend las implemente.
import { Fail, invalid } from '../../errors'
import type { FieldError } from '../../types'
import { validate } from '../../validate'

type Rules = Parameters<typeof validate>[1]
/** Valida cada elemento de una lista y devuelve errores con la ruta completa, por ejemplo `items[2].skillId`. */
export function rows<T>(values: unknown[], field: string, rules: Rules, extra: FieldError[] = []): T[] {
  const errors: FieldError[] = [...extra], result: T[] = []
  values.forEach((value, index) => {
    try { result.push(validate<T>(value, rules)) }
    catch (error) {
      if (!(error instanceof Fail) || error.code !== 'VALIDATION_FAILED') throw error
      errors.push(...error.fieldErrors.map(item => ({ ...item, field: `${field}[${index}].${item.field}` })))
    }
  })
  if (errors.length) throw invalid(...errors)
  return result
}
export const slug = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
export const clockPattern = /^([01][0-9]|2[0-3]):[0-5][0-9]$/
export const modalities = ['IN_PERSON', 'REMOTE', 'HYBRID'] as const
export const proficiencies = ['BASIC', 'INTERMEDIATE', 'ADVANCED'] as const
