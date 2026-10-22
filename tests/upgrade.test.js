const path = require('path');
const { pathToFileURL } = require('url');
let playwright;
try { playwright = require('playwright'); } catch (e) { playwright = require(require('child_process').execSync('npm root -g').toString().trim() + '/playwright'); }
const APP = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const SAMPLE_CSV = path.join(__dirname, '..', 'sample', 'sample-vocabulary.csv');
const TXT = pathToFileURL(path.join(__dirname, '..', 'sample', 'sample-vocabulary.txt')).href;
const OUT = require('os').tmpdir();
const { chromium } = playwright;
(async()=>{const b=await chromium.launch();const ctx=await b.newContext({viewport:{width:1280,height:800}});const p=await ctx.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto(TXT);
// build an OLD (version 1) database like the first release created
await p.evaluate(()=>new Promise((res,rej)=>{const r=indexedDB.open('lexi-vocabulary',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('words',{keyPath:'id'});d.createObjectStore('collections',{keyPath:'id'});d.createObjectStore('sessions',{keyPath:'id'});d.createObjectStore('settings',{keyPath:'key'})};
r.onsuccess=()=>{const d=r.result;const tx=d.transaction(['words','collections','sessions'],'readwrite');
tx.objectStore('collections').put({id:'c1',name:'Old list',createdAt:1});
tx.objectStore('words').put({id:'w1',en:'legacy',uz:'eski',collectionId:'c1',createdAt:1,updatedAt:1,correct:2,wrong:1,streak:0,lastSeenAt:null,lastWrongAt:5});
tx.objectStore('sessions').put({id:'s1',date:Date.now()-1000,label:'Old quiz',direction:'en-uz',scope:'all',total:4,correct:3,wrong:1,missedIds:[]});
tx.oncomplete=()=>{d.close();res()};tx.onerror=()=>rej(tx.error)};r.onerror=()=>rej(r.error)}));
await p.goto(APP + '#/vocabulary');await p.waitForSelector('#v-list tbody tr');
console.log('old word visible:',await p.locator('#v-list').innerText().then(t=>t.includes('legacy')));
const w=await p.evaluate(()=>VL.store.state.words[0]);console.log(JSON.stringify(w));
await p.goto(APP + '#/learn');await p.waitForSelector('.strip');
console.log('lessons on migrated data:');await p.click('[data-action=start][data-type=translate]').catch(()=>console.log('translate disabled?'));
await p.waitForTimeout(400);console.log('lesson started:',await p.locator('.lesson').count());
console.log('version',await p.evaluate(()=>new Promise(r=>{const q=indexedDB.open('lexi-vocabulary');q.onsuccess=()=>{r(q.result.version+' stores:'+[...q.result.objectStoreNames]);q.result.close()}})));
console.log('errors',errs);await b.close()})()
