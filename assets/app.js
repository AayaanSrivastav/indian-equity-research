/* Company page (company.html?c=<slug>). Places precomputed values from data/<slug>/page.json and draws charts.
   It computes nothing in the model: every number shown was rendered by the Python engine. */
(function () {
  "use strict";
  var slug = new URLSearchParams(window.location.search).get("c") || "";
  var dataDir = "data/" + slug + "/";
  var compareLink = document.getElementById("compare-link");  // absent from a cached older page: never fatal
  if (slug && compareLink) { compareLink.href = "compare.html?c=" + encodeURIComponent(slug); }
  var page = null;
  var charts = [];
  var priceChart = null;
  var finMode = "annual";
  var rangeMode = "all";

  // ---------------------------------------------------------------- helpers
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
  function label(type) { return '<span class="label ' + esc(type) + '">' + esc(type) + "</span>"; }
  function table(head, rows) {
    var h = "<table><thead><tr>" + head.map(function (x) { return "<th>" + x + "</th>"; }).join("") + "</tr></thead><tbody>";
    return h + rows.join("") + "</tbody></table>";
  }

  // ---------------------------------------------------------------- theme
  function setTheme(t) {
    document.documentElement.setAttribute("data-theme", t);
    try { localStorage.setItem("theme", t); } catch (e) { /* storage unavailable: theme still applies */ }
    if (page) { drawCharts(true); }
  }
  $("theme").addEventListener("click", function () {
    var cur = document.documentElement.getAttribute("data-theme");
    if (!cur) { cur = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
    setTheme(cur === "dark" ? "light" : "dark");
  });
  if (window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", function () {
      if (page && !document.documentElement.getAttribute("data-theme")) { drawCharts(true); }
    });
  }

  // ---------------------------------------------------------------- header, story, metrics
  function renderHeader() {
    var h = page.header;
    document.title = h.name + " · Research Case";
    $("co-name").textContent = h.name;
    $("chart-title").textContent = "Price against the market and the " + h.sector_label + " sector";
    $("chips").innerHTML = ["NSE: " + h.nse, "BSE: " + h.bse, h.sector].map(function (c) {
      return '<span class="chip">' + esc(c) + "</span>";
    }).join("");
    $("price").textContent = h.price;
    $("change").innerHTML = '<span class="pill ' + (h.up ? "up" : "down") + '">' + (h.up ? "▲ " : "▼ ") +
      esc(h.change) + " (" + esc(h.change_pct) + ")</span>";
    $("asof").textContent = "As of " + h.as_of + " · " + h.source;
    $("hero-stats").innerHTML = [["Market cap", h.market_cap], ["52-week high", h.high_52w], ["52-week low", h.low_52w]]
      .map(function (s) {
        return '<div class="stat"><div class="k">' + esc(s[0]) + '</div><div class="v">' + esc(s[1]) + "</div>" +
          (s[2] ? '<div class="sub">' + esc(s[2]) + "</div>" : "") + "</div>";
      }).join("");
    $("disclaimer").textContent = page.disclaimer;
  }

  // flags: cautions (the headline depends on it) first, then notes; the section stays hidden when there are none
  function renderFlags() {
    var fl = page.flags || [], n = fl.filter(function (f) { return f.level === "caution"; }).length;
    $("flags").hidden = !fl.length;
    if (!fl.length) { return; }
    $("flags-count").textContent = n ? n + (n === 1 ? " caution" : " cautions") + " · " + (fl.length - n) + (fl.length - n === 1 ? " note" : " notes")
      : fl.length + (fl.length === 1 ? " note" : " notes");
    $("flag-list").innerHTML = fl.map(function (f) {
      return '<li class="flag ' + esc(f.level) + '"><div class="flag-h"><span class="flag-mark" aria-hidden="true">' +
        (f.level === "caution" ? "⚠" : "ℹ") + '</span><span class="flag-tag">' + (f.level === "caution" ? "Caution" : "Note") + "</span> " +
        esc(f.title) + "</div><p>" + esc(f.text) + "</p></li>";
    }).join("");
  }

  function renderStory() {
    $("story-badge").textContent = page.story.checks + " checks passed";
    $("story-lines").innerHTML = page.story.lines.map(function (l) {
      return '<div class="story-line"><h3>' + esc(l.title) + "</h3><div>" + l.claims.map(function (c) {
        return "<p>" + label(c.label) + esc(c.text) + "</p>";
      }).join("") + "</div></div>";
    }).join("");
  }

  function renderMetrics() {
    $("metric-grid").innerHTML = page.metrics.map(function (m, i) {
      return '<div class="metric" id="m' + i + '"><div class="k"><span>' + esc(m.label) + '</span><button class="info" type="button" aria-expanded="false" aria-controls="p' + i +
        '" aria-label="About ' + esc(m.label) + '">i</button></div><div class="v">' + esc(m.display) + '</div><div class="pop" id="p' + i + '" role="note">' +
        label(m.type) + esc(m.definition) + '<div class="muted" style="margin-top:6px">Source: ' + esc(m.source) + "</div></div></div>";
    }).join("");
    Array.prototype.forEach.call(document.querySelectorAll(".metric .info"), function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        var card = b.closest(".metric");
        var open = !card.classList.contains("open");
        Array.prototype.forEach.call(document.querySelectorAll(".metric.open"), function (x) {
          x.classList.remove("open"); x.querySelector(".info").setAttribute("aria-expanded", "false");
        });
        if (open) { card.classList.add("open"); b.setAttribute("aria-expanded", "true"); }
      });
    });
    document.addEventListener("click", function () {
      Array.prototype.forEach.call(document.querySelectorAll(".metric.open"), function (x) { x.classList.remove("open"); });
    });
  }

  // ---------------------------------------------------------------- financials
  function renderFinToggle() {
    $("fin-toggle").innerHTML = [["annual", "Annual"], ["quarterly", "Quarterly"]].map(function (o) {
      return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (finMode === o[0]) + '">' + o[1] + "</button>";
    }).join("");
    Array.prototype.forEach.call($("fin-toggle").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { finMode = b.getAttribute("data-v"); renderFinToggle(); renderFinTable(); drawCharts(); });
    });
  }

  function renderFinTable() {
    var t = page.financials[finMode];
    var group = null;
    var rows = [];
    // newest period first, back to the oldest on file (the charts keep time running left to right)
    var newestFirst = function (xs) { return xs.slice().reverse(); };
    t.rows.forEach(function (r) {
      if (r.group !== group) {
        group = r.group;
        // the heading spans the row, so its text is pinned on its own; otherwise it scrolls away with the figures
        rows.push('<tr class="group"><td colspan="' + (t.columns.length + 1) + '"><span class="pin">' + esc(group) + "</span></td></tr>");
      }
      rows.push("<tr><td>" + esc(r.label) + '<span class="unit">' + esc(r.unit) + "</span></td>" + newestFirst(r.cells).map(function (c) {
        var cls = "cell" + (c.status === "verified" ? " verified" : "") + (c.type === "CALCULATION" ? " calc" : "");
        var tip = c.type + " · " + c.status + " · " + c.source;
        return '<td class="' + cls + '" title="' + esc(tip) + '">' + esc(c.display) + "</td>";
      }).join("") + "</tr>");
    });
    $("fin-table").innerHTML = table(["₹ crore unless stated"].concat(newestFirst(t.columns).map(esc)), rows);
    $("rev-title").textContent = finMode === "annual" ? "Revenue by fiscal year (₹ crore)" : "Revenue by quarter (₹ crore)";
  }

  // ---------------------------------------------------------------- results
  function renderResults() {
    var r = page.results, h = page.header;
    $("score-block").hidden = !r.scorecard.length;
    if (r.scorecard.length) {
      $("results-lede").textContent = "The quarter against a simple trend forecast, then how the share moved on each results day after allowing for the market.";
      $("score-title").textContent = r.scorecard_title;
    }
    $("score-note").textContent = r.scorecard_label + " The band is the largest back-test error, not a probability.";
    $("score-table").innerHTML = table(["Target", "Actual", "M1 forecast", "M1 band", "M1 error", "Inside?", "M2 forecast", "M2 error", "Flat-baseline error", "Closest"],
      r.scorecard.map(function (s) {
        return "<tr><td>" + esc(s.target) + "</td><td>" + esc(s.actual) + "</td><td>" + esc(s.m1) + "</td><td>" + esc(s.m1_band) + "</td><td>" + esc(s.m1_error) +
          '</td><td class="' + (s.m1_inside ? "yes" : "no") + '">' + (s.m1_inside ? "Yes" : "No") + "</td><td>" + esc(s.m2) + "</td><td>" + esc(s.m2_error) +
          "</td><td>" + esc(s.b1_error) + "</td><td>" + esc(s.closest) + "</td></tr>";
      }));
    var head = ["Results", "Reaction session", esc(h.symbol), "NIFTY 50", esc(h.sector_index), "Beta", "Beyond the market", "z"];
    var rows = r.events.map(function (e) {
      return "<tr><td>" + esc(e.event) + "</td><td>" + esc(e.session) + "</td><td>" + esc(e.stock) + "</td><td>" + esc(e.n50) + "</td><td>" + esc(e.sector) +
        "</td><td>" + esc(e.beta) + "</td><td><b>" + esc(e.ar) + "</b></td><td>" + esc(e.z) + (e.large ? " · large" : "") + "</td></tr>";
    });
    $("event-table").innerHTML = table(head, rows);
    $("marker-table").innerHTML = table(head, rows);
  }

  // ---------------------------------------------------------------- valuation
  function renderRefused(v) {
    // the applicability gate said no: its reasons and the cash-flow history, never a model value (valuation.md section 8)
    $("valuation-refused").hidden = false;
    $("valuation-body").hidden = true;
    $("valuation-lede").textContent = "This site's discounted cash flow templates are run only where their conditions hold. For this company they do not, so there is no model value and no reading of what the price implies.";
    $("refused-text").innerHTML = label("CALCULATION") + "<b>Template " + esc(v.template) + "</b> does not apply: " + v.reasons.map(esc).join("; ") + ". " +
      (v.b_template ? "<b>Template " + esc(v.b_template) + "</b> does not apply: " + v.b_reasons.map(esc).join("; ") + ". " : esc(v.b_untried) + " ") + esc(v.note) +
      '<div class="small ink2" style="margin-top:6px">For reference, at ' + esc(v.price_display) + " (" + esc(v.as_of) + ") the shares traded at " + esc(v.pe) +
      " the last four quarters' profit to shareholders, and enterprise value was " + esc(v.ev_ebit) + " operating profit.</div>";
    $("fcff-table").innerHTML = table(v.fcff.map(function (x) { return esc(x.fy); }), ["<tr>" + v.fcff.map(function (x) {
      return '<td class="' + (x.negative ? "no" : "yes") + '">' + esc(x.display) + "</td>";
    }).join("") + "</tr>"]);
  }

  function renderValuation() {
    var v = page.valuation;
    if (v.applicable === false) { renderRefused(v); return; }
    var h = v.headline, tb = v.template_b;
    if (tb) {
      $("template-note").hidden = false;
      $("template-note").innerHTML = '<span class="badge">' + esc(tb.name) + '</span><p class="small ink2" style="margin:8px 0 0">' + label("CALCULATION") + esc(tb.why) + " " + esc(tb.test) + "</p>";
    }
    $("implied").innerHTML = '<div class="hero-num' + (h.beyond ? " beyond" : "") + '">' + esc(h.implied_growth) + '</div><div><b>a year of revenue growth for five years</b> is what the model needs to match ' +
      esc(h.price) + " (" + esc(h.as_of) + "), if the operating margin stays at its " + esc(h.last_fy) + " level of " + esc(h.margin) + ". " + label("CALCULATION") +
      '<div class="small ink2" style="margin-top:6px">For comparison: revenue grew ' + esc(h.history_growth) + " a year over " + esc(h.history_span) + ", and " + esc(h.last_year_growth) +
      " in " + esc(h.last_fy) + '. Held one at a time, the same price also fits:</div><div class="alt">' + h.alts.map(function (a) { return '<span class="badge">' + esc(a) + "</span>"; }).join("") + "</div>" +
      (v.rule_note ? '<div class="small ink2" style="margin-top:6px">' + label("ASSUMPTION") + esc(v.rule_note) + "</div>" : "") + "</div>";
    $("implied-table").innerHTML = table(["Operating margin from year 5", "Growth needed, years 1–5"], v.implied_grid.map(function (g) {
      return "<tr><td>" + esc(g.margin_display) + "</td><td>" + esc(g.growth_display) + "</td></tr>";
    }));

    // range strip: positions are layout only
    var vals = v.scenarios.map(function (s) { return s.value; }).concat([v.price_value]);
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals), pad = (hi - lo) * 0.12;
    lo -= pad; hi += pad;
    function pos(x) { return ((x - lo) / (hi - lo) * 100).toFixed(2) + "%"; }
    var bear = v.scenarios[0], bull = v.scenarios[v.scenarios.length - 1];
    var strip = '<div class="track"></div><div class="band" style="left:' + pos(bear.value) + ";width:calc(" + pos(bull.value) + " - " + pos(bear.value) + ')"></div>';
    v.scenarios.forEach(function (s) {
      strip += '<div class="pt' + (s.key === "base" ? " base" : "") + '" style="left:' + pos(s.value) + '" title="' + esc(s.name + ": " + s.display) + '"></div>' +
        '<div class="lbl" style="left:' + pos(s.value) + '"><b>' + esc(s.display) + "</b>" + esc(s.name) + "</div>";
    });
    strip += '<div class="priceline" style="left:' + pos(v.price_value) + '"></div><div class="pricetag" style="left:' + pos(v.price_value) + '">Price ' + esc(v.price_display) + "</div>";
    $("range-strip").innerHTML = strip;
    staggerLabels();

    $("scenarios").innerHTML = v.scenarios.map(function (s) {
      return '<div class="card scen"><h3>' + esc(s.name) + ' case</h3><div class="v">' + esc(s.display) + '<span class="small muted"> model value / share</span></div>' +
        '<div class="small ink2"><b>What has to happen:</b> ' + esc(s.what) + "</div><dl>" + s.assumptions.map(function (a) {
          return "<dt>" + esc(a[0]) + "</dt><dd>" + esc(a[1]) + "</dd>";
        }).join("") + "</dl></div>";
    }).join("");

    var w = v.wacc;
    function tile(val, sub) { return '<div class="t"><b>' + esc(val) + "</b><span>" + esc(sub) + "</span></div>"; }
    $("wacc-eq").innerHTML = tile(w.ke, "cost of equity") + "=" + tile("(" + w.rf + " − " + w.spread + ")", "G-sec average − India default spread") + "+" +
      tile(w.beta + " × " + w.erp, "beta × India equity risk premium") + "→" + tile(w.wacc, "WACC (equity " + w.we + ", " + w.debt_label + " " + w.wd + ")");
    $("wacc-note").innerHTML = label("CALCULATION") + "Risk-free rate: the average of " + esc(w.rf_n) + " month-end FBIL 10-year par yields (range " + esc(w.rf_min) + " to " + esc(w.rf_max) +
      "; the latest spot reading was " + esc(w.rf_spot) + "). India's default spread is removed so that country risk is not counted twice. " + label("ASSUMPTION") +
      "Equity risk premium and default spread: Damodaran's country risk premium data. " + label("CALCULATION") + "Beta: " + esc(w.beta_years) + " years of daily returns against the NIFTY 50.";

    if (tb) {  // the base case's enterprise value as capital in place plus economic profit (an identity, not a second model)
      $("ep-section").hidden = false;
      $("ep-eq").innerHTML = tile(tb.tiles[0][0], tb.tiles[0][1]) + "+" + tile(tb.tiles[1][0], tb.tiles[1][1]) + "+" + tile(tb.tiles[2][0], tb.tiles[2][1]) +
        "=" + tile(tb.tiles[3][0], tb.tiles[3][1]);
      $("ep-first").innerHTML = label("CALCULATION") + esc(tb.first_positive);
      $("ep-table").innerHTML = table(["Year", "Opening capital", "After-tax operating profit", "Capital charge", "Economic profit", "Free cash flow"], tb.rows.map(function (x) {
        return "<tr>" + x.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
      }));
    }

    var hm = v.heatmap;
    var ramp = ["#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef", "#5598e7", "#2a78d6", "#1c5cab"];
    var rows = hm.g.map(function (g, gi) {
      return "<tr><td>g " + esc(g) + "</td>" + hm.wacc.map(function (w_, wi) {
        var c = hm.cells[gi][wi];
        if (!c) { return '<td class="muted" title="Long-run growth above the risk-free rate is not allowed">·</td>'; }
        var base = gi === hm.base_g_index && wi === hm.base_wacc_index;
        return '<td class="' + (c.step >= 4 ? "dark" : "") + (base ? " base" : "") + '" style="background:' + ramp[c.step] + '" title="WACC ' + esc(w_) +
          ", long-run growth " + esc(g) + ": " + esc(c.display) + '">' + esc(c.display) + "</td>";
      }).join("") + "</tr>";
    });
    $("heat").innerHTML = '<table class="heat"><thead><tr><th>Long-run growth</th>' + hm.wacc.map(function (w_) { return "<th>WACC " + esc(w_) + "</th>"; }).join("") +
      "</tr></thead><tbody>" + rows.join("") + "</tbody></table>";

    $("tornado-table").innerHTML = table(["Assumption", "Low setting", "Value", "High setting", "Value"], v.tornado.map(function (t) {
      return "<tr><td>" + esc(t.driver) + "</td><td>" + esc(t.low_input) + "</td><td>" + esc(t.low_display) + "</td><td>" + esc(t.high_input) + "</td><td>" + esc(t.high_display) + "</td></tr>";
    }));
  }

  // range strip: when two scenario labels would touch (values close together, or a narrow screen), drop the later one
  // to a second row. Layout only.
  function staggerLabels() {
    var box = $("range-strip"), lbls = Array.prototype.slice.call(box.querySelectorAll(".lbl"));
    lbls.forEach(function (l) { l.classList.remove("low"); });
    var prev = null, low = false;
    lbls.forEach(function (l) {
      var r = l.getBoundingClientRect();
      if (prev && r.left < prev.right + 6 && !low) { l.classList.add("low"); low = true; }
      else { prev = r; low = false; }
    });
    box.classList.toggle("stagger-lbl", lbls.some(function (l) { return l.classList.contains("low"); }));
  }
  window.addEventListener("resize", function () { if (page && page.valuation.applicable !== false) { staggerLabels(); } });

  function renderSources() {
    var s = page.sources;
    $("kpis").innerHTML = [["Facts in use checked by a person", s.verification.in_use_verified + " of " + s.verification.in_use_total],
      ["Automatic reconciliation checks passed", s.verification.recon_pass],
      ["Story checks passed", s.story_checks], ["Documents and data files", String(s.documents.length)]].map(function (k) {
      return '<div class="stat"><div class="k">' + esc(k[0]) + '</div><div class="v">' + esc(k[1]) + "</div></div>";
    }).join("") + '<p class="small ink2" style="grid-column:1/-1;margin:0">' + esc(s.verification.note) + "</p>";
    $("doc-table").className = "table-wrap text";
    $("doc-table").innerHTML = table(["Document", "Kind", "Period", "Published by", "Date"], s.documents.map(function (d) {
      var title = d.url ? '<a href="' + esc(d.url) + '" rel="noopener" target="_blank">' + esc(d.title) + "</a>" : esc(d.title);
      return '<tr><td style="white-space:normal;min-width:260px">' + title + "</td><td>" + esc(d.kind) + '</td><td style="white-space:normal">' + esc(d.period) +
        "</td><td>" + esc(d.publisher) + "</td><td>" + esc(d.published || "") + "</td></tr>";
    }));
    $("limitations").innerHTML = page.limitations.map(function (l) { return "<li>" + esc(l) + "</li>"; }).join("");
    $("data-files").innerHTML = "Data files: " + page.files.map(function (f) {
      return '<a href="' + esc(dataDir + f.file) + '">' + esc(f.label) + "</a>";
    }).join(" · ") + ".";
    $("footer").textContent = page.disclaimer + " Built " + page.built + " from public filings and exchange data; numbers carry their sources on hover.";
  }

  // ---------------------------------------------------------------- charts
  // axis labels only (layout): the chart library picks tick positions in binary floating point, so trim the noise
  function pctTick(v) { return parseFloat(Number(v).toPrecision(6)) + "%"; }

  var still = false;  // a redraw for a theme change: no draw-in animation
  function baseOptions() {
    var ink2 = css("--ink-2"), grid = css("--grid");
    var o = {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: css("--card"), titleColor: css("--ink"), bodyColor: ink2, borderColor: css("--axis"), borderWidth: 1, padding: 10 } },
      scales: { x: { grid: { display: false }, ticks: { color: ink2 }, border: { color: css("--axis") } },
                y: { grid: { color: grid }, ticks: { color: ink2 }, border: { display: false } } }
    };
    // the library's own draw-in (default timing, eased out), only where scroll motion is on (assets/motion.js)
    if (still || !(window.Motion && window.Motion.on)) { o.animation = false; }
    return o;
  }

  // a section scrolling into view replays the draw-in of the charts inside it
  document.addEventListener("revealed", function (e) {
    charts.forEach(function (c) { if (e.target.contains(c.canvas)) { c.reset(); c.update(); } });
  });

  function drawCharts(noAnimation) {
    still = !!noAnimation;
    charts.forEach(function (c) { c.destroy(); });
    charts = [];
    if (window.Chart) {
      Chart.defaults.font.family = css("--font") || "system-ui";
      Chart.defaults.color = css("--ink-2");
      var fc = page.financials[finMode === "annual" ? "chart_annual" : "chart_quarterly"];
      var s1 = css("--s1");
      var o1 = baseOptions();
      o1.plugins.tooltip.callbacks = { label: function (ctx) { return "Revenue ₹" + fc.revenue_display[ctx.dataIndex] + " crore"; } };
      charts.push(new Chart($("rev-chart"), { type: "bar", data: { labels: fc.labels, datasets: [{ data: fc.revenue, backgroundColor: s1, borderRadius: 4, maxBarThickness: 36 }] }, options: o1 }));
      var o2 = baseOptions();
      o2.plugins.tooltip.callbacks = { label: function (ctx) { return "Operating margin " + fc.margin_display[ctx.dataIndex]; } };
      o2.scales.y.ticks.callback = pctTick;
      charts.push(new Chart($("margin-chart"), { type: "line", data: { labels: fc.labels, datasets: [{ data: fc.margin, borderColor: s1, backgroundColor: s1, borderWidth: 2, pointRadius: 4, tension: 0 }] }, options: o2 }));

      var ev = page.results.events;
      var o3 = baseOptions();
      o3.plugins.tooltip.callbacks = { label: function (ctx) { var e = ev[ctx.dataIndex]; return ["Beyond the market " + e.ar + " (z " + e.z + ")", page.header.symbol + " " + e.stock + ", NIFTY 50 " + e.n50]; } };
      o3.scales.y.ticks.callback = pctTick;
      charts.push(new Chart($("ar-chart"), { type: "bar", data: { labels: ev.map(function (e) { return e.event; }),
        datasets: [{ data: ev.map(function (e) { return e.ar_value; }), backgroundColor: ev.map(function (e) { return e.ar_value >= 0 ? css("--s1") : css("--neg"); }), borderRadius: 4, maxBarThickness: 48 }] }, options: o3 }));

      var v = page.valuation;
      if (v.applicable === false) { drawPriceChart(); return; }  // no model, so no implied-growth or driver charts
      var o4 = baseOptions();
      o4.plugins.tooltip.callbacks = { title: function (items) { return "Margin " + v.implied_grid[items[0].dataIndex].margin_display; },
        label: function (ctx) { return "Growth needed " + v.implied_grid[ctx.dataIndex].growth_display; } };
      o4.scales.y.ticks.callback = pctTick;
      charts.push(new Chart($("implied-chart"), { type: "line", data: { labels: v.implied_grid.map(function (g) { return g.margin_display; }),
        datasets: [{ data: v.implied_grid.map(function (g) { return g.growth; }), borderColor: s1, backgroundColor: s1, borderWidth: 2, pointRadius: 4, tension: 0 }] }, options: o4 }));

      var tor = v.tornado;
      var baseLine = { id: "baseLine", afterDatasetsDraw: function (chart) {
        var x = chart.scales.x.getPixelForValue(v.base_value), a = chart.chartArea, ctx = chart.ctx;
        ctx.save(); ctx.strokeStyle = css("--ink"); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke(); ctx.restore();
      } };
      var o5 = baseOptions();
      o5.indexAxis = "y";
      var lows = tor.map(function (t) { return Math.min(t.low, t.high); });
      var lo = Math.min.apply(null, lows) * 0.9, step = Math.pow(10, Math.floor(Math.log10(Math.max(lo, 1))));  // axis floor at the value's own scale
      var xmin = Math.max(0, Math.floor(lo / step) * step);
      o5.scales = { x: { min: xmin, grid: { color: css("--grid") }, ticks: { color: css("--ink-2"), callback: function (x) { return "₹" + Number(x).toLocaleString("en-IN"); } }, border: { display: false } },
                    y: { grid: { display: false }, ticks: { color: css("--ink-2") }, border: { color: css("--axis") } } };
      o5.plugins.tooltip.callbacks = { label: function (ctx) { var t = tor[ctx.dataIndex];
        return [t.low_input + " → " + t.low_display, t.high_input + " → " + t.high_display]; } };
      charts.push(new Chart($("tornado"), { type: "bar", data: { labels: tor.map(function (t) { return t.driver; }),
        datasets: [{ data: tor.map(function (t) { return [Math.min(t.low, t.high), Math.max(t.low, t.high)]; }), backgroundColor: css("--s1"), borderRadius: 4, borderSkipped: false, maxBarThickness: 22 }] },
        options: o5, plugins: [baseLine] }));

      var tb = v.template_b;
      if (tb) {  // Template B: economic profit beside free cash flow, by year (same unit, one axis)
        var o6 = baseOptions();
        o6.plugins.legend = { display: true, position: "bottom", labels: { color: css("--ink-2"), boxWidth: 12 } };
        o6.scales.y.ticks.callback = function (x) { return (x < 0 ? "−₹" : "₹") + Math.abs(x).toLocaleString("en-IN"); };
        o6.plugins.tooltip.callbacks = { label: function (ctx) {
          return ctx.datasetIndex === 0 ? "Economic profit " + tb.ep_display[ctx.dataIndex] : "Free cash flow " + tb.fcff_display[ctx.dataIndex]; } };
        charts.push(new Chart($("ep-chart"), { type: "bar", data: { labels: tb.labels, datasets: [
          { label: "Economic profit", data: tb.ep, backgroundColor: css("--s1"), borderRadius: 3, maxBarThickness: 22 },
          { label: "Free cash flow to the firm", data: tb.fcff, backgroundColor: css("--s2"), borderRadius: 3, maxBarThickness: 22 }] }, options: o6 }));
      }
    }
    drawPriceChart();
  }

  function drawPriceChart() {
    var box = $("price-chart");
    if (priceChart) { priceChart.remove(); priceChart = null; }
    if (!window.LightweightCharts) { return; }
    var order = page.prices.order, stock = order[0];  // the company first, then the NIFTY 50, then its sector index
    var colors = {};
    order.forEach(function (n, i) { colors[n] = css("--s" + (i + 1)); });
    priceChart = LightweightCharts.createChart(box, {
      autoSize: true,
      layout: { background: { type: "solid", color: css("--card") }, textColor: css("--ink-2"), fontFamily: css("--font") },
      grid: { vertLines: { visible: false }, horzLines: { color: css("--grid") } },
      rightPriceScale: { borderVisible: false }, timeScale: { borderColor: css("--axis"), rightOffset: 12 },
      // vertical line only: the values at the cursor are read out above the chart, never drawn over it
      crosshair: { mode: 0, vertLine: { color: css("--axis"), labelBackgroundColor: css("--ink-2") }, horzLine: { visible: false, labelVisible: false } },
      // zoom: pinch, the − / + buttons, or Ctrl / ⌘ + scroll (wired below); drag pans. A plain scroll wheel keeps
      // scrolling the page, so the chart never traps the reader.
      handleScroll: { mouseWheel: false, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: false },
      handleScale: { mouseWheel: false, pinch: true, axisPressedMouseMove: false, axisDoubleClickReset: true }
    });
    priceChart.timeScale().applyOptions({ fixLeftEdge: true });
    var series = {};
    order.slice(1).concat([stock]).forEach(function (name) {  // the company drawn last, on top
      // value tags only on the axis (names are in the legend): long name tags ran into the lines and each other
      series[name] = priceChart.addLineSeries({ color: colors[name], lineWidth: name === stock ? 3 : 2, priceLineVisible: false, lastValueVisible: true,
        crosshairMarkerRadius: name === stock ? 5 : 4, priceFormat: { type: "price", precision: 0, minMove: 1 } });
      series[name].setData(page.prices.series[name]);
    });
    var byTime = {};
    page.markers.forEach(function (m) { byTime[m.time] = m; });
    series[stock].setMarkers(page.markers.map(function (m) {
      return { time: m.time, position: "aboveBar", color: css("--ink"), shape: "circle", text: m.event };
    }));
    function lastValues() {
      return order.map(function (n) { var s = page.prices.series[n]; return s[s.length - 1].value.toFixed(2); });
    }
    $("price-legend").innerHTML = order.map(function (n, i) {
      return '<span><i class="sw" style="background:' + colors[n] + '"></i>' + esc(n) + ' <b class="tnum" data-i="' + i + '">' + lastValues()[i] + "</b></span>";
    }).join("") + '<span><i class="sw dot" style="background:' + css("--ink") + '"></i>Results day</span>';
    $("chart-lede").textContent = "Each line rebased to 100 on " + page.prices.base_display + ", to " + page.prices.end_display + ". Dots mark results days.";
    var tip = $("price-tip"), values = $("price-legend").querySelectorAll("b[data-i]");
    var idle = "Move across the chart to read each line on a date; the legend shows the latest close.";
    tip.textContent = idle;
    priceChart.subscribeCrosshairMove(function (p) {
      if (!p.time || !p.point || p.point.x < 0) {  // pointer left the chart: back to the latest values
        lastValues().forEach(function (v, i) { values[i].textContent = v; });
        tip.textContent = idle;
        return;
      }
      order.forEach(function (n, i) { var d = p.seriesData.get(series[n]); values[i].textContent = d ? d.value.toFixed(2) : "—"; });
      var m = byTime[p.time];
      var when = new Date(p.time + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
      tip.innerHTML = '<span class="when">' + esc(when) + "</span>" + (m ? '<span class="ev"><b>' + esc(m.event) + " results reaction:</b> " + esc(stock) + " " + esc(m.stock) +
        " · beyond the market " + esc(m.ar) + " (z " + esc(m.z) + ")</span>" : "");
    });
    applyRange();
  }

  function renderRangeToggle() {
    var opts = [["6m", "6M"], ["1y", "1Y"], ["all", "All"]];
    $("range").innerHTML = opts.map(function (o) {
      return '<button type="button" data-v="' + o[0] + '" aria-pressed="' + (rangeMode === o[0]) + '">' + o[1] + "</button>";
    }).join("");
    Array.prototype.forEach.call($("range").querySelectorAll("button"), function (b) {
      b.addEventListener("click", function () { rangeMode = b.getAttribute("data-v"); renderRangeToggle(); applyRange(); });
    });
  }

  function applyRange() {
    if (!priceChart) { return; }
    var s = page.prices.series[page.prices.order[0]];
    var last = s[s.length - 1].time;
    if (rangeMode === "all") {
      // leave room on the right so the newest marker's label is not clipped
      priceChart.timeScale().setVisibleLogicalRange({ from: 0, to: s.length - 1 + Math.round(s.length * 0.04) });
      return;
    }
    var d = new Date(last + "T00:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - (rangeMode === "6m" ? 6 : 12));
    priceChart.timeScale().setVisibleRange({ from: d.toISOString().slice(0, 10), to: last });
  }

  // ---------------------------------------------------------------- chart magnifier (layout only: no value changes)
  // Price chart zoom: the visible window narrows ("in") or widens ("out") around its centre, or around the pointer.
  function priceWindow(factor, anchor) {
    var ts = priceChart.timeScale(), r = ts.getVisibleLogicalRange();
    if (!r) { return null; }
    var n = page.prices.series[page.prices.order[0]].length, edge = n - 1 + Math.round(n * 0.04);
    var at = anchor === undefined ? (r.from + r.to) / 2 : anchor;
    var from = at - (at - r.from) * factor, to = at + (r.to - at) * factor;
    if (to - from < 10) { return null; }                     // at least ten sessions stay in view
    if (to - from > edge) { from = 0; to = edge; }            // never wider than the whole history
    if (from < 0) { to -= from; from = 0; }
    if (to > edge) { from -= to - edge; to = edge; }
    return { from: Math.max(0, from), to: to };
  }
  function easeWindow(target) {
    var ts = priceChart.timeScale(), start = ts.getVisibleLogicalRange(), ms = parseFloat(css("--zoom-time")) || 0;
    if (!start || !ms || !(window.Motion && window.Motion.on)) { ts.setVisibleLogicalRange(target); return; }
    var t0 = performance.now();
    (function step(now) {
      var k = Math.min(1, (now - t0) / ms), e = 1 - Math.pow(1 - k, 3);  // ease out: quick start, gentle landing
      ts.setVisibleLogicalRange({ from: start.from + (target.from - start.from) * e, to: start.to + (target.to - start.to) * e });
      if (k < 1) { requestAnimationFrame(step); }
    })(t0);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest && e.target.closest("[data-zoom]");
    if (!b || !priceChart) { return; }
    var how = b.getAttribute("data-zoom");
    if (how === "fit") { applyRange(); return; }
    var w = priceWindow(how === "in" ? 0.5 : 2);
    if (w) { easeWindow(w); }
  });
  $("price-chart").addEventListener("wheel", function (e) {
    // Ctrl / ⌘ + scroll, or a trackpad pinch (which arrives as Ctrl + scroll); inside the enlarged view any scroll zooms
    if (!priceChart || !(e.ctrlKey || e.metaKey || $("price-chart").closest("dialog"))) { return; }
    e.preventDefault();
    var anchor = priceChart.timeScale().coordinateToLogical(e.offsetX);
    var w = priceWindow(Math.exp(e.deltaY * 0.004), anchor === null ? undefined : anchor);
    if (w) { priceChart.timeScale().setVisibleLogicalRange(w); }
  }, { passive: false });

  // Enlarge: the chart itself moves into a dialog (same chart, larger), and moves back when it closes.
  var enlarged = null;
  function chartTitle(box) {
    if (box.id === "price-chart") { return $("chart-title").textContent; }
    var c = box.querySelector("canvas");
    return c ? c.getAttribute("aria-label") : "Chart";
  }
  function enlarge(box) {
    var ph = document.createElement("div");
    ph.className = "chart-ph";
    ph.style.height = box.offsetHeight + "px";
    box.parentNode.insertBefore(ph, box);
    $("zoom-body").appendChild(box);
    $("zoom-title").textContent = chartTitle(box);
    $("zoom-steps").hidden = box.id !== "price-chart";
    $("zoom-hint").textContent = box.id === "price-chart"
      ? "Scroll or pinch to zoom, drag to move along the timeline. Press Esc or click outside to return the chart to the page."
      : "Press Esc or click outside to return the chart to the page.";
    enlarged = { box: box, ph: ph };
    $("zoom").showModal();
  }
  function shut() {
    var d = $("zoom"), done = false;
    function finish() { if (done) { return; } done = true; d.classList.remove("closing"); d.close(); }
    if (!(window.Motion && window.Motion.on)) { finish(); return; }
    d.classList.add("closing");
    d.addEventListener("animationend", finish, { once: true });
    window.setTimeout(finish, (parseFloat(css("--close-time")) || 0) + 60);  // if no frame is painted, close anyway
  }
  var dialog = $("zoom");  // absent from a cached older page: the charts then simply have no magnifier
  if (dialog) {
    dialog.addEventListener("close", function () {
      if (!enlarged) { return; }
      enlarged.ph.parentNode.replaceChild(enlarged.box, enlarged.ph);
      enlarged = null;
    });
    dialog.addEventListener("cancel", function (e) { e.preventDefault(); shut(); });  // Esc: the same closing motion
    dialog.addEventListener("click", function (e) {  // a click on the backdrop, outside the dialog's box
      var r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) { shut(); }
    });
    $("zoom-close").addEventListener("click", shut);
  }
  function wireMagnifiers() {
    if (!dialog) { return; }
    Array.prototype.forEach.call(document.querySelectorAll(".chart-box"), function (box) {
      if (box.getAttribute("data-mag")) { return; }
      box.setAttribute("data-mag", "1");
      var b = document.createElement("button");
      b.type = "button";
      b.className = "mag";
      b.textContent = "Enlarge";
      b.setAttribute("aria-label", "Enlarge: " + chartTitle(box));
      b.addEventListener("click", function () { enlarge(box); });
      if (box.id === "price-chart") { $("price-tools").appendChild(b); return; }
      var row = document.createElement("div");
      row.className = "chart-tools";
      row.appendChild(b);
      box.parentNode.insertBefore(row, box);
    });
  }

  // ---------------------------------------------------------------- nav and reveal
  function wireNav() {
    var links = Array.prototype.slice.call(document.querySelectorAll(".nav a"));
    var sections = links.map(function (a) { return document.querySelector(a.getAttribute("href")); });
    if (!("IntersectionObserver" in window)) { sections.forEach(function (s) { s.classList.add("in"); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          links.forEach(function (a) { a.classList.toggle("active", a.getAttribute("href") === "#" + e.target.id); });
        }
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach(function (s) { io.observe(s); });
    if (window.Motion) { window.Motion.scan(); }  // number the rendered cards and lines, watch the sections (motion.js)
  }

  // ---------------------------------------------------------------- boot
  if (!/^[a-z0-9-]+$/.test(slug)) {
    $("story-lines").innerHTML = '<div class="error">No company chosen. Pick one from the <a href="index.html">company list</a>.</div>';
    Array.prototype.forEach.call(document.querySelectorAll(".section"), function (s) { s.classList.add("in"); });
    return;
  }
  fetch(dataDir + "page.json", { cache: "no-cache" }).then(function (r) {
    if (!r.ok) { throw new Error("no page for '" + slug + "' (HTTP " + r.status + ")"); }
    return r.json();
  }).then(function (data) {
    page = data;
    renderHeader(); renderFlags(); renderStory(); renderMetrics(); renderFinToggle(); renderFinTable(); renderResults(); renderValuation(); renderSources();
    renderRangeToggle(); drawCharts(); wireMagnifiers(); wireNav();
  }).catch(function (err) {
    $("story-lines").innerHTML = '<div class="error">The page data could not be loaded (' + esc(err.message) + "). If you opened this file directly, serve the folder over HTTP instead.</div>";
    Array.prototype.forEach.call(document.querySelectorAll(".section"), function (s) { s.classList.add("in"); });
  });
})();
