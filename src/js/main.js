import "../css/main.css";
import { initLangMenu } from "./i18n-runtime.js";

const THEME_KEY = "about-ogatomo-theme";
const THEME_OPTS = ["system", "light", "dark"];
const THEME_INDEX = { system: 0, light: 1, dark: 2 };

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getStoredTheme() {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (THEME_OPTS.includes(t)) return t;
  } catch {
    /* ignore */
  }
  return "system";
}

function resolveDark(theme) {
  if (theme === "dark") return true;
  if (theme === "light") return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

/** Sliding pill under the active theme ○ */
function updateThemeThumb(mode) {
  const idx = THEME_INDEX[mode] ?? 0;
  document.querySelectorAll(".theme-switch").forEach((el) => {
    el.style.setProperty("--theme-i", String(idx));
    if (!el.querySelector(".theme-switch-thumb")) {
      const thumb = document.createElement("span");
      thumb.className = "theme-switch-thumb";
      thumb.setAttribute("aria-hidden", "true");
      el.insertBefore(thumb, el.firstChild);
    }
  });
}

function applyThemeCore(theme) {
  const mode = THEME_OPTS.includes(theme) ? theme : "system";
  const dark = resolveDark(mode);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.dataset.theme = mode;
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* ignore */
  }
  const meta = document.getElementById("meta-theme-color");
  if (meta) meta.setAttribute("content", dark ? "#12141c" : "#7086bd");

  document.querySelectorAll("[data-theme-opt]").forEach((btn) => {
    const on = btn.getAttribute("data-theme-opt") === mode;
    btn.setAttribute("aria-checked", on ? "true" : "false");
  });
  updateThemeThumb(mode);
  return mode;
}

/**
 * Theme: system / light / dark (persisted).
 * Animates via View Transitions when available, else brief CSS color ease + sliding pill.
 */
function applyTheme(theme, { animate = true } = {}) {
  const run = () => applyThemeCore(theme);

  if (!animate || prefersReducedMotion()) {
    run();
    return;
  }

  const html = document.documentElement;
  html.classList.add("theme-switching");

  const clear = () => {
    window.setTimeout(() => html.classList.remove("theme-switching"), 40);
  };

  if (typeof document.startViewTransition === "function") {
    try {
      const vt = document.startViewTransition(() => {
        run();
      });
      vt.finished.then(clear).catch(clear);
      return;
    } catch {
      /* fall through */
    }
  }

  run();
  window.setTimeout(clear, 280);
}

/**
 * Theme: system / light / dark (persisted). Three ○ buttons in the header.
 */
function initTheme() {
  applyTheme(getStoredTheme(), { animate: false });

  document.querySelectorAll("[data-theme-opt]").forEach((btn) => {
    btn.addEventListener("click", () => {
      applyTheme(btn.getAttribute("data-theme-opt"), { animate: true });
    });
  });

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSystemChange = () => {
    if (getStoredTheme() === "system") applyTheme("system", { animate: true });
  };
  if (typeof mq.addEventListener === "function") {
    mq.addEventListener("change", onSystemChange);
  } else if (typeof mq.addListener === "function") {
    mq.addListener(onSystemChange);
  }
}

/** Fixed header height for offset scrolls (matches .site-header + safe area). */
function headerOffset() {
  const header = document.getElementById("site-header");
  if (!header || !header.classList.contains("is-visible")) {
    return Math.round(Math.min(160, Math.max(88, window.innerHeight * 0.14)));
  }
  return Math.ceil(header.getBoundingClientRect().height) + 12;
}

/**
 * Soft scroll to a section / element.
 * Native hash scroll sticks the target flush to the top — we keep breathing room
 * under the fixed header (or a soft margin when header is hidden).
 */
function softScrollTo(el, { updateHash = true, hash = null } = {}) {
  if (!el) return;

  const margin = headerOffset();
  const top = el.getBoundingClientRect().top + window.scrollY - margin;

  window.scrollTo({
    top: Math.max(0, top),
    behavior: "smooth",
  });

  if (updateHash && hash != null && history.replaceState) {
    history.replaceState(null, "", hash);
  }
}

function softScrollToAbout({ updateHash = true } = {}) {
  const heading =
    document.getElementById("about-heading") ||
    document.getElementById("about");
  softScrollTo(heading, {
    updateHash,
    hash: "#about",
  });
}

function initScrollToAbout() {
  const links = document.querySelectorAll('a[href="#about"]');
  links.forEach((link) => {
    link.addEventListener("click", (event) => {
      event.preventDefault();
      softScrollToAbout({ updateHash: true });
    });
  });

  if (window.location.hash === "#about") {
    requestAnimationFrame(() => {
      softScrollToAbout({ updateHash: false });
    });
  }
}

/**
 * Mobile: hamburger opens panel with nav + lang + theme.
 * Desktop (md+): panel always laid out as a row (CSS).
 */
function initHeaderMenu() {
  document.querySelectorAll("[data-header-menu]").forEach((root) => {
    const toggle = root.querySelector("[data-header-menu-toggle]");
    const panel = root.querySelector("[data-header-menu-panel]");
    if (!toggle || !panel) return;

    const setOpen = (open) => {
      root.classList.toggle("is-menu-open", open);
      document.body.classList.toggle("header-menu-open", open);
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      const ja = document.documentElement.lang === "ja";
      const openText = ja ? "メニューを開く" : "Open menu";
      const closeText = ja ? "メニューを閉じる" : "Close menu";
      toggle.setAttribute("aria-label", open ? closeText : openText);
      toggle.setAttribute(
        "data-i18n-attr",
        open ? "aria-label:nav.menuClose" : "aria-label:nav.menuOpen"
      );
    };

    const close = () => setOpen(false);
    const isOpen = () => root.classList.contains("is-menu-open");

    setOpen(false);

    toggle.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(!isOpen());
    });

    // Close after choosing a nav item (mobile fullscreen menu)
    panel.querySelectorAll("a.site-nav-btn").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 767px)").matches) close();
      });
    });

    // Brand click on mobile also closes menu
    root.querySelectorAll("a.site-brand").forEach((link) => {
      link.addEventListener("click", () => {
        if (window.matchMedia("(max-width: 767px)").matches) close();
      });
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") close();
    });

    // Desktop layout: force closed state (panel always visible via CSS)
    const mq = window.matchMedia("(min-width: 768px)");
    const onMq = () => {
      if (mq.matches) close();
    };
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onMq);
    else if (typeof mq.addListener === "function") mq.addListener(onMq);
  });
}

/**
 * Header: after hero on home; always visible on pages without a full-viewport hero.
 * Nav: ホーム → top (or index), 制作物 → works page, お問い合わせ → external.
 */
function initSiteHeader() {
  const header = document.getElementById("site-header");
  if (!header) return;

  const hero = document.querySelector(".hero-viewport");
  const page = document.body?.getAttribute("data-page") || "index";

  const setVisible = (show) => {
    header.classList.toggle("is-visible", show);
    header.setAttribute("aria-hidden", show ? "false" : "true");
    header.querySelectorAll("a, button").forEach((el) => {
      if (show) el.removeAttribute("tabindex");
      else el.setAttribute("tabindex", "-1");
    });
    // Closing the header (back on hero) also closes mobile menu
    if (!show) {
      document.body.classList.remove("header-menu-open");
      header.querySelectorAll("[data-header-menu]").forEach((root) => {
        root.classList.remove("is-menu-open");
        const toggle = root.querySelector("[data-header-menu-toggle]");
        if (toggle) {
          toggle.setAttribute("aria-expanded", "false");
          const ja = document.documentElement.lang === "ja";
          toggle.setAttribute("aria-label", ja ? "メニューを開く" : "Open menu");
          toggle.setAttribute("data-i18n-attr", "aria-label:nav.menuOpen");
        }
      });
    }
  };

  if (!hero) {
    // Works / 404-style pages: header always on
    setVisible(true);
  } else {
    setVisible(false);
    const io = new IntersectionObserver(
      ([entry]) => {
        setVisible(!entry.isIntersecting);
      },
      { threshold: 0, rootMargin: "0px" }
    );
    io.observe(hero);
  }

  header.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const kind = link.getAttribute("data-nav");
      if (kind === "home") {
        // Already on home: smooth scroll to top
        if (page === "index" || !document.body?.getAttribute("data-page")) {
          event.preventDefault();
          window.scrollTo({ top: 0, behavior: "smooth" });
          if (history.replaceState) history.replaceState(null, "", "#top");
        }
        // else: follow href to index.{lang}.html
        return;
      }
      // works: normal navigation to works.{lang}.html
    });
  });

  initHeaderMenu();
}

/** Tear down previous slider timers/listeners by cloning roots is heavy — track cleanups. */
const sliderCleanups = [];

function destroyCardSliders() {
  while (sliderCleanups.length) {
    const fn = sliderCleanups.pop();
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Card sliders for works / events.
 * - Auto-advance every data-interval ms (default 5000)
 * - Manual: prev/next buttons, drag/swipe on track, keyboard when focused
 * - Pauses while hovered / focused / pointer down / tab hidden
 * Safe to call again after language switch (content re-render).
 */
function initCardSliders() {
  destroyCardSliders();
  const roots = document.querySelectorAll("[data-card-slider]");
  roots.forEach((root) => {
    const track = root.querySelector("[data-slider-track]");
    if (!track) return;

    // Controls may live outside the track wrapper (sibling header area)
    const section = root.closest("section") || root.parentElement;
    const prev =
      section?.querySelector(`[data-slider-prev][aria-controls="${track.id}"]`) ||
      section?.querySelector("[data-slider-prev]");
    const next =
      section?.querySelector(`[data-slider-next][aria-controls="${track.id}"]`) ||
      section?.querySelector("[data-slider-next]");

    const intervalMs = Number(root.getAttribute("data-interval")) || 5000;
    let timerId = null;
    let userPaused = false;

    function stepWidth() {
      const item = track.querySelector(".card-slider-item");
      if (!item) return Math.max(200, track.clientWidth * 0.8);
      const styles = window.getComputedStyle(track);
      const gap = parseFloat(styles.columnGap || styles.gap) || 0;
      return item.getBoundingClientRect().width + gap;
    }

    function atEnd() {
      return track.scrollLeft + track.clientWidth >= track.scrollWidth - 8;
    }

    function atStart() {
      return track.scrollLeft <= 8;
    }

    function go(dir) {
      if (dir > 0 && atEnd()) {
        track.scrollTo({ left: 0, behavior: "smooth" });
        return;
      }
      if (dir < 0 && atStart()) {
        track.scrollTo({ left: track.scrollWidth, behavior: "smooth" });
        return;
      }
      track.scrollBy({ left: dir * stepWidth(), behavior: "smooth" });
    }

    function stopAuto() {
      if (timerId != null) {
        clearInterval(timerId);
        timerId = null;
      }
    }

    function startAuto() {
      stopAuto();
      if (userPaused || document.hidden) return;
      if (track.querySelectorAll(".card-slider-item").length < 2) return;
      timerId = window.setInterval(() => {
        if (!userPaused && !document.hidden) go(1);
      }, intervalMs);
    }

    function pause() {
      userPaused = true;
      stopAuto();
    }

    function resume() {
      userPaused = false;
      startAuto();
    }

    const onPrev = () => {
      go(-1);
      userPaused = false;
      startAuto();
    };
    const onNext = () => {
      go(1);
      userPaused = false;
      startAuto();
    };
    prev?.addEventListener("click", onPrev);
    next?.addEventListener("click", onNext);

    const onKey = (e) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
        startAuto();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
        startAuto();
      }
    };
    track.addEventListener("keydown", onKey);

    // Hover / focus pause (include header controls outside the track root)
    const hoverTarget = section || root;
    const onFocusOut = (e) => {
      if (!hoverTarget.contains(e.relatedTarget)) resume();
    };
    hoverTarget.addEventListener("mouseenter", pause);
    hoverTarget.addEventListener("mouseleave", resume);
    hoverTarget.addEventListener("focusin", pause);
    hoverTarget.addEventListener("focusout", onFocusOut);

    // Touch / pointer drag: pause while interacting, resume after
    let pointerActive = false;
    const onPointerDown = () => {
      pointerActive = true;
      pause();
    };
    const onPointerUp = () => {
      if (!pointerActive) return;
      pointerActive = false;
      window.setTimeout(resume, 400);
    };
    track.addEventListener("pointerdown", onPointerDown, { passive: true });
    window.addEventListener("pointerup", onPointerUp, { passive: true });

    const onVis = () => {
      if (document.hidden) stopAuto();
      else if (!userPaused) startAuto();
    };
    document.addEventListener("visibilitychange", onVis);

    startAuto();

    sliderCleanups.push(() => {
      stopAuto();
      prev?.removeEventListener("click", onPrev);
      next?.removeEventListener("click", onNext);
      track.removeEventListener("keydown", onKey);
      hoverTarget.removeEventListener("mouseenter", pause);
      hoverTarget.removeEventListener("mouseleave", resume);
      hoverTarget.removeEventListener("focusin", pause);
      hoverTarget.removeEventListener("focusout", onFocusOut);
      track.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      document.removeEventListener("visibilitychange", onVis);
    });
  });
}

function initYear() {
  const el = document.getElementById("copyright-year");
  if (el) el.textContent = String(new Date().getFullYear());
}

document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initYear();
  initSiteHeader();
  initScrollToAbout();
  // Language: client-side switch (no full reload). Re-init sliders after content swap.
  initLangMenu({
    afterApply: () => {
      initCardSliders();
    },
  });
  initCardSliders();
});
