/* Method page (method.html). Fills each [data-m] slot from data/method.json, which the engine writes from its own
   constants; the page types no figure of its own. */
(function () {
  "use strict";
  function $(id) { return document.getElementById(id); }

  $("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) { cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    var t = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) { /* storage unavailable: theme still applies */ }
  });

  fetch("data/method.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) { throw new Error("HTTP " + r.status); }
    return r.json();
  }).then(function (data) {
    var slots = document.querySelectorAll("[data-m]");
    for (var i = 0; i < slots.length; i++) {
      var v = slots[i].getAttribute("data-m").split(".").reduce(function (o, k) { return o == null ? o : o[k]; }, data);
      slots[i].textContent = v == null ? "(not available)" : v;
    }
  }).catch(function (err) {
    var slots = document.querySelectorAll("[data-m]");
    for (var i = 0; i < slots.length; i++) { slots[i].textContent = "(not loaded: " + err.message + ")"; }
  });
})();
