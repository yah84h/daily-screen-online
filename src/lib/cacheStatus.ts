import {useEffect,useId,useSyncExternalStore} from 'react';
export type CacheTask={label:string;loaded:number;total:number;error?:string};
const tasks=new Map<string,CacheTask>(),listeners=new Set<()=>void>();let snapshot:CacheTask[]=[];
function emit(){snapshot=[...tasks.values()];listeners.forEach(fn=>fn());}
export function useCacheTask(task:CacheTask|null){const id=useId();useEffect(()=>{if(task)tasks.set(id,task);else tasks.delete(id);emit();return()=>{tasks.delete(id);emit();};},[id,task?.label,task?.loaded,task?.total,task?.error]);}
export function useCacheTasks(){return useSyncExternalStore(fn=>{listeners.add(fn);return()=>listeners.delete(fn);},()=>snapshot);}
