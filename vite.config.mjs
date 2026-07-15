import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { defineConfig } from "vite";
import { runInject, getWatchFiles, GENERATED_HTML } from "./scripts/inject-data.mjs";
import {
  runOptimizeImages,
  mergeOptimizedImagesToDist,
  resolveTmpImage,
} from "./scripts/optimize-images.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TMP = path.resolve(__dirname, ".tmp");
const PUBLIC_IMAGES = path.resolve(__dirname, "public", "images");

const IMAGE_MIME = {
  ".avif": "image/avif",
  ".webp": "image/webp",
};

/**
 * 1) inject + image optimize before build/dev
 * 2) Dev: serve /.tmp/*.html as /*.html; serve optimized images from .tmp/images
 * 3) Build: emit HTML to dist/ root; merge .tmp/images → dist/images
 */
function injectDataPlugin() {
  return {
    name: "ogatomo-inject-data",
    async buildStart() {
      await runOptimizeImages();
      runInject();
    },
    configureServer(server) {
      void runOptimizeImages();
      runInject();

      // Optimized AVIF/WebP live only under .tmp/images (not public/)
      server.middlewares.use((req, res, next) => {
        const url = req.url || "";
        const pathname = url.split("?")[0].split("#")[0];
        if (!pathname.startsWith("/images/") || !/\.(avif|webp)$/i.test(pathname)) {
          return next();
        }
        // Prefer real files in public/ if present
        const pubFile = path.join(
          __dirname,
          "public",
          pathname.replace(/^\//, "").replace(/\.\./g, "")
        );
        if (fs.existsSync(pubFile) && fs.statSync(pubFile).isFile()) {
          return next();
        }
        const tmpFile = resolveTmpImage(pathname);
        if (!tmpFile) return next();
        const ext = path.extname(tmpFile).toLowerCase();
        res.setHeader("Content-Type", IMAGE_MIME[ext] || "application/octet-stream");
        res.setHeader("Cache-Control", "no-cache");
        fs.createReadStream(tmpFile).pipe(res);
      });

      // Serve generated HTML from .tmp/ under pretty URLs (no root index.html)
      //   /              → /.tmp/index.html
      //   /index.ja.html → /.tmp/index.ja.html
      server.middlewares.use((req, _res, next) => {
        const url = req.url || "";
        const qIdx = url.indexOf("?");
        const pathname = (qIdx >= 0 ? url.slice(0, qIdx) : url).split("#")[0];
        const q = qIdx >= 0 ? url.slice(qIdx) : "";
        // Vite looks for root index.html on "/"; ours lives only in .tmp/
        if (pathname === "/" || pathname === "") {
          req.url = `/.tmp/index.html${q}`;
          return next();
        }
        const name = pathname.replace(/^\//, "");
        if (GENERATED_HTML.includes(name)) {
          req.url = `/.tmp/${name}${q}`;
        }
        next();
      });

      const extra = [
        path.join(__dirname, "scripts", "inject-data.mjs"),
        path.join(__dirname, "scripts", "optimize-images.mjs"),
        path.join(__dirname, "src", "lib", "content-render.js"),
      ];
      const watched = new Set(
        [...getWatchFiles(), ...extra].map((f) => path.resolve(f))
      );

      for (const file of watched) {
        server.watcher.add(file);
      }
      if (fs.existsSync(PUBLIC_IMAGES)) {
        server.watcher.add(PUBLIC_IMAGES);
      }

      const onChange = (file) => {
        const resolved = path.resolve(file);
        const norm = resolved.replace(/\\/g, "/");
        if (norm.includes("/.tmp/")) return;

        const isImage =
          norm.includes("/public/images/") &&
          /\.(png|jpe?g|webp|gif)$/i.test(norm);
        if (isImage) {
          void runOptimizeImages().then(() => {
            server.ws.send({ type: "full-reload" });
          });
          return;
        }

        const relevant =
          watched.has(resolved) ||
          norm.includes("/src/") ||
          norm.includes("/scripts/inject-data") ||
          norm.includes("/scripts/optimize-images") ||
          norm.includes("/content-render");
        if (!relevant) return;
        runInject();
        server.ws.send({ type: "full-reload" });
      };

      server.watcher.on("change", onChange);
      server.watcher.on("add", onChange);
    },
    closeBundle() {
      // Vite emits MPA HTML under dist/.tmp/ — move to dist/ root for Pages.
      // Asset URLs are relative to .tmp (../assets/...) → fix to ./assets/...
      const distTmp = path.join(__dirname, "dist", ".tmp");
      const dist = path.join(__dirname, "dist");
      if (fs.existsSync(distTmp)) {
        for (const name of fs.readdirSync(distTmp)) {
          const from = path.join(distTmp, name);
          const to = path.join(dist, name);
          if (name.endsWith(".html")) {
            let html = fs.readFileSync(from, "utf8");
            // HTML was emitted under dist/.tmp/ — normalize asset/image URLs to
            // dist-root relative after flattening (and avoid Vite hashing images
            // into assets/ by using /images/… in source HTML).
            html = html.replaceAll("../assets/", "./assets/");
            html = html.replaceAll("../images/", "./images/");
            // Keep root-absolute /images/… as ./images/… (do not touch https://…/images/)
            html = html.replace(
              /(src|srcset|href)="\/images\//g,
              '$1="./images/'
            );
            if (fs.existsSync(to)) fs.rmSync(to, { force: true });
            fs.writeFileSync(to, html, "utf8");
            fs.rmSync(from, { force: true });
          } else {
            if (fs.existsSync(to)) fs.rmSync(to, { force: true });
            fs.renameSync(from, to);
          }
        }
        fs.rmSync(distTmp, { recursive: true, force: true });
      }
      // public/ originals already in dist; add AVIF/WebP from .tmp only
      mergeOptimizedImagesToDist(dist);
    },
  };
}

function htmlInputs() {
  const input = {};
  for (const name of GENERATED_HTML) {
    const full = path.join(TMP, name);
    if (fs.existsSync(full)) {
      input[name.replace(/\.html$/, "")] = full;
    }
  }
  return input;
}

// Ensure .tmp entries exist before Vite resolves multi-page inputs
runInject();

export default defineConfig({
  // Relative asset URLs so dist works under a subdirectory (and file:// / nested hosts)
  base: "./",
  plugins: [injectDataPlugin()],
  publicDir: "public",
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: false,
    open: false,
  },
  preview: {
    host: "0.0.0.0",
    port: 8080,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      input: htmlInputs(),
      output: {
        entryFileNames: "assets/js/[name].[hash].js",
        chunkFileNames: "assets/js/[name].[hash].js",
        assetFileNames: (info) => {
          const n = info.name || "";
          if (n.endsWith(".css")) return "assets/css/[name].[hash][extname]";
          return "assets/[name].[hash][extname]";
        },
      },
    },
  },
});
