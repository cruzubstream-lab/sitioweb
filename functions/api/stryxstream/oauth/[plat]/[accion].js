// /api/stryxstream/oauth/<plataforma>/iniciar  (POST, app con sesión) -> { url, estado }
// /api/stryxstream/oauth/<plataforma>/volver   (GET, vuelve la plataforma tras aceptar)
// /api/stryxstream/oauth/<plataforma>/renovar  (POST, app con sesión) { refresh } -> tokens nuevos
import { json } from "../../../../_lib.js";
import { usuarioApp, dentroDelLimite } from "../../_licencias.js";
import { PROVEEDORES, BASE, configurado, asegurarOauth, pkce, cifrar, aleatorio, huella, pedirToken, canalDe } from "../_proveedores.js";

const pagina = (titulo, texto, ok) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${titulo} · StryxStream</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0b12;color:#e9eaf2;font:16px system-ui,sans-serif;text-align:center;padding:20px}
div{max-width:440px;background:#15151f;border:1px solid #2a2a3a;border-radius:16px;padding:30px}h1{font-size:22px;margin:0 0 10px}p{color:#a5a7b8;line-height:1.5}b{color:${ok ? "#4ade80" : "#f87171"};font-size:40px}</style></head>
<body><div><b>${ok ? "✓" : "✕"}</b><h1>${titulo}</h1><p>${texto}</p></div></body></html>`, { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } });
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

export async function onRequest(context) {
  const { env, params, request } = context;
  const p = String(params.plat || "");
  const accion = String(params.accion || "");
  const cfg = PROVEEDORES[p];
  if (!cfg) return json({ ok: false, error: "Plataforma no válida" }, 404);
  const db = env.DB;

  if (accion === "iniciar" && request.method === "POST") {
    if (!configurado(env, p)) return json({ ok: false, error: `La conexión con ${cfg.nombre} aún no está activada en el servidor` }, 503);
    const u = await usuarioApp(context);
    if (!u) return json({ ok: false, error: "Inicia sesión en la app primero" }, 401);
    if (!(await dentroDelLimite(context, "oauth", 30, 3600000))) return json({ ok: false, error: "Demasiados intentos. Espera un rato." }, 429);
    await asegurarOauth(db);
    const estado = aleatorio(24), secreto = aleatorio(32);
    const k = cfg.pkce ? await pkce() : null;
    await db.prepare("INSERT INTO stryx_oauth (estado, plat, usuario_id, secreto_h, verifier, creado) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(estado, p, u.id, await huella(secreto), k ? k.verifier : null, Date.now()).run();
    const q = new URLSearchParams(Object.assign({ client_id: env[cfg.id], redirect_uri: `${BASE}/${p}/volver`, response_type: "code", scope: cfg.scope, state: estado }, cfg.extra || {},
      k ? { code_challenge: k.challenge, code_challenge_method: "S256" } : {}));
    return json({ ok: true, url: `${cfg.auth}?${q}`, estado, secreto });
  }

  if (accion === "volver" && request.method === "GET") {
    const url = new URL(request.url);
    const estado = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    await asegurarOauth(db);
    const fila = /^[0-9a-f]{48}$/.test(estado) ? await db.prepare("SELECT * FROM stryx_oauth WHERE estado = ? AND plat = ?").bind(estado, p).first() : null;
    if (!fila) return pagina("El enlace caducó", "Vuelve a StryxStream y pulsa otra vez «Conectar».", false);
    if (url.searchParams.get("error") || !code) {
      await db.prepare("UPDATE stryx_oauth SET error = ? WHERE estado = ?").bind("Cancelaste el inicio de sesión", estado).run();
      return pagina("No se conectó", "Cancelaste el inicio de sesión. Puedes cerrar esta pestaña.", false);
    }
    try {
      const datos = { grant_type: "authorization_code", code, redirect_uri: `${BASE}/${p}/volver` };
      if (fila.verifier) datos.code_verifier = fila.verifier;
      const tok = await pedirToken(env, p, datos);
      const canal = await canalDe(env, p, tok.access);
      // Mientras espera a que la app lo recoja (10 min como mucho) se guarda cifrado (AES-GCM)
      // con una clave que solo existe en las variables secretas de Cloudflare.
      await db.prepare("UPDATE stryx_oauth SET resultado = ? WHERE estado = ?").bind(await cifrar(env[cfg.secreto], { canal, tok }), estado).run();
      return pagina(`${cfg.nombre} conectado`, `Listo, ${esc(canal.nombre)}. Ya puedes cerrar esta pestaña y volver a StryxStream.`, true);
    } catch (e) {
      await db.prepare("UPDATE stryx_oauth SET error = ? WHERE estado = ?").bind(String(e.message || e).slice(0, 200), estado).run();
      return pagina("No se pudo conectar", esc(e.message || e), false);
    }
  }

  if (accion === "renovar" && request.method === "POST") {
    if (!configurado(env, p)) return json({ ok: false, error: "No disponible" }, 503);
    const u = await usuarioApp(context);
    if (!u) return json({ ok: false, error: "Inicia sesión en la app primero" }, 401);
    if (!(await dentroDelLimite(context, "renovar", 120, 3600000))) return json({ ok: false, error: "Demasiados intentos" }, 429);
    let body = {}; try { body = await request.json(); } catch {}
    const refresh = String(body.refresh || "").slice(0, 600);
    if (!refresh) return json({ ok: false, error: "Falta el token" }, 400);
    try { return json({ ok: true, tok: await pedirToken(env, p, { grant_type: "refresh_token", refresh_token: refresh }) }); }
    catch (e) { return json({ ok: false, error: "Vuelve a conectar tu cuenta de " + cfg.nombre }, 401); }
  }
  return json({ ok: false, error: "No encontrado" }, 404);
}
