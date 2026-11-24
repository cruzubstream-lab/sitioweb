// Dar o quitar Plus a la cuenta de una persona. POST { accion: "dar", plan, nota } | { accion: "quitar" }
// Al dar Plus, los días se suman a los que ya tenga.
import { json, usuarioActual, esAdmin, mismoOrigen, limpiar } from "../../../_lib.js";
import { asegurarCuentas, PLANES, usuarioApp } from "../_licencias.js";

/** Admin con la sesión de la web (cookie) o de la app (Authorization: Bearer). */
async function admin(context) {
  const app = (context.request.headers.get("authorization") || "").startsWith("Bearer ");
  const u = app ? await usuarioApp(context) : await usuarioActual(context);
  return { ok: esAdmin(context, u), app };
}


export async function onRequestPost(context) {
  const a = await admin(context);
  // La protección de origen es para la sesión de la web (cookie); la app usa su propio token.
  if (!a.app && !mismoOrigen(context.request)) return json({ ok: false, error: "Origen no permitido" }, 403);
  if (!a.ok) return json({ ok: false, error: "Solo administradores" }, 403);
  const id = String(context.params.id || "").slice(0, 80);
  let body = {};
  try { body = await context.request.json(); } catch {}
  const db = context.env.DB;
  await asegurarCuentas(db);
  const c = await db.prepare("SELECT * FROM stryx_cuentas WHERE usuario_id = ?").bind(id).first();
  if (!c) return json({ ok: false, error: "Esa persona aún no ha iniciado sesión en la app" }, 404);
  if (body.accion === "quitar") {
    await db.prepare("UPDATE stryx_cuentas SET plan = NULL, caduca = NULL WHERE usuario_id = ?").bind(id).run();
    return json({ ok: true });
  }
  if (body.accion !== "dar" || !PLANES[body.plan]) return json({ ok: false, error: "Plan no válido" }, 400);
  const base = Math.max(Date.now(), c.caduca || 0);
  const caduca = base + PLANES[body.plan] * 86400000;
  await db.prepare("UPDATE stryx_cuentas SET plan = ?, caduca = ?, nota = ? WHERE usuario_id = ?")
    .bind(body.plan, caduca, limpiar(body.nota, 200) || c.nota, id).run();
  return json({ ok: true, plan: body.plan, caduca });
}
