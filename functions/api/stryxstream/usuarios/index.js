// Panel: personas que han iniciado sesión en la app StryxStream (solo administradores).
import { json, usuarioActual, esAdmin } from "../../../_lib.js";
import { asegurarCuentas } from "../_licencias.js";

export async function onRequestGet(context) {
  if (!esAdmin(context, await usuarioActual(context))) return json({ ok: false, error: "Solo administradores" }, 403);
  await asegurarCuentas(context.env.DB);
  const { results } = await context.env.DB.prepare(
    "SELECT c.usuario_id AS id, u.nombre, u.avatar, c.primera, c.ultima, c.plan, c.caduca, c.nota FROM stryx_cuentas c LEFT JOIN usuarios u ON u.id = c.usuario_id ORDER BY c.ultima DESC LIMIT 2000"
  ).all();
  return json({ ok: true, usuarios: results });
}
