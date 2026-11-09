-- Native iPhone publishing. Apply after 0008; existing web clients remain compatible.
-- One transaction updates the mode, clears the draft and creates the dated post.
-- Caller-supplied UUID doubles as the post ID, making network retries idempotent.
create or replace function public.publish_from_iphone(
  p_screen_id uuid, p_content jsonb, p_mode text, p_request_id uuid
) returns jsonb language plpgsql security invoker set search_path=public as $$
declare
  chosen public.screens%rowtype;
  previous public.posts%rowtype;
  result public.posts%rowtype;
  today date := (now() at time zone 'Asia/Riyadh')::date;
begin
  if not public.staff_can('daily') then raise exception 'لا تملك صلاحية نشر المحتوى'; end if;
  if p_request_id is null then raise exception 'معرّف الطلب مطلوب'; end if;
  if p_mode is null or p_mode not in ('daily','media') then raise exception 'وضع العرض غير مدعوم'; end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' then raise exception 'المحتوى غير صحيح'; end if;
  if octet_length(p_content::text) > 200000 then raise exception 'المحتوى أكبر من الحد المسموح'; end if;
  if coalesce(length(trim(p_content->>'title')),0)=0 and coalesce(length(p_content->>'fullMedia'),0)=0 then
    raise exception 'أضف عنوانًا أو وسائط أولًا';
  end if;
  if p_mode='media' and coalesce(length(p_content->>'fullMedia'),0)=0 then raise exception 'أضف صورة أو فيديو أولًا'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_id::text, 0));
  select * into previous from public.posts where id=p_request_id;
  if found then
    if previous.created_by is distinct from auth.uid() or previous.screen_id <> p_screen_id or previous.content <> p_content then
      raise exception 'معرّف الطلب مستخدم لمحتوى آخر';
    end if;
    return jsonb_build_object('id',previous.id,'publish_at',previous.publish_at);
  end if;
  select * into chosen from public.screens where id=p_screen_id for update;
  if not found then raise exception 'الشاشة غير موجودة'; end if;
  if coalesce(chosen.template->>'displayMode','daily') <> p_mode and not public.staff_can('admin') then
    raise exception 'اطلب من المسؤول تغيير وضع الشاشة أولًا';
  end if;
  update public.screens set draft=null,
    template=case when public.staff_can('admin') then coalesce(template,'{}'::jsonb)||jsonb_build_object('displayMode',p_mode) else template end
    where id=p_screen_id;
  insert into public.posts(id,screen_id,content,publish_at,created_by)
    values(p_request_id,p_screen_id,p_content,today,auth.uid()) returning * into result;
  return jsonb_build_object('id',result.id,'publish_at',result.publish_at);
end $$;
revoke all on function public.publish_from_iphone(uuid,jsonb,text,uuid) from public,anon;
grant execute on function public.publish_from_iphone(uuid,jsonb,text,uuid) to authenticated;
