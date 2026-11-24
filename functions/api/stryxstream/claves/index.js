// Panel de claves de StryxStream (solo administradores con sesión iniciada en la web).
// GET  -> lista de claves
// POST { plan, nota } -> crea una clave
import { json, usuarioActual, esAdmin, limpiar, mismoOrigen } from "../../../_lib.js";
import { asegurarTabla, nuevaClave, PLANES } from "../_licencias.js";

async function admin(context) {
  const u = await usuarioActual(context);
  return esAdmin(context, u) ? u : null;
}

export async function onRequestGet(context) {
  if (!(await admin(context))) return json({ ok: false, error: "Solo administradores" }, 403);
  await asegurarTabla(context.env.DB);
  const { results } = await context.env.DB.prepare(
    "SELECT clave, plan, nota, creada, equipo IS NOT NULL AS activa, activada, caduca, anulada FROM stryx_licencias ORDER BY creada DESC LIMIT 1000"
  ).all();
  return json({ ok: true, claves: results });
}

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ ok: false, error: "Origen no permitido" }, 403);
  const u = await admin(context);
  if (!u) return json({ ok: false, error: "Solo administradores" }, 403);
  let body = {};
  try { body = await context.request.json(); } catch {}
  const plan = String(body.plan || "1m");
  if (!Object.hasOwn(PLANES, String(plan))) return json({ ok: false, error: "Plan no válido" }, 400);
  await asegurarTabla(context.env.DB);
  const clave = nuevaClave();
  await context.env.DB.prepare("INSERT INTO stryx_licencias (clave, plan, nota, creada, creada_por) VALUES (?, ?, ?, ?, ?)")
    .bind(clave, plan, limpiar(body.nota, 200), Date.now(), u.id).run();
  return json({ ok: true, clave, plan });
}
