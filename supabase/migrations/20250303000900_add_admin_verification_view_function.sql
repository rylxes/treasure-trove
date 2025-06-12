-- Function for admins to get profiles pending verification
CREATE OR REPLACE FUNCTION public.admin_get_pending_verifications()
RETURNS TABLE (
    user_id uuid,
    username text,
    verification_status text,
    verification_documents jsonb,
    verification_submitted_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER -- IMPORTANT: Only admins should call this.
-- Restrict access at API gateway or by revoking EXECUTE from non-admin roles.
AS $$
BEGIN
    -- It's good practice to ensure that the calling user has an admin role.
    -- This can be done by checking a custom claim in auth.jwt() or a 'role' column in a 'user_roles' or 'profiles' table.
    -- Example check (assuming a 'role' column in 'profiles' table):
    -- IF NOT EXISTS (
    //       SELECT 1 FROM public.profiles
    //       WHERE id = auth.uid() AND role IN ('admin', 'super_admin') -- Adjust role names as needed
    //   ) THEN
    //       RAISE EXCEPTION 'User does not have sufficient privileges.';
    //   END IF;
    -- For simplicity in this example, direct role check within SQL is omitted,
    -- relying on Supabase PostgREST call being from an admin-privileged user or service_role,
    -- or proper RLS on who can call this function (e.g. via a view or another function).

    RETURN QUERY
    SELECT
        p.id AS user_id,
        p.username,
        p.verification_status,
        p.verification_documents,
        p.verification_submitted_at
    FROM
        public.profiles p
    WHERE
        p.verification_status = 'pending_review'
    ORDER BY
        p.verification_submitted_at ASC;
END;
$$;

COMMENT ON FUNCTION public.admin_get_pending_verifications() IS 'Admin function to retrieve a list of user profiles that are pending seller verification.';

-- To properly secure this function, ensure that only admin roles can execute it.
-- Supabase by default does not expose RPC functions to 'anon' or 'authenticated' roles unless explicitly granted.
-- If you have a specific admin role, grant execute to it:
-- Example: GRANT EXECUTE ON FUNCTION public.admin_get_pending_verifications() TO your_admin_role;
-- And ensure it's revoked from others if necessary:
-- Example: REVOKE EXECUTE ON FUNCTION public.admin_get_pending_verifications() FROM authenticated;
-- The SECURITY DEFINER context means it runs with owner privileges, bypassing RLS on `profiles` for the SELECT.
-- The caller's permission to EXECUTE the function is the primary security gate.
