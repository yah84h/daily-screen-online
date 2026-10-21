-- Remove this bucket's custom cap. Supabase project/plan limits still apply.
update storage.buckets set file_size_limit = null where id = 'media';
