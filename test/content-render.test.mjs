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
  sortWorksByDateDesc,
} from "../src/lib/content-render.js";
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

test("works are sorted newest first and use responsive picture sources", () => {
  const sorted = sortWorksByDateDesc(works);
  assert.equal(sorted[0].date, "202502");

  const html = renderWorks(sorted.slice(0, 1), "en");
  assert.match(html, /header|works\//);
  assert.match(html, /-480\.avif 480w/);
  assert.match(html, /-960\.webp 960w/);
  assert.match(html, /<time datetime="2025-02"[^>]*>Feb 2025<\/time>/);
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

test("JSON-LD safely escapes script terminators", () => {
  const unsafe = structuredClone(person);
  unsafe.description = { ja: "</script><script>alert(1)</script>", en: "safe" };
  const json = personJsonLdString(unsafe, "ja", "https://about.ogtm.dev/index.ja.html");
  assert.doesNotMatch(json, /<\/script>/i);
  assert.ok(json.includes("\\u003c/script\\u003e"));
});
