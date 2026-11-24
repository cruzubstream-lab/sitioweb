// POST { accion: "mover" | "anular" } sobre una clave (solo administradores).
import { json, usuarioActual, esAdmin, mismoOrigen } from "../../../_lib.js";
import { asegurarTabla, FORMATO } from "../_licencias.js";

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ ok: false, error: "Origen no permitido" }, 403);
  if (!esAdmin(context, await usuarioActual(context))) return json({ ok: false, error: "Solo administradores" }, 403);
  const clave = String(context.params.clave || "").toUpperCase();
  if (!FORMATO.test(clave)) return json({ ok: false, error: "Clave no válida" }, 400);
  let body = {};
  try { body = await context.request.json(); } catch {}
  await asegurarTabla(context.env.DB);
  const sql = body.accion === "mover"
    ? "UPDATE stryx_licencias SET equipo = NULL WHERE clave = ?" // conserva la caducidad
    : body.accion === "anular" ? "UPDATE stryx_licencias SET anulada = 1 WHERE clave = ?" : null;
  if (!sql) return json({ ok: false, error: "Acción no válida" }, 400);
  const r = await context.env.DB.prepare(sql).bind(clave).run();
  if (!r.meta || !r.meta.changes) return json({ ok: false, error: "No existe esa clave" }, 404);
  return json({ ok: true });
}
