ALTER TABLE public.samples
  ADD COLUMN IF NOT EXISTS commission_rate numeric(5,2);

ALTER TABLE public.samples
  DROP CONSTRAINT IF EXISTS samples_commission_rate_check;

ALTER TABLE public.samples
  ADD CONSTRAINT samples_commission_rate_check
  CHECK (commission_rate IS NULL OR (commission_rate >= 0 AND commission_rate <= 100));

CREATE OR REPLACE VIEW public.samples_public
WITH (security_invoker = true)
AS
 SELECT s.id,
    s.title,
    s.slug,
    s.category,
    s.description,
    s.price_usd,
    s.turnaround_days,
    s.cover_path,
    s.created_at,
    fp.display_name AS freelancer_display_name,
    fp.category AS freelancer_category
   FROM public.samples s
     LEFT JOIN public.freelancer_profiles fp ON fp.user_id = s.owner_id
  WHERE s.status = 'approved'::text;
