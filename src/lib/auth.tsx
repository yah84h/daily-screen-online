import {createContext,useContext,useEffect,useState,type ReactNode} from 'react';import type {Session} from '@supabase/supabase-js';import {supabase} from './supabase';import {currentStaff,noPermissions,type Staff,type Permissions} from './staff';
type Auth={session:Session|null;staff:Staff|null;permissions:Permissions;loading:boolean;error:string;refresh:()=>Promise<void>;signOut:()=>Promise<void>};
const Ctx=createContext<Auth>({session:null,staff:null,permissions:noPermissions,loading:true,error:'',refresh:async()=>{},signOut:async()=>{}});
export function AuthProvider({children}:{children:ReactNode}){const[session,setSession]=useState<Session|null>(null),[staff,setStaff]=useState<Staff|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const refresh=async()=>{try{const{data}=await supabase.auth.getSession();setSession(data.session);setStaff(data.session?await currentStaff():null);setError('');}catch(e){setStaff(null);setError((e as Error).message);}finally{setLoading(false);}};
 useEffect(()=>{let active=true;const run=async()=>{if(active)await refresh();};run();const{data}=supabase.auth.onAuthStateChange(()=>{queueMicrotask(run);});const t=setInterval(run,30000);return()=>{active=false;clearInterval(t);data.subscription.unsubscribe();};},[]);
 return <Ctx.Provider value={{session,staff,permissions:staff?.active!==false&&staff?.permissions?staff.permissions:noPermissions,loading,error,refresh,signOut:async()=>{await supabase.auth.signOut();setSession(null);setStaff(null);}}}>{children}</Ctx.Provider>;
}
export const useAuth=()=>useContext(Ctx);
