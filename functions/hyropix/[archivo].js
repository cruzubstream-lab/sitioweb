// Descarga de HyroPix: /hyropix/mac y /hyropix/windows siempre apuntan a la versión más nueva
// publicada en /descargas/hyropix.json (al actualizar sólo cambia ese archivo).
export async function onRequestGet(context) {
  const so = String(context.params.archivo || "").toLowerCase();
  if (so !== "mac" && so !== "windows") return Response.redirect(new URL("/#hyropix", context.request.url).toString(), 302);
  const r = await context.env.ASSETS.fetch(new URL("/descargas/hyropix.json", context.request.url));
  if (!r.ok) return Response.redirect(new URL("/#hyropix", context.request.url).toString(), 302);
  const info = await r.json();
  const destino = info[so] && info[so].url;
  if (!destino) return Response.redirect(new URL("/#hyropix", context.request.url).toString(), 302);
  return new Response(null, { status: 302, headers: { location: destino, "cache-control": "no-store" } });
}
