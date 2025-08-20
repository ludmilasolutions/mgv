/* assets/js/fetch-raw-patch.js
 * Lee /data/{productos|banners|config}.json desde GitHub RAW con cache-busting.
 * Inyectar en <head> ANTES de cualquier script que haga fetch de esos JSON.
 */
(function () {
  if (window.__MGV_FETCH_RAW_PATCH__) return;
  window.__MGV_FETCH_RAW_PATCH__ = true;

  var GH_OWNER  = (window.ENV && window.ENV.GH_OWNER)  || "ludmilasolutions";
  var GH_REPO   = (window.ENV && window.ENV.GH_REPO)   || "mgv";
  var GH_BRANCH = (window.ENV && window.ENV.GH_BRANCH) || "main";
  var RAW_BASE  = "https://raw.githubusercontent.com/" + GH_OWNER + "/" + GH_REPO + "/" + GH_BRANCH + "/data";
  var re = /(?:^|\/)data\/(productos|banners|config)\.json(?:\?[^#]*)?(?:#.*)?$/i;

  var origFetch = window.fetch;
  window.fetch = function(input, init) {
    try {
      var urlStr = (typeof input === "string") ? input
                 : (input && input.url) ? input.url
                 : String(input || "");
      if (re.test(urlStr)) {
        var file = urlStr.match(/(?:^|\/)data\/(productos|banners|config)\.json/i)[1].toLowerCase();
        var u = new URL(RAW_BASE + "/" + file + ".json");
        try {
          var old = new URL(urlStr, location.origin);
          old.searchParams.forEach((v, k) => u.searchParams.set(k, v));
        } catch (_) {}
        u.searchParams.set("ts", Date.now());
        if (typeof input === "string") input = u.toString();
        else input = new Request(u.toString(), input);
      }
    } catch (e) { /* sigue fetch normal */ }
    return origFetch.apply(this, arguments);
  };
})();