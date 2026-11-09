// Operaciones planned del contrato; retirar cuando el backend las implemente.
import type { Schemas } from '../../../client'
import { causeOf, coordinatedNeed, findApplication, findParticipation, isCoordination, needOf, newest, readableNeed, uuid, findNeed } from '../../domain'
import { Fail, invalid, notFound } from '../../errors'
import { route } from '../../router'
import { samplePdf, samplePng } from '../../samples'
import { db } from '../../store'
import type { Account, EvidenceRecord } from '../../types'
import { now, ok, paginate, uid } from '../../util'
import { requireUser } from '../../views'

const limit = 20 * 1024 * 1024
const starts = (bytes: Uint8Array, signature: number[]) => signature.every((value, index) => bytes[index] === value)
// Se comprueba el contenido real (firma del archivo), no solo la extensión ni el tipo declarado.
function mediaTypeOf(bytes: Uint8Array): Schemas['Evidence']['mediaType'] | null {
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47])) return 'image/png'
  if (starts(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg'
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46])) return 'application/pdf'
  return null
}
async function receive(form: FormData | null) {
  const file = form?.get('file')
  if (!(file instanceof File) || file.size === 0) throw invalid({ field: 'file', code: 'REQUIRED', message: 'Elige un archivo para adjuntar.' })
  if (file.size > limit) throw new Fail(413, 'FILE_TOO_LARGE', 'El archivo supera el tamaño permitido (20 MiB). Elige uno más liviano.')
  const bytes = new Uint8Array(await file.arrayBuffer()), mediaType = mediaTypeOf(bytes)
  if (!mediaType) throw new Fail(415, 'UNSUPPORTED_MEDIA_TYPE', 'Solo aceptamos archivos JPEG, PNG o PDF.')
  let binary = ''
  for (let at = 0; at < bytes.length; at += 0x8000) binary += String.fromCharCode(...bytes.subarray(at, at + 0x8000))
  return { name: (file.name || 'evidencia').slice(0, 255), size: file.size, mediaType, dataUrl: `data:${mediaType};base64,${btoa(binary)}` }
}
const view = ({ dataUrl: _data, ...evidence }: EvidenceRecord): Schemas['Evidence'] => evidence
async function attach(form: FormData | null, target: { needId: string | null; participationId: string | null }, actor: Account) {
  const received = await receive(form)
  const entry: EvidenceRecord = { id: uid(), ...target, originalFilename: received.name, mediaType: received.mediaType, sizeBytes: received.size, uploadedBy: actor.id, uploadedAt: now(), dataUrl: received.dataUrl }
  db().evidence.push(entry)
  return ok(view(entry), 201)
}
/** Quien puede leer evidencias de una participación: su titular, el equipo responsable o ADMIN; el resto recibe 404. */
function participationContext(id: string, account: Account) {
  const participation = findParticipation(id), application = findApplication(participation.applicationId), need = needOf(application)
  const team = isCoordination(causeOf(need).organizationId, account)
  if (application.volunteerId !== account.id && !team && !account.roles.includes('ADMIN')) throw notFound()
  return { participation, team, need }
}

export const evidenceRoutes = [
  route('GET', '/needs/{needId}/evidence', ({ params, query }) => {
    const need = readableNeed(params.needId, requireUser())
    return ok(paginate(newest(db().evidence.filter(item => item.needId === need.id), item => item.uploadedAt).map(view), query) satisfies Schemas['EvidencePage'])
  }),
  route('POST', '/needs/{needId}/evidence', async ({ params, form }) => {
    const actor = requireUser(), need = coordinatedNeed(params.needId, actor)
    if (need.status !== 'CLOSED') throw new Fail(409, 'INVALID_TRANSITION', 'La evidencia de una necesidad se adjunta cuando la necesidad ya está cerrada.')
    return attach(form, { needId: need.id, participationId: null }, actor)
  }),
  route('GET', '/participation/{participationId}/evidence', ({ params, query }) => {
    const { participation } = participationContext(params.participationId, requireUser())
    return ok(paginate(newest(db().evidence.filter(item => item.participationId === participation.id), item => item.uploadedAt).map(view), query) satisfies Schemas['EvidencePage'])
  }),
  route('POST', '/participation/{participationId}/evidence', async ({ params, form }) => {
    const actor = requireUser(), { participation, team } = participationContext(params.participationId, actor)
    if (!team) throw notFound()
    return attach(form, { needId: null, participationId: participation.id }, actor)
  }),
  route('GET', '/evidence/{evidenceId}/download-url', ({ params }) => {
    const account = requireUser(), entry = db().evidence.find(item => item.id === uuid(params.evidenceId))
    if (!entry) throw notFound()
    if (entry.participationId) participationContext(entry.participationId, account)
    else if (entry.needId) readableNeed(findNeed(entry.needId).id, account)
    return ok({ url: entry.dataUrl ?? (entry.mediaType === 'application/pdf' ? samplePdf('Evidencia de ejemplo - Hila') : samplePng()), expiresAt: new Date(Date.now() + 60_000).toISOString() } satisfies Schemas['EvidenceDownload'])
  }),
]
