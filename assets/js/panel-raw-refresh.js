/* assets/js/panel-raw-refresh.js
 * Panel: luego de guardar con /.netlify/functions/save_catalog, refresca data del panel.
 */
(function () {
  if (window.__MGV_PANEL_REFRESH__) return;
  window.__MGV_PANEL_REFRESH__ = true;

  var origFetch = window.fetch;
  window.fetch = async function(input, init) {
    var isSave = (typeof input === "string" ? input : (input && input.url) || "").includes("/.netlify/functions/save_catalog");
    var resp = await origFetch.apply(this, arguments);
    try {
      if (isSave) {
        var clone = resp.clone();
        var txt = await clone.text();
        try {
          var j = JSON.parse(txt);
          if (resp.ok && j && (j.done === true || j.commits)) {
            setTimeout(async () => {
              if (typeof window.loadTables === "function") {
                try { await window.loadTables(); } catch (e) { location.reload(); }
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