/* Markowitz mean-variance optimisation with long-only box constraints, solved as a quadratic
 * program (Goldfarb-Idnani dual method via the bundled quadprog library).
 *   minimise  w' S w   subject to  sum(w) = 1,  mu' w = target (optional),  lo <= w_i <= hi
 */
window.PRD = window.PRD || {};

(function () {
  const SCALE = 1e4;   // daily covariances are ~1e-4; rescale for numerical conditioning
  const MU_SCALE = 1e3;
  const EPS = 1e-10;

  /* Bounds actually used: widened if the requested ones cannot sum to 100%. */
  function effectiveBounds(n, lo, hi) {
    const notes = [];
    let l = lo, h = hi;
    if (n * l > 1 + 1e-12) { l = 1 / n; notes.push(`Minimum weight lowered to ${(l * 100).toFixed(2)}% because ${n} x ${(lo * 100).toFixed(1)}% exceeds 100%.`); }
    if (n * h < 1 - 1e-12) { h = 1 / n; notes.push(`Maximum weight raised to ${(h * 100).toFixed(2)}% because ${n} x ${(hi * 100).toFixed(1)}% is below 100%.`); }
    return { lo: l, hi: h, notes };
  }

  /* Highest / lowest achievable mu'w under sum(w)=1 and box bounds (greedy is exact for this LP). */
  function feasibleRange(mu, lo, hi) {
    const n = mu.length;
    const fill = order => {
      const w = new Array(n).fill(lo);
      let left = 1 - n * lo;
      for (const i of order) { const add = Math.min(hi - lo, left); w[i] += add; left -= add; if (left <= 0) break; }
      return w;
    };
    const idx = mu.map((_, i) => i);
    const wMax = fill(idx.slice().sort((a, b) => mu[b] - mu[a]));
    const wMin = fill(idx.slice().sort((a, b) => mu[a] - mu[b]));
    return { min: PRD.stats.dot(mu, wMin), max: PRD.stats.dot(mu, wMax), wMin, wMax };
  }

  function solve(cov, mu, target, lo, hi) {
    const n = cov.length;
    let tr = 0; for (let i = 0; i < n; i++) tr += cov[i][i];
    const ridge = (tr / n) * 1e-9;
    const D = [null], d = [null];
    for (let i = 0; i < n; i++) {
      const row = [null];
      for (let j = 0; j < n; j++) row.push(cov[i][j] * SCALE + (i === j ? ridge * SCALE : 0));
      D.push(row); d.push(0);
    }
    // Constraint columns: [sum=1] [mu=target]? [w>=lo]*n [-w>=-hi]*n
    const cons = [], b = [];
    cons.push(new Array(n).fill(1)); b.push(1);
    let meq = 1;
    if (target != null) { cons.push(mu.map(x => x * MU_SCALE)); b.push(target * MU_SCALE); meq = 2; }
    for (let i = 0; i < n; i++) { const c = new Array(n).fill(0); c[i] = 1; cons.push(c); b.push(lo); }
    for (let i = 0; i < n; i++) { const c = new Array(n).fill(0); c[i] = -1; cons.push(c); b.push(-hi); }
    const A = [null];
    for (let i = 0; i < n; i++) { const row = [null]; for (const c of cons) row.push(c[i]); A.push(row); }
    const bvec = [null].concat(b);
    const res = window.quadprog.solveQP(D, d, A, bvec, meq);
    if (res.message) return { ok: false, msg: res.message };
    const w = res.solution.slice(1).map(x => Math.min(hi, Math.max(lo, x)));
    const s = w.reduce((a, x) => a + x, 0);
    for (let i = 0; i < n; i++) w[i] /= s;
    return { ok: true, w };
  }

  function point(cov, mu, w) {
    const ret = PRD.stats.dot(mu, w), variance = PRD.stats.quad(w, cov);
    return { w, ret, variance, vol: Math.sqrt(variance) };
  }

  /* Minimum-variance weights for a target daily return. Explains infeasibility instead of guessing. */
  function minVariance(cov, mu, target, lo0, hi0) {
    const n = mu.length;
    const { lo, hi, notes } = effectiveBounds(n, lo0, hi0);
    if (target != null) {
      const fr = feasibleRange(mu, lo, hi);
      const tol = 1e-12 + 1e-9 * Math.abs(target);
      if (target > fr.max + tol || target < fr.min - tol) {
        return {
          ok: false, infeasible: true, range: fr, lo, hi, notes,
          reason: target > fr.max
            ? `The target daily return ${(target * 100).toFixed(4)}% is higher than the best return any long-only mix can reach with these estimates (${(fr.max * 100).toFixed(4)}% per day, with weights between ${(lo * 100).toFixed(1)}% and ${(hi * 100).toFixed(1)}%).`
            : `The target daily return ${(target * 100).toFixed(4)}% is lower than the worst return any allowed mix produces with these estimates (${(fr.min * 100).toFixed(4)}% per day).`
        };
      }
      target = Math.min(fr.max, Math.max(fr.min, target));
      // at the edge of the reachable range only one mix is feasible: the greedy corner
      const edge = 1e-12 + 1e-9 * Math.abs(target);
      if (target >= fr.max - edge) return Object.assign({ ok: true, lo, hi, notes, corner: true }, point(cov, mu, fr.wMax));
      if (target <= fr.min + edge) return Object.assign({ ok: true, lo, hi, notes, corner: true }, point(cov, mu, fr.wMin));
    }
    const s = solve(cov, mu, target, lo, hi);
    if (!s.ok) return { ok: false, reason: `The optimiser could not find a solution (${s.msg}).`, lo, hi, notes };
    return Object.assign({ ok: true, lo, hi, notes }, point(cov, mu, s.w));
  }

  /* Efficient frontier: from the global minimum-variance portfolio up to the maximum feasible return. */
  function frontier(cov, mu, lo0, hi0, steps) {
    steps = steps || 40;
    const n = mu.length;
    const { lo, hi } = effectiveBounds(n, lo0, hi0);
    const gmv = minVariance(cov, mu, null, lo, hi);
    const fr = feasibleRange(mu, lo, hi);
    const pts = [];
    if (!gmv.ok) return { ok: false, pts, gmv, range: fr };
    const a = gmv.ret, b = fr.max;
    for (let k = 0; k <= steps; k++) {
      const t = a + (b - a) * (k / steps);
      const p = minVariance(cov, mu, t, lo, hi);
      if (p.ok) pts.push(p);
    }
    // inefficient lower branch (for drawing the full hyperbola-like curve)
    const lower = [];
    for (let k = 1; k <= Math.round(steps / 3); k++) {
      const t = a - (a - fr.min) * (k / Math.round(steps / 3));
      const p = minVariance(cov, mu, t, lo, hi);
      if (p.ok) lower.push(p);
    }
    return { ok: true, pts, lower: lower.reverse(), gmv, range: fr, lo, hi };
  }

  /* Deterministic random long-only portfolios (uniform on the simplex) for the frontier cloud. */
  function randomPortfolios(cov, mu, count, seed) {
    let s = seed || 42;
    const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return (s + 0.5) / 4294967296; };
    const n = mu.length, out = [];
    for (let k = 0; k < count; k++) {
      const e = Array.from({ length: n }, () => -Math.log(rnd()));
      const tot = e.reduce((a, x) => a + x, 0);
      const w = e.map(x => x / tot);
      out.push(point(cov, mu, w));
    }
    return out;
  }

  PRD.opt = { effectiveBounds, feasibleRange, minVariance, frontier, randomPortfolios, point };
})();
