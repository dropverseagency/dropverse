-- Agency branded landing pages (paid-plan feature).
-- Additive only. Does not alter existing order status machine.
-- DO NOT apply to production without explicit authorization.
-- Test on a Supabase branch/backup first.
--
-- ROLLBACK:
-- DROP TABLE IF EXISTS public.agency_order_attributions;
-- DROP TABLE IF EXISTS public.agency_landing_page_services;
-- DROP TABLE IF EXISTS public.agency_landing_pages;
-- DROP TABLE IF EXISTS public.service_packages;
--
-- ASSUMPTIONS REQUIRING TEST:
-- * public.organizations(id) exists
-- * public.projects(id) exists
-- * public.services(id) exists
-- * public.organization_members has organization_id, user_id, role, status
-- * public.profiles.role includes 'admin'

BEGIN;

CREATE TABLE IF NOT EXISTS public.service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  retail_price numeric NOT NULL CHECK (retail_price > 0),
  currency text NOT NULL DEFAULT 'USD',
  sort_order int NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_service_packages_service
  ON public.service_packages(service_id) WHERE active = true;

CREATE TABLE IF NOT EXISTS public.agency_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  headline text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  logo_url text,
  primary_color text NOT NULL DEFAULT '#e2b656',
  published boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_landing_pages_slug_format CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  CONSTRAINT agency_landing_pages_slug_len CHECK (char_length(slug) BETWEEN 3 AND 48),
  CONSTRAINT agency_landing_pages_color_hex CHECK (primary_color ~ '^#[0-9A-Fa-f]{6}$'),
  CONSTRAINT agency_landing_pages_org_unique UNIQUE (organization_id),
  CONSTRAINT agency_landing_pages_slug_unique UNIQUE (slug)
);

CREATE INDEX IF NOT EXISTS idx_agency_landing_published
  ON public.agency_landing_pages(published) WHERE published = true;

CREATE TABLE IF NOT EXISTS public.agency_landing_page_services (
  page_id uuid NOT NULL REFERENCES public.agency_landing_pages(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  sort_order int NOT NULL DEFAULT 0,
  PRIMARY KEY (page_id, service_id)
);

CREATE TABLE IF NOT EXISTS public.agency_order_attributions (
  project_id uuid PRIMARY KEY REFERENCES public.projects(id) ON DELETE CASCADE,
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  landing_page_id uuid NOT NULL REFERENCES public.agency_landing_pages(id) ON DELETE RESTRICT,
  package_id uuid REFERENCES public.service_packages(id) ON DELETE SET NULL,
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  retail_price numeric NOT NULL CHECK (retail_price > 0),
  currency text NOT NULL DEFAULT 'USD',
  customer_name text,
  customer_email text,
  idempotency_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agency_order_idempotency UNIQUE (landing_page_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_agency_attr_org ON public.agency_order_attributions(organization_id);
CREATE INDEX IF NOT EXISTS idx_agency_attr_page ON public.agency_order_attributions(landing_page_id);

ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_landing_page_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_order_attributions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public active packages" ON public.service_packages;
CREATE POLICY "public active packages" ON public.service_packages
  FOR SELECT USING (active = true);

DROP POLICY IF EXISTS "public published landing pages" ON public.agency_landing_pages;
CREATE POLICY "public published landing pages" ON public.agency_landing_pages
  FOR SELECT USING (published = true);

DROP POLICY IF EXISTS "public published page services" ON public.agency_landing_page_services;
CREATE POLICY "public published page services" ON public.agency_landing_page_services
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.agency_landing_pages p
      WHERE p.id = page_id AND p.published = true
    )
  );

DROP POLICY IF EXISTS "org members read landing page" ON public.agency_landing_pages;
CREATE POLICY "org members read landing page" ON public.agency_landing_pages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = agency_landing_pages.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "org managers write landing page" ON public.agency_landing_pages;
CREATE POLICY "org managers write landing page" ON public.agency_landing_pages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = agency_landing_pages.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = agency_landing_pages.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "org managers page services" ON public.agency_landing_page_services;
CREATE POLICY "org managers page services" ON public.agency_landing_page_services
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.agency_landing_pages p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = agency_landing_page_services.page_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('OWNER', 'ADMIN')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.agency_landing_pages p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = agency_landing_page_services.page_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
        AND m.role IN ('OWNER', 'ADMIN')
    )
  );

DROP POLICY IF EXISTS "org members read attributions" ON public.agency_order_attributions;
CREATE POLICY "org members read attributions" ON public.agency_order_attributions
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.organization_members m
      WHERE m.organization_id = agency_order_attributions.organization_id
        AND m.user_id = auth.uid()
        AND m.status = 'active'
    )
  );

DROP POLICY IF EXISTS "admins manage packages" ON public.service_packages;
CREATE POLICY "admins manage packages" ON public.service_packages
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

DROP POLICY IF EXISTS "admins manage landing pages" ON public.agency_landing_pages;
CREATE POLICY "admins manage landing pages" ON public.agency_landing_pages
  FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  ) WITH CHECK (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
  );

COMMIT;
