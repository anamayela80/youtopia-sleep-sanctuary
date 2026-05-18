# YOUtopia — Project Context for Claude

## What this app is
A daily morning-to-night ritual app. The two halves work as one complete cycle:
- **Morning meditation** — a personalised, voiced session that sets the day's intention. Length and depth scale with the user's tenure (orienting / settling / established).
- **Evening seeds** — 5 short affirmations whispered in the user's own cloned voice as they fall asleep, repeating across a 45-minute session to plant beliefs subconsciously during sleep onset.

Both are generated from the user's own answers to 3 onboarding questions at the start of each monthly chapter. The morning is conscious intention; the evening is subconscious reinforcement. Together they form one complete cycle.

Built with Lovable (React + Vite + Supabase).

## Philosophy
- A daily ritual, not a productivity tool — it asks nothing except to show up
- Works on you while you sleep — seeds planted at night, subconsciously, in your own voice
- Deeply personal — every meditation and every affirmation is built from your own answers
- Slow by design — one intention per month, not a daily challenge or streak game
- A mirror — reflects back who you already are and want to become
- Rooted in science (neuroscience, psychology, sleep research) but delivered like poetry
- Positive language only — names what IS, never what isn't
- NOT a traditional meditation app, NOT generic, NOT loud, NOT a quick fix
- The philosophy: the life you want already exists inside you — the app creates conditions to remember it

## Stack
- **Frontend**: React 18, TypeScript, Vite, Tailwind, Framer Motion, Lucide icons
- **Backend**: Supabase (auth, DB, edge functions)
- **AI**: Anthropic Claude (meditations, seeds, language fixing)
- **Audio**: ElevenLabs TTS + Web Audio API (no audio elements)
- **Hosting**: Lovable (owns the Supabase project — no direct Supabase CLI access)
- **Repo**: https://github.com/anamayela80/youtopia-sleep-sanctuary

## Key files
| File | Purpose |
|------|---------|
| `src/pages/Home.tsx` | Main dashboard — stats, mood grid, current chapter card, science drawer |
| `src/pages/Auth.tsx` | Login/signup — must redirect to `/` not `/home` so intake check runs |
| `src/pages/Onboarding.tsx` | Monthly onboarding flow (questions -> generating -> seeds) |
| `src/pages/MyMonth.tsx` | Meditation + seeds player |
| `src/pages/Reflect.tsx` | Daily mood check-in |
| `src/hooks/useSegmentedMixer.ts` | Morning meditation audio engine (Web Audio API) |
| `src/hooks/useSeedsPlayer.ts` | Evening seeds audio engine (45-min session, 4 cycles) |
| `src/components/admin/AdminThemes.tsx` | Admin panel for monthly themes |
| `src/services/intakeService.ts` | getCurrentIntake, isIntakeExpired, getNextThemeForUser |
| `supabase/functions/generate-meditation/` | Edge function — Claude -> ElevenLabs -> Supabase storage |
| `supabase/functions/generate-seeds/` | Edge function — generates 5 seed affirmations |
| `supabase/functions/fix-theme-language/` | Admin tool — rewrites negative language in all themes |

## Hard rules — never break these
1. **No negative language anywhere** — no "not", "don't", "without", "no longer", "never". State only what IS.
2. **Login must redirect to `/`** (not `/home`) so Index.tsx can check intake and route to onboarding if needed.
3. **All protected pages** (Home, Reflect, Settings, MyMonth) have an intake guard: if no intake -> navigate to /onboarding.
4. **Audio uses Web Audio API only** — MediaSession API must be registered when playback starts so iOS/Android don't kill the AudioContext on screen lock.
5. **Seed loading is sequential** (not parallel) — parallel fetch of 6 audio files crashes iOS Safari.

## DB tables (Supabase)
- `monthly_themes` — month_key, theme, description, intro_orienting/settling/established, about, science, practice, questions (JSONB), guide_voice_id, seed_voice_id, allow_voice_clone
- `user_monthly_intakes` — user_id, theme_id, intake_start_date, answers (JSONB)
- `meditations` — user_id, month, theme_id, meditation_segments (JSONB audio URLs)
- `user_seeds` — user_id, intake_id, phrases (JSONB), audio_url_1..5
- `checkins` — user_id, checkin_date, mood_score (1-5)
- `profiles` — user_id, full_name, voice_id (cloned ElevenLabs voice)
- `user_roles` — user_id, role ("admin")

## Deployment
- Push to GitHub -> Lovable auto-deploys frontend
- Edge functions only deploy when Lovable publishes (no CLI access)
- Dev server: `node node_modules/vite/bin/vite.js --port 8080 --host` (Node at C:\Program Files\nodejs\)

## Pending / known issues
- `fix-theme-language` edge function needs Lovable to publish before it works
- `voice_switch_used_at TIMESTAMPTZ DEFAULT NULL` column needs adding to profiles table via Lovable prompt

## Reflect page — mood + journal
The Reflect page (`src/pages/Reflect.tsx`) is the user's daily inner space. It has four sections:

1. **Mood check-in** — 5 mood orbs (heavy / unsettled / okay / good / alive), one tap per day. Stored in `checkins` table with `mood_score` (1–5) and optional `mood_note`. Once submitted shows "you checked in today" — can't re-submit same day.

2. **Journal** — free-text textarea, no prompt, no structure. Saved to `journal_entries` table with `entry_text`, `chapter_theme`, and `chapter_id`. Multiple entries per day are allowed. The placeholder is "what's present for you today?" — deliberately open.

3. **Your month so far** — a constellation grid of MiniSun dots, one per calendar day of the current month. Each dot is coloured by mood score if checked in, empty if not. Shows the whole month at a glance.

4. **Previous entries** — past journal entries grouped into collapsible folders by month + theme name. Shows newest first. Long entries collapse with a "read more" toggle.

### DB tables for Reflect
- `checkins` — user_id, chapter_id (intake), mood_score (1–5), mood_note, checkin_date (YYYY-MM-DD). One row per user per day.
- `journal_entries` — user_id, chapter_id, chapter_theme, entry_text, created_at. Multiple per day allowed.
