# Cross-checks the browser engine against an independent pandas/scipy implementation.
# Run: node tests/export_js_results.js && python3 tests/verify_calculations.py
import os
HERE=os.path.dirname(os.path.abspath(__file__))
import json, numpy as np, pandas as pd
from scipy.optimize import minimize, linprog
js=json.load(open(os.path.join(HERE,'js_out.json')))
df=pd.read_excel(os.path.join(HERE,'..','data','NIFTY50_Clean_Stocks_Daily_Close_2020-2026.xlsx'),sheet_name='Close Prices (21)',index_col=0)
R=df.pct_change().iloc[1:]
# market return: NIFTY 50 index if bundled (dates the index lacks take the previous close), else the equal-weighted proxy
nf=os.path.join(HERE,'..','data','NIFTY50_Index_Daily_Close_2020-2026.xlsx')
if os.path.exists(nf):
    ni=pd.read_excel(nf,sheet_name=0,index_col=0).iloc[:,0]
    m=ni.reindex(df.index).ffill().pct_change().iloc[1:]
else:
    m=R.mean(axis=1)
maxd=0
for t,s in js['stocks'].items():
    r=R[t]; b=r.cov(m)/m.var()
    q=np.sort(r.values); k=int(np.ceil(len(q)*0.05-1e-9))
    d=[abs(r.mean()-s['mean'])/abs(s['mean']), abs(r.var(ddof=1)-s['var'])/s['var'], abs(b-s['beta'])/s['beta'], abs(-q[k-1]-s['v95'])/s['v95']]
    maxd=max(maxd,max(d))
print('stock stats max rel diff', maxd)
def perf(r):
    g=(1+r).cumprod(); g=np.concatenate([[1],g]); dd=g/np.maximum.accumulate(g)-1; return g[-1]-1, dd.min()
def var_es(r,c=0.95):
    q=np.sort(r); k=int(np.ceil(len(q)*(1-c)-1e-9)); return -q[k-1], -q[:k].mean()
for P in ['A','B']:
    j=js[P]; T=j['tickers']; w=np.array(j['w'])
    rp=R[T].values@w
    v,e=var_es(rp); c,mdd=perf(rp)
    print(P,'full VaR/ES diff',v-j['var'],e-j['es'],'mdd',mdd-j['mdd'])
    Rc=df[T].loc['2020-01-01':'2020-12-31'].pct_change().iloc[1:].values@w
    v,e=var_es(Rc); c,mdd=perf(Rc); print(P,'covid',c-j['covid']['cum'],Rc.std(ddof=1)-j['covid']['vol'],v-j['covid']['var'],e-j['covid']['es'],mdd-j['covid']['mdd'])
    Rr=df[T].loc[j['recent']['start']:].pct_change().iloc[1:].values@w
    v,e=var_es(Rr); c,mdd=perf(Rr); print(P,'recent',c-j['recent']['cum'],v-j['recent']['var'],e-j['recent']['es'],mdd-j['recent']['mdd'])
    mu=R[T].mean().values; S=R[T].cov().values
    def minvar(mu,S,t):
        n=len(mu); best=None
        for seed in range(3):
            x0=np.random.default_rng(seed).dirichlet(np.ones(n))
            r=minimize(lambda x:x@S@x*1e4, x0, bounds=[(0.01,1)]*n, constraints=[{'type':'eq','fun':lambda x:x.sum()-1},{'type':'eq','fun':lambda x:(x@mu-t)*1e3}], method='SLSQP', options={'ftol':1e-15,'maxiter':2000})
            if r.success and (best is None or r.fun<best.fun): best=r
        return best.x
    print(P,'target = equal-weight mean?', abs(j['target']-mu.mean()))
    print(P,'Markowitz weights max diff vs scipy', np.abs(minvar(mu,S,j['target'])-w).max())
    Ry=df[T].loc['2021-01-01':'2021-12-31'].pct_change().iloc[1:]
    print(P,'2021 weights max diff vs scipy', np.abs(minvar(Ry.mean().values,Ry.cov().values,j['target'])-np.array(j['y2021'])).max())
