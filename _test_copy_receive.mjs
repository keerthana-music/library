/* Copy on receive (2026-10-24): shared and approved pieces become real copies in the
   recipient's own archive. Run: cd site && node _test_copy_receive.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const tick=()=>new Promise(r=>setTimeout(r,40));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
const w=dom.window; await tick(); const E=s=>w.eval(s); const $=id=>w.document.getElementById(id);

const ID=s=>s.padEnd(28,'x');   // Drive-like ids (20+ chars)
w.__N1=ID('N1'); w.__R1=ID('R1'); w.__V1=ID('V1'); w.__N2=ID('N2');
ok(E(`_driveIdOf('https://drive.google.com/file/d/'+__N1+'/view')`)===w.__N1 && E(`_driveIdOf('https://drive.google.com/open?id='+__R1)`)===w.__R1 && E(`_driveIdOf('https://example.com/x.pdf')`)==='','notation id read from Drive links; other links give none');

function reset(o){ w.__o=o; E(`
  window.__made=[]; window.__copied=[]; window.__picked=null; window.__idx=[];
  ensureArchiveRoot=function(){ return Promise.resolve('ROOT'); };
  readIndex=function(){ return Promise.resolve({items:__o.have||[]}); };
  addToIndex=function(r,b){ __idx.push(b); return Promise.resolve(); };
  createBundle=function(r,s){ __made.push(s); return Promise.resolve('B'+__made.length); };
  driveMeta=function(id){ return Promise.resolve((__o.readable||[]).indexOf(id)>=0?{id:id,name:'file-'+id.slice(0,2)+'.pdf',mimeType:'application/pdf'}:null); };
  pickToGrant=function(ids,cb){ __picked=ids.slice(); cb((__o.pick||[]).filter(function(x){ return ids.indexOf(x.id)>=0; })); };
  driveCopy=function(id,name,parent){ __copied.push(id); if((__o.failCopy||[]).indexOf(id)>=0) return Promise.resolve(null);
    var d=(__o.pick||[]).filter(function(x){ return x.id===id; })[0]; return Promise.resolve({id:'C-'+id.slice(0,2),name:name,mimeType:(d&&d.mimeType)||'application/pdf'}); };
  toast=function(m){ window.__toast=m; };`); }

// 1. share link: notation already readable, recording needs the Picker; Continue; both copied
reset({readable:[w.__N1],pick:[{id:w.__R1,name:'Pallavi sangathi.mp3',mimeType:'audio/mpeg'}]});
E(`processImport({t:'bhajarE gOpAlam',r:'hindOLam',n:'https://drive.google.com/file/d/'+__N1+'/view',m:[{id:__R1,label:'Akka - class',mime:'audio/mpeg'}]})`);
await tick(); await tick();
ok($('kCopy') && $('kCopy').style.display==='flex' && /tick it and press Select/.test($('kcMsg').textContent),'asks before the Picker, for the one file it cannot read yet');
$('kcGo').click(); await tick(); await tick(); await tick();
ok(JSON.stringify(E('__picked'))===JSON.stringify([w.__R1]),'Picker offers only the unreadable file');
let made=E('__made');
ok(made[0] && made[0].type==='piece' && made[0].fileId==='C-N1' && made[0].notationUrl==='' && made[0].noPublic===true,'notation copied into the piece (not a link, not made public)');
ok(made[0].mediaLinks.length===0 && made[1] && made[1].type==='audio' && made[1].fileId==='C-R1' && made[1].title==='Akka - class' && made[1].parentTitle==='bhajarE gOpAlam','recording copied into the piece\'s media folder with its label');
ok(JSON.stringify(E('__idx'))==='["B1"]' && /Added/.test(E('__toast')) && !/link/.test(E('__toast')),'indexed once; toast says added, no links left');

// 2. Picker cancelled: notation still copied, recording stays a link
reset({readable:[w.__N1],pick:[]});
E(`processImport({t:'nIdu caraNamulE',n:'https://drive.google.com/file/d/'+__N1+'/view',m:[{id:__R1,label:'Class',mime:'audio/mpeg'}]})`);
await tick(); await tick(); $('kcGo').click(); await tick(); await tick(); await tick();
made=E('__made');
ok(made.length===1 && made[0].fileId==='C-N1' && made[0].mediaLinks.length===1 && made[0].mediaLinks[0].id===w.__R1,'cancelled Picker: recording kept as a link, nothing lost');
ok(/1 file kept as link/.test(E('__toast')),'toast mentions the link');

// 3. Skip: everything stays a link, no copies attempted for unreadable files
reset({readable:[],pick:[]});
E(`processImport({t:'x piece',n:'https://drive.google.com/file/d/'+__N1+'/view',m:[]})`);
await tick(); await tick(); $('kcSkip').click(); await tick(); await tick();
made=E('__made');
ok(made.length===1 && made[0].notationUrl.indexOf(w.__N1)>0 && !made[0].fileId && E('__copied').length===0,'Skip: notation kept as a link, no copy made');

// 4. copy fails: falls back to the link
reset({readable:[w.__N1],failCopy:[w.__N1]});
E(`processImport({t:'y piece',n:'https://drive.google.com/file/d/'+__N1+'/view'})`);
await tick(); await tick(); await tick();
made=E('__made'); ok(!$('kCopy')||$('kCopy').style.display==='none','no prompt when every file is already readable');
ok(made.length===1 && !made[0].fileId && made[0].notationUrl.indexOf(w.__N1)>0,'failed copy: notation kept as a link');

// 5. already in the archive: no prompt, nothing made
reset({have:[{title:'Z piece'}],readable:[]});
E(`processImport({t:'Z piece',n:'https://drive.google.com/file/d/'+__N1+'/view'})`); await tick(); await tick();
ok(E('__made').length===0 && (!$('kCopy')||$('kCopy').style.display==='none'),'duplicate: no prompt, nothing added');

// 6. approved master pieces: one Picker round for all files of all pieces; video detected
reset({readable:[],pick:[{id:w.__N1,name:'Vatapi.pdf',mimeType:'application/pdf'},{id:w.__V1,name:'Class video.mp4',mimeType:'video/mp4'},{id:w.__N2,name:'Ninnukori.pdf',mimeType:'application/pdf'}]});
E(`window.__calls=[]; svc=function(a,b){ __calls.push(a);
     if(a==='pending') return Promise.resolve({ok:true,items:[{key:'k1',t:'Vatapi Ganapatim',r:'hamsadhwani',n:__N1,m:[{id:__V1,label:'Recording',mime:'video/mp4'}]},{key:'k2',t:'Ninnukori',n:__N2,m:[]}]});
     return Promise.resolve({ok:true}); }; checkApproved();`);
await tick(); $('pkGo').click(); await tick(); await tick();
ok($('kCopy').style.display==='flex' && /3 files/.test($('kcMsg').textContent),'approved pieces: one prompt covering all 3 files');
$('kcGo').click(); for(let i=0;i<6;i++) await tick();
made=E('__made');
ok(E('__picked').length===3,'one Picker round for both pieces');
ok(made.filter(m=>m.type==='piece').length===2 && made.find(m=>m.type==='video' && m.title==='Class video' && m.fileId==='C-V1'),'both pieces filed; the video copied, named from its file');
ok(E('__calls').includes('delivered') && /Added 2 pieces/.test(E('__toast')),'marked delivered; toast says 2 added');

if(fails) process.exitCode=1; else console.log('ALL COPY-ON-RECEIVE TESTS PASSED');
