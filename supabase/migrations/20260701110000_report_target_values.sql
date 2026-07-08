-- Report depth (1/2): widen report_target to cover reviews and messages, not
-- just profiles/shoots. Postgres forbids using a freshly added enum value in
-- the same transaction it was added in some versions, so these ADD VALUEs get
-- their own migration file; anything that references 'review'/'message'
-- (columns, checks, functions) lives in the NEXT migration.

alter type public.report_target add value if not exists 'review';
alter type public.report_target add value if not exists 'message';
