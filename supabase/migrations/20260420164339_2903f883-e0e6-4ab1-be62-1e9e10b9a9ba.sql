-- 1. user_monthly_intakes table
CREATE TABLE public.user_monthly_intakes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  theme_id UUID NOT NULL REFERENCES public.monthly_themes(id) ON DELETE CASCADE,
  intake_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  intake_end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days'),
  answers JSONB NOT NULL DEFAULT '[]'::jsonb,
  meditation_id UUID REFERENCES public.meditations(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, theme_id)
);

CREATE INDEX idx_user_monthly_intakes_user ON public.user_monthly_intakes(user_id, intake_end_date DESC);

ALTER TABLE public.user_monthly_intakes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intakes"
  ON public.user_monthly_intakes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own intakes"
  ON public.user_monthly_intakes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own intakes"
  ON public.user_monthly_intakes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all intakes"
  ON public.user_monthly_intakes FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. published_at on monthly_themes (release ordering)
ALTER TABLE public.monthly_themes
  ADD COLUMN published_at TIMESTAMP WITH TIME ZONE;

-- Backfill: any currently active or published theme gets a published_at = created_at
UPDATE public.monthly_themes
SET published_at = created_at
WHERE is_active = true OR status = 'published';

CREATE INDEX idx_monthly_themes_published_at ON public.monthly_themes(published_at);

-- 3. current_intake_id on profiles for quick lookup
ALTER TABLE public.profiles
  ADD COLUMN current_intake_id UUID REFERENCES public.user_monthly_intakes(id) ON DELETE SET NULL;