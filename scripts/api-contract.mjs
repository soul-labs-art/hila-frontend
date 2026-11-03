import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { mkdtemp, readFile, rm, rmdir, mkdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const snapshot = join(root, 'openapi/hila-v1.json')
const types = join(root, 'src/api/schema.d.ts')
const [mode = 'check', sourceArgument] = process.argv.slice(2)
const normalize = (value) => value.replace(/\r\n/g, '\n')

if (!['sync', 'generate', 'check'].includes(mode) || (sourceArgument && mode !== 'sync')) {
  throw new Error('Uso: npm run api:sync -- [ruta-del-contrato] | npm run api:generate | npm run api:check')
}

const source = mode === 'sync'
  ? resolve(root, sourceArgument ?? '../hila-backend/openapi/hila-v1.json')
  : snapshot
const contract = normalize(await readFile(source, 'utf8'))
const schema = JSON.parse(contract)
if (schema.openapi !== '3.0.3' || schema.servers?.[0]?.url !== '/api/v1') {
  throw new Error('Se esperaba el contrato Hila OpenAPI 3.0.3 bajo /api/v1.')
}

function checkLocalReferences(value) {
  if (!value || typeof value !== 'object') return
  if (typeof value.$ref === 'string' && !value.$ref.startsWith('#/')) {
    throw new Error('El contrato debe ser autocontenido: no se permiten referencias externas.')
  }
  for (const child of Object.values(value)) checkLocalReferences(child)
}
checkLocalReferences(schema)

// npm exec instala el generador con su TypeScript compatible en una caché aislada.
// El frontend conserva su versión de TypeScript y su árbol de dependencias.
const npmCli = process.env.npm_execpath
if (!npmCli) throw new Error('Ejecuta esta herramienta mediante los scripts npm del proyecto.')
const temporary = await mkdtemp(join(tmpdir(), 'hila-api-contract-'))
try {
  const temporaryContract = join(temporary, 'hila-v1.json')
  const temporaryTypes = join(temporary, 'schema.d.ts')
  await writeFile(temporaryContract, contract)
  const result = spawnSync(process.execPath, [npmCli, 'exec', '--yes',
    '--package=openapi-typescript@7.13.0', '--', 'openapi-typescript', temporaryContract,
    '--alphabetize', '--output', temporaryTypes], { cwd: root, encoding: 'utf8' })
  if (result.error) throw result.error
  if (result.status !== 0) {
    throw new Error(`No fue posible generar los tipos:\n${result.stderr}\n${result.stdout}`)
  }
  const hash = createHash('sha256').update(contract).digest('hex')
  const generated = '// Fuente: hila-backend/openapi/hila-v1.json. No editar manualmente.\n'
    + `// SHA-256 del contrato (LF): ${hash}\n`
    + normalize(await readFile(temporaryTypes, 'utf8'))
  if (mode === 'check') {
    const current = normalize(await readFile(types, 'utf8'))
    if (current !== generated) {
      throw new Error('Los tipos no coinciden con el contrato. Ejecuta npm run api:generate y revisa el diff.')
    }
    console.log(`Contrato y tipos sincronizados (${schema.info.version}, SHA-256 ${hash}).`)
  } else {
    await mkdir(dirname(types), { recursive: true })
    if (mode === 'sync') {
      await mkdir(dirname(snapshot), { recursive: true })
      await writeFile(snapshot, contract)
    }
    await writeFile(types, generated)
    console.log(`Tipos generados (${schema.info.version}, SHA-256 ${hash}).`)
  }
} finally {
  await rm(join(temporary, 'hila-v1.json'), { force: true })
  await rm(join(temporary, 'schema.d.ts'), { force: true })
  await rmdir(temporary)
}
