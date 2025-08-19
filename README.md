
# MGV – Web con Checkout por WhatsApp + Panel con autosave (GitHub App)

**Incluye**
- Tema blanco minimalista
- Home con banners, categorías y **modal de producto**
- Carrito + **checkout por WhatsApp** (sin Mercado Pago por ahora)
- **Panel oculto** `/mgv-control-842` para editar **productos**, **banners** y **config** (tema/SEO/WhatsApp/páginas)
- **Guardado en GitHub** mediante **GitHub App** (funciones Netlify)
- `netlify.toml` con redirects `/api/*` → funciones

## Accesos
- Usuario panel: `admin`
- Contraseña temporal: `MGV2025!`  → Cambiala en **Config** (el panel te da el hash para reemplazar y subir).

## Variables de entorno (en Netlify)
- `SAVE_TOKEN` (cadena aleatoria larga) — el mismo que configurarás en el panel.
- `PANEL_ORIGIN` (ej: `https://TU-USUARIO.github.io`) — CORS.
- `GH_OWNER` — usuario/org del repo Pages.
- `GH_REPO` — nombre del repo.
- `GH_BRANCH` — rama (ej: `main`).
- **GitHub App**:
  - `GH_APP_ID`
  - `GH_INSTALLATION_ID`
  - `GH_PRIVATE_KEY` — contenido PEM (incluye los saltos de línea).

## Despliegue
1) Subí esta carpeta al repo de GitHub (ej: `mgv-tienda`). Activá **GitHub Pages** (Settings → Pages → Deploy from branch → `main`).  
2) En **Netlify**, crea un sitio desde el mismo repo o importá el folder.  
3) En Netlify, agregá las **variables de entorno** arriba y redeploy.  
4) Abrí `https://TU-PAGES/mgv-control-842` → **Config**:  
   - API Base: `/api`  
   - Save Token: el mismo valor de `SAVE_TOKEN`  
   - Probá **Test** → si responde “pong”, ya podés **Guardar todo**.

## WhatsApp
- Configurá el número en **Config → WhatsApp** (formato `549...`).  
- El botón “Finalizar por WhatsApp” arma y abre el mensaje en `wa.me/<número>`.

## Notas
- Los cambios se comitean al repo; GitHub Pages puede demorar 15–90s en verse.  
- El panel también permite descargar los JSON por si querés commitear manualmente.
