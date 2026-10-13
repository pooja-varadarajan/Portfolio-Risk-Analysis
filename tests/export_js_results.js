const PRD=require('./harness.js');
(async()=>{const ds=await PRD.loadDataset(); const out={}; // compact JSON of the engine's results for tests/verify_calculations.py
 const {stats}=PRD.selection(ds); out.stocks=Object.fromEntries(stats.map(s=>[s.ticker,{mean:s.mean,var:s.variance,beta:s.beta,v95:s.var}]));
 for (const k of ['A','B']){const a=PRD.analyse(ds,k); const y=PRD.yearAllocation(ds,a,'2021');
  out[k]={tickers:a.tickers,w:a.w,ret:a.point.ret,vol:a.point.vol,var:a.var,es:a.es,mdd:a.perf.mdd,covid:{cum:a.covid.perf.cum,vol:a.covid.perf.vol,var:a.covid.var,es:a.covid.es,mdd:a.covid.perf.mdd},recent:{cum:a.recent.perf.cum,var:a.recent.var,es:a.recent.es,mdd:a.recent.perf.mdd,start:a.recent.start},target:a.opt.target,y2021:y.res.w};}
 require('fs').writeFileSync(require('path').join(__dirname,'js_out.json'),JSON.stringify(out));})();
