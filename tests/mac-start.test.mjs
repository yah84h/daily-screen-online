import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,cp,mkdir,writeFile,readFile,rm,readdir,unlink,rmdir} from 'node:fs/promises';import {existsSync} from 'node:fs';import {join} from 'node:path';import {tmpdir} from 'node:os';import {spawn,spawnSync} from 'node:child_process';
test('source server guides missing builds and then serves the actual built website',async()=>{
 const root=await mkdtemp(join(tmpdir(),'mac-source-start-'));const local=join(root,'local-test');let server;
 try{
  await cp('local-test',local,{recursive:true,filter:source=>!source.includes('/data')});await writeFile(join(root,'package.json'),'{}');
  server=spawn(process.execPath,[join(local,'server.mjs'),'--localhost'],{env:{...process.env,PORT:'28950'},stdio:'ignore'});
  let status;for(let i=0;i<100;i++){try{const response=await fetch('http://127.0.0.1:28950/local/status');if(response.ok){status=await response.json();break;}}catch{}await new Promise(r=>setTimeout(r,50));}
  assert(status,'Fixture did not start');assert.equal(status.webReady,false);
  const missing=await fetch('http://127.0.0.1:28950/admin');assert.equal(missing.status,503);const text=await missing.text();assert(text.includes('Start-Mac.command'));assert(!text.includes('ENOENT'));
  await mkdir(join(root,'dist-local','web'),{recursive:true});await writeFile(join(root,'dist-local','web','index.html'),'<html>mac-built-frontend</html>');
  const page=await fetch('http://127.0.0.1:28950/admin');assert.equal(page.status,200);assert((await page.text()).includes('mac-built-frontend'));
  assert.equal((await(await fetch('http://127.0.0.1:28950/local/status')).json()).webReady,true);
 }finally{server?.kill();await rm(root,{recursive:true,force:true});}
});
test('rebuilding the local package preserves an existing data directory',async()=>{
 const data='dist-local/data',existed=existsSync(data),file=join(data,'mac-rebuild-sentinel-'+process.pid);await mkdir(data,{recursive:true});await writeFile(file,'preserve-existing-data');
 try{
  const result=spawnSync(process.execPath,['scripts/build-local.mjs','--offline-only'],{encoding:'utf8',timeout:120000});assert.equal(result.status,0,result.stderr);assert.equal(await readFile(file,'utf8'),'preserve-existing-data');
 }finally{await unlink(file).catch(()=>{});if(!existed&&(await readdir(data)).length===0)await rmdir(data);}
});
