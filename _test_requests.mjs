/* Request from Master Archive tests (2026-10-11). Run: cd site && node _test_requests.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const tick=()=>new Promise(r=>setTimeout(r,40));
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}};
    w.__calls=[];
    w.fetch=(u,o)=>{ const J=x=>Promise.resolve({json:()=>Promise.resolve(x)});
      if(o&&o.method==='POST'&&String(u).includes('script.google')){ const b=JSON.parse(o.body); w.__calls.push(b);
        if(b.action==='catalog') return J({ok:true,items:[{id:'p1',t:'Vatapi Ganapatim',r:'Hamsadhvani',tl:'Adi',c:'Dikshitar'},
          {id:'p2',t:'<img src=x onerror=__pwned++>',r:'',tl:'',c:''},{id:'p3',t:'Endaro Mahanubhavulu',r:'Sri',tl:'Adi',c:'Tyagaraja'}]});
        if(b.action==='request') return J({ok:true,added:b.ids.length,skipped:0});
        if(b.action==='pending') return J({ok:true,items:[{key:'k1',t:'Vatapi Ganapatim',r:'Hamsadhvani',tl:'Adi',c:'Dikshitar',n:'FILE1'},
          {key:'k2',t:'Endaro Mahanubhavulu',r:'Sri',tl:'Adi',c:'Tyagaraja',n:'FILE3'}]});
        if(b.action==='delivered') return J({ok:true,marked:b.keys.length});
        return J({ok:true,member:true,role:'user'}); }
      return Promise.reject(new Error('stub')); }; }});
const w=dom.window; await tick(); w.__pwned=0;
w.eval(`AUTH.MEMBERS_URL='https://script.google.com/macros/s/X/exec'; AS.token='tok'; AS.email='mum@gmail.com'; AS.role='user';
  window.__made=[]; ensureArchiveRoot=function(){return Promise.resolve('ROOT');};
  readIndex=function(){return Promise.resolve({items:[{title:'Endaro Mahanubhavulu'}]});};
  createBundle=function(root,spec){ __made.push(spec); return Promise.resolve('B'+__made.length); };
  addToIndex=function(){return Promise.resolve();};`);
// Resources entry
w.eval('rResources()');
ok(!!w.document.querySelector('#resList .reqcard button'),'Resources shows the Request from Master Archive card for a User');
// Browse
w.eval('openRequest()'); await tick();
const boxes=[...w.document.querySelectorAll('#rqList input[type=checkbox]')];
ok(boxes.length===3,'master list shows 3 pieces');
ok(w.__pwned===0 && !w.document.querySelector('#rqList img'),'hostile title shown as text');
const endaro=boxes.find(b=>b.getAttribute('data-id')==='p3'); ok(endaro.disabled,'piece already in the archive cannot be ticked');
ok(w.document.getElementById('rqGo').disabled,'Send disabled with nothing ticked');
const vatapi=boxes.find(b=>b.getAttribute('data-id')==='p1'); vatapi.checked=true; vatapi.dispatchEvent(new w.Event('change',{bubbles:true}));
ok(!w.document.getElementById('rqGo').disabled && w.document.getElementById('rqN').textContent==='1 selected','ticking enables Send');
const q=w.document.getElementById('rqQ'); q.value='hamsa'; q.dispatchEvent(new w.Event('input'));
ok(w.document.querySelectorAll('#rqList input').length===1,'search by raga narrows the list');
w.document.getElementById('rqGo').click(); await tick();
const req=w.__calls.find(c=>c.action==='request'); ok(req && JSON.stringify(req.ids)==='["p1"]' && req.token==='tok','request sends the ticked id with the token');
ok(w.document.getElementById('kReq').style.display==='none','screen closes after sending');
// Pickup
w.eval('checkApproved()'); await tick();
ok(w.document.getElementById('kPick').style.display==='flex' && w.document.getElementById('pkH').textContent.startsWith('2 approved'),'sign-in shows 2 approved pieces');
w.document.getElementById('pkGo').click(); await tick(); await tick();
const made=w.eval('__made'); ok(made.length===1 && made[0].title==='Vatapi Ganapatim' && made[0].notationUrl==='https://drive.google.com/file/d/FILE1/view','adds the new piece as a link bundle, skips the one already there');
const del=w.__calls.find(c=>c.action==='delivered'); ok(del && JSON.stringify(del.keys)==='["k1","k2"]','both marked delivered so the prompt does not repeat');
ok(w.document.getElementById('kPick').style.display==='none','pickup screen closes');
if(fails) process.exitCode=1; else console.log('ALL REQUEST TESTS PASSED');
