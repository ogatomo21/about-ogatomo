/**
 * Build-time: i18n dictionaries + JSON data → localized HTML (Vite MPA entries).
 * Output (gitignored, not source):
 *   .tmp/index.ja.html, .tmp/index.en.html, .tmp/index.html (lang redirect)
 *   .tmp/404.ja.html, .tmp/404.en.html, .tmp/404.html
 *
 * Edit src/index.html / src/404.html / src/data / src/i18n — never edit .tmp/.
 * Client re-applies language without reload via src/js/i18n-runtime.js.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import {
  escapeHtml,
  renderWorks,
  renderWorksList,
  renderLinks,
  renderSkills,
  renderTimeline,
  renderEvents,
  sortByDateDesc,
  personJsonLdString,
  WORKS_HOME_LIMIT,
} from "../src/lib/content-render.js";
import { validateProjectData } from "./validate-data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DATA = path.join(SRC, "data");
const I18N = path.join(SRC, "i18n");
/** Intermediate HTML for Vite — clearly separate from src/ */
const OUT = path.join(ROOT, ".tmp");

const LOCALES = ["ja", "en"];
const SITE = "https://about.ogtm.dev";

const GENERATED_HTML = [
  "index.html",
  "index.ja.html",
  "index.en.html",
  "works.ja.html",
  "works.en.html",
  "404.html",
  "404.ja.html",
  "404.en.html",
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function readDict(locale) {
  return readJson(path.join(I18N, `${locale}.json`));
}

/**
 * Replace {{dot.path}} placeholders.
 * @param {"index"|"works"|"404"} page
 * @param {object|null} person - src/data/person.json (for JSON-LD on index)
 */
function applyDict(template, dict, locale, page = "index", person = null) {
  let html = template;
  const flat = flatten(dict);

  const publicBase =
    page === "works" ? `works.${locale}` : page === "404" ? `404.${locale}` : `index.${locale}`;
  const pathJa =
    page === "works" ? "works.ja" : page === "404" ? "404.ja" : "index.ja";
  const pathEn =
    page === "works" ? "works.en" : page === "404" ? "404.en" : "index.en";

  flat["page.locale"] = locale;
  flat["page.htmlLang"] = dict.htmlLang || locale;
  flat["page.ogLocale"] = dict.locale || locale;
  flat["page.canonical"] = `${SITE}/${publicBase}`;
  flat["page.ogUrl"] = `${SITE}/${publicBase}`;
  flat["page.hreflangJa"] = `${SITE}/${pathJa}`;
  flat["page.hreflangEn"] = `${SITE}/${pathEn}`;
  flat["page.langJaActive"] = locale === "ja" ? "true" : "false";
  flat["page.langEnActive"] = locale === "en" ? "true" : "false";
  flat["page.langJaSelected"] = locale === "ja" ? "selected" : "";
  flat["page.langEnSelected"] = locale === "en" ? "selected" : "";
  flat["page.homeHref"] = `/index.${locale}`;
  flat["page.worksHref"] = `/works.${locale}`;
  if (person) {
    flat["page.jsonLd"] = personJsonLdString(person, locale, flat["page.canonical"]);
  }

  html = html.replace(/\{\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      return String(flat[key]);
    }
    return match;
  });

  html = html.replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (match, key) => {
    if (Object.prototype.hasOwnProperty.call(flat, key)) {
      return escapeHtml(String(flat[key]));
    }
    return match;
  });

  return html;
}

function flatten(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v != null && typeof v === "object" && !Array.isArray(v)) {
      flatten(v, key, out);
    } else if (Array.isArray(v)) {
      if (typeof v[0] === "string") out[key] = v.join(", ");
    } else {
      out[key] = v;
    }
  }
  return out;
}

function injectMarkers(template, replacements) {
  let html = template;
  for (const [key, value] of Object.entries(replacements)) {
    const markers = [`<!-- inject:${key} -->`, `<!--inject:${key}-->`];
    let found = false;
    for (const marker of markers) {
      if (html.includes(marker)) {
        html = html.split(marker).join(value);
        found = true;
      }
    }
    if (!found) {
      throw new Error(`[inject-data] marker not found: inject:${key}`);
    }
  }
  return html;
}

function buildRedirectHtml() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <title>about.ogatomo</title>
  <meta name="theme-color" content="#5068a2" id="meta-theme-color">
  <link rel="icon" href="./favicon.ico">
  <link rel="alternate" hreflang="ja" href="${SITE}/index.ja">
  <link rel="alternate" hreflang="en" href="${SITE}/index.en">
  <link rel="alternate" hreflang="x-default" href="${SITE}/index.ja">
  <script>
    (function () {
      try {
        var themeKey = "about-ogatomo-theme";
        var t = localStorage.getItem(themeKey) || "system";
        if (t !== "light" && t !== "dark" && t !== "system") t = "system";
        var dark =
          t === "dark" ||
          (t === "system" &&
            window.matchMedia("(prefers-color-scheme: dark)").matches);
        document.documentElement.classList.toggle("dark", dark);
        var meta = document.getElementById("meta-theme-color");
        if (meta) meta.setAttribute("content", dark ? "#0f1118" : "#5068a2");
      } catch (e) {}
      try {
        var key = "about-ogatomo-lang";
        var langs = ["ja", "en"];
        var stored = localStorage.getItem(key);
        var lang = stored;
        if (langs.indexOf(lang) < 0) {
          var nav = (navigator.language || navigator.userLanguage || "ja").toLowerCase();
          lang = nav.indexOf("ja") === 0 ? "ja" : "en";
        }
        var dest = "/index." + lang + (location.search || "") + (location.hash || "");
        location.replace(dest);
      } catch (e) {
        location.replace("/index.ja");
      }
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=/index.ja">
  </noscript>
  <style>
    body { margin: 0; font-family: sans-serif; background: #fff; color: #333; }
    html.dark body { background: #0f1118; color: #e8eaf0; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; text-align: center; }
    a { color: #1b68c5; }
  </style>
</head>
<body>
  <div class="wrap">
    <p>
      Redirecting…<br>
      <a href="/index.ja">日本語</a> ·
      <a href="/index.en">English</a>
    </p>
  </div>
</body>
</html>
`;
}

function getWatchFiles() {
  const dataFiles = fs
    .readdirSync(DATA)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(DATA, name));
  const i18nFiles = fs
    .readdirSync(I18N)
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(I18N, name));
  return [
    path.join(SRC, "index.html"),
    path.join(SRC, "works.html"),
    path.join(SRC, "404.html"),
    path.join(SRC, "lib", "content-render.js"),
    ...dataFiles,
    ...i18nFiles,
  ];
}

function writeIfChanged(filePath, content) {
  try {
    if (fs.readFileSync(filePath, "utf8") === content) return false;
  } catch {
    /* missing */
  }
  fs.writeFileSync(filePath, content, "utf8");
  return true;
}

function assertResolved(html, label) {
  if (/\{\{\{?/.test(html)) {
    throw new Error(`[inject-data] unresolved placeholder in ${label}`);
  }
}

function runInject(opts = {}) {
  const { forceLog = false } = opts;
  fs.mkdirSync(OUT, { recursive: true });

  const projectData = validateProjectData();

  const { works, links, skills, career, events, person } = projectData;
  const worksAll = sortByDateDesc(works);
  const worksHome = worksAll.slice(0, WORKS_HOME_LIMIT);

  const indexSrc = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  const worksSrc = fs.readFileSync(path.join(SRC, "works.html"), "utf8");
  const notFoundSrc = fs.readFileSync(path.join(SRC, "404.html"), "utf8");

  let anyChanged = false;
  let default404Page = "";
  const counts = [];

  for (const locale of LOCALES) {
    const dict = readDict(locale);
    const indexReplacements = {
      works: renderWorks(worksHome, locale),
      links: renderLinks(links, locale),
      skills: renderSkills(skills, locale),
      career: renderTimeline(career, locale, dict.career.detail),
      events: renderEvents(events, locale, dict),
    };

    let page = injectMarkers(indexSrc, indexReplacements);
    page = applyDict(page, dict, locale, "index", person);
    assertResolved(page, `index.${locale}.html`);
    if (writeIfChanged(path.join(OUT, `index.${locale}.html`), page)) {
      anyChanged = true;
    }

    let worksPage = injectMarkers(worksSrc, {
      "works-all": renderWorksList(worksAll, locale),
    });
    worksPage = applyDict(worksPage, dict, locale, "works", person);
    assertResolved(worksPage, `works.${locale}.html`);
    if (writeIfChanged(path.join(OUT, `works.${locale}.html`), worksPage)) {
      anyChanged = true;
    }

    let page404 = applyDict(notFoundSrc, dict, locale, "404", person);
    assertResolved(page404, `404.${locale}.html`);
    if (locale === "ja") default404Page = page404;
    if (writeIfChanged(path.join(OUT, `404.${locale}.html`), page404)) {
      anyChanged = true;
    }

    counts.push(`${locale}: works=${worksAll.length}(home=${worksHome.length})`);
  }

  if (writeIfChanged(path.join(OUT, "index.html"), buildRedirectHtml())) {
    anyChanged = true;
  }
  // Cloudflare Pages serves 404.html with the original 404 status and request URL.
  // Keep that response in place; redirecting to /404.ja would turn it into a 200 page.
  if (writeIfChanged(path.join(OUT, "404.html"), default404Page)) {
    anyChanged = true;
  }

  if (anyChanged || forceLog) {
    console.log(
      anyChanged
        ? "[inject-data] wrote .tmp/index.*, works.*, 404.*"
        : "[inject-data] .tmp up to date"
    );
    console.log(
      `[inject-data] ${counts.join(" · ")} links=${links.length} skills=${skills.length} career=${career.length} events=${events.length}`
    );
  }
  return anyChanged;
}

export { runInject, getWatchFiles, LOCALES, GENERATED_HTML };

const isMain =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runInject({ forceLog: true });
}
