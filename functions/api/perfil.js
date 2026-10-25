// Editar el perfil propio: nombre de usuario y foto.
import { json, usuarioActual, mismoOrigen } from "../_lib.js";

const MAX_FOTO = 90000; // ~65 KB de imagen en base64

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const usuario = await usuarioActual(context);
  if (!usuario) return json({ error: "Inicia sesión primero." }, 401);
  let d;
  try { d = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }

  const nombre = String(d.nombre || "").replace(/\s+/g, " ").trim();
  if (nombre.length < 3 || nombre.length > 20) return json({ error: "El nombre debe tener entre 3 y 20 caracteres." }, 400);
  if (!/^[\p{L}\p{N} _.\-]+$/u.test(nombre)) return json({ error: "Usa solo letras, números, espacios, guion, punto o guion bajo." }, 400);

  const db = context.env.DB;
  const repetido = await db.prepare("SELECT id FROM usuarios WHERE lower(nombre) = lower(?) AND id != ?").bind(nombre, usuario.id).first();
  if (repetido) return json({ error: "Ese nombre ya lo usa otra persona. Prueba con otro." }, 409);

  let avatar = usuario.avatar, foto = undefined;
  if (typeof d.foto === "string" && d.foto) {
    if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(d.foto)) return json({ error: "La foto no es una imagen válida." }, 400);
    if (d.foto.length > MAX_FOTO) return json({ error: "La foto pesa demasiado. Elige otra más pequeña." }, 400);
    foto = d.foto;
    avatar = "/api/avatar/" + encodeURIComponent(usuario.id) + "?v=" + Date.now().toString(36);
  } else if (typeof d.avatarUrl === "string" && /^https:\/\/(lh\d\.googleusercontent\.com|cdn\.discordapp\.com)\//.test(d.avatarUrl)) {
    avatar = d.avatarUrl; foto = null;
  }

  if (foto !== undefined) {
    await db.prepare("UPDATE usuarios SET nombre = ?, avatar = ?, foto = ?, personalizado = 1 WHERE id = ?").bind(nombre, avatar, foto, usuario.id).run();
  } else {
    await db.prepare("UPDATE usuarios SET nombre = ?, personalizado = 1 WHERE id = ?").bind(nombre, usuario.id).run();
  }
  return json({ usuario: { id: usuario.id, nombre, avatar, personalizado: 1, proveedor: usuario.proveedor } });
}
