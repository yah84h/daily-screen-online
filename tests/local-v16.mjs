// Run after npm run build:local. Uses a disposable copy; never changes school data.
import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdtemp,cp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {spawn} from 'node:child_process';
const temp=await mkdtemp(join(tmpdir(),'daily-screen-v16-'));
await cp(resolve('dist-local'),temp,{recursive:true});await rm(join(temp,'data'),{recursive:true,force:true});
const port=18000+Math.floor(Math.random()*1000),base=`http://127.0.0.1:${port}`;
const server=spawn(process.execPath,[join(temp,'server.mjs')],{env:{...process.env,PORT:String(port)},stdio:'ignore'});
let browser,adminPage;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
 const errors=[],remote=[];context.on('page',p=>{p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(/supabase\.co/.test(r.url()))remote.push(r.url());});});
 const a=await context.newPage();adminPage=a;a.setDefaultTimeout(30000);await a.goto(base+'/admin');
 await a.getByRole('button',{name:'المحتوى اليومي رسالة وصورة بهوية المدرسة'}).click();
 await a.getByLabel('عنوان اليوم',{exact:true}).fill('الشاشة الأولى');await a.getByRole('button',{name:'نشر على الشاشة',exact:true}).click();
 const one=await context.newPage();await one.setViewportSize({width:1920,height:1080});await one.goto(base+'/display');await one.getByRole('heading',{name:'الشاشة الأولى',exact:true}).waitFor();
 await a.getByRole('button',{name:'خلفية الحصص خلفية متحركة، ساعة وحصة'}).click();await a.getByRole('button',{name:'نشر على الشاشة',exact:true}).click();await one.waitForSelector('.screen-loop');
 console.log('PASS Home Publish applies both content and display mode without a second save.');await a.bringToFront();
 await a.getByRole('button',{name:'خلفية الحصص',exact:true}).click();await a.getByRole('tab',{name:'مجموعة',exact:true}).click();await a.getByLabel('عدد الطلاب في المجموعة').selectOption('4');
 for(let i=3;i<=4;i++){await a.getByRole('button',{name:'إضافة طالب',exact:true}).evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await a.getByRole('button',{name:'إضافة طالب',exact:true}).click();await a.getByLabel('اسم الطالب '+i,{exact:true}).fill('الطالب '+i);}
 await a.getByLabel('حجم واجهة خلفية الحصص',{exact:true}).fill('105');await a.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await one.waitForSelector('.recognition-group');await one.waitForFunction(()=>document.querySelectorAll('.recognition-student').length===4);
 assert(await one.evaluate(()=>{const board=document.querySelector('.recognition-board').getBoundingClientRect(),logos=document.querySelector('.native-brand-pair').getBoundingClientRect();return board.bottom<=logos.top||board.left>=logos.right||board.right<=logos.left;}));
 const box=await one.locator('.native-brand-pair').boundingBox();await a.getByLabel('إظهار اللوحة',{exact:true}).uncheck();await a.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await one.waitForSelector('.recognition-board',{state:'detached'});assert.deepEqual(await one.locator('.native-brand-pair').boundingBox(),box);
 await a.getByLabel('إظهار اللوحة',{exact:true}).check();await a.getByRole('tab',{name:'طالب واحد',exact:true}).click();await a.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await one.waitForSelector('.recognition-solo');await one.waitForFunction(()=>document.querySelectorAll('.recognition-student').length===1);
 await a.getByRole('tab',{name:'القائمة الحالية',exact:true}).click();await a.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await one.waitForSelector('.recognition-classic');await one.waitForFunction(()=>document.querySelectorAll('.recognition-student').length===2);
 assert(await a.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));console.log('PASS solo/group/classic board, 4 students, 105% scale, stationary logos, mobile width.');
 await a.bringToFront();await a.getByRole('button',{name:'الشاشات',exact:true}).click();await a.getByPlaceholder('اسم شاشة جديدة (مثال: شاشة المعلمين)').fill('الشاشة الثانية');await a.getByRole('button',{name:'إضافة',exact:true}).click();await a.getByLabel('اختيار الشاشة').selectOption({label:'الشاشة الثانية'});
 await a.getByRole('button',{name:'رابط العرض · /display2',exact:true}).click();const link=await a.getByLabel('رابط الشاشة 2',{exact:true}).inputValue();assert(link.includes('/display2?token='));
 const two=await context.newPage();await two.goto(link);await two.waitForSelector('.screen-loop');await a.getByRole('button',{name:'الرئيسية',exact:true}).click();await a.getByRole('button',{name:'المحتوى اليومي رسالة وصورة بهوية المدرسة'}).click();await a.getByLabel('عنوان اليوم',{exact:true}).fill('محتوى الشاشة الثانية');await a.getByRole('button',{name:'نشر على الشاشة',exact:true}).click();await two.getByRole('heading',{name:'محتوى الشاشة الثانية',exact:true}).waitFor();assert.equal(await one.locator('.screen-loop').count(),1);
 await a.getByLabel('اختيار الشاشة').selectOption({label:'الشاشة التجريبية'});await a.getByRole('button',{name:'المحتوى اليومي رسالة وصورة بهوية المدرسة'}).click();await a.getByLabel('عنوان اليوم',{exact:true}).fill('محتوى الشاشة الأولى');await a.getByRole('button',{name:'نشر على الشاشة',exact:true}).click();await one.getByRole('heading',{name:'محتوى الشاشة الأولى',exact:true}).waitFor();assert.equal(await two.locator('.screen-copy h1').textContent(),'محتوى الشاشة الثانية');
 await one.waitForFunction(async()=>{const r=indexedDB.open('daily-screen-offline',1);return await new Promise(resolve=>{r.onsuccess=()=>{const db=r.result,read=db.transaction('screen').objectStore('screen').getAll();read.onsuccess=()=>resolve(new Set(read.result.map(s=>s.screen.id)).size===2);};});});
 await a.reload();assert.equal(await a.getByLabel('اختيار الشاشة').inputValue(),(JSON.parse(await readFile(join(temp,'data/state.json'),'utf8'))).screens[0].id);
 assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);console.log('PASS /display and /display2 links, independent live publications, per-monitor offline caches, persisted state, no cloud requests or JS errors.');
}catch(error){await adminPage?.screenshot({path:join(tmpdir(),'daily-screen-v16-failure.png'),fullPage:true});throw error;}finally{await browser?.close();server.kill('SIGTERM');await new Promise(r=>server.exitCode!==null?r():server.once('exit',r));await rm(temp,{recursive:true,force:true});}
