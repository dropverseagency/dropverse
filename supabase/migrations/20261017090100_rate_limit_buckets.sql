-- Shared rate-limit buckets for serverless (service role only).
-- Safe if not applied: app falls back to Upstash or in-memory with a warning.

CREATE TABLE IF NOT EXISTS public.rate_limit_buckets (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_buckets_updated
  ON public.rate_limit_buckets (updated_at);

ALTER TABLE public.rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.cleanup_rate_limit_buckets(max_age interval DEFAULT interval '2 hours')
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted integer;
BEGIN
  DELETE FROM public.rate_limit_buckets WHERE updated_at < now() - max_age;
  GET DIAGNOSTICS deleted = ROW_COUNT;
  RETURN deleted;
END;
$$;

-- Rollback:
-- DROP FUNCTION IF EXISTS public.cleanup_rate_limit_buckets(interval);
-- DROP TABLE IF EXISTS public.rate_limit_buckets;
