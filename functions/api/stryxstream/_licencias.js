// StryxStream Plus: utilidades de licencias (tabla stryx_licencias en la base de datos D1 de la web).
export const PLANES = { "1w": 7, "2w": 14, "1m": 30, "3m": 90, "6m": 180 };
export const NOMBRE_PLAN = { "1w": "1 semana", "2w": "2 semanas", "1m": "1 mes", "3m": "3 meses", "6m": "6 meses" };

let lista = false;
export async function asegurarTabla(db) {
  if (lista) return;
  await db.prepare(
    "CREATE TABLE IF NOT EXISTS stryx_licencias (clave TEXT PRIMARY KEY, plan TEXT NOT NULL, nota TEXT, creada INTEGER NOT NULL, equipo TEXT, activada INTEGER, caduca INTEGER, anulada INTEGER DEFAULT 0, creada_por TEXT)"
  ).run();
  lista = true;
}

export function nuevaClave() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(12));
  const c = Array.from(b, (x) => abc[x % abc.length]).join("");
  return `STRYX-${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8, 12)}`;
}

export const FORMATO = /^STRYX(-[A-Z0-9]{4}){3}$/;

// ---------- Cuentas de la app (inicio de sesión con un código, como en las teles)
let cuentasListas = false;
export async function asegurarCuentas(db) {
  if (cuentasListas) return;
  await db.batch([
    db.prepare("CREATE TABLE IF NOT EXISTS stryx_vinculos (codigo TEXT PRIMARY KEY, secreto TEXT NOT NULL, creado INTEGER NOT NULL, usuario_id TEXT, token TEXT)"),
    db.prepare("CREATE TABLE IF NOT EXISTS stryx_tokens (token TEXT PRIMARY KEY, usuario_id TEXT NOT NULL, creado INTEGER NOT NULL, usado INTEGER)"),
    // Registro de quién usa la app y su Plus en la cuenta
    db.prepare("CREATE TABLE IF NOT EXISTS stryx_limites (clave TEXT PRIMARY KEY, n INTEGER NOT NULL, desde INTEGER NOT NULL)"),
    db.prepare("CREATE TABLE IF NOT EXISTS stryx_cuentas (usuario_id TEXT PRIMARY KEY, primera INTEGER NOT NULL, ultima INTEGER NOT NULL, plan TEXT, caduca INTEGER, nota TEXT)"),
  ]);
  cuentasListas = true;
}

export function aleatorio(n) {
  const b = crypto.getRandomValues(new Uint8Array(n));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function nuevoCodigo() {
  const abc = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(8));
  const c = Array.from(b, (x) => abc[x % abc.length]).join("");
  return c.slice(0, 4) + "-" + c.slice(4);
}

/** Usuario de la app a partir de «Authorization: Bearer <token>». */
export async function usuarioApp(context) {
  const auth = context.request.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  await asegurarCuentas(context.env.DB);
  const h = await huella(token);
  const fila = await context.env.DB.prepare(
    "SELECT u.id, u.nombre, u.avatar FROM stryx_tokens t JOIN usuarios u ON u.id = t.usuario_id WHERE t.token = ?"
  ).bind(h).first();
  if (fila) {
    const ahora = Date.now();
    context.waitUntil(context.env.DB.batch([
      context.env.DB.prepare("UPDATE stryx_tokens SET usado = ? WHERE token = ?").bind(ahora, h),
      context.env.DB.prepare("INSERT INTO stryx_cuentas (usuario_id, primera, ultima) VALUES (?, ?, ?) ON CONFLICT(usuario_id) DO UPDATE SET ultima = excluded.ultima").bind(fila.id, ahora, ahora),
    ]).catch(() => {}));
    fila.token = h;
  }
  return fila;
}

/** Plus asignado a la cuenta (si lo hay y no ha caducado). */
export async function plusDeCuenta(db, usuarioId) {
  await asegurarCuentas(db);
  const c = await db.prepare("SELECT plan, caduca FROM stryx_cuentas WHERE usuario_id = ?").bind(usuarioId).first();
  return c && c.caduca && c.caduca > Date.now() ? { plan: c.plan, caduca: c.caduca } : null;
}

/** Huella SHA-256 (hex): las sesiones de la app se guardan así, nunca en claro. */
export async function huella(texto) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(d)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

/** Límite de peticiones por IP: devuelve false si se pasó del máximo en la ventana. */
export async function dentroDelLimite(context, accion, max, ventanaMs) {
  const db = context.env.DB;
  await asegurarCuentas(db);
  const ip = context.request.headers.get("cf-connecting-ip") || "local";
  const clave = accion + ":" + ip;
  const ahora = Date.now();
  const f = await db.prepare("SELECT n, desde FROM stryx_limites WHERE clave = ?").bind(clave).first();
  if (!f || ahora - f.desde > ventanaMs) {
    await db.prepare("INSERT INTO stryx_limites (clave, n, desde) VALUES (?, 1, ?) ON CONFLICT(clave) DO UPDATE SET n = 1, desde = excluded.desde").bind(clave, ahora).run();
    if (Math.random() < 0.02) context.waitUntil(db.prepare("DELETE FROM stryx_limites WHERE desde < ?").bind(ahora - 86400000).run().catch(() => {}));
    return true;
  }
  if (f.n >= max) return false;
  await db.prepare("UPDATE stryx_limites SET n = n + 1 WHERE clave = ?").bind(clave).run();
  return true;
}

/** Plus de una cuenta, o Plus sin caducidad si es administrador. */
export async function plusOAdmin(context, usuarioId) {
  const ids = (context.env.ADMIN_IDS || "").split(",").map((x) => x.trim()).filter(Boolean);
  if (ids.includes(String(usuarioId))) return { plus: { plan: "admin", caduca: 4102444800000 }, admin: true };
  return { plus: await plusDeCuenta(context.env.DB, usuarioId), admin: false };
}
