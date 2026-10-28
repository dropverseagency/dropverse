-- Keep freelancer profile categories in sync with the current onboarding choices.
-- Additive: widens the accepted category set without changing existing profile rows.

ALTER TABLE public.freelancer_profiles
  DROP CONSTRAINT IF EXISTS freelancer_profiles_category_check;

ALTER TABLE public.freelancer_profiles
  ADD CONSTRAINT freelancer_profiles_category_check
  CHECK (category = ANY (ARRAY[
    'Video Editing',
    'Short-Form Video Editing',
    'Long-Form Video Editing',
    'UGC Content',
    'Motion Graphics',
    '2D Animation',
    '3D Animation',
    'Graphic Design',
    'Branding',
    'Logo Design',
    'UI/UX Design',
    'Web Design',
    'Web Development',
    'WordPress Development',
    'Shopify Development',
    'Mobile App Development',
    'Software Development',
    'AI Automation',
    'Chatbot Development',
    'No-Code Development',
    'Social Media Content',
    'Social Media Management',
    'Content Creation',
    'Copywriting',
    'Content Writing',
    'SEO',
    'Paid Ads (Meta/Google)',
    'Email Marketing',
    'Lead Generation',
    'Sales & Appointment Setting',
    'Cold Calling',
    'Appointment Setting',
    'Sales Development (SDR)',
    'Lead Qualification',
    'Outbound Sales',
    'Sales Closing',
    'High-Ticket Closing',
    'Telemarketing',
    'Virtual Assistance',
    'Data Entry',
    'Data Analysis',
    'Translation',
    'Transcription',
    'Voice Over',
    'Podcast Editing',
    'Photo Editing',
    'Product Photography',
    'Presentation Design',
    'Other'
  ]::text[]));
