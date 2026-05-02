-- Add sequence column to monthly_themes for chapter ordering
ALTER TABLE public.monthly_themes
  ADD COLUMN IF NOT EXISTS sequence INTEGER;

-- Backfill sequence using release order: published_at first, then created_at
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (
    ORDER BY published_at ASC NULLS LAST, created_at ASC, id ASC
  ) AS rn
  FROM public.monthly_themes
)
UPDATE public.monthly_themes mt
SET sequence = ordered.rn
FROM ordered
WHERE mt.id = ordered.id AND mt.sequence IS NULL;

CREATE INDEX IF NOT EXISTS idx_monthly_themes_sequence ON public.monthly_themes (sequence);