/* Members-only sign-in tests (2026-10-11). Run: cd site && node _test_members.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
async function run(member, opts={}){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
    beforeParse(w){ w.scrollTo=()=>{}; w.google={accounts:{oauth2:{initTokenClient:()=>({requestAccessToken(){}})}}};
      w.fetch=(u,o)=>{ const J=x=>Promise.resolve({json:()=>Promise.resolve(x)});
        if(String(u).includes('userinfo')) return J({email:'mum@gmail.com'});
        if(o&&o.method==='POST'){ w.__body=o.body; return opts.down?Promise.reject(new Error('down')):J(member); }
        return Promise.reject(new Error('stub')); }; }});
  const w=dom.window; await new Promise(r=>setTimeout(r,30));
  w.eval("AUTH.MEMBERS_URL='https://script.google.com/macros/s/X/exec'; driveSyncOnLogin=function(){}; showRoleChooser=function(){ window.__chooser=1; };");
  w.eval("onToken('tok123')"); await new Promise(r=>setTimeout(r,30));
  return w;
}
let w=await run({ok:true,member:true,role:'user'});
ok(w.eval('AS.role')==='user' && w.eval('AS.email')==='mum@gmail.com','approved user signs in as User');
ok(JSON.parse(w.__body).token==='tok123','token sent in the POST body, not the URL');
w=await run({ok:true,member:true,role:'teacher'});
ok(w.eval('AS.maxRole')==='teacher' && w.__chooser===1,'teacher gets the role chooser');
w=await run({ok:true,member:true,role:'superuser'});
ok(w.eval('AS.maxRole')==='user','unknown role falls back to User');
w=await run({ok:true,member:false,role:'user'});
ok(!w.eval('AS.email') && !w.eval('AS.token'),'non-member is signed out');
const lm=w.document.getElementById('landMsg');
ok(lm.style.display!=='none' && lm.textContent.includes('mum@gmail.com') && lm.querySelector('a[href*="forms.gle"]'),'non-member sees the note with the register link');
w=await run(null,{down:true});
ok(!w.eval('AS.email') && w.document.getElementById('landMsg').textContent.includes("couldn't check"),'service down: no access, retry note');
w=await run({ok:false,error:'client'});
ok(!w.eval('AS.email'),'rejected token: no access');
if(fails) process.exitCode=1; else console.log('ALL MEMBERS TESTS PASSED');
