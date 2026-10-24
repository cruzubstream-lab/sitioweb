// Devuelve el usuario con sesión iniciada (o null) y el client_id de Discord.
import { json, usuarioActual, esAdmin } from "../_lib.js";

export async function onRequestGet(context) {
  const usuario = await usuarioActual(context);
  return json({
    usuario: usuario ? { ...usuario, admin: esAdmin(context, usuario) } : null,
    discordClientId: context.env.DISCORD_CLIENT_ID || "",
    googleClientId: context.env.GOOGLE_CLIENT_ID || "",
  });
}
