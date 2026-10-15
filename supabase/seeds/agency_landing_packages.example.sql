-- Example seed for TEST projects only.
-- Run after 20261015010000_agency_landing_pages.sql.
-- Replace service UUIDs with real rows from public.services.

-- SELECT id, title FROM public.services WHERE active = true;

-- INSERT INTO public.service_packages (service_id, name, description, retail_price, currency, sort_order, active)
-- VALUES
--   ('00000000-0000-0000-0000-000000000001', 'Starter', 'Entry package', 99, 'USD', 1, true),
--   ('00000000-0000-0000-0000-000000000001', 'Pro', 'Full package', 249, 'USD', 2, true);

-- Set a test org plan:
-- UPDATE public.organizations SET plan = 'AGENCY' WHERE id = '...';
