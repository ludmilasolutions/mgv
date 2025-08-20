/* assets/js/panel-raw-refresh.js
 * Panel: tras guardar en save_catalog, refresca la UI con la data nueva (RAW).
 * No depende de funciones internas: si existe window.loadTables, la invoca,
 * de lo contrario recarga la página como fallback.
 */
(function () {
  if (window.__MGV_PANEL_REFRESH__) return;
  window.__MGV_PANEL_REFRESH__ = true;

  var origFetch = window.fetch;
  window.fetch = async function(input, init) {
    const isSave = (typeof input === "string" ? input : (input && input.url) || "").includes("/.netlify/functions/save_catalog");
    const resp = await origFetch.apply(this, arguments);
    try {
      if (isSave) {
        // Clonamos para poder leer el body
        const clone = resp.clone();
        const txt = await clone.text();
        try {
          const j = JSON.parse(txt);
          if (resp.ok && j && (j.done === true || j.commits)) {
            // Espera corta por replicación en RAW y recarga data
            setTimeout(async () => {
              if (typeof window.loadTables === "function") {
                try {
                  await window.loadTables();
                } catch (e) {
                  console.warn("loadTables falló, recargo", e);
                  location.reload();
                }
              } else {
                location.reload();
              }
            }, 800);
          }
        } catch (_e) {}
      }
    } catch (_e2) {}
    return resp;
  };
})();