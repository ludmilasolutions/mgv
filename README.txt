MGV – Bundle de índices + assets (RAW instantáneo)
====================================================
Incluye:
- index.html                  (tienda pública) – usa assets/js/fetch-raw-patch.js
- mgv-control-842/index.html  (panel admin)    – lee directo de RAW y refresca tras guardar
- assets/js/fetch-raw-patch.js
- assets/js/panel-raw-refresh.js

Cómo usar:
1) Subí todo el contenido conservando las rutas.
2) La tienda leerá /data/*.json desde RAW (sin esperar deploy).
3) El panel guarda en GitHub y vuelve a cargar los datos automáticamente.

Config editable (ambos):
- Owner/Repo/Branch: window.ENV en la tienda (o editar panel index: GH_OWNER/REPO/BRANCH).
