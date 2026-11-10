import {supabase,isLocalBackend} from './supabase';
import {useEffect,useState,useRef} from 'react';
export type Presentation={id:string;name:string;slides:string[]};
export type PresentationContext={screenId:string;token?:string};
type State={deck?:string;revision?:number;slide:number;black:boolean;count:number;ready:boolean;error:string};
async function cloudControl(input:Record<string,unknown>){const {data}=await supabase.auth.getSession();const response=await fetch('/.netlify/functions/presentation-control',{method:'POST',headers:{'Content-Type':'application/json',...(data.session?.access_token?{Authorization:'Bearer '+data.session.access_token}:{})},body:JSON.stringify(input),signal:AbortSignal.timeout(8000),cache:'no-store'});const payload=await response.json();if(!response.ok)throw Error(payload.error?.message||'تعذر الاتصال بالشاشة');return payload;}
const cloudChannels=new Map<string,{channel:ReturnType<typeof supabase.channel>;listeners:Set<()=>void>}>();
function joinPresentation(screen:string,refresh:()=>void){
 let entry=cloudChannels.get(screen);if(!entry){const listeners=new Set<()=>void>(),channel=supabase.channel('presentation:'+screen).on('broadcast',{event:'refresh'},()=>listeners.forEach(fn=>fn())).subscribe();entry={channel,listeners};cloudChannels.set(screen,entry);}
 entry.listeners.add(refresh);const current=entry;return{channel:current.channel,release:()=>{current.listeners.delete(refresh);if(!current.listeners.size){void current.channel.unsubscribe();cloudChannels.delete(screen);}}};
}
export function usePresentation(deck:Presentation,context?:PresentationContext){
 const [state,setState]=useState<State>({deck:deck.id,slide:0,black:false,count:deck.slides.length,ready:!context,error:''});
 const channel=useRef<ReturnType<typeof supabase.channel>|null>(null);
 const screen=context?.screenId,token=context?.token||'';
 useEffect(()=>{setState({deck:deck.id,slide:0,black:false,count:deck.slides.length,ready:!screen,error:''});if(!screen)return;let active=true,pending=false;
 const load=async()=>{if(pending)return;pending=true;try{let data;if(isLocalBackend){const response=await fetch('/local/presentation-control?'+new URLSearchParams({screen,deck:deck.id,token}),{signal:AbortSignal.timeout(5000),cache:'no-store'});data=await response.json();if(!response.ok)throw Error(data.error?.message||'تعذر الاتصال بالشاشة');}else data=await cloudControl({screen,deck:deck.id,token,action:'state'});if(active)setState(old=>data.deck!==old.deck||(!isLocalBackend&&(data.revision??0)<(old.revision??0))?old:{...data,ready:true,error:''});}catch(error){if(active)setState(s=>({...s,ready:false,error:(error as Error).message}));}finally{pending=false;}};
 void load();const joined=!isLocalBackend?joinPresentation(screen,()=>void load()):null;if(joined)channel.current=joined.channel;
 const timer=setInterval(load,isLocalBackend?1000:15000),events=isLocalBackend?new EventSource('/local/events'):null;if(events)events.onmessage=()=>void load();return()=>{active=false;clearInterval(timer);events?.close();joined?.release();channel.current=null;};
 },[deck.id,deck.slides.length,screen,token]);
 const command=async(action:string,index?:number)=>{
  if(!screen){setState(s=>({...s,black:action==='black'?!s.black:s.black,slide:action==='next'?Math.min(deck.slides.length-1,s.slide+1):action==='previous'?Math.max(0,s.slide-1):action==='first'?0:action==='last'?deck.slides.length-1:action==='goto'?index??s.slide:s.slide}));return;}
  try{let data;if(isLocalBackend){const response=await fetch('/local/presentation-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screen,deck:deck.id,token,action,index}),signal:AbortSignal.timeout(5000)});data=await response.json();if(!response.ok)throw Error(data.error?.message||'تعذر التحكم بالشاشة');}else data=await cloudControl({screen,deck:deck.id,token,action,index});setState(old=>data.deck!==old.deck||(!isLocalBackend&&(data.revision??0)<(old.revision??0))?old:{...data,ready:true,error:''});if(!isLocalBackend&&channel.current?.state==='joined')void channel.current.send({type:'broadcast',event:'refresh',payload:{}}).catch(()=>{});}catch(error){setState(s=>({...s,error:(error as Error).message}));}
 };
 return{...state,command};
}
