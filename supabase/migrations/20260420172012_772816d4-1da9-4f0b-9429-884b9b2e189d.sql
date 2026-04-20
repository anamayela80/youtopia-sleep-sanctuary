ALTER TABLE public.monthly_themes 
ADD COLUMN IF NOT EXISTS about text,
ADD COLUMN IF NOT EXISTS science text,
ADD COLUMN IF NOT EXISTS practice text;