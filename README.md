# Portfolio Risk Lab · NIFTY 50 Portfolio Risk Dashboard

An interactive portfolio risk dashboard. It splits 21 NIFTY 50 stocks into a high-risk **Portfolio A** and a low-risk **Portfolio B**, optimises both on the **Markowitz efficient frontier**, measures **historical VaR and Expected Shortfall**, and replays both portfolios through the **COVID-19 crash** and the **most recent year** to test whether the risk labels hold.

Everything runs in the browser (plain HTML, CSS and JavaScript). There is no backend, so it deploys to GitHub Pages as-is.

## Pages

| Page | File | What it shows |
|---|---|---|
| Overview | `index.html` | Both portfolios, editable investment amounts, key metrics, growth chart, COVID-19 vs recent comparison with values, stress-test table |
| Stock Selection | `stocks.html` | Average daily return, variance, volatility, beta, VaR for all 21 stocks; risk-score selection rule; reassign stocks between portfolios; sector and market cap with sources |
| Portfolio A / B | `portfolio-a.html`, `portfolio-b.html` | Markowitz minimum-variance weights for a target return (or custom weights) and rupee allocation, expected return, variance, volatility, efficient frontier, VaR/ES with a confidence-level control, COVID-19 vs recent stress test, Markowitz weights compared between any two years, classification verdict |
| Data | `data.html` | Dataset facts, companies and sectors, the full closing-price table (searchable, scrollable), Download Excel (.xlsx), notes on the prices, upload of a replacement dataset or a NIFTY 50 benchmark file |
| Methodology | `methodology.html` | Every formula and assumption |

## Folder structure

```
portfolio-risk-dashboard/
├── index.html, stocks.html, portfolio-a.html, portfolio-b.html, data.html, methodology.html
├── assets/
│   ├── css/styles.css                 design tokens (dark default, light toggle) and components
│   └── js/
│       ├── core/
│       │   ├── meta.js                company names, sectors, market caps + their sources and dates
│       │   ├── data.js                Excel loading, structure validation, returns, benchmark
│       │   ├── stats.js               sample moments, historical VaR/ES, drawdown, selection rule
│       │   ├── optimizer.js           Markowitz QP (min variance for a target, frontier, feasibility)
│       │   ├── state.js               saved settings + the portfolio engine used by every page
│       │   ├── insights.js            plain-language conclusions generated from the numbers
│       │   └── ui.js                  navigation, theme, formatting, chart helpers, page boot
│       ├── pages/                     one script per page
│       └── vendor/                    Chart.js 4.4.4, SheetJS 0.18.5, quadprog 1.6.1 (bundled, MIT/Apache)
├── data/
│   ├── NIFTY50_Clean_Stocks_Daily_Close_2020-2026.xlsx   the dataset (source of truth, unmodified)
│   └── manifest.json                  optional: names a bundled NIFTY 50 benchmark file
└── tests/                             cross-check of the browser engine against pandas/scipy
```

All libraries are bundled locally, so the site works without any CDN. Only the Google Fonts stylesheet is loaded from the internet (it falls back to system fonts if blocked).

## Run it locally

The pages read the Excel file with `fetch`, which browsers block for pages opened straight from disk (`file://`). Start any static web server in the project folder:

```bash
cd portfolio-risk-dashboard
python3 -m http.server 8000
# open http://localhost:8000
```

(If you do open `index.html` directly, the page offers a button to load the Excel file manually.)

## Deploy to GitHub Pages

1. Create a new public repository on GitHub (for example `portfolio-risk-dashboard`).
2. Upload the **contents** of this folder to the repository root (drag and drop in the GitHub web UI, or):
   ```bash
   cd portfolio-risk-dashboard
   git init && git add . && git commit -m "Portfolio risk dashboard"
   git branch -M main
   git remote add origin https://github.com/<your-username>/portfolio-risk-dashboard.git
   git push -u origin main
   ```
3. In the repository go to **Settings → Pages**, set **Source** to *Deploy from a branch*, choose **main** and **/ (root)**, and save.
4. After a minute the site is live at `https://<your-username>.github.io/portfolio-risk-dashboard/`.

The empty `.nojekyll` file tells GitHub Pages to serve the files as-is.

## Data

* `data/NIFTY50_Clean_Stocks_Daily_Close_2020-2026.xlsx` is the uploaded project file and is never modified. Sheet *Close Prices (21)* (Date + 21 company columns, 1,679 trading days from 1 Jan 2020 to 12 Oct 2026, no blank cells) drives the analysis. The workbook's other sheets (buyback stocks, notes) are kept in the file but not shown or used.
* Prices are **unadjusted closing prices** (per the file's Notes sheet: Yahoo Finance, checked against NSE). Adjusted prices are not available, so all returns are price returns that exclude dividends; the dataset's author excluded stocks with splits, bonuses, demergers and rights issues so unadjusted prices remain comparable.
* **Replace the dataset:** use *Data → Use a different Excel file*. The file must contain a `Date` column followed by exactly 21 price columns with unique headers. Dates may be Excel dates, `YYYY-MM-DD`, `DD-MM-YYYY` or `DD-Mon-YYYY`. Invalid structures are rejected with a reason; blank cells and duplicate or weekend dates are reported. To change the bundled file permanently, replace the `.xlsx` in `data/` (keep the same name, or update `PRD.BUNDLED_FILE` in `assets/js/core/meta.js`).
* **NIFTY 50 benchmark for beta:** `data/NIFTY50_Index_Daily_Close_2020-2026.xlsx` (NIFTY 50 daily closes for the same dates; source per its Notes sheet: Yahoo Finance ^NSEI, checked against NSE) is named in `data/manifest.json`, so beta = Cov(stock, NIFTY 50) / Var(NIFTY 50) on daily returns. The price file has one date the index file lacks (15 Jan 2026, an NSE holiday on which the price file repeats the previous day's prices); the previous index close is used, so the index return is 0 that day like the stocks. If the benchmark file is removed, beta falls back to an equal-weighted index of the 21 stocks, labelled as a proxy. A different index file (Date + Close columns) can also be uploaded on the Data page.

### External company information

Sector, NIFTY 50 weight and market cap are not in the price file. They are stored in `assets/js/core/meta.js` with their sources:

| Field | Source | Date |
|---|---|---|
| Sector | NSE industry classification as listed in the Wikipedia "NIFTY 50" constituents table | constituents as of 8 Dec 2025, accessed 12 Oct 2026 |
| NIFTY 50 weight | Taurus Mutual Fund NIFTY 50 constituent weightage file | as on 19 Aug 2026 |
| Market cap (US$ bn) | companiesmarketcap.com, largest companies in India | page undated ("updated daily"), read 12 Oct 2026 |

Missing values are shown as **Unavailable**; nothing is estimated.

## Methodology (summary)

* Daily simple returns `r = P_t / P_{t-1} − 1`; sample mean, sample variance and sample covariance (n − 1) throughout. Every figure is shown on a daily basis (nothing is annualised).
* **Selection:** rank the 21 stocks on daily volatility, beta and 95% one-day historical VaR; risk score = average rank. Top 10 → Portfolio A, bottom 10 → Portfolio B, middle stock left out. Users can reassign stocks; a stock can never be in both portfolios.
* **Optimised weights (Markowitz):** the minimum-variance portfolio for a target daily return: minimise w′Σw subject to Σw = 1, μ′w = target, every weight ≥ a minimum (default 1%), no short selling. The default target is the equal-weight mix's return; any reachable target can be entered. Solved exactly as a quadratic program.
* **VaR / ES:** historical simulation. Sort daily portfolio returns, `k = ceil(n × (1 − c))`; VaR = −(k-th worst return), ES = −(average of the k worst). Confidence level 50%–99.9%, default 95%. Shown in % and ₹.
* **Stress test:** fixed weights, COVID-19 year (calendar 2020, 1 Jan – 31 Dec 2020, which contains the March 2020 crash) vs the latest one-year (365-day) window, both adjustable. Every measure is a daily figure: average daily return, daily volatility, one-day VaR, one-day ES, plus maximum drawdown.
* **Markowitz weights by year:** pick any two calendar years; μ and Σ are estimated from each year alone and the minimum-variance weights for the same target return are shown side by side with the change per stock. Unreachable targets are explained rather than solved.

See `methodology.html` for the full formulas.

## Verifying the calculations

`tests/` re-computes the stock statistics, VaR/ES, drawdowns and the Markowitz minimum-variance weights (full window and a single year) with pandas and scipy and compares them with the browser engine (differences are at floating-point precision):

```bash
node tests/export_js_results.js        # runs the browser engine in Node
python3 tests/verify_calculations.py   # needs pandas, numpy, scipy, openpyxl
```

## Notes

* Settings (investment amounts, weights, portfolio membership, confidence level, dates, theme) are saved in your browser's localStorage, so they persist across pages and visits on the same device. Clearing site data resets them.
* Not investment advice.
