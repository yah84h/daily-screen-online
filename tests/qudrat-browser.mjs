import {chromium} from 'playwright';import {existsSync} from 'node:fs';import {spawn} from 'node:child_process';import {mkdtemp,cp,readFile,writeFile,rm,mkdir} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join,resolve} from 'node:path';import assert from 'node:assert/strict';
const temporary=await mkdtemp(join(tmpdir(),'qudrat-browser-')),base='http://127.0.0.1:28947';
await cp('dist-local',temporary,{recursive:true});const seed=JSON.parse(await readFile(join(temporary,'seed.json'),'utf8'));
seed.screens[0].template.displayMode='loop';seed.screens[0].template.centerSlideshow={enabled:true,images:[{id:'test-photo',url:'/workspace.jpg',name:'صورة تجريبية',fit:'cover',x:50,y:50,zoom:100,brightness:100}],seconds:10,effect:'fade'};seed.screens[0].template.recognition={enabled:true,title:'نجوم الأسبوع',students:[{id:'manual',name:'طالب محفوظ يدويًا',achievement:'تفوق دراسي'}]};await writeFile(join(temporary,'seed.json'),JSON.stringify(seed));
const names=['عبدالرحمن أحمد عبدالله','محمد عبدالله القحطاني','إياد خالد العمري','أحمد فهد الغامدي','سلطان علي الشهراني','عبدالله محمد الزهراني','يزن صالح الحربي','باسم علي القرني','خالد عبدالرحمن العتيبي','عمر عبدالعزيز الشهري'];
const payload={week:45,updated_at:'2026-11-09T15:47:02.941Z',fetchedAt:Date.now(),stale:false,exams:[{kind:'weekly',title:'اختبار الأسبوع · بيانات تجريبية',kind_label:'قدرات عربي',leaders:names.map((name,index)=>({name,rank:index+1,score:100-index*4}))},{kind:'gat',title:'GAT · بيانات تجريبية',kind_label:'قدرات إنجليزي',leaders:['طالب إنجليزي أول','طالب إنجليزي ثانٍ','طالب إنجليزي ثالث'].map((name,index)=>({name,rank:index+1,score:95-index*5}))}]};
const server=spawn(process.execPath,[join(temporary,'server.mjs'),'--localhost'],{env:{...process.env,PORT:'28947'},stdio:'ignore'});let browser;
try{
 for(let i=0;i<100;i++){try{if((await fetch(base+'/local/status')).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}
 browser=await chromium.launch({executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH||(existsSync('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined),headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),errors=[],requests=[];
 context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
 await context.route('**/*',route=>{
  const url=route.request().url();requests.push(url);
  if(url===base+'/api/qudrat-pro')return route.fulfill({json:payload});
  if(url.startsWith(base))return route.continue();return route.abort();
 });
 const admin=await context.newPage();await admin.goto(base+'/admin');await admin.getByLabel('اسم المستخدم',{exact:true}).fill('Archo');await admin.getByLabel('كلمة المرور',{exact:true}).fill('Arc@2027');await admin.getByRole('button',{name:'تسجيل الدخول',exact:true}).click();await admin.waitForURL('**/admin');
 await admin.getByRole('button',{name:'خلفية الحصص',exact:true}).click();
 await admin.getByLabel('مصدر لوحة التميز',{exact:true}).selectOption('qudrat-pro');await admin.getByLabel('مدة صفحة قدرات برو',{exact:true}).selectOption('6');
 await admin.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await admin.getByRole('status').filter({hasText:'تم حفظ'}).waitFor();
 const persisted=JSON.parse(await readFile(join(temporary,'data/state.json'),'utf8'));assert.equal(persisted.screens[0].template.recognition.source,'qudrat-pro');assert.equal(persisted.screens[0].template.recognition.students[0].name,'طالب محفوظ يدويًا');
 const tv=await context.newPage();await tv.setViewportSize({width:1920,height:1080});await tv.goto(base+'/display');const board=tv.locator('.qudrat-board');await board.waitFor();
 for(const name of names.slice(0,3))await board.locator('.qudrat-podium').getByTitle(name,{exact:true}).waitFor();
 await board.locator('.qudrat-ranking').getByTitle(names[3],{exact:true}).waitFor();
 await board.locator('.qudrat-ranking').getByTitle(names[6],{exact:true}).waitFor({timeout:9000});
 for(const name of names.slice(0,3))assert(await board.locator('.qudrat-podium').getByTitle(name,{exact:true}).isVisible());
 await tv.emulateMedia({reducedMotion:'reduce'});assert.equal(await board.locator('.qudrat-ranking').evaluate(el=>getComputedStyle(el).animationName),'none');
 for(const label of ['ثلاثة أعمدة متوازنة','ثلاثة أعمدة معكوسة','الصورة يسارًا','الصورة يمينًا','التميز في الوسط','الساعة يمينًا','الصورة هي الأساس']){
  await admin.getByRole('button',{name:'توزيع '+label,exact:true}).click();
  const preview=admin.locator('.screen-loop');
  const boxes=await Promise.all(['.loop-clock-panel','.recognition-board','.loop-center-slideshow'].map(selector=>preview.locator(selector).boundingBox()));
  for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert(a&&b);assert(a.x+a.width<=b.x+1||b.x+b.width<=a.x+1||a.y+a.height<=b.y+1||b.y+b.height<=a.y+1,'Layout elements overlap: '+label);}
 }
 await admin.getByRole('button',{name:'توزيع ثلاثة أعمدة معكوسة',exact:true}).click();
 for(const [name,clock,leaders] of [['ساعة وتميز · متوازن',1,1],['ساعة وتميز · التميز أكبر',1,1],['الساعة فقط · في الوسط',1,0],['الساعة فقط · رقمية',1,0],['التميز فقط · في الوسط',0,1],['التميز فقط · واسع',0,1]]){await admin.getByRole('button',{name:'توزيع '+name,exact:true}).click();assert.equal(await admin.locator('.loop-canvas .loop-clock-panel').count(),clock);assert.equal(await admin.locator('.loop-canvas .recognition-board').count(),leaders);assert.equal(await admin.locator('.loop-canvas .loop-center-slideshow').count(),0);}
 await admin.getByRole('button',{name:'توزيع ثلاثة أعمدة معكوسة',exact:true}).click();
 for(const variant of ['aurora','dots','grid','orbits','plain','waves']){await admin.getByLabel('نمط خلفية الحصص',{exact:true}).selectOption(variant);assert.equal(await admin.locator('.screen-loop').getAttribute('data-backdrop'),variant);}
 await admin.getByLabel('مظهر بطاقات الحصص',{exact:true}).selectOption('glass');
 for(const label of ['بطاقة موضوع اليوم','بطاقة إعلان المدرسة','جدول حصص اليوم','التاريخ الهجري'])await admin.getByLabel(label,{exact:true}).check();
 await admin.getByLabel('عنوان الإعلان',{exact:true}).fill('إعلان تجريبي');await admin.getByLabel('نص الإعلان',{exact:true}).fill('مرحبًا بطلاب المدرسة');
 await admin.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await admin.getByRole('status').filter({hasText:'تم حفظ'}).waitFor();
 await tv.locator('.loop-extra-cards').waitFor();await tv.getByText('إعلان تجريبي',{exact:true}).waitFor();assert.equal(await tv.locator('.loop-schedule>div').count(),7);
 assert.equal(await tv.locator('.loop-hijri').count(),1);assert(await tv.locator('.loop-clock-panel').evaluate(el=>el.scrollHeight<=el.clientHeight+1));
 const extraBounds=await tv.locator('.loop-extras').boundingBox(),clockBounds=await tv.locator('.loop-clock-panel').boundingBox();assert(extraBounds.y>=clockBounds.y+clockBounds.height);
 const output=resolve(process.env.TEST_OUTPUT_DIR||'work/test-output/qudrat');await mkdir(output,{recursive:true});
 await tv.screenshot({path:join(output,'qudrat-pro-tv-preview.png')});await board.screenshot({path:join(output,'qudrat-pro-board-preview.png')});
 for(const size of [{width:3840,height:2160},{width:1440,height:900}]){
  await tv.setViewportSize(size);assert(await board.evaluate(el=>el.scrollHeight<=el.clientHeight+1));const box=await board.boundingBox();assert(box.x>=0&&box.y+box.height<size.height);
 }
 await tv.route('**/api/qudrat-pro',route=>route.fulfill({status:503,json:{error:'UPSTREAM_UNAVAILABLE'}}));
 await tv.evaluate(()=>{const key='daily-screen-qudrat-pro-v1',value=JSON.parse(localStorage.getItem(key));value.at=0;localStorage.setItem(key,JSON.stringify(value));});await tv.reload();await tv.locator('.qudrat-podium').waitFor();assert.equal(await tv.locator('.qudrat-stale').count(),0);assert(await tv.locator('.qudrat-podium').getByTitle(names[0],{exact:true}).isVisible());
 await admin.getByLabel('اختبار قدرات برو',{exact:true}).selectOption('gat');await admin.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await admin.getByRole('status').filter({hasText:'تم حفظ'}).waitFor();
 await tv.locator('.qudrat-podium').getByTitle('طالب إنجليزي أول',{exact:true}).waitFor({timeout:10000});assert.equal(await tv.locator('.qudrat-ranking').count(),0);assert.equal(await tv.locator('.qudrat-pagination').count(),0);
 await admin.setViewportSize({width:390,height:844});assert(await admin.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await admin.screenshot({path:join(output,'qudrat-pro-mobile-settings.png'),fullPage:true});
 await admin.getByLabel('مصدر لوحة التميز',{exact:true}).selectOption('manual');assert.equal(await admin.getByLabel('اسم الطالب 1',{exact:true}).inputValue(),'طالب محفوظ يدويًا');
 await admin.getByRole('button',{name:'توزيع بدون صورة · الساعة يسارًا',exact:true}).click();assert.equal(await admin.locator('.loop-center-slideshow').count(),0);
 await admin.getByLabel('إخفاء صور الوسط',{exact:true}).uncheck();await admin.getByRole('button',{name:'توزيع ثلاثة أعمدة معكوسة',exact:true}).click();
 await admin.getByRole('button',{name:'تحريك وتكبير باللمس',exact:true}).click();
 await admin.getByLabel('العنصر المتحرك',{exact:true}).selectOption('school');
 const edit=admin.locator('.loop-edit-box.selected'),before=await edit.boundingBox();await admin.mouse.move(before.x+before.width/2,before.y+before.height/2);await admin.mouse.down();await admin.mouse.move(before.x+before.width/2+15,before.y+before.height/2+10,{steps:4});await admin.mouse.up();
 const after=await edit.boundingBox();assert(after.x>before.x+8&&after.y>before.y+5,'Drag changes position');
 const handle=edit.getByRole('separator'),hb=await handle.boundingBox();await admin.mouse.move(hb.x+hb.width/2,hb.y+hb.height/2);await admin.mouse.down();await admin.mouse.move(hb.x+hb.width/2+12,hb.y+hb.height/2+8,{steps:4});await admin.mouse.up();assert((await edit.boundingBox()).width>after.width+5,'Corner resizes element');
 await admin.getByLabel('العنصر المتحرك',{exact:true}).selectOption('news');await admin.locator('.loop-edit-box.selected').focus();await admin.keyboard.press('ArrowUp');
 await admin.getByRole('button',{name:'إنهاء التحريك',exact:true}).click();await admin.getByRole('button',{name:'حفظ الخلفية ولوحة التميز',exact:true}).click();await admin.getByRole('status').filter({hasText:'تم حفظ'}).waitFor();
 const custom=JSON.parse(await readFile(join(temporary,'data/state.json'),'utf8')).screens[0].template.loopPositions;assert(custom.school&&custom.tuwaiq&&custom.ministry&&custom.news);assert(custom.school.x>20);
 const mobileContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,storageState:await context.storageState(),serviceWorkers:'block'});const phone=await mobileContext.newPage();await phone.goto(base+'/admin');await phone.getByRole('button',{name:'خلفية الحصص',exact:true}).click();await phone.getByRole('button',{name:'تحريك وتكبير باللمس',exact:true}).click();await phone.getByLabel('العنصر المتحرك',{exact:true}).selectOption('ministry');await phone.locator('.loop-canvas').scrollIntoViewIfNeeded();
 const mobileBox=phone.locator('.loop-edit-box.selected');const mb=await mobileBox.boundingBox(),session=await mobileContext.newCDPSession(phone);const tx=mb.x+mb.width/2,ty=mb.y+mb.height/2;
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:tx,y:ty}]});await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:tx-12,y:ty+10}]});await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const moved=await mobileBox.boundingBox();assert(moved.x<mb.x-5&&moved.y>mb.y+5,'Phone touch moves logo '+JSON.stringify({mb,moved,tx,ty}));assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await mobileContext.close();
 assert.deepEqual(errors,[]);assert(!requests.some(url=>url.includes('supabase.co')||url.includes('key=')));
 console.log('PASS Qudrat Pro website: source saving/manual preservation, persistent podium, page rotation, English-only three-person board, cached failure state, reduced motion, 4K/Mac sizing, mobile controls and no direct upstream/key exposure.');
}finally{await browser?.close();server.kill();await rm(temporary,{recursive:true,force:true});}
