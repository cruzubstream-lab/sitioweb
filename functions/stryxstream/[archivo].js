// Descarga de StryxStream: /stryxstream/windows, /stryxstream/mac-apple y /stryxstream/mac-intel
// siempre apuntan a la versión más nueva publicada en /descargas/stryxstream.json
// (al actualizar sólo cambia ese archivo; la versión anterior se borra del release).
export async function onRequestGet(context) {
  const so = String(context.params.archivo || "").toLowerCase();
  const volver = () => Response.redirect(new URL("/#stryxstream", context.request.url).toString(), 302);
  if (!["windows", "mac-apple", "mac-intel"].includes(so)) return volver();
  const r = await context.env.ASSETS.fetch(new URL("/descargas/stryxstream.json", context.request.url));
  if (!r.ok) return volver();
  const info = await r.json();
  const destino = info[so] && info[so].url;
  if (!destino) return volver();
  return new Response(null, { status: 302, headers: { location: destino, "cache-control": "no-store" } });
}
export const onRequestHead = onRequestGet;
