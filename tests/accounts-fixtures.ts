import { expect, type APIRequestContext, type Page } from '@playwright/test'

export const password = 'Una frase de pruebas 2026!'
const mailpit = process.env.E2E_MAILPIT_URL ?? 'http://127.0.0.1:8025'
export async function mailLink(request: APIRequestContext, email: string, purpose = 'verificar-correo') {
  let link = ''
  await expect.poll(async () => {
    const data = await (await request.get(`${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`)).json()
    for (const message of data.messages ?? []) {
      const body = await (await request.get(`${mailpit}/api/v1/message/${message.ID}`)).json()
      const found = `${body.Text ?? ''} ${body.HTML ?? ''}`.match(new RegExp(`https?://[^\\s<>"']+/${purpose}#token=[^\\s<>"']+`))
      if (found) { link = found[0]; return true }
    }
    return false
  }, { timeout: 30_000, message: `Correo ${purpose} entregado por outbox a Mailpit` }).toBe(true)
  return link
}
export async function register(page: Page, email: string, name: string) {
  await page.goto('/registro')
  await page.getByLabel('Tu nombre', { exact: true }).fill(name)
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(password)
  await page.getByRole('checkbox', { name: 'Soy mayor de 18 años.' }).check()
  await page.getByRole('checkbox', { name: /He leído y acepto/ }).check()
  await page.getByRole('button', { name: 'Crear mi cuenta', exact: true }).click()
  await expect(page).toHaveURL(/registro\/enviado$/)
  const url = await mailLink(page.request, email)
  await page.goto(url)
  await expect(page).not.toHaveURL(/#token=/)
  await page.getByRole('button', { name: 'Verificar mi correo', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Tu correo está verificado')
}
export async function login(page: Page, email: string, secret = password, target = '/mi-cuenta') {
  if (!new URL(page.url()).pathname.endsWith('/ingresar')) await page.goto('/ingresar')
  await page.getByLabel('Correo electrónico', { exact: true }).fill(email)
  await page.getByLabel('Contraseña', { exact: true }).fill(secret)
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click()
  await expect(page).toHaveURL(new URL(target, page.url()).href)
}
