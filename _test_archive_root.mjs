/* One archive folder per sign-in, even when several parts of the app ask at once (2026-10-28). */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.fetch=()=>Promise.reject(new Error('stub')); }});
const w=dom.window; await new Promise(r=>setTimeout(r,40)); const E=s=>w.eval(s);
E(`window.__made=0; window.__q=[]; AS.token='t';
   fetch=function(u,o){ var url=String(u);
     if(o&&o.method==='POST'&&url.indexOf('/files?')>0){ __made++; return new Promise(function(r){ setTimeout(function(){ r({json:function(){return Promise.resolve({id:'F'+__made});}}); },20); }); }
     __q.push(url); return new Promise(function(r){ setTimeout(function(){ r({json:function(){return Promise.resolve({files:[]});}}); },20); }); };`);
const ids = await E(`Promise.all([ensureArchiveRoot(),ensureArchiveRoot(),ensureArchiveRoot()])`);
ok(E('__made')===1 && ids.every(x=>x==='F1'),'three simultaneous asks create one folder');
ok(E('__q').some(u=>u.indexOf('orderBy=createdTime')>0),'lookup prefers the oldest folder if there are two');
E('authSignOut()'); await E('ensureArchiveRoot()');
ok(E('__made')===2,'after sign-out the next sign-in looks again');
if(fails) process.exitCode=1; else console.log('ALL ARCHIVE-ROOT TESTS PASSED');
