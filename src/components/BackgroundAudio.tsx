import {useEffect,useRef,useState} from 'react';import {drivePlaybackURL,parseDriveLink} from '@/lib/driveVideo';
const key='daily-screen-audio-device:'+location.pathname;
function saved(){try{const s=JSON.parse(localStorage.getItem(key)||'{}');return{enabled:s.enabled===true,volume:Number.isFinite(s.volume)?Math.max(0,Math.min(1,s.volume)):.3};}catch{return{enabled:false,volume:.3};}}
export function BackgroundAudio({source,controls}:{source?:{url:string;name:string};controls:boolean}){
 const audio=useRef<HTMLAudioElement>(null),[prefs,setPrefs]=useState(saved),[error,setError]=useState(''),[playing,setPlaying]=useState(false);
 const url=source?.url?(parseDriveLink(source.url)?drivePlaybackURL(source.url)+'&audio=1':source.url):'';
 useEffect(()=>{try{localStorage.setItem(key,JSON.stringify(prefs));}catch{}if(audio.current)audio.current.volume=prefs.volume;},[prefs.enabled,prefs.volume,url]);
 useEffect(()=>{const el=audio.current;if(!el||!url)return;setError('');if(prefs.enabled)el.play().catch(()=>setError('اضغط تشغيل للسماح بالصوت على هذا الجهاز.'));else el.pause();return()=>el.pause();},[url,prefs.enabled]);

 if(!url)return controls?<p>لا يوجد صوت خلفية منشور. أضفه من لوحة الإدارة.</p>:null;
 return <><audio ref={audio} src={url} loop preload="auto" onPlaying={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onError={()=>setError('تعذر تشغيل الصوت. تحقق من الملف أو صلاحيات رابط Drive.')} data-background-audio="true"/>{controls&&<section className="device-audio-controls"><b>صوت الخلفية · هذا الجهاز</b><small>{source?.name}</small><button onClick={()=>{const el=audio.current;if(!el)return;if(playing){el.pause();setPrefs(p=>({...p,enabled:false}));}else{el.volume=prefs.volume;el.play().then(()=>setError('')).catch(()=>setError('تعذر تشغيل الصوت. تحقق من الاتصال أو صيغة الملف.'));setPrefs(p=>({...p,enabled:true}));}}}>{playing?'إيقاف صوت الخلفية':'تشغيل صوت الخلفية'}</button><label>مستوى الصوت · {Math.round(prefs.volume*100)}٪<input aria-label="مستوى صوت الخلفية" type="range" min="0" max="1" step=".01" value={prefs.volume} onChange={e=>setPrefs(p=>({...p,volume:+e.target.value}))}/></label>{error&&<small role="alert">{error}</small>}</section>}</>;
}
