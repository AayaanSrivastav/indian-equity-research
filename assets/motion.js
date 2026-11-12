/* Scroll reveal shared by every page. A block marked .reveal fades and rises into place when it enters the viewport;
   the children of a .stagger block inside it follow one after another; each child of .reveal-each is its own block.
   Layout only: it never reads or changes a value. Off when the reader's system asks for reduced motion, and
   without JavaScript nothing is hidden (the hiding rules need the "motion" class this script adds). */
(function () {
  "use strict";
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var io = null;

  function show(el) {
    el.classList.add("in");
    el.dispatchEvent(new CustomEvent("revealed", { bubbles: true }));
  }

  if (!reduce && "IntersectionObserver" in window) {
    document.documentElement.classList.add("motion");
    io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { io.unobserve(e.target); show(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
    // Safety net: reveals need painted frames. A page that says it is visible but paints none (an embedded or
    // throttled view) would keep its content hidden, so motion is switched off there and everything shows.
    // A background tab says it is hidden, and keeps its reveals for when the reader switches to it.
    var painted = false;
    window.requestAnimationFrame(function () { painted = true; });
    window.setTimeout(function () {
      if (!painted && document.visibilityState === "visible") { document.documentElement.classList.remove("motion"); }
    }, 2500);
  }

  // Number the children of each .stagger block (their delay), and watch every block not yet watched.
  // Pages call this again after they render data into the page.
  function scan(root) {
    var scope = root || document;
    Array.prototype.forEach.call(scope.querySelectorAll(".reveal-each > *"), function (el) { el.classList.add("reveal"); });
    Array.prototype.forEach.call(scope.querySelectorAll(".stagger"), function (box) {
      Array.prototype.forEach.call(box.children, function (el, i) { el.style.setProperty("--i", String(i)); });
    });
    Array.prototype.forEach.call(scope.querySelectorAll(".reveal:not([data-watched])"), function (el) {
      el.setAttribute("data-watched", "");
      if (el.classList.contains("in") || !io) { show(el); } else { io.observe(el); }
    });
  }

  window.Motion = { scan: scan, on: !!io };
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { scan(); });
  } else {
    scan();
  }
})();
