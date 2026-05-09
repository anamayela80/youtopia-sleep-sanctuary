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

---

## Locked fixes — do not revert or re-introduce these bugs

### Audio engine

6. **All timing and ducking constants live in `src/lib/sessionTiming.ts`** — `TENURE_TIMING`, `DUCK_RATIO`, `DUCK_PRE_RAMP`, `DUCK_POST_RAMP`, `VOICE_RATE`, `VOICE_WET`, `VOICE_LPF`, `MUSIC_RAMP_SECS`, `ARC`. Never declare them locally in a hook or renderer. The live player (`useSegmentedMixer`) and offline renderer (`renderMixedAudio`) must both import from this file so the WAV download always matches what the user hears.

7. **`startTimeRef` must NOT be reset on auto-resume** — in both `visibilitychange` and MediaSession `play` handlers, do NOT set `startTimeRef.current = ctx.currentTime`. The AudioContext clock freezes during OS suspend and resumes from the same point; resetting the anchor makes the progress bar jump backward.

8. **`skipForward` / `skipBackward` must read elapsed time from refs, not from React state** — `currentTime` state updates 60× per second; if skip buttons close over state they get a new identity every frame, breaking `useCallback` memoisation and MediaSession registration. Always compute elapsed time as:
   ```ts
   const elapsed = isPlayingRef.current
     ? offsetRef.current + (ctx.currentTime - startTimeRef.current)
     : offsetRef.current;
   ```

9. **MediaSession `seekforward` / `seekbackward` handlers must be wrapped in `try/catch`** — these are a Chrome extension; Safari and some Android browsers throw on registration. Pattern:
   ```ts
   try { navigator.mediaSession.setActionHandler("seekforward", ...) } catch {}
   try { navigator.mediaSession.setActionHandler("seekbackward", ...) } catch {}
   ```

10. **Audio helper functions (`createReverbImpulse`, `createReverb`, `createVoiceBus` in `audioEffects.ts`) accept `BaseAudioContext`, not `AudioContext`** — this allows `OfflineAudioContext` to be passed without unsafe casting. Never narrow these back to `AudioContext`.

11. **`renderMixedAudio` must use a sequential `for...of` loop**, not `Promise.all`, to fetch and decode audio buffers — parallel `decodeAudioData` crashes iOS Safari.

12. **Music source node must not be pushed into `activeSourcesRef`** — it has its own `stop()` call; double-stopping a node throws a silent error that can break the next playback cycle. Only voice segment source nodes go into `activeSourcesRef`.

### iOS / cross-platform

13. **Voice recording MIME type must be detected at runtime** — never hardcode `audio/webm`. Use:
    ```ts
    const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
    ```
    `audio/webm` is unsupported on iOS Safari; hardcoding it blocks every iOS user from recording.

14. **The analyser `AudioContext` created for mic-level metering must be closed** — store it in a `useRef`, then call `.close()` inside `recorder.onstop` (or on component unmount) so it doesn't occupy the iOS audio session slot indefinitely.

### React patterns

15. **Never use `useState` as a DOM ref** — `const ref = useState<HTMLDivElement | null>(null)` is wrong. Use `useRef<HTMLDivElement | null>(null)`. The `Expandable` component in `MyMonth.tsx` was fixed to use `useRef`; don't revert it.

16. **Never call `.sort()` directly on a prop or derived array** — `.sort()` mutates in place. Always call `.slice().sort(...)` first. The `meditation_segments` sort in `MyMonth.tsx` was fixed this way.

17. **Duplicate Supabase import aliases are banned** — never have both `import { supabase }` and `import { supabase as sb }` in the same file. Use a single `import { supabase }` throughout.

18. **Unmount guards are required on async `loadData` / IIFE effects** — any `useEffect` that fires an async function and calls `setState` must set a `cancelled` / `isMounted` flag and check it before every `setState`. Pattern:
    ```ts
    useEffect(() => {
      let cancelled = false;
      (async () => {
        const data = await fetchSomething();
        if (cancelled) return;
        setState(data);
      })();
      return () => { cancelled = true; };
    }, []);
    ```

### Data / services

19. **`saveIntake` uses a single atomic `.upsert()`** — never revert to the select → update/insert two-step. The old pattern had a race condition where two tabs could both insert the same `(user_id, theme_id)` row. The upsert with `{ onConflict: "user_id,theme_id" }` is the correct pattern.

20. **`calcStreak` in `Home.tsx` checks yesterday as a fallback** — if the user hasn't checked in today yet, the streak cursor starts from yesterday. Never revert to a version that resets a multi-day streak just because the user opens the app before checking in.

### Admin panel

21. **`AdminThemes.tsx` renders all 5 questions** — the questions loop is `[0,1,2,3,4].map(...)`. Never shorten it back to 3.

22. **`AdminDashboard.tsx` types the `icon` prop as `LucideIcon`**, not `any`.

23. **`AdminMusic.tsx` pauses and nulls `audioRef.current` on unmount** — the `useEffect` cleanup prevents the audio element from leaking after the component is removed.

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
