/**
 * Shared content HTML renderers (Node inject + browser i18n runtime).
 * ESM — used by Vite client and scripts/inject-data.mjs.
 */

export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Resolve bilingual field: string | { ja, en } | null */
export function L(value, locale) {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (typeof value === "object") {
    return (
      value[locale] ||
      value.ja ||
      value.en ||
      Object.values(value).find((v) => typeof v === "string") ||
      ""
    );
  }
  return String(value);
}

export function formatWorkDate(yyyymm, locale) {
  const m = String(yyyymm).match(/^(\d{4})(\d{2})$/);
  if (!m) return escapeHtml(yyyymm);
  if (locale === "en") {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[Number(m[2]) - 1]} ${m[1]}`;
  }
  return `${m[1]}年${m[2]}月`;
}

export function formatTimelineDate(date, locale) {
  const m = String(date).match(/^(\d{4})-(\d{2})$/);
  if (!m) return escapeHtml(date);
  if (locale === "en") {
    const months = [
      "Jan", "Feb", "Mar", "Apr", "May", "Jun",
      "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    return `${months[Number(m[2]) - 1]} ${m[1]}`;
  }
  return `${m[1]}年${m[2]}月`;
}

const TYPE_BADGE = {
  Application: "bg-[#795548] text-ink",
  Website: "bg-light text-ink",
  Extension: "bg-[#9575CD] text-ink",
  Library: "bg-panel text-ink",
};

const KIND_CLASS = {
  award: "bg-primary text-ink",
  qualification: "bg-green text-ink",
  media: "bg-light text-ink",
  event: "bg-panel text-ink",
};

/** Newest first by YYYYMM / sortable date string */
export function sortWorksByDateDesc(works) {
  return [...works].sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

export const WORKS_HOME_LIMIT = 10;

/**
 * Fallback when works/events have no image — same asset as hero (AVIF/WebP via <picture>).
 * Root-absolute `/images/…` so Vite does NOT hash/copy into assets/ (publicDir only).
 */
const DEFAULT_CARD_IMAGE = "/images/header.jpg";

/** Card images (works + events) all live under public/images/works/ */
const CARD_IMAGE_DIR = "/images/works/";

function isRemoteOrDataUrl(src) {
  return /^(https?:)?\/\//i.test(src) || src.startsWith("data:");
}

/**
 * Resolve item.image for works / events.
 * - omitted → header.jpg
 * - `https://...` / `data:` → as-is
 * - `ringee.jpg` → `/images/works/ringee.jpg`（制作物・イベント共通）
 * - `/images/...` or `./images/...` → そのまま正規化
 * @param {"works"|"events"} [_collection] 呼び出し互換のため残す（未使用）
 */
function resolveImage(item, _collection = "works") {
  const raw = item.image || item.imageUrl || "";
  const src = typeof raw === "string" ? raw.trim() : "";
  if (!src) return DEFAULT_CARD_IMAGE;
  if (isRemoteOrDataUrl(src)) return src;
  // Full / relative path override → root-absolute /images/… (avoid Vite asset emit)
  if (src.includes("/") || src.startsWith(".")) {
    if (src.startsWith("/")) return src;
    if (src.startsWith("./")) return src.slice(1); // ./images/x → /images/x
    if (/^works\//i.test(src)) return `/images/${src}`;
    return `/${src}`;
  }
  // Bare filename → public/images/works/
  return `${CARD_IMAGE_DIR}${src}`;
}

/**
 * Local raster paths get <picture> with AVIF/WebP (built by scripts/optimize-images.mjs).
 * Remote/data URLs stay as a plain <img>.
 */
function renderPicture(src, { alt = "", width = 640, height = 320, className = "" } = {}) {
  const imageSrc = src || DEFAULT_CARD_IMAGE;
  const safeSrc = escapeHtml(imageSrc);
  const classAttr = className ? ` class="${escapeHtml(className)}"` : "";
  const img = `<img src="${safeSrc}" alt="${escapeHtml(alt)}" loading="lazy" decoding="async" width="${width}" height="${height}"${classAttr} />`;

  if (isRemoteOrDataUrl(imageSrc)) {
    return img;
  }

  const m = imageSrc.match(/^(.*)\.(png|jpe?g|webp|gif)$/i);
  if (!m) {
    return img;
  }

  const base = m[1];
  return `
<picture>
  <source type="image/avif" srcset="${escapeHtml(`${base}.avif`)}" />
  <source type="image/webp" srcset="${escapeHtml(`${base}.webp`)}" />
  ${img}
</picture>`.trim();
}

function renderMediaHalf(image) {
  return `
  <div class="media-card__media">
    ${renderPicture(image || DEFAULT_CARD_IMAGE)}
  </div>`.trim();
}

/**
 * Square media card: top image / bottom description.
 * variant: "slider" (home) | "grid" (works page)
 * Whole card is one link when href is set (no nested <a>).
 */
function renderSquareMediaCard({
  href,
  image,
  badgeClass,
  badgeText,
  timeHtml,
  title,
  desc,
  extraBody = "",
  variant = "slider",
}) {
  const media = renderMediaHalf(image);
  const body = `
  <div class="media-card__body">
    <div class="media-card__meta">
      <span class="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${badgeClass}">${escapeHtml(badgeText)}</span>
      <time class="text-xs text-secondary/80">${timeHtml}</time>
    </div>
    <h3 class="media-card__title">${title}</h3>
    <p class="media-card__desc">${desc}</p>
    ${extraBody}
  </div>`.trim();

  const shell =
    variant === "grid"
      ? "media-card media-card--grid content-card content-card--hover block no-underline text-inherit"
      : "card-slider-item media-card content-card content-card--hover block no-underline text-inherit";
  const roleAttr = variant === "grid" ? ' role="listitem"' : "";

  if (href) {
    return `
<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer" class="${shell} content-card--clickable"${roleAttr}>
  ${media}
  ${body}
</a>`.trim();
  }
  return `
<article class="${shell}"${roleAttr}>
  ${media}
  ${body}
</article>`.trim();
}

function renderWorkCard(item, locale, { list = false } = {}) {
  const badge = TYPE_BADGE[item.type] || "bg-panel text-ink";
  // Single paragraph (no <br>) so -webkit-line-clamp can show “…” on mobile WebKit
  const desc = escapeHtml(L(item.description, locale)).replace(/\s*\n\s*/g, " ");
  const title = escapeHtml(L(item.title, locale));
  const typeLabel = item.type || "Work";

  return renderSquareMediaCard({
    href: item.url || null,
    image: resolveImage(item, "works"),
    badgeClass: badge,
    badgeText: typeLabel,
    timeHtml: formatWorkDate(item.date, locale),
    title,
    desc,
    variant: list ? "grid" : "slider",
  });
}

/** Home slider cards (optionally pre-sliced). */
export function renderWorks(works, locale) {
  return works.map((item) => renderWorkCard(item, locale, { list: false })).join("\n");
}

/** Full works page: square media cards in a grid. */
export function renderWorksList(works, locale) {
  return works.map((item) => renderWorkCard(item, locale, { list: true })).join("\n");
}

export function renderLinks(links, locale) {
  return links
    .map((item) => {
      return `
<a href="${escapeHtml(item.url)}" target="_blank" rel="me noopener noreferrer"
   class="content-card--link">
  <span>${escapeHtml(L(item.title, locale))}</span>
  <span class="text-primary" aria-hidden="true">→</span>
</a>`.trim();
    })
    .join("\n");
}

export function renderSkills(skills, locale) {
  return skills
    .map((group) => {
      const chips = group.items
        .map((s) => `<span class="skill-chip">${escapeHtml(L(s, locale))}</span>`)
        .join("\n");
      return `
<div class="content-card w-full p-5">
  <h3 class="mb-3 text-base font-bold text-primary">${escapeHtml(L(group.category, locale))}</h3>
  <div class="flex flex-wrap gap-2">${chips}</div>
</div>`.trim();
    })
    .join("\n");
}

export function renderTimeline(items, locale, detailLabel) {
  return items
    .map((item, i) => {
      const desc = escapeHtml(L(item.description, locale));
      const link = item.url
        ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer" class="career-detail-link whitespace-nowrap text-sm font-medium text-light hover:underline">${escapeHtml(detailLabel)}</a>`
        : "";
      const body =
        desc || link
          ? `<p class="mt-1 text-sm leading-relaxed text-text/85"><span class="career-desc">${desc}</span>${link}</p>`
          : "";
      return `
<li class="relative pl-8 pb-8 last:pb-0">
  <span class="absolute left-0 top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-page" aria-hidden="true"></span>
  ${i < items.length - 1 ? '<span class="absolute left-[6px] top-5 bottom-0 w-0.5 bg-tertiary" aria-hidden="true"></span>' : ""}
  <time class="mb-1 block text-xs font-semibold uppercase tracking-wide text-primary">${formatTimelineDate(item.date, locale)}</time>
  <h3 class="text-base font-bold text-text">${escapeHtml(L(item.title, locale))}</h3>
  ${body}
</li>`.trim();
    })
    .join("\n");
}

export function renderEvents(events, locale, dict) {
  const kindLabels = (dict.events && dict.events.kind) || {};
  return events
    .map((item) => {
      const kindClass = KIND_CLASS[item.kind] || KIND_CLASS.event;
      const kindLabel = kindLabels[item.kind] || kindLabels.event || item.kind;
      const title = escapeHtml(L(item.title, locale));
      // No <br>: multi-line clamp + ellipsis needs a single text run
      const desc = escapeHtml(L(item.description, locale)).replace(/\s*\n\s*/g, " ");

      return renderSquareMediaCard({
        href: item.url || null,
        image: resolveImage(item, "events"),
        badgeClass: kindClass,
        badgeText: kindLabel,
        timeHtml: formatTimelineDate(item.date, locale),
        title,
        desc,
      });
    })
    .join("\n");
}

/** Locale-resolve string | string[] | { ja, en } | nested caption fields for JSON-LD */
function resolveLdLocale(value, locale) {
  if (value == null) return value;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    // Bilingual list: { ja: [...], en: [...] } is object, not array
    return value.map((item) => resolveLdLocale(item, locale));
  }
  if (typeof value === "object") {
    // { ja, en } leaf (string or string[])
    if ("ja" in value || "en" in value) {
      const picked = value[locale] ?? value.ja ?? value.en;
      return resolveLdLocale(picked, locale);
    }
    // Structured object (ImageObject, Country, PostalAddress, …)
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = resolveLdLocale(v, locale);
    }
    return out;
  }
  return value;
}

/**
 * Person JSON-LD from src/data/person.json (single source of truth).
 * @param {object} person - parsed person.json
 * @param {string} locale - ja | en
 * @param {string} pageCanonical - full page URL for mainEntityOfPage
 */
export function buildPersonJsonLd(person, locale, pageCanonical) {
  const p = person || {};
  const image = resolveLdLocale(p.image, locale);

  return {
    "@context": p["@context"] || "https://schema.org",
    "@type": p["@type"] || "Person",
    name: p.name,
    alternateName: p.alternateName,
    givenName: resolveLdLocale(p.givenName, locale),
    familyName: resolveLdLocale(p.familyName, locale),
    description: resolveLdLocale(p.description, locale),
    birthDate: p.birthDate,
    gender: p.gender,
    nationality: resolveLdLocale(p.nationality, locale),
    address: resolveLdLocale(p.address, locale),
    jobTitle: resolveLdLocale(p.jobTitle, locale),
    knowsLanguage: p.knowsLanguage,
    knowsAbout: resolveLdLocale(p.knowsAbout, locale),
    sameAs: p.sameAs,
    url: p.url,
    image,
    award: resolveLdLocale(p.award, locale) || [],
    mainEntityOfPage: {
      "@type": "WebPage",
      "@id": pageCanonical,
    },
  };
}

/** Compact JSON string for embedding in <script type="application/ld+json"> */
export function personJsonLdString(person, locale, pageCanonical) {
  return JSON.stringify(buildPersonJsonLd(person, locale, pageCanonical));
}

