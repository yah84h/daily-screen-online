import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {spawn} from 'node:child_process';
const fixture=await readFile('tests/fixtures/direct-link.mp3');
const browser=await chromium.launch({headless:true});
try{for(const drive of [false,true]){
 const folder=await mkdtemp(join(tmpdir(),'audio-preparation-')),port=34000+Math.floor(Math.random()*15000),base='http://127.0.0.1:'+port;
 await cp('dist-local',folder,{recursive:true});await rm(join(folder,'data'),{recursive:true,force:true});
 const seed=JSON.parse(await readFile(join(folder,'seed.json'),'utf8'));
 seed.screens[0].template={...seed.screens[0].template,displayMode:'daily',rotation:{enabled:false}};
 seed.posts[0].publish_at=new Date().toLocaleDateString('en-CA',{timeZone:'Asia/Riyadh'});
 seed.posts[0].content.backgroundAudio={url:drive?'https://drive.google.com/file/d/audio_test_123456789/view':'https://audio.example/test.mp3',name:'Test audio'};
 await writeFile(join(folder,'seed.json'),JSON.stringify(seed));
 const server=spawn(process.execPath,[join(folder,'server.mjs'),'--localhost'],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
 const context=await browser.newContext({serviceWorkers:'block'});
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base+'/local/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
  let release;const gate=new Promise(resolve=>{release=resolve;});let started;const requestStarted=new Promise(resolve=>{started=resolve;});let requests=0;
  await context.route(drive?'**/api/drive-video?*':'https://audio.example/**',async route=>{
   requests++;started();await gate;
   // Force several bounded responses to prove the whole Drive file is assembled.
   const offset=drive?Number(/bytes=(\d+)/.exec(route.request().headers().range||'')?.[1]||0):0,end=drive?Math.min(offset+399,fixture.length-1):fixture.length-1;
   await route.fulfill({status:drive?206:200,contentType:'audio/mpeg',headers:drive?{'Content-Range':`bytes ${offset}-${end}/${fixture.length}`}:{},body:fixture.subarray(offset,end+1)});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/display');await requestStarted;
  const audio=page.locator('audio[data-background-audio]');await audio.waitFor({state:'attached'});
  assert.equal(await audio.getAttribute('src'),null,'No playable source until the complete download finishes');
  assert(await audio.evaluate(el=>el.paused));release();
  await page.waitForFunction(()=>document.querySelector('audio[data-background-audio]')?.getAttribute('src')?.startsWith('blob:'));
  await audio.evaluate(el=>el.play());await page.waitForFunction(()=>document.querySelector('audio[data-background-audio]')?.currentTime>0);
  assert(await audio.evaluate(el=>el.loop));assert.equal(drive?requests>1:requests===1,true);
  const preparedRequests=requests;await page.waitForTimeout(2400);assert.equal(requests,preparedRequests,'Loop playback reuses downloaded bytes');assert.deepEqual(errors,[]);
  console.log('PASS '+(drive?'chunked Drive':'direct MP3')+': waits for full download, plays a Blob URL, and loops without refetching.');
 }finally{await context.close();server.kill();await rm(folder,{recursive:true,force:true});}
}}finally{await browser.close();}
