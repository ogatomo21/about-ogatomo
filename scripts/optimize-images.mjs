/**
 * Image derivatives for <picture> (AVIF / WebP).
 *
 * Source (never written): public/images/**
 * Output only:           .tmp/images/**  (dev serve + merge into dist on build)
 *
 *  - png/jpg/jpeg → .tmp/.../name.webp + .tmp/.../name.avif
 *  - webp (no raster twin in public) → .tmp/.../name.avif
 *
 * Always rebuilds .tmp/images from scratch (no stale paths).
 * Does not re-encode/replace original rasters — source resolution is yours to manage.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "public", "images");
const OUT_DIR = path.join(ROOT, ".tmp", "images");

const RASTER = new Set([".png", ".jpg", ".jpeg"]);
const WEBP_Q = 82;
const AVIF_Q = 55;
const MAX_WIDTH = 2000;

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, name.name);
    if (name.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

function ensureDir(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

/** Map public/images/foo.jpg → .tmp/images/foo.webp */
function outPathFor(srcFile, newExt) {
  const rel = path.relative(SRC_DIR, srcFile);
  const base = rel.slice(0, -path.extname(rel).length);
  return path.join(OUT_DIR, `${base}${newExt}`);
}

async function writeDerivative(srcFile, destFile, format) {
  ensureDir(destFile);
  let pipeline = sharp(srcFile, { failOn: "none" });
  const meta = await pipeline.metadata();
  pipeline = sharp(srcFile, { failOn: "none" });
  if (meta.width && meta.width > MAX_WIDTH) {
    pipeline = pipeline.resize({
      width: MAX_WIDTH,
      withoutEnlargement: true,
    });
  }

  if (format === "webp") {
    await pipeline.webp({ quality: WEBP_Q, effort: 4 }).toFile(destFile);
  } else if (format === "avif") {
    await pipeline.avif({ quality: AVIF_Q, effort: 4 }).toFile(destFile);
  } else {
    throw new Error(`Unknown format: ${format}`);
  }
  return true;
}

/**
 * Generate derivatives into .tmp/images only.
 * @returns {{ made: number, skipped: number, scanned: number }}
 */
export async function runOptimizeImages() {
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = walk(SRC_DIR);
  let made = 0;
  let skipped = 0;

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const baseInSrc = file.slice(0, -ext.length);

    if (RASTER.has(ext)) {
      for (const [format, newExt] of [
        ["webp", ".webp"],
        ["avif", ".avif"],
      ]) {
        const dest = outPathFor(file, newExt);
        try {
          await writeDerivative(file, dest, format);
          made += 1;
          console.log(`[images] + ${path.relative(ROOT, dest)}`);
        } catch (err) {
          console.error(`[images] fail ${path.relative(ROOT, dest)}:`, err.message);
        }
      }
      continue;
    }

    if (ext === ".webp") {
      const hasRaster = [".png", ".jpg", ".jpeg"].some((e) =>
        fs.existsSync(baseInSrc + e)
      );
      if (hasRaster) {
        skipped += 1;
        continue;
      }
      const dest = outPathFor(file, ".avif");
      try {
        await writeDerivative(file, dest, "avif");
        made += 1;
        console.log(`[images] + ${path.relative(ROOT, dest)}`);
      } catch (err) {
        console.error(`[images] fail ${path.relative(ROOT, dest)}:`, err.message);
      }
    }
  }

  console.log(
    `[images] done · wrote ${made} · skipped ${skipped} · scanned ${files.length} · out .tmp/images`
  );
  return { made, skipped, scanned: files.length };
}

/**
 * Merge .tmp/images → dist/images without overwriting files already copied from public/.
 */
export function mergeOptimizedImagesToDist(distDir = path.join(ROOT, "dist")) {
  if (!fs.existsSync(OUT_DIR)) return 0;
  const distImages = path.join(distDir, "images");
  let copied = 0;
  for (const file of walk(OUT_DIR)) {
    const rel = path.relative(OUT_DIR, file);
    const dest = path.join(distImages, rel);
    if (fs.existsSync(dest)) continue;
    ensureDir(dest);
    fs.copyFileSync(file, dest);
    copied += 1;
  }
  if (copied) {
    console.log(`[images] merged ${copied} file(s) into dist/images`);
  }
  return copied;
}

/** Resolve a /images/... URL to a file under .tmp/images if present */
export function resolveTmpImage(urlPathname) {
  const clean = (urlPathname || "").split("?")[0].split("#")[0];
  if (!clean.startsWith("/images/")) return null;
  const rel = clean.replace(/^\/images\//, "").replace(/\.\./g, "");
  if (!rel || !/\.(avif|webp)$/i.test(rel)) return null;
  const full = path.join(OUT_DIR, rel);
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(OUT_DIR))) return null;
  return resolved;
}

export { SRC_DIR, OUT_DIR, ROOT };

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runOptimizeImages().catch((err) => {
    console.error("[images]", err);
    process.exit(1);
  });
}
