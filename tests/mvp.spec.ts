import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { crc32 } from 'node:zlib'
import type { components } from '../src/api/schema'
import { login, password, register } from './accounts-fixtures'

type Schemas = components['schemas']
const adminEmail = process.env.E2E_ADMIN_EMAIL
const adminPassword = process.env.E2E_ADMIN_PASSWORD
const evidenceLimit = 20 * 1024 * 1024

async function csrf(page: Page) {
  const response = await page.request.get('/api/v1/auth/csrf')
  await expect(response).toBeOK()
  const token: Schemas['CsrfToken'] = await response.json()
  return { [token.headerName]: token.token }
}

async function api<T>(page: Page, path: string, method = 'GET', data?: object): Promise<T> {
  const response = await page.request.fetch('/api/v1' + path, {
    method, data, headers: method === 'GET' ? undefined : await csrf(page),
  })
  await expect(response).toBeOK()
  return response.json()
}

async function saveProfile(page: Page) {
  await api(page, '/me/volunteer-profile', 'PUT', {
    biography: 'Perfil sintético de una persona voluntaria.', profession: null,
    educationLevel: null, preferredModality: 'REMOTE',
  } satisfies Schemas['VolunteerProfileUpdate'])
}

// Añade un bloque auxiliar válido antes de IEND, manteniendo el PNG original.
function pngOfSize(original: Buffer, size: number) {
  const iend = original.length - 12
  const text = Buffer.alloc(size - original.length - 12, 0x61)
  text.write('hila-fixture\0', 'ascii')
  const type = Buffer.from('tEXt')
  const length = Buffer.alloc(4)
  length.writeUInt32BE(text.length)
  const checksum = Buffer.alloc(4)
  checksum.writeUInt32BE(crc32(text, crc32(type)))
  return Buffer.concat([original.subarray(0, iend), length, type, text, checksum, original.subarray(iend)])
}

test('MVP real: convocatoria pública, último cupo, asistencia y evidencias privadas', async ({ page, browser, baseURL }) => {
  test.skip(!adminEmail || !adminPassword, 'Configura una cuenta ADMIN local para aprobar la organización.')
  test.setTimeout(300_000)
  const stamp = Date.now()
  const organizerEmail = 'mvp-organizacion-' + stamp + '@example.test'
  const volunteerEmail = 'mvp-voluntario-' + stamp + '@example.test'
  const organizerContext = await browser.newContext({ baseURL })
  const adminContext = await browser.newContext({ baseURL })
  const visitor = await browser.newContext({ baseURL })
  const organizer = await organizerContext.newPage()
  const admin = await adminContext.newPage()
  try {
    await page.goto('/explorar')
    await expect(page.getByRole('heading', { name: 'Aún no hay oportunidades publicadas' })).toBeVisible()
    await expect(page.getByRole('switch')).toHaveCount(0)
    await page.setViewportSize({ width: 320, height: 700 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320)
    await page.setViewportSize({ width: 1280, height: 720 })

    await register(organizer, organizerEmail, 'Representante de integración')
    await login(organizer, organizerEmail)
    await login(admin, adminEmail!, adminPassword!)
    await saveProfile(admin)
    await register(page, volunteerEmail, 'Voluntaria de integración')
    await login(page, volunteerEmail)
    await saveProfile(page)
    await page.goto('/mi-perfil?paso=disponibilidad')
    await expect(page.getByRole('heading', { name: 'Tu disponibilidad' })).toBeVisible()
    await page.getByRole('button', { name: 'Guardar disponibilidad' }).click()
    await expect(page.getByText('Tu disponibilidad quedó guardada.')).toBeVisible()
    await page.goto('/admin/catalogos')
    await expect(page.getByRole('heading', { name: 'Esta sección requiere acceso administrativo' })).toBeVisible()
    await page.context().clearCookies()

    const org = await api<Schemas['Organization']>(organizer, '/organizations', 'POST', {
      name: 'Colectivo de integración ' + stamp, organizationType: 'COLLECTIVE', legalIdentifier: null,
      description: 'Colectivo de prueba de integración.', verificationContext: 'Referencias sintéticas para la prueba.',
      publicEmail: null, publicWebsite: null, serviceTerritoryId: null,
    } satisfies Schemas['OrganizationWrite'])
    await api(admin, '/admin/organizations/' + org.id + '/reviews', 'POST', {
      decision: 'APPROVED', reason: 'Aprobación para la prueba local.',
    })
    await organizer.goto('/organizaciones/' + org.id + '/equipo')
    await expect(organizer.getByRole('button', { name: 'Añadir integrante' })).toBeVisible()
    await page.goto('/admin/catalogos')
    await expect(page).toHaveURL(/ingresar\?returnTo=/)
    for (const [route, heading] of [['catalogos', 'Catálogos'], ['usuarios', 'Usuarios'], ['trazabilidad', 'Trazabilidad']]) {
      await admin.goto('/admin/' + route)
      await expect(admin.getByRole('heading', { name: heading, exact: true })).toBeVisible()
      await expect(admin.getByRole('alert')).toHaveCount(0)
    }
    const cause = await api<Schemas['Cause']>(organizer, '/organizations/' + org.id + '/causes', 'POST', {
      title: 'Causa de integración', summary: 'Necesidades para comprobar la API.', description: null, status: 'ACTIVE',
    } satisfies Schemas['CauseWrite'])
    const starts = Math.ceil((Date.now() + 65_000) / 60_000) * 60_000
    const ends = starts + 60_000
    const need = await api<Schemas['ManagedNeed']>(organizer, '/causes/' + cause.id + '/needs', 'POST', {
      title: 'Actividad de integración ' + stamp, summary: 'Prueba de publicación y participación.',
      description: 'Descripción pública de prueba.', expectedOutcome: 'Publicar, participar y cerrar la actividad.',
      modality: 'REMOTE', riskLevel: 'LOW', startsAt: new Date(starts).toISOString(), endsAt: new Date(ends).toISOString(),
      timezone: 'America/Bogota', territoryId: null, publicLocationLabel: null, conditions: null, slotsRequired: 1,
      privateLocationInstructions: 'Indicaciones privadas para la persona confirmada.', skills: [], resources: [],
    } satisfies Schemas['NeedWrite'])
    const editor = '/organizaciones/' + org.id + '/necesidades/' + need.id
    const opportunity = '/explorar/' + need.id
    await organizer.goto(editor)
    await organizer.getByRole('button', { name: 'Publicar necesidad' }).click()
    await expect(organizer.getByText(/Publicamos tu necesidad/)).toBeVisible()

    await page.goto('/explorar')
    await page.getByRole('link', { name: 'Ver necesidad: ' + need.title }).click()
    await expect(page.getByRole('heading', { name: need.title })).toBeVisible()
    await expect(page.getByText(/Indicaciones privadas para/)).toHaveCount(0)
    await expect(page.getByRole('link', { name: org.name })).toHaveCount(0)
    await page.getByRole('link', { name: 'Ingresar para postularme' }).click()
    await login(page, volunteerEmail, password, opportunity)
    await expect(page.getByRole('heading', { name: 'Tu compatibilidad' })).toBeVisible()
    await page.getByRole('button', { name: 'Postularme' }).click()
    await page.getByRole('button', { name: 'Enviar postulación' }).click()
    const activity = page.getByRole('link', { name: 'Ver el estado en Mi actividad' })
    await expect(activity).toBeVisible()
    const activityPath = (await activity.getAttribute('href'))!
    const other = await api<Schemas['Application']>(admin, '/needs/' + need.id + '/applications', 'POST', { message: null })

    await organizer.goto('/avisos')
    await organizer.getByRole('link', { name: /Recibiste una postulación/ }).first().click()
    await expect(organizer).toHaveURL(/\/postulaciones\?postulacion=/)
    await organizer.goto(editor + '/postulaciones?postulacion=' + activityPath.split('/').pop())
    await organizer.getByRole('button', { name: 'Aceptar postulación' }).click()
    await expect(organizer.getByText(/Aceptaste la postulación de Voluntaria/)).toBeVisible()
    await organizer.goto(editor + '/postulaciones?postulacion=' + other.id)
    await organizer.getByRole('button', { name: 'Aceptar postulación' }).click()
    await expect(organizer.getByText(/Aceptaste la postulación/)).toBeVisible()

    await page.goto(activityPath)
    await page.getByRole('button', { name: 'Confirmar compromiso' }).click()
    await expect(page.getByText('Indicaciones privadas para la persona confirmada.')).toBeVisible()
    await admin.goto('/actividad/' + other.id)
    await admin.getByRole('button', { name: 'Confirmar compromiso' }).click()
    await expect(admin.getByRole('alert')).toContainText(/cupos.*completaron/i)
    const visitorPage = await visitor.newPage()
    await visitorPage.goto(opportunity)
    await expect(visitorPage.getByText('Los cupos de esta actividad están completos.')).toBeVisible()
    await expect(visitorPage.getByRole('link', { name: 'Ingresar para postularme' })).toHaveCount(0)

    const applications = await api<Schemas['ApplicationPage']>(page, '/me/applications')
    expect(applications.items.find(item => item.needId === need.id)?.commitmentStatus).toBe('CONFIRMED')
    await expect.poll(() => Date.now(), { timeout: 190_000, intervals: [2000], message: 'La actividad de prueba ya terminó en el servidor' }).toBeGreaterThan(ends + 1000)
    await organizer.goto(editor + '/cierre')
    await organizer.getByLabel('Horas dedicadas').fill('1.5')
    await organizer.getByRole('button', { name: 'Registrar participación', exact: true }).click()
    await organizer.getByRole('button', { name: 'Verificar horas', exact: true }).click()
    await organizer.getByRole('button', { name: 'Sí, verificar horas', exact: true }).click()
    await expect(organizer.getByText('Las horas están verificadas y ya no se pueden cambiar.')).toBeVisible()

    await organizer.goto(editor)
    await expect(organizer.getByLabel('Fecha *', { exact: true })).toBeDisabled()
    await organizer.getByLabel('Resumen corto *', { exact: true }).fill('Resumen actualizado tras verificar asistencia.')
    await organizer.getByRole('button', { name: 'Guardar cambios' }).click()
    await expect(organizer.getByText(/Guardamos los cambios/)).toBeVisible()
    await organizer.goto(editor + '/cierre')
    await organizer.getByRole('tab', { name: 'Resultado' }).click()
    await organizer.getByText('Cumplida', { exact: true }).click()
    await organizer.getByLabel('Resumen del resultado').fill('Resultado privado de la actividad de prueba.')
    await organizer.getByRole('button', { name: 'Guardar cierre' }).click()
    await expect(organizer.getByText('Registramos el resultado y cerramos la actividad.')).toBeVisible()
    await visitorPage.goto(opportunity)
    await expect(visitorPage.getByText('Resultado privado de la actividad de prueba.')).toHaveCount(0)

    const fileName = 'evidencia-integracion.png'
    const original = await readFile('public/brand/hila-emblema.png')
    const file = pngOfSize(original, evidenceLimit)
    await organizer.getByRole('tab', { name: 'Evidencias' }).click()
    const personal = organizer.getByRole('region', { name: 'De Voluntaria de integración' })
    await personal.getByLabel('Elegir archivo').setInputFiles({ name: fileName, mimeType: 'image/png', buffer: file })
    await personal.getByRole('button', { name: 'Adjuntar archivo' }).click()
    await expect(personal.getByRole('button', { name: 'Descargar ' + fileName })).toBeVisible({ timeout: 30_000 })

    const appId = activityPath.split('/').pop()
    const participation = await api<Schemas['Participation']>(page, '/applications/' + appId + '/participation')
    const evidencePath = '/participation/' + participation.id + '/evidence'
    const files = await api<Schemas['EvidencePage']>(page, evidencePath)
    expect(files.items[0].sizeBytes).toBe(evidenceLimit)
    const signed = await api<Schemas['EvidenceDownload']>(page, '/evidence/' + files.items[0].id + '/download-url')
    expect((await visitor.request.get(signed.url)).status()).toBe(401)

    await page.goto(activityPath)
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Descargar ' + fileName }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe(fileName)
    expect(await download.failure()).toBeNull()
    await page.getByRole('radio', { name: '5', exact: true }).check()
    await page.getByRole('button', { name: 'Enviar feedback' }).click()
    await expect(page.getByText('Enviaste tu feedback.')).toBeVisible()

    const tooLarge = await organizer.request.post('/api/v1' + evidencePath, {
      headers: await csrf(organizer), multipart: {
        file: { name: fileName, mimeType: 'image/png', buffer: pngOfSize(original, evidenceLimit + 1) },
      },
    })
    expect(tooLarge.status()).toBe(413)
    expect((await tooLarge.json()).code).toBe('FILE_TOO_LARGE')

    const teamPath = '/organizaciones/' + org.id + '/equipo'
    await organizer.goto(teamPath)
    await organizer.getByRole('button', { name: 'Añadir integrante' }).click()
    await organizer.getByLabel('Correo de la persona *', { exact: true }).fill(volunteerEmail)
    await organizer.getByRole('button', { name: 'Añadir al equipo' }).click()
    await expect(organizer.getByRole('row').filter({ hasText: 'Voluntaria de integración' })).toContainText('Coordinación')
    await page.goto(teamPath)
    await expect(page.getByRole('heading', { name: 'Equipo de la organización' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Añadir integrante' })).toHaveCount(0)
  } finally {
    await Promise.all([organizerContext.close(), adminContext.close(), visitor.close()])
  }
})
