/**
 * Client-side i18n (Option A): switch language without full page reload.
 * Dictionaries + bilingual content are bundled; [data-i18n] + mounts update in place.
 */
import dictJa from "../i18n/ja.json";
import dictEn from "../i18n/en.json";
import works from "../data/works.json";
import links from "../data/links.json";
import skills from "../data/skills.json";
import career from "../data/career.json";
import events from "../data/events.json";
import person from "../data/person.json";
import {
  renderWorks,
  renderWorksList,
  renderLinks,
  renderSkills,
  renderTimeline,
  renderEvents,
  sortWorksByDateDesc,
  personJsonLdString,
  WORKS_HOME_LIMIT,
} from "../lib/content-render.js";

const worksSorted = sortWorksByDateDesc(works);

export const LANG_KEY = "about-ogatomo-lang";
export const LANG_OPTS = ["ja", "en"];

const DICTS = { ja: dictJa, en: dictEn };

let currentLang = "ja";
let onAfterApply = null;

export function getDict(locale = currentLang) {
  return DICTS[locale] || DICTS.ja;
}

export function getCurrentLang() {
  return currentLang;
}

export function getStoredLang() {
  try {
    const t = localStorage.getItem(LANG_KEY);
    if (LANG_OPTS.includes(t)) return t;
  } catch {
    /* ignore */
  }
  return null;
}

export function setStoredLang(locale) {
  try {
    localStorage.setItem(LANG_KEY, locale);
  } catch {
    /* ignore */
  }
}

function t(dict, path) {
  const parts = path.split(".");
  let cur = dict;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return path;
    cur = cur[p];
  }
  return cur == null ? path : String(cur);
}

function setMeta(selector, attr, value) {
  const el = document.querySelector(selector);
  if (el && value != null) el.setAttribute(attr, value);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function applyLanguageCore(locale, { updateUrl = true } = {}) {
  if (!LANG_OPTS.includes(locale)) locale = "ja";
  const dict = getDict(locale);
  currentLang = locale;
  setStoredLang(locale);

  document.documentElement.lang = dict.htmlLang || locale;
  if (document.body) {
    document.body.setAttribute("data-locale", locale);
  }

  // Text nodes: data-i18n="nav.home"
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    el.textContent = t(dict, key);
  });

  // Attributes: data-i18n-attr="aria-label:nav.aria,title:theme.system"
  document.querySelectorAll("[data-i18n-attr]").forEach((el) => {
    const spec = el.getAttribute("data-i18n-attr");
    if (!spec) return;
    spec.split(",").forEach((pair) => {
      const [attr, key] = pair.split(":").map((s) => s.trim());
      if (attr && key) el.setAttribute(attr, t(dict, key));
    });
  });

  // Dynamic content mounts (SSR HTML replaced)
  const careerEl = document.getElementById("career-list");
  if (careerEl) {
    careerEl.innerHTML = renderTimeline(career, locale, dict.career.detail);
  }
  const skillsEl = document.getElementById("skills-list");
  if (skillsEl) {
    skillsEl.innerHTML = renderSkills(skills, locale);
  }
  const worksEl = document.getElementById("works-slider-track");
  if (worksEl) {
    worksEl.innerHTML = renderWorks(
      worksSorted.slice(0, WORKS_HOME_LIMIT),
      locale
    );
  }
  const worksFullEl = document.getElementById("works-full-list");
  if (worksFullEl) {
    worksFullEl.innerHTML = renderWorksList(worksSorted, locale);
  }
  const eventsEl = document.getElementById("events-slider-track");
  if (eventsEl) {
    eventsEl.innerHTML = renderEvents(events, locale, dict);
  }
  const linksEl = document.getElementById("links-list");
  if (linksEl) {
    linksEl.innerHTML = renderLinks(links, locale);
  }

  const pageKind =
    document.body?.getAttribute("data-page") ||
    (/works/.test(location.pathname)
      ? "works"
      : /404/.test(location.pathname)
        ? "404"
        : "index");

  // Document meta (works page has its own title/description keys)
  if (pageKind === "works" && dict.works) {
    document.title = dict.works.pageTitle || dict.meta?.title;
    setMeta('meta[name="description"]', "content", dict.works.pageDescription);
    setMeta('meta[property="og:title"]', "content", dict.works.pageTitle);
    setMeta(
      'meta[property="og:description"]',
      "content",
      dict.works.pageDescription
    );
    setMeta('meta[name="twitter:title"]', "content", dict.works.pageTitle);
    setMeta(
      'meta[name="twitter:description"]',
      "content",
      dict.works.pageDescription
    );
  } else if (dict.meta) {
    document.title = dict.meta.title;
    setMeta('meta[name="description"]', "content", dict.meta.description);
    setMeta('meta[property="og:title"]', "content", dict.meta.ogTitle);
    setMeta('meta[property="og:description"]', "content", dict.meta.ogDescription);
    setMeta('meta[name="twitter:title"]', "content", dict.meta.ogTitle);
    setMeta(
      'meta[name="twitter:description"]',
      "content",
      dict.meta.twitterDescription
    );
  }
  setMeta('meta[property="og:locale"]', "content", dict.locale || locale);

  // Relative paths so the site works under a subdirectory
  const path =
    pageKind === "works"
      ? `./works.${locale}.html`
      : pageKind === "404"
        ? `./404.${locale}.html`
        : `./index.${locale}.html`;
  const canonicalFile = path.replace(/^\.\//, "");
  const canonical = `https://about.ogatomo.net/${canonicalFile}`;
  setMeta('link[rel="canonical"]', "href", canonical);
  setMeta('meta[property="og:url"]', "content", canonical);

  // Person JSON-LD (src/data/person.json — same builder as inject)
  const ldEl = document.getElementById("json-ld-person");
  if (ldEl) {
    ldEl.textContent = personJsonLdString(person, locale, canonical);
  }

  document.querySelectorAll('[data-page-link="home"]').forEach((el) => {
    el.setAttribute("href", `./index.${locale}.html`);
  });
  document.querySelectorAll('[data-page-link="works"]').forEach((el) => {
    el.setAttribute("href", `./works.${locale}.html`);
  });
  const homeLink = document.querySelector("[data-home-link]");
  if (homeLink) homeLink.setAttribute("href", `./index.${locale}.html`);

  // Lang menu selected state
  document.querySelectorAll("[data-lang-opt]").forEach((btn) => {
    const on = btn.getAttribute("data-lang-opt") === locale;
    btn.setAttribute("aria-selected", on ? "true" : "false");
    btn.classList.toggle("is-active", on);
  });

  if (updateUrl && history.replaceState) {
    const next = `${path}${location.search || ""}${location.hash || ""}`;
    if (location.pathname + location.search + location.hash !== next) {
      history.replaceState(null, "", next);
    }
  }

  return dict;
}

/**
 * Apply UI strings + re-render content mounts for `locale`.
 * isSwitch: fade main (or View Transition) then re-init sliders via afterApply.
 * @param {string} locale
 * @param {{ updateUrl?: boolean, isSwitch?: boolean }} [opts]
 */
export async function applyLanguage(locale, opts = {}) {
  const { updateUrl = true, isSwitch = false } = opts;
  if (!LANG_OPTS.includes(locale)) locale = "ja";

  const main = document.querySelector("main");
  const motionOk = isSwitch && !prefersReducedMotion();

  const run = () => applyLanguageCore(locale, { updateUrl });

  if (isSwitch && motionOk && typeof document.startViewTransition === "function") {
    try {
      const vt = document.startViewTransition(() => {
        run();
      });
      await vt.finished.catch(() => {});
      if (typeof onAfterApply === "function") {
        onAfterApply(locale, getDict(locale));
      }
      return;
    } catch {
      /* fall through to CSS fade */
    }
  }

  if (motionOk && main) {
    main.classList.add("lang-transition", "lang-transition--out");
    await wait(150);
  }

  run();

  if (motionOk && main) {
    main.classList.remove("lang-transition--out");
    main.classList.add("lang-transition--in");
    // force reflow so fade-in plays
    void main.offsetWidth;
    await wait(180);
    main.classList.remove("lang-transition", "lang-transition--in");
  }

  if (isSwitch && typeof onAfterApply === "function") {
    onAfterApply(locale, getDict(locale));
  }
}

/**
 * Globe button + dropdown (日本語 / English). No full page reload.
 */
export function initLangMenu({ afterApply } = {}) {
  if (afterApply) onAfterApply = afterApply;

  const pageLang =
    document.body?.getAttribute("data-locale") ||
    document.documentElement.lang ||
    "ja";
  const initial = LANG_OPTS.includes(pageLang) ? pageLang : "ja";

  // Sync labels/meta to page language (content already SSR'd); wire menu
  currentLang = initial;
  setStoredLang(initial);
  applyLanguage(initial, { updateUrl: false, isSwitch: false });

  document.querySelectorAll("[data-lang-menu]").forEach((root) => {
    const trigger = root.querySelector("[data-lang-trigger]");
    const panel = root.querySelector("[data-lang-panel]");
    if (!trigger || !panel) return;

    // CSS handles open/close animation via .is-open (no [hidden] flash)
    panel.removeAttribute("hidden");

    const close = () => {
      trigger.setAttribute("aria-expanded", "false");
      root.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
    };

    const open = () => {
      trigger.setAttribute("aria-expanded", "true");
      root.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
    };

    const isOpen = () => root.classList.contains("is-open");

    const toggle = () => {
      if (isOpen()) close();
      else open();
    };

    close();

    trigger.addEventListener("click", (e) => {
      e.stopPropagation();
      toggle();
    });

    panel.querySelectorAll("[data-lang-opt]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const lang = btn.getAttribute("data-lang-opt");
        if (!LANG_OPTS.includes(lang)) return;
        close();
        if (lang === currentLang) return;
        void applyLanguage(lang, { updateUrl: true, isSwitch: true });
      });
    });

    document.addEventListener("click", (e) => {
      if (!root.contains(e.target)) close();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });
  });
}
