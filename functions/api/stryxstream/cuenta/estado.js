// La app pregunta si ya se confirmó el código. POST { codigo, secreto } -> { pendiente } o { token, usuario }
import { json } from "../../../_lib.js";
import { asegurarCuentas, plusDeCuenta, dentroDelLimite } from "../_licencias.js";

export async function onRequestPost(context) {
  let body = {};
  try { body = await context.request.json(); } catch {}
  const codigo = String(body.codigo || "").toUpperCase(), secreto = String(body.secreto || "");
  const db = context.env.DB;
  await asegurarCuentas(db);
  if (!(await dentroDelLimite(context, "estado", 600, 3600000))) return json({ ok: false, error: "Demasiados intentos. Espera un rato." }, 429);
  const v = await db.prepare("SELECT * FROM stryx_vinculos WHERE codigo = ? AND secreto = ?").bind(codigo, secreto).first();
  if (!v || v.creado < Date.now() - 10 * 60000) return json({ ok: false, error: "El código caducó. Vuelve a intentarlo." }, 410);
  if (!v.token) return json({ ok: true, pendiente: true });
  const u = await db.prepare("SELECT id, nombre, avatar FROM usuarios WHERE id = ?").bind(v.usuario_id).first();
  await db.prepare("DELETE FROM stryx_vinculos WHERE codigo = ?").bind(codigo).run();
  return json({ ok: true, token: v.token, usuario: u, plus: await plusDeCuenta(db, v.usuario_id) });
}
