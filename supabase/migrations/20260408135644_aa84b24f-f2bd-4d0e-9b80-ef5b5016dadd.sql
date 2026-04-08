
-- 1. Update monthly_themes table with new columns
ALTER TABLE public.monthly_themes
  ADD COLUMN IF NOT EXISTS intention text,
  ADD COLUMN IF NOT EXISTS guide_voice_id text DEFAULT '9BDgg2Q7WSrW0x8naPLw',
  ADD COLUMN IF NOT EXISTS music_file_url text,
  ADD COLUMN IF NOT EXISTS questions jsonb DEFAULT '["How do you want to feel every day this month?", "What does your life look and feel like 90 days from now?", "What is one thing you are ready to release this month?"]'::jsonb,
  ADD COLUMN IF NOT EXISTS checkin_question text,
  ADD COLUMN IF NOT EXISTS checkin_count integer DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT false;

-- 2. Create user_voice_clones table
CREATE TABLE public.user_voice_clones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  elevenlabs_voice_id text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.user_voice_clones ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX idx_user_voice_clones_user_id ON public.user_voice_clones (user_id);

CREATE POLICY "Users can view own voice clone" ON public.user_voice_clones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own voice clone" ON public.user_voice_clones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own voice clone" ON public.user_voice_clones FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own voice clone" ON public.user_voice_clones FOR DELETE USING (auth.uid() = user_id);

-- 3. Create seeds table
CREATE TABLE public.seeds (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month text NOT NULL,
  theme_id uuid REFERENCES public.monthly_themes(id),
  phrase_1 text NOT NULL,
  phrase_2 text NOT NULL,
  phrase_3 text NOT NULL,
  phrase_4 text NOT NULL,
  phrase_5 text NOT NULL,
  audio_url_1 text,
  audio_url_2 text,
  audio_url_3 text,
  audio_url_4 text,
  audio_url_5 text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.seeds ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own seeds" ON public.seeds FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own seeds" ON public.seeds FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own seeds" ON public.seeds FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own seeds" ON public.seeds FOR DELETE USING (auth.uid() = user_id);

-- 4. Create meditation_segments table
CREATE TABLE public.meditation_segments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meditation_id uuid NOT NULL REFERENCES public.meditations(id) ON DELETE CASCADE,
  segment_number integer NOT NULL CHECK (segment_number BETWEEN 1 AND 4),
  audio_url text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (meditation_id, segment_number)
);

ALTER TABLE public.meditation_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meditation segments" ON public.meditation_segments FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.meditations WHERE meditations.id = meditation_segments.meditation_id AND meditations.user_id = auth.uid()));
CREATE POLICY "Users can insert own meditation segments" ON public.meditation_segments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.meditations WHERE meditations.id = meditation_segments.meditation_id AND meditations.user_id = auth.uid()));

-- 5. Create checkin_responses table
CREATE TABLE public.checkin_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  month text NOT NULL,
  question text NOT NULL,
  answer text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.checkin_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkin responses" ON public.checkin_responses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkin responses" ON public.checkin_responses FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 6. Update profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS morning_reminder_time time DEFAULT '07:00',
  ADD COLUMN IF NOT EXISTS night_reminder_time time DEFAULT '22:00';

-- 7. Update meditations table - add theme_id
ALTER TABLE public.meditations
  ADD COLUMN IF NOT EXISTS theme_id uuid REFERENCES public.monthly_themes(id);
