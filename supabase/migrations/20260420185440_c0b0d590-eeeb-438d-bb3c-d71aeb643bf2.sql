ALTER TABLE public.monthly_themes
  ADD COLUMN IF NOT EXISTS seed_voice_id text,
  ADD COLUMN IF NOT EXISTS allow_voice_clone boolean NOT NULL DEFAULT true;