import {useCallback,useEffect,useState} from 'react';
import {normalizeLeaderboard,type QudratData} from '../../local-test/qudrat-data.mjs';
export {leaderboardOptions,leaderboardPages} from '../../local-test/qudrat-data.mjs';
export type {QudratData,QudratLeader,QudratOptions} from '../../local-test/qudrat-data.mjs';
const KEY='daily-screen-qudrat-pro-v1',TTL=300000;
type Saved={data:QudratData;fetchedAt:number;at:number;stale:boolean};
export type LeaderboardState={data:QudratData|null;stale:boolean;loading:boolean;error:string;fetchedAt:number};
let pending:Promise<Saved>|null=null;
function cached():Saved|null{try{const saved=JSON.parse(localStorage.getItem(KEY)||'null');if(!saved||!Number.isFinite(saved.at)||!Number.isFinite(saved.fetchedAt))return null;return{...saved,data:normalizeLeaderboard(saved.data)};}catch{return null;}}
async function load(force=false):Promise<Saved>{
 if(pending)return pending;
 const previous=cached();if(!force&&previous&&Date.now()-previous.at<TTL)return previous;
 pending=(async()=>{
  const response=await fetch('/api/qudrat-pro',{signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!response.ok){let error='UNAVAILABLE';try{error=(await response.json()).error||error;}catch{}throw Error(error);}
  const payload=await response.json(),data=normalizeLeaderboard(payload);
  const saved={data,fetchedAt:Number.isFinite(payload.fetchedAt)?payload.fetchedAt:Date.now(),at:Date.now(),stale:payload.stale===true};
  try{localStorage.setItem(KEY,JSON.stringify(saved));}catch{}return saved;
 })();
 try{return await pending;}finally{pending=null;}
}
export function refreshLeaderboard(){window.dispatchEvent(new Event('qudrat-pro-refresh'));}
export function useLeaderboard(enabled=true){
 const [state,setState]=useState<LeaderboardState>(()=>{const saved=cached();return{data:saved?.data||null,stale:!!saved,loading:enabled,error:'',fetchedAt:saved?.fetchedAt||0};});
 const refresh=useCallback(()=>refreshLeaderboard(),[]);
 useEffect(()=>{
  if(!enabled)return;let active=true;
  const update=async(force=false)=>{
   setState(old=>({...old,loading:!old.data}));
   try{const saved=await load(force);if(active)setState({data:saved.data,stale:saved.stale||Date.now()-saved.fetchedAt>TTL||!navigator.onLine,loading:false,error:'',fetchedAt:saved.fetchedAt});}
   catch(error){if(active)setState(old=>({...old,loading:false,stale:!!old.data,error:(error as Error).message}));}
  };
  const force=()=>void update(true),offline=()=>setState(old=>({...old,stale:!!old.data}));
  void update(true);
  window.addEventListener('offline',offline);window.addEventListener('qudrat-pro-refresh',force);
  return()=>{active=false;window.removeEventListener('offline',offline);window.removeEventListener('qudrat-pro-refresh',force);};
 },[enabled]);
 return{...state,refresh};
}
