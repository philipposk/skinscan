-- The new-user trigger only fires on INSERT into auth.users, so every account
-- that already existed in the shared 6x7 project had no skinscan_profiles row.
-- The consent step did `update ... where id = auth.uid()`, which matched nothing
-- and reported success, so those users were sent back to the consent gate
-- forever with no error. Backfill them, and the API now upserts.

insert into skinscan_profiles (id, display_name)
select u.id, coalesce(u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1))
from auth.users u
left join skinscan_profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
