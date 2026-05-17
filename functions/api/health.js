export function onRequestGet() {
  return new Response(JSON.stringify({ ok: true, runtime: "cloudflare-pages" }), {
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
}
