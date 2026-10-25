import type {Template} from './types';
export type BackgroundSlide={id:string;url:string;name:string;fit:'cover'|'contain'|'fill';x:number;y:number;zoom:number;brightness:number;seconds?:number};
export type Slideshow={enabled:boolean;playing:boolean;loop:boolean;seconds:number;effect:'none'|'fade'|'slide'|'zoom';transitionMs:number;overlayColor:string;overlayOpacity:number;blur:number;saturation:number;images:BackgroundSlide[]};
export const defaultSlideshow:Slideshow={enabled:false,playing:true,loop:true,seconds:8,effect:'fade',transitionMs:800,overlayColor:'#000000',overlayOpacity:0,blur:0,saturation:100,images:[]};
const clamp=(v:unknown,min:number,max:number,fallback:number)=>Number.isFinite(Number(v))&&v!==undefined&&v!==null?Math.max(min,Math.min(max,Number(v))):fallback;
export function slideshowOf(t:Partial<Template>):Slideshow{
 const s=t.slideshow;
 return {...defaultSlideshow,...s,effect:['none','fade','slide','zoom'].includes(s?.effect||'')?s!.effect:'fade',seconds:clamp(s?.seconds,2,120,8),transitionMs:clamp(s?.transitionMs,0,2000,800),overlayOpacity:clamp(s?.overlayOpacity,0,80,0),blur:clamp(s?.blur,0,12,0),saturation:clamp(s?.saturation,0,180,100),images:(Array.isArray(s?.images)?s.images:[]).filter(i=>i&&typeof i.url==='string'&&i.url&&typeof i.id==='string').map(i=>({...i,fit:['cover','contain','fill'].includes(i.fit)?i.fit:'cover',x:clamp(i.x,0,100,50),y:clamp(i.y,0,100,50),zoom:clamp(i.zoom,100,160,100),brightness:clamp(i.brightness,40,140,100),seconds:i.seconds===undefined?undefined:clamp(i.seconds,2,120,8)}))};
}

/** Fullscreen photos are independent of the optional daily/loop background. */
export function mediaSlideshowOf(t:Partial<Template>):Slideshow {
 return slideshowOf({slideshow:t.mediaSlideshow??(t.displayMode==='slideshow'?t.slideshow:undefined)});
}
export function withDisplayMode<T extends Partial<Template>>(t:T,mode:Template['displayMode']):T {
 // Preserve old fullscreen playlists, but stop their old background flag leaking on exit.
 const legacy=t.displayMode==='slideshow'&&!t.mediaSlideshow;
 return {...t,...(!t.mediaSlideshow&&mode==='slideshow'&&!legacy?{mediaSlideshow:mediaSlideshowOf({})}:{}),...(legacy?{mediaSlideshow:mediaSlideshowOf(t),slideshow:t.slideshow?{...t.slideshow,enabled:false}:undefined}:{}),displayMode:mode};
}
