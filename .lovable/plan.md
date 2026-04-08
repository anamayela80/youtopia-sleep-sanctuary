

# YOUTOPIA — Full Rebuild Plan

This is a phased implementation of the complete YOUTOPIA prompt. Given the scope, I will implement it in one coordinated effort across all layers: database, edge functions, and frontend.

## What Changes

### 1. Database — New Tables and Schema Updates

**New tables:**
- `monthly_themes` — add columns: `intention` (text), `guide_voice_id` (text), `music_file_url` (text), `questions` (jsonb array of 3 questions), `checkin_question` (text), `checkin_count` (int), `is_active` (boolean)
- `user_voice_clones` — stores persistent cloned Voice ID per user (user_id, elevenlabs_voice_id, created_at)
- `seeds` — stores the 5 seed phrases + audio URLs per user per month (user_id, month, phrase_1..5, audio_url_1..5)
- `checkin_responses` — stores check-in answers (user_id, month, question, answer, created_at)
- `meditation_segments` — stores the 4 voice segment audio URLs per meditation (meditation_id, segment_number, audio_url)

**Update existing:**
- `profiles` — add `morning_reminder_time`, `night_reminder_time` columns
- `meditations` — remove `music_mood`, `music_url` (music comes from theme now); add `theme_id` reference

All tables get RLS policies scoped to user_id. Admin-only tables use the existing `has_role` function.

### 2. Onboarding — Restructured to 3 Steps

**Step 1 — Theme Introduction:** Full-screen card showing the active monthly theme name, description, and intention. Pure text, no audio. Fetched from `monthly_themes` where `is_active = true`.

**Step 2 — 3 Questions:** One question at a time with fade transitions. Questions come from the active monthly theme (admin-set). Defaults provided if none set. Short text input per answer.

**Step 3 — Voice Capture for Seeds:** Recording screen with teal waveform. User records 60-90 seconds. Audio sent to ElevenLabs Instant Voice Clone. Voice ID stored permanently in `user_voice_clones`. Raw recording deleted immediately. Privacy notice shown before recording.

**Remove:** Music selection step (Step 5), preset voice selection (Step 4). Voice for morning meditation is the guide voice set by admin, not user-chosen.

### 3. Morning Meditation — Segmented Audio Assembly

**Script generation** (edge function `generate-meditation`): Claude/Gemini generates exactly 4 labelled segments:
- Segment 1: Grounding (~90s speech) — uses user's name
- Segment 2: Intention (~90s) — from question 1
- Segment 3: Vision & Manifestation (~90s) — from question 2
- Segment 4: Release & Close (~60s) — from question 3

**Narration** (edge function `narrate-meditation`): Each segment narrated separately using guide voice `9BDgg2Q7WSrW0x8naPLw` with fixed settings (stability 0.80, similarity_boost 0.75, style 0.10, speed 0.85, use_speaker_boost true). 4 audio files stored in Supabase storage. ~5,500-6,000 characters total.

**Playback** (Web Audio API mixer): Assembled client-side in sequence:
1. Theme music fade-in (60s)
2. Segment 1 voice
3. Music bridge (60s)
4. Segment 2 voice
5. Music bridge (75s)
6. Segment 3 voice
7. Music bridge (60s)
8. Segment 4 voice
9. Theme music fade-out (90s)

Total: ~12-15 minutes. Music file from `monthly_themes.music_file_url`.

### 4. Night Seeds Session

**Seed generation** (new edge function `generate-seeds`): Claude generates 5 seed phrases from user answers + theme. Each phrase 8-14 words, first person, present tense, identity-based.

**Seed audio** (new edge function `narrate-seeds`): Each phrase wrapped in `[whisper]...[/whisper]`, sent to ElevenLabs using user's cloned Voice ID with settings: stability 0.75, similarity_boost 0.85, style 0.05, speed 0.80, use_speaker_boost true. 5 audio files stored.

**Playback assembly:**
1. Theme music fade-in (90s)
2. Seed 1 whisper (music continues underneath)
3. Music-only pause (25s)
4. Seeds 2-5 same pattern
5. Theme music loops 20 minutes
6. Fade-out over 2 minutes

### 5. Home Screen — Two Actions

Replace current single-player with two cards:
- **Morning Meditation** — with theme name, play button
- **Tonight's Seeds** — with "Best with headphones and eyes closed"

Show monthly theme name + intention at top. Show reminder times (tappable to adjust).

### 6. Admin Panel

New route `/admin` with admin-only access (checked via `has_role`):
- Set monthly theme (name, description, intention)
- Set 3 monthly questions
- Upload monthly music file to storage
- Set/update guide voice ElevenLabs Voice ID
- Set check-in question and count (1 or 2)
- Manual "Send check-in" button (triggers notification)
- Dashboard: total users, meditations this month, seeds played, check-in responses
- Send custom push notification

### 7. Monthly Check-in (Adaptive Seed)

- Admin triggers check-in notification
- User sees calm full-screen card with reflective question + text input
- Answer sent to Claude with existing 5 seeds + theme context
- Claude generates 1 new seed phrase → replaces seed 5
- New audio generated via ElevenLabs → replaces seed 5 audio in storage

### 8. Settings Page

New `/settings` route:
- Delete voice clone (with warning about seeds becoming unavailable)
- Update notification times
- Meditation library (all past months)
- Account management

### 9. Monthly Reset

On 1st of month: prompt user to view new theme + re-answer questions. New meditation + seeds generated using existing stored Voice ID (no re-recording). Previous meditations saved in library.

## Technical Details

**Edge functions to create/update:**
- `generate-meditation` — update prompt to output 4 labelled segments
- `narrate-meditation` — update to process 4 segments separately, use guide voice with fixed settings
- `generate-seeds` — new, Claude generates 5 seed phrases
- `narrate-seeds` — new, ElevenLabs whisper TTS with cloned voice
- `clone-voice` — update to store Voice ID persistently (not delete after use)
- `delete-voice` — update to clear from `user_voice_clones` table
- `update-seed` — new, for check-in adaptive seed replacement

**New components:**
- `ThemeIntroStep` — onboarding step 1
- `SeedsPlayer` — night seeds player screen
- `MeditationPlayer` — updated morning meditation player with segmented assembly
- `AdminPanel` — full admin interface
- `SettingsPage` — user settings
- `CheckinCard` — check-in response screen

**Audio mixer rewrite** (`useAudioMixer`): Support sequential playback of multiple audio segments interleaved with music bridges, with proper fade-in/fade-out. Load theme music from URL (not procedural). Load 4 voice segments from URLs.

**New hook** (`useSeedsPlayer`): Similar mixer for seeds — loads 5 whisper audio files + theme music, plays in the specified sequence with 25s gaps and 20-minute music loop.

## Implementation Order

1. Database migrations (new tables, schema updates, RLS)
2. Admin panel (so we can set themes, questions, music)
3. Onboarding restructure (3 steps: theme intro → questions → voice capture)
4. Morning meditation pipeline (4-segment generation, narration, storage)
5. Audio mixer rewrite (segmented playback with music bridges)
6. Night seeds pipeline (generation, whisper narration, storage)
7. Seeds player
8. Home screen redesign (two cards)
9. Settings page
10. Check-in flow
11. Monthly reset logic

