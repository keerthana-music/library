/* Tags + media tests (2026-10-11). Run: cd site && node _test_tags_media.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const tick=()=>new Promise(r=>setTimeout(r,40));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
const w=dom.window; await tick(); w.__pwned=0; const E=s=>w.eval(s);
// cleanTags
ok(JSON.stringify(E("cleanTags(' #Sankeerthana, navaratri ,sankeerthana,, ')"))==='["Sankeerthana","navaratri"]','tags: trimmed, # dropped, de-duplicated ignoring case');
// index item from a tree with a media folder, an old audio folder, a note, and media links
const tree={folderId:'P1',meta:{type:'piece',title:'Bhaja Govindam',meta:{raga:'Yamunakalyani',tags:['Sankeerthana']},
  mediaLinks:[{id:'L1',label:'From master',mime:'audio/mpeg'},{id:'bad"id',label:'x'}]},files:[{name:'bundle.json'}],
  children:[{folderId:'M',type:'media',meta:{type:'media',meta:{labels:{'akka.mp3':'Akka'}}},files:[{name:'bundle.json'},{id:'F1',name:'akka.mp3',mimeType:'audio/mpeg'},{id:'F2',name:'class_2.m4a',mimeType:'audio/mp4'},{id:'F3',name:'<img src=x onerror=__pwned++>.mp4',mimeType:'video/mp4'}],children:[]},
            {folderId:'A',type:'audio',meta:{type:'audio'},files:[{id:'F4',name:'old.mp3',mimeType:'audio/mpeg'}],children:[]},
            {folderId:'N',type:'note',meta:{type:'note',label:'My notes'},files:[],children:[]}]};
w.__tree=tree; const it=E('_indexItem(__tree)');
ok(it.media.length===5,'media: 3 in media folder + 1 old audio folder + 1 link (bad id dropped)');
ok(it.media[0].label==='Akka' && it.media[1].label==='class 2','labels: from the label file, else from the file name');
ok(it.children.length===1 && it.children[0].type==='note','media folders are not listed again as sub-items');
ok(it.notationId==='','no notation for an audio-only piece');
w.__it=it; const d=w.document.createElement('div'); d.innerHTML=E('_indexCard(__it)'); w.document.body.appendChild(d);
ok(d.querySelector('.chip.tag') && d.querySelector('.chip.tag').textContent==='#Sankeerthana','tag chip on the card');
const links=[...d.querySelectorAll('details.media a')];
ok(d.querySelector('details.media summary').textContent.includes('Media (5)') && links.length===5,'card shows Media (5) with five play links');
ok(links.every(a=>/^https:\/\/drive\.google\.com\/file\/d\/[\w-]+\/view$/.test(a.href)),'play links are plain Drive links');
ok(!d.querySelector('details.media img') && w.__pwned===0,'hostile file name shown as text');
ok(!d.querySelector('a[title="Open"]'),'no PDF icon when there is no notation');
// tag filter + search in My Archive
E(`AS.token='t'; _arcIdx={items:[__it,{id:'P2',title:'Vatapi Ganapatim',raga:'Hamsadhvani',tags:[]}]}; buildArchiveFilters(_arcIdx.items);`);
const fTagA=w.document.getElementById('fTagA'); ok([...fTagA.options].some(o=>o.value==='Sankeerthana'),'tag filter lists Sankeerthana');
fTagA.value='Sankeerthana'; E('rArchive()'); await tick();
ok(w.document.querySelectorAll('#arcList .card').length===1,'filtering by tag shows only tagged pieces');
fTagA.value=''; w.document.getElementById('qArc').value='sankeer'; E('rArchive()'); await tick();
ok(w.document.querySelectorAll('#arcList .card').length===1,'typing a tag in search finds the piece');
// Edit screen shows tags
E("onMaster=function(){return false;}; openEdit('P1')");
ok(w.document.getElementById('edTags').value==='Sankeerthana','Edit screen shows the tags');
// Adding your own recording goes into the piece's media folder with a label
E(`window.__saved=null; driveEnsureFolder=function(n,p){ return Promise.resolve(n==='media'?'MEDIA':'PIECE'); };
   driveMoveInto=function(){return Promise.resolve();}; readBundle=function(){return Promise.resolve({meta:{type:'media',meta:{labels:{'a.mp3':'Akka'}},files:['a.mp3']}});};
   driveUpdateBundleJson=function(id,m){ window.__saved={id:id,m:m}; return Promise.resolve('x'); };
   createBundle('ROOT',{type:'audio',title:'My practice, 12 Oct',fileId:'U1',fileName:'rec.m4a',parentTitle:'Bhaja Govindam',parentRaga:'Yamunakalyani'}).then(function(p){ window.__pid=p; });`);
await tick();
const sv=w.__saved; ok(sv && sv.id==='MEDIA' && sv.m.type==='media' && JSON.stringify(sv.m.files)==='["a.mp3","rec.m4a"]' && sv.m.meta.labels['rec.m4a']==='My practice, 12 Oct' && sv.m.meta.labels['a.mp3']==='Akka','own recording added to the media folder with its label, existing ones kept');
ok(w.__pid==='PIECE','index refresh targets the piece');
// shares carry tags
E(`window.__spec=null; createBundle=function(r,s){ window.__spec=s; return Promise.resolve('B'); }; addToIndex=function(){return Promise.resolve();};
   ensureArchiveRoot=function(){return Promise.resolve('ROOT');}; readIndex=function(){return Promise.resolve({items:[]});};
   processImport({t:'Bhaja Govindam',n:'https://drive.google.com/file/d/X/view',tg:['Sankeerthana','<b>x</b>']});`);
await tick();
ok(w.__spec && JSON.stringify(w.__spec.tags)==='["Sankeerthana","<b>x</b>"]','a shared piece keeps its tags (shown escaped)');
if(fails) process.exitCode=1; else console.log('ALL TAGS+MEDIA TESTS PASSED');
/* ---- 2026-10-11 b: notation for audio-only pieces ---- */
{
  const dom2=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
    beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
  const v=dom2.window; await tick(); const V=s=>v.eval(s);
  V(`AS.token='t'; onMaster=function(){return false;}; _arcRoot='ROOT';
     _arcIdx={items:[{id:'AUD',title:'pAlise enna',media:[{id:'M1',label:'x'}]},{id:'PDF',title:'Vatapi Ganapatim',notationId:'N1'}]};
     driveListChildren=function(id){ return Promise.resolve(id==='AUD'?[{name:'bundle.json'},{name:'media',mimeType:'application/vnd.google-apps.folder'}]:[{name:'bundle.json'},{id:'N1',name:'v.pdf',mimeType:'application/pdf'}]); };
     openEdit('AUD');`);
  await tick();
  ok(v.document.getElementById('edReplace').textContent==='Add notation…','Edit: an audio-only piece offers "Add notation…"');
  V("openEdit('PDF')"); await tick();
  ok(v.document.getElementById('edReplace').textContent==='Replace notation…','Edit: a piece with a PDF offers "Replace notation…"');
}
if(fails) process.exitCode=1; else console.log('ALL NOTATION TESTS PASSED');
/* ---- tap the name ---- */
{
  const dom3=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
    beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
  const v=dom3.window; await tick();
  const card=it=>{ v.__it=it; const d=v.document.createElement('div'); d.innerHTML=v.eval('_indexCard(__it)'); v.document.body.appendChild(d); return d; };
  let d=card({id:'A',title:'Vatapi',notationId:'N1'});
  ok(d.querySelector('.piece a.plink').href==='https://drive.google.com/file/d/N1/view','tapping the name opens the PDF');
  d=card({id:'B',title:'Shared',notationUrl:'javascript:alert(1)'});
  ok(!d.querySelector('.piece a'),'a bad link is never put on the name');
  d=card({id:'C',title:'Bhajan',media:[{id:'M1',label:'Akka'}]});
  const b=d.querySelector('.piece button.plink'); b.click();
  ok(d.querySelector('details.media').open===true,'an audio-only piece: tapping the name opens its recordings');
  d=card({id:'D',title:"It's <b>x</b>"});
  ok(!d.querySelector('.piece b') && d.querySelector('.piece').textContent==="It's <b>x</b>",'a name with nothing to open stays plain text');
}
if(fails) process.exitCode=1; else console.log('ALL NAME-TAP TESTS PASSED');
