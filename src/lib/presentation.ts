import {supabase,isLocalBackend} from './supabase';
import {useEffect,useMemo,useSyncExternalStore,useId} from 'react';
import {createPresenter} from '../../local-test/optimistic-presenter.mjs';
export type Presentation={id:string;name:string;slides:string[]};
export type PresentationContext={screenId:string;token?:string};
async function requestControl(screen:string,deck:string,token:string,input:Record<string,unknown>){
 let response:Response;
 if(isLocalBackend){response=await fetch(input.action==='state'?'/local/presentation-control?'+new URLSearchParams({screen,deck,token}):'/local/presentation-control',input.action==='state'?{signal:AbortSignal.timeout(8000),cache:'no-store'}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screen,deck,token,...input}),signal:AbortSignal.timeout(8000)});}
 else{const{data}=await supabase.auth.getSession();response=await fetch('/.netlify/functions/presentation-control',{method:'POST',headers:{'Content-Type':'application/json',...(data.session?.access_token?{Authorization:'Bearer '+data.session.access_token}:{})},body:JSON.stringify({screen,deck,token,...input}),signal:AbortSignal.timeout(8000),cache:'no-store'});}
 const payload=await response.json();if(!response.ok)throw Object.assign(Error(payload.error?.message||'تعذر مزامنة العرض.'),{status:response.status});return payload;
}
const stores=new Map<string,{presenter:ReturnType<typeof createPresenter>;refs:number;timer:ReturnType<typeof setTimeout>|null;start:()=>void;stop:()=>void}>();
function handleFor(screen:string,deck:string,count:number,token:string,preview:string){
 const key=JSON.stringify([screen||preview,deck,token]);let entry=stores.get(key);
 if(!entry){
  let channel:ReturnType<typeof supabase.channel>|null=null,loading=false,active=false,events:EventSource|null=null,timer:ReturnType<typeof setInterval>|null=null;
  const presenter=createPresenter({deck,count,send:screen?async input=>{const data=await requestControl(screen,deck,token,input);if(channel?.state==='joined')void channel.send({type:'broadcast',event:'refresh',payload:{}}).catch(()=>{});return data;}:null});
  const load=async()=>{if(loading||!active)return;loading=true;try{const data=await requestControl(screen,deck,token,{action:'state'});if(active)presenter.receive(data);}catch(error){if(active)presenter.fail((error as Error).message);}finally{loading=false;}};
  entry={presenter,refs:0,timer:null,start:()=>{if(active||!screen)return;active=true;events=isLocalBackend?new EventSource('/local/events'):null;if(events)events.onmessage=()=>void load();else channel=supabase.channel('presentation:'+screen).on('broadcast',{event:'refresh'},()=>void load()).subscribe();timer=setInterval(load,isLocalBackend?1000:15000);void load();},stop:()=>{active=false;if(timer)clearInterval(timer);events?.close();void channel?.unsubscribe();presenter.dispose();}};stores.set(key,entry);
 }
 const current=entry;return{presenter:current.presenter,connect:()=>{if(current.timer)clearTimeout(current.timer);current.refs++;current.start();return()=>{current.refs--;if(current.refs===0)current.timer=setTimeout(()=>{current.stop();stores.delete(key);},0);};}};
}
export function usePresentation(deck:Presentation,context?:PresentationContext){
 const screen=context?.screenId||'',token=context?.token||'',preview=useId();
 const handle=useMemo(()=>handleFor(screen,deck.id,deck.slides.length,token,preview),[screen,token,deck.id,deck.slides.length,preview]);
 useEffect(()=>handle.connect(),[handle]);
 const state=useSyncExternalStore(handle.presenter.subscribe,handle.presenter.getSnapshot,handle.presenter.getSnapshot);
 return{...state,command:handle.presenter.apply};
}
