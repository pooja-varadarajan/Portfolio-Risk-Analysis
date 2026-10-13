/* Stock Analysis & Selection page. */
(function () {
  const { F, $, $$ } = PRD;
  let ds, sortKey = 'position', sortDir = 1;

  PRD.boot('stocks', (data, root) => {
    ds = data;
    root.innerHTML = skeleton();
    bind();
    update();
  });

  function skeleton() {
    const per = PRD.periods(ds);
    return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Stock universe</div>
        <h1>Stock analysis and selection</h1>
        <p>All 21 stocks are measured on the same window with the same formulas. A transparent risk score splits them: the 10 riskiest go to Portfolio A, the 10 least risky to Portfolio B, and the stock in the middle is left out. You can reassign any stock below; a stock can only ever sit in one portfolio.</p>
        <div id="banner"></div>
      </div>
      <div class="card flat" style="padding:16px">
        <div class="controls">
          <label class="field">Estimation window start<input class="input" type="date" id="es" min="${ds.first}" max="${ds.last}" value="${per.est.start}"></label>
          <label class="field">End<input class="input" type="date" id="ee" min="${ds.first}" max="${ds.last}" value="${per.est.end}"></label>
          <button class="btn sm" id="est-reset">Reset to full range</button>
        </div>
        <div class="field-err" id="est-err"></div>
        <div class="field-hint" style="margin-top:6px">The date range used for these statistics, the stock split and both portfolios' optimised weights. "Reset to full range" sets it back to the whole dataset.</div>
      </div>
    </div>
    <div id="bench-note"></div>

    <div class="grid g-12" style="margin-top:18px">
      <div class="card span-8">
        <div class="card-head"><div><h2>Risk map</h2><div class="sub">Daily volatility vs beta. Bubble colour shows the portfolio each stock is in.</div></div></div>
        <div class="legend"><span><i class="sw-a"></i>Portfolio A</span><span><i class="sw-b"></i>Portfolio B</span><span><i style="background:var(--text-3)"></i>Not selected</span></div>
        <div class="chart tall"><canvas id="riskmap" role="img" aria-label="Scatter of volatility against beta for 21 stocks"></canvas></div>
      </div>
      <div class="card span-4">
        <h2>Selection rule</h2>
        <p class="text-2" style="margin-top:8px">For each stock we rank the 21 stocks (1 = least risky) on three measured risk statistics:</p>
        <ol class="text-2" style="padding-left:18px">
          <li><b>Daily volatility</b> (sample standard deviation of daily returns)</li>
          <li><b>Beta</b> against the benchmark</li>
          <li><b>95% one-day historical VaR</b></li>
        </ol>
        <div class="formula">Risk score = (rank_vol + rank_beta + rank_VaR) / 3</div>
        <p class="text-2">Highest 10 scores → <b>Portfolio A (High Risk)</b>. Lowest 10 → <b>Portfolio B (Low Risk)</b>. Ties are broken by volatility. Market cap and sector are shown for context but not used in the score, because every stock here is a NIFTY 50 large cap and sector is not a measured risk.</p>
        <div id="assign-status"></div>
        <button class="btn sm" id="reset-members" style="margin-top:10px">Reset to suggested split</button>
      </div>
    </div>

    <div class="section-title"><span class="n">01</span><h2>Risk and return statistics</h2></div>
    <p class="section-lead">Click a column header to sort. Use the Portfolio column to move stocks between portfolios; all portfolio pages recalculate automatically.</p>
    <div class="card"><div class="table-wrap" style="max-height:640px"><table class="t sticky-first" id="stats"></table></div>
      <div class="source-line" id="stats-note"></div></div>

    <div class="section-title"><span class="n">02</span><h2>Company information (external sources)</h2></div>
    <p class="section-lead">These figures are not in the price file. Each comes from the cited source and date; anything we could not verify is marked Unavailable.</p>
    <div class="card"><div class="table-wrap"><table class="t" id="companies"></table></div><div id="sources"></div></div>`;
  }

  function bind() {
    const onEst = () => {
      const s = $('#es').value, e = $('#ee').value;
      if (!s || !e || s >= e) { $('#est-err').textContent = 'Start must be before end.'; return; }
      if (PRD.stats.windowIdx(ds, s, e).length < 60) { $('#est-err').textContent = 'Choose a window with at least 60 trading days.'; return; }
      $('#est-err').textContent = '';
      PRD.state.update(st => { st.est = { start: s === ds.first ? null : s, end: e === ds.last ? null : e }; });
      update();
    };
    $('#es').addEventListener('change', onEst); $('#ee').addEventListener('change', onEst);
    $('#est-reset').addEventListener('click', () => { PRD.state.update(st => { st.est = { start: null, end: null }; }); $('#es').value = ds.first; $('#ee').value = ds.last; update(); });
    $('#reset-members').addEventListener('click', () => { PRD.state.update(st => { st.members = null; resetWeights(st); }); update(); });
  }

  function resetWeights(st) { st.mode = { A: 'optimised', B: 'optimised' }; st.custom = { A: null, B: null }; st.target = { A: null, B: null }; }

  let SEL, MEM;
  function update() {
    const per = PRD.periods(ds);
    $('#banner').innerHTML = PRD.dataBanner(ds) + `<div class="source-line">Statistics window: ${F.date(per.est.start)} to ${F.date(per.est.end)}.</div>`;
    $('#bench-note').innerHTML = ds.benchmark.kind === 'nifty'
      ? `<div class="alert ok"><b>Beta benchmark: NIFTY 50 index.</b> Beta = Cov(stock daily return, NIFTY 50 daily return) ÷ Var(NIFTY 50 daily return), using ${ds.benchmark.matched.toLocaleString('en-IN')} matched daily returns from ${F.esc(ds.benchmark.fileName)}. The NIFTY 50 itself has a beta of exactly 1.00, so a stock above 1 moves more than the market and one below 1 moves less.${ds.benchmark.filled ? ` ${ds.benchmark.filled} date${ds.benchmark.filled > 1 ? 's' : ''} in the price file ${ds.benchmark.filled > 1 ? 'have' : 'has'} no NIFTY 50 close (a market holiday on which the price file repeats the previous day's prices); the previous index close is used, so the index return is 0 that day, matching the stocks.` : ''}</div>`
      : `<div class="alert warn"><b>Beta benchmark:</b> the price dataset has no NIFTY 50 index column, so beta is measured against an <b>equal-weighted index of the same 21 stocks</b> (the average of their daily returns). This is a proxy, not the NIFTY 50. Upload NIFTY 50 index history on the <a href="data.html#benchmark">Data page</a> to switch to the real benchmark.</div>`;
    SEL = PRD.selection(ds);
    MEM = PRD.members(ds);
    renderStats(); renderRiskMap(); renderAssignStatus(); renderCompanies();
    const full = per.est.start === ds.first && per.est.end === ds.last;
    $('#est-reset').disabled = full;
    $('#est-reset').title = full ? 'Already showing the full dataset' : 'Use the whole dataset again';
    $('#es').value = per.est.start; $('#ee').value = per.est.end;
  }

  const where = t => (MEM.A.includes(t) ? 'A' : MEM.B.includes(t) ? 'B' : '');

  function renderStats() {
    const rows = SEL.stats.map(s => Object.assign({}, s, SEL.sel.scored[s.ticker], { sector: PRD.company(s.ticker).sector || '' }));
    const cols = [
      ['position', 'Risk rank', r => r.position, 'n'],
      ['ticker', 'Stock', r => `<b>${F.esc(r.ticker)}</b><div class="muted" style="font-size:12px">${F.esc(PRD.company(r.ticker).name)}</div>`],
      ['sector', 'Sector', r => r.sector ? F.esc(r.sector) : '<span class="muted">Unavailable</span>'],
      ['mean', 'Avg daily return', r => F.pct(r.mean, 3), 'n'],
      ['variance', 'Daily variance', r => F.pct(r.variance, 4), 'n'],
      ['vol', 'Daily volatility', r => F.pct(r.vol, 3), 'n'],
      ['beta', ds.benchmark.kind === 'nifty' ? 'Beta (NIFTY 50)' : 'Beta (proxy)', r => F.num(r.beta, 3), 'n'],
      ['var', 'VaR 95% (1-day)', r => F.pct(r.var), 'n'],
      ['score', 'Risk score', r => r.score.toFixed(2), 'n'],
      ['suggest', 'Suggested', r => SEL.sel.A.includes(r.ticker) ? '<span class="badge a">A · High</span>' : SEL.sel.B.includes(r.ticker) ? '<span class="badge b">B · Low</span>' : '<span class="badge">Not selected</span>'],
      ['assign', 'Portfolio', r => { const w = where(r.ticker); return `<select class="tag-sel ${w.toLowerCase()}" data-t="${F.esc(r.ticker)}" aria-label="Portfolio for ${F.esc(r.ticker)}"><option value="A" ${w === 'A' ? 'selected' : ''}>A · High risk</option><option value="B" ${w === 'B' ? 'selected' : ''}>B · Low risk</option><option value="" ${w === '' ? 'selected' : ''}>Not in a portfolio</option></select>`; }]
    ];
    const keyOf = { position: r => r.position, ticker: r => r.ticker, sector: r => r.sector, mean: r => r.mean, variance: r => r.variance, vol: r => r.vol, annVol: r => r.annVol, beta: r => r.beta, var: r => r.var, score: r => r.score, suggest: r => r.position, assign: r => where(r.ticker) || 'Z' };
    const kf = keyOf[sortKey] || keyOf.position;
    rows.sort((a, b) => { const x = kf(a), y = kf(b); return (x < y ? -1 : x > y ? 1 : 0) * sortDir; });
    $('#stats').innerHTML = `<thead><tr>${cols.map(c => `<th class="${c[3] || ''}" data-k="${c[0]}" style="cursor:pointer">${c[1]}${sortKey === c[0] ? (sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td class="${c[3] || ''}">${c[2](r)}</td>`).join('')}</tr>`).join('')}</tbody>`;
    $$('#stats th').forEach(th => th.addEventListener('click', () => { const k = th.dataset.k; if (k === sortKey) sortDir = -sortDir; else { sortKey = k; sortDir = 1; } renderStats(); }));
    $$('#stats select').forEach(sel => sel.addEventListener('change', () => assign(sel.dataset.t, sel.value)));
    const n = SEL.stats[0].n;
    $('#stats-note').innerHTML = `${n} daily returns per stock. Avg daily return is the average of those daily returns. Daily variance is the average squared distance of each day's return from that average (sample formula, divided by n − 1), and daily volatility is its square root (the standard deviation). All figures are daily; nothing is annualised. VaR is the 95% one-day historical VaR of each stock on its own. Risk rank 1 = highest risk score.`;
  }

  function assign(t, to) {
    const cur = { A: MEM.A.slice(), B: MEM.B.slice() };
    cur.A = cur.A.filter(x => x !== t); cur.B = cur.B.filter(x => x !== t); // enforces: never in both
    if (to) cur[to].push(t);
    const order = ds.tickers;
    cur.A.sort((a, b) => order.indexOf(a) - order.indexOf(b)); cur.B.sort((a, b) => order.indexOf(a) - order.indexOf(b));
    if (cur.A.length < 2 || cur.B.length < 2) {
      $('#assign-status').innerHTML = `<div class="alert error">Each portfolio needs at least 2 stocks to calculate a covariance-based optimisation. Change not applied.</div>`;
      renderStats();
      return;
    }
    PRD.state.update(st => { st.members = cur; resetWeights(st); });
    update();
  }

  function renderAssignStatus() {
    const a = MEM.A.length, b = MEM.B.length;
    const warn = [];
    if (a < 10) warn.push(`Portfolio A has ${a} stocks; the project brief asks for at least 10.`);
    if (b < 10) warn.push(`Portfolio B has ${b} stocks; the project brief asks for at least 10.`);
    $('#assign-status').innerHTML = `<div class="divider"></div>
      <div class="row"><span class="badge a"><span class="sw sw-a"></span>A: ${a} stocks</span><span class="badge b"><span class="sw sw-b"></span>B: ${b} stocks</span>
      <span class="badge">${MEM.custom ? 'Custom split' : 'Suggested split'}</span></div>
      ${warn.length ? `<div class="alert warn">${warn.join(' ')}</div>` : ''}
      <div class="source-line">No stock can be in both portfolios: each stock has a single Portfolio selector. Changing the split resets both portfolios to optimised weights.</div>`;
  }

  function renderRiskMap() {
    const pts = SEL.stats.map(s => ({ x: s.beta, y: s.vol * 100, t: s.ticker, w: where(s.ticker) }));
    const col = w => (w === 'A' ? PRD.color('--pa') : w === 'B' ? PRD.color('--pb') : PRD.color('--text-3'));
    const t2 = PRD.color('--text-2');
    PRD.chart('riskmap', {
      type: 'scatter',
      data: { datasets: [{ data: pts, pointRadius: 7, pointHoverRadius: 9, backgroundColor: pts.map(p => col(p.w)), borderColor: PRD.color('--surface'), borderWidth: 2 }] },
      plugins: [{ id: 'lbl', afterDatasetsDraw(chart) {
        chart.ctx.fillStyle = t2; PRD.pointLabels(chart, chart.getDatasetMeta(0).data, pts.map(p => p.t), 9);
      } }],
      options: {
        layout: { padding: { right: 70 } },
        scales: {
          x: { title: { display: true, text: ds.benchmark.kind === 'nifty' ? 'Beta vs NIFTY 50' : 'Beta vs 21-stock proxy' } },
          y: { title: { display: true, text: 'Daily volatility (%)' }, ticks: { callback: v => v.toFixed(1) + '%' } }
        },
        plugins: { tooltip: { callbacks: { label: c => ` ${c.raw.t}: beta ${c.raw.x.toFixed(2)}, volatility ${c.raw.y.toFixed(3)}%` } } }
      }
    });
  }

  function renderCompanies() {
    const S = PRD.SOURCES;
    const rows = ds.tickers.map(t => {
      const c = PRD.company(t), w = where(t);
      return `<tr><td><b>${F.esc(t)}</b></td><td>${F.esc(c.name)}</td><td>${c.sector ? F.esc(c.sector) : '<span class="muted">Unavailable</span>'}</td>
        <td class="n">${c.marketCapUsdBn != null ? 'US$ ' + c.marketCapUsdBn.toFixed(2) + ' bn' : '<span class="muted">Unavailable</span>'}</td>
        <td>${c.marketCapUsdBn != null ? 'Large cap (NIFTY 50 member)' : '<span class="muted">Unavailable</span>'}</td>
        <td class="n">${c.indexWeight != null ? c.indexWeight.toFixed(2) + '%' : '<span class="muted">Unavailable</span>'}</td>
        <td>${w ? `<span class="badge ${w.toLowerCase()}">${w}</span>` : '—'}</td></tr>`;
    }).join('');
    $('#companies').innerHTML = `<thead><tr><th>Ticker</th><th>Company</th><th>Sector</th><th class="n">Market cap</th><th>Size class</th><th class="n">NIFTY 50 weight</th><th>Portfolio</th></tr></thead><tbody>${rows}</tbody>`;
    $('#sources').innerHTML = `<div class="source-line">
      <b>Sector:</b> ${F.esc(S.sector.label)}, constituents as of ${F.esc(S.sector.asOf)}, accessed ${S.sector.accessed}. <a href="${S.sector.url}" target="_blank" rel="noopener">Source</a><br>
      <b>Market cap:</b> ${F.esc(S.marketCap.label)}. ${F.esc(S.marketCap.asOf)}; accessed ${S.marketCap.accessed}. Shown in US dollars as published; not converted to rupees to avoid adding an exchange-rate assumption. <a href="${S.marketCap.url}" target="_blank" rel="noopener">Source</a><br>
      <b>Size class:</b> all 21 companies are current NIFTY 50 members (per the dataset's Notes sheet), i.e. among India's largest listed companies.<br>
      <b>NIFTY 50 weight</b> (free-float market-cap based): ${F.esc(S.indexWeight.label)}, as on ${S.indexWeight.asOf}. <a href="${S.indexWeight.url}" target="_blank" rel="noopener">Source</a></div>`;
  }
})();
