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
  sortWorksByDateDesc,
  personJsonLdString,
  WORKS_HOME_LIMIT,
} from "../src/lib/content-render.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");
const DATA = path.join(SRC, "data");
const I18N = path.join(SRC, "i18n");
/** Intermediate HTML for Vite — clearly separate from src/ */
const OUT = path.join(ROOT, ".tmp");

const LOCALES = ["ja", "en"];
const SITE = "https://about.ogatomo.net";

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

function readData(name) {
  return readJson(path.join(DATA, name));
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

  const fileBase =
    page === "works" ? `works.${locale}.html` : page === "404" ? `404.${locale}.html` : `index.${locale}.html`;
  const pathJa =
    page === "works" ? "works.ja.html" : page === "404" ? "404.ja.html" : "index.ja.html";
  const pathEn =
    page === "works" ? "works.en.html" : page === "404" ? "404.en.html" : "index.en.html";

  flat["page.locale"] = locale;
  flat["page.htmlLang"] = dict.htmlLang || locale;
  flat["page.ogLocale"] = dict.locale || locale;
  flat["page.canonical"] = `${SITE}/${fileBase}`;
  flat["page.ogUrl"] = `${SITE}/${fileBase}`;
  flat["page.hreflangJa"] = `${SITE}/${pathJa}`;
  flat["page.hreflangEn"] = `${SITE}/${pathEn}`;
  flat["page.langJaActive"] = locale === "ja" ? "true" : "false";
  flat["page.langEnActive"] = locale === "en" ? "true" : "false";
  flat["page.homeHref"] = `./index.${locale}.html`;
  flat["page.worksHref"] = `./works.${locale}.html`;
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
      console.warn(`[inject-data] marker not found: inject:${key}`);
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
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#7086bd" id="meta-theme-color">
  <link rel="icon" href="./favicon.ico">
  <link rel="alternate" hreflang="ja" href="${SITE}/index.ja.html">
  <link rel="alternate" hreflang="en" href="${SITE}/index.en.html">
  <link rel="alternate" hreflang="x-default" href="${SITE}/index.ja.html">
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
        if (meta) meta.setAttribute("content", dark ? "#12141c" : "#7086bd");
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
        // Relative so this works under a subdirectory
        var dest = "./index." + lang + ".html" + (location.search || "") + (location.hash || "");
        location.replace(dest);
      } catch (e) {
        location.replace("./index.ja.html");
      }
    })();
  </script>
  <noscript>
    <meta http-equiv="refresh" content="0;url=./index.ja.html">
  </noscript>
  <style>
    body { margin: 0; font-family: sans-serif; background: #fff; color: #333; }
    html.dark body { background: #0f1118; color: #e8eaf0; }
    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem; text-align: center; }
    a { color: #237aeb; }
  </style>
</head>
<body>
  <div class="wrap">
    <p>
      Redirecting…<br>
      <a href="./index.ja.html">日本語</a> ·
      <a href="./index.en.html">English</a>
    </p>
  </div>
</body>
</html>
`;
}

function build404RedirectHtml() {
  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 | about.ogatomo</title>
  <meta name="robots" content="noindex">
  <script>
    (function () {
      try {
        var key = "about-ogatomo-lang";
        var langs = ["ja", "en"];
        var stored = localStorage.getItem(key);
        var lang = stored;
        if (langs.indexOf(lang) < 0) {
          var nav = (navigator.language || "ja").toLowerCase();
          lang = nav.indexOf("ja") === 0 ? "ja" : "en";
        }
        location.replace("./404." + lang + ".html");
      } catch (e) {
        location.replace("./404.ja.html");
      }
    })();
  </script>
  <noscript><meta http-equiv="refresh" content="0;url=./404.ja.html"></noscript>
</head>
<body>
  <p><a href="./404.ja.html">日本語</a> · <a href="./404.en.html">English</a></p>
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

function runInject(opts = {}) {
  const { forceLog = false } = opts;
  fs.mkdirSync(OUT, { recursive: true });

  const worksAll = sortWorksByDateDesc(readData("works.json"));
  const worksHome = worksAll.slice(0, WORKS_HOME_LIMIT);
  const links = readData("links.json");
  const skills = readData("skills.json");
  const career = readData("career.json");
  const events = readData("events.json");
  const person = readData("person.json");

  const indexSrc = fs.readFileSync(path.join(SRC, "index.html"), "utf8");
  const worksSrc = fs.readFileSync(path.join(SRC, "works.html"), "utf8");
  const notFoundSrc = fs.readFileSync(path.join(SRC, "404.html"), "utf8");

  let anyChanged = false;
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
    if (writeIfChanged(path.join(OUT, `index.${locale}.html`), page)) {
      anyChanged = true;
    }

    let worksPage = injectMarkers(worksSrc, {
      "works-all": renderWorksList(worksAll, locale),
    });
    worksPage = applyDict(worksPage, dict, locale, "works", person);
    if (writeIfChanged(path.join(OUT, `works.${locale}.html`), worksPage)) {
      anyChanged = true;
    }

    let page404 = applyDict(notFoundSrc, dict, locale, "404", person);
    if (writeIfChanged(path.join(OUT, `404.${locale}.html`), page404)) {
      anyChanged = true;
    }

    counts.push(`${locale}: works=${worksAll.length}(home=${worksHome.length})`);
  }

  if (writeIfChanged(path.join(OUT, "index.html"), buildRedirectHtml())) {
    anyChanged = true;
  }
  if (writeIfChanged(path.join(OUT, "404.html"), build404RedirectHtml())) {
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
