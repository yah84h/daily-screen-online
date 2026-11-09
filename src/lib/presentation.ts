import {useEffect,useState} from 'react';
export type Presentation={id:string;name:string;slides:string[]};
export type PresentationContext={screenId:string;token?:string};
type State={slide:number;black:boolean;count:number;ready:boolean;error:string};
export function usePresentation(deck:Presentation,context?:PresentationContext){
 const [state,setState]=useState<State>({slide:0,black:false,count:deck.slides.length,ready:!context,error:''});
 const screen=context?.screenId,token=context?.token||'';
 useEffect(()=>{setState({slide:0,black:false,count:deck.slides.length,ready:!screen,error:''});if(!screen)return;let active=true,pending=false;
 const load=async()=>{if(pending)return;pending=true;try{const response=await fetch('/local/presentation-control?'+new URLSearchParams({screen,deck:deck.id,token}),{signal:AbortSignal.timeout(5000),cache:'no-store'}),data=await response.json();if(!response.ok)throw Error(data.error?.message||'تعذر الاتصال بالشاشة');if(active)setState({...data,ready:true,error:''});}catch(error){if(active)setState(s=>({...s,ready:false,error:(error as Error).message}));}finally{pending=false;}};
 void load();const timer=setInterval(load,1000),events=new EventSource('/local/events');events.onmessage=()=>void load();return()=>{active=false;clearInterval(timer);events.close();};
 },[deck.id,deck.slides.length,screen,token]);
 const command=async(action:string,index?:number)=>{
  if(!screen){setState(s=>({...s,black:action==='black'?!s.black:s.black,slide:action==='next'?Math.min(deck.slides.length-1,s.slide+1):action==='previous'?Math.max(0,s.slide-1):action==='first'?0:action==='last'?deck.slides.length-1:action==='goto'?index??s.slide:s.slide}));return;}
  try{const response=await fetch('/local/presentation-control',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({screen,deck:deck.id,token,action,index}),signal:AbortSignal.timeout(5000)}),data=await response.json();if(!response.ok)throw Error(data.error?.message||'تعذر التحكم بالشاشة');setState({...data,ready:true,error:''});}catch(error){setState(s=>({...s,error:(error as Error).message}));}
 };
 return{...state,command};
}
