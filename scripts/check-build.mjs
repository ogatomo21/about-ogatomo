/**
 * Smoke-test the generated static site after Vite has finished.
 * This catches stale domains, unresolved templates, missing assets, and an
 * accidentally reintroduced public/CNAME before the artifact reaches CF.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DIST = path.join(ROOT, "dist");
const requiredHtml = [
  "index.html",
  "index.ja.html",
  "index.en.html",
  "works.ja.html",
  "works.en.html",
  "404.html",
  "404.ja.html",
  "404.en.html",
];

function fail(message) {
  throw new Error(`[check-build] ${message}`);
}

function walkHtml(dir, output = []) {
  if (!fs.existsSync(dir)) return output;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkHtml(full, output);
    else if (entry.name.endsWith(".html")) output.push(full);
  }
  return output;
}

if (!fs.existsSync(DIST)) fail("dist/ does not exist");
if (fs.existsSync(path.join(DIST, "CNAME"))) fail("dist/CNAME must not be emitted for Cloudflare");
if (!fs.existsSync(path.join(DIST, "_headers"))) fail("dist/_headers is missing");

for (const file of requiredHtml) {
  if (!fs.existsSync(path.join(DIST, file))) fail(`missing ${file}`);
}

const htmlFiles = walkHtml(DIST);
for (const filePath of htmlFiles) {
  const relative = path.relative(DIST, filePath);
  const html = fs.readFileSync(filePath, "utf8");
  if (/^404(?:\.(?:ja|en))?\.html$/.test(relative)) {
    const baseHref = html.match(/<base\s+href="([^"]+)"/)?.[1] || "";
    const assets = [...html.matchAll(/(?:src|href)="((?:\.\/|\/)(?:assets\/[^"\s]+|favicon\.ico))"/g)];
    if (assets.length < 3) fail(`${relative} is missing CSS, JavaScript, or favicon references`);
    for (const requestPath of ["/missing/page", "/missing/deep/"]) {
      const base = new URL(baseHref, `https://about.ogtm.dev${requestPath}`);
      for (const [, asset] of assets) {
        const resolved = new URL(asset, base);
        const expected = new URL(asset, "https://about.ogtm.dev/");
        if (resolved.href !== expected.href || !fs.existsSync(path.join(DIST, resolved.pathname.slice(1)))) {
          fail(`${relative} cannot load ${asset} from ${requestPath}`);
        }
      }
    }
  }
  for (const forbidden of ["{{", "ogcms", "about.ogatomo.net", "../src/"]) {
    if (html.includes(forbidden)) fail(`${relative} contains forbidden text: ${forbidden}`);
  }
  if (/about\.ogtm\.dev\/(?:index|works|404)\.(?:ja|en)\.html/.test(html)) {
    fail(`${relative} contains a non-canonical .html public URL`);
  }
  if (/(?:href|content)="\/?(?:index|works|404)\.(?:ja|en)\.html/.test(html)) {
    fail(`${relative} contains an internal .html public URL`);
  }

  const attributes = html.match(/(?:src|srcset)="([^"]+)"/g) || [];
  for (const attribute of attributes) {
    const value = attribute.replace(/^[^=]+="|"$/g, "");
    for (const candidate of value.split(",")) {
      const asset = candidate.trim().split(/\s+/)[0];
      if (asset.startsWith("/images/")) {
        fail(`${relative} contains a root-absolute local image: ${asset}`);
      }
      if (!asset.startsWith("./images/")) continue;
      const assetPath = path.resolve(DIST, asset.slice(2));
      if (!assetPath.startsWith(`${path.resolve(DIST, "images")}${path.sep}`)) {
        fail(`${relative} references an image outside dist/images: ${asset}`);
      }
      if (!fs.existsSync(assetPath)) fail(`${relative} references missing image: ${asset}`);
    }
  }
}

const indexJa = fs.readFileSync(path.join(DIST, "index.ja.html"), "utf8");
if (!indexJa.includes("media-card") || !indexJa.includes('id="json-ld-person"')) {
  fail("index.ja.html is missing injected content");
}

const notFound = fs.readFileSync(path.join(DIST, "404.html"), "utf8");
if (notFound.includes("location.replace")) {
  fail("404.html must preserve the original 404 response instead of redirecting");
}

const staleImageNames = [];
function findStaleImageNames(dir) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) findStaleImageNames(full);
    else if (/-(?:960|1600)\.(?:avif|webp)$/i.test(entry.name)) staleImageNames.push(full);
  }
}
findStaleImageNames(path.join(DIST, "images"));
if (staleImageNames.length > 0) {
  fail(`obsolete oversized image candidates remain: ${staleImageNames.length}`);
}

for (const file of fs.readdirSync(DIST, { recursive: true })) {
  if (!/\.(png|jpe?g|webp|avif|gif|tiff?)$/i.test(file)) continue;
  const metadata = await sharp(path.join(DIST, file)).metadata();
  if (metadata.exif || metadata.xmp || metadata.iptc || metadata.orientation) {
    fail(`${file} still contains image metadata`);
  }
}

console.log(`[check-build] OK · html=${htmlFiles.length} · image metadata stripped`);
