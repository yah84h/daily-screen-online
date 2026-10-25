-- Existing managed authenticated school accounts may edit news. Keep public sign-ups disabled.
create or replace function public.save_screen_news(p_screen_id uuid,p_news jsonb,p_pin text default '')
returns jsonb language plpgsql security invoker set search_path=public as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'تسجيل الدخول مطلوب'; end if;
 if jsonb_typeof(p_news->'items') is distinct from 'array' then raise exception 'قائمة الأخبار غير صحيحة'; end if;
 if jsonb_array_length(p_news->'items')>30 then raise exception 'حد الأخبار ٣٠'; end if;
 if exists(select 1 from jsonb_array_elements(p_news->'items') x where jsonb_typeof(x->'text') is distinct from 'string' or length(trim(x->>'text')) not between 1 and 300) then raise exception 'نص الخبر مطلوب وبحد أقصى ٣٠٠ حرف'; end if;
 perform set_config('app.news_update','1',true);
 update public.screens set template=jsonb_set(template,'{news}',p_news,true) where id=p_screen_id returning template->'news' into result;
 if result is null then raise exception 'الشاشة غير موجودة أو لا تملك صلاحية'; end if;
 return result;
end $$;
revoke all on function public.save_screen_news(uuid,jsonb,text) from public,anon;
grant execute on function public.save_screen_news(uuid,jsonb,text) to authenticated;
-- Prevent stale template saves from overwriting newer news.
create or replace function public.preserve_screen_news() returns trigger language plpgsql as $$
begin
 if coalesce(current_setting('app.news_update',true),'')<>'1' then
  if old.template ? 'news' then new.template=jsonb_set(new.template,'{news}',old.template->'news',true); else new.template=new.template-'news'; end if;
 end if;
 return new;
end $$;
create trigger preserve_news before update of template on public.screens for each row execute function public.preserve_screen_news();
update public.school_settings set name='الموهوبين التقنية الثانوية بجدة - بنين' where name in ('مدارس الموهوبين التقنيه بجدة','مدارس الموهوبين التقنية بجدة','ثانوية الموهوبين التقنية','معهد النور');
update public.screens set template=jsonb_set(template,'{loopSchoolName}','"الموهوبين التقنية الثانوية بجدة - بنين"') where template->>'loopSchoolName' in ('مدارس الموهوبين التقنيه بجدة','مدارس الموهوبين التقنية بجدة','ثانوية الموهوبين التقنية');
update public.screens set template=jsonb_set(template,'{schoolName}','"الموهوبين التقنية الثانوية بجدة - بنين"') where template->>'schoolName' in ('مدارس الموهوبين التقنيه بجدة','مدارس الموهوبين التقنية بجدة','ثانوية الموهوبين التقنية');

alter table public.school_settings alter column name set default 'الموهوبين التقنية الثانوية بجدة - بنين';
