const fs=require('fs'), path=require('path');
const P=path.resolve(__dirname, '..') + '/';
const XLSX_PATH=P+'assets/js/vendor/xlsx.full.min.js';
global.window=global; global.XLSX=require(XLSX_PATH);
global.addEventListener=()=>{};
global.fetch=async(u)=>{const f=P+u; if(!fs.existsSync(f)) return {ok:false,status:404}; const b=fs.readFileSync(f); return {ok:true,arrayBuffer:async()=>b.buffer.slice(b.byteOffset,b.byteOffset+b.length),text:async()=>b.toString()};};
for (const f of ['vendor/quadprog.js','core/meta.js','core/data.js','core/stats.js','core/optimizer.js','core/state.js','core/insights.js']) eval(fs.readFileSync(P+'assets/js/'+f,'utf8'));
module.exports=PRD;
