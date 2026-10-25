// Sorteo por votos: al llegar a META usuarios registrados se cierra y gana el más votado.
import { json, usuarioActual, mismoOrigen } from "../_lib.js";

const META = 90;

async function estado(context, usuario) {
  const db = context.env.DB;
  const reg = await db.prepare("SELECT COUNT(*) AS n FROM usuarios").first();
  const registrados = reg.n;
  const { results } = await db.prepare(
    "SELECT p.usuario_id AS id, u.nombre, u.avatar, p.creado, " +
    "(SELECT COUNT(*) FROM sorteo_votos v WHERE v.participante_id = p.usuario_id) AS votos " +
    "FROM sorteo_participantes p JOIN usuarios u ON u.id = p.usuario_id " +
    "ORDER BY votos DESC, p.creado ASC"
  ).all();
  let miVoto = null, yoParticipo = false;
  if (usuario) {
    const v = await db.prepare("SELECT participante_id FROM sorteo_votos WHERE votante_id = ?").bind(usuario.id).first();
    miVoto = v ? v.participante_id : null;
    yoParticipo = results.some((p) => p.id === usuario.id);
  }
  const cerrado = registrados >= META;
  return {
    meta: META,
    registrados,
    cerrado,
    ganador: cerrado && results.length && results[0].votos > 0 ? results[0] : null,
    participantes: results,
    miVoto,
    yoParticipo,
  };
}

export async function onRequestGet(context) {
  const usuario = await usuarioActual(context);
  return json(await estado(context, usuario));
}

// POST {accion: "participar"} o {accion: "votar", participante: id}
export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ error: "Origen no permitido" }, 403);
  const usuario = await usuarioActual(context);
  if (!usuario) return json({ error: "Inicia sesión para participar o votar." }, 401);
  let d;
  try { d = await context.request.json(); } catch { return json({ error: "Petición inválida" }, 400); }
  const db = context.env.DB;
  const actual = await estado(context, usuario);
  if (actual.cerrado) return json({ error: "El sorteo ya terminó." }, 409);
  const ahora = Math.floor(Date.now() / 1000);

  if (d.accion === "participar") {
    await db.prepare("INSERT OR IGNORE INTO sorteo_participantes (usuario_id, creado) VALUES (?, ?)").bind(usuario.id, ahora).run();
  } else if (d.accion === "salir") {
    await db.batch([
      db.prepare("DELETE FROM sorteo_participantes WHERE usuario_id = ?").bind(usuario.id),
      db.prepare("DELETE FROM sorteo_votos WHERE participante_id = ?").bind(usuario.id),
    ]);
  } else if (d.accion === "votar") {
    const id = String(d.participante || "");
    if (id === usuario.id) return json({ error: "No puedes votarte a ti mismo." }, 400);
    if (!actual.participantes.some((p) => p.id === id)) return json({ error: "Ese participante no existe." }, 404);
    await db.prepare(
      "INSERT INTO sorteo_votos (votante_id, participante_id, creado) VALUES (?, ?, ?) ON CONFLICT(votante_id) DO UPDATE SET participante_id = excluded.participante_id, creado = excluded.creado"
    ).bind(usuario.id, id, ahora).run();
  } else {
    return json({ error: "Acción desconocida" }, 400);
  }
  return json(await estado(context, usuario));
}
