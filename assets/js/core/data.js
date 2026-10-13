/* Loading, validating and caching the price dataset (and the optional NIFTY 50 benchmark). */
window.PRD = window.PRD || {};

(function () {
  const CACHE_KEY = 'prd_bundled_cache_v1';
  const CUSTOM_KEY = 'prd_custom_dataset_v1';
  const BENCH_KEY = 'prd_benchmark_v1';

  const store = {
    get(s, k) { try { return s.getItem(k); } catch (e) { return null; } },
    set(s, k, v) { try { s.setItem(k, v); return true; } catch (e) { return false; } },
    del(s, k) { try { s.removeItem(k); } catch (e) { /* ignore */ } }
  };
  const LS = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const SS = (() => { try { return window.sessionStorage; } catch (e) { return null; } })();
  const sget = (s, k) => (s ? store.get(s, k) : null);
  const sset = (s, k, v) => (s ? store.set(s, k, v) : false);
  const sdel = (s, k) => { if (s) store.del(s, k); };

  const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  /* Excel serial (1900 system) or a date-like string -> 'YYYY-MM-DD' (no time-zone drift). */
  function toISODate(v) {
    if (v == null || v === '') return null;
    if (v instanceof Date && !isNaN(v)) return iso(v.getFullYear(), v.getMonth(), v.getDate());
    if (typeof v === 'number' && isFinite(v)) {
      if (v < 20000 || v > 80000) return null; // outside ~1954..2119: not a plausible date serial
      const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
      return iso(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    }
    const s = String(v).trim();
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/))) return valid(+m[1], +m[2] - 1, +m[3]);
    if ((m = s.match(/^(\d{1,2})[-\s/]([A-Za-z]{3})[A-Za-z]*[-\s/,]+(\d{4})$/))) {
      const mo = MONTHS[m[2].toLowerCase()];
      return mo == null ? null : valid(+m[3], mo, +m[1]);
    }
    if ((m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/))) return valid(+m[3], +m[2] - 1, +m[1]); // DD-MM-YYYY (Indian convention)
    return null;
  }
  function valid(y, mo, d) {
    const dt = new Date(Date.UTC(y, mo, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo || dt.getUTCDate() !== d) return null;
    return iso(y, mo, d);
  }
  function toNumber(v) {
    if (typeof v === 'number') return isFinite(v) ? v : null;
    if (v == null) return null;
    const s = String(v).replace(/[,₹\s]/g, '');
    if (s === '' || s === '-' || /^n\/?a$/i.test(s)) return null;
    const n = Number(s);
    return isFinite(n) ? n : null;
  }

  /* Validate one sheet as "Date + 21 price columns". Returns {ok, errors, warnings, dataset}. */
  function parsePriceSheet(rows, meta) {
    const errors = [], warnings = [];
    if (!rows || rows.length < 3) return { ok: false, errors: ['The sheet has fewer than 3 rows.'], warnings };
    const header = rows[0].map(h => (h == null ? '' : String(h).trim()));
    while (header.length && header[header.length - 1] === '') header.pop();
    if (!/date/i.test(header[0] || '')) errors.push(`The first column header must be "Date" (found "${header[0] || 'blank'}").`);
    const tickers = header.slice(1);
    if (tickers.some(t => t === '')) errors.push('One or more price columns has a blank header (company name).');
    if (tickers.length !== 21) errors.push(`Expected 21 company price columns, found ${tickers.length}.`);
    const dupes = tickers.filter((t, i) => tickers.indexOf(t) !== i);
    if (dupes.length) errors.push(`Duplicate company columns: ${[...new Set(dupes)].join(', ')}.`);
    if (errors.length) return { ok: false, errors, warnings };

    const unknown = tickers.filter(t => !PRD.EXPECTED_TICKERS.includes(t));
    if (unknown.length) warnings.push(`${unknown.length} column(s) are not in the original 21-stock list (${unknown.join(', ')}); sector and market-cap details will show as Unavailable for them.`);

    const byDate = new Map();
    let badDates = 0, emptyRows = 0, dupDates = 0, missing = 0, nonPositive = 0, weekend = 0;
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] || [];
      if (row.every(c => c == null || c === '')) continue;
      const d = toISODate(row[0]);
      if (!d) { badDates++; continue; }
      const px = tickers.map((_, j) => {
        const n = toNumber(row[j + 1]);
        if (n == null) { missing++; return null; }
        if (n <= 0) { nonPositive++; return null; }
        return n;
      });
      if (px.every(p => p == null)) { emptyRows++; continue; } // a non-trading date: no prices at all
      if (byDate.has(d)) { dupDates++; continue; }
      byDate.set(d, px);
      const wd = new Date(d + 'T00:00:00Z').getUTCDay();
      if (wd === 0 || wd === 6) weekend++;
    }
    const dates = [...byDate.keys()].sort();
    const prices = dates.map(d => byDate.get(d));
    if (dates.length < 30) return { ok: false, errors: [`Only ${dates.length} valid dated rows were found; at least 30 are needed.`], warnings };
    if (badDates) warnings.push(`${badDates} row(s) had an unreadable date and were skipped.`);
    if (emptyRows) warnings.push(`${emptyRows} dated row(s) had no prices (non-trading days) and were skipped.`);
    if (dupDates) warnings.push(`${dupDates} duplicate date(s) were found; the first occurrence was kept.`);
    if (missing) warnings.push(`${missing} blank price cell(s). Returns that need a missing price are excluded; portfolio calculations drop any day where a selected stock has no return.`);
    if (nonPositive) warnings.push(`${nonPositive} zero/negative price cell(s) were treated as missing.`);
    if (weekend) warnings.push(`${weekend} row(s) fall on a Saturday or Sunday (e.g. special NSE sessions such as Budget day). They were kept as given.`);
    return {
      ok: true, errors, warnings,
      dataset: { tickers, dates, prices, missing, fileName: meta.fileName, sheetName: meta.sheetName, source: meta.source }
    };
  }

  function sheetRows(ws) {
    return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null, blankrows: false });
  }

  /* Parse a workbook ArrayBuffer. Picks the first sheet that validates as Date + 21 prices. */
  function parseWorkbook(buf, fileName, source) {
    let wb;
    try { wb = XLSX.read(buf, { type: 'array', cellDates: false }); }
    catch (e) { return { ok: false, errors: ['The file could not be read as an Excel workbook.'], warnings: [] }; }
    const tried = [];
    for (const name of wb.SheetNames) {
      const res = parsePriceSheet(sheetRows(wb.Sheets[name]), { fileName, sheetName: name, source });
      if (res.ok) {
        if (wb.SheetNames.length > 1) res.warnings.unshift(`Using sheet "${name}" (the first sheet with a Date column and 21 price columns).`);
        res.workbook = wb;
        return res;
      }
      tried.push(`Sheet "${name}": ${res.errors.join(' ')}`);
    }
    return { ok: false, errors: tried.length ? tried : ['The workbook has no sheets.'], warnings: [] };
  }

  function finalize(ds) {
    // Simple daily returns r_t = P_t / P_{t-1} - 1, NaN when either price is missing.
    const T = ds.dates.length, N = ds.tickers.length;
    const R = new Array(T);
    R[0] = null;
    for (let t = 1; t < T; t++) {
      const row = new Float64Array(N);
      for (let i = 0; i < N; i++) {
        const a = ds.prices[t - 1][i], b = ds.prices[t][i];
        row[i] = a != null && b != null ? b / a - 1 : NaN;
      }
      R[t] = row;
    }
    ds.returns = R;
    ds.index = Object.fromEntries(ds.tickers.map((t, i) => [t, i]));
    ds.first = ds.dates[0];
    ds.last = ds.dates[T - 1];
    return ds;
  }

  async function fetchBuffer(url) {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.arrayBuffer();
  }

  PRD.loadWorkbook = async function () {
    const buf = await fetchBuffer(PRD.BUNDLED_FILE);
    return XLSX.read(buf, { type: 'array', cellDates: false });
  };

  /* Main entry: returns the active dataset (uploaded one if present, else the bundled file). */
  PRD.loadDataset = async function () {
    const custom = sget(LS, CUSTOM_KEY);
    let ds = null;
    if (custom) {
      try { ds = JSON.parse(custom); } catch (e) { sdel(LS, CUSTOM_KEY); }
    }
    if (!ds) {
      const cached = sget(SS, CACHE_KEY);
      if (cached) { try { ds = JSON.parse(cached); } catch (e) { ds = null; } }
    }
    if (!ds) {
      const buf = await fetchBuffer(PRD.BUNDLED_FILE);
      const res = parseWorkbook(buf, PRD.BUNDLED_FILE.split('/').pop(), 'bundled');
      if (!res.ok) throw new Error(res.errors.join(' '));
      ds = res.dataset;
      ds.warnings = res.warnings;
      const { workbook, ...plain } = ds;
      sset(SS, CACHE_KEY, JSON.stringify(plain));
    }
    finalize(ds);
    ds.benchmark = await PRD.loadBenchmark(ds);
    return ds;
  };

  PRD.validateUpload = async function (file) {
    const buf = await file.arrayBuffer();
    return parseWorkbook(buf, file.name, 'uploaded');
  };
  PRD.useUploadedDataset = function (dataset, warnings) {
    const plain = { tickers: dataset.tickers, dates: dataset.dates, prices: dataset.prices, missing: dataset.missing, fileName: dataset.fileName, sheetName: dataset.sheetName, source: 'uploaded', warnings };
    const ok = sset(LS, CUSTOM_KEY, JSON.stringify(plain));
    if (!ok) sset(SS, CUSTOM_KEY, JSON.stringify(plain));
    return ok;
  };
  PRD.resetDataset = function () { sdel(LS, CUSTOM_KEY); sdel(SS, CUSTOM_KEY); };
  PRD.hasUploadedDataset = () => !!sget(LS, CUSTOM_KEY);

  /* ---------- Benchmark (NIFTY 50 index level) ---------- */
  function parseBenchmarkRows(rows) {
    if (!rows || rows.length < 3) return { ok: false, error: 'The benchmark file is empty.' };
    const header = rows[0].map(h => String(h == null ? '' : h).trim().toLowerCase());
    const di = header.findIndex(h => h.startsWith('date'));
    let ci = header.findIndex(h => h === 'close' || h.startsWith('close'));
    if (ci < 0) ci = header.findIndex(h => h.includes('close'));
    if (di < 0 || ci < 0) return { ok: false, error: 'The benchmark file needs a "Date" column and a "Close" column.' };
    const map = {};
    for (let r = 1; r < rows.length; r++) {
      const d = toISODate(rows[r][di]);
      const c = toNumber(rows[r][ci]);
      if (d && c != null && c > 0) map[d] = c;
    }
    const n = Object.keys(map).length;
    if (n < 30) return { ok: false, error: `Only ${n} usable benchmark rows were found.` };
    return { ok: true, levels: map };
  }
  PRD.parseBenchmarkFile = async function (file) {
    const isText = /\.(csv|txt)$/i.test(file.name);
    let wb;
    try {
      wb = isText ? XLSX.read(await file.text(), { type: 'string', raw: true })
        : XLSX.read(await file.arrayBuffer(), { type: 'array', cellDates: false });
    } catch (e) { return { ok: false, error: 'The benchmark file could not be read.' }; }
    const res = parseBenchmarkRows(sheetRows(wb.Sheets[wb.SheetNames[0]]));
    if (res.ok) res.fileName = file.name;
    return res;
  };
  PRD.saveBenchmark = function (res) {
    return sset(LS, BENCH_KEY, JSON.stringify({ levels: res.levels, fileName: res.fileName, source: 'uploaded' }));
  };
  PRD.clearBenchmark = function () { sdel(LS, BENCH_KEY); };

  /* Benchmark daily returns aligned to the dataset's return days. Falls back to an
     equal-weighted index of the dataset's stocks, which is clearly labelled as a proxy. */
  PRD.loadBenchmark = async function (ds) {
    let b = null;
    const saved = sget(LS, BENCH_KEY);
    if (saved) { try { b = JSON.parse(saved); } catch (e) { b = null; } }
    if (!b) {
      try {
        // data/manifest.json names an optional bundled benchmark file ("benchmark": "data/nifty50_index.csv")
        const man = await fetch('data/manifest.json', { cache: 'no-cache' }).then(r => (r.ok ? r.text() : '{}')).then(t => JSON.parse(t)).catch(() => ({}));
        if (!man.benchmark) throw new Error('no bundled benchmark');
        // CSV is read as text; Excel (or its base64 copy) as binary
        const wb = /\.(csv|txt)$/i.test(man.benchmark) && !/\.b64\.txt$/.test(man.benchmark)
          ? XLSX.read(await (await fetch(man.benchmark, { cache: 'no-cache' })).text(), { type: 'string', raw: true })
          : XLSX.read(await fetchBuffer(man.benchmark), { type: 'array', cellDates: false });
        const parsed = parseBenchmarkRows(sheetRows(wb.Sheets[wb.SheetNames[0]]));
        if (parsed.ok) b = { levels: parsed.levels, fileName: man.benchmark.split('/').pop(), source: 'bundled' };
      } catch (e) { /* no bundled benchmark file: use the proxy */ }
    }
    const T = ds.dates.length;
    const r = new Float64Array(T).fill(NaN);
    if (b) {
      // Index level on each dataset date. A date the index file lacks (e.g. a market holiday that the
      // price file repeats) takes the last earlier index close, so the index return that day is 0,
      // matching the repeated prices, and the next day's return spans the same two closes.
      const keys = Object.keys(b.levels).sort();
      const lvl = new Array(T).fill(null);
      let j = -1, matched = 0, filled = 0;
      for (let t = 0; t < T; t++) {
        while (j + 1 < keys.length && keys[j + 1] <= ds.dates[t]) j++;
        if (j >= 0 && keys[j] >= ds.dates[0]) { lvl[t] = b.levels[keys[j]]; if (keys[j] !== ds.dates[t]) filled++; }
      }
      for (let t = 1; t < T; t++) if (lvl[t - 1] && lvl[t]) { r[t] = lvl[t] / lvl[t - 1] - 1; matched++; }
      if (matched >= 30) {
        return { kind: 'nifty', label: 'NIFTY 50 index', fileName: b.fileName, source: b.source, returns: r, matched, filled };
      }
    }
    for (let t = 1; t < T; t++) {
      let s = 0, k = 0;
      for (const x of ds.returns[t]) if (!isNaN(x)) { s += x; k++; }
      r[t] = k ? s / k : NaN;
    }
    return { kind: 'proxy', label: `Equal-weighted ${ds.tickers.length}-stock proxy (not the NIFTY 50 index)`, returns: r };
  };

  PRD._internal = { toISODate, parsePriceSheet, parseBenchmarkRows };
})();
