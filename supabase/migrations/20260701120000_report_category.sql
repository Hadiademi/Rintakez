-- Report depth (2/2): a category alongside the free-text reason, so
-- moderation can triage without reading every report body. Split from the
-- previous migration because it's the first use of the 'review'/'message'
-- report_target values added there (safe once committed in a prior tx).

create type public.report_category as enum (
  'spam',
  'harassment',
  'scam',
  'inappropriate_content',
  'other'
);

-- Default keeps existing rows valid; new reports should set this explicitly.
alter table public.reports
  add column category public.report_category not null default 'other';

-- No RLS change needed: "reports_insert_own" only checks reporter_id, so it
-- already permits any report_target value (including the new 'review' and
-- 'message' targets added in the prior migration).
