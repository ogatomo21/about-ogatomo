export async function onRequest({ request, env }) {
  const asset = await env.ASSETS.fetch(request);
  if (asset.status !== 404 || !["GET", "HEAD"].includes(request.method)) return asset;
  const pathname = new URL(request.url).pathname;
  if (!/^\/[^/]+$/.test(pathname)) return asset;
  let slug;
  try { slug = decodeURIComponent(pathname.slice(1)); } catch { return asset; }
  if (/[\/?#\u0000-\u001f\u007f]/.test(slug)) return asset;
  let link;
  try {
    link = await env.DB.prepare("SELECT id,url FROM links WHERE slug=? AND enabled=1 AND deleted_at IS NULL")
      .bind(slug).first();
  } catch {
    return new Response("Service unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (!link) return asset;
  try {
    const target = new URL(link.url);
    if (!["http:", "https:"].includes(target.protocol)) throw new Error("Invalid destination");
  } catch {
    return new Response("Service unavailable", { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (request.method === "GET") {
    try { env.LINK_ANALYTICS?.writeDataPoint({ indexes: [link.id], doubles: [1] }); }
    catch { /* Analytics must never interrupt a redirect. */ }
  }
  return new Response(null, { status: 302, headers: { Location: link.url, "Cache-Control": "no-store" } });
}
