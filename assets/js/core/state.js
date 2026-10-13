/* User settings (persisted in this browser) and the portfolio engine shared by every page. */
window.PRD = window.PRD || {};

(function () {
  const KEY = 'prd_state_v2';
  const DEFAULTS = {
    invest: { A: 1500000, B: 1500000 },
    members: null,                      // null = use the automatic risk-score suggestion
    mode: { A: 'optimised', B: 'optimised' },
    custom: { A: null, B: null },       // { TICKER: weightPercent }
    conf: 0.95,
    bounds: { A: { min: 0.01, max: 1 }, B: { min: 0.01, max: 1 } }, // min weight per stock; no cap, no short selling
    est: { start: null, end: null },    // estimation window; null = full dataset
    covid: { start: '2020-01-01', end: '2020-12-31' }, // stress period: calendar year 2020
    recent: { start: null, end: null }, // null = latest one-year window in the data
    target: { A: null, B: null },       // target DAILY return for the Markowitz optimisation; null = equal-weight return
    years: { y1: '2020', y2: '2025' }   // years compared in the allocation-by-year table
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  let mem = null;

  function load() {
    if (mem) return mem;
    let saved = null;
    try { saved = JSON.parse(window.localStorage.getItem(KEY)); } catch (e) { saved = null; }
    mem = clone(DEFAULTS);
    if (saved && typeof saved === 'object') {
      for (const k of Object.keys(DEFAULTS)) if (saved[k] !== undefined) mem[k] = saved[k];
      // the old default stress window (1 Feb to 31 Dec 2020) moves to the new one-year default
      if (mem.covid && mem.covid.start === '2020-02-01' && mem.covid.end === '2020-12-31') mem.covid = clone(DEFAULTS.covid);
    }
    return mem;
  }
  function save() { try { window.localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { /* private mode: keep in memory */ } }

  PRD.state = {
    get: load,
    set(patch) { load(); Object.assign(mem, patch); save(); },
    update(fn) { load(); fn(mem); save(); },
    reset() { mem = clone(DEFAULTS); save(); },
    defaults: () => clone(DEFAULTS)
  };
  window.addEventListener('storage', e => { if (e.key === KEY) mem = null; });

  /* ---------- periods ---------- */
  function minusYear(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number);
    const dt = new Date(Date.UTC(y - 1, m - 1, d));
    if (dt.getUTCMonth() !== m - 1) dt.setUTCDate(0); // 29 Feb -> 28 Feb
    return dt.toISOString().slice(0, 10);
  }
  PRD.periods = function (ds) {
    const s = load();
    const recentEnd = s.recent.end || ds.last;
    const recentStart = s.recent.start || ds.dates.find(d => d > minusYear(recentEnd)) || ds.first;
    return {
      est: { start: s.est.start || ds.first, end: s.est.end || ds.last, label: 'Estimation window' },
      covid: { start: s.covid.start, end: s.covid.end, label: 'COVID-19 period' },
      recent: { start: recentStart, end: recentEnd, label: 'Recent period' }
    };
  };

  /* ---------- stock selection ---------- */
  PRD.selection = function (ds) {
    const p = PRD.periods(ds);
    const idx = PRD.stats.windowIdx(ds, p.est.start, p.est.end);
    const stats = PRD.stats.stockStats(ds, idx, 0.95);
    const sel = PRD.stats.selection(stats, 10);
    return { stats, sel, idx };
  };
  PRD.members = function (ds) {
    const s = load();
    const auto = PRD.selection(ds).sel;
    let A = auto.A, B = auto.B, custom = false;
    if (s.members && Array.isArray(s.members.A) && Array.isArray(s.members.B)) {
      const okA = s.members.A.filter(t => ds.index[t] != null);
      const okB = s.members.B.filter(t => ds.index[t] != null && !okA.includes(t));
      if (okA.length >= 2 && okB.length >= 2) { A = okA; B = okB; custom = true; }
    }
    return { A, B, custom, auto };
  };

  /* ---------- weights ---------- */
  PRD.customWeightsValid = function (tickers, map) {
    if (!map) return { ok: false, msg: 'No custom weights entered yet.' };
    let tot = 0;
    for (const t of tickers) {
      const v = Number(map[t]);
      if (!isFinite(v)) return { ok: false, msg: `Weight for ${t} is not a number.` };
      if (v < 0) return { ok: false, msg: `Weight for ${t} is negative; this dashboard is long-only.` };
      tot += v;
    }
    if (Math.abs(tot - 100) > 0.01) return { ok: false, msg: `Weights add up to ${tot.toFixed(2)}%. They must total exactly 100%.`, total: tot };
    return { ok: true, total: tot };
  };

  /* Full analysis of one portfolio ('A' or 'B'). Everything uses the same stock order `tickers`. */
  PRD.analyse = function (ds, key, opts) {
    opts = opts || {};
    const s = load();
    const mem = PRD.members(ds);
    const tickers = mem[key];
    const per = PRD.periods(ds);
    const conf = opts.conf || s.conf;
    const bnd = s.bounds[key] || DEFAULTS.bounds[key];

    const estIdx = PRD.stats.windowIdx(ds, per.est.start, per.est.end);
    const est = PRD.stats.moments(ds, tickers, estIdx);
    // Markowitz: minimum-variance weights for a target daily return (default = equal-weight portfolio's return)
    const eqTarget = est.mu.reduce((a, x) => a + x, 0) / est.mu.length;
    const range = PRD.opt.feasibleRange(est.mu, PRD.opt.effectiveBounds(tickers.length, bnd.min, bnd.max).lo, PRD.opt.effectiveBounds(tickers.length, bnd.min, bnd.max).hi);
    let target = s.target[key] != null ? s.target[key] : eqTarget, targetNote = null;
    if (target > range.max) { targetNote = `The chosen target is above the highest reachable return (${(range.max * 100).toFixed(4)}% a day), so the highest reachable return is used.`; target = range.max; }
    if (target < range.min) { targetNote = `The chosen target is below the lowest reachable return (${(range.min * 100).toFixed(4)}% a day), so the lowest reachable return is used.`; target = range.min; }
    const opt = PRD.opt.minVariance(est.cov, est.mu, target, bnd.min, bnd.max);
    opt.target = target; opt.eqTarget = eqTarget; opt.range = range; opt.targetNote = targetNote; opt.isDefaultTarget = s.target[key] == null;

    let mode = s.mode[key] || 'optimised';
    let w = opt.ok ? opt.w : tickers.map(() => 1 / tickers.length);
    let customState = null;
    if (mode === 'custom') {
      customState = PRD.customWeightsValid(tickers, s.custom[key]);
      if (customState.ok) w = tickers.map(t => Number(s.custom[key][t]) / 100);
      else mode = 'optimised';
    }
    const pt = PRD.opt.point(est.cov, est.mu, w);
    const pr = PRD.stats.portfolioReturns(ds, tickers, w, estIdx);
    const perfFull = PRD.stats.perf(pr.r);
    const hv = PRD.stats.histVaR(pr.r, conf);

    // beta of the portfolio = weighted sum of stock betas (same benchmark, same window)
    const sstats = PRD.stats.stockStats(ds, estIdx, conf);
    const byT = Object.fromEntries(sstats.map(x => [x.ticker, x]));
    const beta = tickers.reduce((a, t, i) => a + w[i] * byT[t].beta, 0);

    const period = name => {
      const idx = PRD.stats.windowIdx(ds, per[name].start, per[name].end);
      const r = PRD.stats.portfolioReturns(ds, tickers, w, idx);
      const pf = PRD.stats.perf(r.r);
      const v = PRD.stats.histVaR(r.r, conf);
      return Object.assign({}, per[name], { idx, r: r.r, days: r.days, perf: pf, var: v.var, es: v.es, k: v.k, n: v.n });
    };

    return {
      key, label: key === 'A' ? 'Portfolio A' : 'Portfolio B', risk: key === 'A' ? 'High Risk' : 'Low Risk',
      tickers, w, mode, requestedMode: s.mode[key] || 'optimised', customState, opt, bounds: bnd,
      invest: Number(s.invest[key]) || 0, conf,
      est, estIdx, per, point: pt,
      annRet: pt.ret * PRD.TD, annVol: pt.vol * Math.sqrt(PRD.TD),
      returns: pr.r, days: pr.days, perf: perfFull, var: hv.var, es: hv.es, k: hv.k, n: hv.n,
      beta, stockStats: byT,
      covid: period('covid'), recent: period('recent')
    };
  };

  /* Allocation by year: minimum-variance weights for the same target return, estimated from one calendar year at a time. */
  PRD.years = function (ds) {
    const ys = [...new Set(ds.dates.map(d => d.slice(0, 4)))];
    return ys.filter(y => PRD.stats.windowIdx(ds, y + '-01-01', y + '-12-31').length >= 30);
  };
  PRD.yearAllocation = function (ds, a, year) {
    const start = year + '-01-01', end = year + '-12-31';
    const idx = PRD.stats.windowIdx(ds, start, end);
    const m = PRD.stats.moments(ds, a.tickers, idx);
    const res = PRD.opt.minVariance(m.cov, m.mu, a.opt.target, a.bounds.min, a.bounds.max);
    const range = PRD.opt.feasibleRange(m.mu, res.lo, res.hi);
    const first = ds.dates[idx[0] - 1], last = ds.dates[idx[idx.length - 1]];
    return { year, m, res, range, n: m.n, first, last, current: PRD.opt.point(m.cov, m.mu, a.w) };
  };
})();
