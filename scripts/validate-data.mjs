/**
 * Validate the JSON data and locale dictionaries used by the static build.
 * This intentionally has no third-party dependency so it also runs in CI
 * before Vite starts.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const DATA_DIR = path.join(ROOT, "src", "data");
const I18N_DIR = path.join(ROOT, "src", "i18n");
const LOCALES = ["ja", "en"];
const WORK_TYPES = new Set(["Application", "Extension", "Website", "Library"]);
const EVENT_KINDS = new Set(["award", "qualification", "media", "event"]);

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    throw new Error(`Invalid JSON: ${path.relative(ROOT, filePath)} (${error.message})`);
  }
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isHttpUrl(value) {
  if (!isNonEmptyString(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function validateLocalized(value, field, errors, { nullable = false, arrays = false } = {}) {
  if (value == null) {
    if (!nullable) errors.push(`${field}: is required`);
    return;
  }

  if (isNonEmptyString(value) || typeof value === "number") return;

  if (arrays && Array.isArray(value)) {
    if (value.length === 0 || value.some((item) => !isNonEmptyString(item))) {
      errors.push(`${field}: array values must be non-empty strings`);
    }
    return;
  }

  if (isObject(value) && ("ja" in value || "en" in value)) {
    for (const locale of LOCALES) {
      const localized = value[locale];
      if (arrays && Array.isArray(localized)) {
        if (localized.length === 0 || localized.some((item) => !isNonEmptyString(item))) {
          errors.push(`${field}.${locale}: array values must be non-empty strings`);
        }
      } else if (!isNonEmptyString(localized)) {
        errors.push(`${field}.${locale}: translation is required`);
      }
    }
    return;
  }

  errors.push(`${field}: expected a string or { ja, en }`);
}

function validateOptionalUrl(value, field, errors) {
  if (value == null) return;
  if (!isHttpUrl(value)) errors.push(`${field}: expected an HTTP(S) URL`);
}

function validateRequiredUrl(value, field, errors) {
  if (!isHttpUrl(value)) errors.push(`${field}: expected an HTTP(S) URL`);
}

function validateImage(value, field, errors) {
  if (value == null) return;
  if (!isNonEmptyString(value)) {
    errors.push(`${field}: expected a non-empty image path or URL`);
    return;
  }
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return;

  const normalized = value.replace(/^\.\//, "").replace(/^\//, "");
  const relative = normalized.startsWith("images/")
    ? normalized.slice("images/".length)
    : normalized.startsWith("works/")
      ? normalized
      : path.join("works", normalized);
  const source = path.resolve(ROOT, "public", "images", relative);
  const publicImages = path.resolve(ROOT, "public", "images");
  if (!source.startsWith(`${publicImages}${path.sep}`) || !fs.existsSync(source)) {
    errors.push(`${field}: source image not found (${value})`);
  }
}

function validateWorks(works, errors) {
  if (!Array.isArray(works)) {
    errors.push("works.json: expected an array");
    return;
  }
  works.forEach((item, index) => {
    const field = `works[${index}]`;
    if (!isObject(item)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    validateLocalized(item.title, `${field}.title`, errors);
    validateLocalized(item.description, `${field}.description`, errors);
    if (!WORK_TYPES.has(item.type)) errors.push(`${field}.type: unknown work type`);
    if (!/^\d{4}(0[1-9]|1[0-2])$/.test(String(item.date))) {
      errors.push(`${field}.date: expected YYYYMM`);
    }
    validateRequiredUrl(item.url, `${field}.url`, errors);
    validateImage(item.image, `${field}.image`, errors);
  });
}

function validateEvents(events, errors) {
  if (!Array.isArray(events)) {
    errors.push("events.json: expected an array");
    return;
  }
  events.forEach((item, index) => {
    const field = `events[${index}]`;
    if (!isObject(item)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    validateLocalized(item.title, `${field}.title`, errors);
    validateLocalized(item.description, `${field}.description`, errors);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(item.date))) {
      errors.push(`${field}.date: expected YYYY-MM`);
    }
    if (!EVENT_KINDS.has(item.kind)) errors.push(`${field}.kind: unknown event kind`);
    validateOptionalUrl(item.url, `${field}.url`, errors);
    validateImage(item.image, `${field}.image`, errors);
  });
}

function validateCareer(career, errors) {
  if (!Array.isArray(career)) {
    errors.push("career.json: expected an array");
    return;
  }
  career.forEach((item, index) => {
    const field = `career[${index}]`;
    if (!isObject(item)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    validateLocalized(item.title, `${field}.title`, errors);
    validateLocalized(item.description, `${field}.description`, errors, { nullable: true });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(item.date))) {
      errors.push(`${field}.date: expected YYYY-MM`);
    }
    validateOptionalUrl(item.url, `${field}.url`, errors);
  });
}

function validateLinks(links, errors) {
  if (!Array.isArray(links)) {
    errors.push("links.json: expected an array");
    return;
  }
  links.forEach((item, index) => {
    const field = `links[${index}]`;
    if (!isObject(item)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    validateLocalized(item.title, `${field}.title`, errors);
    validateRequiredUrl(item.url, `${field}.url`, errors);
    if (!isNonEmptyString(item.group)) errors.push(`${field}.group: is required`);
  });
}

function validateSkills(skills, errors) {
  if (!Array.isArray(skills)) {
    errors.push("skills.json: expected an array");
    return;
  }
  skills.forEach((group, index) => {
    const field = `skills[${index}]`;
    if (!isObject(group)) {
      errors.push(`${field}: expected an object`);
      return;
    }
    validateLocalized(group.category, `${field}.category`, errors);
    if (!Array.isArray(group.items) || group.items.length === 0) {
      errors.push(`${field}.items: expected a non-empty array`);
      return;
    }
    group.items.forEach((item, itemIndex) => {
      validateLocalized(item, `${field}.items[${itemIndex}]`, errors);
    });
  });
}

function flattenLeaves(value, prefix = "", output = new Map()) {
  if (isObject(value)) {
    for (const [key, child] of Object.entries(value)) {
      flattenLeaves(child, prefix ? `${prefix}.${key}` : key, output);
    }
    return output;
  }
  output.set(prefix, value);
  return output;
}

function validateDictionaries(dictionaries, errors) {
  const jaLeaves = flattenLeaves(dictionaries.ja);
  const enLeaves = flattenLeaves(dictionaries.en);
  for (const [key, value] of jaLeaves) {
    if (!enLeaves.has(key)) errors.push(`i18n.en: missing key ${key}`);
    if (!isNonEmptyString(value)) errors.push(`i18n.ja.${key}: expected a non-empty string`);
  }
  for (const [key, value] of enLeaves) {
    if (!jaLeaves.has(key)) errors.push(`i18n.ja: missing key ${key}`);
    if (!isNonEmptyString(value)) errors.push(`i18n.en.${key}: expected a non-empty string`);
  }
  for (const locale of LOCALES) {
    if (dictionaries[locale].lang !== locale) {
      errors.push(`i18n/${locale}.json: lang must be ${locale}`);
    }
  }
}

function validatePerson(person, errors) {
  if (!isObject(person)) {
    errors.push("person.json: expected an object");
    return;
  }
  for (const key of ["@context", "@type", "birthDate", "url"]) {
    if (!isNonEmptyString(person[key])) errors.push(`person.${key}: is required`);
  }
  validateLocalized(person.name, "person.name", errors);
  validateLocalized(person.alternateName, "person.alternateName", errors);
  validateLocalized(person.description, "person.description", errors);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(person.birthDate))) {
    errors.push("person.birthDate: expected YYYY-MM-DD");
  }
  validateOptionalUrl(person.url, "person.url", errors);
  if (!isObject(person.image) || !isHttpUrl(person.image.url)) {
    errors.push("person.image: expected an ImageObject with an HTTP(S) url");
  }
  validateLocalized(person.knowsAbout, "person.knowsAbout", errors, { arrays: true });
  validateLocalized(person.award, "person.award", errors, { arrays: true });
}

export function validateProjectData() {
  const files = {
    works: "works.json",
    links: "links.json",
    skills: "skills.json",
    career: "career.json",
    events: "events.json",
    person: "person.json",
  };
  const data = Object.fromEntries(
    Object.entries(files).map(([key, file]) => [key, readJson(path.join(DATA_DIR, file))])
  );
  const dictionaries = Object.fromEntries(
    LOCALES.map((locale) => [locale, readJson(path.join(I18N_DIR, `${locale}.json`))])
  );
  const errors = [];

  validateWorks(data.works, errors);
  validateLinks(data.links, errors);
  validateSkills(data.skills, errors);
  validateCareer(data.career, errors);
  validateEvents(data.events, errors);
  validatePerson(data.person, errors);
  validateDictionaries(dictionaries, errors);

  if (errors.length > 0) {
    throw new Error(`[validate] ${errors.length} error(s):\n- ${errors.join("\n- ")}`);
  }
  return data;
}

const isMain =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  try {
    const data = validateProjectData();
    console.log(
      `[validate] OK · works=${data.works.length} links=${data.links.length} skills=${data.skills.length} career=${data.career.length} events=${data.events.length}`
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
