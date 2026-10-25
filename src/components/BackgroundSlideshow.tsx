import {useEffect,useState,useRef} from 'react';
import {slideshowOf,type BackgroundSlide} from '@/lib/slideshow';
import type {Template} from '@/lib/types';
export function BackgroundSlideshow({template}:{template:Partial<Template>}){
 const visibleRef=useRef<BackgroundSlide|null>(null);
 const s=slideshowOf(template),[cursor,setCursor]=useState(0),[failed,setFailed]=useState<string[]>([]),[visible,setVisible]=useState<BackgroundSlide|null>(null),[previous,setPrevious]=useState<BackgroundSlide|null>(null);
 const images=s.images.filter(i=>!failed.includes(i.url)),key=images.map(i=>i.id+':'+i.url).join('|'),target=images.length?images[cursor%images.length]:undefined;
 const shown=s.images.find(i=>i.id===visible?.id&&i.url===visible?.url)||null;
 const duration=Math.min(s.transitionMs,(shown?.seconds||s.seconds)*500);
 useEffect(()=>{const retry=()=>setFailed([]);window.addEventListener('online',retry);return()=>window.removeEventListener('online',retry);},[]);
 useEffect(()=>{setCursor(0);setFailed([]);},[s.images.map(i=>i.id+':'+i.url).join('|')]);
 useEffect(()=>{
  if(!s.enabled||!target)return;let alive=true;const img=new Image();
  img.onload=()=>{if(!alive)return;const old=visibleRef.current;if(old&&old.id!==target.id)setPrevious(old);visibleRef.current=target;setVisible(target);};
  img.onerror=()=>{if(alive)setFailed(old=>old.includes(target.url)?old:[...old,target.url]);};img.src=target.url;
  return()=>{alive=false;};
 },[s.enabled,target?.id,target?.url]);
 useEffect(()=>{if(!s.enabled||!s.playing||images.length<2||!shown||shown.id!==target?.id||(!s.loop&&cursor%images.length===images.length-1))return;const timer=setTimeout(()=>setCursor(c=>(c+1)%images.length),(shown.seconds||s.seconds)*1000);return()=>clearTimeout(timer);},[s.enabled,s.playing,s.loop,s.seconds,shown?.id,shown?.seconds,target?.id,key,cursor]);
 useEffect(()=>{const timer=setTimeout(()=>setPrevious(null),s.effect==='none'?0:duration);return()=>clearTimeout(timer);},[visible?.id,duration,s.effect]);
 if(!s.enabled||!s.images.length||!shown)return null;
 const image=(i:BackgroundSlide)=><img src={i.url} alt="" style={{objectFit:i.fit,objectPosition:`${i.x}% ${i.y}%`,transform:`scale(${i.zoom/100})`,transformOrigin:`${i.x}% ${i.y}%`,filter:`brightness(${i.brightness}%) saturate(${s.saturation}%) blur(${s.blur}px)`}}/>;
 return <div className="background-slideshow" aria-hidden="true" style={{'--slide-duration':duration+'ms'} as import('react').CSSProperties}>{previous&&s.effect!=='none'&&<div className="background-slide previous">{image(previous)}</div>}<div className={'background-slide incoming effect-'+s.effect} key={shown.id+shown.url} data-slide-id={shown.id}>{image(shown)}</div><div className="background-slide-overlay" style={{background:s.overlayColor,opacity:s.overlayOpacity/100}}/></div>;
}
