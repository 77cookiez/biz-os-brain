-- ============================================================
-- Farha Security Audit Queries
-- Run before every production release.
-- ============================================================

-- 🔎 1️⃣ All SECURITY DEFINER functions + signatures
-- Check: no unexpected overloads, owner = postgres, prosecdef only where needed
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_userbyid(p.proowner) AS owner,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
ORDER BY p.proname;

-- 🔎 2️⃣ Overload detection (should return 0 rows)
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
GROUP BY p.proname, pg_get_function_identity_arguments(p.oid), p.oid
HAVING (
  SELECT count(*)
  FROM pg_proc p2
  JOIN pg_namespace n2 ON n2.oid = p2.pronamespace
  WHERE n2.nspname = 'public' AND p2.proname = p.proname
) > 1
ORDER BY p.proname;

-- 🔎 3️⃣ anon/authenticated EXECUTE privileges on SECURITY DEFINER functions
-- Expected: anon_can_execute = false for ALL except:
--   - get_live_booking_tenant_by_slug (public booking pages)
--   - RLS helpers (is_workspace_member, has_company_role, etc.)
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- 🔎 4️⃣ Naming convention check
-- Functions starting with trg_, check_, can_, log_ MUST be SECURITY DEFINER
-- with search_path set and no overloads.
SELECT
  p.proname,
  p.prosecdef AS is_security_definer,
  pg_get_function_identity_arguments(p.oid) AS args,
  array_to_string(p.proconfig, ', ') AS config
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (p.proname LIKE 'trg_%' OR p.proname LIKE 'check_%'
       OR p.proname LIKE 'can_%' OR p.proname LIKE 'log_%')
ORDER BY p.proname;

-- 🔎 5️⃣ Tables with RLS disabled (should return 0 rows for public schema)
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename NOT IN ('schema_migrations')
  AND NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = tablename
      AND c.relrowsecurity = true
  );
