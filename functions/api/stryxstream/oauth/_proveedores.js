// Conectar Twitch, YouTube y Kick con la cuenta del streamer (OAuth), como hace OBS.
// La web hace de intermediaria: los secretos de cada plataforma viven en Cloudflare
// (variables cifradas), nunca en la app ni en el código.
// Los tokens no se guardan: se entregan a la app una sola vez, cifrados con un secreto
// que solo conoce la app, y se borran al recogerlos (o a los 10 minutos).
import { aleatorio, huella } from "../_licencias.js";

export const BASE = "https://hyrostudios.com/api/stryxstream/oauth";

export const PROVEEDORES = {
  twitch: {
    nombre: "Twitch",
    id: "TWITCH_CLIENT_ID", secreto: "TWITCH_CLIENT_SECRET",
    auth: "https://id.twitch.tv/oauth2/authorize",
    token: "https://id.twitch.tv/oauth2/token",
    scope: "chat:read user:read:chat moderator:read:followers channel:read:subscriptions bits:read",
    extra: { force_verify: "true" },
  },
  youtube: {
    nombre: "YouTube",
    id: "YOUTUBE_CLIENT_ID", secreto: "YOUTUBE_CLIENT_SECRET",
    auth: "https://accounts.google.com/o/oauth2/v2/auth",
    token: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/youtube.readonly",
    extra: { access_type: "offline", prompt: "consent", include_granted_scopes: "true" },
  },
  kick: {
    nombre: "Kick",
    id: "KICK_CLIENT_ID", secreto: "KICK_CLIENT_SECRET",
    auth: "https://id.kick.com/oauth/authorize",
    token: "https://id.kick.com/oauth/token",
    scope: "user:read channel:read events:subscribe",
    pkce: true,
  },
};

export const configurado = (env, p) => !!(PROVEEDORES[p] && env[PROVEEDORES[p].id] && env[PROVEEDORES[p].secreto]);

export async function asegurarOauth(db) {
  await db.prepare("CREATE TABLE IF NOT EXISTS stryx_oauth (estado TEXT PRIMARY KEY, plat TEXT NOT NULL, usuario_id TEXT NOT NULL, secreto_h TEXT NOT NULL, verifier TEXT, creado INTEGER NOT NULL, resultado TEXT, error TEXT)").run();
  // Limpieza: nada se queda más de 10 minutos
  await db.prepare("DELETE FROM stryx_oauth WHERE creado < ?").bind(Date.now() - 10 * 60000).run();
}

const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export async function pkce() {
  const verifier = aleatorio(32);
  const challenge = b64u(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier)));
  return { verifier, challenge };
}

// Cifrado AES-GCM con una clave derivada del secreto que solo tiene la app
async function clave(secreto) {
  const k = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("stryx-oauth:" + secreto));
  return crypto.subtle.importKey("raw", k, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function cifrar(secreto, obj) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const c = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await clave(secreto), new TextEncoder().encode(JSON.stringify(obj)));
  return b64u(iv) + "." + b64u(c);
}
export async function descifrar(secreto, txt) {
  const de = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const [iv, c] = String(txt).split(".");
  const p = await crypto.subtle.decrypt({ name: "AES-GCM", iv: de(iv) }, await clave(secreto), de(c));
  return JSON.parse(new TextDecoder().decode(p));
}
export { aleatorio, huella };

/** Pide los tokens a la plataforma (código de autorización o renovación). */
export async function pedirToken(env, p, datos) {
  const cfg = PROVEEDORES[p];
  const body = new URLSearchParams(Object.assign({ client_id: env[cfg.id], client_secret: env[cfg.secreto] }, datos));
  const r = await fetch(cfg.token, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json" }, body });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) throw new Error(j.message || j.error_description || j.error || "La plataforma no aceptó el inicio de sesión");
  return { access: j.access_token, refresh: j.refresh_token || datos.refresh_token || null, expira: Date.now() + (Number(j.expires_in) || 3600) * 1000 };
}

/** Datos públicos del canal de la cuenta conectada. */
export async function canalDe(env, p, access) {
  const cfg = PROVEEDORES[p];
  if (p === "twitch") {
    const r = await fetch("https://api.twitch.tv/helix/users", { headers: { "client-id": env[cfg.id], authorization: "Bearer " + access } });
    const u = ((await r.json()).data || [])[0];
    if (!u) throw new Error("No se pudo leer tu cuenta de Twitch");
    return { id: u.id, canal: u.login, nombre: u.display_name, avatar: u.profile_image_url };
  }
  if (p === "youtube") {
    const r = await fetch("https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true", { headers: { authorization: "Bearer " + access } });
    const c = ((await r.json()).items || [])[0];
    if (!c) throw new Error("Esa cuenta de Google no tiene canal de YouTube");
    return { id: c.id, canal: c.snippet.customUrl || c.id, nombre: c.snippet.title, avatar: c.snippet.thumbnails?.default?.url };
  }
  if (p === "kick") {
    const h = { authorization: "Bearer " + access, accept: "application/json" };
    const u = ((await (await fetch("https://api.kick.com/public/v1/users", { headers: h })).json()).data || [])[0];
    const c = ((await (await fetch("https://api.kick.com/public/v1/channels", { headers: h })).json()).data || [])[0];
    if (!c) throw new Error("No se pudo leer tu canal de Kick");
    return { id: String(c.broadcaster_user_id || u?.user_id || ""), canal: c.slug, nombre: u?.name || c.slug, avatar: u?.profile_picture };
  }
  throw new Error("Plataforma no válida");
}
