/* Compare view (compare.html?c=a,b,c). Places the engine's rendered cells from data/companies.json side by side,
   in the order the reader chose. Nothing here computes, sorts, ranks or colours by value. */
(function () {
  "use strict";
  var all = [], rows = [], SLOTS = 3;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  $("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) { cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    var t = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) { /* storage unavailable: theme still applies */ }
  });

  function chosen() {
    var q = new URLSearchParams(window.location.search).get("c") || "";
    var slugs = all.map(function (c) { return c.slug; });
    return q.split(",").filter(function (s, i, a) { return s && slugs.indexOf(s) >= 0 && a.indexOf(s) === i; }).slice(0, SLOTS);
  }

  function pickers(sel) {
    var html = "";
    for (var i = 0; i < SLOTS; i++) {
      html += '<div><label for="slot' + i + '">Company ' + ["one", "two", "three"][i] + "</label>" +
        '<select id="slot' + i + '" data-slot="' + i + '"><option value="">None</option>' +
        all.map(function (c) {
          return '<option value="' + esc(c.slug) + '"' + (sel[i] === c.slug ? " selected" : "") + ">" + esc(c.name) + "</option>";
        }).join("") + "</select></div>";
    }
    $("pickers").innerHTML = html;
  }

  function cell(c, id) {
    var x = c.compare[id];
    if (!x) { return '<td><span class="muted">not available</span></td>'; }
    return '<td title="' + esc(x.type) + '">' + esc(x.display) +
      (x.period ? '<span class="per">' + esc(x.period) + "</span>" : "") +
      (x.note ? '<span class="why">' + esc(x.note) + "</span>" : "") + "</td>";
  }

  function render() {
    var sel = chosen();
    pickers(sel);
    var cos = sel.map(function (s) { return all.filter(function (c) { return c.slug === s; })[0]; });
    if (cos.length < 2) {
      $("cmp").innerHTML = '<p class="small muted" style="padding:14px">Choose at least two companies above, or tick them on the company list.</p>';
      $("cmp-note").textContent = "";
      return;
    }
    $("cmp").innerHTML = '<table class="cmp"><thead><tr><th>Figure</th>' +
      cos.map(function (c) {
        return '<th><a href="company.html?c=' + encodeURIComponent(c.slug) + '">' + esc(c.name) + '</a><span class="per">' + esc(c.symbol) + " · " + esc(c.sector_label) + "</span></th>";
      }).join("") + "</tr></thead><tbody>" +
      rows.map(function (r) {
        return "<tr><td>" + esc(r.label) + '<span class="def">' + esc(r.definition) + "</span></td>" +
          cos.map(function (c) { return cell(c, r.id); }).join("") + "</tr>";
      }).join("") + "</tbody></table>";
    $("cmp-note").textContent = "Hover a figure to see its label (fact, calculation or missing). Every figure links back to its company page, where its sources and checks are shown.";
  }

  document.addEventListener("change", function (e) {
    if (!e.target.getAttribute || e.target.getAttribute("data-slot") === null) { return; }
    var vals = [];
    for (var i = 0; i < SLOTS; i++) { var v = $("slot" + i).value; if (v && vals.indexOf(v) < 0) { vals.push(v); } }
    var url = new URL(window.location.href);
    if (vals.length) { url.searchParams.set("c", vals.join(",")); } else { url.searchParams.delete("c"); }
    window.history.replaceState(null, "", url.pathname + url.search);
    render();
  });

  fetch("data/companies.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) { throw new Error("HTTP " + r.status); }
    return r.json();
  }).then(function (data) {
    all = data.companies;
    rows = data.compare_rows;
    $("footer").textContent = data.disclaimer + " Built " + data.built + " from public filings and exchange data.";
    render();
  }).catch(function (err) {
    $("cmp").innerHTML = '<div class="error">The company list could not be loaded (' + esc(err.message) + "). If you opened this file directly, serve the folder over HTTP instead.</div>";
  });
})();
