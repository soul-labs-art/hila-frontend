# Integración con la API

El backend es dueño del contrato. La copia en [openapi/hila-v1.json](../openapi/hila-v1.json) permite generar [tipos TypeScript](../src/api/schema.d.ts) sin una API ejecutándose. OpenAPI 1.0.0 define las 95 operaciones del MVP como implementadas.

La fuente canónica y las reglas de sesión, transiciones y privacidad están en `hila-backend/openapi/hila-v1.json` y `hila-backend/docs/API_CONTRACT.md`. En GitHub: [contrato](https://github.com/soul-labs-art/hila-backend/blob/main/openapi/hila-v1.json) y [guía](https://github.com/soul-labs-art/hila-backend/blob/main/docs/API_CONTRACT.md).

## Actualizar los tipos

Con ambos repositorios uno al lado del otro, como en este workspace:

```sh
npm run api:sync
npm run api:check
npm run lint
npm run build
```

Para otro checkout del backend:

```sh
npm run api:sync -- /ruta/al/hila-backend/openapi/hila-v1.json
```

`api:sync` lee el contrato canónico, comprueba que sea autocontenido, genera tipos y actualiza la copia. No modifica el backend. `api:generate` regenera únicamente desde la copia local. `api:check` vuelve a generar en un directorio temporal y falla si hay diferencias; CI no necesita clonar el backend. La cabecera de los tipos registra el SHA-256 del contrato con saltos de línea LF.

Se usa `openapi-typescript@7.13.0` mediante `npm exec`, instalado en caché aislada con su compilador compatible. La herramienta declara un peer de TypeScript 5; el proyecto permanece en TypeScript 6. No usar `--force` ni cambiar el compilador del producto para generar los tipos. La primera generación y los runners nuevos necesitan conexión al registro npm. La herramienta no se incluye en el bundle de producción.

No editar a mano la copia ni los tipos. Cambiar primero el contrato del backend, revisar el impacto y sincronizar ambos repositorios. Mantener la versión del generador fija para que CI produzca el mismo resultado.

## Usar el contrato

```ts
import type { components, operations } from './api/schema'

type RegistrationRequest = components['schemas']['RegistrationRequest']
type ApiError = components['schemas']['ApiError']
type CurrentUser = operations['getCurrentUser']['responses'][200]['content']['application/json']
```

Los tipos describen compilación, no validan JSON recibido ni prueban que un endpoint exista. El cliente HTTP en `src/api/client.ts` maneja cookies, CSRF y errores; React Query, sesión y Router se configuran en `main.tsx`. Las escrituras no se reintentan automáticamente. Los tokens de verificación/recuperación se extraen del fragmento y se eliminan de la dirección visible.

## Reglas para el cliente y los formularios

- Prefijo `/api/v1`, rutas relativas y `credentials: 'include'`. El proxy local de Vite reenvía `/api` al backend configurado por `HILA_API_URL`. Nginx usa `API_UPSTREAM` y acepta solicitudes de hasta 21 MiB.
- Sesión mediante cookie `HttpOnly`, `SameSite=Lax`, `Secure` en producción. No guardar credenciales ni tokens de acceso en `localStorage`.
- Obtener `GET /auth/csrf` antes de cualquier escritura, incluidas las públicas, y enviar `X-CSRF-TOKEN` con la cookie. Renovar el token después de login/logout o expiración y conservarlo solo en memoria.
- Restaurar cuenta con `GET /me`; un `401` significa sesión ausente/vencida. Un `403` puede ser CSRF o permiso, y se distingue por `code`. No reintentar automáticamente una escritura tras un fallo de red.
- Leer políticas vigentes antes del registro o activar avisos; enviar su versión y consentimiento explícito. No precargar casillas de aceptación. Los contenidos legales aún están pendientes en backend.
- Registro y solicitudes de correo responden de forma genérica, evitando enumerar cuentas. Verificación y recuperación consumen el token por POST; las páginas `/verificar-correo` y `/restablecer-acceso` lo reciben en `#token=...`, limpian el fragmento y no lo envían a analítica.
- `GET /me/volunteer-profile` puede responder `404 PROFILE_NOT_FOUND` como estado inicial. Tener perfil no implica tener habilidades/horarios/zonas completos. Los avisos se gestionan por `/me/opportunity-alerts` para registrar su consentimiento.
- Errores: `{code, message, fieldErrors, traceId}`. Asociar `fieldErrors` al campo mediante `aria-invalid` y `aria-describedby`. El resumen de error usa `role="alert"` y recibe foco; la confirmación usa `role="status"`. Nunca inferir comportamiento a partir del texto de `message`.
- Leer el formulario con `FormData(event.currentTarget)`. `formValue` recorta espacios de los textos y `nullableValue` convierte opcionales vacíos a `null`; las contraseñas se leen directamente y conservan sus espacios. Cuando una operación necesita restablecer el formulario después de un `await`, capturar primero su elemento, como en la decisión administrativa.
- `PUT` sustituye todos los campos del DTO; `null` borra valores opcionales. Las colecciones de capacidades se sustituyen completas por rutas propias; arrays vacíos las limpian. No enviar `undefined` donde el esquema requiere un campo nullable.
- Listas de producto: paginación desde `page=0`, tamaño máximo 100 y envoltura `{items, page, size, totalElements, totalPages}`. Catálogo vacío es un estado normal; cupos agotados se muestran como tales.
- El servidor decide permisos, cupos y transiciones. Los roles y estados recibidos sirven para presentar acciones; ninguna comprobación de interfaz sustituye autorización.
- Las pantallas deben manejar carga, error, vacío y éxito. Datos de demostración solo en entornos explícitos de desarrollo; no anunciar registros ni convocatorias reales mientras estén pendientes.

## Pantallas del MVP

Explorar y el detalle de una oportunidad admiten visitas sin sesión. Postularse requiere cuenta verificada y perfil voluntario. Compatibilidad, gestión, instrucciones, seguimiento y evidencias usan los permisos del backend. Las áreas de trabajo se cargan de forma diferida.

| Área | Rutas | Bandera |
|---|---|---|
| Capacidades del voluntario | `/mi-perfil` (pasos Capacidades y Disponibilidad) | `capabilities` |
| Explorar y postularse | `/explorar`, `/explorar/:needId` | `opportunities`, `applications` |
| Mi actividad | `/actividad`, `/actividad/:applicationId` | `applications` |
| Avisos | `/avisos` | `notifications` |
| Causas y necesidades | `/organizaciones/:id/{causas,necesidades}`, `/necesidades/nueva`, `/necesidades/:needId` | `needs` |
| Postulaciones | `/organizaciones/:id/postulaciones`, `/necesidades/:needId/postulaciones` | `applications` |
| Participación y cierre | `/organizaciones/:id/participacion`, `/necesidades/:needId/cierre` | `participation` |
| Equipo | `/organizaciones/:id/equipo` | `team` |
| Administración | `/admin/{catalogos,usuarios,trazabilidad}` | `adminTools` |

## Recorridos y pruebas

El conjunto de Playwright cubre cuenta, correo, perfiles e imágenes, revisión de organizaciones, navegación móvil y el recorrido del MVP desde una convocatoria pública hasta asistencia, feedback y evidencias.

Los perfiles empiezan privados. La persona decide publicarlos; las organizaciones además requieren aprobación. Las vistas públicas no reciben campos privados. Un fallo en la carga de una imagen conserva la anterior. La vista previa usa el mismo recorte centrado que el servidor; no se permite SVG, GIF, HEIC ni formatos distintos de JPEG/PNG, y el cliente valida hasta 10 MiB y 16 megapíxeles.

Pruebas reales con PostgreSQL, API en 8080 y Mailpit en 8025 (iniciados desde el backend):

```powershell
npm ci
npx playwright install chromium
npm run test:e2e
```

CI ejecuta solo `npm run lint`, `npm run api:check` y `npm run build`; estas pruebas necesitan el backend y no corren en CI. Playwright inicia `npm run dev` si no hay un servidor en `127.0.0.1:5173`. Si defines `E2E_BASE_URL`, Playwright usa ese frontend ya iniciado. Usa esa opción para comprobar el límite de evidencia a través de Nginx y configura `WEB_ORIGIN` en el backend con ese mismo origen. `E2E_MAILPIT_URL` apunta por defecto a `http://127.0.0.1:8025`.

Las pruebas de revisión y del MVP requieren una cuenta administrativa de desarrollo ya verificada y habilitada mediante el comando interno documentado en backend:

```powershell
$env:E2E_ADMIN_EMAIL='admin-de-prueba@example.test'
$env:E2E_ADMIN_PASSWORD='contraseña local de la cuenta de prueba'
npm run test:e2e
```

No introducir credenciales reales en archivos. Sin estas variables se omiten los recorridos que requieren una aprobación administrativa. Las pruebas crean cuentas `example.test` y reciben enlaces mediante la API de Mailpit; no usan endpoints especiales de verificación ni escriben roles en PostgreSQL. Usa una base de desarrollo aislada con el catálogo de oportunidades vacío. Hila conserva sus límites de intentos, por lo que conviene partir de una base de pruebas nueva al repetir el conjunto en pocos minutos. El escenario del último cupo espera a que la actividad de prueba termine para registrar horas con la API real. Capturas, trazas y reportes quedan ignorados por Git.
