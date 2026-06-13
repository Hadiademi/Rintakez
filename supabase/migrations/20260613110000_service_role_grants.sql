-- Ensure the service_role (used by trusted server-only admin operations) has
-- full access to the public schema, including tables added by earlier
-- migrations, and to any added later. service_role already bypasses RLS; this
-- guarantees the underlying table privileges are present too.

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;

alter default privileges in schema public
  grant all on tables to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
