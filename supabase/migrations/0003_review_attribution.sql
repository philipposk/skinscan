-- A signed review is the patient's record, not the platform's, and it has to
-- stay complete and attributable for as long as the patient wants it. Two
-- problems with the original shape:
--
--   1. skinscan_reviews.doctor_id referenced skinscan_doctors with no ON DELETE
--      behaviour, so a clinician could never delete their account. That is a
--      GDPR Article 17 problem for them, and it made the case unresolvable
--      either way: keep the doctor row forever, or destroy the patient's
--      medical record.
--   2. The patient's case page read the signing clinician's name by joining to
--      skinscan_doctors, so the attribution on an already-signed document
--      depended on a row that might later change or disappear.
--
-- Both are fixed by writing the clinician's identity onto the review at the
-- moment of signing. The document then stands on its own, exactly like a paper
-- one, and the account can be deleted without taking the record with it.

alter table skinscan_reviews
  add column if not exists signed_by_name text,
  add column if not exists signed_by_license_number text,
  add column if not exists signed_by_license_country text;

update skinscan_reviews r
   set signed_by_name = d.full_name,
       signed_by_license_number = d.license_number,
       signed_by_license_country = d.license_country
  from skinscan_doctors d
 where d.id = r.doctor_id
   and r.signed_by_name is null;

alter table skinscan_reviews alter column doctor_id drop not null;
alter table skinscan_reviews drop constraint if exists skinscan_reviews_doctor_id_fkey;
alter table skinscan_reviews
  add constraint skinscan_reviews_doctor_id_fkey
  foreign key (doctor_id) references skinscan_doctors(id) on delete set null;

-- Same reasoning for the case: losing the doctor account must not orphan or
-- block the case, it just stops pointing at a live account.
alter table skinscan_cases drop constraint if exists skinscan_cases_assigned_doctor_id_fkey;
alter table skinscan_cases
  add constraint skinscan_cases_assigned_doctor_id_fkey
  foreign key (assigned_doctor_id) references skinscan_doctors(id) on delete set null;

-- The doctor writes their own review row, so the RLS check has to keep working
-- while doctor_id is still theirs.
drop policy if exists p_reviews_doctor on skinscan_reviews;
create policy p_reviews_doctor on skinscan_reviews
  for all using (doctor_id = auth.uid() and skinscan_is_verified_doctor())
  with check (doctor_id = auth.uid() and skinscan_is_verified_doctor());
