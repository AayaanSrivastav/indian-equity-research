/* Company index (index.html). Lists the companies in data/companies.json; values were rendered by the engine.
   Search, the two filters, the order and the view only arrange the list; nothing here computes a number.
   Orderings are by name, sector or market cap only, never by a model result. */
(function () {
  "use strict";
  var cards = [], picked = [], MAX_PICK = 3;
  var ORDER = {  // the only orderings the index offers
    name: function (a, b) { return a.name.localeCompare(b.name); },
    sector: function (a, b) { return a.sector_label.localeCompare(b.sector_label) || a.name.localeCompare(b.name); },
    market_cap: function (a, b) { return b.market_cap_crore - a.market_cap_crore; }
  };

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function store(key, value) { try { localStorage.setItem(key, value); } catch (e) { /* storage unavailable */ } }
  function stored(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  $("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) { cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    var t = cur === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", t);
    store("theme", t);
  });

  // the flags on a company's page: a warning badge when it has a caution, a plain one when it has only notes; it links to the flags
  function flagBadge(c) {
    var f = c.flags || { caution: [], note: [] }, n = f.caution.length + f.note.length;
    if (!n) { return ""; }
    var label = f.caution.length ? "⚠ " + f.caution.length + (f.caution.length === 1 ? " caution" : " cautions") : "ℹ " + n + (n === 1 ? " note" : " notes");
    return '<a class="badge' + (f.caution.length ? " warn" : "") + '" href="company.html?c=' + encodeURIComponent(c.slug) + '#flags" title="' +
      esc(f.caution.concat(f.note).join("; ")) + '">' + label + "</a>";
  }
  function badges(c) {
    return (c.applicable ? '<span class="badge">Template ' + esc(c.template) + "</span>" : '<span class="badge warn">Template does not apply</span>') +
      (c.set_by_rule ? '<span class="badge">Assumptions set by rule</span>' : "") + flagBadge(c);
  }
  function pick(c) {
    var on = picked.indexOf(c.slug) >= 0, full = picked.length >= MAX_PICK && !on;
    return '<label class="pick"><input type="checkbox" data-slug="' + esc(c.slug) + '"' + (on ? " checked" : "") +
      (full ? " disabled" : "") + "> Compare</label>";
  }

  function card(c) {
    var stat = function (k, v, sub) {
      return '<div class="stat"><div class="k">' + esc(k) + '</div><div class="v">' + esc(v) + "</div>" + (sub ? '<div class="sub">' + esc(sub) + "</div>" : "") + "</div>";
    };
    return '<article class="card co-card">' +
      '<div class="top"><h3><a href="company.html?c=' + encodeURIComponent(c.slug) + '">' + esc(c.name) + '</a></h3><span class="chip">' + esc(c.symbol) + "</span></div>" +
      '<div class="small muted">' + esc(c.sector) + "</div>" +
      '<div class="px">' + esc(c.price) + ' <span class="pill ' + (c.up ? "up" : "down") + '" style="font-size:13px">' + (c.up ? "▲ " : "▼ ") + esc(c.change_pct) + "</span></div>" +
      '<div class="small muted">NSE close, ' + esc(c.as_of) + "</div>" +
      '<div class="facts">' + stat("Market cap", c.market_cap) +
      (c.applicable ? stat("Growth the price implies", c.implied_growth + " a year") : stat("Model value", "Not applicable")) +
      stat("Grew " + c.history_span, c.history_growth + " a year") + "</div>" +
      '<div class="badges">' + badges(c) + "</div>" + pick(c) + "</article>";
  }

  function table(rows, sort) {
    var head = function (key, label, cls) {
      var aria = sort === key ? (key === "market_cap" ? "descending" : "ascending") : "none";
      return '<th class="' + (cls || "") + '" aria-sort="' + aria + '"><button type="button" data-sort="' + key + '">' + label + "</button></th>";
    };
    return '<table class="co-table"><thead><tr>' + head("name", "Company") + head("sector", "Sector") +
      '<th class="num">Price</th><th class="num">Day</th>' + head("market_cap", "Market cap", "num") +
      "<th>Valuation template</th><th>Compare</th></tr></thead><tbody>" +
      rows.map(function (c) {
        return '<tr><td><a href="company.html?c=' + encodeURIComponent(c.slug) + '">' + esc(c.name) + '</a> <span class="small muted">' + esc(c.symbol) + "</span></td>" +
          "<td>" + esc(c.sector_label) + '</td><td class="num">' + esc(c.price) + ' <span class="small muted">' + esc(c.as_of) + "</span></td>" +
          '<td class="num ' + (c.up ? "yes" : "no") + '">' + esc(c.change_pct) + '</td><td class="num">' + esc(c.market_cap) + "</td>" +
          "<td>" + (c.applicable ? "Template " + esc(c.template) : "Does not apply") + " " + flagBadge(c) + "</td><td>" + pick(c) + "</td></tr>";
      }).join("") + "</tbody></table>";
  }

  var rendered = 0;
  function render() {
    // the cards rise in once, on the first render; filtering and re-ordering after that is instant (motion.js)
    if (rendered++) { $("cards").classList.add("settled"); }
    var q = $("q").value.trim().toLowerCase(), sector = $("sector").value, status = $("status").value, sort = $("sort").value;
    var shown = cards.filter(function (c) {
      return (!q || (c.name + " " + c.symbol + " " + c.sector + " " + c.sector_label).toLowerCase().indexOf(q) >= 0) &&
        (!sector || c.sector_label === sector) &&
        (!status || status === (c.template || "refused"));
    }).sort(ORDER[sort]);
    var tableView = $("view-table").getAttribute("aria-pressed") === "true";
    $("cards").hidden = tableView;
    $("table").hidden = !tableView;
    var none = '<p class="small muted">No company matches these filters.</p>';
    if (tableView) { $("table").innerHTML = shown.length ? table(shown, sort) : none; }
    else { $("cards").innerHTML = shown.length ? shown.map(card).join("") : none; }
    $("count").textContent = shown.length + " of " + cards.length + " companies";
    if (window.Motion) { window.Motion.scan(); }
    var go = $("compare-go");
    go.href = "compare.html?c=" + picked.map(encodeURIComponent).join(",");
    go.setAttribute("aria-disabled", picked.length >= 2 ? "false" : "true");
    go.textContent = picked.length ? "Compare selected (" + picked.length + ")" : "Compare selected";
  }

  function setView(tableView) {
    $("view-cards").setAttribute("aria-pressed", String(!tableView));
    $("view-table").setAttribute("aria-pressed", String(tableView));
    store("index-view", tableView ? "table" : "cards");
    render();
  }

  ["q", "sector", "status", "sort"].forEach(function (id) { $(id).addEventListener(id === "q" ? "input" : "change", render); });
  $("view-cards").addEventListener("click", function () { setView(false); });
  $("view-table").addEventListener("click", function () { setView(true); });
  document.addEventListener("change", function (e) {
    var slug = e.target.getAttribute && e.target.getAttribute("data-slug");
    if (!slug) { return; }
    var i = picked.indexOf(slug);
    if (e.target.checked && i < 0 && picked.length < MAX_PICK) { picked.push(slug); }
    if (!e.target.checked && i >= 0) { picked.splice(i, 1); }
    render();
  });
  document.addEventListener("click", function (e) {
    var key = e.target.getAttribute && e.target.getAttribute("data-sort");
    if (key) { $("sort").value = key; render(); }
  });

  fetch("data/companies.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) { throw new Error("HTTP " + r.status); }
    return r.json();
  }).then(function (data) {
    cards = data.companies;
    var sectors = cards.map(function (c) { return c.sector_label; }).filter(function (s, i, all) { return all.indexOf(s) === i; })
      .sort(function (a, b) { return a.localeCompare(b, undefined, { sensitivity: "base" }); });
    $("sector").insertAdjacentHTML("beforeend", sectors.map(function (s) { return '<option value="' + esc(s) + '">' + esc(s) + "</option>"; }).join(""));
    $("footer").textContent = data.disclaimer + " Built " + data.built + " from public filings and exchange data.";
    setView(stored("index-view") === "table");
  }).catch(function (err) {
    $("cards").innerHTML = '<div class="error">The company list could not be loaded (' + esc(err.message) + "). If you opened this file directly, serve the folder over HTTP instead.</div>";
  });
})();
