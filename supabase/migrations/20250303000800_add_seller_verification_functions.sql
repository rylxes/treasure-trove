-- Function for a user to request seller verification
CREATE OR REPLACE FUNCTION public.request_seller_verification(
    p_documents_info JSONB DEFAULT NULL -- Optional: documents might be handled by a separate upload step first
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER -- Runs as the calling user
AS $$
DECLARE
    current_user_id uuid := auth.uid();
    current_profile_status TEXT;
BEGIN
    -- Check current verification status
    SELECT verification_status INTO current_profile_status FROM public.profiles WHERE id = current_user_id;

    IF current_profile_status = 'pending_review' THEN
        RAISE EXCEPTION 'Your verification request is already pending review.';
    END IF;

    IF current_profile_status = 'approved' THEN
        RAISE EXCEPTION 'You are already a verified seller.';
    END IF;

    -- User must be a seller to request verification (optional check, or can be part of admin review)
    -- IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = current_user_id AND is_seller = TRUE) THEN
    --     RAISE EXCEPTION 'You must be registered as a seller to request verification.';
    -- END IF;

    UPDATE public.profiles
    SET
        verification_documents = p_documents_info,
        verification_status = 'pending_review',
        verification_submitted_at = NOW(),
        verification_processed_at = NULL, -- Clear previous processing date if re-applying
        verification_admin_notes = NULL, -- Clear previous admin notes if re-applying
        is_verified_seller = FALSE -- Ensure it's false while pending
    WHERE id = current_user_id;
END;
$$;

COMMENT ON FUNCTION public.request_seller_verification(JSONB) IS 'Allows a seller to submit a request for verification. Sets status to pending_review and records submission time and documents info.';


-- Admin function to update a user''s seller verification status
CREATE OR REPLACE FUNCTION public.admin_update_seller_verification(
    p_user_id UUID,
    p_new_status TEXT, -- e.g., 'approved', 'rejected', 'needs_more_info'
    p_is_verified BOOLEAN, -- Should align with p_new_status ('approved' -> true)
    p_admin_notes TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- IMPORTANT: This function performs privileged operations
-- It should be callable only by users with administrative roles.
-- Access to this function via Supabase API should be restricted by table permissions on a helper table,
-- or by using a dedicated admin role in PostgREST settings for RPC calls, or by calling it from an Edge Function with service_role.
AS $$
BEGIN
    -- Basic validation for status and is_verified alignment
    IF p_new_status = 'approved' AND p_is_verified IS FALSE THEN
        RAISE EXCEPTION 'If status is "approved", p_is_verified must be true.';
    END IF;
    IF p_new_status != 'approved' AND p_is_verified IS TRUE THEN
        RAISE EXCEPTION 'p_is_verified can only be true if status is "approved".';
    END IF;

    UPDATE public.profiles
    SET
        verification_status = p_new_status,
        is_verified_seller = p_is_verified,
        verification_admin_notes = p_admin_notes,
        verification_processed_at = NOW()
    WHERE id = p_user_id;

    -- Optional: Send notification to the user about their verification status change
    -- PERFORM public.create_notification(p_user_id, 'Verification Status Update', 'Your seller verification status has been updated to: ' || p_new_status || '. Notes: ' || COALESCE(p_admin_notes, 'N/A'));

END;
$$;

COMMENT ON FUNCTION public.admin_update_seller_verification(UUID, TEXT, BOOLEAN, TEXT) IS 'Admin function to approve, reject, or modify a seller''s verification status. Updates relevant profile fields and records processing time and admin notes.';

-- Example of how to restrict access to admin_update_seller_verification if not using PostgREST role switching:
-- 1. Create an admin role if not exists: CREATE ROLE service_admin NOLOGIN; GRANT service_admin TO authenticator; (Done by Supabase usually for service_role)
-- 2. Grant execute on function to that role: GRANT EXECUTE ON FUNCTION public.admin_update_seller_verification TO service_admin; (or your specific admin role)
-- 3. Ensure regular users (e.g., 'authenticated' role) DO NOT have execute permission. REVOKE EXECUTE ON FUNCTION public.admin_update_seller_verification FROM authenticated;
-- Supabase handles this by default: RPC functions are not publicly exposed unless the 'public' schema is exposed and the 'authenticated' role has USAGE on the schema and EXECUTE on the function.
-- For SECURITY DEFINER, the function runs with owner's privileges (usually `postgres` or `supabase_admin`), bypassing RLS for the tables it modifies.
-- The crucial part is restricting WHO can call this function. This is often done at the API gateway level or by ensuring client-side calls are made by users with a specific admin JWT claim.
