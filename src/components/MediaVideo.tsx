import {useEffect,useRef,useState} from 'react';
export function MediaVideo({src,sound,loop,controls}:{src:string;sound:boolean;loop:boolean;controls:boolean}){
 const ref=useRef<HTMLVideoElement>(null);const[action,setAction]=useState(false);
 useEffect(()=>{let active=true;const v=ref.current;if(!v)return;setAction(false);v.muted=!sound;v.play().catch(async()=>{if(!active)return;v.muted=true;setAction(true);try{await v.play();}catch{/* A touch can start playback. */}});return()=>{active=false;};},[src,sound,loop]);
 return <><video ref={ref} src={src} autoPlay muted={!sound} loop={loop} controls={controls} playsInline preload="metadata"/>{action&&<button className="video-start" onClick={async()=>{const v=ref.current;if(!v)return;try{v.muted=!sound;await v.play();setAction(false);}catch{setAction(true);}}}>{sound?'اضغط لتشغيل الفيديو بالصوت':'اضغط لتشغيل الفيديو'}</button>}</>;
}
