import {useEffect,useLayoutEffect,useRef,useState} from 'react';import {Screen} from './Screen';import {prepareAsset,removeShowAsset,SHOW_LIMIT} from '@/lib/assetCache';import {useCacheTask} from '@/lib/cacheStatus';import type {Content,School,Template} from '@/lib/types';import type {PresentationContext} from '@/lib/presentation';
type Props={content:Content;template:Partial<Template>;school:School;large:boolean;presentationContext:PresentationContext};
type Display={props:Props;release:()=>void};
export function PreparedDisplay(props:Props){
 const queue=props.content.videoPlaylist?.enabled?props.content.videoPlaylist.items:[];
 const sources=queue.length?queue.map(item=>item.url):props.content.fullMedia&&(props.content.fullType==='image'||props.content.videoPreparation==='cache')?[props.content.fullMedia]:[];
 const signature=JSON.stringify([sources,queue.map(item=>item.type),props.content.fullType]),latest=useRef(props);latest.current=props;
 const [note,setNote]=useState('');
 const [display,setDisplay]=useState<Display|null>(null),[status,setStatus]=useState<{loaded:number;total:number;error?:string}|null>(null),[retry,setRetry]=useState(0);
 const visible=useRef<Props|null>(null);
 const active=useRef<Display|null>(null),preparedKey=useRef('');
 useCacheTask(status?{label:'تجهيز وسائط العرض · '+(queue.length?'قائمة التشغيل':'الملف التالي'),...status}:note?{label:note,loaded:1,total:1}:null);
 useEffect(()=>{if(!note)return;const timer=setTimeout(()=>setNote(''),8000);return()=>clearTimeout(timer);},[note]);
 useEffect(()=>{
  const controller=new AbortController();const urls:string[]=[];let adopted=false;
  const release=()=>urls.forEach(url=>URL.revokeObjectURL(url));
  setNote('');setStatus(sources.length?{loaded:0,total:sources.length}:null);
  async function prepare(){try{
   if(sources.length>30)throw Error('الحد الأقصى للقائمة ٣٠ ملفًا.');
   const mapping=new Map<string,string>();let bytes=0,persistent=true;
   for(let i=0;i<sources.length;i++){
    const source=sources[i];if(mapping.has(source)){setStatus({loaded:i+1,total:sources.length});continue;}
    const result=await prepareAsset(source,controller.signal,(loaded,total)=>{if(!controller.signal.aborted)setStatus({loaded:i+(total?loaded/total:0),total:sources.length});});
    persistent=persistent&&result.persistent;bytes+=result.blob.size;if(bytes>SHOW_LIMIT)throw Error('قائمة التشغيل أكبر من ٢ جيجابايت. قسّم العرض إلى قوائم أصغر.');
    const url=URL.createObjectURL(result.blob);urls.push(url);mapping.set(source,url);
    // Decode images and check video metadata before replacing the on-screen content.
    const item=queue.find(item=>item.url===source);const type=item?.type||props.content.fullType;
    try{await new Promise<void>((resolve,reject)=>{const element=type==='image'?new Image():document.createElement(type==='audio'?'audio':'video');const timer=setTimeout(()=>finish(Error('تعذر تجهيز الملف للتشغيل على هذا المتصفح.')),30000);const abort=()=>finish(new DOMException('Aborted','AbortError'));function finish(error?:Error){clearTimeout(timer);controller.signal.removeEventListener('abort',abort);element.onload=null;element.onerror=null;if(element instanceof HTMLMediaElement){element.onloadeddata=null;element.removeAttribute('src');element.load();}error?reject(error):resolve();}element.onerror=()=>finish(Error('صيغة أحد الملفات غير مدعومة.'));controller.signal.addEventListener('abort',abort,{once:true});if(element instanceof HTMLImageElement)element.onload=()=>finish();else{element.preload='auto';element.muted=true;element.onloadeddata=()=>finish();}element.src=url;});}catch(error){if(!controller.signal.aborted)await removeShowAsset(source).catch(()=>{});throw error;}
    controller.signal.throwIfAborted();setStatus({loaded:i+1,total:sources.length});
   }
   controller.signal.throwIfAborted();
   const current=latest.current,content={...current.content};
   if(content.videoPlaylist?.enabled)content.videoPlaylist={...content.videoPlaylist,items:content.videoPlaylist.items.map(item=>({...item,url:mapping.get(item.url)||item.url}))};
   if(content.fullMedia)content.fullMedia=mapping.get(content.fullMedia)||content.fullMedia;
   const next={props:{...current,content},release};const old=active.current;active.current=next;preparedKey.current=signature;adopted=true;setDisplay(next);setStatus(null);if(!persistent)setNote('الوسائط جاهزة لهذه الجلسة؛ تعذر حفظها بعد إغلاق المتصفح');
   // React commits the replacement before old Blob URLs are revoked.
   if(old)setTimeout(old.release,1000);
  }catch(error){if(!controller.signal.aborted)setStatus({loaded:0,total:sources.length,error:error instanceof Error&&/[ء-ي]/.test(error.message)?error.message:'تعذر تجهيز الوسائط. يبقى العرض السابق ظاهرًا؛ تحقق من الرابط والاتصال.'});if(!adopted)release();}}
  void prepare();return()=>{controller.abort();if(!adopted)release();};
 },[signature,retry]);
 useEffect(()=>()=>active.current?.release(),[]);
 // Non-media edits (colors, titles, mode changes) don't require downloading the queue again.
 const view=display&&preparedKey.current===signature?{...props,content:{...props.content,fullMedia:display.props.content.fullMedia,videoPlaylist:display.props.content.videoPlaylist}}:visible.current||display?.props;
 useLayoutEffect(()=>{if(display&&preparedKey.current===signature&&view)visible.current=view;},[view,display,signature]);
 const fallback={...props,template:{...props.template,displayMode:'daily' as const,rotation:undefined}};
 return <><Screen {...(view||fallback)}/>{status?.error&&<button className="cache-retry" onClick={()=>setRetry(n=>n+1)}>إعادة تجهيز الوسائط</button>}</>;
}
