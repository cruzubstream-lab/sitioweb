// Inicio de sesión con Google (Gmail): verifica el ID token con Google y crea la sesión.
import { json, cookieSesion, nuevoToken, mismoOrigen } from "../_lib.js";

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const clientId = context.env.GOOGLE_CLIENT_ID;
  if (!clientId) return json({ error: "El inicio con Google aún no está activado." }, 503);
  let datos;
  try { datos = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const credencial = String(datos.credential || "");
  if (!credencial || credencial.length > 4096) return json({ error: "Falta la credencial de Google" }, 400);

  const r = await fetch("https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(credencial));
  if (!r.ok) return json({ error: "Google no aceptó el inicio de sesión. Vuelve a intentarlo." }, 401);
  const g = await r.json();
  const emisorOk = g.iss === "accounts.google.com" || g.iss === "https://accounts.google.com";
  if (g.aud !== clientId || !emisorOk || Number(g.exp) * 1000 < Date.now() || !g.sub) {
    return json({ error: "La credencial de Google no es válida." }, 401);
  }

  const id = "g:" + g.sub;
  const nombre = String(g.name || g.given_name || "Jugador").slice(0, 40);
  const avatar = g.picture || "https://cdn.discordapp.com/embed/avatars/0.png";
  const ahora = Math.floor(Date.now() / 1000);
  const token = nuevoToken();
  const db = context.env.DB;
  await db.batch([
    db.prepare(
      "INSERT INTO usuarios (id, nombre, avatar, creado) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET nombre = excluded.nombre, avatar = excluded.avatar"
    ).bind(id, nombre, avatar, ahora),
    db.prepare("INSERT INTO sesiones (token, usuario_id, expira) VALUES (?, ?, ?)").bind(token, id, ahora + 30 * 86400),
  ]);
  return json({ usuario: { id, nombre, avatar } }, 200, { "set-cookie": cookieSesion(token) });
}
