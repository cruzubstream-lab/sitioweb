// Cierra la sesión.
import { json, leerCookie, cookieSesion, COOKIE, mismoOrigen } from "../_lib.js";

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const token = leerCookie(context.request, COOKIE);
  if (token) await context.env.DB.prepare("DELETE FROM sesiones WHERE token = ?").bind(token).run();
  return json({ ok: true }, 200, { "set-cookie": cookieSesion("", 0) });
}
