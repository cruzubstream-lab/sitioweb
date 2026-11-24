// La app pregunta si ya se conectó la cuenta. POST { estado, secreto } -> { pendiente } | { canal, tok }
// Los tokens se entregan una sola vez y se borran del servidor.
import { json } from "../../../_lib.js";
import { usuarioApp, dentroDelLimite } from "../_licencias.js";
import { PROVEEDORES, asegurarOauth, descifrar, huella } from "./_proveedores.js";

export async function onRequestPost(context) {
  const u = await usuarioApp(context);
  if (!u) return json({ ok: false, error: "Inicia sesión en la app primero" }, 401);
  if (!(await dentroDelLimite(context, "oauth-estado", 600, 3600000))) return json({ ok: false, error: "Demasiados intentos" }, 429);
  let body = {}; try { body = await context.request.json(); } catch {}
  const estado = String(body.estado || ""), secreto = String(body.secreto || "");
  if (!/^[0-9a-f]{48}$/.test(estado) || !/^[0-9a-f]{64}$/.test(secreto)) return json({ ok: false, error: "Datos no válidos" }, 400);
  const db = context.env.DB;
  await asegurarOauth(db);
  const f = await db.prepare("SELECT * FROM stryx_oauth WHERE estado = ?").bind(estado).first();
  if (!f || f.usuario_id !== u.id || f.secreto_h !== (await huella(secreto))) return json({ ok: false, error: "El inicio de sesión caducó. Vuelve a intentarlo." }, 410);
  if (f.error) { await db.prepare("DELETE FROM stryx_oauth WHERE estado = ?").bind(estado).run(); return json({ ok: false, error: f.error }, 400); }
  if (!f.resultado) return json({ ok: true, pendiente: true });
  await db.prepare("DELETE FROM stryx_oauth WHERE estado = ?").bind(estado).run();
  const r = await descifrar(context.env[PROVEEDORES[f.plat].secreto], f.resultado);
  return json({ ok: true, plat: f.plat, canal: r.canal, tok: r.tok });
}
