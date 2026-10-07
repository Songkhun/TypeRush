# Typing App — Design Spec

Date: 2026-10-07
Status: Approved in conversation, pending written-spec review

## 1. Purpose

A personal typing trainer to help the user type faster in **English and Thai**. It must be **dark mode** and **fun**: game feel, streaks, effects. It is for a single user and has no accounts.

**Success criteria**
- The user can run timed tests and an arcade game in both English and Thai (Kedmanee).
- WPM and accuracy are recorded per session and shown over time, so improvement is visible.
- The app finds the user's weak keys and drills them.
- A daily goal and day streak encourage regular practice.

**Out of scope:** accounts/sync, multiplayer, custom text import, light theme.

## 2. Platform and stack

- Local web app run with `npm run dev` (Vite), opened in the browser.
- React + TypeScript for UI; HTML `<canvas>` for the arcade.
- Persistence: browser `localStorage`.
- Tests: Vitest.
- Fonts: a monospace font for English, **Noto Sans Thai** for Thai (Google Fonts).

## 3. Code layout

```
src/
  engine/      pure TS, no React, fully unit-tested
    typing.ts      keystroke-vs-target comparison, errors, combo
    metrics.ts     WPM, raw WPM, accuracy, per-key timing
    wordgen.ts     random + weak-key-weighted word selection, seedable RNG
    keyboard.ts    EN QWERTY + TH Kedmanee layouts (char -> key id, shift flag)
    progress.ts    XP, levels, daily goal, streak
  data/        en-words.ts (~450 common words), th-words.ts (~300 common words)
  store/       versioned localStorage persistence
  game/        arcade: fixed-timestep loop, entities, spawning, collision, scoring
  fx/          particles, screen shake, Web Audio synth
  ui/          React screens + components
```

Rule: `engine/`, `store/` and `game/` logic do not import React or touch the DOM/canvas directly, so they stay testable.

## 4. Screens

Shared top bar: language toggle (EN / TH), level + XP bar, streak 🔥.

| Screen | Content |
|---|---|
| Home | Daily-goal progress ring; Test / Arcade / Drill buttons; last 5 results |
| Test | Mode picker: time 15/30/60 s or words 10/25/50. 3-line scrolling word band. On-screen keyboard below. Results card: WPM, raw WPM, accuracy, XP gained, PB celebration, 5 weakest keys |
| Drill | Same as Test, but words weighted toward weak keys; shows the 5 targeted keys |
| Arcade | Full-width canvas game (§7) |
| Stats | WPM/accuracy line chart over time (per language), PBs per mode/language, keyboard heatmap of per-key error rate |
| Settings | Sound on/off, effects intensity (Off/Subtle/Full), daily goal minutes, show keyboard, reset data (with confirm) |

Theme: background near-black navy (`#0b0f1a`), text `#c9d1e0`, correct = cyan, error = magenta, combo = amber. All colors are CSS variables.

## 5. Typing engine

**Input capture.** A hidden, always-focused `<input>`; read its `input` events (`InputEvent.data`) instead of `keydown`, so the OS Thai input source produces the real Thai characters. Use `keydown` only for Backspace, Escape and Tab (restart).

**Comparison.** Work one Unicode code point at a time. Each Thai keystroke, including above/below vowels and tone marks, produces one code point, so typed characters map 1:1 to target characters. Rendering groups characters into grapheme clusters (`Intl.Segmenter`) so combining marks display correctly. Each cluster is one span colored by its worst character state (incorrect > missed > partial > pending > correct); a partly typed cluster shows as `partial`.

- Correct char → mark correct, combo +1.
- Wrong char → mark incorrect, combo = 0, record error for the *expected* key. Typing moves on regardless.
- Backspace → removes the last char typed in the current word (not across word boundaries).
- Space → go to the next word; any characters left untyped in the word count as errors (missed).
- Extra chars past the word end are shown as errors (max 10 extra).

**Layout mismatch detection.** If 3 typed characters in a row belong to the other language's script, show the banner "Switch your input to Thai/English (⌃Space)".

**Thai text.** Practice words are separated by spaces.

## 6. Metrics, weak keys, progress

- **WPM** = (correct chars incl. spaces ÷ 5) ÷ minutes elapsed. Same formula for Thai (1 code point = 1 char).
- **Raw WPM** = (all typed chars ÷ 5) ÷ minutes.
- **Accuracy** = correct keystrokes ÷ total keystrokes (backspaced errors still count).
- **Per-key stats** (per language): hits, errors, mean interval from previous keystroke (intervals > 2 s ignored).
- **Weakness score** per key = `0.7 × errorRate + 0.3 × clamp(meanInterval / overallMeanInterval − 1, 0, 1)`, stored as an exponential moving average (α = 0.1 per session) so recent practice dominates. Keys with fewer than 10 hits are excluded.
- **Drill word selection:** 70% of words drawn with probability ∝ sum of weakness scores of their chars, 30% uniform. Top 5 weak keys displayed.
- **XP (Test/Drill)** = `correctChars × accMult + 5 × floor(maxCombo / 25)`, where `accMult = 0` if acc < 80%, else linear from 0.5 at 80% to 1.5 at 100%. Rounded.
- **XP (Arcade)** = `floor(score / 10)`.
- **Levels:** XP needed to go from level n to n+1 = `round(100 × n^1.5)`. Level-up triggers a flash and fanfare.
- **Daily goal:** count active typing time; a gap > 5 s between keystrokes is not counted. Default goal 5 min.
- **Streak:** a day counts when the goal is met. Streak = consecutive local-calendar days ending today (or yesterday, if today isn't done yet). A missed day resets it to 0.

## 7. Arcade: "Word Defense"

- The ship sits at the bottom center; words spawn at the top and drift toward the ship.
- **Targeting:** typing a char that matches the first char of an on-screen word locks onto it (nearest to the ship wins ties). Each correct char fires a laser bolt; finishing the word destroys it (particle burst). A wrong char breaks the combo, plays a buzz, keeps the lock. Escape releases the lock.
- **Damage:** a word reaching the ship costs 1 life (3 total) and shakes the screen. 0 lives = game over (score, high score, XP).
- **Waves:** wave n has `5 + 2n` words; speed and max word length increase each wave. Every 5th wave adds a **boss**: a long word or 2–3-word phrase that moves slowly and spawns small words every few seconds.
- **Score per word** = `length × wave × multiplier`; multiplier ×1–×4, +1 every 10 consecutive words cleared without error, reset on error or life lost. End of wave: card with wave WPM + no-damage bonus (`100 × wave`).
- **Loop:** `requestAnimationFrame` with fixed 60 Hz simulation step; `game/` holds pure state and update functions; a separate renderer draws state to canvas.

## 8. Effects ("juice")

Intensity setting: Off / Subtle / Full. All motion is disabled under `prefers-reduced-motion`.

- Correct char: small scale pop + glow. Error: short horizontal shake.
- Combo counter: grows and changes color at 10/25/50/100, particle burst at each.
- Sound (Web Audio oscillators, no asset files): click whose pitch rises with combo, soft thud on error, fanfare on PB and level-up, explosion noise in arcade.
- Results: numbers count up; confetti on a personal best.

## 9. Persistence

One `localStorage` key `typingapp:v1` holding JSON:

```ts
{
  version: 1,
  settings: { sound, fxIntensity, dailyGoalMin, showKeyboard, language },
  xp: number,
  sessions: Array<{ ts, mode, lang, durationMs, wpm, rawWpm, acc, xp }>, // capped at 1000, oldest dropped
  keyStats: { en: Record<char, KeyStat>, th: Record<char, KeyStat> },
  daily: Record<'YYYY-MM-DD', { activeMs: number }>,
  arcadeHigh: { en: number, th: number }
}
```

- Schema `version` plus a `migrate()` function for future changes.
- If the JSON can't be parsed or is invalid, copy the raw value to `typingapp:corrupt:<ts>` and start fresh; never crash.
- Writes happen at session end and on settings change; no per-keystroke writes.

## 10. Testing

- **Vitest unit tests:**
  - `engine/typing`: correct/incorrect, Backspace within word, no Backspace across words, space-skip counted as errors, extra chars, Thai combining marks (e.g. `น้ำ`, `ที่`), combo reset.
  - `engine/metrics`: WPM/raw/accuracy against known inputs; interval filtering.
  - `engine/wordgen`: seeded RNG gives deterministic output; weighting favors weak-key words; 70/30 mix.
  - `engine/keyboard`: every char in both word lists maps to a key.
  - `engine/progress`: XP formula edges (79%, 80%, 100%), level thresholds, streak across days/missed days/today-not-done.
  - `store/`: round-trip save/load, corrupt-data recovery, session cap.
  - `game/`: spawning per wave, lock-on selection, scoring/multiplier, life loss, boss wave.
- **Manual verification:** run in a real browser; play Test, Drill and Arcade in both EN and TH with the macOS Thai input source enabled; check that Stats and the streak update.
