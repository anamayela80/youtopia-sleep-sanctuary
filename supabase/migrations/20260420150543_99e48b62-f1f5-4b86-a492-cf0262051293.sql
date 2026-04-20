-- Add personalization fields to meditations
ALTER TABLE public.meditations
  ADD COLUMN IF NOT EXISTS meditation_name TEXT,
  ADD COLUMN IF NOT EXISTS message_for_you TEXT,
  ADD COLUMN IF NOT EXISTS meditation_artwork_url TEXT;

-- Add tenure-based intro copy to monthly_themes
ALTER TABLE public.monthly_themes
  ADD COLUMN IF NOT EXISTS intro_orienting TEXT,
  ADD COLUMN IF NOT EXISTS intro_settling TEXT,
  ADD COLUMN IF NOT EXISTS intro_established TEXT;

-- Add membership start date to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS membership_start_date DATE NOT NULL DEFAULT CURRENT_DATE;

-- Update handle_new_user to set membership_start_date
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, membership_start_date)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', CURRENT_DATE);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;