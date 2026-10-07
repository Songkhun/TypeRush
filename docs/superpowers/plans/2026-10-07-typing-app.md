# TypeRush Typing App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dark-mode, game-like typing trainer for English and Thai, with timed tests, weak-key drills, an arcade mode, progress stats, XP/levels and a daily streak.

**Architecture:** A Vite + React + TypeScript single-page app run locally. All logic (typing, metrics, weak keys, XP/streak, storage, arcade simulation) lives in pure TypeScript modules under `src/engine`, `src/store` and `src/game`, covered by Vitest. React components under `src/ui` only wire that logic to the DOM. The arcade draws to a `<canvas>` from a separate renderer.

**Tech Stack:** Node 18+, Vite, React 19, TypeScript (strict), Vitest, Web Audio API, Canvas 2D, Google Fonts (JetBrains Mono, Noto Sans Thai).

**Spec:** `docs/superpowers/specs/2026-10-07-typing-app-design.md`

## Global Constraints

- Dark mode only. Colors come from CSS variables: bg `#0b0f1a`, text `#c9d1e0`, correct = cyan `#22d3ee`, error = magenta `#f472b6`, combo = amber `#fbbf24`.
- Languages: `'en'` (US QWERTY) and `'th'` (Thai Kedmanee). Thai practice words are separated by spaces.
- Compare text per Unicode code point (`[...str]`); render per grapheme cluster (`Intl.Segmenter`).
- Input is read from `input` events (`InputEvent.data`, `inputType === 'insertText'`) on a hidden focused `<input>`; `keydown` is used only for Backspace, Tab and Escape.
- WPM = (correct chars incl. spaces ÷ 5) ÷ minutes. Accuracy = correct keystrokes ÷ (keystrokes + missed chars).
- Persistence: one localStorage key `typingapp:v1`; sessions capped at 1000; corrupt data is backed up to `typingapp:corrupt:<ts>` and the app starts fresh. Never crash on storage errors.
- `src/engine`, `src/store` and `src/game/arcade.ts` must not import React or touch the DOM.
- Effects intensity: Off / Subtle / Full; `prefers-reduced-motion` forces Off.
- No accounts, sync, multiplayer, custom text or light theme.

## Review Focus

1. **Space typed at the start of a word (double space).** It must be ignored: no word skip, no keystroke counted. Tested in Task 4.
2. **Pasted text or autocorrect replacements in the hidden input.** These must be ignored, so only real typed characters count. Tested in Task 2 (`extractChars`).
3. **A session where every keystroke is wrong.** WPM 0, accuracy 0, XP 0, with no `NaN` anywhere; a session with zero keystrokes is not saved. Tested in Tasks 5 and 8.
4. **localStorage blocked or throwing** (private mode, quota). The app must run on defaults and saving must fail silently. Tested in Task 8.
5. **Drill before any weak-key data exists** (new user). It must fall back to uniform random words and show a "not enough data" note. Tested in Tasks 5 and 6.

---

## File Map

```
package.json, tsconfig.json, vite.config.ts, index.html, .gitignore
src/main.tsx                      React entry
src/engine/rng.ts                 seedable RNG (mulberry32), pick()
src/engine/keyboard.ts            EN/TH layouts, keyFor(), scriptOf()
src/engine/input.ts               extractChars(), updateMismatch()
src/engine/text.ts                clusterSizes()
src/engine/typing.ts              typing state machine + clusterView()
src/engine/metrics.ts             WPM/accuracy, keySamples()
src/engine/keystats.ts            weakness scores, weakKeys(), errorRates()
src/engine/wordgen.ts             randomWords(), weightedWords()
src/engine/progress.ts            XP, levels, active time, streak
src/data/en-words.ts, th-words.ts, words.ts
src/store/storage.ts              SaveData, load/save/migrate
src/store/session.ts              applyTypingSession(), applyArcadeSession()
src/game/arcade.ts                arcade simulation (pure)
src/game/render.ts                arcade canvas renderer + view state
src/fx/particles.ts, combo.ts, motion.ts, sound.ts
src/ui/theme.css
src/ui/AppContext.tsx             save data + sound + intensity context
src/ui/FxLayer.tsx                particle overlay, confetti, shake
src/ui/HiddenInput.tsx, Keyboard.tsx, WordStream.tsx, ComboMeter.tsx
src/ui/useCountUp.ts, useTypingSession.ts
src/ui/Results.tsx, TypingScreen.tsx, ArcadeScreen.tsx
src/ui/LineChart.tsx, StatsScreen.tsx, HomeScreen.tsx, SettingsScreen.tsx
src/ui/TopBar.tsx, App.tsx
```

---

### Task 1: Project scaffold + seedable RNG

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `.gitignore`, `src/engine/rng.ts`
- Test: `src/engine/rng.test.ts`

**Interfaces:**
- Produces: `type Rng = () => number`; `mulberry32(seed: number): Rng`; `pick<T>(arr: readonly T[], rng: Rng): T`

- [ ] **Step 1: Create config files**

`package.json`:
```json
{
  "name": "typerush",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc"
  }
}
```

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "noUnusedLocals": true,
    "types": ["vite/client"]
  },
  "include": ["src", "vite.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
```

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>TypeRush</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;700;800&family=Noto+Sans+Thai:wght@400;700;800&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`.gitignore`:
```
node_modules
dist
```

- [ ] **Step 2: Install dependencies**

Run:
```bash
npm install react react-dom
npm install -D vite @vitejs/plugin-react typescript vitest @types/react @types/react-dom
```
Expected: installs with no errors; `node_modules/` exists.

- [ ] **Step 3: Write the failing test** — `src/engine/rng.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { mulberry32, pick } from './rng';

describe('mulberry32', () => {
  it('is deterministic for a seed', () => {
    const a = mulberry32(42), b = mulberry32(42);
    const xs = [a(), a(), a()], ys = [b(), b(), b()];
    expect(xs).toEqual(ys);
  });
  it('returns values in [0, 1)', () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('differs between seeds', () => {
    expect(mulberry32(1)()).not.toEqual(mulberry32(2)());
  });
});

describe('pick', () => {
  it('returns an element of the array', () => {
    const r = mulberry32(3);
    for (let i = 0; i < 50; i++) expect(['a', 'b', 'c']).toContain(pick(['a', 'b', 'c'], r));
  });
});
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: FAIL, "Failed to resolve import './rng'".

- [ ] **Step 5: Implement** — `src/engine/rng.ts`

```ts
export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(arr: readonly T[], rng: Rng): T {
  return arr[Math.floor(rng() * arr.length)];
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run src/engine/rng.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html .gitignore src/engine/rng.ts src/engine/rng.test.ts
git commit -m "chore: scaffold Vite + React + TS + Vitest; add seedable RNG"
```

---

### Task 2: Keyboard layouts, script detection, input helpers

**Files:**
- Create: `src/engine/keyboard.ts`, `src/engine/input.ts`
- Test: `src/engine/keyboard.test.ts`, `src/engine/input.test.ts`

**Interfaces:**
- Produces:
  - `type Lang = 'en' | 'th'`
  - `interface KeyCap { id: string; base: string; shifted: string; width?: number }`
  - `interface KeyPos { id: string; shift: boolean }`
  - `layoutRows(lang: Lang): KeyCap[][]` returns 5 rows: number row, top, home, bottom, space row (`id: 'space'`).
  - `keyFor(lang: Lang, ch: string): KeyPos | null`. The key `id` is the US base character at that physical position (e.g. Thai `ก` → `{ id: 'd', shift: false }`).
  - `scriptOf(ch: string): Lang | null` (Thai block U+0E00–U+0E7F → `'th'`, `[A-Za-z]` → `'en'`, else `null`)
  - `extractChars(data: string | null, inputType: string): string[]`
  - `updateMismatch(count: number, ch: string, lang: Lang): number`

- [ ] **Step 1: Write the failing tests**

`src/engine/keyboard.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { keyFor, layoutRows, scriptOf } from './keyboard';

describe('layouts', () => {
  it('EN and TH rows have matching shapes', () => {
    const en = layoutRows('en'), th = layoutRows('th');
    expect(th.length).toBe(5);
    th.forEach((row, r) => expect(row.length).toBe(en[r].length));
  });
  it('has no duplicate characters within a layout', () => {
    for (const lang of ['en', 'th'] as const) {
      const all = layoutRows(lang).slice(0, 4).flat().flatMap((k) => [k.base, k.shifted]);
      expect(new Set(all).size).toBe(all.length);
    }
  });
});

describe('keyFor', () => {
  it('maps English base and shifted', () => {
    expect(keyFor('en', 'a')).toEqual({ id: 'a', shift: false });
    expect(keyFor('en', 'A')).toEqual({ id: 'a', shift: true });
    expect(keyFor('en', ';')).toEqual({ id: ';', shift: false });
  });
  it('maps Thai Kedmanee', () => {
    expect(keyFor('th', 'ก')).toEqual({ id: 'd', shift: false });
    expect(keyFor('th', 'ฎ')).toEqual({ id: 'e', shift: true });
    expect(keyFor('th', '่')).toEqual({ id: 'j', shift: false });
    expect(keyFor('th', 'ำ')).toEqual({ id: 'e', shift: false });
    expect(keyFor('th', 'ฃ')).toEqual({ id: '\\', shift: false });
  });
  it('maps space and rejects foreign chars', () => {
    expect(keyFor('th', ' ')).toEqual({ id: 'space', shift: false });
    expect(keyFor('th', 'a')).toBeNull();
    expect(keyFor('en', 'ก')).toBeNull();
  });
});

describe('scriptOf', () => {
  it('detects scripts', () => {
    expect(scriptOf('ก')).toBe('th');
    expect(scriptOf('้')).toBe('th');
    expect(scriptOf('Z')).toBe('en');
    expect(scriptOf(' ')).toBeNull();
    expect(scriptOf('5')).toBeNull();
  });
});
```

`src/engine/input.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { extractChars, updateMismatch } from './input';

describe('extractChars', () => {
  it('splits inserted text into code points', () => {
    expect(extractChars('a', 'insertText')).toEqual(['a']);
    expect(extractChars('ที่', 'insertText')).toEqual(['ท', 'ี', '่']);
  });
  it('ignores paste, replacement and empty input', () => {
    expect(extractChars('hello', 'insertFromPaste')).toEqual([]);
    expect(extractChars('the', 'insertReplacementText')).toEqual([]);
    expect(extractChars(null, 'insertText')).toEqual([]);
  });
});

describe('updateMismatch', () => {
  it('counts consecutive other-script chars and resets on matching script', () => {
    let c = 0;
    c = updateMismatch(c, 'd', 'th');
    c = updateMismatch(c, 'f', 'th');
    expect(c).toBe(2);
    c = updateMismatch(c, ' ', 'th'); // neutral char leaves count unchanged
    expect(c).toBe(2);
    c = updateMismatch(c, 'ก', 'th');
    expect(c).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/keyboard.test.ts src/engine/input.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement** — `src/engine/keyboard.ts`

```ts
export type Lang = 'en' | 'th';

export interface KeyCap { id: string; base: string; shifted: string; width?: number }
export interface KeyPos { id: string; shift: boolean }

const EN = {
  base: ['`1234567890-=', 'qwertyuiop[]\\', "asdfghjkl;'", 'zxcvbnm,./'],
  shifted: ['~!@#$%^&*()_+', 'QWERTYUIOP{}|', 'ASDFGHJKL:"', 'ZXCVBNM<>?'],
};

// Thai Kedmanee (TIS 820-2538), same physical positions as EN above.
const TH = {
  base: ['_ๅ/-ภถุึคตจขช', 'ๆไำพะัีรนยบลฃ', 'ฟหกดเ้่าสวง', 'ผปแอิืทมใฝ'],
  shifted: ['%+๑๒๓๔ู฿๕๖๗๘๙', '๐"ฎฑธํ๊ณฯญฐ,ฅ', 'ฤฆฏโฌ็๋ษศซ.', '()ฉฮฺ์?ฒฬฦ'],
};

function buildRows(lang: Lang): KeyCap[][] {
  const src = lang === 'en' ? EN : TH;
  const rows: KeyCap[][] = src.base.map((row, r) => {
    const base = [...row];
    const shifted = [...src.shifted[r]];
    const ids = [...EN.base[r]];
    return base.map((b, i) => ({ id: ids[i], base: b, shifted: shifted[i] }));
  });
  rows.push([{ id: 'space', base: ' ', shifted: ' ', width: 6 }]);
  return rows;
}

const ROWS: Record<Lang, KeyCap[][]> = { en: buildRows('en'), th: buildRows('th') };

function buildIndex(rows: KeyCap[][]): Map<string, KeyPos> {
  const m = new Map<string, KeyPos>();
  for (const row of rows) {
    for (const cap of row) {
      if (!m.has(cap.base)) m.set(cap.base, { id: cap.id, shift: false });
      if (!m.has(cap.shifted)) m.set(cap.shifted, { id: cap.id, shift: true });
    }
  }
  return m;
}

const INDEX: Record<Lang, Map<string, KeyPos>> = { en: buildIndex(ROWS.en), th: buildIndex(ROWS.th) };

export function layoutRows(lang: Lang): KeyCap[][] {
  return ROWS[lang];
}

export function keyFor(lang: Lang, ch: string): KeyPos | null {
  return INDEX[lang].get(ch) ?? null;
}

export function scriptOf(ch: string): Lang | null {
  if (/[฀-๿]/.test(ch)) return 'th';
  if (/[A-Za-z]/.test(ch)) return 'en';
  return null;
}
```

`src/engine/input.ts`:
```ts
import { scriptOf, type Lang } from './keyboard';

/** Characters actually typed, from an InputEvent. Paste/autocorrect/composition are ignored. */
export function extractChars(data: string | null, inputType: string): string[] {
  if (!data || inputType !== 'insertText') return [];
  return [...data];
}

/** Consecutive characters typed in the other language's script. Neutral chars leave it unchanged. */
export function updateMismatch(count: number, ch: string, lang: Lang): number {
  const script = scriptOf(ch);
  if (script === null) return count;
  return script === lang ? 0 : count + 1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/keyboard.test.ts src/engine/input.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/keyboard.ts src/engine/keyboard.test.ts src/engine/input.ts src/engine/input.test.ts
git commit -m "feat(engine): EN/TH keyboard layouts, script detection, input helpers"
```

---

### Task 3: Word lists

**Files:**
- Create: `src/data/en-words.ts`, `src/data/th-words.ts`, `src/data/words.ts`
- Test: `src/data/words.test.ts`

**Interfaces:**
- Consumes: `keyFor`, `Lang` from `src/engine/keyboard.ts`
- Produces: `WORDS: Record<Lang, readonly string[]>` (deduplicated)

- [ ] **Step 1: Write the failing test** — `src/data/words.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { WORDS } from './words';
import { keyFor } from '../engine/keyboard';

describe('word lists', () => {
  it('have enough unique words', () => {
    expect(WORDS.en.length).toBeGreaterThanOrEqual(400);
    expect(WORDS.th.length).toBeGreaterThanOrEqual(250);
    for (const lang of ['en', 'th'] as const) expect(new Set(WORDS[lang]).size).toBe(WORDS[lang].length);
  });
  it('English words are lowercase a-z only', () => {
    for (const w of WORDS.en) expect(w).toMatch(/^[a-z]+$/);
  });
  it('every character is typeable on its layout and words have no spaces', () => {
    for (const lang of ['en', 'th'] as const) {
      for (const w of WORDS[lang]) {
        expect(w).not.toMatch(/\s/);
        for (const ch of w) expect(keyFor(lang, ch), `${lang} "${w}" char "${ch}"`).not.toBeNull();
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/data/words.test.ts`
Expected: FAIL, unresolved import `./words`.

- [ ] **Step 3: Create the lists**

`src/data/en-words.ts`:
```ts
const RAW = `the be to of and a in that have it for not on with he as you do at this but his by from they we say her she or an will my one all would there their what so up out if about who get which go me when make can like time no just him know take people into year your good some could them see other than then now look only come its over think also back after use two how our work first well way even new want because any these give day most us is was are been has had did said each tell does set three air play small end put home read hand port large spell add land here must big high such follow act why ask men change went light kind off need house picture try again animal point mother world near build self earth father head stand own page should country found answer school grow study still learn plant cover food sun four between state keep eye never last let thought city tree cross farm hard start might story saw far sea draw left late run while press close night real life few north open seem together next white children begin got walk example ease paper group always music those both mark often letter until mile river car feet care second book carry took science eat room friend began idea fish mountain stop once base hear horse cut sure watch color face wood main enough plain girl usual young ready above ever red list though feel talk bird soon body dog family direct pose leave song measure door product black short numeral class wind question happen complete ship area half rock order fire south problem piece told knew pass since top whole king space heard best hour better true during hundred five remember step early hold west ground interest reach fast verb sing listen six table travel less morning ten simple several vowel toward war lay against pattern slow center love person money serve appear road map rain rule govern pull cold notice voice unit power town fine certain fly fall lead cry dark machine note wait plan figure star box noun field rest correct able pound done beauty drive stood contain front teach week final gave green oh quick develop ocean warm free minute strong special mind behind clear tail produce fact street inch multiply nothing course stay wheel full force blue object decide surface deep moon island foot system busy test record boat common gold possible plane stead dry wonder laugh thousand ago ran check game shape equate hot miss brought heat snow tire bring yes distant fill east paint language among`;

export const EN_WORDS: readonly string[] = [...new Set(RAW.split(/\s+/).filter(Boolean))];
```

`src/data/th-words.ts`:
```ts
const RAW = `กิน ข้าว น้ำ ไป มา ดู ฟัง พูด อ่าน เขียน รัก ชอบ ทำ งาน บ้าน รถ คน เด็ก แม่ พ่อ พี่ น้อง เพื่อน ครู นักเรียน โรงเรียน ห้อง ประตู หน้าต่าง โต๊ะ เก้าอี้ หนังสือ ปากกา ดินสอ กระดาษ เวลา วัน คืน เช้า เย็น บ่าย ปี เดือน สัปดาห์ ชั่วโมง นาที วินาที วันนี้ พรุ่งนี้ เมื่อวาน ตอนนี้ ที่นี่ ที่นั่น ทำไม อะไร ใคร ที่ไหน เมื่อไร อย่างไร เท่าไร ได้ ไม่ ใช่ มี เป็น อยู่ คือ จะ แล้ว กำลัง ยัง เคย ต้อง ควร อยาก ให้ เอา ซื้อ ขาย จ่าย เงิน ราคา ถูก แพง ใหญ่ เล็ก สูง ต่ำ ยาว สั้น ร้อน หนาว ดี เลว สวย น่ารัก เก่ง ง่าย ยาก เร็ว ช้า มาก น้อย ใหม่ เก่า หนัก เบา สะอาด สกปรก ใกล้ ไกล ซ้าย ขวา บน ล่าง ใน นอก หน้า หลัง ข้าง กลาง ทุก บาง หลาย แต่ และ หรือ ถ้า เพราะ ว่า กับ ของ จาก ถึง ตาม เพื่อ โดย สำหรับ ระหว่าง ภาษา ไทย อังกฤษ ประเทศ เมือง ถนน ทะเล ภูเขา แม่น้ำ ต้นไม้ ดอกไม้ ป่า ฝน ลม แดด ฟ้า ดาว ไฟ ดิน หิน ทราย สัตว์ หมา แมว นก ปลา ไก่ หมู วัว ช้าง ม้า ลิง เสือ งู ผลไม้ กล้วย มะม่วง ส้ม แตงโม ทุเรียน มะพร้าว ผัก อาหาร ก๋วยเตี๋ยว ส้มตำ ต้มยำ แกง ไข่ ขนม กาแฟ ชา นม เกลือ น้ำตาล หวาน เค็ม เปรี้ยว เผ็ด ขม อร่อย หิว อิ่ม ง่วง เหนื่อย สบาย ป่วย หมอ โรงพยาบาล ยา ร่างกาย หัว ตา หู จมูก ปาก ฟัน มือ เท้า ขา แขน ใจ ความ คิด รู้ เข้าใจ จำ ลืม เรียน สอน ถาม ตอบ เล่น วิ่ง เดิน นั่ง นอน ยืน หลับ ตื่น อาบ ล้าง ซัก เปิด ปิด ใส่ ถอด เริ่ม หยุด จบ ช่วย รอ หา เจอ ส่ง รับ โทร ข่าว เพลง ร้อง เต้น หนัง ภาพ สี แดง เขียว เหลือง ดำ ขาว ชมพู ม่วง หนึ่ง สอง สาม สี่ ห้า หก เจ็ด แปด เก้า สิบ ร้อย พัน หมื่น แสน ล้าน คอมพิวเตอร์ โทรศัพท์ แป้นพิมพ์ พิมพ์ ฝึก ซ้อม เกม ชนะ แพ้ คะแนน สนุก ตลก ยิ้ม หัวเราะ ร้องไห้ โกรธ กลัว ดีใจ เสียใจ ตกใจ ขอบคุณ ขอโทษ สวัสดี ลาก่อน ครับ ค่ะ คุณ ผม ฉัน เรา เขา พวก ตัว อัน ชิ้น ครั้ง เรื่อง ปัญหา คำ ประโยค ตัวอักษร โลก ชีวิต ครอบครัว บริษัท ตลาด ร้าน ธนาคาร สนามบิน เครื่องบิน เรือ รถไฟ จักรยาน ทาง ตรง เลี้ยว ข้าม ตั้ง วาง ถือ ดึง ผลัก โยน จับ ตี เตะ กระโดด ว่ายน้ำ ทำงาน พักผ่อน วันหยุด เที่ยว`;

export const TH_WORDS: readonly string[] = [...new Set(RAW.split(/\s+/).filter(Boolean))];
```

`src/data/words.ts`:
```ts
import type { Lang } from '../engine/keyboard';
import { EN_WORDS } from './en-words';
import { TH_WORDS } from './th-words';

export const WORDS: Record<Lang, readonly string[]> = { en: EN_WORDS, th: TH_WORDS };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/data/words.test.ts`
Expected: PASS. If the EN count is under 400 or TH under 250 after deduplication, add more common words of the same kind to `RAW` until it passes (do not lower the thresholds).

- [ ] **Step 5: Commit**

```bash
git add src/data
git commit -m "feat(data): English and Thai practice word lists"
```

---

### Task 4: Typing engine + grapheme clusters

**Files:**
- Create: `src/engine/text.ts`, `src/engine/typing.ts`
- Test: `src/engine/text.test.ts`, `src/engine/typing.test.ts`

**Interfaces:**
- Produces:
  - `clusterSizes(cps: readonly string[]): number[]` — code-point count of each grapheme cluster
  - `type CharState = 'pending' | 'correct' | 'incorrect' | 'missed' | 'extra'`
  - `type ClusterState = CharState | 'partial'`
  - `interface KeyEvent { expected: string | null; typed: string; correct: boolean; t: number }`
  - `interface WordState { target: string[]; typed: string[] }`
  - `interface TypingState { words: WordState[]; wordIndex: number; keystrokes: number; correctKeystrokes: number; missed: number; combo: number; maxCombo: number; events: KeyEvent[] }`
  - `MAX_EXTRA = 10`
  - `createTyping(words: readonly string[]): TypingState`
  - `appendWords(s: TypingState, words: readonly string[]): TypingState`
  - `typeChar(s: TypingState, ch: string, t: number): TypingState`
  - `backspace(s: TypingState): TypingState`
  - `isFinished(s: TypingState): boolean`
  - `correctChars(s: TypingState): number`
  - `wordView(w: WordState, done: boolean): { ch: string; state: CharState }[]`
  - `interface ClusterView { text: string; state: ClusterState; start: number }`
  - `clusterView(w: WordState, done: boolean): ClusterView[]`

- [ ] **Step 1: Write the failing tests**

`src/engine/text.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { clusterSizes } from './text';

describe('clusterSizes', () => {
  it('treats ASCII as one code point per cluster', () => {
    expect(clusterSizes([...'cat'])).toEqual([1, 1, 1]);
  });
  it('groups Thai combining marks with their base', () => {
    expect(clusterSizes([...'ที่'])).toEqual([3]);
    expect(clusterSizes([...'ที่นี่'])).toEqual([3, 3]);
    expect(clusterSizes([...'กา'])).toEqual([1, 1]);
    expect(clusterSizes([...'เกม'])).toEqual([1, 1, 1]);
  });
});
```

`src/engine/typing.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import {
  appendWords, backspace, clusterView, correctChars, createTyping, isFinished, MAX_EXTRA, typeChar, wordView,
  type TypingState,
} from './typing';

function typeAll(s: TypingState, text: string, t0 = 0): TypingState {
  let t = t0;
  for (const ch of text) s = typeChar(s, ch, (t += 100));
  return s;
}

describe('typeChar', () => {
  it('counts correct chars and builds combo', () => {
    const s = typeAll(createTyping(['ab', 'cd']), 'ab');
    expect(s.keystrokes).toBe(2);
    expect(s.correctKeystrokes).toBe(2);
    expect(s.combo).toBe(2);
    expect(s.words[0].typed).toEqual(['a', 'b']);
  });
  it('marks wrong chars, resets combo, records expected char', () => {
    const s = typeAll(createTyping(['ab']), 'ax');
    expect(s.correctKeystrokes).toBe(1);
    expect(s.combo).toBe(0);
    expect(s.events[1]).toMatchObject({ expected: 'b', typed: 'x', correct: false });
  });
  it('space advances; exact word counts the space as correct', () => {
    const s = typeAll(createTyping(['ab', 'cd']), 'ab ');
    expect(s.wordIndex).toBe(1);
    expect(s.correctKeystrokes).toBe(3);
    expect(s.combo).toBe(3);
  });
  it('space on an incomplete word counts missed chars and breaks combo', () => {
    const s = typeAll(createTyping(['abc', 'd']), 'a ');
    expect(s.wordIndex).toBe(1);
    expect(s.missed).toBe(2);
    expect(s.combo).toBe(0);
    expect(s.correctKeystrokes).toBe(1);
  });
  it('ignores space at the start of a word (double space)', () => {
    let s = typeAll(createTyping(['ab', 'cd']), 'ab ');
    const before = s;
    s = typeChar(s, ' ', 999);
    expect(s).toBe(before);
    s = typeChar(createTyping(['ab']), ' ', 1);
    expect(s.keystrokes).toBe(0);
    expect(s.wordIndex).toBe(0);
  });
  it('records extra chars up to MAX_EXTRA and ignores the rest', () => {
    let s = typeAll(createTyping(['a', 'b']), 'a');
    s = typeAll(s, 'z'.repeat(MAX_EXTRA + 5));
    expect(s.words[0].typed.length).toBe(1 + MAX_EXTRA);
    expect(s.keystrokes).toBe(1 + MAX_EXTRA);
    expect(s.events.at(-1)!.expected).toBeNull();
  });
  it('handles Thai combining marks as separate keystrokes', () => {
    const s = typeAll(createTyping(['ที่']), 'ที่');
    expect(s.correctKeystrokes).toBe(3);
    expect(isFinished(s)).toBe(true);
  });
});

describe('backspace', () => {
  it('removes the last char in the current word only', () => {
    let s = typeAll(createTyping(['ab', 'cd']), 'ax');
    s = backspace(s);
    expect(s.words[0].typed).toEqual(['a']);
    expect(s.keystrokes).toBe(2); // keystrokes are never refunded
    s = typeAll(s, 'b c');
    s = backspace(backspace(s));
    expect(s.wordIndex).toBe(1);
    expect(s.words[1].typed).toEqual([]);
    expect(s.words[0].typed).toEqual(['a', 'b']);
  });
});

describe('isFinished / correctChars / appendWords', () => {
  it('finishes when the last word is typed exactly', () => {
    expect(isFinished(typeAll(createTyping(['ab', 'cd']), 'ab c'))).toBe(false);
    expect(isFinished(typeAll(createTyping(['ab', 'cd']), 'ab cd'))).toBe(true);
  });
  it('counts matching chars plus spaces', () => {
    expect(correctChars(typeAll(createTyping(['ab', 'cd']), 'ab cd'))).toBe(5);
    expect(correctChars(typeAll(createTyping(['ab', 'cd']), 'ax cd'))).toBe(4);
  });
  it('appends words', () => {
    const s = appendWords(createTyping(['a']), ['b', 'c']);
    expect(s.words.map((w) => w.target.join(''))).toEqual(['a', 'b', 'c']);
  });
});

describe('views', () => {
  it('wordView marks pending, correct, incorrect, missed, extra', () => {
    expect(wordView({ target: [...'abc'], typed: [...'ax'] }, false).map((v) => v.state))
      .toEqual(['correct', 'incorrect', 'pending']);
    expect(wordView({ target: [...'abc'], typed: [...'a'] }, true).map((v) => v.state))
      .toEqual(['correct', 'missed', 'missed']);
    expect(wordView({ target: [...'a'], typed: [...'ab'] }, false).map((v) => v.state))
      .toEqual(['correct', 'extra']);
  });
  it('clusterView groups Thai and reports partial clusters', () => {
    const w = { target: [...'ที่นี่'], typed: [...'ที'] };
    const v = clusterView(w, false);
    expect(v.map((c) => c.text)).toEqual(['ที่', 'นี่']);
    expect(v.map((c) => c.state)).toEqual(['partial', 'pending']);
    expect(v[1].start).toBe(3);
  });
  it('clusterView uses worst state in a cluster', () => {
    const v = clusterView({ target: [...'ที่'], typed: ['ท', 'ิ', '่'] }, false);
    expect(v[0].state).toBe('incorrect');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/text.test.ts src/engine/typing.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement** — `src/engine/text.ts`

```ts
const segmenter = new Intl.Segmenter('th', { granularity: 'grapheme' });

/** Number of code points in each grapheme cluster of the given code points. */
export function clusterSizes(cps: readonly string[]): number[] {
  return [...segmenter.segment(cps.join(''))].map((seg) => [...seg.segment].length);
}
```

`src/engine/typing.ts`:
```ts
import { clusterSizes } from './text';

export type CharState = 'pending' | 'correct' | 'incorrect' | 'missed' | 'extra';
export type ClusterState = CharState | 'partial';

export interface KeyEvent { expected: string | null; typed: string; correct: boolean; t: number }
export interface WordState { target: string[]; typed: string[] }
export interface TypingState {
  words: WordState[];
  wordIndex: number;
  keystrokes: number;
  correctKeystrokes: number;
  missed: number;
  combo: number;
  maxCombo: number;
  events: KeyEvent[];
}

export const MAX_EXTRA = 10;

const toWordState = (w: string): WordState => ({ target: [...w], typed: [] });

export function createTyping(words: readonly string[]): TypingState {
  return {
    words: words.map(toWordState), wordIndex: 0,
    keystrokes: 0, correctKeystrokes: 0, missed: 0, combo: 0, maxCombo: 0, events: [],
  };
}

export function appendWords(s: TypingState, words: readonly string[]): TypingState {
  return { ...s, words: [...s.words, ...words.map(toWordState)] };
}

export function isFinished(s: TypingState): boolean {
  if (s.wordIndex >= s.words.length) return true;
  const last = s.words.length - 1;
  const w = s.words[last];
  return s.wordIndex === last && w.typed.join('') === w.target.join('');
}

export function typeChar(s: TypingState, ch: string, t: number): TypingState {
  if (isFinished(s)) return s;
  const word = s.words[s.wordIndex];

  if (ch === ' ') {
    if (word.typed.length === 0) return s;
    const exact = word.typed.join('') === word.target.join('');
    const combo = exact ? s.combo + 1 : 0;
    return {
      ...s,
      wordIndex: s.wordIndex + 1,
      keystrokes: s.keystrokes + 1,
      correctKeystrokes: s.correctKeystrokes + (exact ? 1 : 0),
      missed: s.missed + Math.max(0, word.target.length - word.typed.length),
      combo,
      maxCombo: Math.max(s.maxCombo, combo),
      events: [...s.events, { expected: ' ', typed: ' ', correct: exact, t }],
    };
  }

  const pos = word.typed.length;
  if (pos >= word.target.length + MAX_EXTRA) return s;
  const expected = pos < word.target.length ? word.target[pos] : null;
  const correct = expected === ch;
  const combo = correct ? s.combo + 1 : 0;
  const words = s.words.slice();
  words[s.wordIndex] = { ...word, typed: [...word.typed, ch] };
  return {
    ...s,
    words,
    keystrokes: s.keystrokes + 1,
    correctKeystrokes: s.correctKeystrokes + (correct ? 1 : 0),
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    events: [...s.events, { expected, typed: ch, correct, t }],
  };
}

export function backspace(s: TypingState): TypingState {
  const word = s.words[s.wordIndex];
  if (!word || word.typed.length === 0) return s;
  const words = s.words.slice();
  words[s.wordIndex] = { ...word, typed: word.typed.slice(0, -1) };
  return { ...s, words };
}

export function correctChars(s: TypingState): number {
  let n = Math.min(s.wordIndex, s.words.length); // one correct space per completed word
  const upto = Math.min(s.wordIndex, s.words.length - 1);
  for (let i = 0; i <= upto; i++) {
    const w = s.words[i];
    const len = Math.min(w.typed.length, w.target.length);
    for (let j = 0; j < len; j++) if (w.typed[j] === w.target[j]) n++;
  }
  return n;
}

export function wordView(w: WordState, done: boolean): { ch: string; state: CharState }[] {
  const out: { ch: string; state: CharState }[] = w.target.map((ch, i) => {
    if (i >= w.typed.length) return { ch, state: done ? 'missed' : 'pending' };
    return { ch, state: w.typed[i] === ch ? 'correct' : 'incorrect' };
  });
  for (let i = w.target.length; i < w.typed.length; i++) out.push({ ch: w.typed[i], state: 'extra' });
  return out;
}

export interface ClusterView { text: string; state: ClusterState; start: number }

function clusterState(states: CharState[]): ClusterState {
  if (states.includes('incorrect')) return 'incorrect';
  if (states.includes('missed')) return 'missed';
  if (states.every((s) => s === 'correct')) return 'correct';
  if (states.every((s) => s === 'pending')) return 'pending';
  return 'partial';
}

export function clusterView(w: WordState, done: boolean): ClusterView[] {
  const view = wordView(w, done);
  const out: ClusterView[] = [];
  let start = 0;
  for (const size of clusterSizes(w.target)) {
    const part = view.slice(start, start + size);
    out.push({ text: part.map((p) => p.ch).join(''), state: clusterState(part.map((p) => p.state)), start });
    start += size;
  }
  for (let i = w.target.length; i < view.length; i++) out.push({ text: view[i].ch, state: 'extra', start: i });
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/text.test.ts src/engine/typing.test.ts`
Expected: PASS. If a Thai `clusterSizes` expectation differs, check Node's ICU (`node -p "process.versions.icu"`). Node ≥ 18 with full ICU follows UAX #29, where Thai above/below vowels and tone marks extend the preceding consonant.

- [ ] **Step 5: Commit**

```bash
git add src/engine/text.ts src/engine/text.test.ts src/engine/typing.ts src/engine/typing.test.ts
git commit -m "feat(engine): typing state machine with Thai-aware cluster views"
```

---

### Task 5: Metrics + weak-key statistics

**Files:**
- Create: `src/engine/metrics.ts`, `src/engine/keystats.ts`
- Test: `src/engine/metrics.test.ts`, `src/engine/keystats.test.ts`

**Interfaces:**
- Consumes: `TypingState`, `KeyEvent`, `correctChars` (Task 4)
- Produces:
  - `round1(x: number): number`
  - `perMinute(chars: number, ms: number): number` — `(chars/5)/(ms/60000)`, 0 if `ms <= 0`
  - `interface SessionResult { wpm: number; rawWpm: number; acc: number; correctChars: number; keystrokes: number; maxCombo: number; durationMs: number }` (acc in 0..1)
  - `computeResult(s: TypingState, durationMs: number): SessionResult`
  - `interface KeySample { hits: number; errors: number; intervalSum: number; intervalCount: number }`
  - `MAX_INTERVAL_MS = 2000`
  - `keySamples(events: readonly KeyEvent[]): Record<string, KeySample>` (by expected char; skips `null` and `' '`)
  - `interface KeyStat { hits: number; errors: number; score: number }`
  - `MIN_HITS = 10`, `EMA_ALPHA = 0.1`
  - `sessionWeakness(samples): Record<string, number>`
  - `updateKeyStats(prev: Record<string, KeyStat>, samples: Record<string, KeySample>, alpha?: number): Record<string, KeyStat>`
  - `weaknessMap(stats): Record<string, number>` (only keys with `hits >= MIN_HITS` and `score > 0`)
  - `weakKeys(stats, n = 5): string[]` (highest score first)
  - `errorRates(stats): Record<string, number>` (only `hits >= MIN_HITS`)

- [ ] **Step 1: Write the failing tests**

`src/engine/metrics.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { computeResult, keySamples, perMinute } from './metrics';
import { createTyping, typeChar, type TypingState } from './typing';

function play(words: string[], keys: [string, number][]): TypingState {
  let s = createTyping(words);
  for (const [ch, t] of keys) s = typeChar(s, ch, t);
  return s;
}

describe('perMinute', () => {
  it('computes chars/5 per minute and guards zero time', () => {
    expect(perMinute(50, 60000)).toBe(10);
    expect(perMinute(50, 0)).toBe(0);
  });
});

describe('computeResult', () => {
  it('perfect run', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['b', 100], [' ', 200], ['c', 300], ['d', 400]]);
    const r = computeResult(s, 60000);
    expect(r).toMatchObject({ wpm: 1, rawWpm: 1, acc: 1, correctChars: 5, keystrokes: 5, maxCombo: 5 });
  });
  it('run with an error', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['x', 100], [' ', 200], ['c', 300], ['d', 400]]);
    const r = computeResult(s, 60000);
    expect(r.correctChars).toBe(4);
    expect(r.acc).toBeCloseTo(0.6);
  });
  it('all-wrong run has zero WPM and accuracy, never NaN', () => {
    const s = play(['ab'], [['x', 0], ['y', 100]]);
    const r = computeResult(s, 30000);
    expect(r.wpm).toBe(0);
    expect(r.acc).toBe(0);
    const empty = computeResult(createTyping(['ab']), 0);
    expect(Number.isNaN(empty.acc) || Number.isNaN(empty.wpm)).toBe(false);
  });
});

describe('keySamples', () => {
  it('aggregates hits, errors and intervals by expected key', () => {
    const s = play(['ab', 'cd'], [['a', 0], ['x', 100], [' ', 200], ['c', 300], ['d', 2600]]);
    const k = keySamples(s.events);
    expect(k.a).toEqual({ hits: 1, errors: 0, intervalSum: 0, intervalCount: 0 });
    expect(k.b).toEqual({ hits: 1, errors: 1, intervalSum: 100, intervalCount: 1 });
    expect(k.c).toEqual({ hits: 1, errors: 0, intervalSum: 100, intervalCount: 1 });
    expect(k.d).toEqual({ hits: 1, errors: 0, intervalSum: 0, intervalCount: 0 }); // 2300ms gap ignored
    expect(k[' ']).toBeUndefined();
  });
});
```

`src/engine/keystats.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { errorRates, sessionWeakness, updateKeyStats, weakKeys, weaknessMap } from './keystats';

const samples = {
  a: { hits: 10, errors: 5, intervalSum: 1000, intervalCount: 10 },
  b: { hits: 10, errors: 0, intervalSum: 3000, intervalCount: 10 },
};

describe('sessionWeakness', () => {
  it('combines error rate and relative slowness', () => {
    const w = sessionWeakness(samples);
    expect(w.a).toBeCloseTo(0.35); // 0.7*0.5 + 0.3*0
    expect(w.b).toBeCloseTo(0.15); // 0.7*0 + 0.3*0.5
  });
});

describe('updateKeyStats', () => {
  it('initialises from the first session', () => {
    const st = updateKeyStats({}, samples);
    expect(st.a).toEqual({ hits: 10, errors: 5, score: expect.closeTo(0.35) });
  });
  it('applies an exponential moving average', () => {
    const prev = { a: { hits: 10, errors: 5, score: 0.35 } };
    const st = updateKeyStats(prev, { a: { hits: 10, errors: 0, intervalSum: 1000, intervalCount: 10 } });
    expect(st.a.score).toBeCloseTo(0.315);
    expect(st.a.hits).toBe(20);
  });
});

describe('weaknessMap / weakKeys / errorRates', () => {
  const stats = {
    a: { hits: 20, errors: 8, score: 0.4 },
    b: { hits: 20, errors: 1, score: 0.1 },
    c: { hits: 5, errors: 5, score: 0.9 }, // too few hits
    d: { hits: 30, errors: 0, score: 0 },
  };
  it('excludes low-hit and zero-score keys', () => {
    expect(weaknessMap(stats)).toEqual({ a: 0.4, b: 0.1 });
  });
  it('orders weak keys by score', () => {
    expect(weakKeys(stats, 5)).toEqual(['a', 'b']);
    expect(weakKeys({}, 5)).toEqual([]);
  });
  it('reports error rates for keys with enough hits', () => {
    expect(errorRates(stats)).toEqual({ a: 0.4, b: 0.05, d: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/engine/metrics.test.ts src/engine/keystats.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement** — `src/engine/metrics.ts`

```ts
import { correctChars, type KeyEvent, type TypingState } from './typing';

export interface SessionResult {
  wpm: number; rawWpm: number; acc: number; correctChars: number;
  keystrokes: number; maxCombo: number; durationMs: number;
}
export interface KeySample { hits: number; errors: number; intervalSum: number; intervalCount: number }

export const MAX_INTERVAL_MS = 2000;

export const round1 = (x: number): number => Math.round(x * 10) / 10;

export function perMinute(chars: number, ms: number): number {
  if (ms <= 0) return 0;
  return chars / 5 / (ms / 60000);
}

export function computeResult(s: TypingState, durationMs: number): SessionResult {
  const cc = correctChars(s);
  const denom = s.keystrokes + s.missed;
  return {
    wpm: round1(perMinute(cc, durationMs)),
    rawWpm: round1(perMinute(s.keystrokes, durationMs)),
    acc: denom === 0 ? 0 : s.correctKeystrokes / denom,
    correctChars: cc,
    keystrokes: s.keystrokes,
    maxCombo: s.maxCombo,
    durationMs,
  };
}

export function keySamples(events: readonly KeyEvent[]): Record<string, KeySample> {
  const out: Record<string, KeySample> = {};
  events.forEach((e, i) => {
    if (e.expected === null || e.expected === ' ') return;
    const k = (out[e.expected] ??= { hits: 0, errors: 0, intervalSum: 0, intervalCount: 0 });
    k.hits++;
    if (!e.correct) k.errors++;
    if (i > 0) {
      const dt = e.t - events[i - 1].t;
      if (dt > 0 && dt <= MAX_INTERVAL_MS) { k.intervalSum += dt; k.intervalCount++; }
    }
  });
  return out;
}
```

`src/engine/keystats.ts`:
```ts
import type { KeySample } from './metrics';

export interface KeyStat { hits: number; errors: number; score: number }

export const MIN_HITS = 10;
export const EMA_ALPHA = 0.1;

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

export function sessionWeakness(samples: Record<string, KeySample>): Record<string, number> {
  let sum = 0, count = 0;
  for (const s of Object.values(samples)) { sum += s.intervalSum; count += s.intervalCount; }
  const overall = count ? sum / count : 0;
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(samples)) {
    const errRate = s.hits ? s.errors / s.hits : 0;
    const mean = s.intervalCount ? s.intervalSum / s.intervalCount : overall;
    const slow = overall > 0 ? clamp(mean / overall - 1, 0, 1) : 0;
    out[k] = 0.7 * errRate + 0.3 * slow;
  }
  return out;
}

export function updateKeyStats(
  prev: Record<string, KeyStat>, samples: Record<string, KeySample>, alpha = EMA_ALPHA,
): Record<string, KeyStat> {
  const w = sessionWeakness(samples);
  const next = { ...prev };
  for (const [k, s] of Object.entries(samples)) {
    const p = prev[k];
    next[k] = {
      hits: (p?.hits ?? 0) + s.hits,
      errors: (p?.errors ?? 0) + s.errors,
      score: p ? p.score + alpha * (w[k] - p.score) : w[k],
    };
  }
  return next;
}

export function weaknessMap(stats: Record<string, KeyStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(stats)) if (s.hits >= MIN_HITS && s.score > 0) out[k] = s.score;
  return out;
}

export function weakKeys(stats: Record<string, KeyStat>, n = 5): string[] {
  return Object.entries(weaknessMap(stats)).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
}

export function errorRates(stats: Record<string, KeyStat>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, s] of Object.entries(stats)) if (s.hits >= MIN_HITS) out[k] = s.errors / s.hits;
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/engine/metrics.test.ts src/engine/keystats.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/metrics.ts src/engine/metrics.test.ts src/engine/keystats.ts src/engine/keystats.test.ts
git commit -m "feat(engine): WPM/accuracy metrics and weak-key scoring"
```

---

### Task 6: Word generation

**Files:**
- Create: `src/engine/wordgen.ts`
- Test: `src/engine/wordgen.test.ts`

**Interfaces:**
- Consumes: `Rng`, `mulberry32` (Task 1)
- Produces:
  - `randomWords(list: readonly string[], n: number, rng: Rng): string[]` (never repeats the same word twice in a row when the list has more than one word)
  - `wordWeight(word: string, weakness: Record<string, number>): number`
  - `weightedWords(list, n, weakness, rng, weakShare = 0.7): string[]`; falls back to `randomWords` when every weight is 0

- [ ] **Step 1: Write the failing test** — `src/engine/wordgen.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { randomWords, weightedWords, wordWeight } from './wordgen';
import { mulberry32 } from './rng';

const LIST = ['zoo', 'zip', 'zap', 'cat', 'dog', 'pen', 'sun', 'map', 'cup', 'hat'];

describe('randomWords', () => {
  it('is deterministic with a seed and has the right length', () => {
    expect(randomWords(LIST, 20, mulberry32(5))).toEqual(randomWords(LIST, 20, mulberry32(5)));
    expect(randomWords(LIST, 20, mulberry32(5))).toHaveLength(20);
  });
  it('never repeats a word back to back', () => {
    const ws = randomWords(['a', 'b'], 200, mulberry32(9));
    for (let i = 1; i < ws.length; i++) expect(ws[i]).not.toBe(ws[i - 1]);
  });
});

describe('weightedWords', () => {
  it('sums weakness of characters', () => {
    expect(wordWeight('zoo', { z: 0.5, o: 0.1 })).toBeCloseTo(0.7);
  });
  it('favours words with weak keys (~0.7 + 0.3 × 3/10, uniform would be 0.3)', () => {
    const ws = weightedWords(LIST, 2000, { z: 1 }, mulberry32(11));
    const share = ws.filter((w) => w.startsWith('z')).length / ws.length;
    expect(share).toBeGreaterThan(0.65);
    expect(share).toBeLessThan(0.85);
  });
  it('falls back to uniform words when there is no weakness data', () => {
    const ws = weightedWords(LIST, 50, {}, mulberry32(2));
    expect(ws).toHaveLength(50);
    expect(new Set(ws).size).toBeGreaterThan(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/wordgen.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement** — `src/engine/wordgen.ts`

```ts
import type { Rng } from './rng';

function pushNoRepeat(out: string[], list: readonly string[], idx: number): void {
  let w = list[idx];
  if (list.length > 1 && w === out[out.length - 1]) w = list[(idx + 1) % list.length];
  out.push(w);
}

export function randomWords(list: readonly string[], n: number, rng: Rng): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) pushNoRepeat(out, list, Math.floor(rng() * list.length));
  return out;
}

export function wordWeight(word: string, weakness: Record<string, number>): number {
  let sum = 0;
  for (const ch of word) sum += weakness[ch] ?? 0;
  return sum;
}

function pickWeighted(weights: number[], total: number, rng: Rng): number {
  let r = rng() * total;
  let lastPositive = 0;
  for (let i = 0; i < weights.length; i++) {
    if (weights[i] <= 0) continue;
    lastPositive = i;
    r -= weights[i];
    if (r < 0) return i;
  }
  return lastPositive;
}

export function weightedWords(
  list: readonly string[], n: number, weakness: Record<string, number>, rng: Rng, weakShare = 0.7,
): string[] {
  const weights = list.map((w) => wordWeight(w, weakness));
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return randomWords(list, n, rng);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const idx = rng() < weakShare ? pickWeighted(weights, total, rng) : Math.floor(rng() * list.length);
    pushNoRepeat(out, list, idx);
  }
  return out;
}
```

Note: `pushNoRepeat` swaps a back-to-back repeat for the next word in the list, which slightly lowers the weak-word share. The test's 0.65–0.85 bounds allow for that.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/wordgen.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/wordgen.ts src/engine/wordgen.test.ts
git commit -m "feat(engine): random and weak-key-weighted word generation"
```

---

### Task 7: XP, levels, active time, streak

**Files:**
- Create: `src/engine/progress.ts`
- Test: `src/engine/progress.test.ts`

**Interfaces:**
- Produces:
  - `accMultiplier(acc: number): number` — 0 if `acc < 0.8`, else `0.5 + (acc-0.8)/0.2`, rounded to 3 decimals (so 0.8 → 0.5, 1 → 1.5)
  - `sessionXp(correctChars: number, acc: number, maxCombo: number): number` = `round(correctChars × accMultiplier + 5 × floor(maxCombo/25))`
  - `arcadeXp(score: number): number` = `floor(score/10)`
  - `xpForNext(level: number): number` = `round(100 × level^1.5)`
  - `levelInfo(totalXp: number): { level: number; intoLevel: number; needed: number }` (levels start at 1)
  - `dateKey(d: Date): string` (local `YYYY-MM-DD`)
  - `ACTIVE_GAP_MS = 5000`; `activeTimeMs(times: readonly number[], gapMs?: number): number`
  - `computeStreak(daily: Record<string, { activeMs: number }>, goalMs: number, today: Date): number`

- [ ] **Step 1: Write the failing test** — `src/engine/progress.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  accMultiplier, activeTimeMs, arcadeXp, computeStreak, dateKey, levelInfo, sessionXp, xpForNext,
} from './progress';

describe('XP', () => {
  it('accuracy multiplier edges', () => {
    expect(accMultiplier(0.79)).toBe(0);
    expect(accMultiplier(0.8)).toBe(0.5);
    expect(accMultiplier(0.95)).toBe(1.25);
    expect(accMultiplier(1)).toBe(1.5);
  });
  it('session XP adds combo bonus', () => {
    expect(sessionXp(100, 1, 0)).toBe(150);
    expect(sessionXp(100, 1, 50)).toBe(160);
    expect(sessionXp(100, 0.5, 30)).toBe(5);
    expect(sessionXp(0, 0, 0)).toBe(0);
  });
  it('arcade XP', () => {
    expect(arcadeXp(1234)).toBe(123);
  });
});

describe('levels', () => {
  it('thresholds', () => {
    expect(xpForNext(1)).toBe(100);
    expect(xpForNext(2)).toBe(283);
    expect(levelInfo(0)).toEqual({ level: 1, intoLevel: 0, needed: 100 });
    expect(levelInfo(99)).toEqual({ level: 1, intoLevel: 99, needed: 100 });
    expect(levelInfo(100)).toEqual({ level: 2, intoLevel: 0, needed: 283 });
    expect(levelInfo(383)).toEqual({ level: 3, intoLevel: 0, needed: 520 });
  });
});

describe('time and streak', () => {
  it('dateKey is local and zero-padded', () => {
    expect(dateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
  });
  it('active time skips gaps over 5s', () => {
    expect(activeTimeMs([0, 1000, 2000, 9000, 9500])).toBe(2500);
    expect(activeTimeMs([])).toBe(0);
  });
  const goal = 300000;
  const today = new Date(2026, 9, 7, 12);
  const met = { activeMs: goal };
  it('counts consecutive days including today', () => {
    expect(computeStreak({ '2026-10-05': met, '2026-10-06': met, '2026-10-07': met }, goal, today)).toBe(3);
  });
  it('counts from yesterday when today is not done yet', () => {
    expect(computeStreak({ '2026-10-05': met, '2026-10-06': met, '2026-10-07': { activeMs: 10 } }, goal, today)).toBe(2);
  });
  it('resets after a missed day', () => {
    expect(computeStreak({ '2026-10-04': met, '2026-10-06': met }, goal, today)).toBe(1);
    expect(computeStreak({ '2026-10-04': met }, goal, today)).toBe(0);
  });
  it('crosses month boundaries', () => {
    expect(computeStreak({ '2026-09-30': met, '2026-10-01': met }, goal, new Date(2026, 9, 1))).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/engine/progress.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement** — `src/engine/progress.ts`

```ts
export function accMultiplier(acc: number): number {
  if (acc < 0.8) return 0;
  return Math.round((0.5 + (Math.min(acc, 1) - 0.8) / 0.2) * 1000) / 1000;
}

export function sessionXp(correctChars: number, acc: number, maxCombo: number): number {
  return Math.round(correctChars * accMultiplier(acc) + 5 * Math.floor(maxCombo / 25));
}

export function arcadeXp(score: number): number {
  return Math.floor(score / 10);
}

export function xpForNext(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

export function levelInfo(totalXp: number): { level: number; intoLevel: number; needed: number } {
  let level = 1;
  let rem = totalXp;
  while (rem >= xpForNext(level)) { rem -= xpForNext(level); level++; }
  return { level, intoLevel: rem, needed: xpForNext(level) };
}

export function dateKey(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const ACTIVE_GAP_MS = 5000;

export function activeTimeMs(times: readonly number[], gapMs = ACTIVE_GAP_MS): number {
  let sum = 0;
  for (let i = 1; i < times.length; i++) {
    const dt = times[i] - times[i - 1];
    if (dt > 0 && dt <= gapMs) sum += dt;
  }
  return sum;
}

export function computeStreak(daily: Record<string, { activeMs: number }>, goalMs: number, today: Date): number {
  const met = (d: Date) => (daily[dateKey(d)]?.activeMs ?? 0) >= goalMs;
  const d = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (!met(d)) d.setDate(d.getDate() - 1);
  let n = 0;
  while (met(d)) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/engine/progress.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/engine/progress.ts src/engine/progress.test.ts
git commit -m "feat(engine): XP, levels, active time and daily streak"
```

---

### Task 8: Persistence + applying sessions

**Files:**
- Create: `src/store/storage.ts`, `src/store/session.ts`
- Test: `src/store/storage.test.ts`, `src/store/session.test.ts`

**Interfaces:**
- Consumes: `Lang` (Task 2), `KeyStat`, `updateKeyStats` (Task 5), `SessionResult`, `KeySample`, `round1` (Task 5), `sessionXp`, `arcadeXp`, `levelInfo`, `dateKey` (Task 7)
- Produces (`storage.ts`):
  - `type FxIntensity = 'off' | 'subtle' | 'full'`; `type Mode = 'test' | 'drill' | 'arcade'`
  - `interface Settings { sound: boolean; fxIntensity: FxIntensity; dailyGoalMin: number; showKeyboard: boolean; language: Lang }`
  - `interface SessionRecord { ts: number; mode: Mode; lang: Lang; durationMs: number; wpm: number; rawWpm: number; acc: number; xp: number }`
  - `interface SaveData { version: 1; settings: Settings; xp: number; sessions: SessionRecord[]; keyStats: Record<Lang, Record<string, KeyStat>>; daily: Record<string, { activeMs: number }>; arcadeHigh: Record<Lang, number> }`
  - `type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void }`
  - `STORAGE_KEY = 'typingapp:v1'`, `MAX_SESSIONS = 1000`
  - `defaultData(): SaveData`, `migrate(raw: unknown): SaveData | null`, `load(storage: KV | null, now?: number): SaveData`, `save(data: SaveData, storage: KV | null): boolean`, `getStorage(): KV | null`
- Produces (`session.ts`):
  - `interface Outcome { data: SaveData; xpGained: number; personalBest: boolean; levelBefore: number; levelAfter: number }`
  - `bestWpm(data: SaveData, mode: Mode, lang: Lang): number`
  - `applyTypingSession(data, { mode: 'test' | 'drill'; lang; result: SessionResult; samples: Record<string, KeySample>; activeMs: number; now: Date }): Outcome`
  - `applyArcadeSession(data, { lang; score; wpm; acc; durationMs; activeMs; now }): Outcome & { highScore: boolean }`

- [ ] **Step 1: Write the failing tests**

`src/store/storage.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { defaultData, load, save, STORAGE_KEY, type KV } from './storage';

function fake(init: Record<string, string> = {}) {
  const m = new Map(Object.entries(init));
  const kv: KV = { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); } };
  return { kv, m };
}

describe('storage', () => {
  it('returns defaults when empty', () => {
    expect(load(fake().kv)).toEqual(defaultData());
  });
  it('round-trips', () => {
    const { kv } = fake();
    const d = { ...defaultData(), xp: 42 };
    expect(save(d, kv)).toBe(true);
    expect(load(kv).xp).toBe(42);
  });
  it('backs up corrupt JSON and starts fresh', () => {
    const { kv, m } = fake({ [STORAGE_KEY]: '{not json' });
    expect(load(kv, 123)).toEqual(defaultData());
    expect(m.get('typingapp:corrupt:123')).toBe('{not json');
  });
  it('backs up wrong-shape data', () => {
    const { kv, m } = fake({ [STORAGE_KEY]: JSON.stringify({ version: 1, xp: 'lots' }) });
    expect(load(kv, 5)).toEqual(defaultData());
    expect(m.has('typingapp:corrupt:5')).toBe(true);
  });
  it('fills missing settings from defaults', () => {
    const d = defaultData() as unknown as Record<string, unknown>;
    const { kv } = fake({ [STORAGE_KEY]: JSON.stringify({ ...d, settings: { sound: false } }) });
    const loaded = load(kv);
    expect(loaded.settings.sound).toBe(false);
    expect(loaded.settings.dailyGoalMin).toBe(5);
  });
  it('survives storage that throws', () => {
    const bad: KV = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('quota'); } };
    expect(load(bad)).toEqual(defaultData());
    expect(save(defaultData(), bad)).toBe(false);
    expect(load(null)).toEqual(defaultData());
  });
});
```

`src/store/session.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { applyArcadeSession, applyTypingSession, bestWpm } from './session';
import { defaultData, MAX_SESSIONS } from './storage';
import { sessionXp } from '../engine/progress';
import type { SessionResult } from '../engine/metrics';

const now = new Date(2026, 9, 7, 10);
const result = (over: Partial<SessionResult> = {}): SessionResult => ({
  wpm: 50, rawWpm: 55, acc: 0.9, correctChars: 250, keystrokes: 270, maxCombo: 30, durationMs: 30000, ...over,
});
const samples = { a: { hits: 12, errors: 2, intervalSum: 1200, intervalCount: 12 } };
const input = (over: Partial<SessionResult> = {}) =>
  ({ mode: 'test' as const, lang: 'en' as const, result: result(over), samples, activeMs: 25000, now });

describe('applyTypingSession', () => {
  it('records session, XP, daily time and key stats', () => {
    const out = applyTypingSession(defaultData(), input());
    const xp = sessionXp(250, 0.9, 30);
    expect(out.xpGained).toBe(xp);
    expect(out.data.xp).toBe(xp);
    expect(out.data.sessions).toHaveLength(1);
    expect(out.data.sessions[0]).toMatchObject({ mode: 'test', lang: 'en', wpm: 50, xp });
    expect(out.data.daily['2026-10-07'].activeMs).toBe(25000);
    expect(out.data.keyStats.en.a.hits).toBe(12);
    expect(out.data.keyStats.th).toEqual({});
  });
  it('flags personal bests per mode and language', () => {
    const first = applyTypingSession(defaultData(), input());
    expect(first.personalBest).toBe(true);
    const slower = applyTypingSession(first.data, input({ wpm: 40 }));
    expect(slower.personalBest).toBe(false);
    const faster = applyTypingSession(slower.data, input({ wpm: 60 }));
    expect(faster.personalBest).toBe(true);
    expect(bestWpm(faster.data, 'test', 'en')).toBe(60);
    expect(bestWpm(faster.data, 'test', 'th')).toBe(0);
  });
  it('reports level-ups', () => {
    const out = applyTypingSession(defaultData(), input({ correctChars: 200, acc: 1 }));
    expect(out.levelBefore).toBe(1);
    expect(out.levelAfter).toBe(2);
  });
  it('ignores sessions with no keystrokes', () => {
    const d = defaultData();
    const out = applyTypingSession(d, input({ keystrokes: 0, correctChars: 0, wpm: 0, acc: 0 }));
    expect(out.data).toBe(d);
    expect(out.xpGained).toBe(0);
  });
  it('gives zero XP for an all-wrong session', () => {
    const out = applyTypingSession(defaultData(), input({ correctChars: 0, acc: 0, wpm: 0, maxCombo: 0 }));
    expect(out.xpGained).toBe(0);
    expect(out.personalBest).toBe(false);
  });
  it('caps stored sessions', () => {
    const d = defaultData();
    d.sessions = Array.from({ length: MAX_SESSIONS }, (_, i) => ({
      ts: i, mode: 'test' as const, lang: 'en' as const, durationMs: 1, wpm: 1, rawWpm: 1, acc: 1, xp: 0,
    }));
    const out = applyTypingSession(d, input());
    expect(out.data.sessions).toHaveLength(MAX_SESSIONS);
    expect(out.data.sessions[0].ts).toBe(1);
  });
});

describe('applyArcadeSession', () => {
  const a = { lang: 'th' as const, score: 1500, wpm: 33.33, acc: 0.9, durationMs: 90000, activeMs: 60000, now };
  it('records high score and XP', () => {
    const out = applyArcadeSession(defaultData(), a);
    expect(out.highScore).toBe(true);
    expect(out.xpGained).toBe(150);
    expect(out.data.arcadeHigh.th).toBe(1500);
    expect(out.data.sessions[0]).toMatchObject({ mode: 'arcade', lang: 'th', wpm: 33.3 });
    const again = applyArcadeSession(out.data, { ...a, score: 100 });
    expect(again.highScore).toBe(false);
    expect(again.data.arcadeHigh.th).toBe(1500);
  });
  it('ignores an untouched game', () => {
    const d = defaultData();
    expect(applyArcadeSession(d, { ...a, score: 0, activeMs: 0 }).data).toBe(d);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/store`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement** — `src/store/storage.ts`

```ts
import type { Lang } from '../engine/keyboard';
import type { KeyStat } from '../engine/keystats';

export type FxIntensity = 'off' | 'subtle' | 'full';
export type Mode = 'test' | 'drill' | 'arcade';

export interface Settings {
  sound: boolean; fxIntensity: FxIntensity; dailyGoalMin: number; showKeyboard: boolean; language: Lang;
}
export interface SessionRecord {
  ts: number; mode: Mode; lang: Lang; durationMs: number; wpm: number; rawWpm: number; acc: number; xp: number;
}
export interface SaveData {
  version: 1;
  settings: Settings;
  xp: number;
  sessions: SessionRecord[];
  keyStats: Record<Lang, Record<string, KeyStat>>;
  daily: Record<string, { activeMs: number }>;
  arcadeHigh: Record<Lang, number>;
}
export type KV = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export const STORAGE_KEY = 'typingapp:v1';
export const MAX_SESSIONS = 1000;

export function defaultData(): SaveData {
  return {
    version: 1,
    settings: { sound: true, fxIntensity: 'full', dailyGoalMin: 5, showKeyboard: true, language: 'en' },
    xp: 0,
    sessions: [],
    keyStats: { en: {}, th: {} },
    daily: {},
    arcadeHigh: { en: 0, th: 0 },
  };
}

const isObj = (x: unknown): x is Record<string, unknown> => typeof x === 'object' && x !== null && !Array.isArray(x);

export function migrate(raw: unknown): SaveData | null {
  if (!isObj(raw) || raw.version !== 1) return null;
  if (typeof raw.xp !== 'number' || !Array.isArray(raw.sessions)) return null;
  if (!isObj(raw.settings) || !isObj(raw.keyStats) || !isObj(raw.daily) || !isObj(raw.arcadeHigh)) return null;
  const d = defaultData();
  return {
    ...d,
    ...(raw as Partial<SaveData>),
    settings: { ...d.settings, ...(raw.settings as Partial<Settings>) },
    keyStats: { ...d.keyStats, ...(raw.keyStats as Partial<SaveData['keyStats']>) },
    arcadeHigh: { ...d.arcadeHigh, ...(raw.arcadeHigh as Partial<SaveData['arcadeHigh']>) },
  };
}

export function load(storage: KV | null, now = Date.now()): SaveData {
  let raw: string | null;
  try {
    raw = storage ? storage.getItem(STORAGE_KEY) : null;
  } catch {
    return defaultData();
  }
  if (raw === null) return defaultData();
  let parsed: unknown;
  try { parsed = JSON.parse(raw); } catch { parsed = undefined; }
  const data = migrate(parsed);
  if (data) return data;
  try { storage?.setItem(`typingapp:corrupt:${now}`, raw); } catch { /* best effort */ }
  return defaultData();
}

export function save(data: SaveData, storage: KV | null): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function getStorage(): KV | null {
  try { return window.localStorage; } catch { return null; }
}
```

`src/store/session.ts`:
```ts
import type { Lang } from '../engine/keyboard';
import { updateKeyStats } from '../engine/keystats';
import { round1, type KeySample, type SessionResult } from '../engine/metrics';
import { arcadeXp, dateKey, levelInfo, sessionXp } from '../engine/progress';
import { MAX_SESSIONS, type Mode, type SaveData, type SessionRecord } from './storage';

export interface Outcome { data: SaveData; xpGained: number; personalBest: boolean; levelBefore: number; levelAfter: number }

export interface TypingSessionInput {
  mode: 'test' | 'drill'; lang: Lang; result: SessionResult;
  samples: Record<string, KeySample>; activeMs: number; now: Date;
}
export interface ArcadeSessionInput {
  lang: Lang; score: number; wpm: number; acc: number; durationMs: number; activeMs: number; now: Date;
}

export function bestWpm(data: SaveData, mode: Mode, lang: Lang): number {
  let best = 0;
  for (const s of data.sessions) if (s.mode === mode && s.lang === lang && s.wpm > best) best = s.wpm;
  return best;
}

function addCommon(data: SaveData, rec: SessionRecord, activeMs: number, now: Date): SaveData {
  const key = dateKey(now);
  return {
    ...data,
    xp: data.xp + rec.xp,
    sessions: [...data.sessions, rec].slice(-MAX_SESSIONS),
    daily: { ...data.daily, [key]: { activeMs: (data.daily[key]?.activeMs ?? 0) + activeMs } },
  };
}

export function applyTypingSession(data: SaveData, input: TypingSessionInput): Outcome {
  const levelBefore = levelInfo(data.xp).level;
  const { mode, lang, result, samples, activeMs, now } = input;
  if (result.keystrokes === 0) return { data, xpGained: 0, personalBest: false, levelBefore, levelAfter: levelBefore };
  const xp = sessionXp(result.correctChars, result.acc, result.maxCombo);
  const personalBest = result.wpm > 0 && result.wpm > bestWpm(data, mode, lang);
  const rec: SessionRecord = {
    ts: now.getTime(), mode, lang, durationMs: result.durationMs,
    wpm: result.wpm, rawWpm: result.rawWpm, acc: result.acc, xp,
  };
  const withSession = addCommon(data, rec, activeMs, now);
  const next: SaveData = {
    ...withSession,
    keyStats: { ...data.keyStats, [lang]: updateKeyStats(data.keyStats[lang], samples) },
  };
  return { data: next, xpGained: xp, personalBest, levelBefore, levelAfter: levelInfo(next.xp).level };
}

export function applyArcadeSession(data: SaveData, input: ArcadeSessionInput): Outcome & { highScore: boolean } {
  const levelBefore = levelInfo(data.xp).level;
  const { lang, score, wpm, acc, durationMs, activeMs, now } = input;
  if (score === 0 && activeMs <= 0) {
    return { data, xpGained: 0, personalBest: false, highScore: false, levelBefore, levelAfter: levelBefore };
  }
  const xp = arcadeXp(score);
  const highScore = score > data.arcadeHigh[lang];
  const rec: SessionRecord = {
    ts: now.getTime(), mode: 'arcade', lang, durationMs, wpm: round1(wpm), rawWpm: round1(wpm), acc, xp,
  };
  const withSession = addCommon(data, rec, activeMs, now);
  const next: SaveData = {
    ...withSession,
    arcadeHigh: { ...data.arcadeHigh, [lang]: Math.max(data.arcadeHigh[lang], score) },
  };
  return { data: next, xpGained: xp, personalBest: highScore, highScore, levelBefore, levelAfter: levelInfo(next.xp).level };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/store`
Expected: PASS. (In the level-up test, `sessionXp(200, 1, 30) = 300 + 5 = 305`, which is ≥ 100, so the player reaches level 2 and stays below the 383 XP needed for level 3.)

- [ ] **Step 5: Commit**

```bash
git add src/store
git commit -m "feat(store): versioned localStorage persistence and session application"
```

---

### Task 9: Arcade simulation

**Files:**
- Create: `src/game/arcade.ts`
- Test: `src/game/arcade.test.ts`

**Interfaces:**
- Consumes: `Rng`, `mulberry32` (Task 1)
- Produces:
  - `WIDTH = 800`, `HEIGHT = 600`, `SHIP = { x: 400, y: 560 }`, `HIT_RADIUS = 30`, `START_LIVES = 3`, `BOSS_SPAWN_INTERVAL = 3`
  - `interface Enemy { id: number; word: string[]; typed: number; x: number; y: number; speed: number; boss: boolean; spawnTimer: number }`
  - `type GameEvent = { type: 'lock'; id: number } | { type: 'hit'; id: number; x: number; y: number } | { type: 'destroy'; x: number; y: number; points: number; boss: boolean } | { type: 'miss' } | { type: 'damage' } | { type: 'waveEnd'; wave: number; wpm: number; bonus: number } | { type: 'gameOver' }`
  - `interface GameState { wave; lives; score; multiplier; cleanStreak; enemies: Enemy[]; lockId: number | null; toSpawn; spawnCooldown; bossPending: boolean; waveDamaged: boolean; waveChars; waveTime; time; over: boolean; nextId; keystrokes; correctKeystrokes; correctChars; events: GameEvent[] }`
  - `interface WordSource { words: readonly string[]; rng: Rng }`
  - `waveConfig(wave: number): { count: number; speed: number; maxLen: number; spawnInterval: number; boss: boolean }`
  - `newGame(): GameState`, `startWave(s: GameState, wave: number): void`
  - `spawnEnemy(s, word: string, x: number, y: number, speed: number, boss?: boolean): Enemy`
  - `step(s: GameState, dt: number, src: WordSource): void` (mutates)
  - `typeKey(s: GameState, ch: string): void` (mutates)
  - `release(s: GameState): void`
  - `drainEvents(s: GameState): GameEvent[]`

- [ ] **Step 1: Write the failing test** — `src/game/arcade.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import {
  drainEvents, newGame, release, SHIP, spawnEnemy, startWave, step, typeKey, waveConfig, type GameState,
} from './arcade';
import { mulberry32 } from '../engine/rng';

const src = () => ({ words: ['cat', 'dog', 'fish', 'apple', 'banana', 'kiwi'], rng: mulberry32(1) });
const quiet = (): GameState => { const s = newGame(); s.toSpawn = 0; return s; };
const typeWord = (s: GameState, w: string) => { for (const ch of w) typeKey(s, ch); };

describe('waves', () => {
  it('configures waves', () => {
    expect(waveConfig(1)).toMatchObject({ count: 7, boss: false });
    expect(waveConfig(5).boss).toBe(true);
    expect(waveConfig(2).speed).toBeGreaterThan(waveConfig(1).speed);
  });
  it('starts at wave 1 with 3 lives and spawns immediately', () => {
    const s = newGame();
    expect(s).toMatchObject({ wave: 1, lives: 3, toSpawn: 7, score: 0 });
    step(s, 1 / 60, src());
    expect(s.enemies).toHaveLength(1);
    expect(s.toSpawn).toBe(6);
  });
  it('ends a clean wave with a bonus and starts the next', () => {
    const s = quiet();
    step(s, 1 / 60, src());
    const ev = drainEvents(s);
    expect(ev).toContainEqual(expect.objectContaining({ type: 'waveEnd', wave: 1, bonus: 100 }));
    expect(s.wave).toBe(2);
    expect(s.toSpawn).toBe(9);
    expect(s.score).toBe(100);
  });
  it('boss wave spawns a phrase boss that spawns minions', () => {
    const s = newGame();
    startWave(s, 5);
    s.toSpawn = 0;
    const source = src();
    step(s, 1 / 60, source);
    const boss = s.enemies.find((e) => e.boss)!;
    expect(boss.word).toContain(' ');
    boss.spawnTimer = 0;
    step(s, 1 / 60, source);
    expect(s.enemies.filter((e) => !e.boss).length).toBe(1);
  });
});

describe('movement and damage', () => {
  it('moves enemies toward the ship', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', SHIP.x, 100, 60);
    step(s, 1, src());
    expect(e.y).toBeCloseTo(160);
  });
  it('loses a life when an enemy reaches the ship', () => {
    const s = quiet();
    s.multiplier = 3;
    spawnEnemy(s, 'cat', SHIP.x, SHIP.y, 60);
    step(s, 1 / 60, src());
    expect(s.lives).toBe(2);
    expect(s.multiplier).toBe(1);
    expect(drainEvents(s)).toContainEqual({ type: 'damage' });
  });
  it('ends the game at zero lives', () => {
    const s = quiet();
    s.lives = 1;
    spawnEnemy(s, 'cat', SHIP.x, SHIP.y, 60);
    step(s, 1 / 60, src());
    expect(s.over).toBe(true);
    expect(drainEvents(s)).toContainEqual({ type: 'gameOver' });
  });
});

describe('typing', () => {
  it('locks onto the nearest matching enemy', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    const near = spawnEnemy(s, 'cow', 500, 400, 0);
    typeKey(s, 'c');
    expect(s.lockId).toBe(near.id);
    expect(near.typed).toBe(1);
  });
  it('a wrong key keeps the lock but resets the multiplier', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', 300, 100, 0);
    s.multiplier = 3; s.cleanStreak = 25;
    typeKey(s, 'c');
    typeKey(s, 'x');
    expect(s.lockId).toBe(e.id);
    expect(s.multiplier).toBe(1);
    expect(s.cleanStreak).toBe(0);
    expect(drainEvents(s)).toContainEqual({ type: 'miss' });
  });
  it('a key with no matching enemy is a miss', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeKey(s, 'z');
    expect(s.lockId).toBeNull();
    expect(drainEvents(s)).toContainEqual({ type: 'miss' });
  });
  it('destroying a word scores length × wave × multiplier', () => {
    const s = quiet();
    s.wave = 2; s.multiplier = 2;
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeWord(s, 'cat');
    expect(s.score).toBe(12);
    expect(s.enemies).toHaveLength(0);
    expect(s.lockId).toBeNull();
    expect(drainEvents(s)).toContainEqual(expect.objectContaining({ type: 'destroy', points: 12 }));
  });
  it('raises the multiplier every 10 clean words, max 4', () => {
    const s = quiet();
    for (let i = 0; i < 10; i++) { spawnEnemy(s, 'cat', 300, 100, 0); typeWord(s, 'cat'); }
    expect(s.multiplier).toBe(2);
    for (let i = 0; i < 40; i++) { spawnEnemy(s, 'cat', 300, 100, 0); typeWord(s, 'cat'); }
    expect(s.multiplier).toBe(4);
  });
  it('release drops the lock and resets progress', () => {
    const s = quiet();
    const e = spawnEnemy(s, 'cat', 300, 100, 0);
    typeKey(s, 'c');
    release(s);
    expect(s.lockId).toBeNull();
    expect(e.typed).toBe(0);
  });
  it('counts keystrokes for accuracy', () => {
    const s = quiet();
    spawnEnemy(s, 'cat', 300, 100, 0);
    typeWord(s, 'cxat');
    expect(s.keystrokes).toBe(4);
    expect(s.correctKeystrokes).toBe(3);
    expect(s.correctChars).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/game/arcade.test.ts`
Expected: FAIL, unresolved import.

- [ ] **Step 3: Implement** — `src/game/arcade.ts`

```ts
import type { Rng } from '../engine/rng';

export const WIDTH = 800;
export const HEIGHT = 600;
export const SHIP = { x: WIDTH / 2, y: HEIGHT - 40 };
export const HIT_RADIUS = 30;
export const START_LIVES = 3;
export const BOSS_SPAWN_INTERVAL = 3;

export interface Enemy {
  id: number; word: string[]; typed: number; x: number; y: number; speed: number; boss: boolean; spawnTimer: number;
}

export type GameEvent =
  | { type: 'lock'; id: number }
  | { type: 'hit'; id: number; x: number; y: number }
  | { type: 'destroy'; x: number; y: number; points: number; boss: boolean }
  | { type: 'miss' }
  | { type: 'damage' }
  | { type: 'waveEnd'; wave: number; wpm: number; bonus: number }
  | { type: 'gameOver' };

export interface GameState {
  wave: number; lives: number; score: number; multiplier: number; cleanStreak: number;
  enemies: Enemy[]; lockId: number | null;
  toSpawn: number; spawnCooldown: number; bossPending: boolean;
  waveDamaged: boolean; waveChars: number; waveTime: number; time: number;
  over: boolean; nextId: number;
  keystrokes: number; correctKeystrokes: number; correctChars: number;
  events: GameEvent[];
}

export interface WordSource { words: readonly string[]; rng: Rng }

export function waveConfig(wave: number) {
  return {
    count: 5 + 2 * wave,
    speed: 40 + 8 * wave,
    maxLen: Math.min(4 + wave, 12),
    spawnInterval: Math.max(0.6, 2.2 - 0.12 * wave),
    boss: wave % 5 === 0,
  };
}

export function startWave(s: GameState, wave: number): void {
  const c = waveConfig(wave);
  s.wave = wave;
  s.toSpawn = c.count;
  s.spawnCooldown = 0;
  s.bossPending = c.boss;
  s.waveDamaged = false;
  s.waveChars = 0;
  s.waveTime = 0;
}

export function newGame(): GameState {
  const s: GameState = {
    wave: 1, lives: START_LIVES, score: 0, multiplier: 1, cleanStreak: 0,
    enemies: [], lockId: null, toSpawn: 0, spawnCooldown: 0, bossPending: false,
    waveDamaged: false, waveChars: 0, waveTime: 0, time: 0, over: false, nextId: 1,
    keystrokes: 0, correctKeystrokes: 0, correctChars: 0, events: [],
  };
  startWave(s, 1);
  return s;
}

export function spawnEnemy(s: GameState, word: string, x: number, y: number, speed: number, boss = false): Enemy {
  const e: Enemy = { id: s.nextId++, word: [...word], typed: 0, x, y, speed, boss, spawnTimer: BOSS_SPAWN_INTERVAL };
  s.enemies.push(e);
  return e;
}

function chooseWord(src: WordSource, maxLen: number, taken: Set<string>): string {
  const fits = src.words.filter((w) => [...w].length <= maxLen);
  const pool = fits.length ? fits : src.words;
  for (let i = 0; i < 10; i++) {
    const w = pool[Math.floor(src.rng() * pool.length)];
    if (!taken.has([...w][0])) return w;
  }
  return pool[Math.floor(src.rng() * pool.length)];
}

const dist = (e: Enemy) => Math.hypot(SHIP.x - e.x, SHIP.y - e.y);

export function step(s: GameState, dt: number, src: WordSource): void {
  if (s.over) return;
  s.time += dt;
  s.waveTime += dt;
  const cfg = waveConfig(s.wave);
  const firsts = new Set(s.enemies.map((e) => e.word[0]));
  const add = (word: string, x: number, y: number, speed: number, boss = false) => {
    firsts.add([...word][0]);
    return spawnEnemy(s, word, x, y, speed, boss);
  };

  if (s.bossPending) {
    const phrase = `${chooseWord(src, 12, firsts)} ${chooseWord(src, 12, new Set())}`;
    add(phrase, WIDTH / 2, -20, cfg.speed * 0.4, true);
    s.bossPending = false;
  }

  s.spawnCooldown -= dt;
  if (s.toSpawn > 0 && s.spawnCooldown <= 0) {
    add(chooseWord(src, cfg.maxLen, firsts), 60 + src.rng() * (WIDTH - 120), -20, cfg.speed);
    s.toSpawn--;
    s.spawnCooldown = cfg.spawnInterval;
  }

  const minions: [number, number][] = [];
  for (const e of s.enemies) {
    if (e.boss) {
      e.spawnTimer -= dt;
      if (e.spawnTimer <= 0) { e.spawnTimer = BOSS_SPAWN_INTERVAL; minions.push([e.x, e.y + 30]); }
    }
    const d = dist(e) || 1;
    e.x += ((SHIP.x - e.x) / d) * e.speed * dt;
    e.y += ((SHIP.y - e.y) / d) * e.speed * dt;
  }
  for (const [x, y] of minions) add(chooseWord(src, 4, firsts), x, y, cfg.speed);

  const survivors: Enemy[] = [];
  for (const e of s.enemies) {
    if (dist(e) < HIT_RADIUS) {
      s.lives--;
      s.multiplier = 1;
      s.cleanStreak = 0;
      s.waveDamaged = true;
      if (s.lockId === e.id) s.lockId = null;
      s.events.push({ type: 'damage' });
    } else {
      survivors.push(e);
    }
  }
  s.enemies = survivors;

  if (s.lives <= 0) {
    s.over = true;
    s.events.push({ type: 'gameOver' });
    return;
  }

  if (s.toSpawn === 0 && !s.bossPending && s.enemies.length === 0) {
    const minutes = s.waveTime / 60;
    const wpm = minutes > 0 ? Math.round(s.waveChars / 5 / minutes) : 0;
    const bonus = s.waveDamaged ? 0 : 100 * s.wave;
    s.score += bonus;
    s.events.push({ type: 'waveEnd', wave: s.wave, wpm, bonus });
    startWave(s, s.wave + 1);
  }
}

function miss(s: GameState): void {
  s.cleanStreak = 0;
  s.multiplier = 1;
  s.events.push({ type: 'miss' });
}

export function typeKey(s: GameState, ch: string): void {
  if (s.over) return;
  s.keystrokes++;
  let target = s.lockId !== null ? s.enemies.find((e) => e.id === s.lockId) : undefined;
  if (!target) {
    s.lockId = null;
    const candidates = s.enemies.filter((e) => e.typed === 0 && e.word[0] === ch);
    if (candidates.length === 0) { miss(s); return; }
    target = candidates.reduce((a, b) => (dist(b) < dist(a) ? b : a));
    s.lockId = target.id;
    s.events.push({ type: 'lock', id: target.id });
  }
  if (target.word[target.typed] !== ch) { miss(s); return; }

  target.typed++;
  s.correctKeystrokes++;
  s.correctChars++;
  s.waveChars++;
  s.events.push({ type: 'hit', id: target.id, x: target.x, y: target.y });

  if (target.typed === target.word.length) {
    const points = target.word.length * s.wave * s.multiplier;
    s.score += points;
    s.cleanStreak++;
    s.multiplier = Math.min(4, 1 + Math.floor(s.cleanStreak / 10));
    const done = target;
    s.enemies = s.enemies.filter((e) => e !== done);
    s.lockId = null;
    s.events.push({ type: 'destroy', x: done.x, y: done.y, points, boss: done.boss });
  }
}

export function release(s: GameState): void {
  const e = s.enemies.find((x) => x.id === s.lockId);
  if (e) e.typed = 0;
  s.lockId = null;
}

export function drainEvents(s: GameState): GameEvent[] {
  const ev = s.events;
  s.events = [];
  return ev;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/game/arcade.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/arcade.ts src/game/arcade.test.ts
git commit -m "feat(game): Word Defense arcade simulation"
```

---

### Task 10: Effects primitives (particles, combo tiers, motion, sound)

**Files:**
- Create: `src/fx/particles.ts`, `src/fx/combo.ts`, `src/fx/motion.ts`, `src/fx/sound.ts`
- Test: `src/fx/fx.test.ts`

**Interfaces:**
- Consumes: `FxIntensity` (Task 8), `Rng` (Task 1)
- Produces:
  - `interface Particle { x; y; vx; vy; life; maxLife; color: string; size }`
  - `burst(x: number, y: number, count: number, color: string, rng?: Rng, speed?: number): Particle[]`
  - `stepParticles(ps: Particle[], dt: number, gravity?: number): Particle[]` (alive particles only)
  - `particleCount(base: number, intensity: FxIntensity): number` (off 0, subtle `ceil(base/3)`, full base)
  - `drawParticles(g: CanvasRenderingContext2D, ps: readonly Particle[]): void`
  - `COMBO_TIERS = [10, 25, 50, 100]`; `comboTier(combo: number): number` (0–4)
  - `effectiveIntensity(setting: FxIntensity, reducedMotion: boolean): FxIntensity`; `prefersReducedMotion(): boolean`
  - `class Sound { enabled: boolean; click(combo: number); error(); laser(); fanfare(); levelUp(); explosion() }`

- [ ] **Step 1: Write the failing test** — `src/fx/fx.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { burst, particleCount, stepParticles } from './particles';
import { comboTier } from './combo';
import { effectiveIntensity } from './motion';
import { mulberry32 } from '../engine/rng';

describe('particles', () => {
  it('bursts the requested number at the origin', () => {
    const ps = burst(10, 20, 5, '#fff', mulberry32(1));
    expect(ps).toHaveLength(5);
    for (const p of ps) expect([p.x, p.y]).toEqual([10, 20]);
  });
  it('moves and expires particles', () => {
    const [p] = burst(0, 0, 1, '#fff', mulberry32(1));
    const [moved] = stepParticles([p], 0.1);
    expect(moved.x).toBeCloseTo(p.vx * 0.1);
    expect(stepParticles([p], 5)).toHaveLength(0);
  });
  it('applies gravity', () => {
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 1, maxLife: 1, color: '#fff', size: 2 };
    expect(stepParticles([p], 0.5, 100)[0].vy).toBe(50);
  });
  it('scales counts by intensity', () => {
    expect(particleCount(30, 'off')).toBe(0);
    expect(particleCount(30, 'subtle')).toBe(10);
    expect(particleCount(30, 'full')).toBe(30);
  });
});

describe('comboTier', () => {
  it('maps thresholds', () => {
    expect([0, 9, 10, 24, 25, 50, 99, 100, 500].map(comboTier)).toEqual([0, 0, 1, 1, 2, 3, 3, 4, 4]);
  });
});

describe('effectiveIntensity', () => {
  it('reduced motion forces off', () => {
    expect(effectiveIntensity('full', true)).toBe('off');
    expect(effectiveIntensity('subtle', false)).toBe('subtle');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/fx/fx.test.ts`
Expected: FAIL, unresolved imports.

- [ ] **Step 3: Implement**

`src/fx/particles.ts`:
```ts
import type { Rng } from '../engine/rng';
import type { FxIntensity } from '../store/storage';

export interface Particle { x: number; y: number; vx: number; vy: number; life: number; maxLife: number; color: string; size: number }

export function burst(x: number, y: number, count: number, color: string, rng: Rng = Math.random, speed = 220): Particle[] {
  return Array.from({ length: count }, () => {
    const a = rng() * Math.PI * 2;
    const v = speed * (0.3 + rng() * 0.7);
    const life = 0.5 + rng() * 0.5;
    return { x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life, maxLife: life, color, size: 2 + rng() * 3 };
  });
}

export function stepParticles(ps: Particle[], dt: number, gravity = 0): Particle[] {
  const out: Particle[] = [];
  for (const p of ps) {
    const life = p.life - dt;
    if (life <= 0) continue;
    out.push({ ...p, x: p.x + p.vx * dt, y: p.y + p.vy * dt, vy: p.vy + gravity * dt, life });
  }
  return out;
}

export function particleCount(base: number, intensity: FxIntensity): number {
  if (intensity === 'off') return 0;
  return intensity === 'subtle' ? Math.ceil(base / 3) : base;
}

export function drawParticles(g: CanvasRenderingContext2D, ps: readonly Particle[]): void {
  for (const p of ps) {
    g.globalAlpha = Math.max(0, p.life / p.maxLife);
    g.fillStyle = p.color;
    g.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  g.globalAlpha = 1;
}
```

`src/fx/combo.ts`:
```ts
export const COMBO_TIERS = [10, 25, 50, 100];

export function comboTier(combo: number): number {
  return COMBO_TIERS.filter((t) => combo >= t).length;
}
```

`src/fx/motion.ts`:
```ts
import type { FxIntensity } from '../store/storage';

export function effectiveIntensity(setting: FxIntensity, reducedMotion: boolean): FxIntensity {
  return reducedMotion ? 'off' : setting;
}

export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}
```

`src/fx/sound.ts`:
```ts
/** Tiny Web Audio synth: no audio files. All methods are no-ops when disabled or unsupported. */
export class Sound {
  enabled = true;
  private ctx: AudioContext | null = null;

  private ac(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!C) return null;
      this.ctx = new C();
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, dur: number, type: OscillatorType, vol: number, delay = 0, endFreq?: number): void {
    const ac = this.ac();
    if (!ac) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(ac.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  click(combo: number): void { this.tone(420 + Math.min(combo, 100) * 6, 0.05, 'triangle', 0.05); }
  error(): void { this.tone(120, 0.12, 'sawtooth', 0.04, 0, 70); }
  laser(): void { this.tone(1400, 0.08, 'square', 0.025, 0, 300); }
  fanfare(): void { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.18, 'square', 0.04, i * 0.1)); }
  levelUp(): void { [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.14, 'triangle', 0.05, i * 0.06)); }

  explosion(): void {
    const ac = this.ac();
    if (!ac) return;
    const len = Math.floor(ac.sampleRate * 0.3);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const gain = ac.createGain();
    gain.gain.value = 0.15;
    src.connect(gain).connect(ac.destination);
    src.start();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/fx/fx.test.ts && npx tsc`
Expected: tests PASS; `tsc` reports no errors.

- [ ] **Step 5: Commit**

```bash
git add src/fx
git commit -m "feat(fx): particles, combo tiers, reduced-motion handling, synth sounds"
```

---

### Task 11: UI foundation (theme, context, FX layer, shared components)

**Files:**
- Create: `src/ui/theme.css`, `src/ui/AppContext.tsx`, `src/ui/FxLayer.tsx`, `src/ui/HiddenInput.tsx`, `src/ui/Keyboard.tsx`, `src/ui/WordStream.tsx`, `src/ui/ComboMeter.tsx`, `src/ui/useCountUp.ts`

**Interfaces:**
- Consumes: `load`, `save`, `getStorage`, `SaveData`, `FxIntensity` (Task 8); `Sound`, `effectiveIntensity`, `prefersReducedMotion`, `burst`, `stepParticles`, `drawParticles`, `particleCount`, `comboTier` (Task 10); `extractChars` (Task 2); `layoutRows`, `keyFor`, `Lang` (Task 2); `TypingState`, `WordState`, `clusterView` (Task 4)
- Produces:
  - `AppProvider`, `useApp(): { data: SaveData; commit(next: SaveData): void; sound: Sound; intensity: FxIntensity }`
  - `FxLayer`, `useFx(): { burst(x, y, count, color): void; confetti(): void; shake(el: HTMLElement | null): void }`, `retrigger(el, cls)`
  - `HiddenInput` props `{ onChar(ch: string): void; onBackspace?(): void; onTab?(): void; onEscape?(): void; onFocusChange?(f: boolean): void }`
  - `Keyboard` props `{ lang: Lang; nextChar?: string | null; heat?: Record<string, number> }` (heat = per-char error rate 0..1)
  - `WordStream` props `{ state: TypingState }`
  - `ComboMeter` props `{ combo: number; spanRef?: React.Ref<HTMLSpanElement> }`
  - `useCountUp(target: number, ms?: number, enabled?: boolean): number`

This task is UI glue with no unit tests; the gate is a clean `tsc` run. Behaviour is checked by hand in Task 15.

- [ ] **Step 1: Theme** — `src/ui/theme.css`

```css
:root {
  --bg: #0b0f1a; --panel: #121829; --panel-2: #182038; --line: #243050;
  --text: #c9d1e0; --muted: #6b7799;
  --correct: #22d3ee; --error: #f472b6; --combo: #fbbf24; --accent: #a78bfa;
  --key-bg: #161d31;
  --font-mono: "JetBrains Mono", ui-monospace, Menlo, monospace;
  --font-th: "Noto Sans Thai", sans-serif;
  color-scheme: dark;
}
* { box-sizing: border-box; }
html, body, #root { margin: 0; min-height: 100%; }
body {
  background: radial-gradient(1200px 600px at 50% -10%, #1a2140 0%, var(--bg) 60%) fixed, var(--bg);
  color: var(--text);
  font-family: var(--font-mono), var(--font-th);
}
button {
  font: inherit; color: inherit; background: var(--panel-2); border: 1px solid var(--line);
  border-radius: 10px; padding: .5rem .9rem; cursor: pointer;
  transition: transform .08s, border-color .15s, background .15s;
}
button:hover { border-color: var(--correct); }
button:active { transform: scale(.97); }
input[type="number"] { font: inherit; color: inherit; background: var(--panel-2); border: 1px solid var(--line); border-radius: 8px; padding: .3rem .5rem; width: 5rem; }

.app { max-width: 1100px; margin: 0 auto; padding: 0 16px 48px; }
.topbar { display: flex; align-items: center; gap: 1rem; padding: 14px 0; flex-wrap: wrap; }
.brand { background: none; border: none; font-weight: 800; font-size: 1.3rem; padding: 0; }
.brand span { color: var(--correct); text-shadow: 0 0 12px rgba(34, 211, 238, .6); }
.nav { display: flex; gap: .4rem; flex-wrap: wrap; }
.nav button.on, .chip-on { border-color: var(--correct); color: var(--correct); }
.spacer { flex: 1; }
.lang-toggle { display: flex; border: 1px solid var(--line); border-radius: 10px; overflow: hidden; }
.lang-toggle button { border: none; border-radius: 0; background: transparent; }
.lang-toggle button.on { background: var(--correct); color: var(--bg); }
.level { display: flex; align-items: center; gap: .5rem; font-size: .9rem; }
.xpbar { width: 90px; height: 8px; background: var(--panel-2); border-radius: 4px; overflow: hidden; }
.xpbar > div { height: 100%; background: linear-gradient(90deg, var(--accent), var(--correct)); transition: width .6s; }
.streak { font-weight: 700; color: var(--combo); }

.cfg-bar { display: flex; gap: .4rem; justify-content: center; margin: 1rem 0; flex-wrap: wrap; }
.chip { padding: .3rem .7rem; font-size: .85rem; }
.live-bar { display: flex; gap: 1.5rem; align-items: baseline; font-size: 1.2rem; color: var(--muted); margin-bottom: .5rem; min-height: 2.2rem; }
.timer { color: var(--combo); font-size: 1.6rem; font-weight: 700; }
.stream { height: calc(3 * 2.6rem); overflow: hidden; font-size: 1.6rem; line-height: 2.6rem; }
.lang-th .stream { font-family: var(--font-th); }
.stream-inner { display: flex; flex-wrap: wrap; column-gap: .7em; transition: transform .15s ease-out; }
.word { white-space: nowrap; }
.word-wrong { text-decoration: underline wavy var(--error); text-underline-offset: 8px; }
.ch { position: relative; }
.ch-pending { color: var(--muted); }
.ch-partial { color: var(--muted); text-decoration: underline var(--correct); }
.ch-correct { color: var(--correct); }
.ch-incorrect { color: var(--error); }
.ch-missed { color: var(--muted); opacity: .5; }
.ch-extra { color: var(--error); opacity: .7; }
.caret::before {
  content: ''; position: absolute; left: -1px; top: .3em; bottom: .3em; width: 2px;
  background: var(--combo); animation: blink 1s steps(1) infinite;
}
.caret-end { display: inline-block; width: 0; }
@keyframes blink { 50% { opacity: 0; } }
.just { display: inline-block; animation: pop .15s ease-out; }
@keyframes pop { 0% { transform: scale(1.35); text-shadow: 0 0 14px var(--correct); } 100% { transform: scale(1); } }
.shake { animation: shake .25s; }
@keyframes shake { 20% { transform: translateX(-6px); } 40% { transform: translateX(5px); } 60% { transform: translateX(-3px); } 80% { transform: translateX(2px); } }
body[data-fx="subtle"] .shake { animation-name: shake-subtle; }
@keyframes shake-subtle { 33% { transform: translateX(-2px); } 66% { transform: translateX(2px); } }
body[data-fx="off"] .just, body[data-fx="off"] .shake, body[data-fx="off"] .pb { animation: none !important; }
body[data-fx="off"] .stream-inner, body[data-fx="off"] .combo { transition: none; }

.combo { font-weight: 800; display: inline-block; transition: transform .15s, color .15s; }
.combo-t0 { color: var(--muted); }
.combo-t1 { color: var(--text); }
.combo-t2 { color: var(--correct); }
.combo-t3 { color: var(--combo); transform: scale(1.15); }
.combo-t4 { color: var(--error); transform: scale(1.3); text-shadow: 0 0 16px var(--error); }
.banner { background: rgba(244, 114, 182, .12); border: 1px solid var(--error); color: var(--error); padding: .5rem 1rem; border-radius: 10px; margin-bottom: .75rem; text-align: center; }
.hidden-input { position: fixed; top: 0; left: 0; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
.focus-overlay { position: fixed; inset: 0; display: grid; place-items: center; background: rgba(11, 15, 26, .7); backdrop-filter: blur(3px); font-size: 1.2rem; cursor: pointer; z-index: 20; }

.keyboard { margin: 1.5rem auto 0; max-width: 760px; display: flex; flex-direction: column; gap: 6px; user-select: none; }
.kb-row { display: flex; gap: 6px; }
.key {
  flex: 1 1 0; min-width: 0; height: 46px; background: var(--key-bg); border: 1px solid var(--line); border-radius: 8px;
  display: flex; flex-direction: column; justify-content: center; align-items: center; font-size: .95rem; line-height: 1.15;
  font-family: var(--font-mono), var(--font-th); transition: background .1s, box-shadow .1s;
}
.key-shift { font-size: .65rem; color: var(--muted); }
.key-mod { flex-grow: 1.6; color: var(--muted); font-size: .75rem; }
.key-next { border-color: var(--correct); color: var(--correct); box-shadow: 0 0 0 1px var(--correct), 0 0 14px rgba(34, 211, 238, .5); }
.hint { text-align: center; color: var(--muted); font-size: .8rem; margin-top: 1rem; }
.fx-canvas { position: fixed; inset: 0; pointer-events: none; z-index: 50; }

.card { background: var(--panel); border: 1px solid var(--line); border-radius: 16px; padding: 1.25rem; }
.results { max-width: 640px; margin: 2rem auto; text-align: center; }
.big { font-size: 4rem; font-weight: 800; color: var(--correct); text-shadow: 0 0 24px rgba(34, 211, 238, .45); }
.stats-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: .75rem; margin: 1rem 0; }
.stat .label { color: var(--muted); font-size: .8rem; }
.stat .value { font-size: 1.5rem; font-weight: 700; }
.pb { color: var(--combo); font-weight: 800; font-size: 1.3rem; animation: pop .4s; }
.toast { color: var(--accent); font-weight: 800; font-size: 1.2rem; }
.drill-note { color: var(--muted); text-align: center; margin-bottom: .5rem; }
kbd { background: var(--key-bg); border: 1px solid var(--line); border-radius: 6px; padding: .1rem .45rem; margin: 0 .15rem; color: var(--combo); font-family: var(--font-mono), var(--font-th); }

.home-grid { display: grid; grid-template-columns: 240px 1fr; gap: 1rem; margin-top: 1rem; }
@media (max-width: 720px) { .home-grid { grid-template-columns: 1fr; } }
.modes { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
.mode-card { text-align: left; padding: 1.25rem; border-radius: 16px; background: linear-gradient(160deg, var(--panel-2), var(--panel)); }
.mode-card h3 { margin: 0 0 .3rem; color: var(--correct); }
.mode-card p { margin: 0; color: var(--muted); font-size: .85rem; }
.ring-wrap { display: flex; flex-direction: column; align-items: center; gap: .5rem; }
.recent { list-style: none; padding: 0; margin: 0; }
.recent li { display: flex; justify-content: space-between; gap: 1rem; padding: .4rem 0; border-bottom: 1px solid var(--line); font-size: .9rem; }
.muted { color: var(--muted); }

.arcade { display: flex; flex-direction: column; align-items: center; gap: .75rem; position: relative; margin-top: 1rem; }
.arcade canvas { width: 100%; max-width: 900px; aspect-ratio: 4 / 3; border-radius: 16px; border: 1px solid var(--line); background: var(--bg); }
.overlay-card { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; min-width: 280px; }

.settings { max-width: 560px; margin: 1.5rem auto; display: flex; flex-direction: column; gap: 1rem; }
.setting { display: flex; justify-content: space-between; align-items: center; gap: 1rem; }
.danger { border-color: var(--error); color: var(--error); }
.stats-page { display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem; }
.chart { width: 100%; height: auto; display: block; }
```

- [ ] **Step 2: App context** — `src/ui/AppContext.tsx`

```tsx
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getStorage, load, save, type FxIntensity, type SaveData } from '../store/storage';
import { Sound } from '../fx/sound';
import { effectiveIntensity, prefersReducedMotion } from '../fx/motion';

interface AppCtx { data: SaveData; commit: (next: SaveData) => void; sound: Sound; intensity: FxIntensity }

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<SaveData>(() => load(getStorage()));
  const sound = useMemo(() => new Sound(), []);
  sound.enabled = data.settings.sound;
  const intensity = effectiveIntensity(data.settings.fxIntensity, prefersReducedMotion());

  useEffect(() => { document.body.dataset.fx = intensity; }, [intensity]);

  const value = useMemo<AppCtx>(() => ({
    data, sound, intensity,
    commit: (next) => { setData(next); save(next, getStorage()); },
  }), [data, sound, intensity]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp must be used inside AppProvider');
  return c;
}
```

- [ ] **Step 3: FX overlay** — `src/ui/FxLayer.tsx`

```tsx
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { burst, drawParticles, particleCount, stepParticles, type Particle } from '../fx/particles';
import { useApp } from './AppContext';

interface FxApi {
  burst(x: number, y: number, count: number, color: string): void;
  confetti(): void;
  shake(el: HTMLElement | null): void;
}

const FxCtx = createContext<FxApi>({ burst() {}, confetti() {}, shake() {} });

const CONFETTI = ['#22d3ee', '#f472b6', '#fbbf24', '#a78bfa', '#34d399'];

export function retrigger(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth; // restart CSS animation
  el.classList.add(cls);
}

export function FxLayer({ children }: { children: ReactNode }) {
  const { intensity } = useApp();
  const intensityRef = useRef(intensity);
  intensityRef.current = intensity;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particles = useRef<Particle[]>([]);
  const raf = useRef(0);

  const run = useCallback(() => {
    if (raf.current) return;
    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      particles.current = stepParticles(particles.current, dt, 500);
      const c = canvasRef.current;
      const g = c?.getContext('2d');
      if (c && g) {
        if (c.width !== window.innerWidth || c.height !== window.innerHeight) {
          c.width = window.innerWidth;
          c.height = window.innerHeight;
        }
        g.clearRect(0, 0, c.width, c.height);
        drawParticles(g, particles.current);
      }
      raf.current = particles.current.length ? requestAnimationFrame(frame) : 0;
    };
    raf.current = requestAnimationFrame(frame);
  }, []);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const api = useMemo<FxApi>(() => ({
    burst(x, y, count, color) {
      const n = particleCount(count, intensityRef.current);
      if (!n) return;
      particles.current.push(...burst(x, y, n, color));
      run();
    },
    confetti() {
      const n = particleCount(150, intensityRef.current);
      for (let i = 0; i < n; i++) {
        particles.current.push(...burst(Math.random() * window.innerWidth, -10, 1, CONFETTI[i % CONFETTI.length], Math.random, 300));
      }
      if (n) run();
    },
    shake(el) {
      if (intensityRef.current === 'off' || !el) return;
      retrigger(el, 'shake');
    },
  }), [run]);

  return (
    <FxCtx.Provider value={api}>
      {children}
      <canvas ref={canvasRef} className="fx-canvas" aria-hidden />
    </FxCtx.Provider>
  );
}

export function useFx(): FxApi {
  return useContext(FxCtx);
}
```

- [ ] **Step 4: Hidden input** — `src/ui/HiddenInput.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import { extractChars } from '../engine/input';

interface Props {
  onChar(ch: string): void;
  onBackspace?(): void;
  onTab?(): void;
  onEscape?(): void;
  onFocusChange?(focused: boolean): void;
}

export function HiddenInput({ onChar, onBackspace, onTab, onEscape, onFocusChange }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(true);

  useEffect(() => { ref.current?.focus(); }, []);

  const setF = (f: boolean) => { setFocused(f); onFocusChange?.(f); };

  return (
    <>
      <input
        ref={ref}
        className="hidden-input"
        aria-label="Typing input"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        onInput={(e) => {
          const ne = e.nativeEvent as InputEvent;
          for (const ch of extractChars(ne.data, ne.inputType)) onChar(ch);
          e.currentTarget.value = '';
        }}
        onKeyDown={(e) => {
          if (e.key === 'Backspace') { e.preventDefault(); onBackspace?.(); }
          else if (e.key === 'Tab') { e.preventDefault(); onTab?.(); }
          else if (e.key === 'Escape') { onEscape?.(); }
        }}
        onFocus={() => setF(true)}
        onBlur={() => setF(false)}
      />
      {!focused && (
        <div className="focus-overlay" onClick={() => ref.current?.focus()}>
          Click here to keep typing
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 5: On-screen keyboard** — `src/ui/Keyboard.tsx`

```tsx
import { useMemo } from 'react';
import { keyFor, layoutRows, type KeyCap, type Lang } from '../engine/keyboard';

interface Props { lang: Lang; nextChar?: string | null; heat?: Record<string, number> }

function heatColor(rate: number): string {
  const pct = Math.round(Math.min(1, rate / 0.3) * 100);
  return `color-mix(in srgb, var(--error) ${pct}%, var(--key-bg))`;
}

function Key({ cap, active, heat }: { cap: KeyCap; active: boolean; heat?: number }) {
  const space = cap.id === 'space';
  return (
    <div
      className={`key${active ? ' key-next' : ''}`}
      style={{ flexGrow: cap.width ?? 1, background: heat !== undefined ? heatColor(heat) : undefined }}
      title={heat !== undefined ? `${Math.round(heat * 100)}% errors` : undefined}
    >
      <span className="key-shift">{space ? '' : cap.shifted}</span>
      <span>{space ? 'space' : cap.base}</span>
    </div>
  );
}

export function Keyboard({ lang, nextChar, heat }: Props) {
  const rows = layoutRows(lang);
  const next = nextChar ? keyFor(lang, nextChar) : null;
  const heatById = useMemo(() => {
    const m: Record<string, number> = {};
    if (heat) {
      for (const [ch, v] of Object.entries(heat)) {
        const k = keyFor(lang, ch);
        if (k) m[k.id] = Math.max(m[k.id] ?? 0, v);
      }
    }
    return m;
  }, [heat, lang]);

  return (
    <div className="keyboard" aria-hidden>
      {rows.map((row, r) => (
        <div className="kb-row" key={r}>
          {r === 3 && <div className={`key key-mod${next?.shift ? ' key-next' : ''}`}>shift</div>}
          {row.map((cap) => (
            <Key key={cap.id} cap={cap} active={next?.id === cap.id} heat={heat ? heatById[cap.id] : undefined} />
          ))}
          {r === 3 && <div className={`key key-mod${next?.shift ? ' key-next' : ''}`}>shift</div>}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Word stream** — `src/ui/WordStream.tsx`

```tsx
import { useLayoutEffect, useRef, useState, type Ref } from 'react';
import { clusterView, type TypingState, type WordState } from '../engine/typing';

function Word({ w, done, current, spanRef }: { w: WordState; done: boolean; current: boolean; spanRef?: Ref<HTMLSpanElement> }) {
  const clusters = clusterView(w, done);
  const caret = current ? clusters.findIndex((c) => c.state === 'pending' || c.state === 'partial') : -2;
  const caretAtEnd = current && caret === -1;
  const lastTyped = current ? (caret === -1 ? clusters.length - 1 : caret - 1) : -1;
  const wrong = done && w.typed.join('') !== w.target.join('');
  return (
    <span ref={spanRef} className={`word${wrong ? ' word-wrong' : ''}`}>
      {clusters.map((c, i) => (
        <span
          key={i === lastTyped ? `${i}-${w.typed.length}` : i}
          className={`ch ch-${c.state}${i === caret ? ' caret' : ''}${i === lastTyped && c.state === 'correct' ? ' just' : ''}`}
        >
          {c.text}
        </span>
      ))}
      {caretAtEnd && <span className="ch caret caret-end" />}
    </span>
  );
}

export function WordStream({ state }: { state: TypingState }) {
  const activeRef = useRef<HTMLSpanElement>(null);
  const [offset, setOffset] = useState(0);

  useLayoutEffect(() => {
    const a = activeRef.current;
    if (!a) return;
    setOffset(Math.max(0, a.offsetTop - a.offsetHeight));
  }, [state.wordIndex]);

  return (
    <div className="stream">
      <div className="stream-inner" style={{ transform: `translateY(${-offset}px)` }}>
        {state.words.map((w, i) => (
          <Word
            key={i}
            w={w}
            done={i < state.wordIndex}
            current={i === state.wordIndex}
            spanRef={i === state.wordIndex ? activeRef : undefined}
          />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Combo meter and count-up**

`src/ui/ComboMeter.tsx`:
```tsx
import type { Ref } from 'react';
import { comboTier } from '../fx/combo';

export function ComboMeter({ combo, spanRef }: { combo: number; spanRef?: Ref<HTMLSpanElement> }) {
  return (
    <span ref={spanRef} className={`combo combo-t${comboTier(combo)}`}>
      {combo > 1 ? `${combo}× combo` : ''}
    </span>
  );
}
```

`src/ui/useCountUp.ts`:
```ts
import { useEffect, useState } from 'react';

export function useCountUp(target: number, ms = 800, enabled = true): number {
  const [v, setV] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) { setV(target); return; }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const k = Math.min(1, (now - t0) / ms);
      setV(target * (1 - Math.pow(1 - k, 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms, enabled]);
  return v;
}
```

- [ ] **Step 8: Typecheck**

Run: `npx tsc`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/ui
git commit -m "feat(ui): theme, app context, FX overlay, input, keyboard, word stream"
```

---

### Task 12: Test & Drill screens

**Files:**
- Create: `src/ui/useTypingSession.ts`, `src/ui/Results.tsx`, `src/ui/TypingScreen.tsx`

**Interfaces:**
- Consumes: Task 4 typing API; `computeResult`, `keySamples`, `perMinute`, `SessionResult`, `KeySample` (Task 5); `weaknessMap`, `weakKeys` (Task 5); `randomWords`, `weightedWords` (Task 6); `mulberry32` (Task 1); `activeTimeMs` (Task 7); `WORDS` (Task 3); `applyTypingSession` (Task 8); `comboTier` (Task 10); `updateMismatch` (Task 2); `useApp`, `useFx`, `HiddenInput`, `Keyboard`, `WordStream`, `ComboMeter`, `useCountUp` (Task 11)
- Produces:
  - `type TestConfig = { kind: 'time'; seconds: number } | { kind: 'words'; count: number }`
  - `useTypingSession(opts: { lang; mode: 'test' | 'drill'; config: TestConfig; weakness: Record<string, number>; onFinish(r: SessionResult, samples: Record<string, KeySample>, activeMs: number): void }): { state: TypingState; type(ch: string): TypingState; backspace(): void; elapsedMs: number; liveWpm: number; finished: boolean }`
  - `TypingScreen` props `{ mode: 'test' | 'drill' }`

- [ ] **Step 1: Session hook** — `src/ui/useTypingSession.ts`

```ts
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { Lang } from '../engine/keyboard';
import { computeResult, keySamples, perMinute, type KeySample, type SessionResult } from '../engine/metrics';
import { activeTimeMs } from '../engine/progress';
import { mulberry32 } from '../engine/rng';
import {
  appendWords, backspace as backspaceState, correctChars, createTyping, isFinished, typeChar, type TypingState,
} from '../engine/typing';
import { randomWords, weightedWords } from '../engine/wordgen';
import { WORDS } from '../data/words';

export type TestConfig = { kind: 'time'; seconds: number } | { kind: 'words'; count: number };

interface Options {
  lang: Lang;
  mode: 'test' | 'drill';
  config: TestConfig;
  weakness: Record<string, number>;
  onFinish(result: SessionResult, samples: Record<string, KeySample>, activeMs: number): void;
}

interface Run { typing: TypingState; start: number | null; end: number | null }

/** One typing run. Remount (change `key`) to start a new run with new options. */
export function useTypingSession(opts: Options) {
  const optsRef = useRef(opts);
  optsRef.current = opts;
  const rng = useRef(mulberry32((Date.now() ^ Math.floor(Math.random() * 1e9)) >>> 0));
  const [, force] = useReducer((x: number) => x + 1, 0);

  const makeWords = useCallback((n: number) => {
    const { lang, mode, weakness } = optsRef.current;
    return mode === 'drill'
      ? weightedWords(WORDS[lang], n, weakness, rng.current)
      : randomWords(WORDS[lang], n, rng.current);
  }, []);

  const run = useRef<Run | null>(null);
  if (run.current === null) {
    const c = opts.config;
    run.current = { typing: createTyping(makeWords(c.kind === 'words' ? c.count : 60)), start: null, end: null };
  }

  const finish = useCallback((end: number) => {
    const r = run.current!;
    if (r.end !== null || r.start === null) return;
    r.end = end;
    force();
    const s = r.typing;
    optsRef.current.onFinish(computeResult(s, end - r.start), keySamples(s.events), activeTimeMs(s.events.map((e) => e.t)));
  }, []);

  const type = useCallback((ch: string): TypingState => {
    const r = run.current!;
    if (r.end !== null) return r.typing;
    const t = performance.now();
    const { config } = optsRef.current;
    if (r.start === null) r.start = t;
    if (config.kind === 'time' && t - r.start >= config.seconds * 1000) {
      finish(r.start + config.seconds * 1000);
      return r.typing;
    }
    let next = typeChar(r.typing, ch, t);
    if (config.kind === 'time' && next.words.length - next.wordIndex < 20) next = appendWords(next, makeWords(40));
    r.typing = next;
    force();
    if (config.kind === 'words' && isFinished(next)) finish(t);
    return next;
  }, [finish, makeWords]);

  const backspace = useCallback(() => {
    const r = run.current!;
    if (r.end !== null) return;
    r.typing = backspaceState(r.typing);
    force();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      const r = run.current!;
      if (r.start === null || r.end !== null) return;
      const { config } = optsRef.current;
      if (config.kind === 'time' && performance.now() - r.start >= config.seconds * 1000) {
        finish(r.start + config.seconds * 1000);
      } else {
        force();
      }
    }, 100);
    return () => window.clearInterval(id);
  }, [finish]);

  const r = run.current;
  const elapsedMs = r.start === null ? 0 : (r.end ?? performance.now()) - r.start;
  return {
    state: r.typing,
    type,
    backspace,
    elapsedMs,
    liveWpm: elapsedMs > 1000 ? perMinute(correctChars(r.typing), elapsedMs) : 0,
    finished: r.end !== null,
  };
}
```

- [ ] **Step 2: Results card** — `src/ui/Results.tsx`

```tsx
import { useEffect } from 'react';
import type { SessionResult } from '../engine/metrics';
import { useApp } from './AppContext';
import { useCountUp } from './useCountUp';

export interface FinishedRun {
  result: SessionResult;
  xpGained: number;
  personalBest: boolean;
  levelUp: number | null;
  weak: string[];
}

export function Results({ result, xpGained, personalBest, levelUp, weak, onNext }: FinishedRun & { onNext(): void }) {
  const { intensity } = useApp();
  const animate = intensity !== 'off';
  const wpm = useCountUp(result.wpm, 900, animate);
  const xp = useCountUp(xpGained, 900, animate);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); onNext(); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onNext]);

  return (
    <div className="card results">
      {personalBest && <div className="pb">🎉 New personal best!</div>}
      {levelUp !== null && <div className="toast">⬆ Level up! You are now level {levelUp}</div>}
      <div className="big">{Math.round(wpm)}</div>
      <div className="muted">words per minute</div>
      <div className="stats-row">
        <div className="stat"><div className="label">accuracy</div><div className="value">{Math.round(result.acc * 100)}%</div></div>
        <div className="stat"><div className="label">raw wpm</div><div className="value">{Math.round(result.rawWpm)}</div></div>
        <div className="stat"><div className="label">best combo</div><div className="value">{result.maxCombo}</div></div>
        <div className="stat"><div className="label">xp</div><div className="value">+{Math.round(xp)}</div></div>
      </div>
      {weak.length > 0 && (
        <p>Weakest keys: {weak.map((k) => <kbd key={k}>{k}</kbd>)}</p>
      )}
      <button onClick={onNext}>Next (Tab)</button>
    </div>
  );
}
```

- [ ] **Step 3: Typing screen** — `src/ui/TypingScreen.tsx`

```tsx
import { useCallback, useRef, useState } from 'react';
import type { Lang } from '../engine/keyboard';
import { updateMismatch } from '../engine/input';
import { weakKeys, weaknessMap } from '../engine/keystats';
import { comboTier } from '../fx/combo';
import { applyTypingSession } from '../store/session';
import { useApp } from './AppContext';
import { ComboMeter } from './ComboMeter';
import { useFx } from './FxLayer';
import { HiddenInput } from './HiddenInput';
import { Keyboard } from './Keyboard';
import { Results, type FinishedRun } from './Results';
import { useTypingSession, type TestConfig } from './useTypingSession';
import { WordStream } from './WordStream';

const CONFIGS = {
  t15: { kind: 'time', seconds: 15 },
  t30: { kind: 'time', seconds: 30 },
  t60: { kind: 'time', seconds: 60 },
  w10: { kind: 'words', count: 10 },
  w25: { kind: 'words', count: 25 },
  w50: { kind: 'words', count: 50 },
} as const satisfies Record<string, TestConfig>;
type ConfigKey = keyof typeof CONFIGS;

const label = (c: TestConfig) => (c.kind === 'time' ? `${c.seconds}s` : `${c.count} words`);
const TIER_COLORS = ['#c9d1e0', '#c9d1e0', '#22d3ee', '#fbbf24', '#f472b6'];

export function TypingScreen({ mode }: { mode: 'test' | 'drill' }) {
  const { data } = useApp();
  const lang = data.settings.language;
  const [cfgKey, setCfgKey] = useState<ConfigKey>('t30');
  const [run, setRun] = useState(0);
  const restart = useCallback(() => setRun((r) => r + 1), []);

  return (
    <section className={`typing-screen lang-${lang}`}>
      <div className="cfg-bar">
        {(Object.keys(CONFIGS) as ConfigKey[]).map((k) => (
          <button key={k} className={`chip${k === cfgKey ? ' chip-on' : ''}`} onClick={() => { setCfgKey(k); restart(); }}>
            {label(CONFIGS[k])}
          </button>
        ))}
      </div>
      <TypingRun key={`${mode}-${lang}-${cfgKey}-${run}`} mode={mode} lang={lang} config={CONFIGS[cfgKey]} onRestart={restart} />
    </section>
  );
}

function TypingRun({ mode, lang, config, onRestart }: { mode: 'test' | 'drill'; lang: Lang; config: TestConfig; onRestart(): void }) {
  const { data, commit, sound } = useApp();
  const fx = useFx();
  const dataRef = useRef(data);
  dataRef.current = data;
  const [weakness] = useState(() => weaknessMap(data.keyStats[lang]));
  const [targets] = useState(() => weakKeys(data.keyStats[lang]));
  const [mismatch, setMismatch] = useState(0);
  const [outcome, setOutcome] = useState<FinishedRun | null>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const comboRef = useRef<HTMLSpanElement>(null);
  const prevTier = useRef(0);
  const prevEvents = useRef(0);

  const session = useTypingSession({
    lang, mode, config, weakness,
    onFinish: (result, samples, activeMs) => {
      const out = applyTypingSession(dataRef.current, { mode, lang, result, samples, activeMs, now: new Date() });
      commit(out.data);
      const levelUp = out.levelAfter > out.levelBefore ? out.levelAfter : null;
      setOutcome({ result, xpGained: out.xpGained, personalBest: out.personalBest, levelUp, weak: weakKeys(out.data.keyStats[lang]) });
      if (levelUp !== null) { sound.levelUp(); fx.confetti(); }
      else if (out.personalBest) { sound.fanfare(); fx.confetti(); }
    },
  });

  const onChar = (ch: string) => {
    setMismatch((c) => updateMismatch(c, ch, lang));
    const next = session.type(ch);
    if (next.events.length === prevEvents.current) return; // ignored (e.g. double space)
    prevEvents.current = next.events.length;
    const ev = next.events[next.events.length - 1];
    if (ev.correct) {
      sound.click(next.combo);
    } else {
      sound.error();
      fx.shake(streamRef.current);
    }
    const tier = comboTier(next.combo);
    if (tier > prevTier.current && comboRef.current) {
      const b = comboRef.current.getBoundingClientRect();
      fx.burst(b.left + b.width / 2, b.top + b.height / 2, 20 + tier * 10, TIER_COLORS[tier]);
    }
    prevTier.current = tier;
  };

  if (outcome) return <Results {...outcome} onNext={onRestart} />;

  const s = session.state;
  const cur = s.words[s.wordIndex];
  const nextChar = cur ? (cur.typed.length < cur.target.length ? cur.target[cur.typed.length] : ' ') : null;
  const progress = config.kind === 'time'
    ? `${Math.max(0, Math.ceil(config.seconds - session.elapsedMs / 1000))}`
    : `${Math.min(s.wordIndex, config.count)}/${config.count}`;

  return (
    <>
      {mode === 'drill' && (
        <div className="drill-note">
          {targets.length
            ? <>Targeting your weak keys: {targets.map((k) => <kbd key={k}>{k}</kbd>)}</>
            : 'Not enough data yet. Finish a few tests first; using random words for now.'}
        </div>
      )}
      <div className="live-bar">
        <span className="timer">{progress}</span>
        <span>{Math.round(session.liveWpm)} wpm</span>
        <ComboMeter combo={s.combo} spanRef={comboRef} />
      </div>
      {mismatch >= 3 && (
        <div className="banner">Switch your input to {lang === 'th' ? 'Thai' : 'English'} (⌃Space)</div>
      )}
      <div ref={streamRef}>
        <WordStream state={s} />
      </div>
      <HiddenInput onChar={onChar} onBackspace={session.backspace} onTab={onRestart} />
      {data.settings.showKeyboard && <Keyboard lang={lang} nextChar={nextChar} />}
      <p className="hint">Start typing to begin · Tab restarts</p>
    </>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/ui/useTypingSession.ts src/ui/Results.tsx src/ui/TypingScreen.tsx
git commit -m "feat(ui): timed/word-count test and weak-key drill screens"
```

---

### Task 13: Arcade screen + renderer

**Files:**
- Create: `src/game/render.ts`, `src/ui/ArcadeScreen.tsx`

**Interfaces:**
- Consumes: Task 9 arcade API; `burst`, `stepParticles`, `drawParticles`, `particleCount`, `Particle` (Task 10); `applyArcadeSession` (Task 8); `activeTimeMs` (Task 7); `WORDS` (Task 3); `mulberry32` (Task 1); `useApp`, `useFx`, `HiddenInput` (Task 11)
- Produces:
  - `interface View { particles: Particle[]; lasers: { x: number; y: number; life: number }[]; banner: { text: string; sub: string; life: number } | null; shake: number; stars: { x: number; y: number; s: number }[] }`
  - `createView(): View`, `updateView(v: View, dt: number): void`, `render(g: CanvasRenderingContext2D, s: GameState, v: View): void`
  - `ArcadeScreen` props `{ onExit(): void }`

- [ ] **Step 1: Renderer** — `src/game/render.ts`

```ts
import { drawParticles, stepParticles, type Particle } from '../fx/particles';
import { HEIGHT, SHIP, WIDTH, type Enemy, type GameState } from './arcade';

export interface View {
  particles: Particle[];
  lasers: { x: number; y: number; life: number }[];
  banner: { text: string; sub: string; life: number } | null;
  shake: number;
  stars: { x: number; y: number; s: number }[];
}

export const LASER_LIFE = 0.12;
const FONT_STACK = '"JetBrains Mono", "Noto Sans Thai", monospace';

export function createView(): View {
  return {
    particles: [], lasers: [], banner: null, shake: 0,
    stars: Array.from({ length: 80 }, () => ({ x: Math.random() * WIDTH, y: Math.random() * HEIGHT, s: 1 + Math.random() * 2 })),
  };
}

export function updateView(v: View, dt: number): void {
  v.particles = stepParticles(v.particles, dt);
  v.lasers = v.lasers.map((l) => ({ ...l, life: l.life - dt })).filter((l) => l.life > 0);
  if (v.banner) { v.banner.life -= dt; if (v.banner.life <= 0) v.banner = null; }
  v.shake = Math.max(0, v.shake - dt);
  for (const st of v.stars) { st.y += st.s * 15 * dt; if (st.y > HEIGHT) st.y = 0; }
}

function drawWord(g: CanvasRenderingContext2D, e: Enemy, locked: boolean): void {
  const size = e.boss ? 26 : 20;
  g.font = `${size}px ${FONT_STACK}`;
  const text = e.word.join('');
  const w = g.measureText(text).width;
  const x = e.x - w / 2;
  g.fillStyle = locked ? 'rgba(34, 211, 238, 0.15)' : 'rgba(255, 255, 255, 0.05)';
  g.beginPath();
  g.roundRect(x - 8, e.y - size * 0.8, w + 16, size * 1.6, 8);
  g.fill();
  if (locked) { g.strokeStyle = '#22d3ee'; g.lineWidth = 1.5; g.stroke(); }
  g.fillStyle = e.boss ? '#fbbf24' : '#c9d1e0';
  g.fillText(text, x, e.y);
  if (e.typed > 0) {
    const pw = g.measureText(e.word.slice(0, e.typed).join('')).width;
    g.save();
    g.beginPath();
    g.rect(x, e.y - size, pw, size * 2);
    g.clip();
    g.fillStyle = '#22d3ee';
    g.fillText(text, x, e.y);
    g.restore();
  }
}

export function render(g: CanvasRenderingContext2D, s: GameState, v: View): void {
  g.save();
  g.fillStyle = '#0b0f1a';
  g.fillRect(0, 0, WIDTH, HEIGHT);
  if (v.shake > 0) g.translate((Math.random() - 0.5) * 30 * v.shake, (Math.random() - 0.5) * 30 * v.shake);

  g.fillStyle = '#2a3352';
  for (const st of v.stars) g.fillRect(st.x, st.y, st.s, st.s);

  g.textBaseline = 'middle';
  g.textAlign = 'left';
  for (const e of s.enemies) drawWord(g, e, e.id === s.lockId);

  g.lineWidth = 2;
  for (const l of v.lasers) {
    g.globalAlpha = l.life / LASER_LIFE;
    g.strokeStyle = '#22d3ee';
    g.beginPath();
    g.moveTo(SHIP.x, SHIP.y - 18);
    g.lineTo(l.x, l.y);
    g.stroke();
  }
  g.globalAlpha = 1;

  const target = s.enemies.find((e) => e.id === s.lockId);
  const angle = target ? Math.atan2(target.y - SHIP.y, target.x - SHIP.x) + Math.PI / 2 : 0;
  g.save();
  g.translate(SHIP.x, SHIP.y);
  g.rotate(angle);
  g.shadowColor = '#22d3ee';
  g.shadowBlur = 16;
  g.fillStyle = '#22d3ee';
  g.beginPath();
  g.moveTo(0, -18);
  g.lineTo(13, 14);
  g.lineTo(0, 8);
  g.lineTo(-13, 14);
  g.closePath();
  g.fill();
  g.restore();

  drawParticles(g, v.particles);
  g.restore();

  g.font = `18px ${FONT_STACK}`;
  g.textBaseline = 'top';
  g.fillStyle = '#c9d1e0';
  g.textAlign = 'left';
  g.fillText(`Score ${s.score}`, 16, 14);
  g.textAlign = 'center';
  g.fillText(`Wave ${s.wave}`, WIDTH / 2, 14);
  g.textAlign = 'right';
  g.fillStyle = '#f472b6';
  g.fillText('♥'.repeat(Math.max(0, s.lives)), WIDTH - 16, 14);
  if (s.multiplier > 1) {
    g.fillStyle = '#fbbf24';
    g.fillText(`×${s.multiplier}`, WIDTH - 16, 40);
  }

  if (v.banner) {
    g.globalAlpha = Math.min(1, v.banner.life);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = '#22d3ee';
    g.font = `bold 36px ${FONT_STACK}`;
    g.fillText(v.banner.text, WIDTH / 2, HEIGHT / 2 - 20);
    g.fillStyle = '#c9d1e0';
    g.font = `18px ${FONT_STACK}`;
    g.fillText(v.banner.sub, WIDTH / 2, HEIGHT / 2 + 20);
    g.globalAlpha = 1;
  }
}
```

- [ ] **Step 2: Arcade screen** — `src/ui/ArcadeScreen.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import type { Lang } from '../engine/keyboard';
import { activeTimeMs } from '../engine/progress';
import { mulberry32 } from '../engine/rng';
import { burst, particleCount } from '../fx/particles';
import { drainEvents, HEIGHT, newGame, release, SHIP, step, typeKey, WIDTH, type GameEvent, type WordSource } from '../game/arcade';
import { createView, LASER_LIFE, render, updateView } from '../game/render';
import { applyArcadeSession } from '../store/session';
import { WORDS } from '../data/words';
import { useApp } from './AppContext';
import { useFx } from './FxLayer';
import { HiddenInput } from './HiddenInput';

interface GameOver { score: number; wave: number; xp: number; high: boolean }

export function ArcadeScreen({ onExit }: { onExit(): void }) {
  const { data } = useApp();
  const lang = data.settings.language;
  const [run, setRun] = useState(0);
  return <ArcadeRun key={`${lang}-${run}`} lang={lang} onAgain={() => setRun((r) => r + 1)} onExit={onExit} />;
}

function ArcadeRun({ lang, onAgain, onExit }: { lang: Lang; onAgain(): void; onExit(): void }) {
  const app = useApp();
  const fx = useFx();
  const appRef = useRef(app);
  appRef.current = app;
  const fxRef = useRef(fx);
  fxRef.current = fx;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const game = useRef(newGame());
  const src = useRef<WordSource>({ words: WORDS[lang], rng: mulberry32(Date.now() >>> 0) });
  const view = useRef(createView());
  const keyTimes = useRef<number[]>([]);
  const [started, setStarted] = useState(false);
  const [focused, setFocused] = useState(true);
  const [over, setOver] = useState<GameOver | null>(null);
  const runningRef = useRef(false);
  runningRef.current = started && focused && !over;

  useEffect(() => {
    const handle = (ev: GameEvent) => {
      const { sound, intensity } = appRef.current;
      const v = view.current;
      switch (ev.type) {
        case 'hit':
          v.lasers.push({ x: ev.x, y: ev.y, life: LASER_LIFE });
          sound.laser();
          break;
        case 'destroy':
          v.particles.push(...burst(ev.x, ev.y, particleCount(ev.boss ? 80 : 26, intensity), ev.boss ? '#fbbf24' : '#22d3ee'));
          sound.explosion();
          break;
        case 'miss':
          sound.error();
          break;
        case 'damage':
          if (intensity !== 'off') v.shake = intensity === 'full' ? 0.4 : 0.15;
          v.particles.push(...burst(SHIP.x, SHIP.y, particleCount(30, intensity), '#f472b6'));
          sound.error();
          break;
        case 'waveEnd':
          v.banner = {
            text: `Wave ${ev.wave} cleared!`,
            sub: `${ev.wpm} WPM${ev.bonus ? `  ·  +${ev.bonus} no-damage bonus` : ''}`,
            life: 2.5,
          };
          sound.fanfare();
          break;
        case 'gameOver': {
          const g = game.current;
          const minutes = g.time / 60;
          const out = applyArcadeSession(appRef.current.data, {
            lang,
            score: g.score,
            wpm: minutes > 0 ? g.correctChars / 5 / minutes : 0,
            acc: g.keystrokes ? g.correctKeystrokes / g.keystrokes : 0,
            durationMs: g.time * 1000,
            activeMs: activeTimeMs(keyTimes.current),
            now: new Date(),
          });
          appRef.current.commit(out.data);
          setOver({ score: g.score, wave: g.wave, xp: out.xpGained, high: out.highScore });
          if (out.highScore || out.levelAfter > out.levelBefore) { sound.fanfare(); fxRef.current.confetti(); }
          break;
        }
        case 'lock':
          break;
      }
    };

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const STEP = 1 / 60;
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;
      if (runningRef.current) {
        acc += dt;
        while (acc >= STEP) { step(game.current, STEP, src.current); acc -= STEP; }
      } else {
        acc = 0;
      }
      drainEvents(game.current).forEach(handle);
      updateView(view.current, dt);
      const g = canvasRef.current?.getContext('2d');
      if (g) render(g, game.current, view.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [lang]);

  useEffect(() => {
    if (!over) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Enter') onAgain(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [over, onAgain]);

  const onChar = (ch: string) => {
    if (!started) { setStarted(true); return; }
    if (over) return;
    keyTimes.current.push(performance.now());
    typeKey(game.current, ch);
  };

  return (
    <section className={`arcade lang-${lang}`}>
      <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} />
      {!over && <HiddenInput onChar={onChar} onEscape={() => release(game.current)} onFocusChange={setFocused} />}
      {!started && (
        <div className="card overlay-card">
          <h2>Word Defense</h2>
          <p className="muted">Type the falling words before they reach your ship.<br />Esc drops your target.</p>
          <p>Press any letter to start</p>
        </div>
      )}
      {over && (
        <div className="card overlay-card">
          <h2>Game over</h2>
          {over.high && <div className="pb">🏆 New high score!</div>}
          <div className="big">{over.score}</div>
          <p className="muted">Reached wave {over.wave} · +{over.xp} XP · Best {app.data.arcadeHigh[lang]}</p>
          <button onClick={onAgain}>Play again (Enter)</button>{' '}
          <button onClick={onExit}>Home</button>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/game/render.ts src/ui/ArcadeScreen.tsx
git commit -m "feat(ui): Word Defense arcade screen and canvas renderer"
```

---

### Task 14: Home, Stats, Settings, top bar, app shell

**Files:**
- Create: `src/ui/LineChart.tsx`, `src/ui/StatsScreen.tsx`, `src/ui/HomeScreen.tsx`, `src/ui/SettingsScreen.tsx`, `src/ui/TopBar.tsx`, `src/ui/App.tsx`, `src/main.tsx`

**Interfaces:**
- Consumes: everything above; `bestWpm` (Task 8); `errorRates` (Task 5); `levelInfo`, `computeStreak`, `dateKey` (Task 7); `defaultData`, `Settings`, `SessionRecord` (Task 8)
- Produces: `type Screen = 'home' | 'test' | 'drill' | 'arcade' | 'stats' | 'settings'`; the default `App` component

- [ ] **Step 1: Line chart** — `src/ui/LineChart.tsx`

```tsx
import type { SessionRecord } from '../store/storage';

const W = 600, H = 220, PAD = 30;

export function LineChart({ sessions }: { sessions: SessionRecord[] }) {
  if (sessions.length < 2) {
    return <p className="muted">Finish a couple of tests to see your progress chart.</p>;
  }
  const maxWpm = Math.max(20, Math.ceil(Math.max(...sessions.map((s) => s.wpm)) / 20) * 20);
  const x = (i: number) => PAD + (i / (sessions.length - 1)) * (W - PAD * 2);
  const yW = (v: number) => H - PAD - (v / maxWpm) * (H - PAD * 2);
  const yA = (v: number) => H - PAD - v * (H - PAD * 2);
  const wpmPts = sessions.map((s, i) => `${x(i)},${yW(s.wpm)}`).join(' ');
  const accPts = sessions.map((s, i) => `${x(i)},${yA(s.acc)}`).join(' ');
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="WPM and accuracy over time">
      {[0, 0.5, 1].map((f) => (
        <g key={f}>
          <line x1={PAD} x2={W - PAD} y1={yA(f)} y2={yA(f)} stroke="#243050" />
          <text x={4} y={yA(f) + 4} fill="#6b7799" fontSize="11">{Math.round(maxWpm * f)}</text>
        </g>
      ))}
      <polyline points={accPts} fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeDasharray="4 4" />
      <polyline points={wpmPts} fill="none" stroke="#22d3ee" strokeWidth="2.5" />
      {sessions.map((s, i) => <circle key={i} cx={x(i)} cy={yW(s.wpm)} r="3" fill="#22d3ee" />)}
      <text x={W - PAD} y={16} textAnchor="end" fontSize="12" fill="#22d3ee">— WPM</text>
      <text x={W - PAD} y={32} textAnchor="end" fontSize="12" fill="#fbbf24">- - accuracy</text>
    </svg>
  );
}
```

- [ ] **Step 2: Stats screen** — `src/ui/StatsScreen.tsx`

```tsx
import { useMemo } from 'react';
import { errorRates } from '../engine/keystats';
import { bestWpm } from '../store/session';
import { useApp } from './AppContext';
import { Keyboard } from './Keyboard';
import { LineChart } from './LineChart';

export function StatsScreen() {
  const { data } = useApp();
  const lang = data.settings.language;
  const sessions = data.sessions.filter((s) => s.lang === lang && s.mode !== 'arcade').slice(-50);
  const heat = useMemo(() => errorRates(data.keyStats[lang]), [data.keyStats, lang]);
  const hasHeat = Object.keys(heat).length > 0;

  return (
    <section className={`stats-page lang-${lang}`}>
      <div className="card">
        <h2>Progress ({lang === 'th' ? 'Thai' : 'English'})</h2>
        <LineChart sessions={sessions} />
      </div>
      <div className="card">
        <h2>Personal bests</h2>
        <div className="stats-row">
          <div className="stat"><div className="label">test</div><div className="value">{Math.round(bestWpm(data, 'test', lang))} wpm</div></div>
          <div className="stat"><div className="label">drill</div><div className="value">{Math.round(bestWpm(data, 'drill', lang))} wpm</div></div>
          <div className="stat"><div className="label">arcade</div><div className="value">{data.arcadeHigh[lang]}</div></div>
          <div className="stat"><div className="label">sessions</div><div className="value">{data.sessions.filter((s) => s.lang === lang).length}</div></div>
        </div>
      </div>
      <div className="card">
        <h2>Key error heatmap</h2>
        {hasHeat
          ? <Keyboard lang={lang} heat={heat} />
          : <p className="muted">Each key needs at least 10 presses before it shows up here.</p>}
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Home screen** — `src/ui/HomeScreen.tsx`

```tsx
import { dateKey } from '../engine/progress';
import { useApp } from './AppContext';
import type { Screen } from './App';

const R = 52, C = 2 * Math.PI * R;

export function HomeScreen({ onNav }: { onNav(s: Screen): void }) {
  const { data } = useApp();
  const goalMs = data.settings.dailyGoalMin * 60000;
  const todayMs = data.daily[dateKey(new Date())]?.activeMs ?? 0;
  const pct = Math.min(1, todayMs / goalMs);
  const recent = data.sessions.slice(-5).reverse();

  return (
    <div className="home-grid">
      <div className="card ring-wrap">
        <svg width="140" height="140" viewBox="0 0 140 140" aria-label="Daily goal progress">
          <circle cx="70" cy="70" r={R} stroke="#243050" strokeWidth="12" fill="none" />
          <circle
            cx="70" cy="70" r={R} stroke={pct >= 1 ? '#fbbf24' : '#22d3ee'} strokeWidth="12" fill="none"
            strokeDasharray={C} strokeDashoffset={C * (1 - pct)} strokeLinecap="round" transform="rotate(-90 70 70)"
          />
          <text x="70" y="76" textAnchor="middle" fill="#c9d1e0" fontSize="22" fontWeight="700">{Math.round(pct * 100)}%</text>
        </svg>
        <div>{(todayMs / 60000).toFixed(1)} / {data.settings.dailyGoalMin} min today</div>
        <div className="muted">{pct >= 1 ? 'Goal done. Streak safe 🔥' : 'Hit your goal to keep the streak'}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div className="modes">
          <button className="mode-card" onClick={() => onNav('test')}><h3>Test</h3><p>Timed or word-count runs with combos</p></button>
          <button className="mode-card" onClick={() => onNav('drill')}><h3>Drill</h3><p>Words built around your weakest keys</p></button>
          <button className="mode-card" onClick={() => onNav('arcade')}><h3>Arcade</h3><p>Blast falling words before they hit you</p></button>
        </div>
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Recent</h3>
          {recent.length === 0 ? (
            <p className="muted">No sessions yet. Pick a mode above.</p>
          ) : (
            <ul className="recent">
              {recent.map((s) => (
                <li key={s.ts}>
                  <span>{s.mode} · {s.lang.toUpperCase()}</span>
                  <span>{Math.round(s.wpm)} wpm · {Math.round(s.acc * 100)}%</span>
                  <span className="muted">{new Date(s.ts).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Settings screen** — `src/ui/SettingsScreen.tsx`

```tsx
import { defaultData, type FxIntensity, type Settings } from '../store/storage';
import { useApp } from './AppContext';

const FX: FxIntensity[] = ['off', 'subtle', 'full'];

export function SettingsScreen() {
  const { data, commit, intensity } = useApp();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => commit({ ...data, settings: { ...s, ...patch } });

  return (
    <section className="settings card">
      <h2 style={{ margin: 0 }}>Settings</h2>
      <label className="setting">Sound
        <button onClick={() => set({ sound: !s.sound })}>{s.sound ? 'On' : 'Off'}</button>
      </label>
      <div className="setting">Effects
        <div className="nav">
          {FX.map((f) => (
            <button key={f} className={f === s.fxIntensity ? 'chip chip-on' : 'chip'} onClick={() => set({ fxIntensity: f })}>{f}</button>
          ))}
        </div>
      </div>
      {intensity === 'off' && s.fxIntensity !== 'off' && (
        <p className="muted">Your system's Reduce Motion setting is on, so effects stay off.</p>
      )}
      <label className="setting">Daily goal (minutes)
        <input
          type="number" min={1} max={120} value={s.dailyGoalMin}
          onChange={(e) => {
            const v = Math.round(Number(e.target.value));
            if (Number.isFinite(v)) set({ dailyGoalMin: Math.min(120, Math.max(1, v)) });
          }}
        />
      </label>
      <label className="setting">On-screen keyboard
        <button onClick={() => set({ showKeyboard: !s.showKeyboard })}>{s.showKeyboard ? 'Shown' : 'Hidden'}</button>
      </label>
      <div className="setting">Reset progress
        <button
          className="danger"
          onClick={() => {
            if (window.confirm('Erase all progress (XP, history, key stats, streak)? Settings are kept. This cannot be undone.')) {
              commit({ ...defaultData(), settings: s });
            }
          }}
        >Reset</button>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Top bar** — `src/ui/TopBar.tsx`

```tsx
import type { Lang } from '../engine/keyboard';
import { computeStreak, levelInfo } from '../engine/progress';
import { useApp } from './AppContext';
import type { Screen } from './App';

const NAV: [Screen, string][] = [['test', 'Test'], ['drill', 'Drill'], ['arcade', 'Arcade'], ['stats', 'Stats'], ['settings', 'Settings']];

export function TopBar({ screen, onNav }: { screen: Screen; onNav(s: Screen): void }) {
  const { data, commit } = useApp();
  const lv = levelInfo(data.xp);
  const streak = computeStreak(data.daily, data.settings.dailyGoalMin * 60000, new Date());
  const setLang = (language: Lang) => commit({ ...data, settings: { ...data.settings, language } });

  return (
    <header className="topbar">
      <button className="brand" onClick={() => onNav('home')}>⌨ Type<span>Rush</span></button>
      <nav className="nav">
        {NAV.map(([id, label]) => (
          <button key={id} className={screen === id ? 'on' : ''} onClick={() => onNav(id)}>{label}</button>
        ))}
      </nav>
      <div className="spacer" />
      <div className="lang-toggle" role="group" aria-label="Language">
        {(['en', 'th'] as const).map((l) => (
          <button key={l} className={data.settings.language === l ? 'on' : ''} onClick={() => setLang(l)}>{l.toUpperCase()}</button>
        ))}
      </div>
      <div className="level" title={`${lv.intoLevel} / ${lv.needed} XP`}>
        Lv {lv.level}
        <div className="xpbar"><div style={{ width: `${(lv.intoLevel / lv.needed) * 100}%` }} /></div>
      </div>
      <div className="streak" title="Day streak">🔥 {streak}</div>
    </header>
  );
}
```

- [ ] **Step 6: App shell and entry**

`src/ui/App.tsx`:
```tsx
import { useState } from 'react';
import { AppProvider } from './AppContext';
import { ArcadeScreen } from './ArcadeScreen';
import { FxLayer } from './FxLayer';
import { HomeScreen } from './HomeScreen';
import { SettingsScreen } from './SettingsScreen';
import { StatsScreen } from './StatsScreen';
import { TopBar } from './TopBar';
import { TypingScreen } from './TypingScreen';

export type Screen = 'home' | 'test' | 'drill' | 'arcade' | 'stats' | 'settings';

function Shell() {
  const [screen, setScreen] = useState<Screen>('home');
  return (
    <div className="app">
      <TopBar screen={screen} onNav={setScreen} />
      <main>
        {screen === 'home' && <HomeScreen onNav={setScreen} />}
        {screen === 'test' && <TypingScreen key="test" mode="test" />}
        {screen === 'drill' && <TypingScreen key="drill" mode="drill" />}
        {screen === 'arcade' && <ArcadeScreen onExit={() => setScreen('home')} />}
        {screen === 'stats' && <StatsScreen />}
        {screen === 'settings' && <SettingsScreen />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <FxLayer>
        <Shell />
      </FxLayer>
    </AppProvider>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import './ui/theme.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Typecheck, test and build**

Run: `npx tsc && npx vitest run && npx vite build`
Expected: no type errors, all tests pass, build writes `dist/`.

- [ ] **Step 8: Commit**

```bash
git add src/ui src/main.tsx
git commit -m "feat(ui): home, stats, settings, top bar and app shell"
```

---

### Task 15: Manual verification in a real browser

**Files:** none (fix anything found, with its own commit)

- [ ] **Step 1: Start the app**

Run: `npm run dev` and open the printed URL (usually `http://localhost:5173`).

- [ ] **Step 2: English checks**
  - Home shows the goal ring at 0%, three mode cards, and "No sessions yet".
  - Test 15s: typing starts the timer; correct chars turn cyan with a pop; a wrong char turns magenta, shakes the line and plays a thud; combo appears and changes color at 10/25; the on-screen key for the next char glows. When time runs out, the results card counts up and shows WPM, accuracy and XP; the first run shows "New personal best" with confetti.
  - Double space does nothing. Backspace fixes the current word but cannot go back into the previous word. Tab restarts.
  - Word mode (10 words) ends exactly when the last word is typed correctly.
  - Clicking outside shows "Click here to keep typing"; clicking resumes.
- [ ] **Step 3: Thai checks** (System Settings → Keyboard → Input Sources → add **Thai**, switch with ⌃Space)
  - Toggle TH in the top bar. Words render with vowels and tone marks attached (no dotted circles in the text stream). Typing `ที่` key by key underlines the partial cluster, then turns it cyan.
  - With the English input source still active, typing 3 letters shows "Switch your input to Thai (⌃Space)"; switching to Thai and typing hides it.
  - The on-screen keyboard shows Kedmanee and highlights shift for shifted characters (e.g. `ฎ`).
- [ ] **Step 4: Drill, Arcade, Stats, Settings**
  - Drill with no history shows the "Not enough data yet" note. After two or three 60s tests it lists weak keys.
  - Arcade: any letter starts it; words fall; typing locks on and fires lasers; finished words explode; a word reaching the ship costs a heart and shakes the screen; the "Wave cleared" banner appears; wave 5 has an amber boss phrase that drops small words; game over shows score/high score; Enter plays again. Clicking outside pauses the game.
  - Stats shows the chart after two or more sessions, personal bests, and the heatmap once keys have 10+ presses.
  - Settings: sound off silences everything; Effects Off removes pops, shakes and particles; setting the goal to 1 minute and typing for a minute fills the ring and makes the streak 🔥 1; Reset (after the confirmation) clears progress but keeps settings.
  - Reload the page: progress persists.
- [ ] **Step 5: Final checks and commit fixes**

Run: `npx tsc && npx vitest run`
Expected: clean. Commit any fixes made during this task with a message describing each fix.
