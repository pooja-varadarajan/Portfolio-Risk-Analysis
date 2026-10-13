/* Methodology page: every formula and assumption in one place. */
(function () {
  const { F } = PRD;
  PRD.boot('method', (ds, root) => {
    const per = PRD.periods(ds);
    const s = PRD.state.get();
    const sec = (n, title, body) => `<div class="section-title"><span class="n">${n}</span><h2>${title}</h2></div><div class="card text-2">${body}</div>`;
    root.innerHTML = `
    <div class="page-head"><div>
      <div class="eyebrow">How everything is calculated</div>
      <h1>Methodology</h1>
      <p>Every number on this site is computed in your browser from the Excel file, using the formulas below. Nothing is hard-coded except the externally sourced company information, which is cited with its date.</p>
      ${PRD.dataBanner(ds)}
    </div></div>

    ${sec('01', 'Data', `
      <ul style="padding-left:18px;margin:0">
        <li>Source: ${F.esc(PRD.SOURCES.prices.label)}. ${ds.tickers.length} companies, ${ds.dates.length} trading days, ${F.date(ds.first)} to ${F.date(ds.last)}.</li>
        <li>Prices are <b>unadjusted closing prices</b>. The file has no adjusted-close series, so returns exclude dividends. Corporate actions that would distort unadjusted prices (splits, bonuses, demergers, rights issues) were screened out when the dataset was built.</li>
        <li>On upload, the file is validated: a Date column followed by exactly 21 price columns with unique headers; unreadable dates are skipped; dates are sorted; duplicate dates keep the first row; blank or non-positive prices are treated as missing.</li>
        <li>Missing values: a return needs both today's and yesterday's price. Portfolio statistics use only days on which every selected stock has a return (list-wise deletion), so μ, Σ and the return series always cover identical days in identical stock order.</li>
      </ul>`)}

    ${sec('02', 'Returns, variance, volatility', `
      <div class="formula">r_i,t = P_i,t / P_i,t−1 − 1                         (simple daily return)
mean    μ_i = (1/n) Σ_t r_i,t
variance s_i² = Σ_t (r_i,t − μ_i)² / (n − 1)          (sample)
volatility s_i = √s_i²
covariance Σ_ij = Σ_t (r_i,t − μ_i)(r_j,t − μ_j) / (n − 1)</div>
      <p>The same sample (n − 1) convention is used for every variance and covariance, including the covariance matrix used by the optimiser.</p>`)}

    ${sec('03', 'Beta', `
      <div class="formula">β_i = Cov(r_i, r_m) / Var(r_m)        portfolio β = Σ w_i β_i</div>
      <p>${ds.benchmark.kind === 'nifty'
        ? `r_m is the daily return of the NIFTY 50 index (${F.esc(ds.benchmark.fileName)}, ${ds.benchmark.matched} matched days). By definition the NIFTY 50's own beta is 1.00.`
        : 'The dataset does not include the NIFTY 50 index, so r_m is the equal-weighted average daily return of the 21 stocks. This proxy is labelled wherever beta appears. Upload NIFTY 50 history on the Data page to use the real index.'}</p>`)}

    ${sec('04', 'Stock selection', `
      <p>Each stock is ranked 1 to 21 (1 = least risky) on daily volatility, beta and 95% one-day historical VaR over the estimation window (${F.date(per.est.start)} to ${F.date(per.est.end)}). The risk score is the average of the three ranks. The 10 highest scores form Portfolio A (High Risk), the 10 lowest form Portfolio B (Low Risk), and the middle stock is left out. Users can reassign stocks; a stock can only be in one portfolio.</p>`)}

    ${sec('05', 'Portfolio return and risk', `
      <div class="formula">expected daily return  μ_p = w′μ
daily variance         σ_p² = w′Σw
daily return series    r_p,t = Σ_i w_i r_i,t   (weights held constant, i.e. rebalanced daily)</div>`)}

    ${sec('06', 'Markowitz optimisation', `
      <div class="formula">minimise   w′Σw
subject to Σ w_i = 1,   μ′w = target (when a target is set),   lo ≤ w_i ≤ hi</div>
      <ul style="padding-left:18px;margin:0">
        <li><b>Optimised weights</b> = the minimum-variance portfolio for a chosen target daily return. The default target is the return of an equal-weight mix of the portfolio's stocks; you can type any reachable target.</li>
        <li>No short selling, and every stock keeps at least a minimum weight (default 1%, editable), so no stock is left out.</li>
        <li>Reachable targets: with minimum weight m, the lowest target puts m in every stock and the rest in the worst stock; the highest puts the rest in the best stock. Targets outside that range are reported, not solved.</li>
        <li>Efficient frontier: the minimum-variance portfolio for each target from the global minimum-variance point up to the highest reachable return.</li>
        <li>Solved exactly as a quadratic program (Goldfarb–Idnani active-set method, bundled <i>quadprog</i> library).</li>
      </ul>`)}

    ${sec('07', 'Value at Risk and Expected Shortfall', `
      <div class="formula">sort the n daily portfolio returns ascending: r_(1) ≤ r_(2) ≤ … ≤ r_(n)
k   = ⌈n × (1 − c)⌉
VaR = −r_(k)                         (loss threshold)
ES  = −(1/k) Σ_{j=1..k} r_(j)          (average loss in the tail)
rupee VaR = VaR × investment,  rupee ES = ES × investment</div>
      <p>Historical simulation: no distribution is assumed. The confidence level c defaults to 95% and can be set between 50% and 99.9%. The same method is used for both portfolios and every period.</p>`)}

    ${sec('08', 'Stress test: COVID-19 vs recent year', `
      <p>Weights are held fixed and the portfolio is replayed through two windows. Defaults: COVID-19 = the calendar year 2020 (${F.date('2020-01-01')} to ${F.date('2020-12-31')}, which contains the March 2020 crash); Recent = the latest one-year (365-day) window in the data (currently ${F.date(per.recent.start)} to ${F.date(per.recent.end)}). Both are adjustable. A window uses returns whose start and end prices both fall inside it, so both periods hold about one year of daily returns.</p>
      <div class="formula">average daily return = (1/n) Σ r_p,t
max drawdown      = min_t ( V_t / max_{s≤t} V_s − 1 )</div>
      <p>For each window we report daily averages: average daily return, daily volatility, one-day VaR, ES and maximum drawdown, and count on how many of the four risk measures (volatility, VaR, ES, drawdown) Portfolio A was riskier than Portfolio B.</p>`)}

    ${sec('09', 'Markowitz weights by year', `
      <p>Choose two calendar years. For each year, μ and Σ are estimated from that year's daily returns only, and the minimum-variance weights are found for the same target daily return used on the portfolio page (same minimum weight, no short selling). The table shows both weight sets side by side, the change for each stock, each solution's daily volatility, and the share of the portfolio that would move, ½ Σ |w₂ − w₁|. If a year's data cannot reach the target, the page says so and shows that year's reachable range.</p>`)}

    ${sec('10', 'Limitations', `
      <ul style="padding-left:18px;margin:0">
        <li>Historical VaR/ES assume the past distribution is representative; a short window (e.g. one year) gives few tail observations.</li>
        <li>Sample means are noisy, so Markowitz weights are sensitive to the estimation window (which test 2 makes visible).</li>
        <li>Returns are price-only (no dividends), ignore transaction costs and taxes, and assume daily rebalancing to constant weights.</li>
        <li>External company figures are snapshots from the cited dates.</li>
      </ul>`)}`;
  });
})();
