/* Security regression tests (2026-10-11): crafted titles, links and share payloads must not run code.
   Run:  cd site && node _test_security.mjs   (needs jsdom, as for _test_smoke.mjs) */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
const dom = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
  beforeParse(w){ w.fetch=()=>Promise.reject(new Error('stub')); w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}}; w.scrollTo=()=>{}; }});
const w=dom.window; await new Promise(r=>setTimeout(r,50));
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
w.__pwned=0;
const evil=["x');__pwned++;//","x\\');__pwned++;//",'x");__pwned++;//','<img src=x onerror=__pwned++>'];
// 1. cards: render with hostile titles/ids and click every button's onclick
for(const t of evil){
  const it={id:"ab');__pwned++;//",title:t,raga:t,notationUrl:'javascript:__pwned++',children:[{id:'c',type:'audio',label:t,notationId:'"><img src=x onerror=__pwned++>'}]};
  const d=w.document.createElement('div'); d.innerHTML=w.eval('_indexCard')(it); w.document.body.appendChild(d);
  ok(!d.querySelector('a[href^="javascript"]'),'card: javascript: link dropped for '+JSON.stringify(t));
  ok(!d.querySelector('img'),'card: no injected element for '+JSON.stringify(t));
  d.querySelectorAll('[onclick]').forEach(b=>{ const src=b.getAttribute('onclick'); try{ new w.Function(src); }catch(e){ ok(false,'onclick parses: '+src); } });
  d.remove();
}
// 2. the onclick argument round-trips exactly
{ const t=evil[1]; const d=w.document.createElement('div'); d.innerHTML=w.eval('_indexCard')({id:'id1',title:t});
  const src=d.querySelector('.add').getAttribute('onclick'); const got=new w.Function('aConTitle','return '+src)(x=>x); ok(got===t,'aConTitle receives the exact title'); }
// 3. good links survive
ok(w.eval('safeUrl')('https://drive.google.com/file/d/abc/view')!=='','https link kept');
ok(w.eval('safeUrl')('javascript:alert(1)')==='','javascript: link dropped');
ok(w.eval('safeUrl')(' JaVaScRiPt:alert(1)')==='','mixed-case javascript: dropped');
ok(w.eval('safeUrl')('data:text/html,hi')==='','data: link dropped');
ok(w.eval('safeId')('1AbC_d-9')==='1AbC_d-9' && w.eval('safeId')('a"b')==='','safeId');
ok(fails===0 && w.__pwned===0,'nothing ran (pwned='+w.__pwned+')');
if(fails){ process.exitCode=1; } else console.log('ALL SECURITY TESTS PASSED');
