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

// 5. Tala now travels with a dictionary match — karnatik_enrich.py added it to the
//    ~78% of dictionary entries whose karnatik page states a taaLam.
ev2(`_dict=[
  {name:'paahi durgE (note)', raga:'shankaraabharaNam', composer:'Muttuswaamee Dikshitar', tala:'roopaka'},
  {name:'no tala here', raga:'tODi', composer:'Tyaagaraaja'}
];
_dict.forEach(function(e){ e.key=normKey(e.name); });
_dictKey={}; _dict.forEach(function(e){ _dictKey[e.key]=e; });
_fzDict=null; _fzCat=null; _vocab=null;`);

r = mf('Pahi Durge - Shankarabharanam.pdf');
assert(r.tala==='roopaka', 'matchFile: karnatik tala reaches the row');

r = mf('no tala here.pdf');
assert(r.tala==='', 'matchFile: an entry without a tala leaves the box empty rather than guessing');

// A catalogue match should keep the catalogue's own tala.
r = mf('kanakana ruchirA - varALi.pdf');
assert(r.match==='catalog' && r.tala==='aadi', 'matchFile: catalogue match keeps the catalogue tala');

// 6. The pick-lists: master catalogue first, then karnatik, deduped case-insensitively.
ev2(`_dict=[
  {name:'x', raga:'someNewRaga', composer:'Some New Composer', tala:'tishra Eka'},
  {name:'y', raga:'SOMENEWRAGA',  composer:'tyaagaraaja',      tala:'aadi'},
  {name:'z', raga:'?',            composer:'',                 tala:''}
];
_dict.forEach(function(e){ e.key=normKey(e.name); });
_vocab=null;`);
const V = ev2('vocab()');
assert(V.ragas[0]==='AbhOgi', 'vocab: master catalogue ragas come first (got '+V.ragas[0]+')');
assert(V.ragas.indexOf('someNewRaga')>=0 && V.ragas.indexOf('SOMENEWRAGA')<0,
       'vocab: karnatik ragas follow, case-variant duplicates dropped');
assert(V.ragas.indexOf('?')<0, 'vocab: junk entries dropped');
assert(V.composers.filter(c=>c.toLowerCase()==='tyaagaraaja').length===1,
       'vocab: a composer in both sources appears once');
assert(V.talas.indexOf('aadi')>=0 && V.talas.indexOf('tishra Eka')>=0,
       'vocab: talas merge the catalogue and karnatik sets');
// The Eka talas the school sings are not in the master catalogue's 85 pieces, so they
// must be seeded by hand — and must land in the first group, not karnatik's tail.
const nHouse = 7 + 3;   // META.talas + HOUSE_TALAS
['Eka','tishra Eka','khaNDa Eka'].forEach(t =>
  assert(V.talas.indexOf(t)>=0 && V.talas.indexOf(t)<nHouse,
         'vocab: "'+t+'" sits with the school\'s talas (at '+V.talas.indexOf(t)+')'));
assert(V.talas.filter(t=>t.toLowerCase()==='tishra eka').length===1,
       'vocab: a seeded tala that karnatik also lists appears once');

// 7. The review rows render three pick-lists, shared across the whole batch.
ev2(`_impRows([{kind:'new', file:{id:'f1',name:'Pahi Durge - Shankarabharanam.pdf'}, prop:matchFile('Pahi Durge - Shankarabharanam.pdf')}],0);`);
const d2 = w2.document;
['imRagaL','imTalaL','imCompL'].forEach(id =>
  assert(d2.getElementById(id)!==null, 'datalist #'+id+' present'));
assert(d2.querySelector('#kImp2 input[data-f="tala"]')!==null, 'review row has a tala field');
assert(d2.querySelector('#kImp2 input[data-f="raga"]').getAttribute('list')==='imRagaL',
       'review row raga field is wired to its list');
assert(d2.querySelectorAll('#imDL datalist').length===3, 'datalists built once for the batch, not per row');
// Two rows must still share the one set of lists.
ev2(`_impRows([{kind:'new', file:{id:'f1',name:'a.pdf'}, prop:matchFile('a.pdf')},
              {kind:'new', file:{id:'f2',name:'b.pdf'}, prop:matchFile('b.pdf')}],0);`);
assert(d2.querySelectorAll('#imDL datalist').length===3 && d2.querySelectorAll('#kImp2 .irow').length===2,
       'a second row reuses the same lists');

// 8. Replacing a notation. Swapping the PDF by hand in Drive silently breaks the
//    bundle — same-named uploads leave two files and _notationFileId picks whichever
//    the listing returns first; delete-and-upload orphans the cached notationId and
//    loses the public permission. replaceNotation has to do the whole sequence.
ev2(`_log=[];
driveListChildren=function(id){ _log.push('list:'+id);
  return Promise.resolve(id==='B' ? [
    {id:'bj', name:'bundle.json', mimeType:'application/json'},
    {id:'OLD', name:'old.pdf', mimeType:'application/pdf'},
    {id:'sub', name:'audio', mimeType:'application/vnd.google-apps.folder'}
  ] : []); };
driveMoveInto=function(f,t){ _log.push('move:'+f+'->'+t); return Promise.resolve({id:f}); };
driveMakePublic=function(f){ _log.push('public:'+f); return Promise.resolve({}); };
ensureTrashFolder=function(){ _log.push('trash'); return Promise.resolve('TRASH'); };
readBundle=function(id){ return Promise.resolve({folderId:id, meta:{schema:'kms-bundle/1',type:'piece',title:'t',
  notationUrl:'https://example.test/old', files:['old.pdf'], meta:{raga:'tODi'}}, files:[]}); };
driveUpdateBundleJson=function(id,obj){ _log.push('bundlejson:'+id); _written=obj; return Promise.resolve('bj'); };
addToIndex=function(root,id){ _log.push('index:'+root+'/'+id); return Promise.resolve({}); };`);

const replaced = await w2.eval("replaceNotation('B','ROOT',{fileId:'NEW',fileName:'new.pdf'})");
const log = ev2('_log'), written = ev2('_written');

assert(log.indexOf('move:OLD->TRASH')>=0, 'replaceNotation: the file being replaced goes to the Trash folder');
assert(log.indexOf('move:bj->TRASH')<0 && log.indexOf('move:sub->TRASH')<0,
       'replaceNotation: bundle.json and child bundles are left alone');
assert(log.indexOf('move:NEW->B')>=0, 'replaceNotation: the new file is moved into the bundle');
assert(log.indexOf('move:OLD->TRASH') < log.indexOf('move:NEW->B'),
       'replaceNotation: the old file leaves before the new one arrives, so the folder never holds two');
assert(log.indexOf('public:NEW')>=0, 'replaceNotation: the new file gets the anyone-with-the-link permission');
assert(written && written.files && written.files[0]==='new.pdf', 'replaceNotation: bundle.json records the new filename');
assert(written && written.notationUrl==='',
       'replaceNotation: a stale notationUrl is cleared, or the replacement would never be what opens');
assert(log.indexOf('index:ROOT/B')>=0, 'replaceNotation: the index is updated so the card links to the new file');
assert(Array.isArray(replaced) && replaced[0]==='old.pdf', 'replaceNotation: reports what it moved aside');

// Re-picking the file that is already there must not throw it away.
ev2('_log=[];');
await w2.eval("replaceNotation('B','ROOT',{fileId:'OLD',fileName:'old.pdf'})");
assert(ev2('_log').indexOf('move:OLD->TRASH')<0, 'replaceNotation: re-picking the current file does not trash it');

// 9. The two new controls exist and are wired.
assert(ev2('typeof rebuildArchive')==='function', 'rebuildArchive defined');
assert(d2.getElementById('arcRebuild')!==null, 'archive has a rebuild button');
assert(d2.getElementById('edReplace')!==null, 'edit modal has a Replace notation button');
assert(d2.getElementById('edNota')!==null, 'edit modal names the current notation');

console.log(process.exitCode ? 'SMOKE TEST FAILED' : 'ALL SMOKE TESTS PASSED');
