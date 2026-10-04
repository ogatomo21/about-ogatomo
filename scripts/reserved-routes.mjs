import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function reservedRoutes(files) {
  const paths = new Set(["/", "/index", "/works", "/404", "/assets", "/images", "/api", "/admin", "/manage", "/register", "/list", "/delete", "/info", "/.well-known", "/reserved-routes.json"]);
  for (const file of files) {
    if (file.split("/").some(part => part.startsWith("_") || part === ".tmp")) continue;
    paths.add(`/${file}`);
    if (file.includes("/")) paths.add(`/${file.split("/")[0]}`);
    if (file.endsWith(".html")) {
      paths.add(`/${file.slice(0, -5)}`);
      if (file.endsWith("index.html")) {
        paths.add(`/${file.slice(0, -10)}`);
        paths.add(`/${file.slice(0, -11)}` || "/");
      }
    }
  }
  return { version: 1, paths: [...paths].sort() };
}

export function checkCollisions(manifest, rows) {
  const reserved = new Set(manifest.paths);
  const conflicts = rows.filter(row => reserved.has(`/${row.slug}`));
  if (conflicts.length) throw new Error(`Static route conflicts: ${conflicts.map(row => row.slug).join(", ")}`);
}

export async function generateReservedRoutes(dist) {
  const files = fs.readdirSync(dist, { recursive: true }).filter(file => fs.statSync(path.join(dist, file)).isFile()).map(file => file.replaceAll("\\", "/"));
  const manifest = reservedRoutes(files);
  fs.writeFileSync(path.join(dist, "reserved-routes.json"), JSON.stringify(manifest));
  fs.writeFileSync(path.join(dist, "_routes.json"), JSON.stringify({ version: 1, include: ["/*"], exclude: ["/assets/*", "/images/*", "/favicon.ico", "/reserved-routes.json", "/robots.txt", "/sitemap.xml"] }));
  // Cloudflare Pages must check the live database before publishing any new route.
  if (process.env.CF_PAGES === "1" || process.env.CHECK_LIVE_ROUTES === "1") {
    const { CF_ACCOUNT_ID, LINKS_DATABASE_ID, CF_D1_READ_TOKEN } = process.env;
    if (!CF_ACCOUNT_ID || !LINKS_DATABASE_ID || !CF_D1_READ_TOKEN) throw new Error("Route gate requires CF_ACCOUNT_ID, LINKS_DATABASE_ID, CF_D1_READ_TOKEN");
    const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/d1/database/${LINKS_DATABASE_ID}/query`, {
      method: "POST", headers: { Authorization: `Bearer ${CF_D1_READ_TOKEN}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql: "SELECT slug FROM links" }), signal: AbortSignal.timeout(15000)
    });
    const body = await response.json();
    if (!response.ok || !body.success || !body.result?.[0]?.success) throw new Error("Live route collision check unavailable");
    checkCollisions(manifest, body.result[0].results);
  }
  return manifest;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  await generateReservedRoutes(path.resolve("dist"));
}
