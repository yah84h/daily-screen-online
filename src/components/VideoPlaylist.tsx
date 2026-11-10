import {useEffect,useState} from 'react';import type {Content} from '@/lib/types';import {MediaVideo} from './MediaVideo';import {drivePlaybackURL,parseDriveLink} from '@/lib/driveVideo';
export function VideoPlaylist({items,large,sound,controls,loop=true}:{items:NonNullable<Content['videoPlaylist']>['items'];large:boolean;sound:boolean;controls:boolean;loop?:boolean}){
 const [index,setIndex]=useState(0);const item=items[index]||items[0];const next=()=>setIndex(n=>n+1<items.length?n+1:loop?0:n);
 useEffect(()=>{if(item?.type!=='image'||!large)return;const timer=setTimeout(next,Math.max(3,item.seconds||10)*1000);return()=>clearTimeout(timer);},[item?.id,item?.url,index,large,loop,items.length]);
 if(!item)return null;
 return <div className="video-playlist" data-playlist-index={index}>{item.type==='image'?<img src={item.url} alt={item.name}/>:<MediaVideo key={item.id+item.url} src={parseDriveLink(item.url)?drivePlaybackURL(item.url):item.url} sound={large&&sound} loop={large?items.length===1&&loop:true} controls={large&&controls} onEnded={large?next:undefined}/>}</div>;
}
