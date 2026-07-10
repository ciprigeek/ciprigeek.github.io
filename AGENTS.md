# Instrucciones para agentes (AGENTS.md)

Propósito
- Ayudar a agentes AI a ser productivos rápidamente en este repositorio Astro + Starlight.

Resumen rápido
- Comandos importantes (ejecutar en la raíz del repo):
  - `npm install` — instalar dependencias
  - `npm run dev` — servidor de desarrollo (localhost:4321)
  - `npm run build` — generar sitio en `./dist/`
  - `npm run preview` — previsualizar un build local

Archivos y rutas clave
- Documentación principal: [README.md](README.md)
- Configuración del sitio: [astro.config.mjs](astro.config.mjs)
- Scripts y dependencias: [package.json](package.json)
- Contenido (MD / MDX): `src/content/docs/` — rutas públicas generadas a partir de los nombres de archivo
- Configuración de contenido: [src/content.config.ts](src/content.config.ts)
- Recursos estáticos: `public/`
- Assets (imágenes, etc.): `src/assets/`

Convenciones a tener en cuenta
- El proyecto usa Astro + la plantilla Starlight (ver README.md). Si necesita detalles, enlace al README en vez de copiarlo.
- Los archivos en `src/content/docs/` se exponen como rutas según su nombre; respete frontmatter y formato Markdown/MDX.
- Imágenes referenciadas desde Markdown deben colocarse en `src/assets/` y enlazarse con rutas relativas.

Cómo actuar como agente
- Antes de hacer cambios automáticos, ejecutar `npm run dev` o `npm run build` localmente para validar outputs.
- Preferir enlaces a documentación existente (README, docs) en lugar de duplicar contenido.
- No asumir CI/CD ni secretos; preguntar si necesita credenciales o acceso a hosting.

Propuestas de personalizaciones adicionales
- `create-agent content-editor`: tareas para crear/actualizar posts en `src/content/docs/` respetando frontmatter.
- `create-agent preview-deploy`: instrucción para ejecutar `npm run build` y publicar el contenido (requiere credenciales del usuario).

Contacto/feedback
- Si esta instrucción necesita más contexto (p.ej. workflows de CI, despliegue), pida que añada esos documentos y actualizaré esta guía.
