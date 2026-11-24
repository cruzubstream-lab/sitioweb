// Cierra la sesión de la app en este equipo.
import { json } from "../../../_lib.js";
import { usuarioApp } from "../_licencias.js";

export async function onRequestPost(context) {
  const u = await usuarioApp(context);
  if (u) await context.env.DB.prepare("DELETE FROM stryx_tokens WHERE token = ?").bind(u.token).run(); // u.token ya es la huella
  return json({ ok: true });
}
