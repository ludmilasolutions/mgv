
/**
 * live-data-override.js
 * Lee los JSON de /data/*.json directamente desde GitHub Raw
 * sin necesidad de redeploy. No modifica tu app: intercepta fetch().
 *
 * Configurá owner/repo/branch acá abajo.
 */
(function () {
  const OWNER  = "ludmilasolutions";
  const REPO   = "mgv";
  const BRANCH = "main";
  const RAW_BASE = `https://raw.githubusercontent.com/${OWNER}/${REPO}/${BRANCH}/data`;

  const targets = [
    "productos.json",
    "banners.json",
    "config.json",
  ];

  const mapPath = new Map();
  for (const name of targets) {
    mapPath.set(`/data/${name}`, `${RAW_BASE}/${name}`);
    mapPath.set(`data/${name}`,  `${RAW_BASE}/${name}`);
  }

  const origFetch = window.fetch.bind(window);

  window.fetch = function (input, init) {
    try {
      const u = new URL(typeof input === "string" ? input : input.url, window.location.href);
      const path = u.pathname;
      const target = mapPath.get(path) || mapPath.get(path.replace(/^\//, ""));
      if (target) {
        const bust = (target.includes("?") ? "&" : "?") + "v=" + Date.now();
        const newUrl = target + bust;
        const newInit = Object.assign({ cache: "no-store" }, init || {});
        return origFetch(newUrl, newInit);
      }
    } catch (_) { /* ignore and fall back */ }
    return origFetch(input, init);
  };
})();
