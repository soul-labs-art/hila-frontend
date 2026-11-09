# Hila Frontend

Hila es una iniciativa de tecnología cívica que busca conectar las capacidades de las personas —su tiempo, conocimientos, oficios y recursos— con necesidades concretas de organizaciones y colectivos comunitarios. Está en preparación un piloto en Medellín y el Valle de Aburrá. La plataforma busca facilitar la coordinación y el seguimiento, con las organizaciones a cargo de decidir y acompañar sus actividades.

Este repositorio contiene la interfaz web de Hila, construida con React, TypeScript y Vite. La API, las reglas de negocio y la base de datos viven en [hila-backend](https://github.com/soul-labs-art/hila-backend).

## Responsabilidad y estado

Este proyecto es dueño de la presentación, navegación, accesibilidad, contenido de interfaz y sistema visual. Incluye el wordmark y el emblema oficiales en [`public/brand/`](public/brand/), y las fuentes locales en [`public/fonts/`](public/fonts/).

La portada pública se complementa con registro, verificación y reenvío de correo, inicio/cierre de sesión, recuperación, perfiles básicos voluntarios y de organizaciones, foto/portada editables, publicación de perfiles (las organizaciones, tras su aprobación) y revisión administrativa. Estas pantallas consumen la API real; requieren el backend. El catálogo de oportunidades, las postulaciones y las capacidades ampliadas siguen pendientes.

La [copia del contrato del MVP](openapi/hila-v1.json) y los [tipos generados](src/api/schema.d.ts) permiten preparar el frontend con los formatos acordados. Cada operación declara su estado de implementación; el contrato también incluye funciones futuras. Consulta la [guía de integración](docs/API_INTEGRATION.md) y actualiza desde el backend con `npm run api:sync`; CI verifica la correspondencia mediante `npm run api:check`.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```sh
npm ci
npm run dev
```

Vite sirve la interfaz en <http://127.0.0.1:5173>. El proxy de desarrollo reenvía `/api`, `/swagger-ui` y `/v3/api-docs` a `127.0.0.1:8080`, donde debe estar disponible el backend. Este proxy solo es para desarrollo.

### Datos de ejemplo (sin backend)

Para desarrollar pantallas sin backend, o cuyas operaciones del contrato siguen `planned`, activa el modo de datos de ejemplo. Solo funciona en desarrollo, está apagado por defecto, muestra un aviso «Datos de ejemplo» en cada pantalla y usa únicamente datos ficticios (correos `@example.test`). El build de producción falla si la variable está activa.

```sh
# PowerShell
$env:VITE_API_MOCK='true'; npm run dev
# bash
VITE_API_MOCK=true npm run dev
```

Las cuentas ficticias y su contraseña de ejemplo están descritas en `src/api/mock/`. Cuando el backend implemente una operación, se retira su mock; el contrato `hila-v1.json` sigue siendo la referencia de formas y errores.

Con el modo activo hay pantallas para todas las operaciones `planned` del contrato (capacidades, Explorar, Mi actividad, Avisos, causas y necesidades, postulaciones, cierre de la actividad, equipo y administración), cada una detrás de una bandera de `src/features.ts`; el mapa completo está en [Integración con la API](docs/API_INTEGRATION.md#pantallas-con-datos-de-ejemplo). `/guia-ui` muestra los componentes del sistema de diseño y `/ingresar` lista las cuentas ficticias.

Para validar cambios:

```sh
npm run lint
npm run api:check
npm run build
```

CI ejecuta esos tres comandos. Las pruebas E2E (`npm run test:e2e`) necesitan el backend y no corren en CI; consulta [Recorridos y pruebas](docs/API_INTEGRATION.md#recorridos-y-pruebas).

## Ejecutar la imagen Docker

Requisitos: Docker Engine. La imagen compila el frontend y Nginx sirve los archivos estáticos; no incluye la API ni PostgreSQL.

```sh
docker build -t hila-frontend .
docker run --rm --name hila-frontend --network hila-backend_default -e API_UPSTREAM=http://api:8080 -p 127.0.0.1:5173:80 hila-frontend
```

Abre <http://127.0.0.1:5173>. Nginx reenvía `/api` a `API_UPSTREAM` (por defecto `http://api:8080`), sin cambiar el origen de las cookies. Usa la red del Compose del backend; adapta su nombre si cambiaste el nombre de proyecto. La API y sus credenciales R2 permanecen en el servidor. El proxy admite solicitudes de imágenes de hasta 11 MiB.

## Documentación

- [Índice de documentación](docs/README.md)
- [Sistema visual](design-system/MASTER.md)
- [Identidad visual](docs/IDENTIDAD_VISUAL.md)
- [Requisitos y flujos del producto](https://github.com/soul-labs-art/hila-backend/tree/main/docs)

## Licencia

El código fuente de Hila creado por Soul Labs Art en este repositorio se ofrece bajo la [PolyForm Noncommercial License 1.0.0](LICENSE). Permite usar, modificar y redistribuir el software con fines no comerciales; no concede permiso para el uso comercial. Para ese uso se requiere autorización independiente de Soul Labs Art.

La licencia cubre el software de Hila indicado arriba. Las dependencias, fuentes tipográficas, imágenes, marcas y demás recursos de terceros pueden tener términos propios; consulta sus avisos y licencias. El nombre, los logotipos y la identidad visual de Hila no se licencian por este archivo.
