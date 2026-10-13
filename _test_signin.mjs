/* Sign-in feedback and single-popup elevation (2026-10-13). Run: cd site && node _test_signin.mjs */
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const { JSDOM } = await import('jsdom');
const here = path.dirname(fileURLToPath(import.meta.url));
const html = fs.readFileSync(path.join(here,'index.html'),'utf8');
let fails=0; const ok=(c,m)=>{ console.log((c?'ok: ':'FAIL: ')+m); if(!c) fails++; };
const DR='https://www.googleapis.com/auth/drive';
async function page(grantedDrive){
  const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,url:'https://keerthana-music.github.io/library/',
    beforeParse(w){ w.scrollTo=()=>{}; w.__req=[]; w.__elev=[];
      w.google={accounts:{oauth2:{
        hasGrantedAllScopes:(r,s)=>String(r.scope||'').split(' ').includes(s),
        initTokenClient:(cfg)=>{ const isElev=cfg.scope===DR;
          return {requestAccessToken(o){ (isElev?w.__elev:w.__req).push(o||{}); w.__cb=cfg.callback; w.__err=cfg.error_callback; }}; }}}};
      w.fetch=(u,o)=>{ const J=x=>Promise.resolve({json:()=>Promise.resolve(x)});
        if(String(u).includes('userinfo')) return J({email:'akka@gmail.com'});
        if(o&&o.method==='POST') return new Promise(r=>setTimeout(()=>r({json:()=>Promise.resolve({ok:true,member:true,role:'teacher'})}),60));
        return Promise.reject(new Error('stub')); };
      const s=w.document.createElement('script'); }});
  const w=dom.window;
  // the GSI script tag never loads under jsdom; fire its onload by hand
  await new Promise(r=>setTimeout(r,20));
  w.eval("AUTH.MEMBERS_URL='https://script.google.com/macros/s/X/exec'; showRoleChooser=function(){ window.__chooser=1; };");
  const g=[...w.document.head.querySelectorAll('script')].find(x=>String(x.src).includes('gsi/client')); if(g&&g.onload) g.onload();
  return w;
}
let w=await page(true);
const btn=()=>w.document.querySelector('#view-landing button[onclick="authSignIn()"]');
w.eval('authSignIn()');
ok(btn().disabled && btn().textContent==='Signing in…','Sign-in button greys out and says Signing in…');
ok(w.document.getElementById('landMsg').textContent.includes('Signing you in'),'landing shows a signing-in note');
w.eval('authSignIn()'); ok(w.__req.length===1,'a second press does not open another Google popup');
w.__cb({access_token:'t1',scope:'openid email profile '+DR});
await new Promise(r=>setTimeout(r,20));
ok(btn().disabled,'still greyed while the members check is running');
await new Promise(r=>setTimeout(r,100));
ok(w.__chooser===1 && !btn().disabled,'role chooser appears and the button is restored behind it');
ok(w.eval('_driveScoped')===true,'Drive already granted: noted from the first token');
let got=null; w.eval('ensureDriveScope')(v=>got=v);
ok(got===true && w.__elev.length===0,'Continue as Teacher needs no second Google popup');

w=await page(false); w.eval('authSignIn()');
w.__cb({access_token:'t1',scope:'openid email profile https://www.googleapis.com/auth/drive.file'});
await new Promise(r=>setTimeout(r,120));
ok(w.eval('_driveScoped')===false,'first time (Drive never granted): not assumed');
w.eval('ensureDriveScope')(()=>{});
ok(w.__elev.length===1 && w.__elev[0].prompt==='' && w.__elev[0].login_hint==='akka@gmail.com','first-time elevation reuses the account (no chooser)');

w=await page(false); w.eval('authSignIn()'); w.__err({type:'popup_closed'});
ok(!btn().disabled && btn().textContent==='Sign in with Google','closing the Google popup restores the button');
if(fails) process.exitCode=1; else console.log('ALL SIGN-IN TESTS PASSED');
