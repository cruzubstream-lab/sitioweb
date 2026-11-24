// Qué plataformas se pueden conectar con la cuenta (según las variables configuradas en Cloudflare).
import { json } from "../../../_lib.js";
import { PROVEEDORES, configurado } from "./_proveedores.js";
export async function onRequestGet(context) {
  const r = {};
  for (const p of Object.keys(PROVEEDORES)) r[p] = configurado(context.env, p);
  return json({ ok: true, plataformas: r, twitchClientId: context.env.TWITCH_CLIENT_ID || null });
}
