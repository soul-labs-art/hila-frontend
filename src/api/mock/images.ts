import type { Schemas } from '../client'
import { Fail, invalid } from './errors'
import { uid } from './util'

const limit = 10 * 1024 * 1024
export const slotOf = (value: string): 'avatar' | 'cover' => {
  if (value !== 'avatar' && value !== 'cover') throw new Fail(400, 'MALFORMED_REQUEST', 'La imagen debe ser de tipo «avatar» o «cover».')
  return value
}
const readDataUrl = (file: File) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error)
  reader.readAsDataURL(file)
})
async function dimensions(file: File) {
  try { const bitmap = await createImageBitmap(file); const size = { width: bitmap.width, height: bitmap.height }; bitmap.close(); return size }
  catch { return { width: 1, height: 1 } }
}
export async function receiveImage(form: FormData | null): Promise<Schemas['ImageRef']> {
  const file = form?.get('file')
  if (!(file instanceof File)) throw invalid({ field: 'file', code: 'REQUIRED', message: 'Elige una imagen.' })
  if (file.size > limit) throw new Fail(413, 'FILE_TOO_LARGE', 'La imagen supera el tamaño permitido (10 MiB). Elige una más liviana.')
  if (file.type !== 'image/jpeg' && file.type !== 'image/png') throw new Fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Solo aceptamos imágenes JPEG o PNG.')
  return { id: uid(), url: await readDataUrl(file), contentType: file.type, ...await dimensions(file) }
}
