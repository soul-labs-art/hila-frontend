// Necesidades de la organización: lista por estado y resumen (planned: solo con features.needs).
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Feedback, PageHeading, Select, StatusBadge } from './components'
import { needPhoto, placeLabel, whenLabel } from './need-format'
import { usePageTitle } from './page-title'
import { photo, photoSrc } from './photos'
import { Pagination } from './Profiles'
import { needLook, orgQuery, territoriesQuery, useOrgWork, type Cause, type Managed, type Org } from './needs-data'
import { ApprovalNotice, OrgGate } from './needs-shared'
import { Breadcrumbs, Card, EmptyState, Icon, Notice, Tabs, type IconName } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'

const pageSize = 8
const tabs = [{ id: 'todas', label: 'Todas', match: () => true }, { id: 'borrador', label: 'Borradores', match: (need: Managed) => need.status === 'DRAFT' }, { id: 'publicada', label: 'Publicadas', match: (need: Managed) => need.status === 'PUBLISHED' },
  { id: 'cerrada', label: 'Cerradas', match: (need: Managed) => need.status === 'CLOSED' }, { id: 'cancelada', label: 'Canceladas', match: (need: Managed) => need.status === 'CANCELLED' }]
const sortNeeds = (a: Managed, b: Managed) => needLook(a).rank - needLook(b).rank || (needLook(a).rank >= 3 ? b.startsAt.localeCompare(a.startsAt) : a.startsAt.localeCompare(b.startsAt))

function Meta({ icon, children }: { icon: IconName; children: React.ReactNode }) { return <li><Icon name={icon} size={20} /><span>{children}</span></li> }

function NeedRow({ need, cause, territories, org }: { need: Managed; cause?: Cause; territories: Parameters<typeof placeLabel>[1]; org: string }) {
  const look = needLook(need), pic = needPhoto(need), editable = need.status === 'DRAFT' || need.status === 'PUBLISHED', full = need.status === 'PUBLISHED' && need.slotsAvailable === 0
  const action = look.label === 'Por cerrar' ? 'Registrar resultado' : editable ? 'Editar' : 'Ver detalle', held = need.slotsRequired - need.slotsAvailable
  return <li><Card as="article" className="need-row" aria-labelledby={`need-${need.id}`}>
    <span className="act-thumb"><img src={photoSrc(pic, 800)} alt="" loading="lazy" style={{ objectPosition: photo(pic).focus }} /></span>
    <div className="need-row-main"><div className="need-row-tags"><StatusBadge tone={look.tone}>{look.label}</StatusBadge>{full && <StatusBadge tone="wait">Cupos completos</StatusBadge>}{cause && <span className="cause-chip"><Icon name="leaf" size={16} />{cause.title}</span>}</div>
      <h2 id={`need-${need.id}`}><Link to={`/organizaciones/${org}/necesidades/${need.id}`}>{need.title}</Link></h2>
      <ul className="need-meta"><Meta icon="calendar">{whenLabel(need)}</Meta><Meta icon="people">{need.status === 'DRAFT' ? `${need.slotsRequired} ${need.slotsRequired === 1 ? 'cupo' : 'cupos'}` : `${held} de ${need.slotsRequired} ${need.slotsRequired === 1 ? 'cupo reservado' : 'cupos reservados'}`}</Meta><Meta icon="pin">{placeLabel(need, territories)}</Meta></ul></div>
    <Link className={`action${look.label === 'Por cerrar' ? ' primary' : ''}`} to={`/organizaciones/${org}/necesidades/${need.id}`} aria-label={`${action}: ${need.title}`}>{action}<Icon name="arrowRight" size={20} /></Link>
  </Card></li>
}
function Skeleton() { return <ul className="need-rows" aria-hidden="true">{[0, 1, 2].map(item => <li key={item}><div className="card need-row skeleton"><span className="act-thumb" /><div className="need-row-main"><span className="sk-line w40" /><span className="sk-line w70" /><span className="sk-line w60" /></div></div></li>)}</ul> }

function NeedsView({ org }: { org: Org }) {
  const [params, setParams] = useSearchParams(), { causes, needs } = useOrgWork(org.id), territories = useQuery(territoriesQuery)
  const tab = tabs.find(item => item.id === params.get('estado'))?.id ?? 'todas', causeId = params.get('causa') ?? '', page = Math.max(0, Number(params.get('pagina')) || 0)
  const all = (needs.data ?? []).filter(need => !causeId || need.causeId === causeId).sort(sortNeeds), count = (id: string) => all.filter(tabs.find(item => item.id === id)!.match).length
  const list = all.filter(tabs.find(item => item.id === tab)!.match), pages = Math.ceil(list.length / pageSize), shown = list.slice(page * pageSize, (page + 1) * pageSize)
  const toClose = all.filter(need => needLook(need).label === 'Por cerrar').length, byId = new Map((causes.data ?? []).map(item => [item.id, item]))
  const change = (key: string, value: string) => { const copy = new URLSearchParams(params); if (value && !(key === 'estado' && value === 'todas')) copy.set(key, value); else copy.delete(key); copy.delete('pagina'); setParams(copy, { replace: true }) }
  const loading = causes.isPending || (!!causes.data && needs.isPending), error = causes.error ?? needs.error
  const content = error ? <><Feedback error={error} /><button type="button" className="action" onClick={() => { void causes.refetch(); void needs.refetch() }}>Volver a intentar</button></>
    : loading ? <><p className="sr-only" role="status">Cargando tus necesidades…</p><Skeleton /></>
    : (causes.data?.length ?? 0) === 0 ? <EmptyState title="Primero crea una causa" action={<Link className="action primary" to={`/organizaciones/${org.id}/causas`}>Ir a causas<Icon name="arrowRight" size={20} /></Link>}>Las necesidades se publican dentro de una causa de tu organización.</EmptyState>
    : shown.length === 0 ? <EmptyState title={all.length === 0 ? 'Aún no hay necesidades' : 'No hay necesidades en este estado'} action={all.length === 0 ? <Link className="action primary" to={`/organizaciones/${org.id}/necesidades/nueva${causeId ? `?causa=${causeId}` : ''}`}><Icon name="plus" size={20} />Crear una necesidad</Link> : <button type="button" className="action" onClick={() => change('estado', 'todas')}>Ver todas</button>}>{all.length === 0 ? 'Una necesidad describe qué actividad pides, cuándo, dónde y qué habilidades ayudan.' : 'Prueba con otra pestaña o quita el filtro de causa.'}</EmptyState>
    : <><ul className="need-rows">{shown.map(need => <NeedRow key={need.id} need={need} cause={byId.get(need.causeId)} territories={territories.data?.items ?? []} org={org.id} />)}</ul><Pagination page={page} totalPages={pages} setPage={next => { const copy = new URLSearchParams(params); if (next) copy.set('pagina', String(next)); else copy.delete('pagina'); setParams(copy); window.scrollTo(0, 0) }} /></>
  return <div className="work needs">
    <Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `/organizaciones/${org.id}/editar` }, { label: 'Necesidades' }]} />
    <PageHeading title="Necesidades" lead="Lo que tu organización pide a quienes quieren sumarse."><Link className="action primary" to={`/organizaciones/${org.id}/necesidades/nueva${causeId ? `?causa=${causeId}` : ''}`}><Icon name="plus" size={20} />Nueva necesidad</Link></PageHeading>
    <ApprovalNotice org={org} />
    {toClose > 0 && <Notice icon="clock"><strong>{toClose === 1 ? 'Una actividad ya terminó.' : `${toClose} actividades ya terminaron.`}</strong> Registra su resultado para cerrarlas.</Notice>}
    {(causes.data?.length ?? 0) > 1 && <div className="needs-toolbar"><Select label="Causa" name="causa" value={causeId} onChange={event => change('causa', event.target.value)}><option value="">Todas las causas</option>{causes.data?.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></div>}
    <Tabs label="Estado de las necesidades" value={tab} onChange={id => change('estado', id)} tabs={tabs.map(item => ({ id: item.id, label: `${item.label}${needs.data ? ` (${count(item.id)})` : ''}`, panel: item.id === tab ? content : null }))} />
  </div>
}

export function Needs() {
  const { id = '' } = useParams()
  usePageTitle('Necesidades')
  return <OrgGate id={id}>{org => <NeedsView org={org} />}</OrgGate>
}

/** Resumen de la organización: conteos que el contrato permite calcular y un siguiente paso. */
export function OrgSummary({ id }: { id: string }) {
  const query = useQuery(orgQuery(id)), { causes, needs } = useOrgWork(id)
  if (query.error || causes.error || needs.error || !query.data) return null
  if (causes.isPending || (!!causes.data && needs.isPending)) return <p className="loading-state" role="status">Cargando el resumen…</p>
  const org = query.data, list = needs.data ?? [], cs = causes.data ?? [], by = (fn: (need: Managed) => boolean) => list.filter(fn).length
  const drafts = by(need => need.status === 'DRAFT'), live = by(need => need.status === 'PUBLISHED' && needLook(need).label === 'Publicada'), toClose = by(need => needLook(need).label === 'Por cerrar'), closed = by(need => need.status === 'CLOSED'), cancelled = by(need => need.status === 'CANCELLED')
  const base = `/organizaciones/${id}`
  const next: { text: string; to: string; label: string } = !cs.length ? { text: 'Empieza creando la primera causa de tu organización.', to: `${base}/causas`, label: 'Crear una causa' }
    : toClose ? { text: `${toClose === 1 ? 'Una actividad ya terminó' : `${toClose} actividades ya terminaron`}: registra su resultado para cerrarlas.`, to: `${base}/necesidades?estado=publicada`, label: 'Ver las que faltan' }
    : !list.length ? { text: 'Ya tienes causas. Ahora describe la primera necesidad.', to: `${base}/necesidades/nueva`, label: 'Crear una necesidad' }
    : drafts && org.verificationStatus === 'APPROVED' ? { text: `Tienes ${drafts === 1 ? 'un borrador listo' : `${drafts} borradores`} para revisar y publicar.`, to: `${base}/necesidades?estado=borrador`, label: 'Ver borradores' }
    : org.verificationStatus !== 'APPROVED' ? { text: 'Mientras Hila revisa tu organización puedes preparar borradores y causas.', to: `${base}/necesidades/nueva`, label: 'Preparar una necesidad' }
    : { text: 'Todo está al día. Cuando surja otra necesidad, créala desde aquí.', to: `${base}/necesidades/nueva`, label: 'Crear una necesidad' }
  const stat = (value: number, label: string, to: string) => <li><Link to={to}><strong>{value}</strong><span>{label}</span></Link></li>
  return <Card as="section" className="org-summary" aria-labelledby="summary-title"><h2 id="summary-title">Causas y necesidades</h2>
    <ul className="stat-grid" aria-label="Conteos">{stat(cs.filter(item => item.status === 'ACTIVE').length, cs.filter(item => item.status === 'ACTIVE').length === 1 ? 'causa activa' : 'causas activas', `${base}/causas`)}{stat(drafts, drafts === 1 ? 'borrador' : 'borradores', `${base}/necesidades?estado=borrador`)}{stat(live + toClose, live + toClose === 1 ? 'publicada' : 'publicadas', `${base}/necesidades?estado=publicada`)}{stat(closed, closed === 1 ? 'cerrada' : 'cerradas', `${base}/necesidades?estado=cerrada`)}{cancelled > 0 && stat(cancelled, cancelled === 1 ? 'cancelada' : 'canceladas', `${base}/necesidades?estado=cancelada`)}</ul>
    <div className="next-step"><Icon name="sprout" size={24} /><p><strong>Siguiente paso.</strong> {next.text}</p><Link className="action primary" to={next.to}>{next.label}<Icon name="arrowRight" size={20} /></Link></div>
  </Card>
}
