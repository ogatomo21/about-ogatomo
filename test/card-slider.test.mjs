import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

test("slider keeps focus/manual stops and handles overlapping hover and pointer pauses", () => {
  function element() {
    const listeners = new Map();
    const attributes = new Map();
    return {
      dataset: {},
      addEventListener(name, fn) {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(fn);
      },
      removeEventListener: (name, fn) => listeners.get(name)?.delete(fn),
      emit(name, event = {}) {
        for (const fn of listeners.get(name) || []) fn(event);
      },
      getAttribute: (name) => attributes.get(name) ?? null,
      setAttribute: (name, value) => attributes.set(name, value),
    };
  }
  const toggle = element();
  const track = Object.assign(element(), { id: "works", querySelectorAll: () => [{}, {}] });
  const section = Object.assign(element(), {
    querySelector: (selector) => selector.includes("data-slider-toggle") ? toggle : null,
    matches: () => false,
    contains: (target) => target === track || target === toggle,
  });
  const root = Object.assign(element(), { querySelector: () => track, closest: () => section });
  const timers = new Set();
  let nextTimer = 0;
  const motion = Object.assign(element(), { matches: false });
  const document = Object.assign(element(), { hidden: false, querySelectorAll: () => [root] });
  const window = Object.assign(element(), {
    matchMedia: () => motion,
    setInterval: () => { timers.add(++nextTimer); return nextTimer; },
  });
  // Execute the actual browser module; DOMContentLoaded stays pending in this harness.
  const source = fs.readFileSync(new URL("../src/js/main.js", import.meta.url), "utf8")
    .replace(/^import .*;\r?$/gm, "");
  const context = vm.createContext({ document, window, clearInterval: (id) => timers.delete(id) });
  vm.runInContext(source, context);
  const init = () => vm.runInContext("initCardSliders()", context);
  init();
  assert.equal(timers.size, 1);

  section.emit("mouseenter");
  track.emit("pointerdown");
  window.emit("pointerup");
  assert.equal(timers.size, 0, "pointer release must not cancel hover pause");
  section.emit("mouseleave");
  assert.equal(timers.size, 1);
  track.emit("pointerdown");
  section.emit("mouseleave");
  assert.equal(timers.size, 0, "mouse leave must not cancel pointer pause");
  window.emit("pointercancel");
  assert.equal(timers.size, 1);

  section.emit("focusin", { target: track });
  section.emit("mouseleave");
  section.emit("focusout", { relatedTarget: null });
  document.emit("visibilitychange");
  assert.equal(timers.size, 0, "focus stop requires explicit resume");
  assert.equal(toggle.getAttribute("data-slider-paused"), "true");
  init();
  assert.equal(timers.size, 0, "language reinitialization must preserve the stop");
  toggle.emit("click");
  assert.equal(timers.size, 1, "explicit resume works and listeners are not duplicated");
  section.emit("focusin", { target: toggle });
  toggle.emit("click");
  assert.equal(timers.size, 0, "focusing the stop button must not reverse its click action");

  toggle.emit("click");
  motion.matches = true;
  motion.emit("change");
  assert.equal(timers.size, 0);
  motion.matches = false;
  motion.emit("change");
  assert.equal(timers.size, 1);
  vm.runInContext("destroyCardSliders()", context);
  window.emit("pointercancel");
  section.emit("mouseleave");
  assert.equal(timers.size, 0, "cleanup leaves no timer or restart listener");
});
