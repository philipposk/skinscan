-- Assessments and change comparisons are written through the *user's* client so
-- that RLS still applies, but the original policies granted SELECT only. Every
-- insert was rejected with "new row violates row-level security policy", after
-- the models had already run — so the app burned four API calls and then threw
-- the answer away.
--
-- A user may write rows about their own lesions. Nobody may write anyone else's:
-- the WITH CHECK ties the row to auth.uid() and, for good measure, verifies the
-- lesion is theirs, so a forged user_id cannot attach an assessment to someone
-- else's spot.

drop policy if exists p_assessments_insert on skinscan_assessments;
create policy p_assessments_insert on skinscan_assessments
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from skinscan_lesions l where l.id = lesion_id and l.user_id = auth.uid())
  );

drop policy if exists p_changes_insert on skinscan_changes;
create policy p_changes_insert on skinscan_changes
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (select 1 from skinscan_lesions l where l.id = lesion_id and l.user_id = auth.uid())
  );

-- Neither table is ever edited after the fact. An assessment is a dated record
-- of what the models said at the time, so there is deliberately no UPDATE
-- policy — the history stays honest.
