-- PostgreSQL 17 added the MAINTAIN table privilege. It is not required by
-- browser/API roles and is not governed by RLS, so revoke it alongside other
-- non-CRUD capabilities.
REVOKE MAINTAIN ON ALL TABLES IN SCHEMA public
  FROM PUBLIC, anon, authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE MAINTAIN ON TABLES FROM PUBLIC, anon, authenticated;
