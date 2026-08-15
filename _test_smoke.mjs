/* Smoke tests for site/index.html.
   Run:  cd site && npm i --no-save jsdom && node _test_smoke.mjs             */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let JSDOM;
try { ({ JSDOM } = await import('jsdom')); }
catch { console.error('jsdom not found. Run:  npm i --no-save jsdom  (from the site/ folder)'); process.exit(2); }

const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://keerthana-music.github.io/library/',
  beforeParse(w) {
    w.fetch = () => Promise.reject(new Error('stubbed fetch'));
    w.google = { accounts:{ oauth2:{ initTokenClient:()=>({requestAccessToken(){}}) } } };
    w.scrollTo = ()=>{};
  }
});

const w = dom.window;
const ev = s => w.eval(s);
const assert = (c,m)=>{ if(!c){ console.error('FAIL:',m); process.exitCode=1; } else console.log('ok:',m); };

await new Promise(r=>setTimeout(r,50));

// 1. New functions + elements exist (function decls are visible via eval)
['buildArchiveFilters','loadArchive','rArchive','applyAuthView'].forEach(fn =>
  assert(ev('typeof '+fn)==='function', fn+' defined'));
['fRagaA','fTypeA','fComposerA'].forEach(id =>
  assert(w.document.getElementById(id)!==null, 'select #'+id+' present'));

// Neutralise the renderers within the script's own scope so tab-clicks don't hit the network.
ev('rMaster=function(){}; rArchive=function(){}; rCon=function(){}; rResources=function(){}; rBrowse=function(){};');

// 2. Concert-tab hiding by role.
//    The only roles are teacher | admin | user (roleRank/roleLabel/setRole). There is no
//    'master' role — onMaster() is a predicate meaning "working on the master archive"
//    (teacher||admin). This test used to set AS.role='master', which matches nothing, so it
//    asserted against a role that can never exist and failed for the wrong reason.
//    The concert planner reads the personal archive, which master mode never loads, so it
//    must be hidden for BOTH master roles.
const conBtn = w.document.querySelector('.tabs button[data-tab="concert"]');
ev("AS.email='x@y.com'; AS.token='t';");
assert(ev("typeof onMaster")==='function', 'onMaster defined');
ev("AS.role='admin'; applyAuthView();");
assert(conBtn.style.display==='none', 'Concert tab hidden for Admin');
ev("AS.role='teacher'; applyAuthView();");
assert(conBtn.style.display==='none', 'Concert tab hidden for Teacher');
ev("AS.role='user'; applyAuthView();");
assert(conBtn.style.display==='', 'Concert tab visible for User');
assert(ev("onMaster()")===false, 'onMaster() false for User');

// 3. Archive filter logic — restore the real rArchive, seed the cache, exercise filters.
// (reload the page fresh to get the genuine rArchive back)
const dom2 = new JSDOM(html, { runScripts:'dangerously', pretendToBeVisual:true,
  url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.fetch=()=>Promise.reject(new Error('stub')); w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.scrollTo=()=>{}; }});
const w2=dom2.window; const ev2=s=>w2.eval(s);
await new Promise(r=>setTimeout(r,50));

ev2('_arcIdx = { items: [\
  {id:"a",title:"kanakana",raga:"varALi",composer:"Tyaagaraaja",pieceType:"kriti"},\
  {id:"b",title:"sarasija",raga:"kAmbhOji",composer:"VaDivElu",pieceType:"varnam - taana"},\
  {id:"c",title:"bhavanutha",raga:"mOhana",composer:"Tyaagaraaja",pieceType:"kriti"}\
] };');
ev2("AS.token='t';");
ev2('buildArchiveFilters(_arcIdx.items);');
const fRagaA=w2.document.getElementById('fRagaA');
assert(fRagaA.options.length===4, 'fRagaA has 3 ragas + "All" (got '+fRagaA.options.length+')');
const fTypeA=w2.document.getElementById('fTypeA');
assert(fTypeA.options.length===3, 'fTypeA has 2 types + "All" (got '+fTypeA.options.length+')');

fRagaA.value='varALi';
ev2('rArchive();');
let cards=w2.document.getElementById('arcList').innerHTML;
assert(cards.includes('kanakana') && !cards.includes('bhavanutha') && !cards.includes('sarasija'), 'raga filter narrows to varALi only');

fRagaA.value='';
w2.document.getElementById('fComposerA').value='Tyaagaraaja';
ev2('rArchive();');
cards=w2.document.getElementById('arcList').innerHTML;
assert(cards.includes('kanakana') && cards.includes('bhavanutha') && !cards.includes('sarasija'), 'composer filter keeps both Tyaagaraaja pieces');

// search box still works alongside dropdowns
w2.document.getElementById('fComposerA').value='';
w2.document.getElementById('qArc').value='sarasija';
ev2('rArchive();');
cards=w2.document.getElementById('arcList').innerHTML;
assert(cards.includes('sarasija') && !cards.includes('kanakana'), 'search box filters to sarasija');

// 4. matchFile: the regression that made a whole trial batch come back "unidentified".
//    The old matchFile did a single exact lookup on normKey(whole filename), so any name
//    carrying more than the bare title ("Title - Raga", "(copy)") matched nothing at all.
//    Keys are derived with normKey rather than hand-written, exactly as the shipped
//    krithi-dictionary.json precomputes them (all 8028 agree with normKey).
ev2(`_dict=[
  {name:'paahi durgE (note)', raga:'shankaraabharaNam', composer:'Muttuswaamee Dikshitar'},
  {name:'raamajOgi mandu', raga:'vasantaa', composer:'Badraacala Raamadaas'},
  {name:'raaraa raghuveera', raga:'aThaaNaa', composer:'Tyaagaraaja'}
];
_dict.forEach(function(e){ e.key=normKey(e.name); });
_dictKey={}; _dict.forEach(function(e){ _dictKey[e.key]=e; });
_fzDict=null; _fzCat=null;`);

const mf = q => ev2('matchFile('+JSON.stringify(q)+')');

let r = mf('Pahi Durge - Shankarabharanam.pdf');
assert(r.match!=='none', 'matchFile: "Title - Raga" no longer misses (was the whole-batch bug)');
assert(r.title==='paahi durgE (note)', 'matchFile: adopts the canonical dictionary spelling');

r = mf('Pahi Durge - Shankarabharanam (copy).pdf');
assert(r.title==='paahi durgE (note)', 'matchFile: "(copy)" suffix ignored');

// Akka's notation is authoritative for raga; karnatik's value is surfaced, not silently kept.
r = mf('Ramajogi Mandukonare - Kamas.pdf');
assert(r.raga==='Kamas', 'matchFile: filename raga overrides the dictionary');
assert(r.ragaAlt==='vasantaa', 'matchFile: the overridden dictionary raga is surfaced for review');

// Nothing in the dictionary (all the Thiruppugazh) still yields title + raga from the filename.
r = mf('Thullumatha Velkai Kanaiyale - Hamsanandi.pdf');
assert(r.match==='none', 'matchFile: genuinely absent piece stays unidentified');
assert(r.title==='Thullumatha Velkai Kanaiyale' && r.raga==='Hamsanandi',
       'matchFile: unmatched row still prefilled from the filename');

r = mf('raaraa raghuveera.pdf');
assert(r.match==='dictionary' && r.title==='raaraa raghuveera', 'matchFile: exact legacy name still matches');

console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'ALL SMOKE TESTS PASSED');
