/* Statistics: returns windows, sample moments, historical VaR / ES, drawdowns, stock selection. */
window.PRD = window.PRD || {};

(function () {
  const TD = 252; // trading days per year used for annualising

  /* Return indices t (return from dates[t-1] to dates[t]) whose BOTH prices lie inside [start, end].
     So a period's cumulative return equals P(last date in window) / P(first date in window) - 1. */
  function windowIdx(ds, start, end) {
    const s = start || ds.first, e = end || ds.last, out = [];
    for (let t = 1; t < ds.dates.length; t++) {
      if (ds.dates[t - 1] >= s && ds.dates[t] <= e) out.push(t);
    }
    return out;
  }

  const mean = a => { let s = 0; for (const x of a) s += x; return a.length ? s / a.length : NaN; };
  function sampleVar(a, m) {
    if (a.length < 2) return NaN;
    m = m == null ? mean(a) : m;
    let s = 0; for (const x of a) s += (x - m) * (x - m);
    return s / (a.length - 1);
  }
  function sampleCov(a, b) {
    const ma = mean(a), mb = mean(b); let s = 0;
    for (let i = 0; i < a.length; i++) s += (a[i] - ma) * (b[i] - mb);
    return s / (a.length - 1);
  }

  /* Historical simulation. Losses are L = -r. Sort returns ascending; k = ceil(n * (1 - c)).
     VaR = -(k-th worst return): the loss threshold exceeded on (1-c) of days.
     ES  = -(average of the k worst returns): the average loss on those tail days. */
  function histVaR(returns, c) {
    const n = returns.length;
    if (!n) return { var: NaN, es: NaN, k: 0, n: 0 };
    const sorted = Array.from(returns).sort((x, y) => x - y);
    const k = Math.min(n, Math.max(1, Math.ceil(n * (1 - c) - 1e-9)));
    let s = 0; for (let i = 0; i < k; i++) s += sorted[i];
    return { var: -sorted[k - 1], es: -s / k, k, n, threshold: sorted[k - 1], sorted };
  }

  /* Performance summary of a daily return series (compounded). */
  function perf(returns) {
    const n = returns.length;
    let v = 1, peak = 1, mdd = 0, troughAt = 0, peakAt = 0, curPeakAt = 0;
    const growth = [1], dd = [0];
    for (let i = 0; i < n; i++) {
      v *= 1 + returns[i];
      if (v > peak) { peak = v; curPeakAt = i + 1; }
      const d = v / peak - 1;
      if (d < mdd) { mdd = d; troughAt = i + 1; peakAt = curPeakAt; }
      growth.push(v); dd.push(d);
    }
    const m = mean(returns), varr = sampleVar(returns, m);
    return {
      n, cum: v - 1, mean: m, variance: varr, vol: Math.sqrt(varr),
      annReturn: m * TD, annVol: Math.sqrt(varr * TD),
      mdd, mddPeak: peakAt, mddTrough: troughAt, growth, dd
    };
  }

  /* Aligned return matrix for a set of tickers over window indices: drops any day where one is missing. */
  function matrix(ds, tickers, idx) {
    const cols = tickers.map(t => ds.index[t]);
    const rows = [], days = [];
    let dropped = 0;
    for (const t of idx) {
      const r = ds.returns[t];
      const row = cols.map(c => r[c]);
      if (row.some(x => isNaN(x))) { dropped++; continue; }
      rows.push(row); days.push(t);
    }
    return { rows, days, dropped };
  }

  /* Sample mean vector and sample covariance matrix (n-1), in the SAME order as `tickers`. */
  function moments(ds, tickers, idx) {
    const { rows, days, dropped } = matrix(ds, tickers, idx);
    const n = rows.length, N = tickers.length;
    const mu = new Array(N).fill(0);
    for (const r of rows) for (let i = 0; i < N; i++) mu[i] += r[i];
    for (let i = 0; i < N; i++) mu[i] /= n;
    const cov = Array.from({ length: N }, () => new Array(N).fill(0));
    for (const r of rows) {
      for (let i = 0; i < N; i++) {
        const di = r[i] - mu[i];
        for (let j = i; j < N; j++) cov[i][j] += di * (r[j] - mu[j]);
      }
    }
    for (let i = 0; i < N; i++) for (let j = i; j < N; j++) { cov[i][j] /= n - 1; cov[j][i] = cov[i][j]; }
    return { tickers: tickers.slice(), mu, cov, n, rows, days, dropped };
  }

  const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
  function quad(w, S) {
    let s = 0;
    for (let i = 0; i < w.length; i++) for (let j = 0; j < w.length; j++) s += w[i] * S[i][j] * w[j];
    return s;
  }

  /* Portfolio daily returns with constant weights (rebalanced daily): r_p,t = sum_i w_i r_i,t. */
  function portfolioReturns(ds, tickers, w, idx) {
    const { rows, days, dropped } = matrix(ds, tickers, idx);
    return { r: rows.map(row => dot(row, w)), days, dropped };
  }

  /* Per-stock statistics over a window, including beta against the benchmark. */
  function stockStats(ds, idx, conf) {
    const bench = ds.benchmark;
    return ds.tickers.map((t, i) => {
      const r = [], rb = [], rbAll = [];
      for (const k of idx) {
        const x = ds.returns[k][i];
        if (isNaN(x)) continue;
        r.push(x);
        const b = bench.returns[k];
        if (!isNaN(b)) { rb.push(b); rbAll.push(x); }
      }
      const m = mean(r), v = sampleVar(r, m);
      const beta = rb.length > 30 ? sampleCov(rbAll, rb) / sampleVar(rb) : NaN;
      const hv = histVaR(r, conf);
      const p = perf(r);
      return {
        ticker: t, n: r.length, mean: m, variance: v, vol: Math.sqrt(v),
        annReturn: m * TD, annVol: Math.sqrt(v * TD), beta, betaN: rb.length,
        var: hv.var, es: hv.es, cum: p.cum, mdd: p.mdd, r
      };
    });
  }

  /* Ranks: 1 = lowest value, ties share the average rank. */
  function ranks(values) {
    const order = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const out = new Array(values.length);
    for (let i = 0; i < order.length;) {
      let j = i; while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j++;
      for (let k = i; k <= j; k++) out[order[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return out;
  }

  /* Transparent selection rule: risk score = average of the ranks of daily volatility, beta and
     95% historical VaR (rank 1 = least risky). Top 10 scores -> Portfolio A, bottom 10 -> Portfolio B. */
  function selection(stats, size) {
    size = size || 10;
    const hasBeta = stats.every(s => isFinite(s.beta));
    const rv = ranks(stats.map(s => s.vol));
    const rb = hasBeta ? ranks(stats.map(s => s.beta)) : null;
    const rq = ranks(stats.map(s => s.var));
    const scored = stats.map((s, i) => {
      const parts = [rv[i], rq[i]].concat(hasBeta ? [rb[i]] : []);
      return { ticker: s.ticker, rVol: rv[i], rBeta: hasBeta ? rb[i] : null, rVar: rq[i], score: mean(parts) };
    });
    const order = scored.slice().sort((a, b) => b.score - a.score || b.rVol - a.rVol || a.ticker.localeCompare(b.ticker));
    order.forEach((s, i) => { s.position = i + 1; });
    const n = stats.length, m = Math.min(size, Math.floor(n / 2));
    const A = order.slice(0, m).map(s => s.ticker);
    const B = order.slice(n - m).map(s => s.ticker);
    return { scored: Object.fromEntries(scored.map(s => [s.ticker, s])), order, A, B, hasBeta };
  }

  PRD.TD = TD;
  PRD.stats = { windowIdx, mean, sampleVar, sampleCov, histVaR, perf, matrix, moments, dot, quad, portfolioReturns, stockStats, ranks, selection };
})();
