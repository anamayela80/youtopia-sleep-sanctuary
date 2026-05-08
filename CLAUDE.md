# YOUtopia — Project Context for Claude

## What this app is
A mindfulness / sleep meditation app. Users onboard once per month, answer 3 questions, get a personalised morning meditation + evening seeds (affirmations whispered in their own voice as they fall asleep). Built with Lovable (React + Vite + Supabase).

## Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind, Framer Motion, Lucide icons
- **Backend**: Supabase (auth, DB, edge functions)
- **AI**: Anthropic Claude (meditations, seeds, language fixing)
- **Audio**: ElevenLabs TTS + Web Audio API (no `<audio>` elements)
- **Hosting**: Lovable (owns the Supabase project — no direct Supabase CLI access)
- **Repo**: https://github.com/anamayela80/youtopia-sleep-sanctuary

## Key files
| File | Purpose |
|------|---------|
| `src/pages/Home.tsx` | Main dashboard — stats, mood grid, current chapter card, science drawer |
| `src/pages/Auth.tsx` | Login/signup — must redirect to `/` not `/home` so intake check runs |
| `src/pages/Onboarding.tsx` | Monthly onboarding flow (questions → generating → seeds) |
| `src/pages/MyMonth.tsx` | Meditation + seeds player |
| `src/pages/Reflect.tsx` | Daily mood check-in |
| `src/hooks/useSegmentedMixer.ts` | Morning meditation audio engine (Web Audio API) |
| `src/hooks/useSeedsPlayer.ts` | Evening seeds audio engine (45-min session, 4 cycles) |
| `src/components/admin/AdminThemes.tsx` | Admin panel for monthly themes |
| `src/services/intakeService.ts` | getCurrentIntake, isIntakeExpired, getNextThemeForUser |
| `supabase/functions/generate-meditation/` | Edge function — Claude → ElevenLabs → Supabase storage |
| `supabase/functions/generate-seeds/` | Edge function — generates 5 seed affirmations |
| `supabase/functions/fix-theme-language/` | Admin tool — rewrites negative language in all themes |

## Hard rules — never break these
1. **No negative language anywhere** — no "not", "don't", "without", "no longer", "never". State only what IS. The AI prompts enforce this with a guardian pass.
2. **Login must redirect to `/`** (not `/home`) so `Index.tsx` can check intake and route to onboarding if needed.
3. **All protected pages** (Home, Reflect, Settings, MyMonth) have an intake guard: `if (!intake) navigate("/onboarding")`.
4. **Audio uses Web Audio API** only — no `<audio>` elements. MediaSession API must be registered when playback starts so iOS/Android don't kill the AudioContext on screen lock.
5. **Seed loading is sequential** (not parallel) — parallel fetch of 6 audio files crashes iOS Safari.

## DB tables (Supabase)
- `monthly_themes` — month_key, theme, description, intro_orienting/settling/established, about, science, practice, questions (JSONB), guide_voice_id, seed_voice_id, allow_voice_clone
- `user_monthly_intakes` — user_id, theme_id, intake_start_date, answers (JSONB)
- `meditations` — user_id, month, theme_id, meditation_segments (JSONB audio URLs)
- `user_seeds` — user_id, intake_id, phrases (JSONB), audio_url_1..5
- `checkins` — user_id, checkin_date, mood_score (1–5)
- `profiles` — user_id, full_name, voice_id (cloned ElevenLabs voice)
- `user_roles` — user_id, role ("admin")

## Deployment
- Push to GitHub → Lovable auto-deploys frontend
- Edge functions only deploy when Lovable publishes (no CLI access)
- Dev server: `node node_modules/vite/bin/vite.js --port 8080 --host` (Node installed at `C:\Program Files\nodejs\`)

## Pending / known issues
- `fix-theme-language` edge function needs Lovable to publish before it's available
- `voice_switch_used_at TIMESTAMPTZ DEFAULT NULL` column needs adding to profiles table via Lovable prompt
