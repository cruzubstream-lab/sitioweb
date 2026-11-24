// Datos de la cuenta conectada en la app (Authorization: Bearer <token>).
import { json } from "../../../_lib.js";
import { usuarioApp, plusOAdmin } from "../_licencias.js";

export async function onRequestGet(context) {
  const u = await usuarioApp(context);
  if (!u) return json({ ok: false, error: "Sesión no válida" }, 401);
  const { plus, admin } = await plusOAdmin(context, u.id);
  return json({ ok: true, usuario: { id: u.id, nombre: u.nombre, avatar: u.avatar }, plus, admin });
}
