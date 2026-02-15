
-- Fix cleanup_restore_tokens: LIMIT not allowed in CTE DELETE in PG
CREATE OR REPLACE FUNCTION cleanup_restore_tokens(_older_than_minutes int DEFAULT 30, _batch int DEFAULT 500)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE _deleted int;
BEGIN
  DELETE FROM restore_confirmation_tokens
  WHERE id IN (
    SELECT id FROM restore_confirmation_tokens
    WHERE expires_at < now() - (_older_than_minutes * interval '1 minute')
    LIMIT _batch
  );
  GET DIAGNOSTICS _deleted = ROW_COUNT;
  RETURN _deleted;
END;
$$;
