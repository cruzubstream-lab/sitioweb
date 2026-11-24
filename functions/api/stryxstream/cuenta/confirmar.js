// La web confirma el código con la sesión iniciada. POST { codigo }
import { json, usuarioActual, mismoOrigen } from "../../../_lib.js";
import { asegurarCuentas, aleatorio, huella } from "../_licencias.js";

export async function onRequestPost(context) {
  if (!mismoOrigen(context.request)) return json({ ok: false, error: "Origen no permitido" }, 403);
  const u = await usuarioActual(context);
  if (!u) return json({ ok: false, error: "Inicia sesión primero" }, 401);
  let body = {};
  try { body = await context.request.json(); } catch {}
  const codigo = String(body.codigo || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(codigo)) return json({ ok: false, error: "Código no válido" }, 400);
  const db = context.env.DB;
  await asegurarCuentas(db);
  const v = await db.prepare("SELECT * FROM stryx_vinculos WHERE codigo = ?").bind(codigo).first();
  if (!v || v.creado < Date.now() - 10 * 60000) return json({ ok: false, error: "El código caducó. Pide uno nuevo en la app." }, 410);
  if (v.usuario_id) return json({ ok: true, ya: true });
  const token = aleatorio(32);
  await db.batch([
    // En la base de datos solo se guarda la huella; el token en claro solo lo recibe la app una vez.
    db.prepare("INSERT INTO stryx_tokens (token, usuario_id, creado) VALUES (?, ?, ?)").bind(await huella(token), u.id, Date.now()),
    db.prepare("UPDATE stryx_vinculos SET usuario_id = ?, token = ? WHERE codigo = ?").bind(u.id, token, codigo),
    db.prepare("INSERT INTO stryx_cuentas (usuario_id, primera, ultima) VALUES (?, ?, ?) ON CONFLICT(usuario_id) DO UPDATE SET ultima = excluded.ultima").bind(u.id, Date.now(), Date.now()),
  ]);
  return json({ ok: true, nombre: u.nombre });
}
