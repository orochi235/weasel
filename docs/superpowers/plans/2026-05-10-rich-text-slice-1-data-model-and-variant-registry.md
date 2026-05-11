# Rich Text — Slice 1: Data Model + Variant Registry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lay the foundation for rich text in the MSDF pipeline: a canonical `StyledRun` data model, a variant-aware font registry, and `TextPose.runs?` plumbing. No visible behavior change for nodes that don't opt in; nodes with `style.fontWeight: 700` and a registered bold atlas paint bold for the first time.

**Architecture:** New `src/features/text/runs.ts` owns the `StyledRun` type and serialization. `registerFont` becomes variant-aware (keyed by `(family, weight, style)`) with a `resolveFontVariant` fallback chain. `drawText` resolves a single variant per text command from the node's resolved style. `TextPose` gains an optional `runs?` field that is accepted, validated, and persisted, but in this slice still renders via the node-level single style — per-run variant switching lands in Slice 2.

**Tech Stack:** TypeScript, Vitest, WebGL2 (MSDF text), path-mapped imports (`features/text/...`).

---

## File map

- **Create:** `src/features/text/runs.ts` — `StyledRun`, `toRuns`, `runsToPlainText`, `runsToMarkdown`, `markdownToRuns`.
- **Create:** `src/features/text/runs.test.ts`.
- **Modify:** `src/features/text/markdownText.ts` — drop local `StyledRun`, drop `parseMarkdownRuns` (replaced by `markdownToRuns`), drop `DEFAULT_SIZE_STEP` and bracket markup, drop `sizeFactor` handling from `layoutMarkdown` and `createMarkdownRenderer`.
- **Modify:** `src/features/text/markdownText.test.ts` — delete bracket-size tests; update existing tests to new `StyledRun` shape (optional fields, no `sizeFactor`).
- **Modify:** `src/features/text/atlas/registerFont.ts` — new signature `registerFont(family, variant, metricsUrl, atlasUrl)`; two-level map; `resolveFontVariant`; `ensureFontTexture` variant-keyed.
- **Modify:** `src/features/text/atlas/registerFont.test.ts` — variant key tests + fallback chain tests.
- **Modify:** `src/renderer/draw.ts` — `drawText` uses `resolveFontVariant` from node style's weight + style.
- **Modify:** `src/renderer/draw.test.ts` — pass `{}` variant to existing `registerFont` calls.
- **Modify:** `src/features/text/textLayer.ts` — `TextPose.runs?: StyledRun[]` field; runs validated in dev when present.
- **Modify:** `src/features/text/index.ts` — export `StyledRun`, `toRuns`, `runsToPlainText`, `runsToMarkdown`, `markdownToRuns` from `./runs`; remove re-export of removed names.

---

## Task 1: `runs.ts` — `StyledRun` type, `toRuns`, `runsToPlainText`

**Files:**
- Create: `src/features/text/runs.ts`
- Create: `src/features/text/runs.test.ts`

- [ ] **Step 1.1: Write failing tests**

Create `src/features/text/runs.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { toRuns, runsToPlainText, type StyledRun } from './runs';

describe('toRuns', () => {
  it('wraps a string into a single run', () => {
    expect(toRuns('hello')).toEqual([{ text: 'hello' }]);
  });

  it('preserves newlines in the string form', () => {
    expect(toRuns('a\nb')).toEqual([{ text: 'a\nb' }]);
  });

  it('returns an empty array for an empty string', () => {
    expect(toRuns('')).toEqual([]);
  });

  it('passes an existing StyledRun[] through unchanged', () => {
    const runs: StyledRun[] = [
      { text: 'a' },
      { text: 'b', bold: true },
      { text: 'c', italic: true, fontSize: 20 },
    ];
    expect(toRuns(runs)).toEqual(runs);
  });

  it('throws when a run lacks a string text field', () => {
    expect(() => toRuns([{ text: 42 } as unknown as StyledRun])).toThrow(/text/);
  });
});

describe('runsToPlainText', () => {
  it('concatenates run text fields', () => {
    expect(runsToPlainText([{ text: 'a' }, { text: 'b', bold: true }])).toBe('ab');
  });

  it('returns empty string for empty array', () => {
    expect(runsToPlainText([])).toBe('');
  });

  it('preserves embedded newlines', () => {
    expect(runsToPlainText([{ text: 'a\n', bold: true }, { text: 'b' }])).toBe('a\nb');
  });
});
```

- [ ] **Step 1.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: failures on missing module `./runs`.

- [ ] **Step 1.3: Implement `runs.ts`**

Create `src/features/text/runs.ts`:

```ts
/**
 * Canonical inline-styling primitive for text nodes. A node's text is
 * either a plain `string` (treated as a single-run, default-styled fragment)
 * or `StyledRun[]` for rich content. `toRuns` is the funnel that normalizes
 * either form into the array shape used by the renderer.
 *
 * Every field except `text` is optional; missing fields fall back to the
 * node-level `TextStyle`. `bold`/`italic` are toggles; richer weight axes
 * (300/500/900) are out of scope for slice 1.
 */

import type { Paint } from 'core/paint-types';

export interface StyledRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  fontFamily?: string;
  fontSize?: number;
  fill?: Paint;
}

export function toRuns(input: string | StyledRun[]): StyledRun[] {
  if (typeof input === 'string') {
    return input.length === 0 ? [] : [{ text: input }];
  }
  for (let i = 0; i < input.length; i++) {
    const r = input[i];
    if (typeof r?.text !== 'string') {
      throw new Error(`toRuns: run at index ${i} is missing string \`text\``);
    }
  }
  return input;
}

export function runsToPlainText(runs: readonly StyledRun[]): string {
  let out = '';
  for (const r of runs) out += r.text;
  return out;
}
```

- [ ] **Step 1.4: Verify tests pass**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: PASS, all 8 tests.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/text/runs.ts src/features/text/runs.test.ts
git commit -m "feat(text): add StyledRun + toRuns + runsToPlainText"
```

---

## Task 2: `runsToMarkdown` serializer

**Files:**
- Modify: `src/features/text/runs.ts`
- Modify: `src/features/text/runs.test.ts`

- [ ] **Step 2.1: Write failing tests**

Append to `src/features/text/runs.test.ts`:

```ts
import { runsToMarkdown } from './runs';

describe('runsToMarkdown', () => {
  it('returns plain text unchanged when no run is styled', () => {
    expect(runsToMarkdown([{ text: 'hello world' }])).toBe('hello world');
  });

  it('wraps a bold run in **', () => {
    expect(runsToMarkdown([{ text: 'bold', bold: true }])).toBe('**bold**');
  });

  it('wraps an italic run in *', () => {
    expect(runsToMarkdown([{ text: 'em', italic: true }])).toBe('*em*');
  });

  it('wraps a bold-italic run in ***', () => {
    expect(runsToMarkdown([{ text: 'both', bold: true, italic: true }])).toBe('***both***');
  });

  it('joins adjacent runs without separators', () => {
    expect(
      runsToMarkdown([
        { text: 'a ' },
        { text: 'b', bold: true },
        { text: ' c' },
      ]),
    ).toBe('a **b** c');
  });

  it('escapes literal asterisks in plain text', () => {
    expect(runsToMarkdown([{ text: 'a*b' }])).toBe('a\\*b');
  });
});
```

- [ ] **Step 2.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: failures on missing `runsToMarkdown`.

- [ ] **Step 2.3: Implement `runsToMarkdown`**

Append to `src/features/text/runs.ts`:

```ts
function escapeMarkdown(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/\*/g, '\\*');
}

export function runsToMarkdown(runs: readonly StyledRun[]): string {
  let out = '';
  for (const r of runs) {
    const escaped = escapeMarkdown(r.text);
    if (r.bold && r.italic) out += `***${escaped}***`;
    else if (r.bold) out += `**${escaped}**`;
    else if (r.italic) out += `*${escaped}*`;
    else out += escaped;
  }
  return out;
}
```

- [ ] **Step 2.4: Verify tests pass**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: PASS, all tests in the file.

- [ ] **Step 2.5: Commit**

```bash
git add src/features/text/runs.ts src/features/text/runs.test.ts
git commit -m "feat(text): add runsToMarkdown serializer"
```

---

## Task 3: `markdownToRuns` parser

**Files:**
- Modify: `src/features/text/runs.ts`
- Modify: `src/features/text/runs.test.ts`

- [ ] **Step 3.1: Write failing tests**

Append to `src/features/text/runs.test.ts`:

```ts
import { markdownToRuns } from './runs';

describe('markdownToRuns', () => {
  it('returns a single plain run for unstyled text', () => {
    expect(markdownToRuns('hello')).toEqual([{ text: 'hello' }]);
  });

  it('parses **bold**', () => {
    expect(markdownToRuns('**bold**')).toEqual([{ text: 'bold', bold: true }]);
  });

  it('parses *italic*', () => {
    expect(markdownToRuns('*italic*')).toEqual([{ text: 'italic', italic: true }]);
  });

  it('parses ***bold italic***', () => {
    expect(markdownToRuns('***both***')).toEqual([{ text: 'both', bold: true, italic: true }]);
  });

  it('parses mixed inline styles', () => {
    expect(markdownToRuns('a **b** c')).toEqual([
      { text: 'a ' },
      { text: 'b', bold: true },
      { text: ' c' },
    ]);
  });

  it('parses bold containing italic', () => {
    expect(markdownToRuns('**a *b* c**')).toEqual([
      { text: 'a ', bold: true },
      { text: 'b', bold: true, italic: true },
      { text: ' c', bold: true },
    ]);
  });

  it('preserves embedded newlines inside a run (does not split)', () => {
    expect(markdownToRuns('a\nb')).toEqual([{ text: 'a\nb' }]);
  });

  it('honors backslash escapes for asterisks', () => {
    expect(markdownToRuns('a\\*b')).toEqual([{ text: 'a*b' }]);
  });

  it('round-trips plain → md → runs → md', () => {
    const md = '**hello** *world*';
    expect(runsToMarkdown(markdownToRuns(md))).toBe(md);
  });
});
```

- [ ] **Step 3.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: failures on missing `markdownToRuns`.

- [ ] **Step 3.3: Implement `markdownToRuns`**

Append to `src/features/text/runs.ts`:

```ts
/**
 * Parse a small markdown subset (`**bold**`, `*italic*`, `***both***`) into
 * styled runs. Backslash escapes `\*` and `\\`. Newlines are preserved as
 * literal characters inside a run — they're not run-boundary markers in
 * this format.
 */
export function markdownToRuns(input: string): StyledRun[] {
  const runs: StyledRun[] = [];
  let bold = false;
  let italic = false;
  let buf = '';
  let i = 0;

  function flush(): void {
    if (buf.length === 0) return;
    const run: StyledRun = { text: buf };
    if (bold) run.bold = true;
    if (italic) run.italic = true;
    runs.push(run);
    buf = '';
  }

  while (i < input.length) {
    const ch = input[i];

    if (ch === '\\' && i + 1 < input.length && '*\\'.includes(input[i + 1])) {
      buf += input[i + 1];
      i += 2;
      continue;
    }

    if (ch === '*') {
      let count = 0;
      while (i + count < input.length && input[i + count] === '*') count++;
      flush();
      if (count >= 3) {
        bold = !bold;
        italic = !italic;
        i += 3;
      } else if (count === 2) {
        bold = !bold;
        i += 2;
      } else {
        italic = !italic;
        i += 1;
      }
      continue;
    }

    buf += ch;
    i++;
  }

  flush();
  return runs;
}
```

- [ ] **Step 3.4: Verify tests pass**

Run: `npx vitest run src/features/text/runs.test.ts`

Expected: PASS, all tests in the file.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/text/runs.ts src/features/text/runs.test.ts
git commit -m "feat(text): add markdownToRuns parser"
```

---

## Task 4: Retire `parseMarkdownRuns`; migrate `markdownText.ts` to the new shape

This is the disruptive task. We drop `sizeFactor` and bracket markup from the canvas2d markdown path so the codebase has a single `StyledRun` shape.

**Files:**
- Modify: `src/features/text/markdownText.ts`
- Modify: `src/features/text/markdownText.test.ts`
- Modify: `src/features/text/index.ts`

- [ ] **Step 4.1: Update `markdownText.test.ts` to the new shape**

Replace all expected-value `{ text, bold, italic, sizeFactor }` with the new shape: omit `sizeFactor` entirely, and omit `bold`/`italic` when `false` (since they're optional now). Delete all bracket-markup tests entirely. Delete the `STEP`, `UP`, `DOWN`, and `DEFAULT_SIZE_STEP` imports/constants.

Example transformation — replace this block:

```ts
expect(parseMarkdownRuns('hello')).toEqual([
  { text: 'hello', bold: false, italic: false, sizeFactor: 1 },
]);
```

with:

```ts
expect(markdownToRuns('hello')).toEqual([{ text: 'hello' }]);
```

And change the import line from:

```ts
import { createMarkdownRenderer, parseMarkdownRuns, layoutMarkdown, DEFAULT_SIZE_STEP } from './markdownText';
```

to:

```ts
import { createMarkdownRenderer, layoutMarkdown } from './markdownText';
import { markdownToRuns } from './runs';
```

Delete every test inside `describe('parseMarkdownRuns', ...)` that exercises bracket markup (`[big]`, `(small)`, nested sizes). The bold/italic/newline/escape tests remain, but they live under `describe('markdownToRuns', ...)` in `runs.test.ts` now — *delete the entire `describe('parseMarkdownRuns', ...)` block from this file*; it's redundant.

For the `layoutMarkdown` tests in this file, replace any `sizeFactor: 1.15` etc. in fixtures with explicit `fontSize: <number>` if the test needs varying sizes; otherwise drop the size variation entirely. (Most existing `layoutMarkdown` tests use the default `sizeFactor: 1` — those just need the `sizeFactor` field removed from the fixture.)

For the `createMarkdownRenderer` tests, drop any `sizeStep` option assertions; the option no longer exists.

- [ ] **Step 4.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/markdownText.test.ts`

Expected: failures on missing `parseMarkdownRuns` export (or shape mismatches) — the test file is now ahead of the implementation.

- [ ] **Step 4.3: Rewrite `markdownText.ts` to use `markdownToRuns` and the new shape**

Open `src/features/text/markdownText.ts`. Make these changes:

**(a)** Replace the local `StyledRun` interface at the top with a re-export from `./runs`:

```ts
import { markdownToRuns, type StyledRun } from './runs';

export type { StyledRun };
```

**(b)** Delete the entire `parseMarkdownRuns` function (it's been replaced by `markdownToRuns`).

**(c)** Delete the `DEFAULT_SIZE_STEP` export and the `ParseMarkdownRunsOptions` interface.

**(d)** Update `PositionedRun` to extend the new optional-fields shape:

```ts
export interface PositionedRun extends StyledRun {
  x: number;
}
```

**(e)** Update `layoutMarkdown` to remove `sizeFactor` math. In the current implementation, replace this block:

```ts
const effectiveSize = fontSize * run.sizeFactor;
lineMaxSize = Math.max(lineMaxSize, effectiveSize);
```

with:

```ts
const effectiveSize = run.fontSize ?? fontSize;
lineMaxSize = Math.max(lineMaxSize, effectiveSize);
```

Search the rest of `layoutMarkdown` for any other `run.sizeFactor` references and replace each with `(run.fontSize ?? fontSize)`. Update the `MeasureFn` signature comments if they mentioned `sizeFactor` — but the signature itself doesn't change (it already takes `fontSize` directly).

**(f)** In `createMarkdownRenderer`, remove the `sizeStep` field from `MarkdownFontOptions` and remove its use in the call to the parser. Replace:

```ts
const parsed = parseMarkdownRuns(text, { sizeStep: fontOpts.sizeStep });
```

with:

```ts
const parsed = markdownToRuns(text);
```

Search `markdownText.ts` for any remaining references to `sizeFactor` or `sizeStep` and remove them. Each run's effective size is now `run.fontSize ?? fontSize`.

**(g)** Inside the renderer closure (`renderer:`), replace the `effSize` computation:

```ts
const effSize = fontSize * run.sizeFactor;
```

with:

```ts
const effSize = run.fontSize ?? fontSize;
```

Apply the same change to the `strokeRenderer` closure if present.

- [ ] **Step 4.4: Update `src/features/text/index.ts`**

Replace the line `export * from './markdownText';` if it's there with explicit named exports, and add `runs` exports. The target shape:

```ts
export * from './renderLabel';
export { createMarkdownRenderer, layoutMarkdown } from './markdownText';
export type { MarkdownFontOptions, MeasureFn, PositionedRun, LayoutLine, LayoutResult } from './markdownText';
export {
  toRuns,
  runsToPlainText,
  runsToMarkdown,
  markdownToRuns,
} from './runs';
export type { StyledRun } from './runs';
export {
  DEFAULT_TEXT_STYLE,
  resolveTextStyle,
  fontString,
} from './textStyle';
export type { TextStyle, ResolvedTextStyle } from './textStyle';
export { measureText } from './measureText';
export type { MeasuredText } from './measureText';
export { createTextLayer } from './textLayer';
export type { TextPose, CreateTextLayerOpts } from './textLayer';
export { pointInTextPose, caretIndexAt } from './hitTest';
export type { PointInTextPoseOpts } from './hitTest';
export { fitTextPose } from './fitTextPose';
export type { FitTextPoseOptions } from './fitTextPose';
export { useTextEdit } from './useTextEdit';
export type {
  TextEditScreenPose,
  StartEditOptions,
  UseTextEditOptions,
  UseTextEditReturn,
} from './useTextEdit';
```

(`parseMarkdownRuns` and `DEFAULT_SIZE_STEP` are intentionally not exported anymore.)

- [ ] **Step 4.5: Run the full text test suite**

Run: `npx vitest run src/features/text`

Expected: PASS. If any non-test file in `src/` references `parseMarkdownRuns`, `DEFAULT_SIZE_STEP`, or `sizeFactor`, the TypeScript build will fail; fix those references to use `markdownToRuns` / `fontSize` instead.

- [ ] **Step 4.6: Run the full project typecheck**

Run: `npx tsc --noEmit`

Expected: no errors. Common follow-up: demo files that imported the removed names need updating to the new shape.

- [ ] **Step 4.7: Commit**

```bash
git add -u src/features/text src/features/text/index.ts
git commit -m "refactor(text): drop sizeFactor and bracket markup; markdown path uses StyledRun from runs.ts"
```

---

## Task 5: Variant-aware `registerFont` API + storage

**Files:**
- Modify: `src/features/text/atlas/registerFont.ts`
- Modify: `src/features/text/atlas/registerFont.test.ts`

- [ ] **Step 5.1: Update `registerFont.test.ts` to the new signature**

Open `src/features/text/atlas/registerFont.test.ts`. Update every `await registerFont('inter', '/fonts/...', '/fonts/...')` call to pass `{}` for the variant:

```ts
await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
```

Update `getFont('inter')` → `getFont('inter', 400, 'normal')`.

Add new tests after the existing ones:

```ts
import type { FontVariant } from './registerFont';

describe('registerFont variants', () => {
  it('stores regular and bold separately under the same family', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBeNull();
    expect(getFont('inter', 700, 'normal')).not.toBeNull();
    expect(getFont('inter', 400, 'normal')).not.toBe(getFont('inter', 700, 'normal'));
  });

  it('stores italic separately from normal', async () => {
    await registerFont('inter', { style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBe(getFont('inter', 400, 'italic'));
  });

  it('defaults weight to 400 and style to normal when variant fields are omitted', async () => {
    await registerFont('inter', {}, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    expect(getFont('inter', 400, 'normal')).not.toBeNull();
  });

  it('re-registering the same (family, weight, style) is a no-op', async () => {
    await registerFont('inter', { weight: 700 }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const first = getFont('inter', 700, 'normal');
    await registerFont('inter', { weight: 700 }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const second = getFont('inter', 700, 'normal');
    expect(first).toBe(second);
  });
});
```

- [ ] **Step 5.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/atlas/registerFont.test.ts`

Expected: failures on signature mismatch / missing `FontVariant` type.

- [ ] **Step 5.3: Rewrite `registerFont.ts` with the variant-aware shape**

Replace the contents of `src/features/text/atlas/registerFont.ts`:

```ts
/**
 * FontRegistry and registerFont() public API.
 *
 * Variants are keyed by (family, weight, style). registerFont() takes a
 * FontVariant alongside the family and the two URLs; the registry stores
 * entries in a two-level Map so resolveFontVariant() can iterate a family's
 * variants for the fallback chain.
 */

import { parseBmFont, type BmFont } from './FontAtlas';
import type { GLTextureCache } from '../../../renderer/cache/GLTextureCache';

export interface FontEntry {
  font: BmFont;
  bitmap: ImageBitmap;
}

export interface FontVariant {
  weight?: number;
  style?: 'normal' | 'italic';
}

type FontStyle = 'normal' | 'italic';

let registry = new Map<string, Map<string, FontEntry>>();

function variantKey(weight: number, style: FontStyle): string {
  return `${weight}|${style}`;
}

function normalizeVariant(v: FontVariant): { weight: number; style: FontStyle } {
  return {
    weight: v.weight ?? 400,
    style: v.style ?? 'normal',
  };
}

/** Test helper. Do not call from product code. */
export function _resetFontRegistryForTests(): void {
  registry = new Map();
}

/** Exact lookup — does NOT walk the fallback chain. Use `resolveFontVariant` for that. */
export function getFont(
  family: string,
  weight: number = 400,
  style: FontStyle = 'normal',
): FontEntry | null {
  return registry.get(family)?.get(variantKey(weight, style)) ?? null;
}

export async function registerFont(
  family: string,
  variant: FontVariant,
  metricsUrl: string,
  atlasUrl: string,
): Promise<void> {
  const { weight, style } = normalizeVariant(variant);
  const key = variantKey(weight, style);

  let familyMap = registry.get(family);
  if (familyMap?.has(key)) return;

  try {
    const [metricsRes, atlasRes] = await Promise.all([
      fetch(metricsUrl),
      fetch(atlasUrl),
    ]);

    if (!metricsRes.ok) {
      throw new Error(`HTTP ${metricsRes.status} fetching metrics from ${metricsUrl}`);
    }
    if (!atlasRes.ok) {
      throw new Error(`HTTP ${atlasRes.status} fetching atlas from ${atlasUrl}`);
    }

    const [rawJson, blob] = await Promise.all([
      metricsRes.json(),
      atlasRes.blob(),
    ]);

    const font = parseBmFont(rawJson);
    const bitmap = await createImageBitmap(blob);

    if (!familyMap) {
      familyMap = new Map();
      registry.set(family, familyMap);
    }
    familyMap.set(key, { font, bitmap });
  } catch (err) {
    throw new Error(
      `weasel registerFont("${family}" ${weight}/${style}): ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Ensure the atlas for `(family, weight, style)` is uploaded to
 * `textureCache`. Cache key is `${family}|${weight}|${style}` so each
 * variant occupies its own texture slot.
 */
export function ensureFontTexture(
  family: string,
  weight: number,
  style: FontStyle,
  textureCache: GLTextureCache,
): boolean {
  const entry = getFont(family, weight, style);
  if (!entry) return false;
  textureCache.upload(textureCacheKey(family, weight, style), entry.bitmap);
  return true;
}

/** The texture cache key used by `ensureFontTexture` for a given variant. */
export function textureCacheKey(family: string, weight: number, style: FontStyle): string {
  return `${family}|${weight}|${style}`;
}

/** Kept as a no-op for context-restore call sites; per-cache dedup handles it now. */
export function _markAllFontsNotUploaded(): void {}
```

- [ ] **Step 5.4: Run the registerFont tests**

Run: `npx vitest run src/features/text/atlas/registerFont.test.ts`

Expected: PASS.

- [ ] **Step 5.5: Commit**

```bash
git add src/features/text/atlas/registerFont.ts src/features/text/atlas/registerFont.test.ts
git commit -m "feat(text): variant-aware registerFont keyed by (family, weight, style)"
```

---

## Task 6: `resolveFontVariant` fallback chain

**Files:**
- Modify: `src/features/text/atlas/registerFont.ts`
- Modify: `src/features/text/atlas/registerFont.test.ts`

- [ ] **Step 6.1: Write failing tests**

Append to `src/features/text/atlas/registerFont.test.ts`:

```ts
import { resolveFontVariant } from './registerFont';

describe('resolveFontVariant', () => {
  it('returns exact match with no synthetic flags', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 400, 'normal');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });

  it('falls back from missing italic to normal with synthetic.italic=true', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 400, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back from missing bold to regular with synthetic.bold=true', async () => {
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'normal');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: true, italic: false });
  });

  it('falls back from missing bold-italic to bold with synthetic.italic=true (real bold)', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: true });
  });

  it('falls back from missing bold-italic to italic with synthetic.bold=true (real italic)', async () => {
    await registerFont('inter', { weight: 400, style: 'italic' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 700, 'italic');
    expect(r.entry).not.toBeNull();
    expect(r.synthetic).toEqual({ bold: true, italic: false });
  });

  it('prefers the nearer weight in the same bucket', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 900, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 750, 'normal');
    expect(r.entry).toBe(getFont('inter', 700, 'normal'));
  });

  it('breaks weight-distance ties by picking the heavier weight', async () => {
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    await registerFont('inter', { weight: 900, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const r = resolveFontVariant('inter', 800, 'normal');
    expect(r.entry).toBe(getFont('inter', 900, 'normal'));
  });

  it('returns null entry when the family has no variants', () => {
    const r = resolveFontVariant('missing', 400, 'normal');
    expect(r.entry).toBeNull();
    expect(r.synthetic).toEqual({ bold: false, italic: false });
  });
});
```

- [ ] **Step 6.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/atlas/registerFont.test.ts`

Expected: failures on missing `resolveFontVariant` export.

- [ ] **Step 6.3: Implement `resolveFontVariant`**

Append to `src/features/text/atlas/registerFont.ts`:

```ts
export interface ResolveResult {
  entry: FontEntry | null;
  synthetic: { bold: boolean; italic: boolean };
}

const NULL_RESULT: ResolveResult = { entry: null, synthetic: { bold: false, italic: false } };

function weightBucket(w: number): 'regular' | 'bold' {
  return w >= 600 ? 'bold' : 'regular';
}

/**
 * Resolve a `(family, weight, style)` request to a registered font entry,
 * walking the fallback chain when an exact match isn't available. Returns
 * synthetic flags describing the gap between requested and resolved so the
 * renderer can apply SDF-thicken / vertex-skew fakes.
 */
export function resolveFontVariant(
  family: string,
  weight: number,
  style: FontStyle,
): ResolveResult {
  const familyMap = registry.get(family);
  if (!familyMap || familyMap.size === 0) return NULL_RESULT;

  // 1. Exact match
  const exact = familyMap.get(variantKey(weight, style));
  if (exact) return { entry: exact, synthetic: { bold: false, italic: false } };

  // 2. Same style, nearest weight in same bucket (ties broken by higher weight)
  const requestedBucket = weightBucket(weight);
  let bestSameStyle: { entry: FontEntry; weight: number; distance: number } | null = null;
  for (const [key, entry] of familyMap) {
    const [wStr, s] = key.split('|') as [string, FontStyle];
    const w = Number(wStr);
    if (s !== style) continue;
    if (weightBucket(w) !== requestedBucket) continue;
    const distance = Math.abs(w - weight);
    if (
      bestSameStyle === null ||
      distance < bestSameStyle.distance ||
      (distance === bestSameStyle.distance && w > bestSameStyle.weight)
    ) {
      bestSameStyle = { entry, weight: w, distance };
    }
  }
  if (bestSameStyle) {
    return {
      entry: bestSameStyle.entry,
      synthetic: { bold: false, italic: false },
    };
  }

  // 3. (family, 400, style)
  const sameStyleRegular = familyMap.get(variantKey(400, style));
  if (sameStyleRegular) {
    return {
      entry: sameStyleRegular,
      synthetic: {
        bold: weight >= 600,
        italic: false,
      },
    };
  }

  // 4. (family, weight, 'normal') — same weight, no italic
  const sameWeightNormal = familyMap.get(variantKey(weight, 'normal'));
  if (sameWeightNormal) {
    return {
      entry: sameWeightNormal,
      synthetic: {
        bold: false,
        italic: style === 'italic',
      },
    };
  }

  // 4b. Nearest weight, normal style, same bucket
  let bestNormal: { entry: FontEntry; weight: number; distance: number } | null = null;
  for (const [key, entry] of familyMap) {
    const [wStr, s] = key.split('|') as [string, FontStyle];
    const w = Number(wStr);
    if (s !== 'normal') continue;
    if (weightBucket(w) !== requestedBucket) continue;
    const distance = Math.abs(w - weight);
    if (
      bestNormal === null ||
      distance < bestNormal.distance ||
      (distance === bestNormal.distance && w > bestNormal.weight)
    ) {
      bestNormal = { entry, weight: w, distance };
    }
  }
  if (bestNormal) {
    return {
      entry: bestNormal.entry,
      synthetic: {
        bold: false,
        italic: style === 'italic',
      },
    };
  }

  // 5. (family, 400, 'normal') — last resort within family
  const regular = familyMap.get(variantKey(400, 'normal'));
  if (regular) {
    return {
      entry: regular,
      synthetic: {
        bold: weight >= 600,
        italic: style === 'italic',
      },
    };
  }

  return NULL_RESULT;
}
```

- [ ] **Step 6.4: Run the tests**

Run: `npx vitest run src/features/text/atlas/registerFont.test.ts`

Expected: PASS.

- [ ] **Step 6.5: Commit**

```bash
git add src/features/text/atlas/registerFont.ts src/features/text/atlas/registerFont.test.ts
git commit -m "feat(text): resolveFontVariant fallback chain with synthetic flags"
```

---

## Task 7: `drawText` uses variant resolver

**Files:**
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

- [ ] **Step 7.1: Update `draw.test.ts` to the new `registerFont` signature**

Open `src/renderer/draw.test.ts`. Find every `registerFont(...)` call and insert `{}` as the second argument. Example:

```ts
await registerFont('inter', '/fonts/inter.json', '/fonts/inter.png');
```

becomes:

```ts
await registerFont('inter', {}, '/fonts/inter.json', '/fonts/inter.png');
```

- [ ] **Step 7.2: Run the draw tests to confirm they currently fail with a signature error or shape mismatch**

Run: `npx vitest run src/renderer/draw.test.ts`

Expected: at minimum, tests using `drawText` should still pass (the change to `getFont`/`ensureFontTexture` signatures will only show up when we touch the call sites in Step 7.3). Expect a clean run after updating just the `registerFont` invocations — if anything fails, it indicates an internal call we missed.

- [ ] **Step 7.3: Update `drawText` to resolve variants**

Open `src/renderer/draw.ts`. Find the import line:

```ts
import { getFont, ensureFontTexture } from 'features/text/atlas/registerFont';
```

Replace with:

```ts
import { resolveFontVariant, ensureFontTexture, textureCacheKey } from 'features/text/atlas/registerFont';
```

Find the `drawText` function (around line 560 in the current file). Replace the variant-lookup section. The current code:

```ts
function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const family = style.fontFamily;

  if (!ensureFontTexture(family, ctx.textureCache)) {
    console.warn(`weasel drawText: font "${family}" not registered; call registerFont() first.`);
    return;
  }

  const entry = getFont(family);
  if (!entry) return;
  // ...
  ctx.textureCache.bind(family, 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);
  // ...
}
```

becomes:

```ts
function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const family = style.fontFamily;
  const weight = normalizeFontWeight(style.fontWeight);
  const fontStyle = style.fontStyle;

  const resolved = resolveFontVariant(family, weight, fontStyle);
  if (!resolved.entry) {
    console.warn(
      `weasel drawText: no atlas registered for "${family}" ${weight}/${fontStyle}; call registerFont() first.`,
    );
    return;
  }

  // Ensure the *resolved* variant's texture is uploaded — this may differ
  // from the requested (family, weight, style) when fallback kicked in.
  const resolvedKey = resolveTextureKey(family, weight, fontStyle, resolved);
  if (!resolved.entry || !ensureFontTextureForResolved(family, weight, fontStyle, resolved, ctx.textureCache)) {
    return;
  }

  const entry = resolved.entry;
  // ... existing layout code, using `entry.font` as before ...

  ctx.textureCache.bind(resolvedKey, 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);
  // ... rest of drawText unchanged ...
}
```

Then add these helpers at the bottom of `draw.ts` (above `drawText` is also fine — keep them with drawText):

```ts
function normalizeFontWeight(w: number | string): number {
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

function resolveTextureKey(
  requestedFamily: string,
  requestedWeight: number,
  requestedStyle: 'normal' | 'italic',
  resolved: ReturnType<typeof resolveFontVariant>,
): string {
  // The cache key must match the actual atlas (family + resolved variant).
  // Synthetic flags don't change the underlying atlas; they only change
  // shader uniforms (lit up in Slice 2).
  const w = resolved.synthetic.bold ? lowerBucketWeight(requestedWeight) : requestedWeight;
  const s = resolved.synthetic.italic ? 'normal' : requestedStyle;
  return textureCacheKey(requestedFamily, w, s);
}

function lowerBucketWeight(w: number): number {
  return w >= 600 ? 400 : w;
}

function ensureFontTextureForResolved(
  requestedFamily: string,
  requestedWeight: number,
  requestedStyle: 'normal' | 'italic',
  resolved: ReturnType<typeof resolveFontVariant>,
  cache: GLTextureCache,
): boolean {
  const w = resolved.synthetic.bold ? lowerBucketWeight(requestedWeight) : requestedWeight;
  const s = resolved.synthetic.italic ? 'normal' : requestedStyle;
  return ensureFontTexture(requestedFamily, w, s, cache);
}
```

Add a `GLTextureCache` import if not already present at the top of the file.

**Note on this slice's scope:** `resolveTextureKey` and friends conservatively translate the fallback into an exact-key for the uploaded atlas. We aren't lighting up the synthetic uniforms yet (that's Slice 2) — but routing the cache key correctly now means Slice 2 can change the shader uniforms without revisiting cache plumbing.

- [ ] **Step 7.4: Run the draw test suite**

Run: `npx vitest run src/renderer/draw.test.ts`

Expected: PASS. The existing single-style draw test should still work because for a node with default weight/style (`400`, `'normal'`) the resolver returns the exact match with no fallback.

- [ ] **Step 7.5: Run the full test suite to catch other consumers**

Run: `npx vitest run`

Expected: PASS. If any other test calls `getFont` or `ensureFontTexture` with the old signature, fix the call.

- [ ] **Step 7.6: Commit**

```bash
git add -u src/renderer
git commit -m "feat(text): drawText resolves font variants via the new registry"
```

---

## Task 8: `TextPose.runs?` field; `createTextLayer` validates runs

**Files:**
- Modify: `src/features/text/textLayer.ts`
- Modify: `src/features/text/textLayer.test.ts` (extend, don't replace)

- [ ] **Step 8.1: Write failing tests**

Open `src/features/text/textLayer.test.ts` and append to the existing `describe` block (or create a new one):

```ts
import type { StyledRun } from './runs';

describe('createTextLayer — runs field', () => {
  it('accepts a node with `runs` and emits draw commands using the concatenated text', () => {
    const layer = createTextLayer<TestNode>({
      getTexts: () => [{
        id: 'n1',
        pose: { x: 0, y: 0, width: 200, height: 40, text: 'a b', runs: [{ text: 'a ' }, { text: 'b', bold: true }] },
      }],
      getPose: (n) => n.pose,
    });
    const cmds = layer.draw(undefined, IDENTITY_VIEW) as DrawCommand[];
    expect(cmds).toHaveLength(1);
    const group = cmds[0];
    expect(group.kind).toBe('group');
    // At least one text child, and the text content is the plain-text form.
    const textChild = (group as { children: DrawCommand[] }).children.find((c) => c.kind === 'text');
    expect(textChild).toBeDefined();
    expect((textChild as { text: string }).text).toBe('a b');
  });

  it('throws in dev when runs are present but runsToPlainText(runs) !== text', () => {
    const layer = createTextLayer<TestNode>({
      getTexts: () => [{
        id: 'bad',
        pose: { x: 0, y: 0, width: 200, height: 40, text: 'a b', runs: [{ text: 'WRONG' }] },
      }],
      getPose: (n) => n.pose,
    });
    expect(() => layer.draw(undefined, IDENTITY_VIEW)).toThrow(/invariant/i);
  });
});

interface TestNode { id: string; pose: TextPose }
const IDENTITY_VIEW = { x: 0, y: 0, zoom: 1 };
```

If the test file is structured differently (it likely doesn't have `TestNode` / `IDENTITY_VIEW` already), adapt the boilerplate to match the existing pattern in `textLayer.test.ts` — read it first to confirm what's imported.

- [ ] **Step 8.2: Run the tests and confirm they fail**

Run: `npx vitest run src/features/text/textLayer.test.ts`

Expected: failures — `runs` not on `TextPose`, no invariant check.

- [ ] **Step 8.3: Update `TextPose` and `createTextLayer`**

Open `src/features/text/textLayer.ts`. Modify the `TextPose` interface:

```ts
import type { StyledRun } from './runs';
import { runsToPlainText } from './runs';

export interface TextPose {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  runs?: StyledRun[];
  style?: TextStyle;
}
```

Inside the `for (const node of getTexts())` loop in `createTextLayer`, after `const pose = getPose(node);`, add an invariant check:

```ts
if (pose.runs && runsToPlainText(pose.runs) !== pose.text) {
  throw new Error(
    `weasel createTextLayer: TextPose invariant violated — runsToPlainText(runs) !== text. ` +
    `Either omit \`runs\` or keep it synchronized with \`text\`.`,
  );
}
```

No other behavior change in this slice — the existing single-style render path keeps emitting one `TextDrawCommand` per line of `pose.text`. The per-run variant rendering lands in Slice 2.

- [ ] **Step 8.4: Run the textLayer tests**

Run: `npx vitest run src/features/text/textLayer.test.ts`

Expected: PASS.

- [ ] **Step 8.5: Run the full test suite**

Run: `npx vitest run`

Expected: PASS.

- [ ] **Step 8.6: Run the full typecheck**

Run: `npx tsc --noEmit`

Expected: no errors.

- [ ] **Step 8.7: Commit**

```bash
git add -u src/features/text
git commit -m "feat(text): TextPose.runs? field with plain-text invariant"
```

---

## Task 9: Verify the slice end-to-end via the existing `TextDemo`

This is a smoke task — no new code, just confirming the slice is shippable.

**Files:** none modified.

- [ ] **Step 9.1: Run the project's CI gate**

Run: `npx tsc --noEmit && npx vitest run`

Expected: PASS.

- [ ] **Step 9.2: Run the demo and verify the text demo still renders**

Run: `npm run dev` (in another shell, navigate to the Text demo).

Expected: existing `TextDemo` renders identically to before — same text nodes, same single-style rendering. No regressions in caret, selection, or editing (all single-style paths).

- [ ] **Step 9.3: Manual sanity check — register a bold variant**

In a scratch demo or via the browser console, register Inter as both regular and bold (point both to the same Inter atlas as a smoke test), then mutate a text node to set `style.fontWeight: 700`. Expected: the resolver returns the bold entry; the rendered atlas is the bold one (visually identical in this smoke test since both atlases are the same file, but the cache key changes from `inter|400|normal` to `inter|700|normal`).

This isn't a unit test — it's a "the wiring works" check before declaring slice 1 done.

- [ ] **Step 9.4: Commit nothing; just confirm**

If everything is green, slice 1 is complete. Slice 2 (variant rendering + synthetic fallback) gets its own plan.

---

## Out of scope for this slice (handled later)

- Per-run variant switching in `layoutGlyphs` / `drawText` — Slice 2.
- Synthetic-bold (SDF threshold) and synthetic-italic (vertex skew) shader uniforms — Slice 2.
- `TextDrawCommand.runs` field replacing `text` — Slice 2.
- Cmd-B / Cmd-I in `useTextEdit` — Slice 3.

## Self-review notes

- Spec coverage: data model (`StyledRun`, `toRuns`, serializers) ✓; variant registry with `(family, weight, style)` keying ✓; fallback chain with synthetic flags ✓; `TextPose.runs?` field ✓; cleanup of `sizeFactor` and bracket markup ✓.
- Deferred to later slices: layout, GPU draw of variants, shader patch, editing.
- All steps have concrete code, file paths, and verification commands.
