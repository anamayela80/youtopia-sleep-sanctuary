-- 1. Extend monthly_themes
ALTER TABLE public.monthly_themes
  ADD COLUMN IF NOT EXISTS month_key TEXT,
  ADD COLUMN IF NOT EXISTS morning_music_url TEXT,
  ADD COLUMN IF NOT EXISTS evening_music_url TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS voice_id TEXT,
  ADD COLUMN IF NOT EXISTS voice_model TEXT,
  ADD COLUMN IF NOT EXISTS voice_stability NUMERIC,
  ADD COLUMN IF NOT EXISTS voice_style NUMERIC,
  ADD COLUMN IF NOT EXISTS checkin_question_2 TEXT;

-- Status check
ALTER TABLE public.monthly_themes
  DROP CONSTRAINT IF EXISTS monthly_themes_status_check;
ALTER TABLE public.monthly_themes
  ADD CONSTRAINT monthly_themes_status_check CHECK (status IN ('draft','published'));

-- Unique month_key
CREATE UNIQUE INDEX IF NOT EXISTS monthly_themes_month_key_unique
  ON public.monthly_themes (month_key)
  WHERE month_key IS NOT NULL;

-- Seed the 12 months (only if missing)
INSERT INTO public.monthly_themes (month_key, month, theme, status)
SELECT m.key, m.name, '' , 'draft'
FROM (VALUES
  ('jan','January'),('feb','February'),('mar','March'),('apr','April'),
  ('may','May'),('jun','June'),('jul','July'),('aug','August'),
  ('sep','September'),('oct','October'),('nov','November'),('dec','December')
) AS m(key, name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.monthly_themes t WHERE t.month_key = m.key
);

-- 2. app_settings singleton
CREATE TABLE IF NOT EXISTS public.app_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  onboarding_question_1 TEXT NOT NULL DEFAULT 'How do you want to feel every day this month?',
  onboarding_question_2 TEXT NOT NULL DEFAULT 'What would a transformed version of you look like in 30 days?',
  onboarding_question_3 TEXT NOT NULL DEFAULT 'What is one thing you are ready to release this month?',
  default_voice_id TEXT NOT NULL DEFAULT 'zA6D7RyKdc2EClouEMkP',
  default_voice_model TEXT NOT NULL DEFAULT 'eleven_multilingual_v3',
  default_voice_stability NUMERIC NOT NULL DEFAULT 0.5,
  default_voice_style NUMERIC NOT NULL DEFAULT 0.5,
  checkin_question_1 TEXT NOT NULL DEFAULT 'What made you feel most alive this week?',
  checkin_question_2 TEXT NOT NULL DEFAULT 'What is shifting inside you right now?',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.app_settings (singleton)
SELECT true
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view app settings" ON public.app_settings;
CREATE POLICY "Anyone can view app settings"
  ON public.app_settings FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admins can manage app settings" ON public.app_settings;
CREATE POLICY "Admins can manage app settings"
  ON public.app_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS app_settings_updated_at ON public.app_settings;
CREATE TRIGGER app_settings_updated_at
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();