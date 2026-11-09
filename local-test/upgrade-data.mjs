import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import readline from 'node:readline/promises';
const root=path.dirname(fileURLToPath(import.meta.url)),target=path.join(root,'data');
const exists=async p=>{try{await fs.access(p);return true;}catch{return false;}};
if(await exists(target)){console.log('This version already has a data folder. Nothing was overwritten. Run Start-Mac.command.');process.exit(0);}
let running=false;
try{const response=await fetch('http://127.0.0.1:'+(Number(process.env.PORT)||8080)+'/local/status',{signal:AbortSignal.timeout(1500)});running=response.ok;}catch{}
if(running){console.error('Stop the old local server with Control+C before copying its data, then run this upgrade again.');process.exit(1);}
const parent=path.dirname(root),candidates=[];
for(const entry of await fs.readdir(parent,{withFileTypes:true})){
 if(!entry.isDirectory()||!/^SchoolScreen-Local-Server(?:[- ].*)?$/.test(entry.name))continue;
 const folder=path.join(parent,entry.name);if(folder===root)continue;
 if(await exists(path.join(folder,'data','state.json')))candidates.push(folder);
}
if(!candidates.length){console.log('No previous sibling server data found. To keep existing content, place this folder next to the old SchoolScreen-Local-Server folder and retry, or copy its data folder here manually while the server is stopped. Nothing was changed.');process.exit(0);}
let source;
if(candidates.length===1)source=candidates[0];
else {
 console.log('Choose the existing server to copy (the original will be kept):');candidates.forEach((p,i)=>console.log(`${i+1}. ${p}`));
 const input=readline.createInterface({input:process.stdin,output:process.stdout});const choice=Number(await input.question('Number: '));input.close();
 if(!Number.isInteger(choice)||choice<1||choice>candidates.length){console.error('No data was copied.');process.exit(1);}source=candidates[choice-1];
}
const state=path.join(source,'data','state.json'),original=await fs.readFile(state),hash=b=>createHash('sha256').update(b).digest('hex');JSON.parse(original.toString());
const temporary=target+'.upgrade-'+process.pid;
try {
 await fs.cp(path.join(source,'data'),temporary,{recursive:true,dereference:false,verbatimSymlinks:true});
 const copied=await fs.readFile(path.join(temporary,'state.json'));
 if(hash(copied)!==hash(original)||hash(await fs.readFile(state))!==hash(original))throw Error('Source content changed while copying. Stop the old server and retry.');
 if(await exists(path.join(temporary,'staff.json')))JSON.parse(await fs.readFile(path.join(temporary,'staff.json'),'utf8'));
 if(await exists(target))throw Error('A destination data folder appeared. Nothing will be overwritten.');
 await fs.rename(temporary,target);
 console.log('Copied accounts, content and media from: '+source);console.log('The original data folder was kept. Now run Start-Mac.command.');
}catch(error){await fs.rm(temporary,{recursive:true,force:true});throw error;}
