import type { Template } from './types';
export type CustomDay = {
  id: string;
  name: string;
  date: string;
  enabled: boolean;
  html: string;
  title: string;
  subtitle: string;
  body: string;
  textScale?: number;
  clockScale?: number;
  schoolScale?: number;
  clock: boolean;
  leaderboard: boolean;
  boardX: number;
  boardY: number;
  boardW: number;
  boardH: number;
};
export const customDayDate = (now = new Date()) =>
  now.toLocaleDateString('en-CA', { timeZone: 'Asia/Riyadh' });
export function activeCustomDay(template: Partial<Template>, now = new Date()) {
  if (template.displayMode !== 'loop') return undefined;
  return template.customDays?.find(
    (day) => day.enabled && day.date === customDayDate(now) && day.html,
  );
}
/** Uploaded scripts run only inside an opaque-origin sandbox. No parent credentials or network fetch. */
export function customDayDocument(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  doc.querySelectorAll('base,meta[http-equiv]').forEach((node) => node.remove());
  const policy = doc.createElement('meta');
  policy.httpEquiv = 'Content-Security-Policy';
  policy.content =
    "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline' https:; font-src https: data:; img-src https: data: blob:; media-src https: data: blob:; connect-src 'none'; frame-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'";
  doc.head.prepend(policy);
  const style = doc.createElement('style');
  style.textContent =
    'html,body{width:100%;height:100%;margin:0;overflow:hidden}#viewport{min-height:0!important}#fab,#panel,#toast{display:none!important}';
  doc.head.append(style);
  const bridge = doc.createElement('script');
  bridge.textContent = `
  addEventListener('message', function(event) {
    if (event.source !== parent || event.data?.type !== 'school-custom-day') return;
    const d = event.data.payload;
    const scale = value => Math.max(.5,Math.min(2,Number(value)||1));
    let sizing = document.getElementById('school-custom-sizing');
    if(!sizing){sizing=document.createElement('style');sizing.id='school-custom-sizing';document.head.append(sizing);}
    sizing.textContent = '#content{transform:none}.official{transform:scale('+scale(d.schoolScale)+');transform-origin:center right}.vitals .clock{transform:scale('+scale(d.clockScale)+');transform-origin:center left}[data-school-field=title],[data-school-field=subtitle],[data-school-field=body]{zoom:'+scale(d.textScale)+'}[data-school-field=schoolName]{zoom:'+scale(d.schoolScale)+'}[data-school-field=clock],[data-school-field=date]{zoom:'+scale(d.clockScale)+'}';
    const fields = {title:d.title, subtitle:d.subtitle, body:d.body, schoolName:d.schoolName, clock:d.clock, date:d.date};
    for (const [key,value] of Object.entries(fields)) {
      document.querySelectorAll('[data-school-field="'+key+'"]').forEach(el => { el.textContent = value || ''; });
    }
    function fitOccasion() {
      const box=document.getElementById('content'), inner=document.getElementById('blockOccasion');
      if(!box||!inner) return;
      let k=scale(d.textScale); box.style.setProperty('--k',String(k));
      while(k>.15 && (inner.scrollHeight>box.clientHeight-8 || inner.scrollWidth>box.clientWidth-8)) { k-=.02; box.style.setProperty('--k',String(Math.max(.15,k))); }
    }
    // Adapter for the supplied Nabd template; other HTML can use data-school-field slots.
    if (document.getElementById('oTitle') && typeof state !== 'undefined' && typeof renderStage === 'function') {
      const changed=state.mode!=='occasion'||state.title!==d.title||state.slogan!==d.subtitle||state.desc!==d.body||state.logo!==(d.logo||'');
      state.mode='occasion'; state.title=d.title; state.slogan=d.subtitle; state.desc=d.body;
      state.logo=d.logo || ''; if(changed) renderStage();
      const school=document.querySelector('.official .school'); if(school) school.textContent=d.schoolName;
      const nativeClock=document.querySelector('.vitals .clock'); if(nativeClock) nativeClock.hidden=!d.showClock;
      const qr=document.querySelector('.main>.qr'); if(qr) qr.style.visibility=d.showLeaderboard?'hidden':'visible';
      if(typeof tickClock==='function') tickClock();
      window.schoolFitOccasion=fitOccasion; fitOccasion();
      if(!window.schoolFitWatching){ window.schoolFitWatching=true;
        addEventListener('resize',()=>requestAnimationFrame(()=>window.schoolFitOccasion?.()));
        document.fonts?.ready.then(()=>window.schoolFitOccasion?.());
        if(document.fonts?.addEventListener) document.fonts.addEventListener('loadingdone',()=>window.schoolFitOccasion?.());
      }
    }
    for(const key of ['clock','date']) { const el=document.getElementById(key); if(el) {el.textContent=d[key];el.hidden=!d.showClock;} }
    document.querySelectorAll('[data-school-field="clock"],[data-school-field="date"]').forEach(el => el.hidden=!d.showClock);
  });`;
  doc.body.append(bridge);
  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}
