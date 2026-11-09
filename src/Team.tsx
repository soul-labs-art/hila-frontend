// Equipo de la organización: quién colabora y con qué rol (planned: solo con features.team).
import { useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ActionMenu, type MenuAction } from './action-menu'
import { dayYear } from './activity-format'
import { api, type Schemas } from './api/client'
import { Feedback, Field, PageHeading, StatusBadge } from './components'
import { explain } from './friendly-errors'
import { everyPage, isMember404, type Org } from './needs-data'
import { Dialog, OrgGate, Unavailable } from './needs-shared'
import { usePageTitle } from './page-title'
import { useSession } from './session-context'
import { Avatar, Breadcrumbs, Card, EmptyState, Icon, Notice, RadioCards } from './ui'
import './explore.css'
import './activity.css'
import './needs.css'
import './team.css'

type Member = Schemas['Membership']
type Role = Member['role']
type Change = 'promote' | 'demote' | 'revoke' | 'reactivate'
type Open = { kind: 'add' } | { kind: 'change'; member: Member; change: Change }

const roleName: Record<Role, string> = { ORG_OWNER: 'Responsable', ORG_COORDINATOR: 'Coordinación' }
const teamQuery = (id: string) => ({ queryKey: ['team', id], queryFn: () => everyPage<Member>(`/organizations/${id}/memberships`), retry: false })
const order = (a: Member, b: Member) => Number(a.status === 'REVOKED') - Number(b.status === 'REVOKED') || Number(b.role === 'ORG_OWNER') - Number(a.role === 'ORG_OWNER') || a.displayName.localeCompare(b.displayName, 'es')

function RolePill({ role, muted }: { role: Role; muted?: boolean }) { return <span className={`role-pill role-${role === 'ORG_OWNER' ? 'owner' : 'coordinator'}${muted ? ' is-muted' : ''}`}>{roleName[role]}</span> }

function AddDialog({ org, onClose, onSaved }: { org: Org; onClose: () => void; onSaved: (member: Member) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), client = useQueryClient()
  async function save(data: FormData) {
    setBusy(true); setError(undefined)
    try {
      const body: Schemas['MembershipCreate'] = { email: String(data.get('email') ?? '').trim(), role: String(data.get('role')) as Role }
      const saved = await api<Member>(`/organizations/${org.id}/memberships`, { method: 'POST', body })
      await Promise.all([client.invalidateQueries({ queryKey: ['team', org.id] }), client.invalidateQueries({ queryKey: ['memberships', org.id] })]); onSaved(saved)
    } catch (failure) { setError(explain(failure)) } finally { setBusy(false) }
  }
  return <Dialog wide title="Añadir integrante" confirmLabel="Añadir al equipo" busy={busy} error={error} onClose={onClose} onSubmit={data => void save(data)}>
    <p>Escribe el correo de una persona que ya tenga cuenta en Hila. No enviamos invitaciones ni creamos cuentas.</p>
    <Field label="Correo de la persona *" name="email" type="email" required maxLength={320} autoFocus autoComplete="off" hint="Debe estar verificado y la cuenta activa." error={error} />
    <RadioCards name="role" legend="Rol en la organización" defaultValue="ORG_COORDINATOR" options={[{ value: 'ORG_COORDINATOR', label: 'Coordinación', hint: 'Gestiona causas, necesidades y postulaciones' }, { value: 'ORG_OWNER', label: 'Responsable', hint: 'Además cambia el equipo y los datos de la organización' }]} />
  </Dialog>
}

const copy: Record<Change, { title: string; confirm: string; body: (name: string) => string; to: (member: Member) => Schemas['MembershipUpdate']; done: (name: string) => string }> = {
  promote: { title: 'Hacer responsable', confirm: 'Hacer responsable', body: name => `${name} podrá añadir integrantes, cambiar roles y editar los datos de la organización, además de gestionar sus necesidades.`, to: () => ({ role: 'ORG_OWNER', status: 'ACTIVE' }), done: name => `${name} ahora es responsable de la organización.` },
  demote: { title: 'Pasar a coordinación', confirm: 'Pasar a coordinación', body: name => `${name} seguirá gestionando causas, necesidades y postulaciones, pero ya no podrá cambiar el equipo ni los datos de la organización.`, to: () => ({ role: 'ORG_COORDINATOR', status: 'ACTIVE' }), done: name => `${name} ahora es parte de la coordinación.` },
  revoke: { title: 'Retirar del equipo', confirm: 'Retirar', body: name => `${name} perderá el acceso a esta organización. Podrás reactivarla más adelante desde esta misma tabla.`, to: member => ({ role: member.role, status: 'REVOKED' }), done: name => `Retiraste a ${name} del equipo.` },
  reactivate: { title: 'Reactivar en el equipo', confirm: 'Reactivar', body: name => `${name} recuperará el acceso a esta organización con su rol anterior.`, to: member => ({ role: member.role, status: 'ACTIVE' }), done: name => `${name} volvió al equipo.` },
}

function ChangeDialog({ org, member, change, onlyOwner, isSelf, onClose, onSaved }: { org: Org; member: Member; change: Change; onlyOwner: boolean; isSelf: boolean; onClose: () => void; onSaved: (message: string) => void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState<unknown>(), client = useQueryClient(), text = copy[change], leaving = change === 'demote' || change === 'revoke'
  async function save() {
    setBusy(true); setError(undefined)
    try {
      await api<Member>(`/organizations/${org.id}/memberships/${member.userId}`, { method: 'PATCH', body: text.to(member) satisfies Schemas['MembershipUpdate'] })
      await Promise.all([client.invalidateQueries({ queryKey: ['team', org.id] }), client.invalidateQueries({ queryKey: ['memberships', org.id] }), client.invalidateQueries({ queryKey: ['organizations'] })]); onSaved(text.done(member.displayName))
    } catch (failure) { setError(explain(failure)) } finally { setBusy(false) }
  }
  return <Dialog title={text.title} confirmLabel={text.confirm} busy={busy} error={error} danger={change === 'revoke'} onClose={onClose} onSubmit={() => void save()}>
    <p>{text.body(member.displayName)}</p>
    {leaving && member.role === 'ORG_OWNER' && onlyOwner && <Notice tone="warning"><p>{member.displayName} es la única persona responsable activa. Para continuar, primero nombra a otra persona como responsable.</p></Notice>}
    {leaving && isSelf && <Notice tone="warning"><p>Es tu propia cuenta: {change === 'revoke' ? 'perderás el acceso a esta organización.' : 'dejarás de poder cambiar el equipo.'}</p></Notice>}
  </Dialog>
}

function TeamView({ org }: { org: Org }) {
  const session = useSession(), client = useQueryClient(), query = useQuery(teamQuery(org.id)), [open, setOpen] = useState<Open | null>(null), [message, setMessage] = useState(''), result = useRef<HTMLDivElement>(null)
  const items = [...(query.data ?? [])].sort(order), me = items.find(item => item.userId === session.user?.id && item.status === 'ACTIVE'), isAdmin = !!session.user?.roles.includes('ADMIN')
  const owner = me?.role === 'ORG_OWNER', owners = items.filter(item => item.role === 'ORG_OWNER' && item.status === 'ACTIVE').length
  if (query.error) return isMember404(query.error) ? <Unavailable /> : <><Feedback error={query.error} /><button type="button" className="action" onClick={() => void query.refetch()}>Volver a intentar</button></>
  if (query.isPending) return <p className="loading-state" role="status">Cargando el equipo…</p>
  if (!me && !isAdmin) return <Unavailable />
  const done = (text: string) => { setOpen(null); setMessage(text); void client.invalidateQueries({ queryKey: ['team', org.id] }); setTimeout(() => result.current?.focus(), 60) }
  const actionsOf = (member: Member): MenuAction[] => member.status === 'REVOKED' ? [{ label: 'Reactivar en el equipo', icon: 'refresh', onSelect: () => setOpen({ kind: 'change', member, change: 'reactivate' }) }]
    : [member.role === 'ORG_OWNER' ? { label: 'Pasar a coordinación', icon: 'person', onSelect: () => setOpen({ kind: 'change', member, change: 'demote' }) } : { label: 'Hacer responsable', icon: 'checkCircle', onSelect: () => setOpen({ kind: 'change', member, change: 'promote' }) }, { label: 'Retirar del equipo', icon: 'x', danger: true, onSelect: () => setOpen({ kind: 'change', member, change: 'revoke' }) }]
  return <div className="work team">
    <Breadcrumbs items={[{ label: 'Mis organizaciones', to: '/mis-organizaciones' }, { label: org.name, to: `/organizaciones/${org.id}/editar` }, { label: 'Equipo' }]} />
    <PageHeading title="Equipo de la organización" lead="Gestiona las personas que colaboran en esta organización.">{owner && <button type="button" className="action primary" onClick={() => { setMessage(''); setOpen({ kind: 'add' }) }}><Icon name="userPlus" size={20} />Añadir integrante</button>}</PageHeading>
    {!owner && <Notice icon="lock"><p>{me ? 'Eres parte de la coordinación: puedes ver el equipo, pero solo las personas responsables añaden integrantes o cambian roles.' : 'Estás viendo este equipo como administración. Solo las personas responsables lo modifican.'}</p></Notice>}
    <div ref={result} tabIndex={-1} className="act-result"><Feedback success={message} /></div>
    {items.length === 0 ? <EmptyState title="Aún no hay integrantes">Cuando alguien se una al equipo aparecerá aquí.</EmptyState> : <Card className="team-card"><table className="data-table team-table"><caption className="sr-only">Integrantes del equipo y su rol</caption>
      <thead><tr><th scope="col">Nombre</th><th scope="col">Rol</th><th scope="col" className="col-status">Estado</th>{owner && <th scope="col" className="col-actions"><span className="sr-only">Acciones</span></th>}</tr></thead>
      <tbody>{items.map(member => { const active = member.status === 'ACTIVE', badge = <StatusBadge tone={active ? 'ok' : 'neutral'}>{active ? 'Activa' : 'Retirada'}</StatusBadge>; return <tr key={member.userId} className={active ? undefined : 'is-revoked'}>
        <td><div className="person"><Avatar name={member.displayName} size="md" /><span className="person-text"><strong>{member.displayName}{member.userId === session.user?.id && <span className="you"> (tú)</span>}</strong><small>En el equipo desde {dayYear(member.createdAt)}</small><span className="status-inline">{badge}</span></span></div></td>
        <td><RolePill role={member.role} muted={!active} /></td><td className="col-status">{badge}</td>
        {owner && <td className="col-actions"><ActionMenu id={`member-menu-${member.userId}`} label={`Acciones para ${member.displayName}`} actions={actionsOf(member)} /></td>}</tr> })}</tbody></table></Card>}
    <Card as="section" tone="soft" className="roles-card" aria-labelledby="roles-title"><h2 id="roles-title">Qué puede hacer cada rol</h2><dl>
      <div><dt><RolePill role="ORG_OWNER" /></dt><dd>Edita los datos de la organización, añade o retira integrantes, cambia roles y gestiona causas, necesidades y postulaciones. Siempre debe haber al menos una persona responsable activa.</dd></div>
      <div><dt><RolePill role="ORG_COORDINATOR" /></dt><dd>Gestiona causas, necesidades, postulaciones y el cierre de las actividades. Puede ver el equipo, pero no cambiarlo.</dd></div></dl></Card>
    <Notice><p>Los permisos se aplican a esta organización.</p></Notice>
    {open?.kind === 'add' && <AddDialog org={org} onClose={() => setOpen(null)} onSaved={member => done(`${member.displayName} ya hace parte del equipo.`)} />}
    {open?.kind === 'change' && <ChangeDialog org={org} member={open.member} change={open.change} onlyOwner={owners <= 1} isSelf={open.member.userId === session.user?.id} onClose={() => setOpen(null)} onSaved={done} />}
  </div>
}

export function Team() {
  const { id = '' } = useParams()
  usePageTitle('Equipo de la organización')
  return <OrgGate id={id}>{org => <TeamView org={org} />}</OrgGate>
}
