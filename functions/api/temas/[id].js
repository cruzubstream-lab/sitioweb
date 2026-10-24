// Ver un tema con sus respuestas (GET), responder (POST) y borrar (DELETE, autor o admin).
import { json, usuarioActual, esAdmin, limpiar, mismoOrigen } from "../../_lib.js";

function idValido(p) {
  const id = Number(p);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function onRequestGet(context) {
  const id = idValido(context.params.id);
  if (!id) return json({ error: "Tema no encontrado" }, 404);
  const db = context.env.DB;
  const tema = await db.prepare(
    "SELECT t.id, t.usuario_id, t.categoria, t.titulo, t.cuerpo, t.creado, t.respuestas, u.nombre, u.avatar FROM temas t JOIN usuarios u ON u.id = t.usuario_id WHERE t.id = ?"
  ).bind(id).first();
  if (!tema) return json({ error: "Tema no encontrado" }, 404);
  const { results } = await db.prepare(
    "SELECT r.id, r.usuario_id, r.cuerpo, r.creado, u.nombre, u.avatar FROM respuestas r JOIN usuarios u ON u.id = r.usuario_id WHERE r.tema_id = ? ORDER BY r.creado ASC LIMIT 300"
  ).bind(id).all();
  return json({ tema, respuestas: results });
}

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const usuario = await usuarioActual(context);
  if (!usuario) return json({ error: "Inicia sesión para responder." }, 401);
  const id = idValido(context.params.id);
  if (!id) return json({ error: "Tema no encontrado" }, 404);
  let d;
  try { d = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const cuerpo = limpiar(d.cuerpo, 3000);
  if (cuerpo.length < 2) return json({ error: "La respuesta está vacía." }, 400);

  const db = context.env.DB;
  const existe = await db.prepare("SELECT id FROM temas WHERE id = ?").bind(id).first();
  if (!existe) return json({ error: "Tema no encontrado" }, 404);
  const ahora = Math.floor(Date.now() / 1000);
  const reciente = await db.prepare(
    "SELECT COUNT(*) AS n FROM respuestas WHERE usuario_id = ? AND creado > ?"
  ).bind(usuario.id, ahora - 10).first();
  if (reciente.n > 0) return json({ error: "Espera unos segundos antes de volver a responder." }, 429);

  await db.batch([
    db.prepare("INSERT INTO respuestas (tema_id, usuario_id, cuerpo, creado) VALUES (?, ?, ?, ?)").bind(id, usuario.id, cuerpo, ahora),
    db.prepare("UPDATE temas SET respuestas = respuestas + 1, actualizado = ? WHERE id = ?").bind(ahora, id),
  ]);
  return json({ ok: true }, 201);
}

export async function onRequestDelete(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const usuario = await usuarioActual(context);
  if (!usuario) return json({ error: "Inicia sesión." }, 401);
  const id = idValido(context.params.id);
  const db = context.env.DB;
  const tema = id && (await db.prepare("SELECT usuario_id FROM temas WHERE id = ?").bind(id).first());
  if (!tema) return json({ error: "Tema no encontrado" }, 404);
  if (tema.usuario_id !== usuario.id && !esAdmin(context, usuario)) return json({ error: "Solo el autor o un admin puede borrarlo." }, 403);
  await db.batch([
    db.prepare("DELETE FROM respuestas WHERE tema_id = ?").bind(id),
    db.prepare("DELETE FROM temas WHERE id = ?").bind(id),
  ]);
  return json({ ok: true });
}
