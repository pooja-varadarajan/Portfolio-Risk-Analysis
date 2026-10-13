/* Company reference data that is NOT in the price file.
 * Every figure here comes from a cited external source with its date.
 * Anything we could not verify is left as null and shown as "Unavailable". */
window.PRD = window.PRD || {};

PRD.SOURCES = {
  sector: {
    label: 'NSE industry classification, as listed on Wikipedia "NIFTY 50" constituents table',
    asOf: '8 Dec 2025 (constituent list date stated on the page)',
    accessed: '12 Oct 2026',
    url: 'https://en.wikipedia.org/wiki/NIFTY_50'
  },
  indexWeight: {
    label: 'NIFTY 50 constituent weightage file published by Taurus Mutual Fund',
    asOf: '19 Aug 2026',
    accessed: '12 Oct 2026',
    url: 'https://www.taurusmutualfund.com/sites/default/files/2026-08/nifty-index-constituent-as-on-19_08_2026.pdf'
  },
  marketCap: {
    label: 'companiesmarketcap.com, "Largest companies in India by market cap" (USD)',
    asOf: 'Page states "updated daily" but gives no date; figures read on the access date',
    accessed: '12 Oct 2026',
    url: 'https://companiesmarketcap.com/india/largest-companies-in-india-by-market-cap/'
  },
  prices: {
    label: 'Project Excel file NIFTY50_Clean_Stocks_Daily_Close_2020-2026.xlsx (per its Notes sheet: Yahoo Finance SYMBOL.NS closes, checked against NSE closes on 12 Oct 2026)',
    asOf: '1 Jan 2020 to 12 Oct 2026'
  }
};

// marketCapUsdBn: USD billions from PRD.SOURCES.marketCap. indexWeight: % weight in NIFTY 50 from PRD.SOURCES.indexWeight.
PRD.COMPANIES = {
  'ADANIPORTS': { name: 'Adani Ports & Special Economic Zone', sector: 'Services', indexWeight: 1.13, marketCapUsdBn: 41.92 },
  'ICICIBANK':  { name: 'ICICI Bank', sector: 'Financial Services', indexWeight: 9.11, marketCapUsdBn: 100.10 },
  'SBIN':       { name: 'State Bank of India', sector: 'Financial Services', indexWeight: 3.93, marketCapUsdBn: 91.47 },
  'APOLLOHOSP': { name: 'Apollo Hospitals Enterprise', sector: 'Healthcare', indexWeight: 0.82, marketCapUsdBn: 11.92 },
  'AXISBANK':   { name: 'Axis Bank', sector: 'Financial Services', indexWeight: 3.22, marketCapUsdBn: 40.50 },
  'TECHM':      { name: 'Tech Mahindra', sector: 'Information Technology', indexWeight: 0.92, marketCapUsdBn: 13.86 },
  'M&M':        { name: 'Mahindra & Mahindra', sector: 'Automobile and Auto Components', indexWeight: 2.77, marketCapUsdBn: 34.70 },
  'COALINDIA':  { name: 'Coal India', sector: 'Oil, Gas & Consumable Fuels', indexWeight: 0.87, marketCapUsdBn: 26.20 },
  'INDIGO':     { name: 'InterGlobe Aviation (IndiGo)', sector: 'Services', indexWeight: 1.07, marketCapUsdBn: 19.30 },
  'MARUTI':     { name: 'Maruti Suzuki India', sector: 'Automobile and Auto Components', indexWeight: 1.62, marketCapUsdBn: 37.10 },
  'TITAN':      { name: 'Titan Company', sector: 'Consumer Durables', indexWeight: 1.90, marketCapUsdBn: 40.43 },
  'HCLTECH':    { name: 'HCL Technologies', sector: 'Information Technology', indexWeight: 1.27, marketCapUsdBn: 34.01 },
  'ULTRACEMCO': { name: 'UltraTech Cement', sector: 'Construction Materials', indexWeight: 1.23, marketCapUsdBn: 32.44 },
  'HINDALCO':   { name: 'Hindalco Industries', sector: 'Metals & Mining', indexWeight: 1.37, marketCapUsdBn: 20.65 },
  'ONGC':       { name: 'Oil & Natural Gas Corporation', sector: 'Oil, Gas & Consumable Fuels', indexWeight: 0.84, marketCapUsdBn: 28.69 },
  'SUNPHARMA':  { name: 'Sun Pharmaceutical Industries', sector: 'Healthcare', indexWeight: 1.83, marketCapUsdBn: 43.63 },
  'SBILIFE':    { name: 'SBI Life Insurance', sector: 'Financial Services', indexWeight: 0.73, marketCapUsdBn: 17.47 },
  'JSWSTEEL':   { name: 'JSW Steel', sector: 'Metals & Mining', indexWeight: 1.09, marketCapUsdBn: 29.45 },
  'HDFCLIFE':   { name: 'HDFC Life Insurance', sector: 'Financial Services', indexWeight: 0.52, marketCapUsdBn: 12.49 },
  'ASIANPAINT': { name: 'Asian Paints', sector: 'Consumer Durables', indexWeight: 1.08, marketCapUsdBn: 23.16 },
  'CIPLA':      { name: 'Cipla', sector: 'Healthcare', indexWeight: 0.73, marketCapUsdBn: 10.86 },
  // Second sheet of the workbook (buyback stocks) - shown on the Data page only, not used in the analysis.
  'TCS':        { name: 'Tata Consultancy Services', sector: 'Information Technology', indexWeight: 2.12, marketCapUsdBn: null },
  'INFY':       { name: 'Infosys', sector: 'Information Technology', indexWeight: 3.56, marketCapUsdBn: null },
  'LT':         { name: 'Larsen & Toubro', sector: 'Construction', indexWeight: 4.29, marketCapUsdBn: null },
  'NTPC':       { name: 'NTPC', sector: 'Power', indexWeight: 1.45, marketCapUsdBn: null },
  'BAJAJ-AUTO': { name: 'Bajaj Auto', sector: 'Automobile and Auto Components', indexWeight: 1.17, marketCapUsdBn: null }
};

PRD.company = function (t) {
  return PRD.COMPANIES[t] || { name: t, sector: null, indexWeight: null, marketCapUsdBn: null };
};

PRD.EXPECTED_TICKERS = ['ADANIPORTS', 'ICICIBANK', 'SBIN', 'APOLLOHOSP', 'AXISBANK', 'TECHM', 'M&M', 'COALINDIA', 'INDIGO', 'MARUTI', 'TITAN', 'HCLTECH', 'ULTRACEMCO', 'HINDALCO', 'ONGC', 'SUNPHARMA', 'SBILIFE', 'JSWSTEEL', 'HDFCLIFE', 'ASIANPAINT', 'CIPLA'];
PRD.BUNDLED_FILE = 'data/NIFTY50_Clean_Stocks_Daily_Close_2020-2026.xlsx';
PRD.BENCHMARK_FILE = 'data/nifty50_index.csv';
