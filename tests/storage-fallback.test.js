const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const SAMPLE_CSV = path.join(__dirname, '..', 'sample', 'sample-vocabulary.csv');
const TXT = pathToFileURL(path.join(__dirname, '..', 'sample', 'sample-vocabulary.txt')).href;
const OUT = require('os').tmpdir();
const { chromium } = playwright;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext();const p=await ctx.newPage();
await p.addInitScript(()=>{Object.defineProperty(window,'indexedDB',{value:undefined,configurable:true})});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto(APP + '#/learn');await p.waitForSelector('.strip');
console.log('backend:',await p.evaluate(()=>VL.db.backend));
await p.evaluate(()=>VL.io.loadSample());await p.waitForTimeout(300);
await p.evaluate(()=>VL.views.learn.startType('translate'));await p.waitForSelector('.lesson');
for(let i=0;i<4;i++){await p.waitForTimeout(350);const s=await p.evaluate(()=>{const l=VL.store.state.lesson;const it=l.items[l.index];const w=VL.store.word(it.wordIds[0]);return{t:it.type,w:{en:w.en,uz:w.uz}}});
 if(s.t==='intro'){await p.click('#btn-intro');continue}
 await p.fill('#lans',s.w.uz.split(';')[0]);await p.press('#lans','Enter');await p.waitForSelector('#btn-next');await p.waitForTimeout(300);await p.click('#btn-next')}
await p.waitForTimeout(500);await p.reload();await p.waitForSelector('.strip');
console.log('after reload: xp',await p.evaluate(()=>VL.store.state.days.reduce((a,d)=>a+d.xp,0)),'words',await p.evaluate(()=>VL.store.state.words.length),'paused lesson saved:',await p.evaluate(()=>!!VL.store.state.lesson));
console.log('errors',errs);await b.close()})()
