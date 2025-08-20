MGV – Parche de actualización inmediata de precios

Qué soluciona
- Cuando guardás desde el panel y refrescás la web, a veces seguías viendo el precio anterior por unos segundos/minutos. Era por latencia/caché de GitHub Raw/Netlify.

Cómo lo soluciona
1) La web (index.html) ahora lee los JSON desde GitHub Raw usando el ÚLTIMO commit SHA disponible (guardado por el panel en localStorage/cookie).
2) El panel, al guardar, además de refrescarse, guarda ese SHA en:
   - localStorage: mgv_last_sha
   - cookie: mgvsha (path=/; max-age 30 días)
   De esa forma, si refrescás la web justo después de guardar, ya usa ese SHA y ves el cambio al instante.
3) Todo sigue funcionando igual para visitantes nuevos (usan la rama main). Vos, como admin, ves los cambios instantáneamente después de guardar.

Archivos incluidos
- assets/js/fetch-raw-patch.js (reemplazo)
- mgv-control-842/index.html (reemplazo)

Instalación
1) Subí/commiteá estos dos archivos reemplazando los existentes.
2) Refrescá el panel, guardá un precio y luego refrescá el sitio.
3) Si querés forzar una versión específica, podés abrir la web con ?sha=<commit> (ej: ?sha=abc123).

Notas
- No hay Service Worker en este proyecto.
- Igual mantenemos el cache-bust ?ts=Date.now() para evitar caché de navegador.
