/**
 * Smoke-test the generated static site after Vite has finished.
 * This catches stale domains, unresolved templates, missing assets, and an
 * accidentally reintroduced public/CNAME before the artifact reaches CF.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

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

for (const file of requiredHtml) {
  if (!fs.existsSync(path.join(DIST, file))) fail(`missing ${file}`);
}

const htmlFiles = walkHtml(DIST);
for (const filePath of htmlFiles) {
  const relative = path.relative(DIST, filePath);
  const html = fs.readFileSync(filePath, "utf8");
  for (const forbidden of ["{{", "ogcms", "about.ogatomo.net", "../src/"]) {
    if (html.includes(forbidden)) fail(`${relative} contains forbidden text: ${forbidden}`);
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

console.log(`[check-build] OK · html=${htmlFiles.length}`);
