/* Overview (home) page. */
(function () {
  const { F, $, $$ } = PRD;
  let ds, A, B, metric = 'var';

  PRD.boot('overview', (data, root) => {
    ds = data;
    root.innerHTML = skeleton();
    bind();
    update();
  });

  function skeleton() {
    const s = PRD.state.get();
    const pcard = k => `
      <div class="card pf-card tint-${k.toLowerCase()}">
        <div class="top">
          <div>
            <div class="title"><span class="sq sw-${k.toLowerCase()}"></span><h2>Portfolio ${k}</h2><span class="badge ${k.toLowerCase()}">${k === 'A' ? 'High Risk' : 'Low Risk'}</span></div>
            <div class="muted" style="font-size:13px;margin-top:4px" id="mode-${k}"></div>
          </div>
          <a class="btn sm" href="portfolio-${k.toLowerCase()}.html">Full analysis →</a>
        </div>
        <label class="field" style="margin-top:14px;max-width:280px">Investment amount
          <div class="input-money"><span>₹</span><input class="input inv" data-k="${k}" inputmode="numeric" value="${Number(s.invest[k]).toLocaleString('en-IN')}"></div></label>
        <div class="field-err" id="inv-err-${k}"></div>
        <div class="kpis" id="kpis-${k}"></div>
        <div class="chips" style="margin-top:14px" id="chips-${k}"></div>
      </div>`;
    return `
    <div class="page-head">
      <div>
        <div class="eyebrow">Overview</div>
        <h1>Portfolio Risk Dashboard</h1>
        <div id="banner"></div>
      </div>
      <div class="hero-actions">
        <a class="btn primary" href="data.html">View Data</a>
        <a class="btn" href="stocks.html">Stock selection</a>
      </div>
    </div>

    <div class="kpis" id="strip"></div>

    <div class="grid g-2" style="margin-top:18px">${pcard('A')}${pcard('B')}</div>

    <div class="grid g-12" style="margin-top:18px">
      <div class="card span-8">
        <div class="card-head"><div><h2>Growth of each investment</h2><div class="sub" id="growth-sub"></div></div></div>
        <div class="legend"><span><i class="line sw-a"></i>Portfolio A</span><span><i class="line sw-b"></i>Portfolio B</span><span><i style="background:var(--bad-soft);border:1px solid var(--bad)"></i>COVID-19 window</span><span><i style="background:var(--accent-soft);border:1px solid var(--accent-text)"></i>Recent window</span></div>
        <div class="chart tall"><canvas id="growth" role="img" aria-label="Value of both portfolios over time"></canvas></div>
      </div>
      <div class="card span-4">
        <div class="card-head"><div><h2>COVID-19 vs recent</h2><div class="sub">Same weights, two periods</div></div></div>
        <div class="seg" id="metric">
          <button data-m="mean">Avg daily return</button><button data-m="vol">Volatility</button><button data-m="var">VaR</button><button data-m="es">ES</button>
        </div>
        <div class="legend" style="margin-top:12px"><span><i class="sw-a"></i>Portfolio A</span><span><i class="sw-b"></i>Portfolio B</span></div>
        <div class="chart short"><canvas id="cmp" role="img" aria-label="Comparison of the two portfolios in the COVID and recent periods"></canvas></div>
        <div class="table-wrap" style="margin-top:12px"><table class="t" id="cmp-values"></table></div>
        <div class="source-line" id="cmp-note"></div>
      </div>
    </div>

    <div class="card" style="margin-top:18px">
      <div class="card-head"><div><h2>Stress-test scoreboard</h2><div class="sub" id="score-sub"></div></div><a class="btn sm" href="methodology.html">Methodology</a></div>
      <div class="table-wrap"><table class="t" id="score"></table></div>
    </div>
`;
  }

  function bind() {
    $$('.inv').forEach(inp => {
      inp.addEventListener('input', PRD.debounce(() => {
        const k = inp.dataset.k, v = Number(inp.value.replace(/[,₹\s]/g, ''));
        if (!isFinite(v) || v <= 0 || v > 1e12) { inp.classList.add('invalid'); $('#inv-err-' + k).textContent = 'Enter a positive rupee amount.'; return; }
        inp.classList.remove('invalid'); $('#inv-err-' + k).textContent = '';
        PRD.state.update(s => { s.invest[k] = v; });
        update();
      }, 250));
      inp.addEventListener('blur', () => { inp.value = Number(PRD.state.get().invest[inp.dataset.k]).toLocaleString('en-IN'); });
    });
    $$('#metric button').forEach(b => b.addEventListener('click', () => { metric = b.dataset.m; renderCmp(); }));
  }

  function update() {
    A = PRD.analyse(ds, 'A');
    B = PRD.analyse(ds, 'B');
    $('#banner').innerHTML = PRD.dataBanner(ds);
    $('#strip').innerHTML = [
      ['Stocks analysed', ds.tickers.length, 'NIFTY 50 members, no splits/bonuses'],
      ['Trading days', ds.dates.length.toLocaleString('en-IN'), `${F.date(ds.first)} to ${F.date(ds.last)}`],
      ['Price observations', (ds.dates.length * ds.tickers.length).toLocaleString('en-IN'), ds.missing ? `${ds.missing} missing cells` : 'no missing cells'],
      ['Total invested', F.inr(A.invest + B.invest), '₹ amounts are editable'],
      ['Confidence level', F.conf(A.conf), 'change it on a portfolio page']
    ].map(([l, v, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
    for (const P of [A, B]) {
      const k = P.key;
      $('#mode-' + k).textContent = `${P.tickers.length} stocks · ${P.mode === 'custom' ? 'custom weights' : 'Markowitz optimised weights'}`;
      $('#kpis-' + k).innerHTML = [
        ['Avg daily return', F.pct(P.point.ret, 4), 'mean of daily returns'],
        ['Daily volatility', F.pct(P.point.vol, 3), 'std. dev. of daily returns'],
        ['Beta', F.num(P.beta, 2), ds.benchmark.kind === 'nifty' ? 'vs NIFTY 50' : 'vs 21-stock proxy'],
        [`VaR ${F.conf(P.conf)} (1-day)`, F.inr(P.var * P.invest), F.pct(P.var)],
        [`ES ${F.conf(P.conf)} (1-day)`, F.inr(P.es * P.invest), F.pct(P.es)],
        ['Max drawdown', F.pct(P.perf.mdd, 1), 'estimation window']
      ].map(([l, v, s]) => `<div class="kpi"><div class="l">${l}</div><div class="v">${v}</div><div class="s">${s}</div></div>`).join('');
      $('#chips-' + k).innerHTML = P.tickers.map((t, i) => `<span class="chip">${F.esc(t)} · ${F.pct(P.w[i], 1)}</span>`).join('');
    }
    renderGrowth(); renderCmp(); renderScore();
  }

  function renderGrowth() {
    const days = A.days;
    const labels = [ds.dates[days[0] - 1]].concat(days.map(t => ds.dates[t]));
    const per = A.per;
    const shade = {
      id: 'shade', beforeDatasetsDraw(chart) {
        const xs = chart.scales.x, { top, bottom } = chart.chartArea, ctx = chart.ctx;
        const band = (s, e, fill) => {
          const i0 = labels.findIndex(d => d >= s); let i1 = -1;
          for (let i = labels.length - 1; i >= 0; i--) if (labels[i] <= e) { i1 = i; break; }
          if (i0 < 0 || i1 < i0) return;
          ctx.fillStyle = fill; ctx.fillRect(xs.getPixelForValue(i0), top, xs.getPixelForValue(i1) - xs.getPixelForValue(i0), bottom - top);
        };
        ctx.save(); band(per.covid.start, per.covid.end, PRD.color('--bad-soft')); band(per.recent.start, per.recent.end, PRD.color('--accent-soft')); ctx.restore();
      }
    };
    $('#growth-sub').textContent = `Value of ${F.inrShort(A.invest)} (A) and ${F.inrShort(B.invest)} (B) with today's weights held constant, ${F.date(labels[0])} to ${F.date(labels[labels.length - 1])}. Price returns only. The optimised weights were estimated on this same window, so the full-period path is in-sample; the two shaded windows are the stress tests.`;
    PRD.chart('growth', {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Portfolio A', data: A.perf.growth.map(g => g * A.invest), borderColor: PRD.color('--pa') },
        { label: 'Portfolio B', data: B.perf.growth.map(g => g * B.invest), borderColor: PRD.color('--pb') }
      ] },
      plugins: [shade, PRD.crosshair],
      options: {
        interaction: { mode: 'index', intersect: false },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i === 0 || labels[i].slice(0, 4) !== labels[i - 1].slice(0, 4) ? labels[i].slice(0, 4) : null) } }, y: { ticks: { callback: v => F.inrShort(v) } } },
        plugins: { tooltip: { callbacks: { title: it => F.date(labels[it[0].dataIndex]), label: it => ` ${it.dataset.label}: ${F.inr(it.parsed.y)}` } } }
      }
    });
  }

  const METRICS = {
    mean: { l: 'Average daily return', get: p => p.perf.mean, note: 'Mean of the daily portfolio returns in the period; higher is better.' },
    vol: { l: 'Daily volatility', get: p => p.perf.vol, note: 'Higher = riskier.' },
    var: { l: 'VaR', get: p => p.var, note: 'One-day loss threshold; higher = riskier.' },
    es: { l: 'Expected Shortfall', get: p => p.es, note: 'Average loss beyond VaR; higher = riskier.' }
  };
  function renderCmp() {
    $$('#metric button').forEach(b => b.classList.toggle('on', b.dataset.m === metric));
    const m = METRICS[metric];
    const labels = ['COVID-19', 'Recent'];
    PRD.chart('cmp', {
      type: 'bar',
      data: { labels, datasets: [
        { label: 'Portfolio A', data: [m.get(A.covid), m.get(A.recent)].map(x => x * 100), backgroundColor: PRD.color('--pa'), borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.6 },
        { label: 'Portfolio B', data: [m.get(B.covid), m.get(B.recent)].map(x => x * 100), backgroundColor: PRD.color('--pb'), borderRadius: 4, barPercentage: 0.8, categoryPercentage: 0.6 }
      ] },
      plugins: [PRD.barLabels(v => (metric === 'mean' && v > 0 ? '+' : '') + v.toFixed(metric === 'mean' || metric === 'vol' ? 3 : 2) + '%')],
      options: {
        layout: { padding: { top: 18 } },
        scales: { y: { ticks: { callback: v => +v.toFixed(3) + '%' }, grace: '12%' }, x: { grid: { display: false } } },
        plugins: { tooltip: { callbacks: { label: it => ` ${it.dataset.label}: ${it.parsed.y.toFixed(metric === 'mean' || metric === 'vol' ? 3 : 2)}%` } } }
      }
    });
    const fmt = x => (metric === 'mean' ? F.spct(x, 3) : F.pct(x, metric === 'vol' ? 3 : 2));
    $('#cmp-values').innerHTML = `<thead><tr><th>${m.l}</th><th class="n">COVID-19</th><th class="n">Recent</th></tr></thead><tbody>
      <tr><td><span class="badge a" style="padding:2px 8px"><span class="sw sw-a"></span>A</span></td><td class="n">${fmt(m.get(A.covid))}</td><td class="n">${fmt(m.get(A.recent))}</td></tr>
      <tr><td><span class="badge b" style="padding:2px 8px"><span class="sw sw-b"></span>B</span></td><td class="n">${fmt(m.get(B.covid))}</td><td class="n">${fmt(m.get(B.recent))}</td></tr></tbody>`;
    $('#cmp-note').textContent = `${m.l}${metric === 'var' || metric === 'es' ? ` at ${F.conf(A.conf)} confidence` : ''}. ${m.note}`;
  }

  function renderScore() {
    const conf = F.conf(A.conf);
    const rows = [
      ['Average daily return', p => p.perf.mean, x => F.spct(x, 3)],
      ['Daily volatility', p => p.perf.vol, x => F.pct(x, 3)],
      [`VaR ${conf}`, p => p.var, x => F.pct(x)],
      [`Expected Shortfall ${conf}`, p => p.es, x => F.pct(x)],
      ['Maximum drawdown', p => p.perf.mdd, x => F.pct(x, 2)]
    ];
    const bdg = k => `<span class="badge ${k.toLowerCase()}" style="padding:2px 8px"><span class="sw sw-${k.toLowerCase()}"></span>${k}</span>`;
    $('#score-sub').textContent = `COVID-19: ${F.date(A.covid.start)} to ${F.date(A.covid.end)} (${A.covid.n} trading-day returns). Recent: ${F.date(A.recent.start)} to ${F.date(A.recent.end)} (${A.recent.n} trading-day returns). Counts are trading days only: the market is closed on weekends and exchange holidays, so a year has about 250 of them. Dates are adjustable on either portfolio page.`;
    $('#score').innerHTML = `<thead><tr><th>Metric</th><th class="n">${bdg('A')} COVID-19</th><th class="n">${bdg('B')} COVID-19</th><th class="n">${bdg('A')} Recent</th><th class="n">${bdg('B')} Recent</th></tr></thead>
      <tbody>${rows.map(([l, g, f]) => `<tr><td>${l}</td><td class="n">${f(g(A.covid))}</td><td class="n">${f(g(B.covid))}</td><td class="n">${f(g(A.recent))}</td><td class="n">${f(g(B.recent))}</td></tr>`).join('')}
      <tr><td>Rupee VaR / ES</td><td class="n">${F.inr(A.covid.var * A.invest)} / ${F.inr(A.covid.es * A.invest)}</td><td class="n">${F.inr(B.covid.var * B.invest)} / ${F.inr(B.covid.es * B.invest)}</td><td class="n">${F.inr(A.recent.var * A.invest)} / ${F.inr(A.recent.es * A.invest)}</td><td class="n">${F.inr(B.recent.var * B.invest)} / ${F.inr(B.recent.es * B.invest)}</td></tr></tbody>`;
  }

})();
