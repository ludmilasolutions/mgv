# MGV Librería–Regalería (HTML + JS + GitHub Pages)

Tienda estática con carrito, banners rotativos y **pago por Mercado Pago (redirect)**. Incluye **panel oculto** para editar productos/banners.

- Panel: `/mgv-control-842`
- Usuario: `admin`
- Contraseña inicial: `basicafespues` (cambiala desde el panel)

## Estructura
```
/assets/logo.png
/data/productos.json
/data/banners.json
/index.html
/styles.css
/app.js
/mgv-control-842/index.html
/functions/create_preference.js
/netlify.toml
```

## Publicación en GitHub Pages
1. Creá un repo (p.ej. `mgv-tienda`) y subí todo.
2. Settings → Pages → Deploy from branch → main → /root.
3. Abrí la URL que te da GitHub Pages.

## Editar productos y banners
- Entrá a `/mgv-control-842` → logueate.
- Editá en tablas y luego **Guardá** de dos formas:
  1) Descargar `productos.json` / `banners.json` y subirlos al repo.
  2) Guardar directo en GitHub (opcional): completá token, owner, repo y branch.

## Pagos Mercado Pago (redirect)
Mercado Pago necesita crear **preferencias** con un **Access Token** (secreto). Usá la función serverless gratis:

1) Netlify (gratis)  
- Site settings → Environment variables: `MP_ACCESS_TOKEN` con tu token.  
- La función ya está en `/functions/create_preference.js`.  
- Copiá la URL pública y ponela en `APP_CONFIG.MP_BACKEND_URL` dentro de `index.html` (o en `app.js`).

Listo: el botón de pago redirige al checkout seguro de MP.

## Cambiar contraseña del panel
- En **Config** generá el hash y reemplazá el valor `HASHED` en `mgv-control-842/index.html`. Subí el archivo.

## Notas de seguridad
- Es un frontend estático: el código se ve. Se aplican medidas básicas (ruta oculta, hash).  
- Para guardar en GitHub desde el panel, el token queda sólo en tu navegador (localStorage).
