# Hila · Design system

## Fuente de decisiones

La referencia visual aprobada para este desarrollo está en [docs/IDENTIDAD_VISUAL.md](../docs/IDENTIDAD_VISUAL.md) y en los wordmarks de `public/brand/`. La búsqueda de UI/UX detectó un estilo biophilic verde con Exo; se descartó porque no coincide con la marca de Hila. El nombre del producto, la paleta arcilla/lino y las fuentes locales tienen prioridad.

## Dirección

Hila conecta lo que las personas pueden aportar con lo que una causa necesita. La portada mantiene el wordmark oficial en la parte superior y usa el emblema ilustrativo aprobado, centrado en el espacio principal. No incluye la trama de interfaz ni etiquetas decorativas.

La portada usa una composición editorial en dos columnas, fondo lino y texto en tinta/arcilla. En móvil se apilan el mensaje y el emblema. La navegación y los datos cotidianos conservan orden, espacio y lenguaje directo. Las secciones explican a personas y organizaciones cómo encajan en el mismo proceso.

## Color y tipo

| Token | Valor | Uso |
|---|---|---|
| `--clay` | `#8C402E` | Marca, títulos y acción principal. |
| `--coral` | `#D76A4C` | Acento e ilustración. |
| `--sun` | `#E6A93F` | Punto de encuentro y foco visible. |
| `--plum` | `#5E3A50` | Superficie profunda y contraste emocional. |
| `--sage` | `#83907A` | Acentos secundarios. |
| `--linen` | `#F6EBDD` | Superficie clara principal. |
| `--ink` | `#2E2623` | Texto largo y contraste. |
| `--muted` | `#665951` | Texto secundario y ayudas. |
| `--rule` | `#D7C5B0` | Líneas y separadores. |

Fraunces se usa en titulares; DM Sans en navegación, cuerpo e interfaz. Las dos fuentes se sirven localmente desde `public/fonts/`.

## Composición e interacción

- Dar espacio al emblema de Hila; limitar bordes y contenedores a los que aporten agrupación o acción.
- Mantener texto corriente en tinta sobre lino o lino sobre una superficie oscura. Revisar contraste para cada estado y no poner texto pequeño en coral sobre arcilla ni en mostaza sobre lino.
- Usar enlaces para navegar, botones para acciones, etiquetas asociadas en formularios y mensajes de error junto al campo.
- Incluir salto al contenido, foco visible y una secuencia de tabulación igual al orden de lectura. No ocultar contenido necesario tras efectos de scroll.
- Mantener áreas táctiles cómodas, evitar desplazamiento horizontal y apilar hero y navegación en móvil.
- El movimiento es sutil y responde a una acción. Respetar `prefers-reduced-motion`.
- No usar emojis como iconos, controles sin destino ni llamados a registrarse antes de implementar el flujo.

## Acceso y perfiles

Las pantallas de producto conservan la marca y las fuentes. Los formularios usan controles de 48 px, etiquetas visibles y mensajes asociados a campos; las acciones principales usan arcilla. El login presenta el emblema junto al formulario en escritorio y concentra el formulario en móvil.

La portada y la cabecera reconocen la sesión: con sesión activa ofrecen «Ir a mi cuenta» en lugar de «Ingresar» y «Crear mi cuenta». `/ingresar` y `/registro` redirigen a quien ya ingresó (respetando `returnTo`); los enlaces de verificación y recuperación siguen abiertos. La sección ciruela de la portada cierra con una acción en lino sobre ciruela. Cada pantalla tiene un `<title>` propio y un solo `<h1>`; el emblema junto al formulario es decorativo (`alt=""`). El correo escrito pasa entre pantallas de acceso por el estado del router, nunca por la URL.

Los perfiles toman de la referencia aprobada la portada 3:1 y el avatar superpuesto. La presentación queda sobre una superficie clara; no se usan estrellas, seguidores ni cifras decorativas. La vista del propietario separa información, imágenes y publicación; la organización también muestra revisión e historial. La aprobación y la visibilidad son estados diferentes.

Las imágenes tienen recorte centrado y previsualización. Las acciones de publicación son explícitas y se acompañan de una explicación de los campos visibles. Ninguna acción de interfaz sustituye la autorización del servidor.

Al cambiar de ruta dentro del espacio de acceso y perfiles, el contenido vuelve al inicio y el foco pasa al elemento principal, que también es el destino de «Saltar al contenido». Este destino programático no dibuja un contorno alrededor de toda la página; los enlaces, botones y campos conservan foco visible. El enlace de salto permanece oculto hasta recibir foco.

Los campos enlazan su etiqueta, ayuda y error por identificadores. El resumen de error recibe foco y se anuncia como alerta; las confirmaciones se anuncian como estado. Mostrar u ocultar la contraseña es un botón dentro del campo, separado del envío; su nombre cambia entre «Mostrar» y «Ocultar» para anunciar el estado.

## Referencias

- Identidad de marca y uso del wordmark: [docs/IDENTIDAD_VISUAL.md](../docs/IDENTIDAD_VISUAL.md).
- Requisitos y flujos del producto: [documentación de dominio en hila-backend](https://github.com/soul-labs-art/hila-backend/tree/main/docs).
- Guías verificadas de UX y React consultadas en la skill `ui-ux-pro-max`: navegación por teclado, salto al contenido, controles semánticos, foco visible y etiquetas enlazadas a sus campos.
