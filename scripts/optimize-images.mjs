/**
 * Image derivatives for <picture> (AVIF / WebP).
 *
 * Source (never written): public/images/**
 * Output only:           .tmp/images/** + .tmp/image-manifest.json
 *
 *  - png/jpg/jpeg → .tmp/.../name.webp + .tmp/.../name.avif
 *  - standalone webp → .tmp/.../name.webp + .tmp/.../name.avif
 *  - card derivatives also get -480 / -960 / -1600 variants
 *
 * Reuses unchanged derivatives through a SHA-256 manifest and prunes stale paths.
 * Does not re-encode/replace original rasters — source resolution is yours to manage.
 */
import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { fileURLToPath } from "url";
import sharp from "sharp";
import { CARD_IMAGE_WIDTHS } from "../src/lib/content-render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC_DIR = path.join(ROOT, "public", "images");
const OUT_DIR = path.join(ROOT, ".tmp", "images");
const MANIFEST_PATH = path.join(ROOT, ".tmp", "image-manifest.json");

const RASTER = new Set([".png", ".jpg", ".jpeg"]);
const WEBP_Q = 82;
const AVIF_Q = 55;
const MAX_WIDTH = 2000;
const IMAGE_PIPELINE_VERSION = 1;
const PIPELINE_CONFIG = {
  version: IMAGE_PIPELINE_VERSION,
  webpQuality: WEBP_Q,
  avifQuality: AVIF_Q,
  maxWidth: MAX_WIDTH,
  cardWidths: CARD_IMAGE_WIDTHS,
};

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

function relativeOutput(filePath) {
  return path.relative(OUT_DIR, filePath).split(path.sep).join("/");
}

function sourceKey(filePath) {
  return path.relative(SRC_DIR, filePath).split(path.sep).join("/");
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function readManifest() {
  try {
    const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
    if (!manifest || typeof manifest !== "object") return null;
    if (JSON.stringify(manifest.config) !== JSON.stringify(PIPELINE_CONFIG)) return null;
    if (!manifest.sources || typeof manifest.sources !== "object") return null;
    return manifest;
  } catch {
    return null;
  }
}

function writeManifest(sources) {
  const tempPath = `${MANIFEST_PATH}.tmp`;
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(
    tempPath,
    `${JSON.stringify({ config: PIPELINE_CONFIG, sources }, null, 2)}\n`,
    "utf8"
  );
  fs.renameSync(tempPath, MANIFEST_PATH);
}

function targetsFor(file, extension) {
  return [
    { path: outPathFor(file, extension), width: MAX_WIDTH },
    ...CARD_IMAGE_WIDTHS.map((width) => ({
      path: outPathFor(file, `-${width}${extension}`),
      width,
    })),
  ];
}

async function writeDerivative(srcFile, destFile, format, width, metadata) {
  ensureDir(destFile);
  let pipeline = sharp(srcFile, { failOn: "none" });
  if (metadata.width && metadata.width > width) {
    pipeline = pipeline.resize({
      width,
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
 * @returns {{ made: number, cached: number, skipped: number, scanned: number }}
 */
export async function runOptimizeImages({ force = false } = {}) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const files = walk(SRC_DIR);
  let made = 0;
  let skipped = 0;
  let cached = 0;
  const failures = [];
  const previous = force ? null : readManifest();
  const expectedOutputs = new Set();
  const sources = {};
  const pending = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    const baseInSrc = file.slice(0, -ext.length);
    const isStandaloneWebp =
      ext === ".webp" &&
      ![".png", ".jpg", ".jpeg"].some((e) => fs.existsSync(baseInSrc + e));

    if (!RASTER.has(ext) && !isStandaloneWebp) {
      if (ext === ".webp") skipped += 1;
      continue;
    }

    const outputs = [
      ...targetsFor(file, ".webp"),
      ...targetsFor(file, ".avif"),
    ].map((target) => relativeOutput(target.path));
    outputs.forEach((output) => expectedOutputs.add(output));

    const key = sourceKey(file);
    const hash = sha256File(file);
    sources[key] = { hash, outputs };
    const old = previous?.sources?.[key];
    const canReuse =
      old?.hash === hash &&
      JSON.stringify(old.outputs) === JSON.stringify(outputs) &&
      outputs.every((output) => fs.existsSync(path.join(OUT_DIR, output)));

    if (canReuse) {
      cached += 1;
    } else {
      pending.push(file);
    }
  }

  // Do not ship derivatives for deleted sources or obsolete pipeline settings.
  for (const file of walk(OUT_DIR)) {
    if (!expectedOutputs.has(relativeOutput(file))) {
      fs.rmSync(file, { force: true });
    }
  }

  const makeDerivatives = async (file, format, extension, metadata) => {
    for (const target of targetsFor(file, extension)) {
      try {
        await writeDerivative(file, target.path, format, target.width, metadata);
        made += 1;
        console.log(`[images] + ${path.relative(ROOT, target.path)}`);
      } catch (err) {
        failures.push(`${path.relative(ROOT, target.path)}: ${err.message}`);
        console.error(`[images] fail ${path.relative(ROOT, target.path)}:`, err.message);
      }
    }
  };

  for (const file of pending) {
    let metadata;
    try {
      metadata = await sharp(file, { failOn: "none" }).metadata();
    } catch (err) {
      failures.push(`${path.relative(ROOT, file)}: ${err.message}`);
      continue;
    }
    await makeDerivatives(file, "webp", ".webp", metadata);
    await makeDerivatives(file, "avif", ".avif", metadata);
  }

  if (failures.length > 0) {
    throw new Error(`[images] ${failures.length} source(s) failed:\n- ${failures.join("\n- ")}`);
  }

  writeManifest(sources);

  console.log(
    `[images] done · wrote ${made} · cached ${cached} · skipped ${skipped} · scanned ${files.length} · out .tmp/images`
  );
  return { made, cached, skipped, scanned: files.length };
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
  const root = path.resolve(OUT_DIR);
  const full = path.resolve(root, rel);
  const relative = path.relative(root, full);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) return null;
  if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null;
  return full;
}

export { SRC_DIR, OUT_DIR, ROOT };

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runOptimizeImages({ force: process.argv.includes("--force") }).catch((err) => {
    console.error("[images]", err);
    process.exit(1);
  });
}
