// Guía viva de componentes del lenguaje visual v2. Solo existe en desarrollo con datos de ejemplo (ruta /guia-ui).
import { useState } from 'react'
import { Avatar, BackLink, Breadcrumbs, Card, Chip, ChipGroup, DataTable, DefinitionList, EmptyState, Icon, Notice, RadioCards, RatingScale, Stepper, Tabs, Timeline, Toggle, type IconName } from '.'
import { StatusBadge } from '../components'
import { usePageTitle } from '../page-title'

const names: IconName[] = ['home', 'leaf', 'document', 'people', 'person', 'userPlus', 'bell', 'gear', 'calendar', 'clock', 'pin', 'search', 'checkCircle', 'check', 'info', 'alert', 'chevronDown', 'chevronUp', 'chevronLeft', 'chevronRight', 'arrowRight', 'arrowLeft', 'plus', 'x', 'clip', 'mail', 'folder', 'book', 'tag', 'refresh', 'eye', 'eyeOff', 'menu', 'logout', 'sprout', 'filter', 'trace', 'lock', 'more']
const rows = [{ id: '1', who: 'Mariana R.', part: 'Realizada', hours: '3 h', ok: true }, { id: '2', who: 'Carlos M.', part: 'Realizada', hours: '3 h', ok: false }]

export default function Gallery() {
  usePageTitle('Guía de componentes')
  const [rating, setRating] = useState(4), [on, setOn] = useState(false), [kind, setKind] = useState('COLLECTIVE')
  return <div className="gallery">
    <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Guía de componentes' }]} />
    <h1>Guía de componentes</h1>
    <Card as="section"><h2>Iconos</h2><ul className="gallery-icons">{names.map(name => <li key={name}><Icon name={name} /><span>{name}</span></li>)}</ul></Card>
    <Card as="section"><h2>Estados, avatares y avisos</h2><div className="actions"><StatusBadge tone="ok">Verificada</StatusBadge><StatusBadge tone="wait">Por revisar</StatusBadge><StatusBadge tone="no">Rechazada</StatusBadge><StatusBadge>Borrador</StatusBadge><Avatar name="Laura Caminos" /><Avatar name="Carlos Mejía" size="lg" /><Avatar name="Sofía L" size="xl" /></div>
      <div className="gallery-stack"><Notice>Aviso informativo con icono.</Notice><Notice tone="success">Tu organización está aprobada para publicar.</Notice><Notice tone="warning">La organización necesita aprobación.</Notice></div></Card>
    <Card as="section"><h2>Elección</h2><ChipGroup legend="¿En qué te gustaría apoyar?" hint="Selecciona las capacidades que mejor te representan."><Chip name="c" defaultChecked>Lectura</Chip><Chip name="c" defaultChecked>Organización</Chip><Chip name="c">Comunicación</Chip><Chip name="c">Cuidado ambiental</Chip></ChipGroup>
      <div className="gallery-stack"><Toggle icon="mail" label="Recibir avisos por correo" hint="Oportunidades que encajan con tu perfil." checked={on} onChange={setOn} onText="Avisos activados" offText="Avisos desactivados" />
        <RadioCards name="kind" legend="Tipo de organización" value={kind} onChange={setKind} options={[{ value: 'FORMAL', label: 'Organización formal' }, { value: 'COLLECTIVE', label: 'Colectivo comunitario' }]} />
        <RadioCards name="done" legend="Resultado" defaultValue="OK" options={[{ value: 'OK', label: 'Cumplida' }, { value: 'PARTIAL', label: 'Parcial' }, { value: 'NO', label: 'No cumplida' }]} />
        <RatingScale name="rating" legend="¿Cómo fue tu experiencia?" value={rating} onChange={setRating} lowLabel="Muy mala" highLabel="Muy buena" /></div></Card>
    <Card as="section"><h2>Pasos y pestañas</h2><Stepper steps={['Datos', 'Capacidades', 'Disponibilidad']} current={1} />
      <Tabs label="Cierre de la actividad" tabs={[{ id: 'p', label: 'Participación', panel: <p>Contenido de participación.</p> }, { id: 'r', label: 'Resultado', panel: <p>Contenido del resultado.</p> }, { id: 'e', label: 'Evidencias', panel: <p>Contenido de evidencias.</p> }]} /></Card>
    <Card as="section"><h2>Tabla, lista de datos y línea de tiempo</h2>
      <DataTable caption="Participación" rows={rows} rowKey={row => row.id} highlight={row => !row.ok} columns={[{ key: 'who', header: 'Persona', render: row => <span className="gallery-person"><Avatar name={row.who} size="sm" />{row.who}</span> }, { key: 'part', header: 'Participación', render: row => <StatusBadge tone="ok">{row.part}</StatusBadge> }, { key: 'hours', header: 'Horas', render: row => row.hours }, { key: 'ver', header: 'Verificación', render: row => <StatusBadge tone={row.ok ? 'ok' : 'wait'}>{row.ok ? 'Verificada' : 'Pendiente'}</StatusBadge> }]} />
      <DefinitionList items={[{ icon: 'calendar', term: 'Fecha', children: '24 oct. 2026' }, { icon: 'pin', term: 'Territorio', children: 'Belén, Medellín' }, { icon: 'people', term: 'Cupos', children: '2 de 6 disponibles' }]} />
      <Timeline label="Trazabilidad" items={[{ id: 'a', title: 'Organización aprobada', meta: 'Por Equipo Hila · 10 oct. 2026', tone: 'ok', icon: 'checkCircle' }, { id: 'b', title: 'Necesidad publicada', meta: 'Por Ana G. · 12 oct. 2026', tone: 'wait' }, { id: 'c', title: 'Compromiso confirmado', meta: 'Por Carlos M.', tone: 'no', icon: 'people' }, { id: 'd', title: 'Horas verificadas', tone: 'plum' }]} /></Card>
    <Card as="section"><BackLink to="/">Volver al inicio</BackLink><EmptyState title="Tu perfil está listo">Aún no hay oportunidades publicadas.</EmptyState></Card>
  </div>
}
