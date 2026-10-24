// Descargas protegidas: sin sesión, vuelve a la página para iniciar sesión.
import { usuarioActual } from "../_lib.js";

const BASE = "https://github.com/cruzubstream-lab/sitioweb/releases/download/launcher/";
const ARCHIVOS = {
  windows: BASE + "MultiverSafio-Windows-Instalador.exe",
  "mac-apple": BASE + "MultiverSafio-Mac-Apple-M1-M4.dmg",
  "mac-intel": BASE + "MultiverSafio-Mac-Intel.dmg",
  "windows-alterno": "https://www.mediafire.com/file/k1sdwfidxthf2t9/MultiverSafio-Windows-Instalador.exe/file",
};

export async function onRequestGet(context) {
  const clave = String(context.params.archivo || "");
  const destino = ARCHIVOS[clave];
  if (!destino) return Response.redirect(new URL("/#descargar", context.request.url).toString(), 302);

  const usuario = await usuarioActual(context);
  if (!usuario) {
    const u = new URL("/", context.request.url);
    u.searchParams.set("entrar", clave);
    u.hash = "descargar";
    return Response.redirect(u.toString(), 302);
  }

  context.waitUntil(
    context.env.DB.prepare("INSERT INTO descargas (usuario_id, archivo, creado) VALUES (?, ?, ?)")
      .bind(usuario.id, clave, Math.floor(Date.now() / 1000)).run().catch(() => {})
  );
  return new Response(null, { status: 302, headers: { location: destino, "cache-control": "no-store" } });
}
