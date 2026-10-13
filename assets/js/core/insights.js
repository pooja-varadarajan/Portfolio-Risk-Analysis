/* Plain-language conclusions generated ONLY from the calculated numbers. */
window.PRD = window.PRD || {};

(function () {
  const F = () => PRD.F;

  /* Compare A (high-risk label) with B (low-risk label) in one period on four risk measures. */
  function comparePeriod(a, b, name) {
    const pa = a[name], pb = b[name];
    const checks = [
      { id: 'vol', label: 'daily volatility', a: pa.perf.vol, b: pb.perf.vol, fmt: x => F().pct(x), riskierA: pa.perf.vol > pb.perf.vol },
      { id: 'var', label: `${F().conf(a.conf)} VaR`, a: pa.var, b: pb.var, fmt: x => F().pct(x), riskierA: pa.var > pb.var },
      { id: 'es', label: `${F().conf(a.conf)} Expected Shortfall`, a: pa.es, b: pb.es, fmt: x => F().pct(x), riskierA: pa.es > pb.es },
      { id: 'mdd', label: 'maximum drawdown', a: pa.perf.mdd, b: pb.perf.mdd, fmt: x => F().pct(x, 1), riskierA: pa.perf.mdd < pb.perf.mdd }
    ];
    const n = checks.filter(c => c.riskierA).length;
    const status = n === 4 ? 'held' : n >= 3 ? 'mostly held' : n === 2 ? 'was mixed' : 'did not hold';
    return { name, period: pa, checks, n, status, meanA: pa.perf.mean, meanB: pb.perf.mean, nDays: pa.n };
  }

  function periodSentence(cmp, a, b) {
    const f = F();
    const p = cmp.period;
    const parts = cmp.checks.map(c => `${c.label} ${c.fmt(c.a)} vs ${c.fmt(c.b)}`);
    let s = `${p.label} (${f.date(p.start)} to ${f.date(p.end)}, ${cmp.nDays} daily returns): Portfolio A vs Portfolio B, ${parts.join('; ')}. `;
    s += `The high-risk / low-risk ordering ${cmp.status} (A was riskier on ${cmp.n} of 4 measures). `;
    const diff = cmp.meanA - cmp.meanB;
    s += `Average daily return was ${f.spct(cmp.meanA, 3)} for A and ${f.spct(cmp.meanB, 3)} for B, so the extra risk ${diff > 0 ? 'was rewarded with a higher return' : 'was not rewarded: B earned more'} in this window.`;
    return s;
  }

  PRD.insights = {
    comparePeriod,
    periodSentence,
    /* Overall verdict for the overview page. */
    overall(a, b) {
      const covid = comparePeriod(a, b, 'covid');
      const recent = comparePeriod(a, b, 'recent');
      const both = covid.n >= 3 && recent.n >= 3;
      const none = covid.n <= 1 && recent.n <= 1;
      const headline = both
        ? 'Yes. The high-risk and low-risk labels held up in both periods.'
        : none ? 'No. The labels did not hold up in either period.'
          : 'Partly. The labels held up in one period but not convincingly in the other.';
      return { covid, recent, headline, ok: both };
    },
    /* Does the portfolio on this page behave as labelled? Returns bullet points. */
    portfolioVerdict(self, other) {
      const f = F();
      const isA = self.key === 'A';
      const A = isA ? self : other, B = isA ? other : self;
      const bullets = [];
      const sel = PRD.selection(PRD.ds);
      const avgScore = list => list.reduce((s, t) => s + sel.sel.scored[t].score, 0) / list.length;
      bullets.push(`Selection lens: average risk score ${avgScore(self.tickers).toFixed(1)} for ${self.label} vs ${avgScore(other.tickers).toFixed(1)} for ${other.label} (higher = riskier; score = average rank of volatility, beta and 95% VaR across the 21 stocks).`);
      bullets.push(`Over the estimation window, daily volatility is ${f.pct(self.point.vol, 3)} vs ${f.pct(other.point.vol, 3)}, portfolio beta ${f.num(self.beta, 2)} vs ${f.num(other.beta, 2)}, and ${f.conf(self.conf)} one-day VaR ${f.pct(self.var)} vs ${f.pct(other.var)}.`);
      const covid = comparePeriod(A, B, 'covid'), recent = comparePeriod(A, B, 'recent');
      for (const c of [covid, recent]) {
        const selfRiskier = c.checks.filter(x => (isA ? x.riskierA : !x.riskierA)).length;
        bullets.push(`${c.period.label}: ${self.label} was ${isA ? 'riskier' : 'safer'} than ${other.label} on ${selfRiskier} of 4 measures (volatility, VaR, ES, max drawdown).`);
      }
      const selfMatches = isA ? (covid.n + recent.n) : (8 - covid.n - recent.n);
      const verdict = selfMatches >= 7 ? 'supported' : selfMatches >= 5 ? 'mostly supported' : selfMatches >= 4 ? 'mixed' : 'not supported';
      return { bullets, verdict, selfMatches, covid, recent };
    }
  };
})();
