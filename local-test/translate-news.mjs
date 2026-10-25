const unescape=s=>String(s||'').replace(/&(amp|quot|apos|lt|gt|#39);/g,(_,k)=>({amp:'&',quot:'"',apos:"'",lt:'<',gt:'>','#39':"'"})[k]);
export async function translateBrief(item,{fetcher=fetch,key=process.env.GOOGLE_TRANSLATE_API_KEY}={}){
 const parts=[item.text,item.summary||''];try{
  if(key){const r=await fetcher('https://translation.googleapis.com/language/translate/v2?key='+encodeURIComponent(key),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({q:parts,source:'en',target:'ar',format:'text'}),signal:AbortSignal.timeout(6000)});if(!r.ok)throw Error('Translation unavailable');const d=await r.json(),rows=d.data?.translations;if(!Array.isArray(rows)||rows.length!==2)throw Error('Translation unavailable');return{...item,translatedText:unescape(rows[0].translatedText),translatedSummary:unescape(rows[1].translatedText),translationProvider:'Google Translate'};}
  const translate=async text=>{if(!text)return'';const r=await fetcher('https://api.mymemory.translated.net/get?q='+encodeURIComponent(text)+'&langpair=en%7Car',{signal:AbortSignal.timeout(5000)});if(!r.ok)throw Error('Translation unavailable');const d=await r.json();if(d.responseStatus!==200||typeof d.responseData?.translatedText!=='string'||d.quotaFinished)throw Error('Translation quota unavailable');const result=unescape(d.responseData.translatedText);if(/MYMEMORY WARNING|QUERY LENGTH|USAGE LIMIT/i.test(result))throw Error('Translation unavailable');return result;};
  const[translatedText,translatedSummary]=await Promise.all(parts.map(translate));if(!/[\u0600-\u06ff]/.test(translatedText))throw Error('Arabic translation unavailable');return{...item,translatedText,translatedSummary,translationProvider:'MyMemory'};
 }catch{return{...item,translatedText:undefined,translatedSummary:undefined,translationProvider:undefined};}
}
export async function translateDailyItems(items,options){
 // Keep anonymous free translation within its daily character budget; never omit extra stories.
 const output=[],limit=(options?.key??process.env.GOOGLE_TRANSLATE_API_KEY)?items.length:8;
 for(let i=0;i<Math.min(items.length,limit);i+=6)output.push(...await Promise.all(items.slice(i,Math.min(i+6,limit)).map(item=>translateBrief(item,options))));
 return [...output,...items.slice(limit)];
}
