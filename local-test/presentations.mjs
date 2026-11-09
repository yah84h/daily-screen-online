import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {pipeline} from 'node:stream/promises';import {Transform} from 'node:stream';import {pathToFileURL} from 'node:url';
const exec=promisify(execFile),jobs=new Map();let converting=false;
function program(env,name,candidates=[]){if(process.env[env])return process.env[env];for(const p of candidates)if(fs.existsSync(p))return p;return name;}
const runtime=path.join(os.homedir(),'.cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override');
const office=()=>program('SOFFICE_PATH','soffice',['/Applications/LibreOffice.app/Contents/MacOS/soffice',path.join(runtime,'soffice')]);
const raster=()=>program('PDFTOPPM_PATH','pdftoppm',['/opt/homebrew/bin/pdftoppm',path.join(runtime,'pdftoppm')]);
const fail=(message,status=400)=>Object.assign(Error(message),{status});
export async function uploadPresentation(req,name,dataDir,mediaDir){
 if(converting)throw fail('يجري تجهيز عرض آخر. انتظر اكتماله ثم أعد المحاولة.',409);
 if(!/\.pptx$/i.test(name||''))throw fail('اختر ملف PowerPoint بصيغة PPTX.');
 converting=true;const id=randomUUID(),folder=path.join(dataDir,'presentations',id),out=path.join(mediaDir,'presentations',id);fs.mkdirSync(folder,{recursive:true});
 try{let bytes=0;await pipeline(req,new Transform({transform(chunk,_encoding,callback){bytes+=chunk.length;callback(bytes>100*1024*1024?fail('الحد الأقصى لملف PowerPoint هو ١٠٠ ميجابايت.'):null,chunk);}}),fs.createWriteStream(path.join(folder,'source.pptx')));
 await exec('python3',['-c',`import zipfile,sys,re,xml.etree.ElementTree as ET
with zipfile.ZipFile(sys.argv[1]) as z:
 infos=z.infolist()
 assert len(infos)<10000 and sum(i.file_size for i in infos)<500*1024*1024,'PPTX is too large after decompression'
 slides=[i for i in infos if re.fullmatch(r'ppt/slides/slide[0-9]+\\.xml',i.filename)]
 assert 0<len(slides)<=200,'PPTX must have 1 to 200 slides'
 assert '[Content_Types].xml' in z.namelist(),'Not a PowerPoint file'
 assert not any(i.filename.lower().endswith('vbaproject.bin') for i in infos),'Macros are not supported'
 for i in infos:
  if i.filename.endswith('.rels'):
   assert i.file_size<1024*1024,'Relationships are too large'
   for relation in ET.fromstring(z.read(i)).iter():
    assert relation.attrib.get('TargetMode')!='External' or relation.attrib.get('Type','').endswith('/hyperlink'),'External media are not supported'
`,path.join(folder,'source.pptx')],{timeout:15000});
 const job={id,name:path.basename(name).slice(0,160),status:'converting',slides:[],error:''};jobs.set(id,job);
 void(async()=>{try{
  await exec(office(),['-env:UserInstallation='+pathToFileURL(path.join(folder,'profile')).href,'--headless','--norestore','--convert-to','pdf:impress_pdf_Export','--outdir',folder,path.join(folder,'source.pptx')],{timeout:120000,maxBuffer:1024*1024});
  if(!fs.existsSync(path.join(folder,'source.pdf')))throw Error('conversion');
  fs.mkdirSync(out,{recursive:true});await exec(raster(),['-jpeg','-jpegopt','quality=90','-scale-to','1920','-f','1','-l','200',path.join(folder,'source.pdf'),path.join(out,'slide')],{timeout:120000,maxBuffer:1024*1024});
  const files=fs.readdirSync(out).filter(f=>/^slide-\d+\.jpg$/.test(f)).sort((a,b)=>Number(a.match(/\d+/)[0])-Number(b.match(/\d+/)[0]));if(!files.length)throw Error('empty');
  job.slides=files.map(f=>'/storage/v1/object/public/media/presentations/'+id+'/'+f);job.status='ready';fs.writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(job));
 }catch(error){job.status='error';job.error=error.code==='ENOENT'?'أداة التحويل غير متوفرة. يلزم LibreOffice و pdftoppm على خادم Mac.':'تعذر تحويل العرض. جرّب ملف PPTX دون كلمة مرور.';fs.rmSync(out,{recursive:true,force:true});}
 finally{converting=false;for(const f of ['source.pptx','source.pdf','profile'])fs.rmSync(path.join(folder,f),{recursive:true,force:true});}
 })();return job;
 }catch(error){converting=false;fs.rmSync(folder,{recursive:true,force:true});if(error.status)throw error;throw fail('ملف PPTX غير صالح، أو يتجاوز ٢٠٠ شريحة.');}
}
export function presentationJob(id,dataDir){if(!/^[a-f0-9-]{36}$/.test(id))throw fail('العرض غير موجود',404);if(jobs.has(id))return jobs.get(id);const f=path.join(dataDir,'presentations',id,'manifest.json');if(fs.existsSync(f))return JSON.parse(fs.readFileSync(f,'utf8'));throw fail('العرض غير موجود',404);}
export function presentationStep(state,action,count,index){
 let slide=Math.max(0,Math.min(count-1,Number(state?.slide)||0)),black=!!state?.black;
 if(action==='next')slide=Math.min(count-1,slide+1);else if(action==='previous')slide=Math.max(0,slide-1);else if(action==='first')slide=0;else if(action==='last')slide=count-1;else if(action==='goto'){if(!Number.isInteger(index)||index<0||index>=count)throw fail('رقم الشريحة غير صالح');slide=index;}else if(action==='black')black=!black;else throw fail('أمر غير صالح');
 return{slide,black};
}
