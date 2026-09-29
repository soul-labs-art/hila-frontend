# Hila Frontend

Hila es una plataforma cívica que conecta capacidades de personas voluntarias con necesidades concretas de organizaciones y colectivos comunitarios. Este repositorio contiene la interfaz web de Hila: React, TypeScript y Vite.

El [wordmark y emblema oficiales](public/brand/) son los activos visuales de la portada. El backend, el contrato HTTP, las reglas de negocio y la base de datos pertenecen a [hila-backend](https://github.com/soul-labs-art/hila-backend).

## Estado

La portada pública y su adaptación móvil están listas. El registro de cuentas, las convocatorias, el inicio de sesión y el consumo de la API aún no están implementados.

## Desarrollo local

Requisitos: Node.js 24.

```sh
npm ci
npm run dev
```

Vite sirve la interfaz en <http://127.0.0.1:5173>. El proxy de desarrollo reenvía `/api`, `/swagger-ui` y `/v3/api-docs` a `127.0.0.1:8080`, donde escucha la API de desarrollo. Para verla sin backend, la portada funciona de forma independiente.

```sh
npm run build
npm run lint
```

También se puede construir una imagen estática con `docker build -t hila-frontend .` y servirla con `docker run --rm -p 127.0.0.1:5173:80 hila-frontend`. La imagen Nginx sirve el sitio; la configuración de una API remota se añadirá cuando se implemente el consumo de endpoints.

## Documentación

- [Índice de documentación](docs/README.md)
- [Sistema visual](design-system/MASTER.md)
- [Identidad visual](docs/IDENTIDAD_VISUAL.md)
- [Requisitos y flujos del producto](https://github.com/soul-labs-art/hila-backend/tree/main/docs)
