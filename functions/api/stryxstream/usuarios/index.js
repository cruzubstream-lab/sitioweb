// Panel: personas que han iniciado sesión en la app StryxStream (solo administradores).
import { json, usuarioActual, esAdmin } from "../../../_lib.js";
import { asegurarCuentas, usuarioApp } from "../_licencias.js";

/** Admin con la sesión de la web (cookie) o de la app (Authorization: Bearer). */
async function admin(context) {
  const app = (context.request.headers.get("authorization") || "").startsWith("Bearer ");
  const u = app ? await usuarioApp(context) : await usuarioActual(context);
  return { ok: esAdmin(context, u), app };
}


export async function onRequestGet(context) {
  if (!(await admin(context)).ok) return json({ ok: false, error: "Solo administradores" }, 403);
  await asegurarCuentas(context.env.DB);
  const { results } = await context.env.DB.prepare(
    "SELECT c.usuario_id AS id, u.nombre, u.avatar, c.primera, c.ultima, c.plan, c.caduca, c.nota FROM stryx_cuentas c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.ultima DESC LIMIT 2000"
  ).all();
  const admins = (context.env.ADMIN_IDS || "").split(",").map((x) => x.trim());
  for (const u of results) u.admin = admins.includes(String(u.id));
  return json({ ok: true, usuarios: results });
}
