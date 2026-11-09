import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {normalizeLeaderboard} from './qudrat-data.mjs';
const TTL=5*60*1000;
let cached=null,inflight=null,inflightSource=null;
export function leaderboardURL(value){
 if(!value)throw Object.assign(Error('Leaderboard is not configured'),{code:'NOT_CONFIGURED'});
 const url=new URL(value);
 if(url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/functions/v1/public-leaderboard'||url.username||url.password||url.port||url.hash||!url.searchParams.get('key'))throw Error('Invalid leaderboard configuration');
 return url;
}
async function boundedJSON(response){
 if(Number(response.headers?.get?.('content-length'))>1024*1024)throw Error('Response too large');
 if(!response.body?.getReader)return JSON.parse(await response.text());
 const reader=response.body.getReader(),parts=[];let length=0;
 try{for(;;){const{done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>1024*1024)throw Error('Response too large');parts.push(value);}}finally{await reader.cancel().catch(()=>{});}
 return JSON.parse(Buffer.concat(parts).toString('utf8'));
}
export async function fetchQudratLeaderboard({url=process.env.QUDRAT_PRO_LEADERBOARD_URL,cacheFile,fetcher=fetch,now=Date.now()}={}){
 const endpoint=leaderboardURL(url),source=createHash('sha256').update(endpoint.href).digest('hex');
 if(cached?.source!==source)cached=null;
 if(!cached&&cacheFile&&fs.existsSync(cacheFile))try{const saved=JSON.parse(fs.readFileSync(cacheFile,'utf8'));if(saved.source===source&&Number.isFinite(saved.fetchedAt))cached={...saved,data:normalizeLeaderboard(saved.data)};}catch{}
 if(cached&&now-cached.fetchedAt<TTL)return{...cached.data,fetchedAt:cached.fetchedAt,stale:false};
 if(inflight&&inflightSource===source)return inflight;
 const fallback=cached;
 const task=(async()=>{
  try{
   const response=await fetcher(endpoint.href,{redirect:'error',headers:{Accept:'application/json'},signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw Error('Upstream unavailable');
   const data=normalizeLeaderboard(await boundedJSON(response));
   const saved={source,data,fetchedAt:now};cached=saved;
   if(cacheFile)try{fs.writeFileSync(cacheFile,JSON.stringify(saved));}catch{}
   return{...data,fetchedAt:now,stale:false};
  }catch(error){if(fallback)return{...fallback.data,fetchedAt:fallback.fetchedAt,stale:true};throw error;}
 })();
 inflight=task;inflightSource=source;
 try{return await task;}finally{if(inflight===task){inflight=null;inflightSource=null;}}
}
