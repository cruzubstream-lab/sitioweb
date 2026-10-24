// Página de regreso desde Discord: toma el token del fragmento (#), inicia la sesión y vuelve a la web.
export async function onRequestGet() {
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Iniciando sesión · Hyro Studios</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b1630;color:#e9f0ff;font:16px system-ui,sans-serif;text-align:center;padding:16px}a{color:#1a9fe0}</style></head>
<body><div><p id="m">Iniciando sesión con Discord…</p></div>
<script>
(async () => {
  const m = document.getElementById("m");
  const p = new URLSearchParams(location.hash.slice(1));
  const token = p.get("access_token"), estado = p.get("state");
  let guardado = null; try { guardado = JSON.parse(sessionStorage.getItem("hs_login") || "null"); } catch (e) {}
  history.replaceState(null, "", "/auth/discord");
  if (!token) { m.innerHTML = 'No se completó el inicio de sesión. <a href="/">Volver a la web</a>'; return; }
  if (!guardado || guardado.estado !== estado) { m.innerHTML = 'La sesión caducó. <a href="/">Vuelve a intentarlo</a>'; return; }
  try {
    const r = await fetch("/api/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ access_token: token }) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || "Error");
    sessionStorage.removeItem("hs_login");
    location.replace(guardado.volver || "/");
  } catch (e) { m.innerHTML = (e.message || "Error") + ' <a href="/">Volver a la web</a>'; }
})();
</script></body></html>`;
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
}
