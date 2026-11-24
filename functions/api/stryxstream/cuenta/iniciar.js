// La app pide un código para iniciar sesión. POST -> { codigo, secreto, url }
import { json } from "../../../_lib.js";
import { asegurarCuentas, nuevoCodigo, aleatorio, dentroDelLimite } from "../_licencias.js";

export async function onRequestPost(context) {
  const db = context.env.DB;
  await asegurarCuentas(db);
  if (!(await dentroDelLimite(context, "iniciar", 20, 3600000))) return json({ ok: false, error: "Demasiados intentos. Espera un rato y vuelve a probar." }, 429);
  const ahora = Date.now();
  await db.prepare("DELETE FROM stryx_vinculos WHERE creado < ?").bind(ahora - 15 * 60000).run();
  const codigo = nuevoCodigo(), secreto = aleatorio(24);
  await db.prepare("INSERT INTO stryx_vinculos (codigo, secreto, creado) VALUES (?, ?, ?)").bind(codigo, secreto, ahora).run();
  const url = new URL("/?vincular=" + codigo + "#stryxstream", context.request.url).toString();
  return json({ ok: true, codigo, secreto, url, caduca: ahora + 10 * 60000 });
}
