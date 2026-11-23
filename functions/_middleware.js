// Cabeceras de seguridad para todas las respuestas (páginas estáticas y API).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data: https:",
  "connect-src 'self' https://accounts.google.com/gsi/",
  "frame-src https://accounts.google.com/gsi/",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "upgrade-insecure-requests",
].join("; ");

export async function onRequest(context) {
  const url = new URL(context.request.url);
  // Forzar HTTPS
  if (url.protocol === "http:" && url.hostname !== "localhost") {
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }
  const res = await context.next();
  const r = new Response(res.body, res);
  const h = r.headers;
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  const tipo = h.get("content-type") || "";
  if (tipo.includes("text/html")) h.set("Content-Security-Policy", CSP);
  return r;
}
