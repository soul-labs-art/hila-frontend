// Datos ficticios de las operaciones planned del contrato: catálogos, capacidades, actividades y su seguimiento.
// Las fechas son relativas al momento en que se crea el estado (nunca fijas). Retirar cuando el backend las implemente.
import type { Schemas } from '../client'
import { accountId, ids, orgId, seedId } from './seed'
import { samplePdf, samplePng } from './samples'
import type { Capacities, EvidenceRecord, NeedRecord, State } from './types'

type Skill = [slug: string, name: string, category: string, active: boolean]
const skills: Skill[] = [
  ['facilitacion-comunitaria', 'Facilitación comunitaria', 'Comunitario', true], ['mediacion-de-conflictos', 'Mediación de conflictos', 'Comunitario', true],
  ['acompanamiento-adultos-mayores', 'Acompañamiento a adultos mayores', 'Cuidado', true], ['recreacion-infantil', 'Recreación infantil', 'Cuidado', true],
  ['acompanamiento-escolar', 'Acompañamiento escolar', 'Educación', true], ['refuerzo-lectoescritura', 'Refuerzo de lectoescritura', 'Educación', true],
  ['diseno-grafico', 'Diseño gráfico', 'Comunicación', true], ['fotografia-documental', 'Fotografía documental', 'Comunicación', true],
  ['redaccion-y-correccion', 'Redacción y corrección de textos', 'Comunicación', true], ['edicion-de-video', 'Edición de video', 'Comunicación', true],
  ['contabilidad-basica', 'Contabilidad básica', 'Administración', true], ['gestion-de-proyectos', 'Gestión de proyectos', 'Administración', true],
  ['cocina-para-grupos', 'Cocina para grupos', 'Alimentación', true], ['primeros-auxilios', 'Primeros auxilios', 'Salud', true],
  ['huertas-urbanas', 'Huertas urbanas', 'Ambiente', true], ['manejo-de-residuos', 'Separación y aprovechamiento de residuos', 'Ambiente', true],
  ['programacion-web', 'Programación web', 'Tecnología', true], ['soporte-informatico-basico', 'Soporte informático básico', 'Tecnología', true],
  ['traduccion-ingles-espanol', 'Traducción inglés-español', 'Idiomas', true], ['lengua-de-senas-colombiana', 'Lengua de señas colombiana (LSC)', 'Idiomas', true],
  ['carpinteria-basica', 'Carpintería básica', 'Oficios', true], ['digitacion-en-maquina-de-escribir', 'Digitación en máquina de escribir', 'Administración', false],
]
const resources: Skill[] = [
  ['salon-comunal', 'Salón comunal o aula', 'Espacios', true], ['proyector', 'Proyector de video', 'Equipos', true], ['transporte-propio', 'Transporte propio (moto o carro)', 'Movilidad', true],
  ['herramientas-de-jardineria', 'Herramientas de jardinería', 'Herramientas', true], ['computador-portatil', 'Computador portátil', 'Equipos', true], ['camara-fotografica', 'Cámara fotográfica', 'Equipos', true],
  ['equipo-de-sonido', 'Equipo de sonido', 'Equipos', true], ['carpa-o-toldo', 'Carpa o toldo', 'Espacios', true], ['botiquin', 'Botiquín de primeros auxilios', 'Salud', true],
  ['mesas-y-sillas', 'Mesas y sillas plegables', 'Mobiliario', true], ['conexion-a-internet', 'Conexión a internet estable', 'Equipos', true], ['linea-telefonica-prestada', 'Línea telefónica fija prestada', 'Equipos', false],
]

// Fecha a una hora de Bogotá (UTC-5, sin horario de verano) a `days` días de hoy; `hours` mueve desde este instante.
const at = (days: number, time: string) => { const [h, m] = time.split(':').map(Number), now = new Date(); return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + days, h + 5, m)).toISOString() }
const from = (hours: number) => new Date(Date.now() + hours * 3_600_000).toISOString()
const weekdays = (days: number[], start: string, end: string): Schemas['AvailabilitySlot'][] => days.map(weekday => ({ weekday, startsAt: start, endsAt: end }))

export function plannedSeed(state: State): State {
  const sid = (group: number, n: number) => seedId(group, n), terr = (n: number) => seedId(0xc, n)
  const skillId = (slug: string) => state.skills.find(item => item.slug === slug)!.id, resourceId = (slug: string) => state.resources.find(item => item.slug === slug)!.id
  state.skills = skills.map(([slug, name, category, active], index) => ({ id: sid(0x11, index + 1), slug, name, category, active }))
  state.resources = resources.map(([slug, name, category, active], index) => ({ id: sid(0x12, index + 1), slug, name, category, active }))

  const capacities = (n: number, value: { skills: [string, Capacities['skills'][number]['proficiency'], number | null][]; availability: Schemas['AvailabilitySlot'][]; areas: number[]; resources: [string, string | null][] }) => {
    const account = state.accounts.find(item => item.id === accountId(n))!
    account.capacities = { skills: value.skills.map(([slug, proficiency, yearsExperience]) => ({ skillId: skillId(slug), proficiency, yearsExperience })), availability: value.availability,
      serviceAreas: value.areas.map(terr), resources: value.resources.map(([slug, details]) => ({ resourceId: resourceId(slug), details })) }
  }
  capacities(ids.valentina, { skills: [['facilitacion-comunitaria', 'ADVANCED', 8], ['huertas-urbanas', 'INTERMEDIATE', 3], ['acompanamiento-escolar', 'BASIC', 1], ['gestion-de-proyectos', 'INTERMEDIATE', 4]],
    availability: [...weekdays([6], '08:00', '13:00'), ...weekdays([3], '17:30', '20:00'), ...weekdays([7], '09:00', '12:00'), ...weekdays([5], '14:00', '18:00')], areas: [4, 6, 17, 13],
    resources: [['computador-portatil', 'Portátil personal con cargador'], ['herramientas-de-jardineria', 'Palas, azadones y guantes para unas seis personas']] })
  capacities(ids.sebastian, { skills: [['diseno-grafico', 'ADVANCED', 6], ['fotografia-documental', 'ADVANCED', 5], ['edicion-de-video', 'INTERMEDIATE', 2]], availability: [...weekdays([6], '09:00', '17:00'), ...weekdays([2, 4], '18:00', '21:00')], areas: [3, 2], resources: [['camara-fotografica', 'Cámara réflex con dos lentes'], ['computador-portatil', null]] })
  capacities(ids.daniela, { skills: [['primeros-auxilios', 'ADVANCED', 9], ['cocina-para-grupos', 'INTERMEDIATE', 5], ['acompanamiento-adultos-mayores', 'ADVANCED', 4]], availability: [...weekdays([6, 7], '07:00', '14:00'), ...weekdays([1], '14:00', '18:00')], areas: [2, 5], resources: [['botiquin', 'Botiquín completo y camilla plegable']] })
  capacities(ids.juan, { skills: [['programacion-web', 'ADVANCED', 7], ['soporte-informatico-basico', 'INTERMEDIATE', 4], ['redaccion-y-correccion', 'BASIC', null]], availability: [...weekdays([1, 2, 3, 4, 5], '19:00', '22:00'), ...weekdays([6], '09:00', '12:00')], areas: [5], resources: [['computador-portatil', null], ['conexion-a-internet', 'Fibra óptica en casa']] })

  const cause = (n: number, org: number, author: number, title: string, summary: string, description: string | null, status: Schemas['Cause']['status'], created: number): Schemas['Cause'] =>
    ({ id: sid(0xe, n), organizationId: orgId(org), title, summary, description, status, createdBy: accountId(author), createdAt: at(created, '09:00'), updatedAt: at(created, '09:00') })
  state.causes = [
    cause(1, ids.semillas, ids.valentina, 'Huertas escolares del sur del Valle de Aburrá', 'Acompañar a colegios de Envigado, Itagüí y Sabaneta en el montaje y cuidado de sus huertas.', 'Trabajamos con profesoras, estudiantes y familias para que cada colegio tenga una huerta que se cuide durante todo el año y sirva como aula abierta.', 'ACTIVE', -60),
    cause(2, ids.semillas, ids.valentina, 'Formación ambiental con familias', 'Talleres de reciclaje, siembra y cuidado del agua con familias de los barrios.', null, 'ACTIVE', -55),
    cause(3, ids.semillas, ids.andres, 'Compostaje comunitario', 'Montar puntos de compostaje en unidades residenciales y colegios.', 'Aún estamos definiendo los puntos y el calendario de vaciado.', 'DRAFT', -5),
    cause(4, ids.memoria, ids.hernan, 'Memoria barrial en Manrique', 'Recoger, conservar y compartir los relatos y las fotografías del barrio.', 'El archivo de Memoria Viva guarda más de dos mil fotografías de la comuna. Buscamos personas que ayuden a conversar, fotografiar, digitalizar y exponer.', 'ACTIVE', -50),
    cause(5, ids.memoria, ids.isabel, 'Acompañamiento a personas mayores', 'Espacios de lectura, juego y conversación con adultos mayores del barrio.', null, 'ACTIVE', -45),
    cause(6, ids.huerta, ids.camilo, 'Huerta comunitaria de San Javier', 'Cuidar la huerta y el archivo de historias de la Comuna 13.', null, 'DRAFT', -10),
  ]

  type Spec = { n: number; cause: number; author: number; status: Schemas['NeedStatus']; title: string; summary: string; description: string; outcomeText: string; modality: Schemas['NeedWrite']['modality']; start: string; end: string; territory: number | null; label: string | null; slots: number
    skills?: [string, boolean, Schemas['NeedSkillInput']['minimumProficiency']][]; resources?: [string, boolean, string | null][]; instructions?: string | null; conditions?: string | null; published?: number | null; outcome?: [Schemas['CloseNeedRequest']['outcomeStatus'], string, number] }
  const need = (spec: Spec): NeedRecord => ({ id: sid(0xf, spec.n), causeId: sid(0xe, spec.cause), title: spec.title, summary: spec.summary, description: spec.description, expectedOutcome: spec.outcomeText, modality: spec.modality, riskLevel: 'LOW',
    startsAt: spec.start, endsAt: spec.end, timezone: 'America/Bogota', territoryId: spec.territory ? terr(spec.territory) : null, publicLocationLabel: spec.label, conditions: spec.conditions ?? null, slotsRequired: spec.slots, status: spec.status,
    skills: (spec.skills ?? []).map(([slug, required, minimumProficiency]) => ({ skillId: skillId(slug), required, minimumProficiency })), resources: (spec.resources ?? []).map(([slug, required, details]) => ({ resourceId: resourceId(slug), required, details })),
    publishedAt: spec.status === 'DRAFT' ? null : at(spec.published ?? -14, '10:00'), closedAt: spec.outcome ? at(spec.outcome[2], '18:00') : null,
    outcome: spec.outcome ? { status: spec.outcome[0], summary: spec.outcome[1], verifiedBy: accountId(spec.author), verifiedAt: at(spec.outcome[2], '18:00') } : null, updatedAt: at(-3, '11:00'),
    privateLocationInstructions: spec.instructions ?? null, createdBy: accountId(spec.author), createdAt: at(spec.published ?? -20, '08:00') })
  state.needs = [
    need({ n: 1, cause: 1, author: ids.valentina, status: 'PUBLISHED', title: 'Jornada de siembra en la huerta de la I.E. El Manantial', summary: 'Sembramos lechuga, cilantro y fríjol con estudiantes de quinto en la huerta del colegio.', modality: 'IN_PERSON', start: at(10, '08:00'), end: at(10, '12:00'), territory: 4, label: 'Colegio El Manantial, Envigado', slots: 6,
      description: 'Preparamos las eras, sembramos con grupos de diez estudiantes y dejamos un calendario de riego. Necesitamos manos para acompañar a los grupos y explicar cada paso con paciencia.', outcomeText: 'Seis eras sembradas y un calendario de riego acordado con la profesora responsable.',
      skills: [['huertas-urbanas', true, 'BASIC'], ['facilitacion-comunitaria', false, null]], resources: [['herramientas-de-jardineria', false, 'Si tienes palas o guantes, tráelos.']], instructions: 'Entrada por la portería de la carrera 40. Pregunta por la profesora Marta Elena y lleva ropa que pueda ensuciarse.', conditions: 'Lleva agua, gorra y protector solar. Habrá refrigerio.' }),
    need({ n: 2, cause: 1, author: ids.andres, status: 'PUBLISHED', title: 'Armado de camas de cultivo con material reciclado', summary: 'Construimos camas elevadas con estibas recuperadas para la huerta de un jardín infantil.', modality: 'IN_PERSON', start: at(5, '14:00'), end: at(5, '17:00'), territory: 6, label: 'Jardín infantil La Lomita, Sabaneta', slots: 2,
      description: 'Con estibas recuperadas armamos dos camas de cultivo a la altura de las niñas y los niños. Buscamos dos personas con buena disposición para trabajar con herramientas básicas.', outcomeText: 'Dos camas armadas, rellenas y listas para sembrar.', skills: [['carpinteria-basica', false, 'BASIC']], instructions: 'Llegar por la entrada lateral del jardín, junto al parqueadero de motos.', published: -9 }),
    need({ n: 3, cause: 3, author: ids.andres, status: 'DRAFT', title: 'Taller de compostaje para familias del barrio', summary: 'Enseñar a separar residuos orgánicos y preparar una compostera casera.', modality: 'HYBRID', start: at(20, '15:00'), end: at(20, '17:00'), territory: 6, label: 'Sabaneta, por definir', slots: 10,
      description: 'Borrador del taller: una parte de teoría por videollamada y una práctica presencial con las familias en el patio de un conjunto residencial.', outcomeText: 'Quince familias con compostera en funcionamiento.', skills: [['manejo-de-residuos', true, 'BASIC']] }),
    need({ n: 4, cause: 2, author: ids.valentina, status: 'PUBLISHED', title: 'Taller de reciclaje creativo con familias', summary: 'Hacemos macetas y juguetes con material reciclado junto a niñas, niños y sus familias.', modality: 'IN_PERSON', start: from(-1), end: from(2), territory: 5, label: 'Salón comunal Santa María, Itagüí', slots: 3,
      description: 'Actividad en curso: mesas de trabajo con botellas, cartón y tela para que las familias creen macetas y juegos. Acompañamos a cada mesa.', outcomeText: 'Treinta macetas decoradas para sembrar en casa.', skills: [['recreacion-infantil', false, null]], instructions: 'Salón comunal del barrio Santa María, segundo piso.', published: -12 }),
    need({ n: 5, cause: 2, author: ids.valentina, status: 'CLOSED', title: 'Siembra de árboles nativos en la quebrada', summary: 'Sembramos cuarenta árboles nativos con vecinas y vecinos para proteger el borde de la quebrada.', modality: 'IN_PERSON', start: at(-20, '14:00'), end: at(-20, '17:00'), territory: 4, label: 'Quebrada La Ayurá, Envigado', slots: 3,
      description: 'Jornada de siembra y cuidado de la ribera con herramientas aportadas por la fundación.', outcomeText: 'Cuarenta árboles nativos sembrados y marcados.', skills: [['huertas-urbanas', false, null]], published: -35, outcome: ['FULFILLED', 'Sembramos los cuarenta árboles previstos y dejamos un grupo de vecinas encargado del riego.', -19] }),
    need({ n: 6, cause: 1, author: ids.valentina, status: 'PUBLISHED', title: 'Jornada de limpieza y mantenimiento de la huerta', summary: 'Desyerbamos, abonamos y arreglamos el sistema de riego de una huerta escolar.', modality: 'IN_PERSON', start: at(-2, '08:00'), end: at(-2, '12:00'), territory: 4, label: 'Colegio El Manantial, Envigado', slots: 2,
      description: 'La jornada ya terminó y falta registrar la participación de quienes confirmaron para poder cerrar la necesidad.', outcomeText: 'Huerta limpia y riego funcionando.', instructions: 'Entrada por la portería de la carrera 40.', published: -16 }),
    need({ n: 7, cause: 1, author: ids.valentina, status: 'CANCELLED', title: 'Feria de semillas del sur del Valle (aplazada)', summary: 'Intercambio de semillas criollas entre familias cultivadoras.', modality: 'IN_PERSON', start: at(15, '09:00'), end: at(15, '13:00'), territory: 4, label: 'Parque principal de Envigado', slots: 8,
      description: 'La feria se aplazó por una alerta de lluvias. Publicaremos una nueva fecha.', outcomeText: 'Cien familias intercambiando semillas.', published: -10 }),
    need({ n: 8, cause: 4, author: ids.isabel, status: 'PUBLISHED', title: 'Taller de memoria barrial: relatos de vecinas de Manrique', summary: 'Conversamos con vecinas mayores y registramos sus relatos con fotografías y grabaciones.', modality: 'IN_PERSON', start: at(6, '09:00'), end: at(6, '13:00'), territory: 13, label: 'Casa de la cultura de Manrique', slots: 8,
      description: 'En parejas, una persona conversa y otra fotografía. Al final armamos un mural con los relatos. Necesitamos gente con escucha y cuidado al fotografiar.', outcomeText: 'Veinte relatos registrados y un mural colectivo.', skills: [['fotografia-documental', true, 'BASIC'], ['facilitacion-comunitaria', false, null]], resources: [['camara-fotografica', false, 'Una cámara o un celular con buena cámara.']], instructions: 'Entrar por la puerta azul de la Casa de la cultura; pregunta por Isabel.', conditions: 'Habrá almuerzo para quienes participen toda la jornada.' }),
    need({ n: 9, cause: 5, author: ids.isabel, status: 'PUBLISHED', title: 'Tardes de lectura y juegos con adultos mayores', summary: 'Leemos en voz alta, jugamos dominó y conversamos con personas mayores del barrio.', modality: 'IN_PERSON', start: at(14, '14:00'), end: at(14, '17:00'), territory: 18, label: 'Hogar de mayores, Santo Domingo Savio', slots: 4,
      description: 'Compartimos una tarde tranquila con personas mayores: lectura, juegos de mesa y música. Buscamos personas pacientes y con gusto por conversar.', outcomeText: 'Una tarde de compañía para veinte personas mayores.', skills: [['acompanamiento-adultos-mayores', true, 'BASIC']], published: -7 }),
    need({ n: 10, cause: 4, author: ids.hernan, status: 'PUBLISHED', title: 'Apoyo remoto con tareas escolares', summary: 'Acompañamos por videollamada a niñas y niños de primaria con sus tareas de lectura y matemáticas.', modality: 'REMOTE', start: at(4, '16:00'), end: at(4, '18:00'), territory: null, label: null, slots: 10,
      description: 'Sesiones de una hora por videollamada con grupos pequeños. Se necesita conexión estable y paciencia para explicar de varias maneras.', outcomeText: 'Veinte niñas y niños con las tareas de la semana al día.', skills: [['acompanamiento-escolar', true, 'BASIC'], ['refuerzo-lectoescritura', false, null]], resources: [['conexion-a-internet', true, null]], instructions: 'Te enviaremos el enlace de la videollamada el día anterior.', published: -6 }),
    need({ n: 11, cause: 4, author: ids.isabel, status: 'PUBLISHED', title: 'Jornada de reciclaje en la plaza de Manrique', summary: 'Instalamos puntos de separación y explicamos a vecinas y comerciantes cómo usarlos.', modality: 'IN_PERSON', start: at(3, '08:00'), end: at(3, '12:00'), territory: 13, label: 'Plaza principal de Manrique', slots: 12,
      description: 'Montamos puntos de separación en la plaza, repartimos volantes y conversamos con quienes pasan. Hay que estar de pie y caminar bastante.', outcomeText: 'Cinco puntos de separación instalados y cien volantes entregados.', skills: [['manejo-de-residuos', false, null]], resources: [['carpa-o-toldo', false, null]], instructions: 'Encuentro en la plaza principal, junto a la fuente. Busca la carpa verde de Memoria Viva y pregunta por Isabel (cel. 300 000 0000, número de ejemplo).', published: -8 }),
    need({ n: 12, cause: 4, author: ids.hernan, status: 'PUBLISHED', title: 'Digitalización de fotografías del archivo barrial', summary: 'Escaneamos y describimos fotografías antiguas del barrio desde casa.', modality: 'REMOTE', start: at(12, '15:00'), end: at(12, '18:00'), territory: null, label: null, slots: 5,
      description: 'Te compartimos un álbum digital en baja resolución para que describas lugares, personas y fechas probables. No necesitas salir de casa.', outcomeText: 'Cuatrocientas fotografías descritas.', skills: [['redaccion-y-correccion', true, 'BASIC']], published: -5 }),
    need({ n: 13, cause: 5, author: ids.isabel, status: 'PUBLISHED', title: 'Cartografía social con jóvenes del barrio', summary: 'Dibujamos con jóvenes un mapa de los lugares que más quieren y los que les preocupan.', modality: 'IN_PERSON', start: at(8, '15:00'), end: at(8, '18:00'), territory: 2, label: 'Biblioteca de barrio, Medellín', slots: 6,
      description: 'Tres horas de mapas, marcadores y conversación con jóvenes de colegios cercanos.', outcomeText: 'Un mapa comunitario con veinte lugares marcados.', skills: [['facilitacion-comunitaria', true, 'INTERMEDIATE']], published: -4 }),
    need({ n: 14, cause: 4, author: ids.hernan, status: 'CLOSED', title: 'Exposición fotográfica en la biblioteca del barrio', summary: 'Montamos una exposición con las fotografías del archivo barrial y recibimos a las vecinas.', modality: 'IN_PERSON', start: at(-15, '09:00'), end: at(-15, '14:00'), territory: 13, label: 'Biblioteca de Manrique', slots: 4,
      description: 'Colgamos sesenta fotografías, preparamos fichas con los relatos y acompañamos la visita de las vecinas.', outcomeText: 'Una exposición abierta durante una semana.', skills: [['fotografia-documental', false, null]], published: -30, outcome: ['PARTIAL', 'Montamos la exposición y recibimos visitas, pero faltó tiempo para grabar los relatos de las fichas.', -14] }),
    need({ n: 15, cause: 4, author: ids.isabel, status: 'DRAFT', title: 'Taller de escritura de relatos barriales', summary: 'Escribimos en grupo los relatos que quedaron grabados en el archivo.', modality: 'IN_PERSON', start: at(25, '09:00'), end: at(25, '12:00'), territory: 13, label: 'Manrique, por definir', slots: 6,
      description: 'Borrador del taller de escritura: aún falta confirmar el espacio.', outcomeText: 'Diez relatos escritos y revisados.', skills: [['redaccion-y-correccion', true, 'INTERMEDIATE']] }),
    need({ n: 16, cause: 6, author: ids.camilo, status: 'DRAFT', title: 'Jornada de siembra en la huerta comunitaria', summary: 'Sembramos plantas medicinales y hortalizas con vecinas y vecinos de San Javier.', modality: 'IN_PERSON', start: at(18, '08:00'), end: at(18, '12:00'), territory: 15, label: 'Comuna 13, San Javier', slots: 8,
      description: 'Borrador mientras la organización espera su revisión: una mañana de siembra en la huerta comunitaria.', outcomeText: 'Cuatro eras sembradas con plantas medicinales.', skills: [['huertas-urbanas', true, 'BASIC']] }),
  ]

  const app = (n: number, needN: number, volunteer: number, status: Schemas['ApplicationStatus'], commitment: Schemas['CommitmentStatus'], appliedDay: number, extra: Partial<Schemas['Application']> = {}): Schemas['Application'] => {
    const decided = status === 'ACCEPTED' || status === 'REJECTED', confirmed = commitment === 'CONFIRMED' || commitment === 'COMPLETED' || commitment === 'NO_SHOW'
    return { id: sid(0x10, n), needId: sid(0xf, needN), volunteerId: accountId(volunteer), status, commitmentStatus: commitment, message: null, decisionReason: null, appliedAt: at(appliedDay, '19:30'), decidedAt: decided ? at(appliedDay + 1, '10:00') : null,
      confirmedAt: confirmed ? at(appliedDay + 2, '08:30') : null, finishedAt: null, cancellationReason: null, ...extra }
  }
  state.applications = [
    app(1, 1, ids.sebastian, 'APPLIED', 'NOT_CONFIRMED', -2, { message: 'Tengo experiencia sembrando en terraza y me gusta trabajar con estudiantes.' }),
    app(2, 1, ids.daniela, 'ACCEPTED', 'NOT_CONFIRMED', -4),
    app(3, 1, ids.juan, 'ACCEPTED', 'CONFIRMED', -6),
    app(4, 2, ids.sebastian, 'ACCEPTED', 'CONFIRMED', -5), app(5, 2, ids.daniela, 'ACCEPTED', 'CONFIRMED', -5), app(6, 2, ids.juan, 'ACCEPTED', 'NOT_CONFIRMED', -4, { message: 'Puedo ayudar con la carpintería básica.' }),
    app(7, 4, ids.daniela, 'ACCEPTED', 'CONFIRMED', -8),
    app(8, 5, ids.sebastian, 'ACCEPTED', 'COMPLETED', -28, { finishedAt: at(-19, '09:00') }), app(9, 5, ids.daniela, 'ACCEPTED', 'NO_SHOW', -28, { finishedAt: at(-19, '09:00') }),
    app(10, 6, ids.juan, 'ACCEPTED', 'CONFIRMED', -12),
    app(11, 7, ids.sebastian, 'ACCEPTED', 'CANCELLED', -8, { confirmedAt: at(-6, '08:30'), finishedAt: at(-3, '11:00'), cancellationReason: 'La feria se aplazó por una alerta de lluvias.' }),
    app(12, 8, ids.valentina, 'ACCEPTED', 'NOT_CONFIRMED', -3, { message: 'Soy trabajadora social y he facilitado talleres de memoria con vecinas mayores.' }), app(13, 8, ids.sebastian, 'ACCEPTED', 'CONFIRMED', -4),
    app(14, 9, ids.valentina, 'APPLIED', 'NOT_CONFIRMED', -1, { message: 'Me gustaría acompañar las tardes de lectura.' }), app(15, 9, ids.daniela, 'ACCEPTED', 'NOT_CONFIRMED', -3),
    app(16, 10, ids.juan, 'APPLIED', 'NOT_CONFIRMED', -2),
    app(17, 11, ids.valentina, 'ACCEPTED', 'CONFIRMED', -5),
    app(18, 12, ids.valentina, 'WITHDRAWN', 'NOT_CONFIRMED', -3, { finishedAt: at(-2, '20:00') }),
    app(19, 13, ids.valentina, 'REJECTED', 'NOT_CONFIRMED', -4, { decisionReason: 'Priorizamos a personas del barrio para este taller.' }),
    app(20, 14, ids.valentina, 'ACCEPTED', 'COMPLETED', -24, { finishedAt: at(-14, '09:00') }),
  ]
  const part = (n: number, application: number, attendance: Schemas['Participation']['attendance'], hours: number, status: Schemas['Participation']['status'], recordedBy: number, verifiedBy: number | null, notes: string | null): Schemas['Participation'] =>
    ({ id: sid(0x13, n), applicationId: sid(0x10, application), actualHours: hours, notes, attendance, status, recordedBy: accountId(recordedBy), verifiedBy: verifiedBy ? accountId(verifiedBy) : null, recordedAt: at(-19, '09:00'), verifiedAt: verifiedBy ? at(-18, '09:00') : null })
  state.participations = [
    part(1, 8, 'COMPLETED', 3, 'VERIFIED', ids.valentina, ids.andres, 'Sembró y marcó doce árboles.'), part(2, 9, 'NO_SHOW', 0, 'VERIFIED', ids.valentina, ids.andres, null),
    part(3, 20, 'COMPLETED', 4.5, 'VERIFIED', ids.hernan, ids.isabel, 'Armó las fichas de la exposición y atendió la visita guiada.'),
  ]
  state.participations[2].recordedAt = at(-14, '09:00'); state.participations[2].verifiedAt = at(-13, '09:00')
  const file = (n: number, target: Pick<EvidenceRecord, 'needId' | 'participationId'>, name: string, type: EvidenceRecord['mediaType'], by: number, day: number): EvidenceRecord => {
    const dataUrl = type === 'application/pdf' ? samplePdf('Evidencia de ejemplo - Hila') : samplePng()
    return { id: sid(0x14, n), ...target, originalFilename: name, mediaType: type, sizeBytes: atob(dataUrl.slice(dataUrl.indexOf(',') + 1)).length, uploadedBy: accountId(by), uploadedAt: at(day, '16:00'), dataUrl }
  }
  state.evidence = [
    file(1, { needId: sid(0xf, 5), participationId: null }, 'acta-cierre-siembra.pdf', 'application/pdf', ids.valentina, -18),
    file(2, { needId: null, participationId: sid(0x13, 1) }, 'foto-jornada-siembra.png', 'image/png', ids.valentina, -18),
    file(3, { needId: null, participationId: sid(0x13, 3) }, 'certificado-de-horas.pdf', 'application/pdf', ids.isabel, -13),
  ]
  state.feedback = [
    { id: sid(0x15, 1), applicationId: sid(0x10, 20), authorUserId: accountId(ids.valentina), targetUserId: null, targetOrganizationId: orgId(ids.memoria), rating: 5, comment: 'Nos recibieron con mucho cariño y todo estaba bien organizado.', createdAt: at(-12, '10:00') },
    { id: sid(0x15, 2), applicationId: sid(0x10, 20), authorUserId: accountId(ids.isabel), targetUserId: accountId(ids.valentina), targetOrganizationId: null, rating: 4, comment: 'Muy buena escucha con las vecinas. Para la próxima, llegar un poco antes.', createdAt: at(-12, '11:00') },
  ]
  const note = (n: number, user: number, type: Schemas['Notification']['type'], title: string, body: string, resourceType: Schemas['Notification']['resourceType'], resource: string | null, ago: number, read: boolean): State['notifications'][number] =>
    ({ id: sid(0x16, n), userId: accountId(user), type, title, body, resourceType, resourceId: resource, createdAt: from(-ago), readAt: read ? from(-ago + 1) : null })
  const appRef = (n: number) => sid(0x10, n), needRef = (n: number) => sid(0xf, n)
  state.notifications = [
    note(1, ids.valentina, 'APPLICATION_DECIDED', 'Aceptaron tu postulación', 'Te aceptaron en «Taller de memoria barrial: relatos de vecinas de Manrique». Confirma tu compromiso si puedes asistir: aceptar no reserva el cupo.', 'APPLICATION', appRef(12), 20, false),
    note(2, ids.valentina, 'APPLICATION_RECEIVED', 'Recibiste una postulación', 'Sebastián Villa Montoya se postuló a «Jornada de siembra en la huerta de la I.E. El Manantial».', 'APPLICATION', appRef(1), 30, false),
    note(3, ids.valentina, 'NEED_UPDATED', 'Cambió una actividad a la que te postulaste', '«Jornada de reciclaje en la plaza de Manrique» cambió su punto de encuentro. Revisa las instrucciones.', 'NEED', needRef(11), 50, false),
    note(4, ids.valentina, 'APPLICATION_DECIDED', 'Respondieron a tu postulación', 'Esta vez no seguirán con tu postulación a «Cartografía social con jóvenes del barrio». Motivo: Priorizamos a personas del barrio para este taller.', 'APPLICATION', appRef(19), 96, true),
    note(5, ids.valentina, 'PARTICIPATION_VERIFIED', 'Verificaron tus horas', 'Tus horas en «Exposición fotográfica en la biblioteca del barrio» quedaron verificadas.', 'PARTICIPATION', sid(0x13, 3), 310, true),
    note(6, ids.daniela, 'APPLICATION_DECIDED', 'Aceptaron tu postulación', 'Te aceptaron en «Jornada de siembra en la huerta de la I.E. El Manantial». Confirma tu compromiso si puedes asistir.', 'APPLICATION', appRef(2), 70, false),
    note(7, ids.daniela, 'NEW_OPPORTUNITY', 'Hay una actividad que podría interesarte', 'Corporación Memoria Viva Manrique publicó «Tardes de lectura y juegos con adultos mayores».', 'NEED', needRef(9), 160, false),
    note(8, ids.sebastian, 'COMMITMENT_CANCELLED', 'Cancelaron tu compromiso', 'La organización canceló tu participación en «Feria de semillas del sur del Valle (aplazada)». Motivo: La feria se aplazó por una alerta de lluvias.', 'APPLICATION', appRef(11), 72, true),
    note(9, ids.sebastian, 'PARTICIPATION_VERIFIED', 'Verificaron tus horas', 'Tus horas en «Siembra de árboles nativos en la quebrada» quedaron verificadas.', 'PARTICIPATION', sid(0x13, 1), 430, true),
    note(10, ids.juan, 'APPLICATION_DECIDED', 'Aceptaron tu postulación', 'Te aceptaron en «Armado de camas de cultivo con material reciclado». Confirma tu compromiso si puedes asistir: aceptar no reserva el cupo.', 'APPLICATION', appRef(6), 90, false),
    note(11, ids.andres, 'APPLICATION_RECEIVED', 'Recibiste una postulación', 'Juan Esteban Arango Vélez se postuló a «Armado de camas de cultivo con material reciclado».', 'APPLICATION', appRef(6), 100, false),
    note(12, ids.andres, 'APPLICATION_RECEIVED', 'Recibiste una postulación', 'Sebastián Villa Montoya se postuló a «Jornada de siembra en la huerta de la I.E. El Manantial».', 'APPLICATION', appRef(1), 30, false),
    note(13, ids.isabel, 'APPLICATION_RECEIVED', 'Recibiste una postulación', 'Valentina Restrepo Ochoa se postuló a «Tardes de lectura y juegos con adultos mayores».', 'APPLICATION', appRef(14), 24, true),
    note(14, ids.hernan, 'ORGANIZATION_REVIEWED', 'Aprobaron tu organización', 'Corporación Memoria Viva Manrique fue aprobada. Ya puedes activar causas y publicar necesidades.', 'ORGANIZATION', orgId(ids.memoria), 1900, true),
    note(15, ids.camilo, 'ORGANIZATION_REVIEWED', 'Revisaron tu organización', 'Corporación Camino Nuevo Itagüí necesita información adicional. Entra para ver el motivo y reenviar la solicitud.', 'ORGANIZATION', orgId(ids.caminoNuevo), 1500, false),
  ]
  const log = (n: number, actor: number | null, action: string, type: string, resource: string | null, ago: number) => ({ id: sid(0x17, n), actorUserId: actor ? accountId(actor) : null, action, resourceType: type, resourceId: resource, occurredAt: from(-ago) })
  state.audit = [
    log(1, ids.valentina, 'ORGANIZATION_SUBMITTED', 'ORGANIZATION', orgId(ids.semillas), 2900), log(2, ids.admin, 'ORGANIZATION_APPROVED', 'ORGANIZATION', orgId(ids.semillas), 2600), log(3, ids.hernan, 'ORGANIZATION_SUBMITTED', 'ORGANIZATION', orgId(ids.memoria), 2200),
    log(4, ids.admin, 'ORGANIZATION_APPROVED', 'ORGANIZATION', orgId(ids.memoria), 1900), log(5, ids.admin, 'ORGANIZATION_REJECTED', 'ORGANIZATION', orgId(ids.caminoNuevo), 1500), log(6, ids.valentina, 'NEED_PUBLISHED', 'NEED', needRef(5), 840),
    log(7, ids.valentina, 'NEED_CLOSED', 'NEED', needRef(5), 450), log(8, ids.isabel, 'PARTICIPATION_VERIFIED', 'PARTICIPATION', sid(0x13, 3), 310), log(9, ids.admin, 'ACCOUNT_SUSPENDED', 'USER', accountId(ids.natalia), 240),
    log(10, ids.isabel, 'NEED_PUBLISHED', 'NEED', needRef(8), 170), log(11, ids.valentina, 'APPLICATION_SUBMITTED', 'APPLICATION', appRef(12), 72), log(12, ids.isabel, 'APPLICATION_ACCEPTED', 'APPLICATION', appRef(12), 48),
    log(13, ids.valentina, 'COMMITMENT_CONFIRMED', 'APPLICATION', appRef(17), 100), log(14, ids.andres, 'NEED_CANCELLED', 'NEED', needRef(7), 72), log(15, ids.admin, 'CATALOG_SKILL_UPDATED', 'SKILL', skillId('digitacion-en-maquina-de-escribir'), 36),
  ]
  return state
}
