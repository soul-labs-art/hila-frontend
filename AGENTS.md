# Hila Frontend: contexto y reglas

## Responsabilidad

Este repositorio es dueño de la interfaz web, sus componentes, accesibilidad, navegación y sistema visual. La API y las reglas de negocio viven en [hila-backend](https://github.com/soul-labs-art/hila-backend). No copies Java, migraciones ni lógica de autorización a este repositorio.

Hila conecta capacidades ciudadanas con necesidades de organizaciones y colectivos comunitarios en Medellín y el Valle de Aburrá. La portada describe el propósito y el estado del piloto sin prometer registros ni convocatorias aún inexistentes. Consulta [identidad visual](docs/IDENTIDAD_VISUAL.md) y [sistema visual](design-system/MASTER.md).

## Documentación del repositorio

`docs/README.md` describe la ubicación de las fuentes de verdad. Este repositorio conserva la identidad visual, el sistema de diseño y las decisiones de interfaz. Los requisitos funcionales, flujos del dominio, arquitectura del servidor y modelo de datos viven en [hila-backend](https://github.com/soul-labs-art/hila-backend/tree/main/docs).

## Reglas de interfaz

- Usar React, TypeScript y Vite. Mantener el código de producto en `src/` y los recursos públicos en `public/`.
- Mantener el wordmark en la cabecera y el emblema central aprobados en `public/brand/`. Servir las fuentes Fraunces y DM Sans localmente.
- Respetar la paleta arcilla, lino, tinta y ciruela. Evitar etiquetas decorativas o textos sin jerarquía clara.
- Diseñar desde móvil, evitar desplazamiento horizontal y conservar áreas táctiles cómodas.
- Usar landmarks y controles semánticos, etiquetas asociadas a sus campos, navegación por teclado, foco visible y enlace para saltar al contenido. Respetar `prefers-reduced-motion`.
- No simular flujos de registro, oportunidades o datos reales. La portada indica que todavía no están habilitados.
- Cuando se incorpore la API, usar contratos OpenAPI publicados por hila-backend y nunca implementar autorización en el navegador.
- No guardar secretos ni datos personales reales. No añadir dependencias sin necesidad descrita.

## Flujo de trabajo

- Crear ramas breves `feat/...`, `fix/...` o `docs/...`; integrar por pull request a `main`.
- Ejecutar `npm run build` y `npm run lint`; explicar el alcance y las verificaciones en cada pull request.
- Actualizar el README, `docs/IDENTIDAD_VISUAL.md` o `design-system/MASTER.md` cuando cambie una decisión estable.
