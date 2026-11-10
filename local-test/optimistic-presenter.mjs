import {presentationStep} from './presentation-state.mjs';
/** One writer in flight; subsequent key presses coalesce into the latest absolute target. */
export function createPresenter({deck,count,send,retryMs=1000}){
 let snapshot={deck,count,slide:0,black:false,revision:0,ready:!send,error:'',pending:false},desired=null,running=false,disposed=false,timer=null,serial=0,failures=0;const listeners=new Set();
 const emit=patch=>{snapshot={...snapshot,...patch};listeners.forEach(fn=>fn());};
 async function flush(){if(running||!desired||disposed||!send)return;running=true;
  try{while(desired&&!disposed){const target=desired;const data=await send({action:'set',index:target.slide,black:target.black});if(disposed)return;failures=0;if(data.deck!==deck)throw Object.assign(Error('تغيّر العرض المنشور.'),{status:409});
   if(desired===target){desired=null;emit({...data,ready:true,error:'',pending:false});}else emit({revision:Math.max(snapshot.revision,data.revision||0),ready:true,error:'',pending:true});
  }}catch(error){if(!disposed){const permanent=[400,401,403,404,409].includes(error.status);if(permanent)desired=null;emit({error:error.message||'تعذر مزامنة موضع العرض.',pending:!permanent,ready:!permanent});if(!permanent)timer=setTimeout(()=>{timer=null;void flush();},Math.min(retryMs*2**Math.min(failures++,4),15000));}}
  finally{running=false;}
 }
 return{
  getSnapshot:()=>snapshot,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);},
  receive:data=>{if(disposed||data.deck!==deck||desired||running||(data.revision||0)<snapshot.revision)return;emit({...data,ready:true,error:'',pending:false});},
  fail:message=>{if(!desired&&!disposed)emit({error:message});},
  apply:(action,index)=>{if(disposed)return;const next=presentationStep(snapshot,action,count,index);serial++;desired={...next,serial};emit({...next,pending:!!send,error:''});if(!send){desired=null;return;}if(timer){clearTimeout(timer);timer=null;}void flush();},
  dispose:()=>{disposed=true;if(timer)clearTimeout(timer);listeners.clear();}
 };
}
