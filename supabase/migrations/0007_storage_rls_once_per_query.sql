-- Privacy rules (RLS) ran auth.uid() / the is_admin() check once per row. Wrapped in (select ...) so each runs once
-- per query (Postgres InitPlan). Identical access, checked by hashing every visible row for 7 users and anon before
-- and after. Already applied to production on 2026-10-29.
alter policy p_skinscan_obj_owner on storage.objects using (((bucket_id = 'skinscan'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text))) with check (((bucket_id = 'skinscan'::text) AND ((storage.foldername(name))[1] = ((select auth.uid()))::text)));
