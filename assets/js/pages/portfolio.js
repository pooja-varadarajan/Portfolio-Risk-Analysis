/* Portfolio A / Portfolio B page (same layout; which one comes from <main data-portfolio>). */
(function () {
  const app = document.getElementById('app');
  const KEY = app.dataset.portfolio === 'B' ? 'B' : 'A';
  const OTHER = KEY === 'A' ? 'B' : 'A';
  const { F, $, $$ } = PRD;
  const pcol = k => PRD.color(k === 'A' ? '--pa' : '--pb');

  let ds, A, O; // A = this portfolio's analysis, O = the other portfolio's
  let draft = null; // custom weights being typed (percent), may not sum to 100 yet

  PRD.boot(KEY === 'A' ? 'pa' : 'pb', (data, root) => {
    ds = data;
    root.innerHTML = skeleton();
    bindControls();
    update(true);
  });

  /* ---------------------------------------------------------------- layout */
  function skeleton() {
    const s = PRD.state.get();
    const isA = KEY === 'A';
    return `
    <div class="page-head">
      <div>
        <div class="eyebrow"><span class="badge ${isA ? 'a' : 'b'}"><span class="sw sw-${isA ? 'a' : 'b'}"></span>${isA ? 'High Risk' : 'Low Risk'}</span></div>
        <h1>Portfolio ${KEY} · ${isA ? 'High Risk' : 'Low Risk'}</h1>
        <div id="banner"></div>
      </div>
      <div class="card flat" style="padding:16px;min-width:260px">
        <label class="field">Investment amount (₹)
          <div class="input-money"><span>₹</span><input class="input" id="invest" inputmode="numeric" value="${Number(s.invest[KEY]).toLocaleString('en-IN')}"></div>
        </label>
        <div class="field-err" id="invest-err"></div>
        <div class="field-hint" id="invest-words"></div>
      </div>
    </div>

    <div class="kpis" id="kpis"></div>

    <div class="section-title"><h2>Allocation</h2></div>
    <div class="grid g-12">
      <div class="card span-8">
        <div class="card-head">
          <div class="seg" id="mode">
            <button data-mode="optimised">Markowitz optimised weights</button>
            <button data-mode="custom">Custom weights</button>
          </div>
          <div class="row" id="custom-tools">
            <button class="btn sm" id="eq">Equal weights</button>
            <button class="btn sm" id="from-opt">Copy optimised</button>
            <button class="btn sm" id="normalise">Scale to 100%</button>
          </div>
        </div>
        <div id="opt-controls">
          <div class="controls">
            <label class="field" style="flex:1;min-width:200px">Target daily return (%)
              <input class="input" id="target" type="number" step="0.001"></label>
            <label class="field" style="width:200px">Minimum weight per stock (%)
              <input class="input" id="bmin" type="number" step="0.5" min="0" value="${(s.bounds[KEY].min * 100).toFixed(1)}"></label>
            <button class="btn sm" id="target-reset">Use equal-weight return</button>
          </div>
          <input type="range" id="target-range" style="width:100%;margin-top:10px;accent-color:var(--accent)" aria-label="Target daily return">
          <div class="field-hint" id="target-hint"></div>
          <div class="field-err" id="opt-err"></div>
        </div>
        <div class="table-wrap" style="margin-top:14px"><table class="t" id="alloc"></table></div>
        <div id="weights-msg"></div>
      </div>
      <div class="card span-4">
        <div class="card-head"><div><h3>Weights</h3><div class="sub" id="wchart-sub"></div></div></div>
        <div class="chart" id="wchart-box"><canvas id="wchart" role="img" aria-label="Bar chart of portfolio weights"></canvas></div>
      </div>
    </div>

    <details class="method derive" id="derive">
      <summary>How the Markowitz optimised weights were found, step by step</summary>
      <div class="body" id="derive-body"></div>
    </details>

    <div class="section-title"><h2>Markowitz efficient frontier</h2></div>
    <div class="card">
      <div class="legend" id="ef-legend"></div>
      <div class="chart tall"><canvas id="ef" role="img" aria-label="Efficient frontier scatter chart"></canvas></div>
      <div class="source-line" id="ef-note"></div>
    </div>

    <div class="section-title"><h2>Value at Risk and Expected Shortfall</h2></div>
    <div class="grid g-12">
      <div class="card span-5">
        <label class="field">Confidence level (%)
          <input class="input" id="conf" type="number" min="50" max="99.9" step="0.1" value="${(s.conf * 100).toFixed(1)}">
        </label>
        <div class="row" style="margin-top:8px" id="conf-chips">
          ${[90, 95, 97.5, 99].map(c => `<button class="btn sm" data-c="${c}">${c}%</button>`).join('')}
        </div>
        <div class="field-err" id="conf-err"></div>
        <div class="kpis" id="var-kpis" style="margin-top:14px"></div>
        <details class="method"><summary>How VaR and ES are calculated</summary><div class="body">
          <p>1. Build the portfolio's daily return series with the weights above: <span class="mono">r<sub>p,t</sub> = Σ w<sub>i</sub> · r<sub>i,t</sub></span>, where <span class="mono">r<sub>i,t</sub> = P<sub>i,t</sub> / P<sub>i,t−1</sub> − 1</span>.</p>
          <p>2. Sort the n returns from worst to best and set <span class="mono">k = ⌈n × (1 − c)⌉</span>.</p>
          <p>3. <b>VaR</b> (loss threshold) = minus the k-th worst return.</p>
          <p>4. <b>Expected Shortfall</b> (tail-average loss) = minus the average of the k worst returns.</p>
          <p>5. Rupee amounts = percentage × investment amount (one-day figures).</p>
        </div></details>
      </div>
      <div class="card span-7">
        <div class="card-head"><div><h3>Distribution of daily returns</h3><div class="sub" id="hist-sub"></div></div></div>
        <div class="legend"><span><i class="sw-${KEY === 'A' ? 'a' : 'b'}" style="opacity:.55"></i>Daily returns</span><span><i style="background:var(--bad)"></i>Tail beyond VaR</span></div>
        <div class="chart"><canvas id="hist" role="img" aria-label="Histogram of daily portfolio returns with VaR threshold"></canvas></div>
      </div>
      <div class="card span-12">
        <div class="card-head"><div><h3>VaR and ES by period</h3><div class="sub">One-day losses at the selected confidence level, same weights in every period.</div></div></div>
        <div class="table-wrap"><table class="t" id="var-table"></table></div>
      </div>
    </div>

    <div class="section-title"><h2>Stress test: COVID-19 vs recent year</h2></div>
    <p class="section-lead">Same weights in both periods, compared with Portfolio ${OTHER}.</p>
    <div class="card">
      <div class="controls" id="periods"></div>
      <div class="field-err" id="period-err"></div>
      <div class="table-wrap" style="margin-top:14px"><table class="t vs-table" id="tt-table"></table></div>
      <div class="grid g-2" style="margin-top:16px">
        <div><h3 id="g-covid-title"></h3><div class="legend" id="g-legend-1"></div><div class="chart short"><canvas id="g-covid" role="img" aria-label="Growth of investment during COVID period"></canvas></div></div>
        <div><h3 id="g-recent-title"></h3><div class="legend" id="g-legend-2"></div><div class="chart short"><canvas id="g-recent" role="img" aria-label="Growth of investment during recent period"></canvas></div></div>
      </div>
    </div>

    <div class="section-title"><h2>Markowitz weights by year</h2></div>
    <p class="section-lead">Pick two years. For each year, the optimiser uses only that year's daily returns and finds the minimum-variance weights for the same target return as above.</p>
    <div class="card">
      <div class="controls" id="year-controls"></div>
      <div class="grid g-12" style="margin-top:14px">
        <div class="span-7"><div class="table-wrap"><table class="t" id="yr-table"></table></div><div id="yr-msg"></div></div>
        <div class="span-5"><div class="legend" id="yr-legend"></div><div class="chart tall"><canvas id="yr-chart" role="img" aria-label="Weights by year"></canvas></div></div>
      </div>
    </div>

    <div class="section-title"><h2>Does Portfolio ${KEY} deserve its ${KEY === 'A' ? 'high' : 'low'}-risk label?</h2></div>
    <div class="card" id="verdict"></div>`;
  }

  /* ---------------------------------------------------------------- controls */
  function bindControls() {
    const inv = $('#invest');
    inv.addEventListener('input', PRD.debounce(() => {
      const v = Number(inv.value.replace(/[,₹\s]/g, ''));
      if (!isFinite(v) || v <= 0) { inv.classList.add('invalid'); $('#invest-err').textContent = 'Enter a positive amount in rupees.'; return; }
      if (v > 1e12) { inv.classList.add('invalid'); $('#invest-err').textContent = 'Please enter an amount below ₹1,00,000 crore.'; return; }
      inv.classList.remove('invalid'); $('#invest-err').textContent = '';
      PRD.state.update(s => { s.invest[KEY] = v; });
      update();
    }, 250));
    inv.addEventListener('blur', () => { const v = PRD.state.get().invest[KEY]; inv.value = Number(v).toLocaleString('en-IN'); });

    $$('#mode button').forEach(b => b.addEventListener('click', () => {
      const m = b.dataset.mode;
      PRD.state.update(s => {
        s.mode[KEY] = m;
        if (m === 'custom' && !PRD.customWeightsValid(A.tickers, s.custom[KEY]).ok) s.custom[KEY] = asPercentMap(A.tickers, A.w);
      });
      draft = null;
      update(true);
    }));
    $('#eq').addEventListener('click', () => setCustom(A.tickers.map(() => 100 / A.tickers.length)));
    $('#from-opt').addEventListener('click', () => setCustom(A.opt.w.map(x => x * 100)));
    $('#normalise').addEventListener('click', () => {
      const cur = A.tickers.map(t => Number((draft || PRD.state.get().custom[KEY] || {})[t]) || 0);
      const tot = cur.reduce((a, x) => a + x, 0);
      if (tot <= 0) return;
      setCustom(cur.map(x => (x / tot) * 100));
    });

    const setTarget = pct => {
      if (!isFinite(pct)) { $('#opt-err').textContent = 'Enter the target as a number, for example 0.08 for 0.08% a day.'; return; }
      $('#opt-err').textContent = '';
      PRD.state.update(s => { s.target[KEY] = pct / 100; });
      update(true);
    };
    $('#target').addEventListener('input', PRD.debounce(() => setTarget(Number($('#target').value)), 350));
    $('#target-range').addEventListener('change', () => setTarget(Number($('#target-range').value)));
    $('#target-range').addEventListener('input', () => { $('#target').value = Number($('#target-range').value).toFixed(4); });
    $('#target-reset').addEventListener('click', () => { PRD.state.update(s => { s.target[KEY] = null; }); update(true); });
    $('#bmin').addEventListener('input', PRD.debounce(() => {
      const lo = Number($('#bmin').value) / 100, n = A.tickers.length;
      if (!(lo >= 0 && lo < 1 / n)) { $('#opt-err').textContent = `Minimum weight must be at least 0% and below ${(100 / n).toFixed(1)}% (with ${n} stocks, ${(100 / n).toFixed(1)}% each would leave no choice).`; return; }
      $('#opt-err').textContent = '';
      PRD.state.update(s => { s.bounds[KEY] = { min: lo, max: 1 }; });
      update(true);
    }, 350));

    const confInput = $('#conf');
    const setConf = v => {
      if (!(v >= 50 && v <= 99.9)) { confInput.classList.add('invalid'); $('#conf-err').textContent = 'Confidence level must be between 50% and 99.9%.'; return; }
      confInput.classList.remove('invalid'); $('#conf-err').textContent = '';
      PRD.state.update(s => { s.conf = Math.round(v * 10) / 1000; });
      update();
    };
    confInput.addEventListener('input', PRD.debounce(() => setConf(Number(confInput.value)), 200));
    $$('#conf-chips button').forEach(b => b.addEventListener('click', () => { confInput.value = b.dataset.c; setConf(Number(b.dataset.c)); }));

    renderPeriodControls();
    renderYearControls();
  }

  function renderPeriodControls() {
    const per = PRD.periods(ds);
    $('#periods').innerHTML = `
      <label class="field">COVID-19 start<input class="input" type="date" id="cs" min="${ds.first}" max="${ds.last}" value="${per.covid.start}"></label>
      <label class="field">COVID-19 end<input class="input" type="date" id="ce" min="${ds.first}" max="${ds.last}" value="${per.covid.end}"></label>
      <label class="field">Recent start<input class="input" type="date" id="rs" min="${ds.first}" max="${ds.last}" value="${per.recent.start}"></label>
      <label class="field">Recent end<input class="input" type="date" id="re" min="${ds.first}" max="${ds.last}" value="${per.recent.end}"></label>
      <button class="btn sm" id="period-reset">Reset to defaults</button>`;
    const onChange = () => {
      const cs = $('#cs').value, ce = $('#ce').value, rs = $('#rs').value, re = $('#re').value;
      const err = [];
      if (!cs || !ce || cs >= ce) err.push('COVID period: start must be before end.');
      if (!rs || !re || rs >= re) err.push('Recent period: start must be before end.');
      const okLen = (s, e) => PRD.stats.windowIdx(ds, s, e).length >= 20;
      if (!err.length && !okLen(cs, ce)) err.push('COVID period needs at least 20 trading days of data.');
      if (!err.length && !okLen(rs, re)) err.push('Recent period needs at least 20 trading days of data.');
      $('#period-err').textContent = err.join(' ');
      if (err.length) return;
      PRD.state.update(s => { s.covid = { start: cs, end: ce }; s.recent = { start: rs, end: re }; });
      update();
    };
    $$('#periods input').forEach(i => i.addEventListener('change', onChange));
    $('#period-reset').addEventListener('click', () => {
      const d = PRD.state.defaults();
      PRD.state.update(s => { s.covid = d.covid; s.recent = d.recent; });
      renderPeriodControls(); update();
    });
  }

  function renderYearControls() {
    const ys = PRD.years(ds), s = PRD.state.get();
    const opt = sel => ys.map(y => `<option value="${y}" ${y === sel ? 'selected' : ''}>${y}${y === ds.last.slice(0, 4) && ds.last.slice(5) !== '12-31' ? ` (to ${F.date(ds.last).slice(0, -5)})` : ''}</option>`).join('');
    const y1 = ys.includes(s.years.y1) ? s.years.y1 : ys[0], y2 = ys.includes(s.years.y2) ? s.years.y2 : ys[ys.length - 1];
    $('#year-controls').innerHTML = `
      <label class="field">First year<select class="input" id="y1">${opt(y1)}</select></label>
      <label class="field">Second year<select class="input" id="y2">${opt(y2)}</select></label>`;
    const on = () => { PRD.state.update(st => { st.years = { y1: $('#y1').value, y2: $('#y2').value }; }); renderYears(); };
    $('#y1').addEventListener('change', on); $('#y2').addEventListener('change', on);
  }

  const asPercentMap = (tickers, w) => Object.fromEntries(tickers.map((t, i) => [t, Math.round(w[i] * 1e4) / 100]));
  function setCustom(arrPct) {
    // round to 2 dp and push any rounding residue onto the largest weight so the total is exactly 100
    const r = arrPct.map(x => Math.round(x * 100) / 100);
    const diff = Math.round((100 - r.reduce((a, x) => a + x, 0)) * 100) / 100;
    if (diff !== 0) { const i = r.indexOf(Math.max(...r)); r[i] = Math.round((r[i] + diff) * 100) / 100; }
    PRD.state.update(s => { s.mode[KEY] = 'custom'; s.custom[KEY] = Object.fromEntries(A.tickers.map((t, i) => [t, r[i]])); });
    draft = null;
    update(true);
  }

  /* ---------------------------------------------------------------- update */
  function update(rebuildTable) {
    A = PRD.analyse(ds, KEY);
    O = PRD.analyse(ds, OTHER);
    $('#banner').innerHTML = PRD.dataBanner(ds) + `<div class="source-line">Estimation window: ${F.date(A.per.est.start)} to ${F.date(A.per.est.end)} (${A.est.n} daily returns). Change it on the <a href="stocks.html">Stock Selection</a> page.</div>`;
    $('#invest-words').textContent = `${F.inrShort(A.invest)} invested in ${A.tickers.length} stocks`;
    $$('#mode button').forEach(b => b.classList.toggle('on', b.dataset.mode === A.requestedMode));
    $('#custom-tools').classList.toggle('hidden', A.requestedMode !== 'custom');
    $('#opt-controls').classList.toggle('hidden', A.requestedMode === 'custom');
    renderTargetControls();
    if (rebuildTable || !$('#alloc').rows.length) renderAllocTable(); else refreshAllocNumbers();
    renderKpis();
    renderDerivation();
    renderWeightsChart();
    renderFrontier();
    renderVaR();
    renderStress();
    renderYears();
    renderVerdict();
  }

  function renderTargetControls() {
    const o = A.opt, lo = o.range.min * 100, hi = o.range.max * 100, t = o.target * 100;
    const tr = $('#target-range');
    tr.min = lo.toFixed(4); tr.max = hi.toFixed(4); tr.step = ((hi - lo) / 400).toFixed(6); tr.value = t;
    if (document.activeElement !== $('#target')) $('#target').value = t.toFixed(4);
    $('#target-hint').innerHTML = `Reachable targets with a ${F.pct(o.lo, 1)} minimum weight: <b>${lo.toFixed(4)}%</b> to <b>${hi.toFixed(4)}%</b> a day. ${o.isDefaultTarget ? 'Default target = the return of an equal-weight mix of these stocks' : 'Equal-weight mix return'} (${(o.eqTarget * 100).toFixed(4)}% a day).${o.targetNote ? ' ' + F.esc(o.targetNote) : ''}`;
  }

  function renderKpis() {
    const a = A;
    const conf = F.conf(a.conf);
    $('#kpis').innerHTML = [
      kpi('Avg daily return', F.pct(a.point.ret, 4), 'mean of daily portfolio returns'),
      kpi('Daily variance', F.pct(a.point.variance, 4), 'variance of daily returns, w′Σw'),
      kpi('Daily volatility', F.pct(a.point.vol, 3), 'std. dev. of daily returns'),
      kpi('Portfolio beta', F.num(a.beta, 2), ds.benchmark.kind === 'nifty' ? 'vs NIFTY 50' : 'vs 21-stock proxy'),
      kpi(`1-day VaR (${conf})`, F.inr(a.var * a.invest), F.pct(a.var) + ' of value'),
      kpi(`1-day ES (${conf})`, F.inr(a.es * a.invest), F.pct(a.es) + ' of value'),
      kpi('Max drawdown', F.pct(a.perf.mdd, 1), 'peak-to-trough, estimation window')
    ].join('');
  }
  function kpi(l, v, s) { return `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`; }

  function renderAllocTable() {
    const a = A, custom = a.requestedMode === 'custom';
    const map = draft || PRD.state.get().custom[KEY] || {};
    const rows = a.tickers.map((t, i) => {
      const st = a.stockStats[t], c = PRD.company(t);
      const wPct = custom ? (map[t] != null ? map[t] : (a.w[i] * 100).toFixed(2)) : null;
      return `<tr data-t="${F.esc(t)}">
        <td><b>${F.esc(t)}</b><div class="muted" style="font-size:12px">${F.esc(c.name)}</div></td>
        <td>${c.sector ? F.esc(c.sector) : '<span class="muted">Unavailable</span>'}</td>
        <td class="n">${custom ? `<input class="input w-in" type="number" step="0.01" min="0" max="100" value="${wPct}" aria-label="Weight for ${F.esc(t)} in percent">` : `<span class="w-val">${F.pct(a.w[i])}</span>`}</td>
        <td class="n amt">${F.inr(a.w[i] * a.invest)}</td>
        <td class="n">${F.pct(st.mean, 4)}</td>
        <td class="n">${F.pct(st.vol, 3)}</td>
        <td class="n">${F.num(st.beta, 2)}</td>
      </tr>`;
    }).join('');
    $('#alloc').innerHTML = `<thead><tr><th>Stock</th><th>Sector</th><th class="n">Weight</th><th class="n">Amount</th><th class="n">Mean daily return</th><th class="n">Daily volatility</th><th class="n">Beta</th></tr></thead>
      <tbody>${rows}</tbody><tfoot><tr class="total"><td>Total</td><td></td><td class="n" id="w-total"></td><td class="n" id="amt-total"></td><td colspan="3"></td></tr></tfoot>`;
    if (custom) $$('#alloc .w-in').forEach(inp => inp.addEventListener('input', onWeightInput));
    refreshAllocNumbers();
  }

  const onWeightInput = PRD.debounce(() => {
    const m = {};
    $$('#alloc tr[data-t]').forEach(tr => { m[tr.dataset.t] = Number(tr.querySelector('.w-in').value); });
    draft = m;
    const v = PRD.customWeightsValid(A.tickers, m);
    if (v.ok) {
      PRD.state.update(s => { s.custom[KEY] = m; s.mode[KEY] = 'custom'; });
      draft = null;
      update(false);
    } else {
      refreshAllocNumbers(v);
    }
  }, 300);

  function refreshAllocNumbers(invalid) {
    const a = A, custom = a.requestedMode === 'custom';
    const map = draft || {};
    let tot = 0;
    $$('#alloc tr[data-t]').forEach(tr => {
      const i = a.tickers.indexOf(tr.dataset.t);
      const w = custom && draft ? (Number(map[tr.dataset.t]) || 0) / 100 : a.w[i];
      tot += w;
      tr.querySelector('.amt').textContent = F.inr(w * a.invest);
      const inp = tr.querySelector('.w-in');
      if (inp) inp.classList.toggle('invalid', !(Number(inp.value) >= 0));
    });
    $('#w-total').innerHTML = `<span class="${Math.abs(tot - 1) > 1e-4 ? 'neg' : ''}">${F.pct(tot)}</span>`;
    $('#amt-total').textContent = F.inr(tot * a.invest);
    const msg = $('#weights-msg');
    const cs = invalid || (custom && a.customState && !a.customState.ok ? a.customState : null);
    if (cs) msg.innerHTML = `<div class="alert error">${F.esc(cs.msg)} The metrics still use the last valid allocation.</div>`;
    else if (!custom) msg.innerHTML = `<div class="source-line">Markowitz minimum-variance weights: the lowest-variance mix that earns exactly ${(a.opt.target * 100).toFixed(4)}% a day, with every stock held at ${F.pct(a.opt.lo, 1)} or more and no short selling.</div>`;
    else msg.innerHTML = `<div class="alert ok">Custom weights total 100%. All metrics use these weights.</div>`;
  }

  /* Step-by-step derivation of the optimised weights: returns, Σ, μ, reachable targets, the QP and the result. */
  function renderDerivation() {
    const a = A, o = a.opt, e = a.est, T = a.tickers, N = T.length;
    const d6 = x => (Math.abs(x) < 5e-7 ? 0 : x).toFixed(6);
    const ti = ds.tickers.indexOf(T[0]), t0 = a.estIdx[0];
    const p1 = ds.prices[t0][ti], p0 = ds.prices[t0 - 1][ti];
    const head = T.map(t => `<th class="n">${F.esc(t)}</th>`).join('');
    const covRows = T.map((t, i) => `<tr><th>${F.esc(t)}</th>${e.cov[i].map((v, j) => `<td class="n${i === j ? ' diag' : ''}">${d6(v)}</td>`).join('')}</tr>`).join('');
    const muRows = T.map((t, i) => `<tr><td>${F.esc(t)}</td><td class="n">${d6(e.mu[i])}</td></tr>`).join('');
    const lo = o.range.min, hi = o.range.max;
    const res = o.ok ? o : null;
    $('#derive-body').innerHTML = `
      <ol class="steps">
        <li><h4>Daily returns</h4>
          <p>Each day's return compares that day's closing price with the previous day's: <span class="mono">r = P<sub>t</sub> ÷ P<sub>t−1</sub> − 1</span>. Window ${F.date(a.per.est.start)} to ${F.date(a.per.est.end)}: <b>${e.n}</b> daily returns × <b>${N}</b> stocks.</p>
          <p class="muted">Check: ${F.esc(T[0])} on ${F.date(ds.dates[t0])}: ${p1.toFixed(2)} ÷ ${p0.toFixed(2)} − 1 = ${d6(p1 / p0 - 1)}</p></li>
        <li><h4>Variance-covariance matrix, Σ (${N} × ${N})</h4>
          <p>Diagonal (highlighted) = each stock's daily variance; off-diagonal = covariance between two stocks. Divisor n − 1 = ${e.n - 1}.</p>
          <div class="table-wrap"><table class="t mtx sticky-first"><thead><tr><th></th>${head}</tr></thead><tbody>${covRows}</tbody></table></div></li>
        <li><h4>Mean vector, μ (${N} × 1)</h4>
          <p>Each stock's average daily return, arranged as a column vector.</p>
          <div class="table-wrap mu-wrap"><table class="t mtx"><thead><tr><th>Stock</th><th class="n" style="text-transform:none">μ</th></tr></thead><tbody>${muRows}</tbody></table></div></li>
        <li><h4>Rules and reachable targets</h4>
          <p>Weights add up to 1, every stock holds at least <b>${F.pct(o.lo, 1)}</b>, and there is no short selling. With these rules the target daily return can be anywhere from</p>
          <div class="kpis derive-kpis">
            <div class="kpi"><div class="l">Lowest target</div><div class="v">${d6(lo)}</div><div class="s">${(lo * 100).toFixed(4)}% a day</div></div>
            <div class="kpi"><div class="l">Highest target</div><div class="v">${d6(hi)}</div><div class="s">${(hi * 100).toFixed(4)}% a day</div></div>
            <div class="kpi"><div class="l">Target used</div><div class="v">${d6(o.target)}</div><div class="s">${o.isDefaultTarget ? 'equal-weight average of μ' : 'your chosen target'}</div></div>
          </div></li>
        <li><h4>Find the lowest-variance mix for that target</h4>
          <div class="formula">minimise   wᵀΣw
subject to Σ wᵢ = 1,   wᵀμ = ${d6(o.target)},   wᵢ ≥ ${(o.lo).toFixed(2)}</div>
          <p>Solved exactly as a quadratic program. The resulting weights are in the allocation table above.</p></li>
        <li><h4>Result: the optimised portfolio</h4>
          ${res ? `<div class="kpis derive-kpis">
            <div class="kpi"><div class="l">Portfolio mean, wᵀμ</div><div class="v">${d6(res.ret)}</div><div class="s">${(res.ret * 100).toFixed(4)}% a day</div></div>
            <div class="kpi"><div class="l">Portfolio variance, wᵀΣw</div><div class="v">${d6(res.variance)}</div><div class="s">${(res.variance * 100).toFixed(4)}%</div></div>
            <div class="kpi"><div class="l">Standard deviation</div><div class="v">${d6(res.vol)}</div><div class="s">${(res.vol * 100).toFixed(4)}% a day</div></div>
          </div>` : `<div class="alert warn">${F.esc(o.reason || 'No optimised portfolio for this target.')}</div>`}
        </li>
      </ol>`;
  }

  function renderWeightsChart() {
    const a = A;
    const order = a.tickers.map((t, i) => [t, a.w[i]]).sort((x, y) => y[1] - x[1]);
    $('#wchart-sub').textContent = a.mode === 'custom' ? 'Custom allocation' : 'Markowitz optimised allocation';
    PRD.chart('wchart', {
      type: 'bar',
      data: { labels: order.map(x => x[0]), datasets: [{ data: order.map(x => x[1] * 100), backgroundColor: pcol(KEY), borderRadius: 4, barPercentage: 0.72 }] },
      plugins: [PRD.barLabels(v => v.toFixed(1) + '%')],
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 44 } },
        scales: { x: { ticks: { callback: v => +v.toFixed(3) + '%' }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: PRD.color('--text-2') } } },
        plugins: { tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.x.toFixed(2)}% · ${F.inr(ctx.parsed.x / 100 * a.invest)}` } } }
      }
    });
  }

  /* ---------------------------------------------------------------- frontier */
  function renderFrontier() {
    const a = A, o = a.opt;
    const fr = PRD.opt.frontier(a.est.cov, a.est.mu, o.lo, o.hi, 36);
    const rnd = PRD.opt.randomPortfolios(a.est.cov, a.est.mu, 1200, KEY === 'A' ? 7 : 11);
    const ann = p => ({ x: p.vol * 100, y: p.ret * 100 }); // daily figures, not annualised
    const c4 = PRD.color('--c4'), c3 = PRD.color('--c3'), pc = pcol(KEY), t2 = PRD.color('--text-2'), t3 = PRD.color('--text-3');
    const stocks = a.tickers.map((t, i) => ({ x: Math.sqrt(a.est.cov[i][i]) * 100, y: a.est.mu[i] * 100, t }));
    const sets = [
      { label: 'Random long-only portfolios', data: rnd.map(ann), type: 'scatter', pointRadius: 1.6, pointHoverRadius: 3, backgroundColor: PRD.alpha(t3.startsWith('#') ? t3 : '#7d857a', 0.35), order: 9 },
      { label: 'Efficient frontier', data: fr.pts.map(ann), type: 'line', borderColor: c4, borderWidth: 2.5, pointRadius: 0, showLine: true, order: 3 },
      { label: 'Inefficient branch', data: fr.lower.concat([fr.gmv]).map(ann), type: 'line', borderColor: c4, borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, showLine: true, order: 4 },
      { label: 'Individual stocks', data: stocks, type: 'scatter', pointRadius: 5, backgroundColor: 'transparent', borderColor: t2, borderWidth: 1.5, order: 5 },
      { label: 'Global minimum variance', data: [ann(fr.gmv)], type: 'scatter', pointRadius: 8, pointStyle: 'triangle', backgroundColor: c3, borderColor: PRD.color('--surface'), borderWidth: 2, order: 1 },
      { label: 'Markowitz optimised (target)', data: o.ok ? [ann(o)] : [], type: 'scatter', pointRadius: 10, pointStyle: 'rectRot', backgroundColor: c4, borderColor: PRD.color('--surface'), borderWidth: 2, order: 1 },
      { label: `Your Portfolio ${KEY}`, data: [ann(a.point)], type: 'scatter', pointRadius: 7, backgroundColor: pc, borderColor: PRD.color('--surface'), borderWidth: 2, order: 0 }
    ];
    $('#ef-legend').innerHTML = [
      ['line', c4, 'Efficient frontier'], ['dot', t3, 'Random portfolios'], ['ring', t2, 'Individual stocks'],
      ['dot', c3, 'Global minimum variance ▲'], ['dot', c4, 'Markowitz optimised ◆'], ['dot', pc, `Your Portfolio ${KEY}`]
    ].map(([k, col, l]) => `<span><i class="${k === 'line' ? 'line' : k === 'ring' ? 'ring' : ''}" style="${k === 'ring' ? 'border-color:' + col : 'background:' + col}"></i>${l}</span>`).join('');
    $('#ef-note').innerHTML = `Each frontier point is the minimum-variance mix for one target return (minimum ${F.pct(o.lo, 1)} per stock, no short selling). Both axes are daily: average daily return and daily volatility. Estimation window ${F.date(a.per.est.start)} to ${F.date(a.per.est.end)}.`;
    const labelPlugin = {
      id: 'stockLabels',
      afterDatasetsDraw(chart) {
        const meta = chart.getDatasetMeta(3); if (meta.hidden) return;
        chart.ctx.fillStyle = t2; PRD.pointLabels(chart, meta.data, stocks.map(s => s.t), 7);
      }
    };
    PRD.chart('ef', {
      type: 'scatter',
      data: { datasets: sets },
      plugins: [labelPlugin],
      options: {
        parsing: false,
        layout: { padding: { right: 70 } },
        interaction: { mode: 'nearest', intersect: true },
        scales: {
          x: { type: 'linear', title: { display: true, text: 'Daily volatility (%)' }, ticks: { callback: v => +v.toFixed(3) + '%' } },
          y: { type: 'linear', title: { display: true, text: 'Average daily return (%)' }, ticks: { callback: v => +v.toFixed(3) + '%' } }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: ctx => {
                const d = ctx.raw, name = ctx.dataset.label === 'Individual stocks' ? d.t : ctx.dataset.label;
                return ` ${name}: avg daily return ${d.y.toFixed(3)}%, daily volatility ${d.x.toFixed(3)}%`;
              }
            }
          }
        }
      }
    });
  }

  /* ---------------------------------------------------------------- VaR */
  function renderVaR() {
    const a = A, conf = F.conf(a.conf);
    $('#var-kpis').innerHTML = [
      kpi(`VaR ${conf}`, F.pct(a.var), F.inr(a.var * a.invest) + ' one-day loss'),
      kpi(`ES ${conf}`, F.pct(a.es), F.inr(a.es * a.invest) + ' average tail loss'),
      kpi('Tail days used', `${a.k}`, `worst ${a.k} of ${a.n} trading days`)
    ].join('');
    const r = a.returns.map(x => x * 100);
    const lo = Math.max(Math.min(...r), -12), hi = Math.min(Math.max(...r), 12);
    const bins = 60, step = (hi - lo) / bins;
    const counts = new Array(bins).fill(0);
    for (const x of r) { const b = Math.min(bins - 1, Math.max(0, Math.floor((x - lo) / step))); counts[b]++; }
    const centers = counts.map((_, i) => lo + (i + 0.5) * step);
    const thr = -a.var * 100;
    const pc = pcol(KEY), bad = PRD.color('--bad');
    $('#hist-sub').textContent = `${a.n} daily returns, ${F.date(a.per.est.start)} to ${F.date(a.per.est.end)}. VaR threshold at ${thr.toFixed(2)}%.`;
    const vline = {
      id: 'vline', afterDatasetsDraw(chart) {
        const xs = chart.scales.x, ctx = chart.ctx, { top, bottom } = chart.chartArea;
        const pos = Math.max(0, Math.min(bins - 1, (thr - lo) / step - 0.5));
        const px = xs.getPixelForValue(pos);
        ctx.save(); ctx.strokeStyle = bad; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
        ctx.fillStyle = bad; ctx.font = '600 11px ' + getComputedStyle(document.body).fontFamily;
        ctx.fillText(`VaR ${(-thr).toFixed(2)}%`, px + 6, top + 12); ctx.restore();
      }
    };
    PRD.chart('hist', {
      type: 'bar',
      data: { labels: centers.map(c => c.toFixed(2)), datasets: [{ data: counts, backgroundColor: centers.map(c => (c < thr ? bad : PRD.alpha(pc, 0.55))), borderRadius: 2, barPercentage: 1, categoryPercentage: 0.92 }] },
      plugins: [vline],
      options: {
        scales: {
          x: { grid: { display: false }, ticks: { maxTicksLimit: 9, callback: (v, i) => centers[i].toFixed(1) + '%' }, title: { display: true, text: 'Daily return' } },
          y: { title: { display: true, text: 'Number of days' } }
        },
        plugins: { tooltip: { callbacks: { title: it => `Return ≈ ${Number(it[0].label).toFixed(2)}%`, label: it => ` ${it.parsed.y} days` } } }
      }
    });
    const rows = [
      ['Estimation window', a.per.est, a.var, a.es, a.n, a.k],
      [a.covid.label, a.covid, a.covid.var, a.covid.es, a.covid.n, a.covid.k],
      [a.recent.label, a.recent, a.recent.var, a.recent.es, a.recent.n, a.recent.k]
    ];
    $('#var-table').innerHTML = `<thead><tr><th>Period</th><th>Dates</th><th class="n">Days (n)</th><th class="n">Tail days (k)</th><th class="n">VaR %</th><th class="n">VaR ₹</th><th class="n">ES %</th><th class="n">ES ₹</th></tr></thead><tbody>
      ${rows.map(([l, p, v, e, n, k]) => `<tr><td><b>${l}</b></td><td>${F.date(p.start)} to ${F.date(p.end)}</td><td class="n">${n}</td><td class="n">${k}</td><td class="n">${F.pct(v)}</td><td class="n">${F.inr(v * a.invest)}</td><td class="n">${F.pct(e)}</td><td class="n">${F.inr(e * a.invest)}</td></tr>`).join('')}</tbody>`;
  }

  /* ---------------------------------------------------------------- stress test */
  function renderStress() {
    const self = A, other = O;
    const PA = KEY === 'A' ? self : other, PB = KEY === 'A' ? other : self;
    const conf = F.conf(self.conf);
    const metrics = [
      ['Average daily return', p => p.perf.mean, x => F.spct(x, 3)],
      ['Daily volatility', p => p.perf.vol, x => F.pct(x, 3)],
      [`VaR ${conf} (1-day)`, p => p.var, x => F.pct(x)],
      [`ES ${conf} (1-day)`, p => p.es, x => F.pct(x)],
      ['Maximum drawdown', p => p.perf.mdd, x => F.pct(x, 2)]
    ];
    const head = `<thead><tr><th>Metric</th>
      <th class="n">${badge('A')} COVID-19</th><th class="n">${badge('B')} COVID-19</th>
      <th class="n">${badge('A')} Recent</th><th class="n">${badge('B')} Recent</th></tr></thead>`;
    const body = metrics.map(([l, get, fmt]) => `<tr><td>${l}</td>
      <td class="n">${fmt(get(PA.covid))}</td><td class="n">${fmt(get(PB.covid))}</td>
      <td class="n">${fmt(get(PA.recent))}</td><td class="n">${fmt(get(PB.recent))}</td></tr>`).join('');
    const invRow = `<tr><td>Rupee VaR / ES</td>
      <td class="n">${F.inr(PA.covid.var * PA.invest)} / ${F.inr(PA.covid.es * PA.invest)}</td><td class="n">${F.inr(PB.covid.var * PB.invest)} / ${F.inr(PB.covid.es * PB.invest)}</td>
      <td class="n">${F.inr(PA.recent.var * PA.invest)} / ${F.inr(PA.recent.es * PA.invest)}</td><td class="n">${F.inr(PB.recent.var * PB.invest)} / ${F.inr(PB.recent.es * PB.invest)}</td></tr>`;
    $('#tt-table').innerHTML = head + `<tbody>${body}${invRow}</tbody>`;
    const lg = `<span><i class="line sw-a"></i>Portfolio A</span><span><i class="line sw-b"></i>Portfolio B</span>`;
    $('#g-legend-1').innerHTML = lg; $('#g-legend-2').innerHTML = lg;
    $('#g-covid-title').textContent = `COVID-19: value of ${F.inrShort(self.invest)}, ${F.date(self.covid.start)} to ${F.date(self.covid.end)}`;
    $('#g-recent-title').textContent = `Recent: value of ${F.inrShort(self.invest)}, ${F.date(self.recent.start)} to ${F.date(self.recent.end)}`;
    growthChart('g-covid', PA.covid, PB.covid, self.invest);
    growthChart('g-recent', PA.recent, PB.recent, self.invest);
  }
  const badge = k => `<span class="badge ${k === 'A' ? 'a' : 'b'}" style="padding:2px 8px"><span class="sw sw-${k === 'A' ? 'a' : 'b'}"></span>${k}</span>`;

  function growthChart(id, pa, pb, invest) {
    const labels = [ds.dates[pa.days[0] - 1]].concat(pa.days.map(t => ds.dates[t]));
    PRD.chart(id, {
      type: 'line',
      data: {
        labels,
        datasets: [
          { label: 'Portfolio A', data: pa.perf.growth.map(g => g * invest), borderColor: PRD.color('--pa'), tension: 0.15 },
          { label: 'Portfolio B', data: pb.perf.growth.map(g => g * invest), borderColor: PRD.color('--pb'), tension: 0.15 }
        ]
      },
      plugins: [PRD.crosshair],
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: { ticks: { maxTicksLimit: 6, autoSkip: true, maxRotation: 0, callback: (v, i) => F.date(labels[i]).slice(-8) }, grid: { display: false } }, y: { ticks: { callback: v => F.inrShort(v) } } },
        plugins: { tooltip: { callbacks: { title: it => F.date(labels[it[0].dataIndex]), label: it => ` ${it.dataset.label}: ${F.inr(it.parsed.y)}` } } }
      }
    });
  }

  /* ---------------------------------------------------------------- weights by year */
  function renderYears() {
    const a = A, s = PRD.state.get();
    const ys = PRD.years(ds);
    const y1 = ys.includes(s.years.y1) ? s.years.y1 : ys[0], y2 = ys.includes(s.years.y2) ? s.years.y2 : ys[ys.length - 1];
    const R1 = PRD.yearAllocation(ds, a, y1), R2 = PRD.yearAllocation(ds, a, y2);
    const w = (R, i) => (R.res.ok ? F.pct(R.res.w[i]) : '—');
    const rows = a.tickers.map((t, i) => {
      const d = R1.res.ok && R2.res.ok ? R2.res.w[i] - R1.res.w[i] : null;
      return `<tr><td><b>${F.esc(t)}</b></td><td class="n">${w(R1, i)}</td><td class="n">${w(R2, i)}</td>
        <td class="n ${d == null ? '' : F.sign(d)}">${d == null ? '—' : F.spct(d)}</td></tr>`;
    }).join('');
    const vol = R => (R.res.ok ? F.pct(R.res.vol, 3) : '—');
    const turnover = R1.res.ok && R2.res.ok ? R1.res.w.reduce((acc, x, i) => acc + Math.abs(x - R2.res.w[i]), 0) / 2 : null;
    $('#yr-table').innerHTML = `<thead><tr><th>Stock</th><th class="n">${y1} weight</th><th class="n">${y2} weight</th><th class="n">Change</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr class="total"><td>Target daily return</td><td class="n">${R1.res.ok ? F.pct(R1.res.ret, 4) : '—'}</td><td class="n">${R2.res.ok ? F.pct(R2.res.ret, 4) : '—'}</td><td></td></tr>
        <tr class="total"><td>Daily volatility of this mix</td><td class="n">${vol(R1)}</td><td class="n">${vol(R2)}</td><td></td></tr>
        <tr class="total"><td>Trading days used</td><td class="n">${R1.n}</td><td class="n">${R2.n}</td><td></td></tr>
        <tr class="total"><td>Share of portfolio that moves</td><td class="n" colspan="2">${turnover == null ? '—' : F.pct(turnover, 1)}</td><td></td></tr>
      </tfoot>`;
    const notes = [R1, R2].filter(R => !R.res.ok).map(R => `<div class="alert warn"><b>${R.year}:</b> a ${(a.opt.target * 100).toFixed(4)}% daily return cannot be reached with ${R.year} data. With these stocks and a ${F.pct(a.opt.lo, 1)} minimum weight, ${R.year} returns allowed only ${(R.range.min * 100).toFixed(4)}% to ${(R.range.max * 100).toFixed(4)}% a day.</div>`);
    $('#yr-msg').innerHTML = notes.join('') + `<div class="source-line">Target daily return: ${(a.opt.target * 100).toFixed(4)}% (the same target used for the optimised weights above). Change = ${y2} weight − ${y1} weight.</div>`;
    const c1 = PRD.color(KEY === 'A' ? '--c4' : '--c3'), c2 = pcol(KEY);
    $('#yr-legend').innerHTML = `<span><i style="background:${c1}"></i>${y1}</span><span><i style="background:${c2}"></i>${y2}</span>`;
    PRD.chart('yr-chart', {
      type: 'bar',
      data: {
        labels: a.tickers,
        datasets: [
          { label: y1, data: R1.res.ok ? R1.res.w.map(x => x * 100) : a.tickers.map(() => null), backgroundColor: c1, borderRadius: 4 },
          { label: y2, data: R2.res.ok ? R2.res.w.map(x => x * 100) : a.tickers.map(() => null), backgroundColor: c2, borderRadius: 4 }
        ]
      },
      plugins: [PRD.barLabels(v => v.toFixed(1) + '%')],
      options: {
        indexAxis: 'y',
        layout: { padding: { right: 44 } },
        scales: { x: { ticks: { callback: v => +v.toFixed(3) + '%' }, beginAtZero: true }, y: { grid: { display: false }, ticks: { color: PRD.color('--text-2') } } },
        plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${it.parsed.x.toFixed(2)}%` } } }
      }
    });
  }

  /* ---------------------------------------------------------------- verdict */
  function renderVerdict() {
    const v = PRD.insights.portfolioVerdict(A, O);
    const cls = v.verdict === 'supported' || v.verdict === 'mostly supported' ? 'good' : v.verdict === 'mixed' ? 'warn' : 'bad';
    $('#verdict').innerHTML = `<div class="row" style="margin-bottom:10px"><span class="badge ${cls}">Classification ${v.verdict}</span>
      <span class="muted" style="font-size:13px">${v.selfMatches} of 8 period comparisons point the expected way</span></div>
      <ul class="text-2" style="padding-left:18px;margin:0">${v.bullets.map(b => `<li style="margin-bottom:6px">${F.esc(b)}</li>`).join('')}</ul>`;
  }
})();
