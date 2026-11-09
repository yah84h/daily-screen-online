import {useEffect,useRef,useState} from 'react';
export function MediaVideo({src,sound,loop,controls,bufferBeforePlay=false}:{src:string;sound:boolean;loop:boolean;controls:boolean;bufferBeforePlay?:boolean}){
 const ref=useRef<HTMLVideoElement>(null);const[action,setAction]=useState(false),[waiting,setWaiting]=useState(bufferBeforePlay),[error,setError]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{let active=true,started=false;const v=ref.current;if(!v)return;setAction(false);setError('');setWaiting(bufferBeforePlay);v.muted=!sound;
 const play=()=>{if(started||!active)return;started=true;setWaiting(false);v.play().catch(async()=>{if(!active)return;v.muted=true;setAction(true);try{await v.play();}catch{/* A touch can start playback. */}});};
 const check=()=>{if(!bufferBeforePlay)return;const end=v.buffered.length?v.buffered.end(v.buffered.length-1):0;if(end-v.currentTime>=10||Number.isFinite(v.duration)&&end>=v.duration-.1)play();};
 const failed=()=>{if(active){setWaiting(false);setError('تعذر تشغيل الفيديو. تحقق من رابط Drive وصلاحيات التنزيل وصيغة MP4 / WEBM.');}};
 v.addEventListener('progress',check);v.addEventListener('canplaythrough',check);v.addEventListener('error',failed);
 if(!bufferBeforePlay)play();else check();const timer=setInterval(check,250),timeout=setTimeout(()=>{if(active&&!started){setWaiting(false);setAction(true);}},60000);
 return()=>{active=false;clearInterval(timer);clearTimeout(timeout);v.removeEventListener('progress',check);v.removeEventListener('canplaythrough',check);v.removeEventListener('error',failed);};},[src,sound,loop,bufferBeforePlay,attempt]);
 return <><video ref={ref} src={src} muted={!sound} loop={loop} controls={controls} playsInline preload={bufferBeforePlay?'auto':'metadata'}/>{waiting&&<div className="drive-video-status" role="status"><b>تجهيز أول ١٠ ثوانٍ من الفيديو…</b></div>}{error&&<div className="drive-video-status" role="alert"><p>{error}</p><button onClick={()=>{ref.current?.load();setAttempt(n=>n+1);}}>إعادة المحاولة</button></div>}{action&&!error&&<button className="video-start" onClick={async()=>{const v=ref.current;if(!v)return;try{v.muted=!sound;await v.play();setAction(false);setWaiting(false);}catch{setAction(true);}}}>{sound?'اضغط لتشغيل الفيديو بالصوت':'اضغط لتشغيل الفيديو'}</button>}</>;
}
