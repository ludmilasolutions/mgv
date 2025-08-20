# MGV – Subida de Imágenes desde el Panel

Este parche agrega **subida directa de imágenes** al repo desde el panel (Netlify Functions + GitHub API).

## ¿Qué incluye?
- `netlify/functions/upload-image.js`: función serverless en `/api/upload-image` que
  guarda la imagen en el repo (ruta `assets/uploads/YYYY/MM/…`) y devuelve la **URL raw** pinneada al commit.
- `assets/js/uploader.js`: helper front-end para enviar la imagen.
- `assets/css/uploader.css`: estilos mínimos.
- `mgv-control-842/index.html` (fragmento para insertar): control de subida y vista previa.

> Seguridad: el **token** se usa solo en el servidor (Netlify), el navegador **no** ve el PAT.

## Requisitos (Netlify)
Configurar variables de entorno en **Site settings → Environment variables**:
- `GITHUB_OWNER`: tu usuario u organización.
- `GITHUB_REPO`: nombre del repo.
- `GITHUB_DEFAULT_BRANCH`: normalmente `main`.
- `GITHUB_TOKEN`: PAT con permiso `repo` (o fine-grained con *Contents: Read/Write*).
- (Opcional) `MAX_BYTES`: tamaño máx en bytes (default 6_000_000).

## Cómo instalar
1. Copiá las carpetas y archivos del ZIP en tu proyecto:
   - `netlify/functions/upload-image.js`
   - `assets/js/uploader.js`
   - `assets/css/uploader.css`
   - Integra el **fragmento** de `mgv-control-842/index.html` dentro de tu panel real.
2. Asegurate de tener `@octokit/rest` como dependencia (en Netlify):
   - Si usás monorepo, agregalo en `package.json`. En sites “zero-config”, Netlify lo instala si está junto a la función (usando edge bundler). Si prefieres, crea un `package.json` en `netlify/functions`:
     ```json
     { "dependencies": { "@octokit/rest": "^21.0.0" } }
     ```
3. Deploy en Netlify. La función quedará en `/api/upload-image`.

## Uso en el panel
- En el editor de producto, apretá **Subir…** y elegí un archivo.
- Al terminar, se autocompleta el campo **URL de imagen** con la `raw URL` pinneada al commit y se muestra la **vista previa**.
- También se guarda el `commitSha` en `localStorage.mgv_last_sha` y cookie `mgvsha` para evitar caché.

## Notas
- El archivo se guarda en `assets/uploads/<año>/<mes>/timestamp_nombre.ext`
- Tipos aceptados: `image/*`. Otras extensiones responden error 400.
- Si querés **optimización** (JPEG/WebP/PNG), activá `sharp` (ver comentarios en el código).

## Troubleshooting
- **405**: probablemente hiciste `GET` en lugar de `POST`.
- **413**: supera `MAX_BYTES`. Bajá calidad/peso.
- **500 Missing GitHub env**: faltan variables o token inválido.
- **@octokit/rest no encontrado**: agregalo como dependencia.

---

Hecho con ❤️ para MGV. Cualquier cosa, decime y te lo dejo integrado directo en tu panel real.
