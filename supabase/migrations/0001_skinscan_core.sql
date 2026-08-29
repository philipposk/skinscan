-- SkinScan core schema.
-- Lives in the shared 6x7 Supabase project (fmrnqepyyjucnfbrqawl, eu-central-1 /
-- Frankfurt), so every table is prefixed `skinscan_` like transcriber_/translator_.
--
-- Everything here stores GDPR Article 9 "special category" health data. Two rules
-- follow from that and are enforced below, not just documented:
--   1. RLS is on for every table and the default is deny. A patient sees only
--      their own rows; a doctor sees a patient's rows only through a case that
--      has been paid for and assigned to that doctor.
--   2. Every doctor-side read of patient data is written to skinscan_audit.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type skinscan_role as enum ('patient', 'doctor', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skinscan_lesion_status as enum ('monitoring', 'stable', 'resolved', 'excised', 'archived');
exception when duplicate_object then null; end $$;

-- Deliberately NOT diagnostic categories. These are monitoring bands, which is
-- what keeps the product on the "documentation + triage" side of EU MDR rather
-- than making a diagnostic claim.
do $$ begin
  create type skinscan_risk_band as enum ('reassuring', 'monitor', 'get_checked', 'see_doctor_soon');
exception when duplicate_object then null; end $$;

do $$ begin
  create type skinscan_case_status as enum (
    'draft', 'awaiting_payment', 'paid', 'assigned', 'in_review', 'answered', 'closed', 'refunded'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type skinscan_review_urgency as enum ('routine', 'soon_4_weeks', 'urgent_1_week', 'emergency');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

create table if not exists skinscan_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role skinscan_role not null default 'patient',
  display_name text,
  -- Risk context. Drives the recall interval and is shown to the reviewing
  -- doctor; it is NOT fed to the model as a shortcut to a higher risk band.
  year_of_birth int check (year_of_birth between 1900 and 2100),
  sex_at_birth text check (sex_at_birth in ('female', 'male', 'intersex', 'prefer_not_to_say')),
  fitzpatrick smallint check (fitzpatrick between 1 and 6),
  personal_history_skin_cancer boolean not null default false,
  family_history_melanoma boolean not null default false,
  immunosuppressed boolean not null default false,
  many_moles boolean not null default false,          -- >50 nevi, a real risk multiplier
  history_of_sunburns boolean not null default false,
  locale text not null default 'en',
  -- Consent. Article 9 requires explicit, specific, versioned consent and the
  -- ability to prove when it was given.
  consent_version text,
  consent_at timestamptz,
  consent_ip inet,
  -- Set when the user asks for erasure; a nightly job purges storage objects.
  deletion_requested_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists skinscan_doctors (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  -- Verified out of band against the national register before verified_at is set.
  license_number text not null,
  license_country text not null,
  specialty text not null default 'dermatology',
  bio text,
  languages text[] not null default '{en}',
  verified_at timestamptz,
  verified_by uuid references auth.users(id),
  accepting_cases boolean not null default false,
  payout_cents_per_case int not null default 1500,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Lesions and images
-- ---------------------------------------------------------------------------

create table if not exists skinscan_lesions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null default 'Untitled spot',
  -- Coarse anatomical site, using the ISIC `anatom_site_general` vocabulary so
  -- the value stays comparable with public datasets and legible to a clinician.
  body_site text check (body_site in (
    'head/neck', 'upper extremity', 'lower extremity',
    'anterior torso', 'posterior torso', 'lateral torso',
    'palms/soles', 'oral/genital', 'unknown'
  )),
  laterality text check (laterality in ('left', 'right', 'midline', 'n/a')),
  -- Exact pin on the 3D mesh. Stored as the mesh name plus a normalised point in
  -- the model's own object space, so the pin survives camera moves, re-renders
  -- and future mesh swaps (we can re-project rather than losing the location).
  -- { mesh: string, x: number, y: number, z: number, nx,ny,nz: number, view: 'front'|'back' }
  body_pin jsonb,
  status skinscan_lesion_status not null default 'monitoring',
  first_noticed_on date,
  notes text,
  -- Denormalised for the list view; refreshed by trigger on image insert.
  image_count int not null default 0,
  last_image_at timestamptz,
  latest_risk_band skinscan_risk_band,
  -- When the user should photograph this one again. Interval comes from the
  -- risk band, not from the model's confidence.
  next_review_due date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skinscan_lesions_user_idx on skinscan_lesions(user_id, created_at desc);

create table if not exists skinscan_images (
  id uuid primary key default gen_random_uuid(),
  lesion_id uuid not null references skinscan_lesions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Path inside the private `skinscan` bucket: {user_id}/{lesion_id}/{image_id}.jpg
  storage_path text not null,
  thumb_path text,
  captured_at timestamptz not null default now(),
  width int,
  height int,
  -- Scale. Without a reference object, "the mole grew" is unfalsifiable, because
  -- camera distance changes apparent size. A coin or a printed sticker of known
  -- diameter in frame is what makes millimetre trends real.
  scale_ref text check (scale_ref in ('none', 'coin_1euro', 'coin_2euro', 'sticker_10mm', 'ruler', 'dermoscope')),
  mm_per_px numeric(10, 6),
  lesion_diameter_mm numeric(6, 2),
  -- Automated capture-quality gate: { blur: 0-1, exposure: 0-1, glare: 0-1,
  --   framing: 0-1, hair_occlusion: 0-1, usable: bool, reasons: [] }
  quality jsonb not null default '{}'::jsonb,
  -- EXIF minus GPS. Location is stripped on upload; it is not needed and it is
  -- the most re-identifying field in a photo.
  capture_meta jsonb not null default '{}'::jsonb,
  is_baseline boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_images_lesion_idx on skinscan_images(lesion_id, captured_at desc);

-- ---------------------------------------------------------------------------
-- AI assessments
-- ---------------------------------------------------------------------------

create table if not exists skinscan_assessments (
  id uuid primary key default gen_random_uuid(),
  image_id uuid not null references skinscan_images(id) on delete cascade,
  lesion_id uuid not null references skinscan_lesions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Structured morphology, extracted before any risk judgement is made. Keeping
  -- these separate means a clinician can check the model's reasoning instead of
  -- being handed an opaque score.
  -- { asymmetry, border, colour, diameter_mm, evolution, colours: [],
  --   pattern, ugly_duckling, seven_point_score, notes }
  features jsonb not null default '{}'::jsonb,
  -- One row per model that voted: [{ model, band, confidence, features, ms, error }]
  model_votes jsonb not null default '[]'::jsonb,
  risk_band skinscan_risk_band not null,
  -- Agreement across the ensemble, 0-1. Low agreement is surfaced to the user as
  -- "the models disagree — worth a human look", which is more honest than
  -- averaging the disagreement away.
  agreement numeric(4, 3),
  red_flags text[] not null default '{}',
  -- What the user should DO. Never a diagnosis.
  recommendation text not null,
  rationale text,
  model_set text not null,
  duration_ms int,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_assessments_lesion_idx on skinscan_assessments(lesion_id, created_at desc);

-- Change between two dated images of the same lesion. This is the part that a
-- single-photo app cannot do and the part with the most clinical value:
-- change over time is a stronger melanoma signal than any single snapshot.
create table if not exists skinscan_changes (
  id uuid primary key default gen_random_uuid(),
  lesion_id uuid not null references skinscan_lesions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  baseline_image_id uuid not null references skinscan_images(id) on delete cascade,
  latest_image_id uuid not null references skinscan_images(id) on delete cascade,
  days_between int not null,
  diameter_delta_mm numeric(6, 2),
  area_delta_pct numeric(6, 2),
  new_colours text[] not null default '{}',
  border_change text,
  surface_change text,
  significant boolean not null default false,
  model_votes jsonb not null default '[]'::jsonb,
  summary text,
  comparable boolean not null default true,      -- false when scale/quality make the comparison meaningless
  incomparable_reason text,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_changes_lesion_idx on skinscan_changes(lesion_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Teledermatology cases
-- ---------------------------------------------------------------------------

create table if not exists skinscan_cases (
  id uuid primary key default gen_random_uuid(),
  human_ref text unique not null default 'SS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  user_id uuid not null references auth.users(id) on delete cascade,
  status skinscan_case_status not null default 'draft',
  patient_question text,
  patient_reported_changes text,
  price_cents int not null default 2900,
  currency text not null default 'eur',
  stripe_session_id text,
  stripe_payment_intent text,
  assigned_doctor_id uuid references skinscan_doctors(id),
  assigned_at timestamptz,
  submitted_at timestamptz,
  answered_at timestamptz,
  -- Hard SLA shown to the patient before they pay.
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists skinscan_cases_user_idx on skinscan_cases(user_id, created_at desc);
create index if not exists skinscan_cases_queue_idx on skinscan_cases(status, submitted_at) where status in ('paid', 'assigned', 'in_review');

create table if not exists skinscan_case_lesions (
  case_id uuid not null references skinscan_cases(id) on delete cascade,
  lesion_id uuid not null references skinscan_lesions(id) on delete cascade,
  primary key (case_id, lesion_id)
);

create table if not exists skinscan_reviews (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references skinscan_cases(id) on delete cascade,
  doctor_id uuid not null references skinscan_doctors(id),
  lesion_id uuid references skinscan_lesions(id) on delete set null,
  impression text not null,
  differential text[] not null default '{}',
  urgency skinscan_review_urgency not null,
  recommendation text not null,
  refer_to text,
  image_quality_sufficient boolean not null default true,
  -- An honest reviewer must be able to say "I cannot tell from a photo".
  cannot_assess_reason text,
  notes_to_patient text,
  signed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists skinscan_reviews_case_idx on skinscan_reviews(case_id);

create table if not exists skinscan_case_messages (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references skinscan_cases(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  author_role skinscan_role not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_case_messages_case_idx on skinscan_case_messages(case_id, created_at);

-- ---------------------------------------------------------------------------
-- Reminders, consent history, audit
-- ---------------------------------------------------------------------------

create table if not exists skinscan_reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesion_id uuid references skinscan_lesions(id) on delete cascade,
  kind text not null check (kind in ('rephotograph', 'full_body_check', 'doctor_followup')),
  due_on date not null,
  sent_at timestamptz,
  dismissed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_reminders_due_idx on skinscan_reminders(due_on) where sent_at is null and dismissed_at is null;

create table if not exists skinscan_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  version text not null,
  kind text not null check (kind in ('health_data', 'ai_processing', 'terms', 'research_optin')),
  granted boolean not null,
  ip inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_consents_user_idx on skinscan_consents(user_id, created_at desc);

create table if not exists skinscan_audit (
  id bigserial primary key,
  actor_id uuid references auth.users(id) on delete set null,
  actor_role skinscan_role,
  action text not null,
  subject_user_id uuid,
  case_id uuid,
  lesion_id uuid,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists skinscan_audit_subject_idx on skinscan_audit(subject_user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Helpers (security definer so RLS policies can call them without recursing)
-- ---------------------------------------------------------------------------

create or replace function skinscan_current_role()
returns skinscan_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from skinscan_profiles where id = auth.uid()), 'patient'::skinscan_role);
$$;

create or replace function skinscan_is_verified_doctor()
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from skinscan_doctors where id = auth.uid() and verified_at is not null);
$$;

-- A doctor may read a lesion only while it hangs off a case that is assigned to
-- them and not yet closed. This single predicate is the whole access boundary.
create or replace function skinscan_doctor_may_read_lesion(p_lesion uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from skinscan_case_lesions cl
    join skinscan_cases c on c.id = cl.case_id
    where cl.lesion_id = p_lesion
      and c.assigned_doctor_id = auth.uid()
      and c.status in ('assigned', 'in_review', 'answered')
  );
$$;

create or replace function skinscan_touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_skinscan_lesions_touch on skinscan_lesions;
create trigger trg_skinscan_lesions_touch before update on skinscan_lesions
  for each row execute function skinscan_touch_updated_at();

drop trigger if exists trg_skinscan_cases_touch on skinscan_cases;
create trigger trg_skinscan_cases_touch before update on skinscan_cases
  for each row execute function skinscan_touch_updated_at();

-- Keep the lesion list cheap to render.
create or replace function skinscan_sync_lesion_counters()
returns trigger language plpgsql security definer set search_path = public as $$
declare target uuid;
begin
  target := coalesce(new.lesion_id, old.lesion_id);
  update skinscan_lesions l
     set image_count = (select count(*) from skinscan_images where lesion_id = target),
         last_image_at = (select max(captured_at) from skinscan_images where lesion_id = target)
   where l.id = target;
  return null;
end $$;

drop trigger if exists trg_skinscan_images_counters on skinscan_images;
create trigger trg_skinscan_images_counters after insert or delete on skinscan_images
  for each row execute function skinscan_sync_lesion_counters();

create or replace function skinscan_sync_lesion_risk()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update skinscan_lesions
     set latest_risk_band = new.risk_band,
         next_review_due = current_date + case new.risk_band
           when 'reassuring'      then 180
           when 'monitor'         then 90
           when 'get_checked'     then 14
           when 'see_doctor_soon' then 3
         end
   where id = new.lesion_id;
  return null;
end $$;

drop trigger if exists trg_skinscan_assessment_risk on skinscan_assessments;
create trigger trg_skinscan_assessment_risk after insert on skinscan_assessments
  for each row execute function skinscan_sync_lesion_risk();

-- New auth user -> profile row, so the app never has to handle a missing profile.
create or replace function skinscan_handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into skinscan_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists trg_skinscan_new_user on auth.users;
create trigger trg_skinscan_new_user after insert on auth.users
  for each row execute function skinscan_handle_new_user();

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table skinscan_profiles      enable row level security;
alter table skinscan_doctors       enable row level security;
alter table skinscan_lesions       enable row level security;
alter table skinscan_images        enable row level security;
alter table skinscan_assessments   enable row level security;
alter table skinscan_changes       enable row level security;
alter table skinscan_cases         enable row level security;
alter table skinscan_case_lesions  enable row level security;
alter table skinscan_reviews       enable row level security;
alter table skinscan_case_messages enable row level security;
alter table skinscan_reminders     enable row level security;
alter table skinscan_consents      enable row level security;
alter table skinscan_audit         enable row level security;

drop policy if exists p_profiles_self on skinscan_profiles;
create policy p_profiles_self on skinscan_profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

-- A patient with an assigned case may see that doctor's public profile.
drop policy if exists p_doctors_read on skinscan_doctors;
create policy p_doctors_read on skinscan_doctors
  for select using (
    id = auth.uid()
    or verified_at is not null
  );

drop policy if exists p_doctors_self_write on skinscan_doctors;
create policy p_doctors_self_write on skinscan_doctors
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists p_lesions_owner on skinscan_lesions;
create policy p_lesions_owner on skinscan_lesions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_lesions_doctor_read on skinscan_lesions;
create policy p_lesions_doctor_read on skinscan_lesions
  for select using (skinscan_is_verified_doctor() and skinscan_doctor_may_read_lesion(id));

drop policy if exists p_images_owner on skinscan_images;
create policy p_images_owner on skinscan_images
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_images_doctor_read on skinscan_images;
create policy p_images_doctor_read on skinscan_images
  for select using (skinscan_is_verified_doctor() and skinscan_doctor_may_read_lesion(lesion_id));

drop policy if exists p_assessments_owner on skinscan_assessments;
create policy p_assessments_owner on skinscan_assessments
  for select using (user_id = auth.uid());

drop policy if exists p_assessments_doctor_read on skinscan_assessments;
create policy p_assessments_doctor_read on skinscan_assessments
  for select using (skinscan_is_verified_doctor() and skinscan_doctor_may_read_lesion(lesion_id));

drop policy if exists p_changes_owner on skinscan_changes;
create policy p_changes_owner on skinscan_changes
  for select using (user_id = auth.uid());

drop policy if exists p_changes_doctor_read on skinscan_changes;
create policy p_changes_doctor_read on skinscan_changes
  for select using (skinscan_is_verified_doctor() and skinscan_doctor_may_read_lesion(lesion_id));

drop policy if exists p_cases_owner on skinscan_cases;
create policy p_cases_owner on skinscan_cases
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Verified doctors see the unassigned queue (so they can claim work) and their
-- own assigned cases. They do NOT see the queue rows of other doctors' cases.
drop policy if exists p_cases_doctor on skinscan_cases;
create policy p_cases_doctor on skinscan_cases
  for select using (
    skinscan_is_verified_doctor()
    and (assigned_doctor_id = auth.uid() or (assigned_doctor_id is null and status = 'paid'))
  );

drop policy if exists p_case_lesions_owner on skinscan_case_lesions;
create policy p_case_lesions_owner on skinscan_case_lesions
  for all using (exists (select 1 from skinscan_cases c where c.id = case_id and c.user_id = auth.uid()))
  with check (exists (select 1 from skinscan_cases c where c.id = case_id and c.user_id = auth.uid()));

drop policy if exists p_case_lesions_doctor on skinscan_case_lesions;
create policy p_case_lesions_doctor on skinscan_case_lesions
  for select using (
    skinscan_is_verified_doctor()
    and exists (select 1 from skinscan_cases c where c.id = case_id and c.assigned_doctor_id = auth.uid())
  );

drop policy if exists p_reviews_patient_read on skinscan_reviews;
create policy p_reviews_patient_read on skinscan_reviews
  for select using (exists (select 1 from skinscan_cases c where c.id = case_id and c.user_id = auth.uid()));

drop policy if exists p_reviews_doctor on skinscan_reviews;
create policy p_reviews_doctor on skinscan_reviews
  for all using (doctor_id = auth.uid() and skinscan_is_verified_doctor())
  with check (doctor_id = auth.uid() and skinscan_is_verified_doctor());

drop policy if exists p_case_messages on skinscan_case_messages;
create policy p_case_messages on skinscan_case_messages
  for select using (
    exists (select 1 from skinscan_cases c where c.id = case_id
            and (c.user_id = auth.uid() or c.assigned_doctor_id = auth.uid()))
  );

drop policy if exists p_case_messages_write on skinscan_case_messages;
create policy p_case_messages_write on skinscan_case_messages
  for insert with check (
    author_id = auth.uid()
    and exists (select 1 from skinscan_cases c where c.id = case_id
                and (c.user_id = auth.uid() or c.assigned_doctor_id = auth.uid()))
  );

drop policy if exists p_reminders_owner on skinscan_reminders;
create policy p_reminders_owner on skinscan_reminders
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists p_consents_owner on skinscan_consents;
create policy p_consents_owner on skinscan_consents
  for select using (user_id = auth.uid());

drop policy if exists p_consents_insert on skinscan_consents;
create policy p_consents_insert on skinscan_consents
  for insert with check (user_id = auth.uid());

-- Users may read the log of who looked at their data. Nobody may write it from
-- the client; only the service role (server) inserts.
drop policy if exists p_audit_subject_read on skinscan_audit;
create policy p_audit_subject_read on skinscan_audit
  for select using (subject_user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Private storage bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('skinscan', 'skinscan', false, 15728640, array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Objects are keyed {user_id}/{lesion_id}/{image_id}.jpg, so ownership is the
-- first path segment.
drop policy if exists p_skinscan_obj_owner on storage.objects;
create policy p_skinscan_obj_owner on storage.objects
  for all to authenticated
  using (bucket_id = 'skinscan' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'skinscan' and (storage.foldername(name))[1] = auth.uid()::text);

-- Doctors never get bucket-wide read. The server mints short-lived signed URLs
-- per image after checking skinscan_doctor_may_read_lesion().
