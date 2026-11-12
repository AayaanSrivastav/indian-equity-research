/* The mandatory disclaimer (the author's specification). It is the first element of every page's <body>, so it
   opens before the page is drawn, and it shows on whichever page a visit starts (a typed address, a bookmark, a link
   from another site such as a shared company page) or when a page is reloaded. Moving inside the site (a link or the
   Back button) shows nothing more:
   that is read from the page the reader came from and the kind of navigation, never from stored data (no storage of
   any kind is used). The page behind stays visible but inert. Only the confirmation button closes it: Esc is refused,
   a click outside does nothing (a modal dialog ignores it), the × stays disabled until the reader confirms, and any
   other close (a browser forcing a dialog shut after repeated Esc presses) reopens it at once.
   Layout only: it never reads or changes a value. */
(function () {
  "use strict";
  var entry = window.performance && performance.getEntriesByType ? performance.getEntriesByType("navigation")[0] : null;
  var kind = entry ? entry.type : "navigate";
  var from = null;
  try { from = document.referrer ? new URL(document.referrer) : null; } catch (e) { from = null; }
  var dir = location.pathname.slice(0, location.pathname.lastIndexOf("/") + 1);  // the folder the site is served from
  var inSite = !!from && from.origin === location.origin && from.pathname.slice(0, dir.length) === dir;
  if (kind === "back_forward" || (kind !== "reload" && inSite)) { return; }  // moving around the site: no pop-up

  var PARAGRAPHS = [
    "This website is an independent academic project developed exclusively for educational, informational, and research " +
      "purposes. All company analyses, stock valuations, DCF models, financial projections, market insights, and " +
      "investment-related outputs are intended solely to demonstrate financial modelling and analytical methodologies.",
    "Nothing presented on this website constitutes investment advice, financial advice, trading recommendations, securities research recommendations, or an offer or solicitation to buy, sell, or hold any financial instrument.",
    "This website is not operated by a SEBI-registered investment adviser or research analyst. No content should be " +
      "interpreted as regulated investment advisory or research services under applicable Indian securities laws.",
    "All valuations, forecasts, assumptions, and projections are hypothetical, inherently uncertain, and subject to errors. " +
      "Market information may be incomplete, outdated, or inaccurate. Past performance does not guarantee future results.",
    "Users must independently verify information and consult appropriately qualified and registered financial " +
      "professionals before making investment decisions.",
    "The developer accepts no responsibility or liability for investment decisions, financial losses, or actions taken " +
      "based on this website's content."
  ];
  var CLOSING = "By proceeding, you acknowledge and agree that you understand the educational nature and limitations of this project.";
  var acknowledged = false;

  function el(tag, attrs, text) {
    var e = document.createElement(tag);
    Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); });
    if (text) { e.textContent = text; }
    return e;
  }

  var dlg = el("dialog", { "class": "disclaimer-dialog", id: "disclaimer-modal",
                           "aria-labelledby": "dsc-title", "aria-describedby": "dsc-text dsc-closing" });
  var head = el("div", { "class": "dsc-head" });
  head.appendChild(el("span", { "class": "brand-mark", "aria-hidden": "true" }, "₹"));
  head.appendChild(el("h2", { id: "dsc-title" }, "Academic project disclaimer"));
  var x = el("button", { type: "button", "class": "dsc-x", disabled: "",
                         "aria-label": "Close, available once you confirm below", title: "Confirm below to continue" }, "×");
  head.appendChild(x);
  // focusable so the text can be scrolled from the keyboard; it takes the focus first, so reading starts at the top
  var text = el("div", { "class": "dsc-text", id: "dsc-text", tabindex: "0", role: "region",
                         "aria-label": "Disclaimer text", autofocus: "" });
  PARAGRAPHS.forEach(function (p, i) { text.appendChild(el("p", i === 1 ? { "class": "dsc-key" } : {}, p)); });
  var foot = el("div", { "class": "dsc-foot" });
  foot.appendChild(el("p", { "class": "dsc-closing", id: "dsc-closing" }, CLOSING));
  var ok = el("button", { type: "button", "class": "btn dsc-ok" }, "Yes, I've read and I'm clear.");
  foot.appendChild(ok);
  dlg.appendChild(head);
  dlg.appendChild(text);
  dlg.appendChild(foot);

  dlg.addEventListener("cancel", function (e) { e.preventDefault(); });  // Esc
  dlg.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); } });
  dlg.addEventListener("close", function () { if (!acknowledged) { dlg.showModal(); } });  // any close but the button's
  x.addEventListener("click", function () { if (acknowledged) { dlg.close(); } });

  ok.addEventListener("click", function () {
    acknowledged = true;
    x.disabled = false;
    var done = false;
    function finish() {
      if (done) { return; }
      done = true;
      dlg.classList.remove("closing");
      dlg.close();
      dlg.remove();
    }
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) { finish(); return; }
    dlg.classList.add("closing");
    dlg.addEventListener("animationend", finish, { once: true });
    var shut = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--close-time")) || 0;
    window.setTimeout(finish, shut + 60);  // if no frame is painted, close anyway
  });

  document.body.appendChild(dlg);
  dlg.showModal();
})();
