import {normalizeNews} from './news-security.mjs';
import {createAccounts} from './accounts.mjs';
import {fetchHeadlines} from './headlines.mjs';
import http from 'node:http';
import {pipeline} from 'node:stream/promises';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import os from 'node:os';
import {spawn} from 'node:child_process';
const root=path.dirname(fileURLToPath(import.meta.url));
const dataDir=path.join(root,'data'),mediaDir=path.join(dataDir,'media');fs.mkdirSync(mediaDir,{recursive:true});
const stateFile=path.join(dataDir,'state.json');
const db=JSON.parse(fs.readFileSync(fs.existsSync(stateFile)?stateFile:path.join(root,'seed.json'),'utf8'));
const accounts=createAccounts(dataDir);
const oldSchoolNames=['مدارس الموهوبين التقنيه بجدة','مدارس الموهوبين التقنية بجدة','ثانوية الموهوبين التقنية'];
const newSchoolName='الموهوبين التقنية الثانوية بجدة - بنين';
for(const row of db.school_settings||[])if(oldSchoolNames.includes(row.name))row.name=newSchoolName;
for(const screen of db.screens||[])for(const key of ['loopSchoolName','schoolName'])if(oldSchoolNames.includes(screen.template?.[key]))screen.template[key]=newSchoolName;
const streams=new Set();const now=()=>new Date().toISOString();
function save(){fs.writeFileSync(stateFile,JSON.stringify(db,null,2));for(const response of streams)response.write('data: update\n\n')}
function reply(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function body(req){const chunks=[];let length=0;for await(const chunk of req){length+=chunk.length;if(length>1024*1024)throw Error('بيانات الإعدادات كبيرة جدًا');chunks.push(chunk)}return Buffer.concat(chunks)}
function safe(base,relative){const result=path.resolve(base,relative);if(!result.startsWith(base+path.sep))throw Error('Invalid path');return result}
function query(q){
 const rows=db[q.table];if(!Array.isArray(rows))throw Error('Unknown table');
 const match=row=>(q.filters||[]).every(([key,op,value])=>op==='eq'?String(row[key])===String(value):op==='lte'?row[key]<=value:row[key]>value);
 let result=rows.filter(match);
 if(q.action==='insert'){result=(Array.isArray(q.values)?q.values:[q.values]).map(v=>({id:randomUUID(),created_at:now(),updated_at:now(),...(q.table==='screens'?{draft:null}:{}),...(q.table==='presets'?{sort_order:0}:{}),...v}));rows.push(...result)}
 if(q.action==='update')for(const row of result){const values={...q.values};if(q.table==='screens'&&values.template){values.template={...values.template};delete values.template.news;if(row.template?.news)values.template.news=row.template.news;}Object.assign(row,values,{updated_at:now()});}
 if(q.action==='delete'){db[q.table]=rows.filter(row=>!match(row));if(q.table==='screens'){const ids=result.map(s=>s.id);db.posts=db.posts.filter(p=>!ids.includes(p.screen_id));db.screen_devices=db.screen_devices.filter(d=>!ids.includes(d.screen_id))}}
 if(q.action!=='select'){if(q.table==='posts')for(const post of result){const s=db.screens.find(s=>s.id===post.screen_id);if(s)s.updated_at=now()}save()}
 for(const [field,ascending] of [...(q.orders||[])].reverse())result.sort((a,b)=>(a[field]===b[field]?0:a[field]>b[field]?1:-1)*(ascending?1:-1));
 const count=result.length;if(q.limit)result=result.slice(0,q.limit);
 return{data:q.options?.head?null:q.single?(result[0]??null):result,error:null,count};
}
function rpc({name,args={},options=''},staff){
 if(name==='current_staff')return staff;
 if(name==='save_screen_news'){if(!staff?.permissions.news)throw Object.assign(Error('لا تملك صلاحية الأخبار'),{status:403});const screen=db.screens.find(s=>s.id===args.p_screen_id);if(!screen)throw Error('الشاشة غير موجودة');screen.template={...screen.template,news:normalizeNews(args.p_news)};screen.updated_at=now();save();return screen.template.news;}

 if(name==='request_pairing'){const settings=new URLSearchParams(options);const screen=db.screens.find(s=>s.id===settings.get('screen'))||db.screens[Math.max(0,Number(settings.get('displayIndex')||1)-1)]||db.screens[0];const token=randomUUID(),code=String(Math.floor(100000+Math.random()*900000));db.screen_devices.push({token,code,screen_id:settings.has('pair')?null:screen.id,label:'اختبار محلي',paired_at:now(),last_seen_at:now()});save();return{token,code}}
 if(name==='pair_screen'){const device=db.screen_devices.find(d=>d.code===args.p_code);if(!device)throw Error('رمز الشاشة غير صحيح');device.screen_id=args.p_screen_id;device.label=args.p_label||'تلفزيون محلي';device.paired_at=now();save();return null}
 if(name==='get_screen_by_token'){const device=db.screen_devices.find(d=>d.token===args.p_token);if(!device)return{status:'unknown'};if(!device.screen_id)return{status:'pending',code:device.code};device.last_seen_at=now();const screen=db.screens.find(s=>s.id===device.screen_id);if(!screen)return{status:'unknown'};const today=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});const post=db.posts.filter(p=>p.screen_id===screen.id&&p.publish_at<=today).sort((a,b)=>b.publish_at.localeCompare(a.publish_at)||b.created_at.localeCompare(a.created_at))[0]||null;return{status:'paired',screen,school:db.school_settings[0],post,version:screen.updated_at+':'+(post?.created_at||'')}}
 throw Error('Unknown operation');
}
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ttf':'font/ttf','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.jpeg':'image/jpeg','.json':'application/json','.mp4':'video/mp4','.webm':'video/webm','.gif':'image/gif'};
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost');
  if(url.pathname==='/api/tech-news'){const feed=await fetchHeadlines({cacheFile:path.join(dataDir,'headlines.json')});return reply(res,feed);}
  if(req.method!=='GET'&&req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host)throw Object.assign(Error('Origin rejected'),{status:403});
  if(url.pathname.startsWith('/local/auth/')){const action=url.pathname.slice('/local/auth/'.length),input=req.method==='POST'?JSON.parse((await body(req)).toString()||'{}'):{};
   if(action==='status')return reply(res,accounts.status());
   if(action==='session')return reply(res,{user:accounts.session(req)?.user||null});
   if(action==='setup')return reply(res,{user:accounts.setup(req,res,input)});
   if(action==='login')return reply(res,{user:accounts.login(req,res,input)});
   if(action==='password')return reply(res,{user:accounts.changePassword(req,input)});
   if(action==='logout'){accounts.logout(req,res);return reply(res,{ok:true});}
   if(action==='users')return reply(res,{users:accounts.manage(req,input)});
   return reply(res,{error:{message:'Not found'}},404);
  }
  if(url.pathname==='/local/events'){res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','Connection':'keep-alive'});res.write(': connected\n\n');streams.add(res);req.on('close',()=>streams.delete(res));return}
  if(url.pathname.startsWith('/local/upload/')){accounts.requireUser(req,'daily');const file=safe(mediaDir,decodeURIComponent(url.pathname.slice('/local/upload/'.length)));fs.mkdirSync(path.dirname(file),{recursive:true});const partial=file+'.part-'+randomUUID();try{await pipeline(req,fs.createWriteStream(partial));fs.renameSync(partial,file);}catch(error){fs.rmSync(partial,{force:true});throw error;}return reply(res,{data:{path:file},error:null})}
  if(url.pathname.startsWith('/local/')){
   const input=JSON.parse((await body(req)).toString()||'{}');
   if(url.pathname==='/local/query'){const staff=accounts.requireUser(req);if(input.action!=='select'){
 if(input.table==='posts'||input.table==='presets')accounts.requireUser(req,'daily');
 else if(input.table==='screens'&&input.action==='update'&&staff.permissions.daily&&!staff.permissions.admin){if(Object.keys(input.values||{}).some(k=>!['draft','template'].includes(k)))throw Object.assign(Error('لا تملك صلاحية القالب'),{status:403});const current=db.screens.find(v=>(input.filters||[]).some(([k,op,val])=>k==='id'&&op==='eq'&&v.id===val));if(!current)throw Error('الشاشة غير موجودة');if(input.values.template)input.values={...input.values,template:{...current.template,...(input.values.template.mediaSlideshow?{mediaSlideshow:input.values.template.mediaSlideshow}:{})}};}
 else accounts.requireUser(req,'admin');
 }return reply(res,query(input));}
   if(url.pathname==='/local/rpc'){const publicRpc=['request_pairing','get_screen_by_token'];let staff=accounts.session(req)?.user;if(!publicRpc.includes(input.name)){staff=accounts.requireUser(req,input.name==='save_screen_news'?'news':input.name==='current_staff'?undefined:'admin');}return reply(res,{data:rpc(input,staff),error:null});}
   if(url.pathname==='/local/notify'){accounts.requireUser(req);save();return reply(res,'ok')}
   if(url.pathname==='/local/media'){accounts.requireUser(req,input.action==='remove'?'admin':'daily');if(input.action==='remove'){for(const p of input.paths||[])fs.rmSync(safe(mediaDir,p),{force:true});return reply(res,{data:[],error:null})}const dir=safe(mediaDir,input.prefix);return reply(res,{data:fs.existsSync(dir)?fs.readdirSync(dir).map(name=>({id:name,name})):[],error:null})}
   return reply(res,{error:{message:'Not found'}},404);
  }
  const mediaPrefix='/storage/v1/object/public/media/';
  let file=url.pathname.startsWith(mediaPrefix)?safe(mediaDir,decodeURIComponent(url.pathname.slice(mediaPrefix.length))):safe(path.join(root,'web'),decodeURIComponent(url.pathname==='/'?'index.html':url.pathname.slice(1)));
  if(!fs.existsSync(file)||!fs.statSync(file).isFile()){if(path.extname(url.pathname))return reply(res,{error:{message:'File not found'}},404);file=path.join(root,'web','index.html')}
  const size=fs.statSync(file).size;const headers={'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache','Accept-Ranges':'bytes'};
  if(req.headers.range){const m=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let start=m?.[1]?Number(m[1]):0,end=m?.[2]?Number(m[2]):size-1;if(m&&!m[1]&&m[2]){start=Math.max(0,size-Number(m[2]));end=size-1}if(!m||start>=size||end<start){res.writeHead(416,{'Content-Range':`bytes */${size}`});res.end();return}end=Math.min(end,size-1);res.writeHead(206,{...headers,'Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':end-start+1});if(req.method==='HEAD')res.end();else fs.createReadStream(file,{start,end}).pipe(res);return}
  res.writeHead(200,{...headers,'Content-Length':size});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
 }catch(error){reply(res,{data:null,error:{message:error.message}},error.status||400)}
});
server.requestTimeout=0; // Local uploads stream to disk without an app size/time cap.
const port=Number(process.env.PORT)||8080,host=process.argv.includes('--localhost')?'127.0.0.1':'0.0.0.0';
const addresses=Object.entries(os.networkInterfaces()).filter(([name])=>! /^(lo|docker|br-|veth|utun|tun|tailscale)/.test(name)).flatMap(([,group])=>(group||[]).filter(n=>n.family==='IPv4'&&!n.internal).map(n=>n.address));
const advertisedIP=host==='127.0.0.1'?'127.0.0.1':process.env.LAN_IP||addresses[0]||'127.0.0.1';
server.listen(port,host,()=>{console.log('\nDAILY SCREEN — LOCAL TEST ONLY\n');console.log(`Admin:   http://${advertisedIP}:${port}/admin`);console.log(`Display: http://${advertisedIP}:${port}/display`);console.log('Saved data: '+stateFile);console.log('Login: /login | News: /news | First-install admin: Archo (no activation code)');if(!addresses.length)console.log('No LAN address found. Connect this computer to the school network for phone access.');if(host==='0.0.0.0')for(const group of Object.values(os.networkInterfaces()))for(const n of group||[])if(n.family==='IPv4'&&!n.internal)console.log(`Phone: http://${n.address}:${port}/admin`);console.log('\nKeep this window open. Stop with Ctrl+C.\n');if(process.argv.includes('--open')){const url=`http://${advertisedIP}:${port}/admin`;const command=process.platform==='darwin'?'open':process.platform==='win32'?'cmd':null;if(command){const child=spawn(command,process.platform==='win32'?['/c','start','',url]:[url],{stdio:'ignore',detached:true});child.on('error',()=>{});child.unref()}}});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?'Port 8080 is already in use. Close the other local server first.':error.message);process.exitCode=1});
