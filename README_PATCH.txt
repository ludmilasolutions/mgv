MGV - Parche de guardado (404) 🚑

Qué incluye
- _redirects con:
    /api/*  -> /.netlify/functions/:splat
    /.netlify/functions/save-catalog -> /.netlify/functions/save_catalog
- mgv-control-842/index.html actualizado para llamar a /.netlify/functions/save_catalog
  y con default de API Base '/.netlify/functions'. También lee JSON via raw.githubusercontent.com con cache-bust.

Cómo aplicar
1) Subí el contenido de este ZIP a la raíz del repo (reemplazando _redirects y mgv-control-842/index.html).
2) Netlify: hace un deploy (se dispara solo).
3) En el navegador, abrí el panel:
   - En Config poné API Base: /.netlify/functions
   - Pegá el SAVE_TOKEN (mismo que en Netlify) y tocá "Test".
   - Refrescá con Ctrl+F5.
4) Probá "Guardar ahora". Si algo falla, mirá en Network el request a /.netlify/functions/save_catalog.

Listo 💪
