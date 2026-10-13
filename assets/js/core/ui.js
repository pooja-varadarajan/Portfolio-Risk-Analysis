/* Shared UI: header/nav, theme, footer, number formatting, chart helpers and the page boot sequence. */
window.PRD = window.PRD || {};

(function () {
  /* ---------- theme ---------- */
  const THEME_KEY = 'prd_theme';
  function getTheme() { try { return localStorage.getItem(THEME_KEY) || 'dark'; } catch (e) { return 'dark'; } }
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); }
  applyTheme(getTheme());

  /* ---------- formatting ---------- */
  const inrFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
  const F = {
    inr: x => (isFinite(x) ? (x < 0 ? '-₹' : '₹') + inrFmt.format(Math.abs(Math.round(x))) : '—'),
    inrShort(x) {
      if (!isFinite(x)) return '—';
      const a = Math.abs(x), s = x < 0 ? '-₹' : '₹';
      if (a >= 1e7) return s + (a / 1e7).toFixed(2) + ' Cr';
      if (a >= 1e5) return s + (a / 1e5).toFixed(2) + ' L';
      return s + inrFmt.format(Math.round(a));
    },
    pct: (x, d = 2) => { if (!isFinite(x)) return '—'; const v = Number((x * 100).toFixed(d)); return (v === 0 ? (0).toFixed(d) : v.toFixed(d)) + '%'; },
    spct: (x, d = 2) => { if (!isFinite(x)) return '—'; const v = Number((x * 100).toFixed(d)); return (v > 0 ? '+' : '') + (v === 0 ? (0).toFixed(d) : v.toFixed(d)) + '%'; },
    num: (x, d = 4) => (isFinite(x) ? Number(x).toFixed(d) : '—'),
    date(iso) {
      if (!iso) return '—';
      const [y, m, d] = iso.split('-').map(Number);
      return `${d} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${y}`;
    },
    conf: c => (Math.abs(c * 1000 - Math.round(c * 100) * 10) < 1e-6 ? (c * 100).toFixed(0) : (c * 100).toFixed(1)) + '%',
    sign: x => (x > 0 ? 'pos' : x < 0 ? 'neg' : ''),
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
  };
  PRD.F = F;
  PRD.$ = (sel, root) => (root || document).querySelector(sel);
  PRD.$$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  /* ---------- chrome ---------- */
  const PAGES = [
    { href: 'index.html', label: 'Overview', id: 'overview' },
    { href: 'stocks.html', label: 'Stock Selection', id: 'stocks' },
    { href: 'portfolio-a.html', label: 'Portfolio A', id: 'pa', dot: 'var(--pa)' },
    { href: 'portfolio-b.html', label: 'Portfolio B', id: 'pb', dot: 'var(--pb)' },
    { href: 'data.html', label: 'Data', id: 'data' },
    { href: 'methodology.html', label: 'Methodology', id: 'method' }
  ];
  const ICON = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
    logo: '<svg viewBox="0 0 24 24" fill="none" stroke="#11140a" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 17l5-6 4 3 5-7 4 4"/></svg>',
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M7 10l5 5 5-5M5 21h14"/></svg>'
  };
  PRD.ICON = ICON;

  function renderChrome(pageId) {
    const header = document.createElement('header');
    header.className = 'topbar';
    header.innerHTML = `<div class="topbar-inner">
      <a class="brand" href="index.html"><span class="brand-mark">${ICON.logo}</span><span>Portfolio Risk Lab<small>NIFTY 50 · VaR · ES · Markowitz</small></span></a>
      <nav class="nav" aria-label="Main">${PAGES.map(p => `<a href="${p.href}" class="${p.id === pageId ? 'active' : ''}">${p.dot ? `<span class="dot" style="background:${p.dot}"></span>` : ''}${p.label}</a>`).join('')}</nav>
      <button class="icon-btn" id="theme-toggle" type="button" aria-label="Toggle light or dark theme"></button>
    </div>`;
    document.body.prepend(header);
    const btn = header.querySelector('#theme-toggle');
    const paint = () => { btn.innerHTML = getTheme() === 'dark' ? ICON.sun : ICON.moon; };
    paint();
    btn.addEventListener('click', () => {
      const t = getTheme() === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem(THEME_KEY, t); } catch (e) { /* ignore */ }
      applyTheme(t); paint();
      if (PRD._rerender) PRD._rerender();
    });

    const footer = document.createElement('footer');
    footer.className = 'site';
    footer.innerHTML = `Prices: ${F.esc(PRD.SOURCES.prices.label)}. Closing prices are <b>not adjusted for dividends</b>, so returns are price returns only.
      Sector, index-weight and market-cap figures are external and cited with dates on the <a href="stocks.html">Stock Selection</a> and <a href="data.html">Data</a> pages. Not investment advice.`;
    document.body.appendChild(footer);
  }

  /* ---------- charts ---------- */
  const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  PRD.color = css;
  const charts = {};
  PRD.chart = function (canvasId, config) {
    if (charts[canvasId]) charts[canvasId].destroy();
    const el = document.getElementById(canvasId);
    if (!el) return null;
    charts[canvasId] = new Chart(el, config);
    return charts[canvasId];
  };
  PRD.chartDefaults = function () {
    const C = window.Chart;
    C.defaults.font.family = getComputedStyle(document.body).fontFamily;
    C.defaults.font.size = 12;
    C.defaults.color = css('--text-3');
    C.defaults.borderColor = css('--grid');
    C.defaults.maintainAspectRatio = false;
    C.defaults.animation = false; // draw immediately (no animation frames needed), so charts render in every viewer
    C.defaults.plugins.legend.display = false;
    const tt = C.defaults.plugins.tooltip;
    tt.backgroundColor = css('--surface-3');
    tt.titleColor = css('--text');
    tt.bodyColor = css('--text-2');
    tt.borderColor = css('--border-strong');
    tt.borderWidth = 1;
    tt.padding = 10;
    tt.cornerRadius = 10;
    tt.boxPadding = 4;
    tt.usePointStyle = true;
    C.defaults.elements.line.borderWidth = 2;
    C.defaults.elements.point.radius = 0;
    C.defaults.elements.point.hoverRadius = 5;
    C.defaults.elements.bar.borderRadius = 4;
    C.defaults.scale.grid.color = css('--grid');
    C.defaults.scale.border = { display: false };
    C.defaults.scale.ticks.color = css('--text-3');
  };
  PRD.alpha = function (hex, a) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  };
  // Value labels at the end of each bar (horizontal or vertical bar charts)
  // Draw text labels next to scatter points, trying right, left, above and below each point and
  // skipping a label only when every position would overlap another label or a point (tooltip still shows it).
  PRD.pointLabels = function (chart, els, texts, gap) {
    const ctx = chart.ctx, a = chart.chartArea, placed = [], r = 6;
    const hit = (b, c) => b.x < c.x + c.w && c.x < b.x + b.w && b.y < c.y + c.h && c.y < b.y + b.h;
    const dots = els.map(p => ({ x: p.x - r, y: p.y - r, w: 2 * r, h: 2 * r }));
    ctx.save(); ctx.font = '11px ' + getComputedStyle(document.body).fontFamily; ctx.textBaseline = 'middle';
    els.forEach((p, i) => {
      const w = ctx.measureText(texts[i]).width, h = 13;
      const opts = [[p.x + gap, p.y - h / 2], [p.x - gap - w, p.y - h / 2], [p.x - w / 2, p.y - gap - h], [p.x - w / 2, p.y + gap],
        [p.x + gap - 2, p.y - gap - h + 4], [p.x + gap - 2, p.y + gap - 4], [p.x - gap - w + 2, p.y - gap - h + 4], [p.x - gap - w + 2, p.y + gap - 4]];
      for (const [x, y] of opts) {
        const b = { x, y, w, h };
        if (x < a.left - 2 || x + w > chart.width - 2 || y < 0 || y + h > a.bottom + 2) continue;
        if (placed.some(c => hit(b, c)) || dots.some((d, j) => j !== i && hit(b, d))) continue;
        placed.push(b); ctx.fillText(texts[i], x, y + h / 2); break;
      }
    });
    ctx.restore();
  };

  PRD.barLabels = function (fmt) {
    return {
      id: 'barLabels',
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx, horiz = chart.options.indexAxis === 'y';
        ctx.save();
        ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillStyle = css('--text-2');
        chart.data.datasets.forEach((d, di) => {
          const meta = chart.getDatasetMeta(di); if (meta.hidden) return;
          meta.data.forEach((bar, i) => {
            const v = d.data[i]; if (v == null || !isFinite(v)) return;
            const t = fmt(v);
            if (horiz) { ctx.textAlign = 'left'; ctx.textBaseline = 'middle'; ctx.fillText(t, Math.max(bar.x, bar.base) + 6, bar.y); }
            else { ctx.textAlign = 'center'; ctx.textBaseline = v >= 0 ? 'bottom' : 'top'; ctx.fillText(t, bar.x, v >= 0 ? bar.y - 4 : bar.y + 4); }
          });
        });
        ctx.restore();
      }
    };
  };
  // Vertical crosshair for line charts
  PRD.crosshair = {
    id: 'crosshair',
    afterDatasetsDraw(chart) {
      const a = chart.tooltip && chart.tooltip.getActiveElements && chart.tooltip.getActiveElements();
      if (!a || !a.length) return;
      const x = a[0].element.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
      ctx.save(); ctx.strokeStyle = css('--border-strong'); ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, bottom); ctx.stroke(); ctx.restore();
    }
  };

  /* ---------- boot ---------- */
  PRD.boot = async function (pageId, render) {
    renderChrome(pageId);
    const root = document.getElementById('app');
    root.innerHTML = '<div class="loading"><div class="spinner"></div><div>Loading the price dataset…</div></div>';
    let ds;
    try {
      ds = await PRD.loadDataset();
    } catch (e) {
      const fileProto = location.protocol === 'file:';
      root.innerHTML = `<div class="card" style="max-width:720px;margin:40px auto">
        <h2>The dataset could not be loaded</h2>
        <p class="text-2" style="margin-top:8px">${fileProto
          ? 'Browsers block pages opened directly from disk (file://) from reading the bundled Excel file. Start a local web server in the project folder (for example <code>python3 -m http.server 8000</code>) and open <code>http://localhost:8000</code>, or load the Excel file manually below.'
          : 'Error: ' + F.esc(e.message)}</p>
        <label class="field" style="margin-top:14px">Load the Excel file (.xlsx) manually
          <input class="input" type="file" id="boot-upload" accept=".xlsx,.xls"></label>
        <div id="boot-msg"></div></div>`;
      document.getElementById('boot-upload').addEventListener('change', async ev => {
        const f = ev.target.files[0]; if (!f) return;
        const res = await PRD.validateUpload(f);
        const msg = document.getElementById('boot-msg');
        if (!res.ok) { msg.innerHTML = `<div class="alert error">${res.errors.map(F.esc).join('<br>')}</div>`; return; }
        PRD.useUploadedDataset(res.dataset, res.warnings);
        location.reload();
      });
      return;
    }
    PRD.ds = ds;
    PRD.chartDefaults();
    const run = () => { PRD.chartDefaults(); render(ds, root); };
    PRD._rerender = run;
    try { run(); } catch (e) {
      console.error(e);
      root.innerHTML = `<div class="alert error">Something went wrong while calculating: ${F.esc(e.message)}</div>`;
    }
  };

  /* Debounce helper for inputs that trigger recalculation */
  PRD.debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms || 200); }; };

  /* Common banner showing which data and benchmark are in use */
  PRD.dataBanner = function (ds) {
    const up = ds.source === 'uploaded';
    return `<div class="source-line">Data: ${up ? `uploaded file <b>${F.esc(ds.fileName)}</b>` : 'bundled Excel dataset'} · ${ds.tickers.length} stocks · ${F.date(ds.first)} to ${F.date(ds.last)} · ${ds.dates.length.toLocaleString('en-IN')} trading days · unadjusted closing prices · beta benchmark: ${F.esc(ds.benchmark.label)}</div>`;
  };
})();
