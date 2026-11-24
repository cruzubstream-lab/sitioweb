// La app StryxStream activa y comprueba aquí la clave Plus.
// POST { key, device } -> { ok, plan, expiresAt }
import { json } from "../../../_lib.js";
import { asegurarTabla, PLANES, FORMATO, dentroDelLimite } from "../_licencias.js";

export async function onRequestPost(context) {
  const { DB } = context.env;
  let body;
  try { body = await context.request.json(); } catch { return json({ ok: false, error: "Petición no válida" }, 400); }
  const clave = String(body.key || "").trim().toUpperCase();
  const equipo = String(body.device || "").slice(0, 80);
  if (!FORMATO.test(clave) || !equipo) return json({ ok: false, error: "Clave no válida" }, 400);

  await asegurarTabla(DB);
  // Evita que se prueben claves al azar: máximo 30 intentos por hora y conexión.
  if (!(await dentroDelLimite(context, "activar", 30, 3600000))) return json({ ok: false, error: "Demasiados intentos. Espera un rato y vuelve a probar." }, 429);
  const lic = await DB.prepare("SELECT * FROM stryx_licencias WHERE clave = ?").bind(clave).first();
  if (!lic || lic.anulada) return json({ ok: false, error: "Clave no válida" }, 404);

  const ahora = Date.now();
  if (!lic.equipo) {
    // Primera activación (o tras moverla de PC): se vincula a este equipo.
    // Los días empiezan a contar al activarla; si se movió de PC, conserva la fecha.
    const caduca = lic.caduca || ahora + PLANES[lic.plan] * 86400000;
    await DB.prepare("UPDATE stryx_licencias SET equipo = ?, activada = COALESCE(activada, ?), caduca = ? WHERE clave = ?")
      .bind(equipo, ahora, caduca, clave).run();
    lic.caduca = caduca;
  } else if (lic.equipo !== equipo) {
    return json({ ok: false, error: "Esta clave ya está activada en otro equipo. Abre un ticket para moverla." }, 403);
  }
  if (lic.caduca <= ahora) return json({ ok: false, error: "Tu clave Plus ha caducado" }, 403);
  return json({ ok: true, plan: lic.plan, expiresAt: lic.caduca });
}

export function onRequestGet() {
  return json({ ok: false, error: "Usa POST" }, 405);
}
