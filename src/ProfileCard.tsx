import { useEffect, useState, type ChangeEvent } from 'react'
import { Link } from 'react-router-dom'
import { api, type Schemas } from './api/client'
import { Feedback, FilePicker, StatusBadge } from './components'

export type ImageRef = { id: string; url: string; width: number; height: number; contentType: string }
export type ProfileImages = { avatar: ImageRef | null; cover: ImageRef | null }
export function ProfileCard({ name, description, subtitle, avatar, cover, headingLevel = 1, children }: ProfileImages & { name: string; description?: string | null; subtitle?: string; headingLevel?: 1 | 2; children?: React.ReactNode }) {
  const Heading = headingLevel === 1 ? 'h1' : 'h2'
  return <article className="profile-card"><div className="profile-cover">{cover ? <img src={cover.url} alt="Portada del perfil" /> : <span className="cover-mark" aria-hidden="true">hila</span>}</div><div className="profile-body"><div className="profile-avatar">{avatar ? <img src={avatar.url} alt={`Imagen de ${name}`} /> : <span aria-hidden="true">{name.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]).join('')}</span>}</div><div className="profile-identity"><Heading>{name}</Heading>{subtitle && <p className="profile-subtitle">{subtitle}</p>}</div>{description && <p className="profile-description">{description}</p>}{children}</div></article>
}

export function ImageEditor({ base, images, onSaved }: { base: string; images: ProfileImages; onSaved: () => void }) {
  return <section className="image-editor"><h2>Tu imagen en Hila</h2><p>Elige una foto o logotipo y una portada. JPEG o PNG, hasta 10 MiB y 16 megapíxeles. El recorte se centra automáticamente.</p><div className="image-editor-grid">{(['avatar', 'cover'] as const).map(slot => <ImageSlot key={slot} base={base} slot={slot} image={images[slot]} onSaved={onSaved} />)}</div></section>
}
function ImageSlot({ base, slot, image, onSaved }: { base: string; slot: 'avatar' | 'cover'; image: ImageRef | null; onSaved: () => void }) {
  const [file, setFile] = useState<File>(), [preview, setPreview] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])
  function chooseFile(value?: File) { setFile(value); setPreview(value ? URL.createObjectURL(value) : '') }
  const label = slot === 'avatar' ? 'Foto o logotipo' : 'Portada'
  async function upload() {
    if (!file) return
    setBusy(true); setError(undefined); setNotice('')
    try { const body = new FormData(); body.set('file', file); await api<ImageRef>(`${base}/images/${slot}`, { method: 'PUT', body }); chooseFile(undefined); setNotice('Imagen guardada.'); onSaved() }
    catch (value) { setError(value) } finally { setBusy(false) }
  }
  async function remove() {
    setBusy(true); setError(undefined)
    try { await api(`${base}/images/${slot}`, { method: 'DELETE' }); chooseFile(undefined); setNotice('Imagen eliminada.'); onSaved() } catch (value) { setError(value) } finally { setBusy(false) }
  }
  function pick(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0]; setError(undefined); setNotice('')
    if (selected && (!['image/jpeg', 'image/png'].includes(selected.type) || selected.size > 10 * 1024 * 1024)) { setError(new Error('Elige un archivo JPEG o PNG de hasta 10 MiB.')); chooseFile(undefined); event.target.value = ''; return }
    if (selected) { const url = URL.createObjectURL(selected); const img = new Image(); img.onload = () => { URL.revokeObjectURL(url); if (img.width * img.height > 16_000_000) { setError(new Error('La imagen supera 16 megapíxeles. Reduce su tamaño antes de subirla.')); chooseFile(undefined) } else chooseFile(selected) }; img.onerror = () => { URL.revokeObjectURL(url); setError(new Error('No pudimos leer esta imagen. Elige otro archivo.')) }; img.src = url }
  }
  return <div className="image-slot"><h3>{label}</h3><div className={`image-preview ${slot}`}>{preview || image ? <img src={preview || image!.url} alt={`Vista previa de ${label.toLowerCase()}`} /> : <span>Sin imagen</span>}</div><FilePicker id={`file-${slot}`} label={`Elegir ${slot === 'avatar' ? 'foto' : 'portada'}`} file={file} disabled={busy} accept="image/jpeg,image/png" onChange={pick} /><div className="actions"><button className="action primary" type="button" disabled={busy || !file} onClick={() => void upload()}>{busy ? 'Procesando…' : 'Guardar imagen'}</button>{image && <button className="text-button" disabled={busy} type="button" onClick={() => void remove()}>Eliminar</button>}</div><Feedback error={error} success={notice} /></div>
}

export function Publication({ base, visibility, disabled, link, onSaved }: { base: string; visibility: string; disabled?: boolean; link: string; onSaved: () => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), [notice, setNotice] = useState('')
  const isPublic = visibility === 'PUBLIC'
  return <section className="publication"><h2>Tu perfil público</h2><p>{isPublic ? 'Tu perfil se puede consultar mediante su enlace. Puedes ocultarlo cuando quieras.' : 'Tu perfil es privado. Publicarlo permite consultar su presentación e imágenes mediante un enlace; los datos privados de tu cuenta no se comparten.'}</p>{disabled && <p className="callout">La organización necesita aprobación de Hila antes de publicar su perfil.</p>}<Feedback error={error} success={notice} /><div className="actions"><button className={isPublic ? 'action' : 'action primary'} disabled={busy || (disabled && !isPublic)} onClick={async () => {
    setBusy(true); setError(undefined); setNotice('')
    try { await api(`${base}/publication`, { method: 'PUT', body: { visible: !isPublic } }); onSaved(); setNotice(isPublic ? 'El perfil ahora es privado.' : 'Publicamos tu perfil.') } catch (value) { setError(value) } finally { setBusy(false) }
  }}>{busy ? 'Guardando…' : isPublic ? 'Ocultar perfil' : 'Publicar perfil'}</button>{isPublic && <><Link className="action primary" to={link}>Ver perfil público</Link><button className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(new URL(link, location.origin).href); setNotice('Enlace copiado.') } catch { setError(new Error('No se pudo copiar el enlace. Abre el perfil y copia su dirección.')) } }}>Copiar enlace</button></>}</div></section>
}

export function VisibilityBadge({ visibility }: { visibility: string }) { return <StatusBadge tone={visibility === 'PUBLIC' ? 'ok' : 'neutral'}>{visibility === 'PUBLIC' ? 'Perfil público' : 'Perfil privado'}</StatusBadge> }

export type Volunteer = Schemas['VolunteerProfile'] & ProfileImages & { visibility: 'PRIVATE' | 'PUBLIC' }
export type Organization = Schemas['Organization'] & ProfileImages & { visibility: 'PRIVATE' | 'PUBLIC' }
