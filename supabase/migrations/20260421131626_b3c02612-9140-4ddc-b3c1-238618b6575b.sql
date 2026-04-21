
-- Daily mood check-ins (one per user per calendar day)
CREATE TABLE public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chapter_id UUID,
  mood_score INTEGER NOT NULL CHECK (mood_score BETWEEN 1 AND 5),
  mood_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  checkin_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  UNIQUE (user_id, checkin_date)
);

ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkins" ON public.checkins
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkins" ON public.checkins
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkins" ON public.checkins
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_checkins_user_date ON public.checkins(user_id, checkin_date DESC);

-- Journal entries (accumulate over time, never auto-deleted)
CREATE TABLE public.journal_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  chapter_id UUID,
  chapter_theme TEXT,
  entry_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own journal" ON public.journal_entries
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own journal" ON public.journal_entries
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own journal" ON public.journal_entries
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_journal_user_created ON public.journal_entries(user_id, created_at DESC);

-- Track which mid-month check-ins have been triggered/dismissed per intake
CREATE TABLE public.intake_checkin_state (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  intake_id UUID NOT NULL,
  question_number INTEGER NOT NULL CHECK (question_number IN (1, 2)),
  answered_at TIMESTAMP WITH TIME ZONE,
  dismissed_permanently BOOLEAN NOT NULL DEFAULT false,
  postponed_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, intake_id, question_number)
);

ALTER TABLE public.intake_checkin_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own checkin state" ON public.intake_checkin_state
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own checkin state" ON public.intake_checkin_state
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own checkin state" ON public.intake_checkin_state
  FOR UPDATE USING (auth.uid() = user_id);

-- Add columns to existing checkin_responses for richer mid-month context
ALTER TABLE public.checkin_responses
  ADD COLUMN IF NOT EXISTS chapter_id UUID,
  ADD COLUMN IF NOT EXISTS question_number INTEGER,
  ADD COLUMN IF NOT EXISTS mood_context NUMERIC;
