import {supabase} from './supabase';
import type {Presentation} from './presentation';
export async function uploadBrowserPresentation(file:File,progress:(percent:number,stage:string)=>void):Promise<Presentation>{
 if(!/\.pptx$/i.test(file.name)||file.size>100*1024*1024)throw Error('اختر ملف PPTX حتى ١٠٠ ميجابايت.');
 const engine=await import('@web-ppt/core');progress(2,'قراءة ملف PowerPoint في المتصفح…');
 const bytes=new Uint8Array(await file.arrayBuffer()),limits={maxEntries:10000,maxEntryBytes:30*1024*1024,maxTotalBytes:200*1024*1024,maxCompressionRatio:1000};
 let count=0;const reader=new engine.ZipReader(bytes,limits),parts=reader.unzip(entry=>{if(/ppt\/slides\/slide\d+\.xml$/.test(entry.name))count++;if(/vbaProject\.bin$/i.test(entry.name))throw Error('ملفات الماكرو غير مدعومة.');return entry.name.endsWith('.rels')||entry.name==='[Content_Types].xml';});
 if(!count||count>200||!parts['[Content_Types].xml'])throw Error('اختر ملف PPTX صالحًا حتى ٢٠٠ شريحة.');
 for(const [name,value] of Object.entries(parts))if(name.endsWith('.rels')){
  if(value.length>1024*1024)throw Error('ملف العلاقات أكبر من الحد المسموح.');const xml=new DOMParser().parseFromString(new TextDecoder().decode(value),'application/xml');
  if(xml.querySelector('parsererror')||xml.doctype)throw Error('بيانات العرض غير صالحة.');
  for(const item of Array.from(xml.getElementsByTagNameNS('*','Relationship')))if(item.getAttribute('TargetMode')==='External'&&!item.getAttribute('Type')?.endsWith('/hyperlink'))throw Error('الوسائط الخارجية غير مدعومة. ضمّن الصور داخل ملف PowerPoint أولًا.');
 }
 const presentation=await engine.parse(bytes,{zip:limits});presentation.slides=presentation.slides.filter(slide=>!slide.hidden);const id=crypto.randomUUID(),slides:string[]=[],uploaded:string[]=[];
 try{
  if(!presentation.slides.length||presentation.slides.length>200)throw Error('عدد الشرائح غير صالح.');
  await document.fonts.ready;
  for(let i=0;i<presentation.slides.length;i++){
   progress(Math.round(5+i/presentation.slides.length*90),`تجهيز ورفع الشريحة ${i+1} من ${presentation.slides.length}…`);
   const svg=await engine.slideToSvgFile(presentation,presentation.slides[i]);
   const xml=new DOMParser().parseFromString(svg,'image/svg+xml');
   if(xml.querySelector('parsererror,script,foreignObject,iframe,object,embed'))throw Error('تعذر تجهيز إحدى الشرائح بأمان.');
   for(const element of Array.from(xml.querySelectorAll('*')))for(const attr of Array.from(element.attributes)){
    if(/^on/i.test(attr.name))element.removeAttribute(attr.name);
    if(/href$/i.test(attr.name)&&attr.value&&!attr.value.startsWith('#')&&!attr.value.startsWith('data:image/'))element.removeAttribute(attr.name);
   }
   const url=URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(xml)],{type:'image/svg+xml'}));let blob:Blob;
   try{const image=new Image();await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('استغرقت الشريحة وقتًا طويلًا.')),20000);image.onload=()=>{clearTimeout(timer);resolve();};image.onerror=()=>{clearTimeout(timer);reject(Error('تعذر رسم الشريحة.'));};image.src=url;});
    const scale=1920/Math.max(presentation.width,presentation.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(presentation.width*scale));canvas.height=Math.max(1,Math.round(presentation.height*scale));
    const context=canvas.getContext('2d');if(!context)throw Error('تعذر إنشاء صورة الشريحة.');context.fillStyle='#ffffff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(Error('تعذر حفظ صورة الشريحة.')),'image/jpeg',.92));canvas.width=canvas.height=1;
   }finally{URL.revokeObjectURL(url);}
   const path=`content/presentations/${id}/slide-${i+1}.jpg`,result=await supabase.storage.from('media').upload(path,blob,{contentType:'image/jpeg',cacheControl:'31536000'});if(result.error)throw Error('تعذر رفع الشريحة: '+result.error.message);uploaded.push(path);slides.push(supabase.storage.from('media').getPublicUrl(path).data.publicUrl);
   await new Promise(resolve=>setTimeout(resolve,0));
  }
  progress(100,'العرض جاهز. راجع المعاينة ثم انشره على الشاشة.');return{id,name:file.name,slides};
 }catch(error){if(uploaded.length)try{await supabase.storage.from('media').remove(uploaded);}catch{}throw error;}finally{presentation.dispose?.();}
}
