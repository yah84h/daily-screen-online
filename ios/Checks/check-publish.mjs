/** Isolated PostgreSQL-compatible validation. Never connects to Supabase.
 * Install the test-only runtime outside the repo and provide PGLITE_MODULE:
 * npm install --prefix /tmp/iphone-check @electric-sql/pglite
 * PGLITE_MODULE=/tmp/iphone-check/node_modules/@electric-sql/pglite/dist/index.js node ios/Checks/check-publish.mjs
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const modulePath = process.env.PGLITE_MODULE;
if (!modulePath) throw Error('Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js');
const { PGlite } = await import(pathToFileURL(modulePath).href);
const db = new PGlite();
const admin='00000000-0000-0000-0000-000000000001',daily='00000000-0000-0000-0000-000000000002',news='00000000-0000-0000-0000-000000000003',screen='00000000-0000-0000-0000-000000000010';
const migration=await readFile(new URL('../../supabase/migrations/0009_iphone_publish.sql',import.meta.url),'utf8');
const permissions=await readFile(new URL('../../supabase/migrations/0006_staff_permissions.sql',import.meta.url),'utf8');
try {
 await db.exec(`
 create role anon; create role authenticated;
 create schema auth;
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user',true),'')::uuid $$;
 create table staff_profiles(user_id uuid primary key,permissions jsonb,active boolean default true);
 create function public.staff_can(p text) returns boolean language sql stable security definer as $$ select exists(select 1 from staff_profiles where user_id=auth.uid() and active and (permissions->>'admin'='true' or permissions->>p='true')) $$;
 create table screens(id uuid primary key,name text,template jsonb,draft jsonb,created_at timestamptz default now());
 create table posts(id uuid primary key,screen_id uuid references screens(id),content jsonb check(content->>'title'<>'ROLLBACK'),publish_at date,created_by uuid);
 grant usage on schema public,auth to authenticated,anon;
 grant select,insert,update on screens,posts to authenticated;
 insert into staff_profiles values('${admin}','{"admin":true}',true),('${daily}','{"daily":true}',true),('${news}','{"news":true}',true);
 insert into screens(id,name,template,draft) values('${screen}','Test','{"displayMode":"loop","news":{"items":[]},"recognition":{"enabled":true},"futureSetting":7}','{"title":"draft"}');
 `);
 const triggerFunction=permissions.match(/create or replace function public\.preserve_screen_news\(\)[\s\S]*?end \$\$;/i)?.[0];
 assert(triggerFunction,'Production preservation trigger must be loaded');
 await db.exec(triggerFunction+`\ncreate trigger preserve_news before update on screens for each row execute function preserve_screen_news();`);
 await db.exec(migration);
 const asUser=async id=>{await db.query("select set_config('test.user',$1,false)",[id]);await db.exec('set role authenticated');};
 let counter=100;
 const publish=async(title,mode='daily',id=`00000000-0000-0000-0000-${String(counter++).padStart(12,'0')}`)=>{
  const result=await db.query('select publish_from_iphone($1,$2::jsonb,$3,$4) as result',[screen,JSON.stringify({title}),mode,id]);return result.rows[0].result;
 };
 await asUser(news);
 await assert.rejects(()=>publish('Denied'),/صلاحية/);
 await asUser(daily);
 await assert.rejects(()=>publish('No mode change'),/المسؤول/);
 await asUser(admin);
 const id='00000000-0000-0000-0000-000000000099';
 const receipt=await publish('Hello','daily',id);
 assert.equal(receipt.id,id);
 const repeated=await publish('Hello','daily',id);assert.deepEqual(receipt,repeated);
 assert.equal((await db.query('select count(*)::int as n from posts')).rows[0].n,1);
 await assert.rejects(()=>publish('Changed','daily',id),/محتوى آخر/);
 const state=(await db.query('select * from screens')).rows[0];
 assert.equal(state.template.displayMode,'daily');assert.equal(state.template.futureSetting,7);
 assert.equal(state.template.recognition.enabled,true);assert.deepEqual(state.template.news,{items:[]});assert.equal(state.draft,null);
 await asUser(daily);await publish('Daily teacher');
 await asUser(admin);
 await db.query("update screens set template=template||'{\"displayMode\":\"loop\"}'::jsonb,draft='{\"title\":\"keep\"}'");
 await assert.rejects(()=>publish('ROLLBACK'),/check constraint/);
 const rolled=(await db.query('select template,draft from screens')).rows[0];
 assert.equal(rolled.template.displayMode,'loop');assert.equal(rolled.draft.title,'keep');
 await assert.rejects(()=>publish('Bad mode','slideshow'),/غير مدعوم/);
 await assert.rejects(()=>publish(''),/عنوان/);
 await db.exec('reset role;set role anon;');
 await assert.rejects(()=>publish('Anon'),/permission denied/);
 console.log('PASS: isolated SQL checks — roles, mode permissions, preservation, atomic rollback, idempotent retry, validation and anonymous denial');
} finally { await db.close(); }
