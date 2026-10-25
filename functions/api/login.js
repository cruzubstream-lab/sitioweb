// Recibe el access_token de Discord, comprueba con Discord quién es y crea la sesión.
import { json, cookieSesion, nuevoToken, mismoOrigen } from "../_lib.js";

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  let datos;
  try { datos = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const accessToken = String(datos.access_token || "");
  if (!accessToken || accessToken.length > 200) return json({ error: "Falta el token de Discord" }, 400);

  const r = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return json({ error: "Discord no aceptó el inicio de sesión. Vuelve a intentarlo." }, 401);
  const u = await r.json();

  const nombre = String(u.global_name || u.username || "Jugador").slice(0, 40);
  const avatar = u.avatar
    ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64`
    : `https://cdn.discordapp.com/embed/avatars/${Number((BigInt(u.id) >> 22n) % 6n)}.png`;
  const ahora = Math.floor(Date.now() / 1000);
  const token = nuevoToken();
  const db = context.env.DB;

  await db.batch([
    db.prepare(
      "INSERT INTO usuarios (id, nombre, avatar, creado) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nombre = CASE WHEN usuarios.personalizado = 1 THEN usuarios.nombre ELSE excluded.nombre END, avatar = CASE WHEN usuarios.personalizado = 1 THEN usuarios.avatar ELSE excluded.avatar END"
    ).bind(u.id, nombre, avatar, ahora),
    db.prepare("INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)").bind(token, u.id, ahora + 30 * 86400),
    db.prepare("DELETE FROM sesiones WHERE expira < ?").bind(ahora),
  ]);

  return json({ usuario: { id: u.id, nombre, avatar } }, 200, { "set-cookie": cookieSesion(token) });
}
