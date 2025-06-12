-- Define ENUM type for verification_status for consistency, if desired, or use TEXT.
-- Using TEXT for flexibility as per plan, but ENUM is an option:
-- CREATE TYPE seller_verification_status AS ENUM ('not_requested', 'pending_review', 'approved', 'rejected', 'needs_more_info');

ALTER TABLE public.profiles
ADD COLUMN is_verified_seller BOOLEAN DEFAULT FALSE NOT NULL,
ADD COLUMN verification_status TEXT DEFAULT 'not_requested' NOT NULL, -- Can be one of 'not_requested', 'pending_review', 'approved', 'rejected', 'needs_more_info'
ADD COLUMN verification_documents JSONB NULL, -- Store URLs or structured data about documents
ADD COLUMN verification_submitted_at TIMESTAMPTZ NULL, -- When the user submitted their request
ADD COLUMN verification_processed_at TIMESTAMPTZ NULL, -- When an admin last processed this request (approved, rejected)
ADD COLUMN verification_admin_notes TEXT NULL; -- Notes from admin, e.g., reason for rejection

COMMENT ON COLUMN public.profiles.is_verified_seller IS 'Indicates if the seller has undergone a verification process and is marked as trusted.';
COMMENT ON COLUMN public.profiles.verification_status IS 'The current status of the seller''s verification application (e.g., not_requested, pending_review, approved, rejected).';
COMMENT ON COLUMN public.profiles.verification_documents IS 'JSONB field to store information about documents submitted for verification (e.g., URLs, types).';
COMMENT ON COLUMN public.profiles.verification_submitted_at IS 'Timestamp of when the seller submitted their verification request.';
COMMENT ON COLUMN public.profiles.verification_processed_at IS 'Timestamp of when an admin last processed (approved/rejected) this verification request.';
COMMENT ON COLUMN public.profiles.verification_admin_notes IS 'Administrative notes regarding the verification process, like reasons for rejection or internal comments.';

-- Note: The plan used `verified_at` which is now `verification_processed_at` for clarity if status is 'approved'.
-- `is_verified_seller` becomes true only when status is 'approved'.

-- Ensure existing RLS policies on `profiles` are appropriate.
-- Users can update their own profile (auth.uid() = id).
-- They should NOT be able to set `is_verified_seller` or `verification_status` directly to 'approved'.
-- This will be handled by admin functions or specific functions for submitting requests.

-- Let's refine the RLS policy for profile updates to prevent self-verification.
-- First, drop the existing policy if it's too permissive for these new columns.
-- The default "Users can update own profile" might be:
-- `CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);`
-- This would allow users to change their own `is_verified_seller` status. We need to prevent that.

-- It's safer to handle updates to sensitive fields like `is_verified_seller` and `verification_status` (when moving to 'approved' or 'rejected')
-- exclusively through SECURITY DEFINER functions called by admins, or by specific user-callable functions that only allow limited transitions
-- (e.g., user can submit documents, changing status from 'not_requested' to 'pending_review').

-- For now, the existing RLS update policy "Users can update own profile" on `profiles`
-- allows users to update their own `full_name`, `avatar_url`, `bio`.
-- The new fields `is_verified_seller`, `verification_status` (to 'approved'/'rejected'), `verification_processed_at`, `verification_admin_notes`
-- should ONLY be updatable by admin-privileged functions.
-- `verification_documents` and `verification_submitted_at` can be updated by the user when they submit a request.
-- `verification_status` can be updated by user from 'not_requested' or 'rejected' to 'pending_review'.

-- Given the complexity RLS adds here, the functions (`request_seller_verification`, `admin_update_seller_verification`)
-- will be crucial for managing these fields securely.
-- No direct RLS changes will be made in this script for `profiles` updates, relying on function design.
-- The existing RLS allows users to update their own profile. The functions will control specific field changes.
