// Catálogos de administración: habilidades, recursos y territorios (planned: solo con features.adminTools).
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, Select, StatusBadge } from './components'
import { explain } from './friendly-errors'
import { everyPage } from './needs-data'
import { Dialog } from './needs-shared'
import { usePageTitle } from './page-title'
import { Pagination } from './Profiles'
import { Breadcrumbs, Card, EmptyState, Icon, Tabs, Toggle } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './team.css'
import './admin.css'

type Kind = 'skills' | 'resources' | 'territories'
type Territory = Schemas['Territory']
type Entry = Schemas['Skill'] | Schemas['Resource'] | Territory
type EntryPage = { items: Entry[]; totalPages: number; totalElements: number }

const kinds: Record<Kind, { tab: string; one: string; create: string; empty: string }> = {
  skills: { tab: 'Habilidades', one: 'habilidad', create: 'Nueva habilidad', empty: 'Las habilidades son lo que las personas ofrecen y lo que las necesidades piden.' },
  resources: { tab: 'Recursos', one: 'recurso', create: 'Nuevo recurso', empty: 'Los recursos son los materiales o espacios que una necesidad puede pedir.' },
  territories: { tab: 'Territorios', one: 'territorio', create: 'Nuevo territorio', empty: 'Los territorios ubican las necesidades y las zonas de servicio.' },
}
const typeName: Record<Territory['type'], string> = { VALLEY: 'Valle', MUNICIPALITY: 'Municipio', COMMUNE: 'Comuna', NEIGHBORHOOD: 'Barrio' }
const level: Record<Territory['type'], number> = { VALLEY: 0, MUNICIPALITY: 1, COMMUNE: 2, NEIGHBORHOOD: 3 }
const parentHint: Record<Territory['type'], string> = { VALLEY: 'El valle es el nivel más alto y no tiene territorio padre.', MUNICIPALITY: 'Un municipio pertenece a un valle.', COMMUNE: 'Una comuna pertenece a un municipio.', NEIGHBORHOOD: 'Un barrio pertenece a una comuna.' }
const slugOf = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100)
const isTerritory = (entry: Entry): entry is Territory => 'type' in entry
const allTerritories = { queryKey: ['admin-catalog', 'territories', 'all'], queryFn: () => everyPage<Territory>('/admin/catalogs/territories'), retry: false }

function EntryDialog({ kind, entry, onClose, onSaved }: { kind: Kind; entry?: Entry; onClose: () => void; onSaved: (entry: Entry) => void }) {
  const client = useQueryClient(), [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), territory = entry && isTerritory(entry) ? entry : undefined
  const [name, setName] = useState(entry?.name ?? ''), [slug, setSlug] = useState(entry?.slug ?? ''), [active, setActive] = useState(entry?.active ?? true), touched = useRef(!!entry)
  const [type, setType] = useState<Territory['type']>(territory?.type ?? 'MUNICIPALITY'), [parent, setParent] = useState(territory?.parentId ?? '')
  const parents = useQuery({ ...allTerritories, enabled: kind === 'territories' }), options = (parents.data ?? []).filter(item => level[item.type] === level[type] - 1 && item.id !== entry?.id)
  async function save(data: FormData) {
    setBusy(true); setError(undefined)
    try {
      const common = { slug: slug.trim(), name: name.trim(), active }
      const body = kind === 'territories' ? { ...common, type, parentId: type === 'VALLEY' ? null : parent || null } satisfies Schemas['TerritoryWrite'] : { ...common, category: String(data.get('category') ?? '').trim() } satisfies Schemas['SkillWrite']
      const saved = await api<Entry>(`/admin/catalogs/${kind}${entry ? `/${entry.id}` : ''}`, { method: entry ? 'PUT' : 'POST', body })
      await Promise.all(['admin-catalog', 'catalog', 'territories'].map(key => client.invalidateQueries({ queryKey: [key] }))); onSaved(saved)
    } catch (failure) { setError(explain(failure)) } finally { setBusy(false) }
  }
  const one = kinds[kind].one
  return <Dialog wide title={entry ? `Editar ${one}` : kinds[kind].create} confirmLabel="Guardar" busy={busy} error={error} onClose={onClose} onSubmit={data => void save(data)}>
    <p className="dialog-note">Los campos con asterisco (*) son obligatorios.</p>
    <Field label="Nombre *" name="name" required maxLength={140} autoFocus value={name} onChange={event => { setName(event.target.value); if (!touched.current) setSlug(slugOf(event.target.value)) }} error={error} />
    <Field label="Identificador de texto (slug) *" name="slug" required maxLength={100} value={slug} onChange={event => { touched.current = true; setSlug(event.target.value) }} hint="Minúsculas, números y guiones. Por ejemplo: huertas-urbanas." error={error} />
    {kind !== 'territories' && <Field label="Categoría *" name="category" required maxLength={100} defaultValue={entry && !isTerritory(entry) ? entry.category : ''} hint="Agrupa las entradas en las listas. Por ejemplo: Educación." error={error} />}
    {kind === 'territories' && <>
      <Select label="Tipo *" name="type" value={type} onChange={event => { setType(event.target.value as Territory['type']); setParent('') }} error={error}>{(Object.keys(typeName) as Territory['type'][]).map(value => <option key={value} value={value}>{typeName[value]}</option>)}</Select>
      {type === 'VALLEY' ? <p className="dialog-note">{parentHint.VALLEY}</p> : <Select label="Territorio padre *" name="parentId" value={parent} onChange={event => setParent(event.target.value)} error={error}><option value="">Elige uno</option>{options.map(item => <option key={item.id} value={item.id}>{item.name}{item.active ? '' : ' (inactivo)'}</option>)}</Select>}
      {type !== 'VALLEY' && <p className="dialog-note">{parentHint[type]}</p>}</>}
    <Toggle label="Entrada activa" hint="Una entrada inactiva deja de ofrecerse en perfiles y necesidades nuevas, pero se conserva donde ya se usa." checked={active} onChange={setActive} onText="Activa" offText="Inactiva" />
  </Dialog>
}

function CatalogPanel({ kind }: { kind: Kind }) {
  const [typed, setTyped] = useState(''), [search, setSearch] = useState(''), [state, setState] = useState(''), [page, setPage] = useState(0), [dialog, setDialog] = useState<Entry | 'new' | null>(null), [message, setMessage] = useState(''), result = useRef<HTMLDivElement>(null), info = kinds[kind]
  useEffect(() => { const timer = setTimeout(() => { setSearch(typed.trim()); setPage(0) }, 300); return () => clearTimeout(timer) }, [typed])
  const query = useQuery({ queryKey: ['admin-catalog', kind, search, state, page], queryFn: () => api<EntryPage>(`/admin/catalogs/${kind}?size=20&page=${page}${search ? `&q=${encodeURIComponent(search)}` : ''}${state ? `&active=${state}` : ''}`), retry: false, placeholderData: keepPreviousData })
  const places = useQuery({ ...allTerritories, enabled: kind === 'territories' }), parentName = (entry: Territory) => entry.parentId ? places.data?.find(item => item.id === entry.parentId)?.name ?? '…' : '—'
  const items = query.data?.items ?? [], filtered = !!search || !!state
  const saved = (entry: Entry) => { setDialog(null); setMessage(`Guardamos «${entry.name}».`); setTimeout(() => result.current?.focus(), 60) }
  return <div className="catalog-panel">
    <div className="catalog-toolbar">
      <Field label="Buscar" name="q" type="search" value={typed} onChange={event => setTyped(event.target.value)} maxLength={140} autoComplete="off" placeholder={`Nombre de ${kind === 'skills' ? 'una' : 'un'} ${info.one}`} />
      <Select label="Estado" name="active" value={state} onChange={event => { setState(event.target.value); setPage(0) }}><option value="">Todas</option><option value="true">Activas</option><option value="false">Inactivas</option></Select>
      <button type="button" className="action primary" onClick={() => { setMessage(''); setDialog('new') }}><Icon name="plus" size={20} />{info.create}</button>
    </div>
    <div ref={result} tabIndex={-1} className="act-result"><Feedback success={message} /></div>
    {query.error ? <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
      : query.isPending ? <p className="loading-state" role="status">Cargando {info.tab.toLowerCase()}…</p>
        : items.length === 0 ? <EmptyState title={filtered ? 'No encontramos entradas con esos filtros.' : `Aún no hay ${info.tab.toLowerCase()}`} headingLevel={2} action={filtered ? <button type="button" className="action" onClick={() => { setTyped(''); setSearch(''); setState(''); setPage(0) }}>Quitar filtros</button> : undefined}>{filtered ? 'Prueba con otro nombre o cambia el estado.' : info.empty}</EmptyState>
          : <><p className="catalog-count" role="status">{query.data!.totalElements} {query.data!.totalElements === 1 ? 'entrada' : 'entradas'}{filtered ? ' con estos filtros' : ''}</p>
            <Card className="team-card"><table className="data-table catalog-table"><caption className="sr-only">{info.tab}</caption>
              <thead><tr><th scope="col">Nombre</th>{kind === 'territories' ? <><th scope="col" className="col-wide">Tipo</th><th scope="col" className="col-wide">Territorio padre</th></> : <th scope="col" className="col-wide">Categoría</th>}<th scope="col">Estado</th><th scope="col" className="col-actions"><span className="sr-only">Acciones</span></th></tr></thead>
              <tbody>{items.map(entry => { const on = entry.active; return <tr key={entry.id} className={on ? undefined : 'is-revoked'}>
                <td><strong className="entry-name">{entry.name}</strong><small className="entry-slug">{entry.slug}</small>{isTerritory(entry) ? <small className="entry-extra">{typeName[entry.type]} · {parentName(entry)}</small> : <small className="entry-extra">{entry.category}</small>}</td>
                {isTerritory(entry) ? <><td className="col-wide">{typeName[entry.type]}</td><td className="col-wide">{parentName(entry)}</td></> : <td className="col-wide">{entry.category}</td>}
                <td><StatusBadge tone={on ? 'ok' : 'neutral'}>{on ? 'Activa' : 'Inactiva'}</StatusBadge></td>
                <td className="col-actions"><button type="button" className="action" aria-label={`Editar ${entry.name}`} onClick={() => { setMessage(''); setDialog(entry) }}><Icon name="gear" size={20} /><span className="edit-text">Editar</span></button></td></tr> })}</tbody></table></Card>
            <Pagination page={page} totalPages={query.data!.totalPages} setPage={setPage} /></>}
    {dialog && <EntryDialog kind={kind} entry={dialog === 'new' ? undefined : dialog} onClose={() => setDialog(null)} onSaved={saved} />}
  </div>
}

const isKind = (value: string | null): value is Kind => value === 'skills' || value === 'resources' || value === 'territories'
export function AdminCatalogs() {
  usePageTitle('Catálogos')
  const [params, setParams] = useSearchParams(), tab = params.get('tipo'), active: Kind = isKind(tab) ? tab : 'skills'
  return <div className="work admin-catalogs">
    <Breadcrumbs items={[{ label: 'Administración', to: '/admin/organizaciones' }, { label: 'Catálogos' }]} />
    <PageHeading title="Catálogos" lead="Las listas que usan los perfiles y las necesidades. Se desactivan, no se borran." />
    <Tabs label="Tipo de catálogo" value={active} onChange={id => setParams({ tipo: id }, { replace: true })} tabs={(Object.keys(kinds) as Kind[]).map(kind => ({ id: kind, label: kinds[kind].tab, panel: <CatalogPanel kind={kind} /> }))} />
  </div>
}
