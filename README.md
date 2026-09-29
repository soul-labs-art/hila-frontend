# Hila Frontend

Hila es una iniciativa de tecnología cívica que busca conectar las capacidades de las personas —su tiempo, conocimientos, oficios y recursos— con necesidades concretas de organizaciones y colectivos comunitarios. Está en preparación un piloto en Medellín y el Valle de Aburrá. La plataforma busca facilitar la coordinación y el seguimiento, con las organizaciones a cargo de decidir y acompañar sus actividades.

Este repositorio contiene la interfaz web de Hila, construida con React, TypeScript y Vite. La API, las reglas de negocio y la base de datos viven en [hila-backend](https://github.com/soul-labs-art/hila-backend).

## Responsabilidad y estado

Este proyecto es dueño de la presentación, navegación, accesibilidad, contenido de interfaz y sistema visual. Incluye el wordmark y el emblema oficiales en [`public/brand/`](public/brand/), y las fuentes locales en [`public/fonts/`](public/fonts/).

La portada pública y su adaptación móvil están listas. El registro de cuentas, el inicio de sesión, el catálogo de oportunidades y el consumo de la API todavía no están implementados; la portada funciona sin el backend.

## Desarrollo local

Requisitos: Node.js 24 y npm.

```sh
npm ci
npm run dev
```

Vite sirve la interfaz en <http://127.0.0.1:5173>. El proxy de desarrollo reenvía `/api`, `/swagger-ui` y `/v3/api-docs` a `127.0.0.1:8080`, donde debe estar disponible el backend. Este proxy solo es para desarrollo.

Para validar cambios:

```sh
npm run lint
npm run build
```

## Ejecutar la imagen Docker

Requisitos: Docker Engine. La imagen compila el frontend y Nginx sirve los archivos estáticos; no incluye la API ni PostgreSQL.

```sh
docker build -t hila-frontend .
docker run --rm --name hila-frontend -p 127.0.0.1:5173:80 hila-frontend
```

Abre <http://127.0.0.1:5173>. La conexión con servicios de backend para producción se configurará cuando el frontend implemente el consumo de endpoints.

## Documentación

- [Índice de documentación](docs/README.md)
- [Sistema visual](design-system/MASTER.md)
- [Identidad visual](docs/IDENTIDAD_VISUAL.md)
- [Requisitos y flujos del producto](https://github.com/soul-labs-art/hila-backend/tree/main/docs)

## Licencia

El código fuente de Hila creado por Soul Labs Art en este repositorio se ofrece bajo la [PolyForm Noncommercial License 1.0.0](LICENSE). Permite usar, modificar y redistribuir el software con fines no comerciales; no concede permiso para el uso comercial. Para ese uso se requiere autorización independiente de Soul Labs Art.

La licencia cubre el software de Hila indicado arriba. Las dependencias, fuentes tipográficas, imágenes, marcas y demás recursos de terceros pueden tener términos propios; consulta sus avisos y licencias. El nombre, los logotipos y la identidad visual de Hila no se licencian por este archivo.
