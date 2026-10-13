/* Notes on a piece (2026-10-13). Run: cd site && node _test_notes.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const tick=()=>new Promise(r=>setTimeout(r,40));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
const w=dom.window; await tick(); w.__pwned=0; const E=s=>w.eval(s); const $=id=>w.document.getElementById(id);
// cleanNotes
const cn=E(`cleanNotes([{d:'2024-03-01',text:'  First learned with Akka  '},{text:'',url:''},{d:'March',text:'x',url:'javascript:alert(1)'},{url:'https://youtu.be/abc'}])`);
ok(cn.length===3,'empty notes dropped');
ok(cn[0].text==='First learned with Akka' && cn[0].d==='2024-03-01','text trimmed, date kept');
ok(cn[1].d==='' && cn[1].url==='','bad date and javascript: link dropped');
// index item + card
const tree={folderId:'P1',meta:{type:'piece',title:'Bhaja Govindam',meta:{raga:'yamunAkalyANi',notes:[
  {d:'2024-03-01',text:'First learned with Akka'},{text:'MS Subbulakshmi concert',url:'https://www.youtube.com/watch?v=xyz'},
  {text:'<img src=x onerror=__pwned++>',url:'https://example.com/lyrics'}]}},files:[{name:'bundle.json'}],children:[]};
w.__tree=tree; const it=E('_indexItem(__tree)');
ok(it.notes.length===3,'index item carries the notes');
w.__it=it; const d=w.document.createElement('div'); d.innerHTML=E('_indexCard(__it)'); w.document.body.appendChild(d);
ok(d.querySelector('details.notes summary').textContent.includes('Notes (3)'),'card shows Notes (3)');
const med=[...d.querySelectorAll('details.media:not(.notes) a')];
ok(med.length===1 && med[0].href.includes('youtube.com') && med[0].textContent.includes('MS Subbulakshmi'),'the YouTube link also appears under Media; the lyrics page does not');
ok(!d.querySelector('img') && w.__pwned===0,'hostile note text shown as text');
ok(d.querySelector('.piece button.plink'),'audio-only piece with a recording link: tapping the name opens Media');
// share link does not carry notes
E(`_arcIdx={items:[__it]}; onMaster=function(){return false;}; _shareLink=function(t,u){ window.__share=u; };`);
E("shareBundle('P1')");
const payload=JSON.parse(decodeURIComponent(escape(w.atob(decodeURIComponent(w.__share.split('import=')[1]).replace(/-/g,'+').replace(/_/g,'/')))));
ok(!JSON.stringify(payload).includes('Akka') && !JSON.stringify(payload).includes('youtube'),'share link carries no notes');
// Edit screen: shows notes, add, remove, save
E("openEdit('P1')");
ok($('edNotes').querySelectorAll('.ednote').length===3,'Edit screen lists the notes');
ok(/^\d{4}-\d{2}-\d{2}$/.test($('edNoteD').value),'new-note date defaults to today');
$('edNoteT').value='Sang at Navaratri'; $('edNoteU').value='open.spotify.com/track/1'; $('edNoteAdd').click();
ok($('edNotes').querySelectorAll('.ednote').length===4 && E('_edNotes[3].url')==='https://open.spotify.com/track/1','add a note; a bare link gets https://');
$('edNotes').querySelectorAll('.ednote button')[0].click();
ok(E('_edNotes.length')===3 && E('_edNotes[0].text')==='MS Subbulakshmi concert','remove a note');
$('edNoteU').value='not a link at all'; E('window.__t=""; toast=function(m){ window.__t=m; }'); $('edNoteAdd').click();
ok(E('_edNotes.length')===3 && /does not look right/.test(E('__t')),'a broken link is refused with a message');
$('edNoteU').value='';
E(`_editRoot=function(){return 'ROOT';}; readBundle=function(){ return Promise.resolve({meta:JSON.parse(JSON.stringify(__tree.meta))}); };
   driveUpdateBundleJson=function(id,m){ window.__saved=m; return Promise.resolve('x'); }; addToIndex=function(){ return Promise.resolve(); };`);
$('edNoteT').value='Typed but not added'; $('edSave').click(); await tick();
const sv=E('__saved');
ok(sv && sv.meta.notes.length===4,'Save writes the notes to bundle.json (a typed-but-not-added note is kept)');
ok(sv.meta.raga==='yamunAkalyANi','other details unchanged');
if(fails) process.exitCode=1; else console.log('ALL NOTES TESTS PASSED');
