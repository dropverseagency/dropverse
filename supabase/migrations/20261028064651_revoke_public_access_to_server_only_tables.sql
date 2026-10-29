
-- These tables are written/read through trusted server-side service-role code.
-- No direct anon/authenticated policies exist, so remove their direct SQL/API grants too.
REVOKE ALL PRIVILEGES ON TABLE
  public.academy_waitlist,
  public.funnel_events,
  public.ops_alert_dedupe,
  public.page_views,
  public.project_client_tokens,
  public.site_presence,
  ossol_memory.buyer_conversation_messages,
  ossol_memory.buyer_conversations,
  ossol_memory.buyer_recommendation_reactions,
  ossol_memory.buyer_recommendation_snapshots
FROM PUBLIC, anon, authenticated;
