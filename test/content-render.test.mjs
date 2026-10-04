import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  formatTimelineDate,
  personJsonLdString,
  renderEvents,
  renderTimeline,
  renderWorks,
  renderWorksList,
  sortByDateDesc,
} from "../src/lib/content-render.js";
import { runInject } from "../scripts/inject-data.mjs";
import { validateProjectData } from "../scripts/validate-data.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(ROOT, file), "utf8"));
const works = readJson("src/data/works.json");
const events = readJson("src/data/events.json");
const person = readJson("src/data/person.json");
const dictEn = readJson("src/i18n/en.json");

test("project data passes the build validator", () => {
  const data = validateProjectData();
  assert.equal(data.works.length, works.length);
  assert.equal(data.events.length, events.length);
});

test("works are sorted newest first and use truthful picture candidates", () => {
  const sorted = sortByDateDesc(works);
  assert.deepEqual(sorted.map((item) => item.date), [...works].map((item) => item.date).sort().reverse());

  const html = renderWorks(sorted.slice(0, 1), "en");
  assert.match(html, /header|works\//);
  assert.match(html, /-480\.avif 1x/);
  assert.match(html, /\.avif 2x/);
  assert.match(html, /type="image\/webp"/);
  assert.doesNotMatch(html, /-(?:960|1600)\.(?:avif|webp)/);
  assert.doesNotMatch(html, /\s(?:960|1600)w/);
  assert.match(html, /<time datetime="\d{4}-\d{2}"[^>]*>[A-Z][a-z]{2} \d{4}<\/time>/);
});

test("timeline and event dates include machine-readable datetime values", () => {
  assert.equal(formatTimelineDate("2025-12", "en"), "Dec 2025");
  const timeline = renderTimeline(
    [{ date: "2024-01", title: "Older", description: null, url: null }, { date: "2025-12", title: "Newer", description: null, url: null }],
    "en",
    "Read more"
  );
  assert.ok(timeline.indexOf('datetime="2025-12"') < timeline.indexOf('datetime="2024-01"'));

  const eventHtml = renderEvents(events.slice(0, 1), "en", dictEn);
  assert.match(eventHtml, /datetime="2026-02"/);
});

test("works grid preserves links inside list items in both languages", () => {
  for (const locale of ["ja", "en"]) {
    const html = renderWorksList(works, locale);
    assert.equal((html.match(/<li\b/g) || []).length, works.length);
    assert.equal((html.match(/<li[^>]*><a href=/g) || []).length, works.length);
    assert.doesNotMatch(html, /<a\b[^>]*\brole=/);
  }
});

test("JSON-LD safely escapes script terminators", () => {
  const unsafe = structuredClone(person);
  unsafe.description = { ja: "</script><script>alert(1)</script>", en: "safe" };
  const json = personJsonLdString(unsafe, "ja", "https://ogtm.dev/index.ja");
  assert.doesNotMatch(json, /<\/script>/i);
  assert.ok(json.includes("\\u003c/script\\u003e"));
});

test("generated public URLs are extensionless and 404 keeps its response", () => {
  runInject();
  const indexJa = fs.readFileSync(path.join(ROOT, ".tmp/index.ja.html"), "utf8");
  const worksEn = fs.readFileSync(path.join(ROOT, ".tmp/works.en.html"), "utf8");
  const notFound = fs.readFileSync(path.join(ROOT, ".tmp/404.html"), "utf8");
  const notFoundJa = fs.readFileSync(path.join(ROOT, ".tmp/404.ja.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(ROOT, "public/sitemap.xml"), "utf8");

  assert.match(indexJa, /rel="canonical" href="https:\/\/ogtm\.dev\/index\.ja"/);
  assert.match(worksEn, /href="\/index\.en"/);
  assert.match(worksEn, /<ul\s+id="works-full-list"/);
  assert.match(indexJa, /<select class="lang-select"[^>]*data-lang-select/);
  assert.match(indexJa, /<option value="ja"[^>]*selected/);
  assert.doesNotMatch(`${indexJa}${worksEn}${sitemap}`, /ogtm\.dev\/(?:index|works|404)\.(?:ja|en)\.html/);
  assert.equal(notFound, notFoundJa);
  assert.doesNotMatch(notFound, /location\.replace/);
});
