import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../src/js/i18n-runtime.js", import.meta.url), "utf8")
  .replace(/import[\s\S]*?from "[^"\n]+";\r?\n/g, "")
  .replace(/^export /gm, "");
const readJson = (file) => JSON.parse(fs.readFileSync(new URL(file, import.meta.url), "utf8"));

test("home language preferences, explicit URLs, metadata and switching", () => {
  for (const scenario of [
    { path: "/", stored: "en", browser: "ja-JP", page: "ja", expected: "en" },
    { path: "/", stored: "ja", browser: "en-US", page: "ja", expected: "ja" },
    { path: "/", stored: null, browser: "en-US", page: "ja", expected: "en" },
    { path: "/", stored: "invalid", browser: "ja-JP", page: "ja", expected: "ja" },
    { path: "/", stored: null, browser: "fr-FR", page: "ja", expected: "en", blocked: true },
    { path: "/index.en", stored: "ja", browser: "ja-JP", page: "en", expected: "en" },
    { path: "/index.ja", stored: "en", browser: "en-US", page: "ja", expected: "ja" },
    { path: "/works.en", stored: "ja", browser: "ja-JP", page: "en", expected: "en" },
  ]) {
    const meta = new Map();
    let stored = scenario.stored;
    let change;
    const select = { value: "", addEventListener: (_, fn) => { change = fn; } };
    const location = { pathname: scenario.path, search: "?from=test", hash: "#works" };
    const urls = [];
    const ld = { textContent: "" };
    const context = vm.createContext({
      dictJa: readJson("../src/i18n/ja.json"), dictEn: readJson("../src/i18n/en.json"),
      works: [], links: [], skills: [], career: [], events: [], person: {},
      sortByDateDesc: (items) => items, WORKS_HOME_LIMIT: 10,
      personJsonLdString: (_, locale, canonical) => JSON.stringify({ locale, canonical }),
      localStorage: {
        getItem: () => { if (scenario.blocked) throw new Error("blocked"); return stored; },
        setItem: (_, value) => { if (scenario.blocked) throw new Error("blocked"); stored = value; },
      },
      navigator: { language: scenario.browser }, location,
      history: { replaceState: (_, __, url) => { urls.push(url); location.pathname = url.split(/[?#]/)[0]; } },
      window: { matchMedia: () => ({ matches: true }) },
      document: {
        documentElement: { lang: scenario.page },
        body: { getAttribute: (key) => key === "data-locale" ? scenario.page : null, setAttribute() {} },
        querySelectorAll: (selector) => selector === "[data-lang-select]" ? [select] : [],
        querySelector: (selector) => selector === "main" ? null : { setAttribute: (_, value) => meta.set(selector, value) },
        getElementById: (id) => id === "json-ld-person" ? ld : null,
      },
    });
    vm.runInContext(source, context);
    vm.runInContext("initLangMenu()", context);
    assert.equal(vm.runInContext("getCurrentLang()", context), scenario.expected, JSON.stringify(scenario));
    assert.equal(select.value, scenario.expected);
    assert.equal(urls.length, 0, "initialization preserves the requested URL");
    assert.equal(meta.get('meta[property="og:url"]'), "https://ogtm.dev" + scenario.path);
    assert.equal(meta.get('link[rel="canonical"]'), "https://ogtm.dev" + scenario.path);
    assert.equal(JSON.parse(ld.textContent).canonical, "https://ogtm.dev" + scenario.path);
    if (!scenario.blocked) assert.equal(stored, scenario.expected);
    const next = scenario.expected === "ja" ? "en" : "ja";
    select.value = next;
    change();
    const page = scenario.path.startsWith("/works") ? "works" : "index";
    assert.equal(urls[0], "/" + page + "." + next + "?from=test#works");
    assert.equal(meta.get('meta[property="og:url"]'), "https://ogtm.dev/" + page + "." + next);
    assert.equal(vm.runInContext("getCurrentLang()", context), next);
  }
});
