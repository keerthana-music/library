/* Sharing a piece with chosen recordings (2026-10-13). Run: cd site && node _test_share_media.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const tick=()=>new Promise(r=>setTimeout(r,40));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
const w=dom.window; await tick(); const E=s=>w.eval(s); const $=id=>w.document.getElementById(id);
E(`window.__pub=[]; driveMakePublic=function(id){ __pub.push(id); return Promise.resolve({}); };
   _shareLink=function(t,u){ window.__share=u; };
   window.__it={id:'P1',title:'bhajarE gOpAlam',raga:'hindOLam',notationId:'N1',tags:['Sankeerthana'],
     media:[{id:'R1',label:'Akka - class',mime:'audio/mpeg'},{id:'R2',label:'My practice, 12 Oct',mime:'audio/mp4'}],
     notes:[{text:'my youtube',url:'https://youtu.be/x'}]};`);
const payload=()=>E('_unb64(decodeURIComponent(__share.split("import=")[1]))');
// personal archive: chooser, nothing ticked
E(`onMaster=function(){return false;}; _arcIdx={items:[__it]}; window.__share=null; __pub=[]; shareBundle('P1')`);
ok($('kShare') && $('kShare').style.display==='flex' && !E('__share'),'personal share with recordings: the checklist opens first');
const boxes=[...$('kShare').querySelectorAll('input[data-i]')];
ok(boxes.length===2 && boxes.every(b=>!b.checked),'both recordings listed, none ticked');
boxes[0].checked=true; $('shGo').click();
let p=payload();
ok(p.m && p.m.length===1 && p.m[0]==='R1','only the ticked recording goes in the link (as a bare ID)');
ok(E('__pub').includes('R1') && !E('__pub').includes('R2'),'only the ticked recording is made link-viewable');
ok(!JSON.stringify(p).includes('youtu'),'web links in notes are not shared');
// personal share, nothing ticked
E(`window.__share=null; __pub=[]; shareBundle('P1')`); $('shGo').click();
p=payload(); ok(!p.m && !E('__pub').includes('R1') && !E('__pub').includes('R2'),'share with nothing ticked: no recordings, nothing made public');
// cancel
E(`window.__share=null; shareBundle('P1')`); $('shNo').click();
ok(!E('__share'),'cancel shares nothing');
// master: one tap, all
E(`onMaster=function(){return true;}; _masterIdx={items:[__it]}; window.__share=null; __pub=[]; $=null; shareBundle('P1')`);
p=payload(); ok(p.m && p.m.length===2 && E('__pub').length===3,'from Master: all recordings shared in one tap (plus notation)');
// no media: straight through
E(`onMaster=function(){return false;}; _arcIdx={items:[{id:'P2',title:'x',notationId:'N2',media:[]}]}; window.__share=null; shareBundle('P2')`);
ok(!!E('__share'),'a piece without recordings shares straight away');
// receiving side: recordings become media links on the new piece
E(`window.__spec=null; ensureArchiveRoot=function(){return Promise.resolve('ROOT');}; readIndex=function(){return Promise.resolve({items:[]});};
   createBundle=function(r,s){ window.__spec=s; return Promise.resolve('B1'); }; addToIndex=function(){return Promise.resolve();};
   processImport({t:'bhajarE gOpAlam',n:'https://drive.google.com/file/d/N1/view',m:[{id:'R1',label:'Akka - class',mime:'audio/mpeg'},{id:'bad"id',label:'x'}]});`);
await tick();
const sp=E('__spec'); ok(sp && sp.mediaLinks.length===1 && sp.mediaLinks[0].id==='R1','recipient gets the shared recording (bad ids dropped)');
// short links (2026-10-20): bare IDs, names looked up from Drive on the recipient's side
E(`window.__spec=null; window.fetch=function(u){ return Promise.resolve({ok:true,json:function(){ return Promise.resolve(String(u).includes('R7')?{name:'Pallavi sangathi.mp3',mimeType:'audio/mpeg'}:{}); }}); };
   processImport({t:'nIdu caraNamulE',m:['R7','R8','bad"id']});`);
await tick(); await tick();
const sp2=E('__spec'); ok(sp2 && sp2.mediaLinks.length===2 && sp2.mediaLinks[0].label==='Pallavi sangathi' && sp2.mediaLinks[1].label==='Recording','short link: recordings imported with their Drive names');
if(fails) process.exitCode=1; else console.log('ALL SHARE-MEDIA TESTS PASSED');
