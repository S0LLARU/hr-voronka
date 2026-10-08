const {chromium}=require(process.env.PW || 'playwright');
const OUT=process.argv[2];
(async()=>{const b=await chromium.launch(); 
const errs=[];
for(const [vw,vh,tag] of [[1440,900,'d'],[390,844,'m']]){
 const p=await b.newPage({viewport:{width:vw,height:vh}}); p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8765/'); await p.evaluate(()=>localStorage.clear()); 
 for(const v of ['gul','rin','arm','ali']){ await p.evaluate(v=>localStorage.setItem('hr-funnel-viewer',v),v); await p.reload(); await p.waitForTimeout(500);
   if(tag==='d'||v==='gul') await p.screenshot({path:`${OUT}/r-${tag}-${v}.png`}); }
 if(tag==='m'){ await p.evaluate(()=>localStorage.setItem('hr-funnel-viewer','arm')); await p.reload(); await p.waitForTimeout(400); await p.screenshot({path:`${OUT}/r-m-arm.png`}); await p.evaluate(()=>localStorage.setItem('hr-funnel-viewer','gul')); await p.reload(); await p.waitForTimeout(400); await p.click('[data-card]'); await p.waitForTimeout(600); await p.screenshot({path:`${OUT}/r-m-panel.png`}); }
 if(tag==='d'){ await p.evaluate(()=>localStorage.setItem('hr-funnel-viewer','dan')); await p.reload(); await p.waitForTimeout(400);
   await p.click('[data-card]:has-text("Моушн")'); await p.waitForTimeout(600); await p.screenshot({path:`${OUT}/r-d-cands.png`}); }
 await p.close();
}
console.log(errs.join('\n')||'no errors'); await b.close();})();
