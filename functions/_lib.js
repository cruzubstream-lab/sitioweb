// Utilidades compartidas: sesión, respuestas JSON y límites.
export const COOKIE = "hs_sesion";
const DIA = 86400;

export function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...extra },
  });
}

export function leerCookie(request, nombre) {
  const c = request.headers.get("cookie") || "";
  for (const parte of c.split(";")) {
    const [k, ...v] = parte.trim().split("=");
    if (k === nombre) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function cookieSesion(token, maxAge = 30 * DIA) {
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

export async function usuarioActual(context) {
  const token = leerCookie(context.request, COOKIE);
  if (!token) return null;
  const ahora = Math.floor(Date.now() / 1000);
  const fila = await context.env.DB.prepare(
    "SELECT u.id, u.nombre, u.avatar, u.personalizado FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id WHERE s.token = ? AND s.expira > ?"
  ).bind(token, ahora).first();
  if (!fila) return null;
  fila.proveedor = fila.id.startsWith("g:") ? "google" : "discord";
  return fila;
}

export function esAdmin(context, usuario) {
  if (!usuario) return false;
  const ids = (context.env.ADMIN_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);
  return ids.includes(usuario.id);
}

export function nuevoToken() {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function limpiar(texto, max) {
  return String(texto || "").replace(/\r\n/g, "\n").trim().slice(0, max);
}

export const CATEGORIAS = ["preguntas", "launcher", "servidor", "sugerencias", "general"];

// Solo acepta escrituras desde el propio sitio (protección CSRF básica).
export function mismoOrigen(request) {
  const origen = request.headers.get("origin");
  if (!origen) return true;
  return new URL(origen).host === new URL(request.url).host;
}
