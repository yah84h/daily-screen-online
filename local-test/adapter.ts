if(!globalThis.crypto.randomUUID) Object.defineProperty(globalThis.crypto,'randomUUID',{value:()=>{const b=crypto.getRandomValues(new Uint8Array(16));b[6]=(b[6]&15)|64;b[8]=(b[8]&63)|128;const h=Array.from(b,x=>x.toString(16).padStart(2,'0')).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20)}});
const user={id:'local-admin',email:'local@test.invalid',aud:'authenticated',role:'authenticated'};
const session={access_token:'local-test-only',user};
export const supabaseConfigured=true;
function portable(value:any):any{if(typeof value==='string')return value.replace(/^https?:\/\/(?:localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(?:1[6-9]|2\d|3[01])\.\d+\.\d+)(?::\d+)?(?=\/storage\/v1\/object\/public\/media\/)/,'');if(Array.isArray(value))return value.map(portable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,portable(v)]));return value;}
async function call(path:string,body:unknown){const r=await fetch('/local/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});return portable(await r.json())}
class Query {
 data:any; constructor(table:string){this.data={table,action:'select',filters:[],orders:[]}}
 select(_cols?:string,options?:any){Object.assign(this.data,{options});return this}
 eq(k:string,v:any){this.data.filters.push([k,'eq',v]);return this}
 lte(k:string,v:any){this.data.filters.push([k,'lte',v]);return this}
 gt(k:string,v:any){this.data.filters.push([k,'gt',v]);return this}
 order(k:string,o?:any){this.data.orders.push([k,o?.ascending!==false]);return this}
 limit(v:number){this.data.limit=v;return this}
 single(){this.data.single=true;return this}
 insert(v:any){Object.assign(this.data,{action:'insert',values:v});return this}
 update(v:any){Object.assign(this.data,{action:'update',values:v});return this}
 delete(){this.data.action='delete';return this}
 then(resolve:any,reject:any){return call('query',this.data).then(resolve,reject)}
}
export const supabase:any={
 auth:{getSession:async()=>({data:{session}}),getUser:async()=>({data:{user}}),onAuthStateChange:(callback:any)=>{queueMicrotask(()=>callback('SIGNED_IN',session));return{data:{subscription:{unsubscribe(){}}}}},signOut:async()=>{},signInWithPassword:async()=>({data:{session},error:null})},
 from:(table:string)=>new Query(table),rpc:(name:string,args:any)=>call('rpc',{name,args,options:location.search+'&displayIndex='+(/^\/(?:display|tv)(\d+)$/.exec(location.pathname)?.[1]||'1')}),
 channel:()=>{let handler=()=>{};let events:EventSource|undefined;const ch:any={state:'joined',on:(_k:any,_f:any,fn:any)=>{handler=fn;return ch},subscribe:(callback?:any)=>{events=new EventSource('/local/events');events.onmessage=()=>handler();callback?.('SUBSCRIBED');return ch},send:()=>call('notify',{}),unsubscribe:async()=>{events?.close()}};return ch},
 storage:{from:()=>({upload:async(path:string,blob:Blob)=>{const r=await fetch('/local/upload/'+path,{method:'POST',body:blob,headers:{'Content-Type':blob.type}});return portable(await r.json())},getPublicUrl:(path:string)=>({data:{publicUrl:'/storage/v1/object/public/media/'+path}}),list:(prefix:string)=>call('media',{action:'list',prefix}),remove:(paths:string[])=>call('media',{action:'remove',paths})})}
};
if(!['/tv','/display'].includes(location.pathname)){document.body.classList.add('local-test');const badge=document.createElement('div');badge.textContent='نسخة اختبار محلية · لا تغيّر بيانات المدرسة';badge.style.cssText='position:fixed;bottom:0;left:0;right:0;text-align:center;background:#eaf3ff;color:#315d9c;padding:5px;font:12px sans-serif;z-index:99999;pointer-events:none';document.body.appendChild(badge)}
