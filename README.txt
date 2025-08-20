MGV patch
==========

Archivos incluidos:
- functions/save_catalog.js   → Netlify Function para guardar JSON en GitHub
- _redirects                  → Regla única para exponer las funciones en /api/*

Pasos:
1) Copiar `functions/save_catalog.js` a tu carpeta de funciones del proyecto.
2) Reemplazar `/_redirects` por el de este zip (dejar sólo esta regla).
3) Definir variables de entorno en Netlify:
   - SAVE_TOKEN
   - GH_APP_ID
   - GH_INSTALLATION_ID
   - GH_OWNER=ludmilasolutions
   - GH_REPO=mgv
   - GH_BRANCH=main (opcional)
   - GH_PRIVATE_KEY  (PEM) **o** GH_PRIVATE_KEY_B64  (recomendado)
4) Deploy.
5) Desde el panel:
   - API Base: /api
   - Save Token: (el mismo SAVE_TOKEN)
   - Guardar ahora (POST /api/save_catalog)
