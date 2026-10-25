// Sirve la foto de perfil subida por el usuario.
export async function onRequestGet(context) {
  const fila = await context.env.DB.prepare("SELECT foto FROM usuarios WHERE id = ?").bind(String(context.params.id)).first();
  const m = fila && fila.foto && fila.foto.match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/);
  if (!m) return Response.redirect(new URL("https://cdn.discordapp.com/embed/avatars/0.png"), 302);
  const bin = Uint8Array.from(atob(m[2]), (c) => c.charCodeAt(0));
  return new Response(bin, {
    headers: { "content-type": m[1], "cache-control": "public, max-age=86400", "x-content-type-options": "nosniff" },
  });
}
