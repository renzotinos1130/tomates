-- =============================================================================
-- Team Tomate HQ — a third role: super administrator
--
-- The value is added in a migration of its own: Postgres does not let a new
-- enum value be used in the transaction that adds it. What the role means is in
-- the next migration.
-- =============================================================================

alter type public.member_role add value if not exists 'super_admin' before 'admin';
