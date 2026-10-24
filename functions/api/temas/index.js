// Lista de temas del foro (GET) y crear tema (POST, requiere sesión).
import { json, usuarioActual, limpiar, CATEGORIAS, mismoOrigen } from "../../_lib.js";

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const cat = url.searchParams.get("categoria");
  const filtro = CATEGORIAS.includes(cat) ? cat : null;
  const sql =
    "SELECT t.id, t.categoria, t.titulo, substr(t.cuerpo, 1, 180) AS extracto, t.creado, t.actualizado, t.respuestas, u.nombre, u.avatar " +
    "FROM temas t JOIN usuarios u ON u.id = t.usuario_id " +
    (filtro ? "WHERE t.categoria = ? " : "") +
    "ORDER BY t.actualizado DESC LIMIT 50";
  const q = context.env.DB.prepare(sql);
  const { results } = await (filtro ? q.bind(filtro) : q).all();
  return json({ temas: results });
}

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const usuario = await usuarioActual(context);
  if (!usuario) return json({ error: "Inicia sesión para crear un tema." }, 401);
  let d;
  try { d = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const titulo = limpiar(d.titulo, 120);
  const cuerpo = limpiar(d.cuerpo, 5000);
  const categoria = CATEGORIAS.includes(d.categoria) ? d.categoria : "general";
  if (titulo.length < 4) return json({ error: "El título necesita al menos 4 letras." }, 400);
  if (cuerpo.length < 4) return json({ error: "Escribe un poco más en el mensaje." }, 400);

  const ahora = Math.floor(Date.now() / 1000);
  const reciente = await context.env.DB.prepare(
    "SELECT COUNT(*) AS n FROM temas WHERE usuario_id = ? AND creado > ?"
  ).bind(usuario.id, ahora - 60).first();
  if (reciente.n > 0) return json({ error: "Espera un minuto antes de crear otro tema." }, 429);

  const r = await context.env.DB.prepare(
    "INSERT INTO temas (usuario_id, categoria, titulo, cuerpo, creado, actualizado) VALUES (?, ?, ?, ?, ?, ?)"
  ).bind(usuario.id, categoria, titulo, cuerpo, ahora, ahora).run();
  return json({ id: r.meta.last_row_id }, 201);
}
