/* Data page: full dataset table, download, dataset facts, uploads (dataset + NIFTY 50 benchmark). */
(function () {
  const { F, $, $$ } = PRD;
  let ds, wb = null, sheets = [], active = 0, query = '', colQuery = '';

  PRD.boot('data', async (data, root) => {
    ds = data;
    if (!wb) { try { wb = await PRD.loadWorkbook(); } catch (e) { wb = null; } }
    buildSheets();
    root.innerHTML = skeleton();
    bind();
    renderTabs(); renderTable();
  });

  function buildSheets() {
    sheets = [];
    if (ds.source === 'uploaded') {
      sheets.push({ name: `Active dataset (uploaded: ${ds.fileName})`, header: ['Date'].concat(ds.tickers), rows: ds.dates.map((d, i) => [d].concat(ds.prices[i])), kind: 'prices' });
    }
    if (wb && ds.source !== 'uploaded') {
      for (const name of wb.SheetNames.filter(n => n === ds.sheetName)) {
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: false });
        if (!rows.length) continue;
        const isPrice = /date/i.test(String(rows[0][0] || ''));
        sheets.push({
          name: 'Closing prices (₹)',
          header: isPrice ? rows[0].map(h => (h == null ? '' : String(h))) : ['Note', 'Detail'],
          rows: isPrice ? rows.slice(1).map(r => [PRD._internal.toISODate(r[0]) || String(r[0])].concat(r.slice(1))) : rows,
          kind: isPrice ? 'prices' : 'notes'
        });
      }
    }
  }

  function skeleton() {
    const S = PRD.SOURCES;
    const uploaded = ds.source === 'uploaded';
    return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Source of truth</div>
        <h1>The dataset</h1>
        <p>Daily NSE closing prices for 21 NIFTY 50 companies, exactly as provided in the Excel file. Nothing on this page is recalculated or rounded: values are shown as stored.</p>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="${PRD.BUNDLED_FILE}" download>${PRD.ICON.download} Download stock prices (.xlsx)</a>
        ${ds.benchmark.kind === 'nifty' && ds.benchmark.source === 'bundled' ? `<a class="btn" href="data/${encodeURI(ds.benchmark.fileName)}" download>${PRD.ICON.download} Download NIFTY 50 data (.xlsx)</a>` : ''}
        ${uploaded ? `<button class="btn" id="dl-active">${PRD.ICON.download} Download active dataset</button>` : ''}
      </div>
    </div>
    ${uploaded ? `<div class="alert warn">You are viewing an <b>uploaded</b> dataset (${F.esc(ds.fileName)}). All pages use it until you reset below. The Download Excel button always returns the original bundled file.</div>` : ''}

    <div class="kpis">
      ${kpi('Date range', `${F.date(ds.first)} – ${F.date(ds.last)}`, 'first and last trading day')}
      ${kpi('Trading days', ds.dates.length.toLocaleString('en-IN'), 'rows with prices')}
      ${kpi('Companies', ds.tickers.length, 'price columns analysed')}
      ${kpi('Observations', (ds.dates.length * ds.tickers.length).toLocaleString('en-IN'), 'price cells (days × companies)')}
      ${kpi('Daily returns', (ds.dates.length - 1).toLocaleString('en-IN'), 'per company')}
      ${kpi('Missing prices', ds.missing || 0, ds.missing ? 'handled as described below' : 'no blank cells')}
    </div>

      <div class="card" style="margin-top:18px">
        <h2>Companies and sectors</h2>
        <div class="table-wrap" style="margin-top:10px;max-height:420px"><table class="t">
          <thead><tr><th>Ticker</th><th>Company</th><th>Sector</th></tr></thead>
          <tbody>${ds.tickers.map(t => { const c = PRD.company(t); return `<tr><td><b>${F.esc(t)}</b></td><td>${F.esc(c.name)}</td><td>${c.sector ? F.esc(c.sector) : '<span class="muted">Unavailable</span>'}</td></tr>`; }).join('')}</tbody></table></div>
        <div class="source-line">Sector: ${F.esc(S.sector.label)} (as of ${F.esc(S.sector.asOf)}, accessed ${S.sector.accessed}). <a href="${S.sector.url}" target="_blank" rel="noopener">Source</a>. Market cap and index weights are on the <a href="stocks.html">Stock Selection</a> page.</div>
      </div>
    <div class="card" style="margin-top:18px">
      <div class="card-head" style="align-items:center">
        <div><h2>Closing prices</h2><div class="seg hidden" id="tabs"></div></div>
        <div class="row">
          <input class="input" id="q" placeholder="Search dates, e.g. 2020-03 or 2024" style="width:240px" aria-label="Search rows">
          <input class="input" id="cq" placeholder="Filter companies, e.g. bank, ONGC" style="width:240px" aria-label="Filter company columns">
        </div>
      </div>
      <div class="source-line" id="count" style="margin:-6px 0 10px"></div>
      <div class="table-wrap" style="max-height:620px"><table class="t sticky-first" id="tbl"></table></div>
    </div>

      <div class="card" style="margin-top:18px">
        <h2>About the prices</h2>
        <ul class="text-2" style="padding-left:18px;margin:10px 0 0">
          <li><b>Source:</b> ${F.esc(S.prices.label)}.</li>
          <li><b>Price type:</b> unadjusted daily closing prices in rupees. Adjusted prices are not available in the file, so returns are <b>price returns</b> and do not include dividends. Stocks with splits, bonuses, demergers or rights issues since 2020 were excluded by the dataset's author so that unadjusted prices remain comparable over time.</li>
          <li><b>Non-trading dates:</b> only NSE trading days are present. Two Saturday rows are NSE special sessions (Union Budget days) and are kept as given.</li>
          <li><b>Missing values:</b> the bundled file has none. If an uploaded file has blanks, returns that need a missing price are excluded, and portfolio calculations drop any day on which a selected stock has no return (so μ, Σ and the weights always use the same days).</li>
        </ul>
        ${ds.warnings && ds.warnings.length ? `<details class="method"><summary>Validation notes (${ds.warnings.length})</summary><div class="body"><ul style="padding-left:18px;margin:0">${ds.warnings.map(w => `<li>${F.esc(w)}</li>`).join('')}</ul></div></details>` : ''}
      </div>
    <div class="section-title" id="upload"><span class="n">↑</span><h2>Use a different Excel file</h2></div>
    <div class="grid g-2">
      <div class="card">
        <h3>Upload a price dataset</h3>
        <p class="text-2" style="margin-top:6px">Must contain a <b>Date</b> column followed by exactly <b>21</b> company price columns (one header per company). The structure is checked before anything is replaced; the original file is never modified.</p>
        <input class="input" type="file" id="up" accept=".xlsx,.xls">
        <div id="up-msg"></div>
        ${uploaded ? '<button class="btn sm" id="reset-ds" style="margin-top:10px">Go back to the bundled dataset</button>' : ''}
      </div>
      <div class="card" id="benchmark">
        <h3>NIFTY 50 benchmark (for beta)</h3>
        <p class="text-2" style="margin-top:6px">Currently: <b>${F.esc(ds.benchmark.label)}</b>${ds.benchmark.kind === 'nifty' ? ` from ${F.esc(ds.benchmark.fileName)} (${ds.benchmark.matched} matching days)` : ''}.
        ${ds.benchmark.kind === 'nifty' ? 'To use a different index file, upload' : 'To measure beta against the real index, upload'} NIFTY 50 daily history as CSV or Excel with <b>Date</b> and <b>Close</b> columns (for example NSE's "Historical Index Data" download, 1 Jan 2020 onward). Or add the file to the project's <code>data/</code> folder and name it in <code>data/manifest.json</code> so every visitor gets it.</p>
        <input class="input" type="file" id="bench" accept=".csv,.xlsx,.xls,.txt">
        <div id="bench-msg"></div>
        ${ds.benchmark.kind === 'nifty' && ds.benchmark.source === 'uploaded' ? '<button class="btn sm" id="clear-bench" style="margin-top:10px">Remove uploaded benchmark</button>' : ''}
      </div>
    </div>`;
  }
  const kpi = (l, v, s) => `<div class="kpi"><div class="l">${l}</div><div class="v" style="font-size:18px;white-space:normal">${v}</div><div class="s">${s}</div></div>`;

  function bind() {
    $('#q').addEventListener('input', PRD.debounce(() => { query = $('#q').value.trim().toLowerCase(); renderTable(); }, 150));
    $('#cq').addEventListener('input', PRD.debounce(() => { colQuery = $('#cq').value.trim().toLowerCase(); renderTable(); }, 150));
    const dl = $('#dl-active');
    if (dl) dl.addEventListener('click', () => {
      const aoa = [['Date'].concat(ds.tickers)].concat(ds.dates.map((d, i) => [d].concat(ds.prices[i])));
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet(aoa), 'Close Prices');
      XLSX.writeFile(book, ds.fileName.replace(/\.[^.]+$/, '') + '_active.xlsx');
    });
    $('#up').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      const msg = $('#up-msg');
      msg.innerHTML = '<div class="alert">Checking the file…</div>';
      const res = await PRD.validateUpload(f);
      if (!res.ok) { msg.innerHTML = `<div class="alert error"><b>Not loaded.</b><br>${res.errors.map(F.esc).join('<br>')}</div>`; return; }
      const d = res.dataset;
      msg.innerHTML = `<div class="alert ok"><b>Structure valid:</b> sheet "${F.esc(d.sheetName)}", ${d.tickers.length} companies, ${d.dates.length} dated rows (${F.date(d.dates[0])} to ${F.date(d.dates[d.dates.length - 1])}).
        ${res.warnings.length ? '<ul style="padding-left:18px;margin:6px 0">' + res.warnings.map(w => `<li>${F.esc(w)}</li>`).join('') + '</ul>' : ''}
        <button class="btn sm primary" id="use-up" style="margin-top:8px">Use this dataset on every page</button></div>`;
      $('#use-up').addEventListener('click', () => {
        if (!PRD.useUploadedDataset(d, res.warnings)) { msg.innerHTML += '<div class="alert error">The browser refused to store the file (storage full or blocked). It will only apply in this tab.</div>'; }
        PRD.state.update(s => { s.members = null; s.mode = { A: 'optimised', B: 'optimised' }; s.custom = { A: null, B: null }; s.est = { start: null, end: null }; s.recent = { start: null, end: null }; });
        location.reload();
      });
    });
    const rs = $('#reset-ds');
    if (rs) rs.addEventListener('click', () => { PRD.resetDataset(); PRD.state.update(s => { s.members = null; s.mode = { A: 'optimised', B: 'optimised' }; s.custom = { A: null, B: null }; s.est = { start: null, end: null }; }); location.reload(); });
    $('#bench').addEventListener('change', async ev => {
      const f = ev.target.files[0]; if (!f) return;
      const res = await PRD.parseBenchmarkFile(f);
      const msg = $('#bench-msg');
      if (!res.ok) { msg.innerHTML = `<div class="alert error">${F.esc(res.error)}</div>`; return; }
      const days = Object.keys(res.levels).sort();
      let matched = 0;
      for (let t = 1; t < ds.dates.length; t++) if (res.levels[ds.dates[t - 1]] && res.levels[ds.dates[t]]) matched++;
      if (matched < 30) { msg.innerHTML = `<div class="alert error">Only ${matched} days overlap with the price dataset; at least 30 are needed.</div>`; return; }
      PRD.saveBenchmark(res);
      msg.innerHTML = `<div class="alert ok">Loaded ${days.length} index levels (${F.date(days[0])} to ${F.date(days[days.length - 1])}); ${matched} daily returns match the dataset. Reloading…</div>`;
      setTimeout(() => location.reload(), 700);
    });
    const cb = $('#clear-bench');
    if (cb) cb.addEventListener('click', () => { PRD.clearBenchmark(); location.reload(); });
  }

  function renderTabs() {
    $('#tabs').innerHTML = sheets.map((s, i) => `<button data-i="${i}" class="${i === active ? 'on' : ''}">${F.esc(s.name)}</button>`).join('');
    $$('#tabs button').forEach(b => b.addEventListener('click', () => { active = Number(b.dataset.i); renderTabs(); renderTable(); }));
  }

  function renderTable() {
    const sh = sheets[active];
    if (!sh) { $('#tbl').innerHTML = '<tbody><tr><td>The workbook could not be read.</td></tr></tbody>'; return; }
    let cols = sh.header.map((h, i) => i);
    if (sh.kind === 'prices' && colQuery) {
      cols = [0].concat(cols.slice(1).filter(i => {
        const t = sh.header[i], c = PRD.company(t);
        return (t + ' ' + c.name + ' ' + (c.sector || '')).toLowerCase().includes(colQuery);
      }));
    }
    const rows = sh.rows.filter(r => {
      if (!query) return true;
      if (sh.kind !== 'prices') return r.some(c => String(c == null ? '' : c).toLowerCase().includes(query));
      const d = String(r[0]);
      return d.includes(query) || F.date(d).toLowerCase().includes(query);
    });
    const cell = (v, i) => {
      if (v == null || v === '') return '<td class="muted">blank</td>';
      if (sh.kind === 'prices' && i > 0) return `<td class="n">${typeof v === 'number' ? v : F.esc(v)}</td>`;
      return `<td${sh.kind === 'notes' ? ' class="wrap"' : ''}>${F.esc(v)}</td>`;
    };
    $('#tbl').innerHTML = `<thead><tr>${cols.map(i => `<th class="${sh.kind === 'prices' && i > 0 ? 'n' : ''}" title="${F.esc(PRD.company(sh.header[i]).name)}">${F.esc(sh.header[i])}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(i => cell(r[i], i)).join('')}</tr>`).join('')}</tbody>`;
    $('#count').textContent = sh.kind === 'prices'
      ? `Showing ${rows.length.toLocaleString('en-IN')} of ${sh.rows.length.toLocaleString('en-IN')} rows and ${cols.length - 1} of ${sh.header.length - 1} companies. Prices in ₹, as stored in the file.`
      : `${rows.length} rows.`;
  }
})();
