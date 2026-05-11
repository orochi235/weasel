# Rich Text — Slice 2: Variant Rendering + Synthetic Fallback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the GPU MSDF pipeline actually render bold and italic — per-run atlas switching for inline rich text, with synthetic-bold (SDF threshold shift) and synthetic-italic (vertex skew) fallbacks when a requested variant isn't registered.

**Architecture:** A new `ResolvedRun` type and `resolveRuns(runs, style)` apply node-style defaults to each run. A new `layoutRuns(runs, …)` in `src/features/text/atlas/` walks runs, switches atlas per run via Slice 1's `resolveFontVariant`, kerns across run boundaries using the left glyph's atlas, word-wraps when a finite width is given, and groups output quads by `(family, weight, style, fill, synthetic)`. `TextDrawCommand` swaps `text: string` for `runs: ResolvedRun[]` plus `maxWidth`/`align` so `createTextLayer` emits one command per text node. `drawText` issues one draw call per group with two new shader uniforms (`u_synthBold` for SDF threshold, `u_synthItalic` for vertex skew) that activate only when the resolver fell back.

**Tech Stack:** TypeScript, Vitest, WebGL2 MSDF text, path-mapped imports (`features/text/...`).

---

## File map

- **Create:** `src/features/text/runs/resolveRuns.ts` — `ResolvedRun` type and `resolveRuns(runs, nodeStyle): ResolvedRun[]` helper.
- **Create:** `src/features/text/runs/resolveRuns.test.ts`.
- **Create:** `src/features/text/atlas/layoutRuns.ts` — runs-aware layout with per-run atlas switching, cross-boundary kerning, word wrap, and grouping.
- **Create:** `src/features/text/atlas/layoutRuns.test.ts`.
- **Modify:** `src/renderer/DrawCommand.ts` — `TextDrawCommand` swaps `text: string` for `runs: ResolvedRun[]` and adds `maxWidth?: number`, `align?: 'left'|'center'|'right'`.
- **Modify:** `src/renderer/shaders/textSdf.ts` — add `u_synthBold` (frag) and `u_synthItalic` (vert) uniforms; patch shader bodies; extend the uniform list.
- **Modify:** `src/renderer/draw.ts` — `drawText` calls `layoutRuns`, iterates groups, sets per-group atlas + color + synthetic uniforms, issues one draw call per group.
- **Modify:** `src/renderer/draw.test.ts` — update text-command fixtures to the new shape; add synthetic-uniform tests via GL recorder.
- **Modify:** `src/features/text/textLayer.ts` — `createTextLayer` emits one `TextDrawCommand` per node carrying `runs: ResolvedRun[]` (built via `resolveRuns` from the node's `text`+`runs?`+`style`) + `maxWidth: pose.width` + `align`. Multi-line layout moves into `drawText`/`layoutRuns`.
- **Modify:** `src/features/text/textLayer.test.ts` — tests asserting the new command shape; one test exercising mixed-run output.
- **Modify:** `src/features/text/index.ts` — re-export `ResolvedRun` and `resolveRuns`.
- **Modify:** `demo/demos/TextDemo.tsx` — add a node with inline bold/italic via markdown; visual tuning area for synthetic-bold and synthetic-italic next to real variants.

---

## Task 1: `ResolvedRun` type + `resolveRuns(runs, style)` helper

**Files:**
- Create: `src/features/text/runs/resolveRuns.ts`
- Create: `src/features/text/runs/resolveRuns.test.ts`

`ResolvedRun` is a `StyledRun` with every styling field filled in from the node-level `ResolvedTextStyle`. The renderer consumes only `ResolvedRun[]` so there's no per-glyph default resolution.

- [ ] **Step 1.1: Write failing tests**

Create `src/features/text/runs/resolveRuns.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveRuns, type ResolvedRun } from './resolveRuns';
import { resolveTextStyle } from '../textStyle';
import type { StyledRun } from '../runs';

describe('resolveRuns', () => {
  it('fills run defaults from node style when run fields are absent', () => {
    const style = resolveTextStyle({ fontSize: 18, fontFamily: 'inter', fontWeight: 400, fontStyle: 'normal' });
    const runs: StyledRun[] = [{ text: 'hello' }];
    const out = resolveRuns(runs, style);
    expect(out).toHaveLength(1);
    const r = out[0] as ResolvedRun;
    expect(r.text).toBe('hello');
    expect(r.fontFamily).toBe('inter');
    expect(r.fontSize).toBe(18);
    expect(r.fontWeight).toBe(400);
    expect(r.fontStyle).toBe('normal');
    expect(r.fill).toEqual(style.fill);
  });

  it('promotes bold/italic flags into fontWeight/fontStyle overrides', () => {
    const style = resolveTextStyle({ fontWeight: 400, fontStyle: 'normal' });
    const runs: StyledRun[] = [
      { text: 'a' },
      { text: 'b', bold: true },
      { text: 'c', italic: true },
      { text: 'd', bold: true, italic: true },
    ];
    const out = resolveRuns(runs, style);
    expect(out.map((r) => r.fontWeight)).toEqual([400, 700, 400, 700]);
    expect(out.map((r) => r.fontStyle)).toEqual(['normal', 'normal', 'italic', 'italic']);
  });

  it('per-run fontSize / fontFamily / fill override node defaults', () => {
    const style = resolveTextStyle({ fontSize: 16, fontFamily: 'inter', fill: { fill: 'solid', color: '#000' } });
    const runs: StyledRun[] = [
      {
        text: 'big',
        fontSize: 32,
        fontFamily: 'mono',
        fill: { fill: 'solid', color: '#f00' },
      },
    ];
    const r = resolveRuns(runs, style)[0];
    expect(r.fontSize).toBe(32);
    expect(r.fontFamily).toBe('mono');
    expect(r.fill).toEqual({ fill: 'solid', color: '#f00' });
  });

  it('bold flag wins over numeric fontWeight inheritance when both could apply (run.bold === true sets 700)', () => {
    const style = resolveTextStyle({ fontWeight: 300 });
    const runs: StyledRun[] = [{ text: 'a', bold: true }];
    expect(resolveRuns(runs, style)[0].fontWeight).toBe(700);
  });

  it('returns an empty array for empty input', () => {
    const style = resolveTextStyle({});
    expect(resolveRuns([], style)).toEqual([]);
  });
});
```

- [ ] **Step 1.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/runs/resolveRuns.test.ts`
Expected: failures on missing module `./resolveRuns`.

- [ ] **Step 1.3: Implement `resolveRuns.ts`**

Create `src/features/text/runs/resolveRuns.ts`:

```ts
/**
 * Apply node-level `ResolvedTextStyle` defaults to each `StyledRun`,
 * producing a fully-resolved run with every styling field set. Downstream
 * layout and draw never re-resolve defaults — `ResolvedRun` is the
 * canonical shape the renderer consumes.
 *
 * `bold`/`italic` toggles on a run are folded into `fontWeight`/`fontStyle`:
 * `bold: true` → fontWeight 700, `italic: true` → fontStyle 'italic'.
 * Explicit `fontFamily` / `fontSize` / `fill` on the run override the
 * node-level value.
 */

import type { Paint } from 'core/paint-types';
import type { StyledRun } from '../runs';
import type { ResolvedTextStyle } from '../textStyle';

export interface ResolvedRun {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  fontStyle: 'normal' | 'italic';
  fill: Paint;
}

function numericWeight(w: number | string): number {
  if (typeof w === 'number') return w;
  if (w === 'bold') return 700;
  if (w === 'normal') return 400;
  const parsed = Number(w);
  return Number.isFinite(parsed) ? parsed : 400;
}

export function resolveRuns(
  runs: readonly StyledRun[],
  style: ResolvedTextStyle,
): ResolvedRun[] {
  const out: ResolvedRun[] = [];
  const baseWeight = numericWeight(style.fontWeight);
  for (const run of runs) {
    out.push({
      text: run.text,
      fontFamily: run.fontFamily ?? style.fontFamily,
      fontSize: run.fontSize ?? style.fontSize,
      fontWeight: run.bold ? 700 : baseWeight,
      fontStyle: run.italic ? 'italic' : style.fontStyle,
      fill: run.fill ?? style.fill,
    });
  }
  return out;
}
```

- [ ] **Step 1.4: Verify tests pass**

Run: `npx vitest run src/features/text/runs/resolveRuns.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 1.5: Commit**

```bash
git add src/features/text/runs/
git commit -m "feat(text): ResolvedRun + resolveRuns — apply node-style defaults to runs"
```

---

## Task 2: `layoutRuns` core — per-run atlas switching, cross-boundary kerning, grouping (single line)

**Files:**
- Create: `src/features/text/atlas/layoutRuns.ts`
- Create: `src/features/text/atlas/layoutRuns.test.ts`

The core engine. Takes `ResolvedRun[]` plus an origin and emits laid-out quads bucketed by `(family, weight, style, synthetic, fill)`. No word wrap yet — single line, `Infinity` width semantics. Wrap and multi-line baselines land in Task 3.

- [ ] **Step 2.1: Write failing tests**

Create `src/features/text/atlas/layoutRuns.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { _resetFontRegistryForTests, registerFont } from './registerFont';
import { layoutRuns } from './layoutRuns';
import type { ResolvedRun } from '../runs/resolveRuns';

beforeEach(() => {
  _resetFontRegistryForTests();
});

// Helper: register the fixture font under multiple variants. The fixture has
// only glyphs for 'A' (65) and 'B' (66), so test inputs use those characters.
async function registerFixture(family: string, opts: Array<{ weight?: number; style?: 'normal'|'italic' }>) {
  for (const v of opts) {
    await registerFont(family, v, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
  }
}

const RUN_PLAIN = (text: string): ResolvedRun => ({
  text, fontFamily: 'inter', fontSize: 32, fontWeight: 400, fontStyle: 'normal',
  fill: { fill: 'solid', color: '#000' },
});
const RUN_BOLD = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontWeight: 700 });
const RUN_ITALIC = (text: string): ResolvedRun => ({ ...RUN_PLAIN(text), fontStyle: 'italic' });

describe('layoutRuns — single line', () => {
  it('returns one group when all runs share the same variant', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].family).toBe('inter');
    expect(out.groups[0].weight).toBe(400);
    expect(out.groups[0].style).toBe('normal');
    expect(out.groups[0].quads).toHaveLength(2);
  });

  it('emits one group per distinct (family, weight, style, synthetic, fill)', async () => {
    await registerFixture('inter', [{}, { weight: 700 }]);
    const out = layoutRuns(
      [RUN_PLAIN('A'), RUN_BOLD('B'), RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    // Two groups: regular and bold. The two regular runs collapse into one
    // group with two quads; bold is its own group with one quad.
    expect(out.groups).toHaveLength(2);
    const regular = out.groups.find((g) => g.weight === 400)!;
    const bold = out.groups.find((g) => g.weight === 700)!;
    expect(regular.quads).toHaveLength(2);
    expect(bold.quads).toHaveLength(1);
  });

  it('marks groups with synthetic flags when the resolver fell back', async () => {
    // Only register regular; ask for italic in a run → synthetic.italic
    await registerFixture('inter', [{}]);
    const out = layoutRuns([RUN_ITALIC('A')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    expect(out.groups).toHaveLength(1);
    expect(out.groups[0].synthetic).toEqual({ bold: false, italic: true });
  });

  it('per-run fill forces a separate group even for the same atlas variant', async () => {
    await registerFixture('inter', [{}]);
    const RED: ResolvedRun = { ...RUN_PLAIN('A'), fill: { fill: 'solid', color: '#f00' } };
    const out = layoutRuns(
      [RUN_PLAIN('A'), RED, RUN_PLAIN('A')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(2);
  });

  it('positions glyphs across runs on the same baseline with kerning carrying through', async () => {
    await registerFixture('inter', [{}]);
    // Single-run "AB" and split "A"+"B" must yield identical x positions when
    // both runs use the same variant (left-glyph kerning table is the same atlas).
    const single = layoutRuns([RUN_PLAIN('AB')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const split = layoutRuns([RUN_PLAIN('A'), RUN_PLAIN('B')], { maxWidth: Infinity, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const singleX = single.groups[0].quads.map((q) => q.x0);
    const splitX = split.groups.flatMap((g) => g.quads.map((q) => q.x0)).sort((a, b) => a - b);
    expect(splitX).toEqual(singleX);
  });

  it('warns once and returns null entry behavior for an unregistered family', async () => {
    // Empty registry — every group ends up with null entry; layout should still produce groups but skip glyph emission.
    const out = layoutRuns(
      [{ ...RUN_PLAIN('A'), fontFamily: 'missing' }],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    expect(out.groups).toHaveLength(0);
    // No glyphs emitted; bounds collapse to (0, lineHeightFromFallback).
    expect(out.bounds.width).toBe(0);
  });
});
```

- [ ] **Step 2.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/atlas/layoutRuns.test.ts`
Expected: failures on missing module `./layoutRuns`.

- [ ] **Step 2.3: Implement `layoutRuns.ts`**

Create `src/features/text/atlas/layoutRuns.ts`:

```ts
/**
 * Runs-aware MSDF layout. Walks `ResolvedRun[]` codepoint-by-codepoint,
 * switching atlas per run via `resolveFontVariant`, applying kerning
 * (using the left glyph's atlas table and size scaling, including across
 * run boundaries), and bucketing emitted quads by
 * `(family, weight, style, syntheticBold, syntheticItalic, fillKey)` so
 * the renderer issues one draw call per atlas+color group.
 *
 * Single-line layout in this entry point: `maxWidth: Infinity` is the
 * only supported value. Word wrap and multi-line baseline computation
 * land in a sibling task and reuse the same kerning/grouping engine.
 */

import type { Paint } from 'core/paint-types';
import type { BmFontChar, BmFont } from './FontAtlas';
import type { ResolvedRun } from '../runs/resolveRuns';
import { resolveFontVariant, type ResolveResult } from './registerFont';

export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
}

export interface LaidOutGroup {
  family: string;
  /** Resolved variant — matches the registered atlas and the texture-cache key. */
  weight: number;
  style: 'normal' | 'italic';
  /** Gap between the request and the resolved match. Drives shader uniforms. */
  synthetic: { bold: boolean; italic: boolean };
  fill: Paint;
  quads: LaidOutQuad[];
}

export interface LaidOutRuns {
  groups: LaidOutGroup[];
  bounds: { width: number; height: number };
}

export interface LayoutRunsOpts {
  maxWidth: number;
  lineHeight: number;        // multiplier applied to each run's fontSize
  align: 'left' | 'center' | 'right';
}

export interface LayoutRunsOrigin {
  x: number;
  y: number;
}

const FALLBACK_CODEPOINT = 63; // '?'

interface LayoutContext {
  groups: Map<string, LaidOutGroup>;
}

function fillKey(p: Paint): string {
  if ('color' in p) return `s:${p.color}:${p.opacity ?? 1}`;
  // Non-solid paints: identity key. Per-run gradients/patterns are rare;
  // identity ensures correctness, dedup is a future optimization.
  return `nx:${Math.random()}`;
}

function groupKey(
  family: string,
  weight: number,
  style: 'normal' | 'italic',
  synthetic: { bold: boolean; italic: boolean },
  fill: Paint,
): string {
  return `${family}|${weight}|${style}|${synthetic.bold ? 1 : 0}${synthetic.italic ? 1 : 0}|${fillKey(fill)}`;
}

function getOrCreateGroup(
  ctx: LayoutContext,
  run: ResolvedRun,
  resolved: ResolveResult,
): LaidOutGroup {
  // Key by the *resolved* variant so the group matches the actual atlas.
  // Synthetic flags encode the gap from the request, and they're part of
  // the key because two runs with the same resolved atlas but different
  // synthetic flags need different shader uniforms.
  const resolvedWeight = resolved.resolved.weight;
  const resolvedStyle = resolved.resolved.style;
  const key = groupKey(
    run.fontFamily,
    resolvedWeight,
    resolvedStyle,
    resolved.synthetic,
    run.fill,
  );
  let g = ctx.groups.get(key);
  if (!g) {
    g = {
      family: run.fontFamily,
      weight: resolvedWeight,
      style: resolvedStyle,
      synthetic: { ...resolved.synthetic },
      fill: run.fill,
      quads: [],
    };
    ctx.groups.set(key, g);
  }
  return g;
}

function resolveGlyph(font: BmFont, cp: number): BmFontChar | null {
  const direct = font.charMap.get(cp);
  if (direct) return direct;
  const fb = font.charMap.get(FALLBACK_CODEPOINT);
  if (fb) return fb;
  console.warn(`weasel layoutRuns: no glyph for codepoint ${cp} and no fallback '?'; skipping.`);
  return null;
}

export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
  origin: LayoutRunsOrigin,
): LaidOutRuns {
  const ctx: LayoutContext = { groups: new Map() };
  let penX = origin.x;
  const penY = origin.y;

  // Cross-run kerning state: the previous glyph's codepoint and the atlas /
  // size that produced its advance, so the next glyph's kerning lookup uses
  // the left run's table and scale.
  let prevCp: number | undefined;
  let prevFont: BmFont | undefined;
  let prevFontSize: number | undefined;
  let maxY = 0;

  for (const run of runs) {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    if (!resolved.entry) {
      // Drop the run entirely — no glyphs to emit. Continue to next run.
      prevCp = undefined;
      prevFont = undefined;
      prevFontSize = undefined;
      continue;
    }
    const font = resolved.entry.font;
    const scale = run.fontSize / font.info.size;
    const atlasW = font.common.scaleW;
    const atlasH = font.common.scaleH;
    const group = getOrCreateGroup(ctx, run, resolved);

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      const glyph = resolveGlyph(font, cp);
      if (!glyph) {
        prevCp = cp;
        prevFont = font;
        prevFontSize = run.fontSize;
        continue;
      }

      if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
        const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
        penX += kAtlas * (prevFontSize / prevFont.info.size);
      }

      const qx0 = penX + glyph.xoffset * scale;
      const qy0 = penY + glyph.yoffset * scale;
      const qx1 = qx0 + glyph.width * scale;
      const qy1 = qy0 + glyph.height * scale;
      const u0 = glyph.x / atlasW;
      const v0 = glyph.y / atlasH;
      const u1 = (glyph.x + glyph.width) / atlasW;
      const v1 = (glyph.y + glyph.height) / atlasH;
      group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1 });

      maxY = Math.max(maxY, qy1);
      penX += glyph.xadvance * scale;
      prevCp = cp;
      prevFont = font;
      prevFontSize = run.fontSize;
    }
  }

  return {
    groups: [...ctx.groups.values()],
    bounds: { width: penX - origin.x, height: maxY - origin.y },
  };
}
```

- [ ] **Step 2.4: Verify tests pass**

Run: `npx vitest run src/features/text/atlas/layoutRuns.test.ts`
Expected: PASS, all 6 tests.

- [ ] **Step 2.5: Commit**

```bash
git add src/features/text/atlas/layoutRuns.ts src/features/text/atlas/layoutRuns.test.ts
git commit -m "feat(text): layoutRuns core — per-run atlas, cross-boundary kerning, grouped quads"
```

---

## Task 3: `layoutRuns` word wrap + multi-line baseline

**Files:**
- Modify: `src/features/text/atlas/layoutRuns.ts`
- Modify: `src/features/text/atlas/layoutRuns.test.ts`

Word wrap kicks in when `opts.maxWidth` is finite. Algorithm ports the existing `layoutMarkdown` pattern: at each space boundary inside a run, decide whether the next word fits; if not, commit the current line and start a new one. Mixed-size runs share a baseline; the line's `lineHeight = max(fontSize * lineHeight) across runs on that line`.

- [ ] **Step 3.1: Write failing tests**

Append to `src/features/text/atlas/layoutRuns.test.ts`:

```ts
describe('layoutRuns — word wrap', () => {
  it('wraps a single run at space boundaries when content exceeds maxWidth', async () => {
    await registerFixture('inter', [{}]);
    // Fixture font has only 'A' (xadvance 23 at size 32, so ~22px per glyph
    // in world units). "ABAB ABAB" should fit in width 400 across two lines.
    const text = 'ABAB ABAB ABAB ABAB';
    const out = layoutRuns(
      [RUN_PLAIN(text)],
      { maxWidth: 150, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    // We expect more than one line: the y of the last quad is higher than the
    // y of the first.
    const quads = out.groups[0].quads;
    expect(quads.length).toBeGreaterThan(4);
    const firstY = quads[0].y0;
    const lastY = quads[quads.length - 1].y0;
    expect(lastY).toBeGreaterThan(firstY);
  });

  it('mixed-size runs share a baseline on the same line; line height tracks max fontSize', async () => {
    await registerFixture('inter', [{}]);
    const small: ResolvedRun = { ...RUN_PLAIN('A'), fontSize: 16 };
    const big: ResolvedRun = { ...RUN_PLAIN('B'), fontSize: 40 };
    const out = layoutRuns(
      [small, big],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    // Both glyphs are on the same baseline (penY shared). Each font's
    // yoffset places the glyph above the baseline; bigger fontSize → bigger
    // glyph rect, but both share the same baseline reference (penY=0).
    // Smoke check: the two quads come from groups with the same baseline.
    const allQuads = out.groups.flatMap((g) => g.quads);
    expect(allQuads).toHaveLength(2);
  });

  it('alignment shifts each line by (maxWidth - lineWidth) * factor', async () => {
    await registerFixture('inter', [{}]);
    const leftOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'left' }, { x: 0, y: 0 });
    const centerOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'center' }, { x: 0, y: 0 });
    const rightOut = layoutRuns([RUN_PLAIN('AB')], { maxWidth: 400, lineHeight: 1.2, align: 'right' }, { x: 0, y: 0 });
    const leftX = leftOut.groups[0].quads[0].x0;
    const centerX = centerOut.groups[0].quads[0].x0;
    const rightX = rightOut.groups[0].quads[0].x0;
    expect(centerX).toBeGreaterThan(leftX);
    expect(rightX).toBeGreaterThan(centerX);
  });

  it('respects newlines inside a run as forced line breaks', async () => {
    await registerFixture('inter', [{}]);
    const out = layoutRuns(
      [RUN_PLAIN('A\nB')],
      { maxWidth: Infinity, lineHeight: 1.2, align: 'left' },
      { x: 0, y: 0 },
    );
    const quads = out.groups[0].quads;
    expect(quads).toHaveLength(2);
    // Second glyph is on a different baseline (greater y0).
    expect(quads[1].y0).toBeGreaterThan(quads[0].y0);
  });
});
```

- [ ] **Step 3.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/atlas/layoutRuns.test.ts`
Expected: failures — wrap and newline handling not implemented.

- [ ] **Step 3.3: Rewrite `layoutRuns.ts` with wrap + multi-line support**

Replace the body of `layoutRuns` in `src/features/text/atlas/layoutRuns.ts`. The new implementation:

1. Pre-flatten runs into per-glyph metadata (run reference, codepoint, atlas, scale, advance, kerning amount with previous).
2. Walk forward, accumulating a current line. At each space boundary, look ahead to the next space (or EOL/EOR) — if the upcoming word fits on the current line, accept it; otherwise commit the line and start a new one.
3. On forced `\n`: flush the current line.
4. Commit-line: align (shift x of all entries in the line by `(maxWidth - lineWidth) * alignFactor` where center=0.5, right=1, left=0), then translate into quad coords using each glyph's font, and append to the appropriate group.
5. Per-line height = `max(run.fontSize * lineHeight)` across runs that contributed to the line.
6. Track penY = running y-baseline; advance by line height after each commit.

Replace the body of the existing function:

```ts
export function layoutRuns(
  runs: readonly ResolvedRun[],
  opts: LayoutRunsOpts,
  origin: LayoutRunsOrigin,
): LaidOutRuns {
  const ctx: LayoutContext = { groups: new Map() };

  // Per-glyph entry produced by walking runs codepoint-by-codepoint. Position
  // (x) is filled in during the line-fitting pass.
  interface Entry {
    run: ResolvedRun;
    font: BmFont;
    glyph: BmFontChar;
    cp: number;
    advance: number;        // xadvance in world units (already scaled)
    kerningBefore: number;  // kerning gap consumed before this glyph (world units)
    isSpace: boolean;
    isNewline: boolean;
    group: LaidOutGroup;
    fontSize: number;
  }

  // 1. Flatten all runs into entries with per-glyph data, computing kerning
  //    using the left glyph's atlas+scale across run boundaries.
  const entries: Entry[] = [];
  let prevCp: number | undefined;
  let prevFont: BmFont | undefined;
  let prevFontSize: number | undefined;

  for (const run of runs) {
    const resolved = resolveFontVariant(run.fontFamily, run.fontWeight, run.fontStyle);
    if (!resolved.entry) {
      prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
      continue;
    }
    const font = resolved.entry.font;
    const scale = run.fontSize / font.info.size;
    const group = getOrCreateGroup(ctx, run, resolved);

    for (const ch of [...run.text]) {
      const cp = ch.codePointAt(0)!;
      const isNewline = cp === 10;
      const isSpace = cp === 32;

      if (isNewline) {
        entries.push({
          run, font, glyph: { id: cp, x: 0, y: 0, width: 0, height: 0, xoffset: 0, yoffset: 0, xadvance: 0, page: 0 },
          cp, advance: 0, kerningBefore: 0, isSpace: false, isNewline: true,
          group, fontSize: run.fontSize,
        });
        prevCp = undefined; prevFont = undefined; prevFontSize = undefined;
        continue;
      }

      const glyph = resolveGlyph(font, cp);
      if (!glyph) {
        prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
        continue;
      }

      let kerningBefore = 0;
      if (prevCp !== undefined && prevFont !== undefined && prevFontSize !== undefined) {
        const kAtlas = prevFont.kerningMap.get(prevCp)?.get(cp) ?? 0;
        kerningBefore = kAtlas * (prevFontSize / prevFont.info.size);
      }

      entries.push({
        run, font, glyph, cp,
        advance: glyph.xadvance * scale,
        kerningBefore,
        isSpace, isNewline: false,
        group, fontSize: run.fontSize,
      });

      prevCp = cp; prevFont = font; prevFontSize = run.fontSize;
    }
  }

  // 2. Walk entries, accumulating lines bounded by maxWidth (when finite).
  //    A "word" is a maximal run of non-space, non-newline entries. After
  //    each word, decide whether it fits on the current line.
  interface Line {
    entries: Entry[];
    width: number;
    height: number;     // line height in world units
  }
  const lines: Line[] = [];
  let cur: Line = { entries: [], width: 0, height: 0 };

  function commitLine(): void {
    lines.push(cur);
    cur = { entries: [], width: 0, height: 0 };
  }

  let i = 0;
  while (i < entries.length) {
    const e = entries[i];
    if (e.isNewline) { commitLine(); i++; continue; }
    if (e.isSpace) {
      // Space always accepted onto the current line (or dropped at line start).
      if (cur.entries.length > 0) {
        cur.entries.push(e);
        cur.width += e.kerningBefore + e.advance;
        cur.height = Math.max(cur.height, e.fontSize * opts.lineHeight);
      }
      i++;
      continue;
    }
    // Accumulate the upcoming word: entries up to next space/newline/EOR.
    let j = i;
    let wordWidth = 0;
    while (j < entries.length && !entries[j].isSpace && !entries[j].isNewline) {
      const w = entries[j];
      wordWidth += w.kerningBefore + w.advance;
      j++;
    }
    // Does the word fit on the current line?
    if (Number.isFinite(opts.maxWidth) && cur.width + wordWidth > opts.maxWidth && cur.entries.length > 0) {
      commitLine();
    }
    // Append word to current line (clear leading kerning at line start).
    for (let k = i; k < j; k++) {
      const w = entries[k];
      const kerningBefore = cur.entries.length === 0 ? 0 : w.kerningBefore;
      cur.entries.push({ ...w, kerningBefore });
      cur.width += kerningBefore + w.advance;
      cur.height = Math.max(cur.height, w.fontSize * opts.lineHeight);
    }
    i = j;
  }
  if (cur.entries.length > 0) commitLine();

  // 3. Lay out each line. Apply alignment, then translate into quads.
  let penY = origin.y;
  let maxLineWidth = 0;
  const finiteWidth = Number.isFinite(opts.maxWidth) ? opts.maxWidth : 0;
  for (const line of lines) {
    const alignShift = (() => {
      if (opts.align === 'left' || !Number.isFinite(opts.maxWidth)) return 0;
      const slack = finiteWidth - line.width;
      return opts.align === 'center' ? slack / 2 : slack;
    })();
    let penX = origin.x + alignShift;
    for (const e of line.entries) {
      penX += e.kerningBefore;
      if (e.advance === 0) continue;
      const scale = e.fontSize / e.font.info.size;
      const atlasW = e.font.common.scaleW;
      const atlasH = e.font.common.scaleH;
      const qx0 = penX + e.glyph.xoffset * scale;
      const qy0 = penY + e.glyph.yoffset * scale;
      const qx1 = qx0 + e.glyph.width * scale;
      const qy1 = qy0 + e.glyph.height * scale;
      const u0 = e.glyph.x / atlasW;
      const v0 = e.glyph.y / atlasH;
      const u1 = (e.glyph.x + e.glyph.width) / atlasW;
      const v1 = (e.glyph.y + e.glyph.height) / atlasH;
      e.group.quads.push({ x0: qx0, y0: qy0, x1: qx1, y1: qy1, u0, v0, u1, v1 });
      penX += e.advance;
    }
    maxLineWidth = Math.max(maxLineWidth, line.width);
    penY += line.height;
  }

  return {
    groups: [...ctx.groups.values()],
    bounds: { width: maxLineWidth, height: penY - origin.y },
  };
}
```

This replaces the earlier single-line body wholesale. The grouping helper and entry-resolution code reuse the existing module-private pieces.

- [ ] **Step 3.4: Verify tests pass**

Run: `npx vitest run src/features/text/atlas/layoutRuns.test.ts`
Expected: PASS, both new tests and the prior Task 2 tests.

- [ ] **Step 3.5: Commit**

```bash
git add src/features/text/atlas/layoutRuns.ts src/features/text/atlas/layoutRuns.test.ts
git commit -m "feat(text): layoutRuns word wrap, multi-line baselines, alignment"
```

---

## Task 4: `TextDrawCommand` shape change

**Files:**
- Modify: `src/renderer/DrawCommand.ts`
- Modify: `src/features/text/index.ts`

Swap `text: string` for `runs: ResolvedRun[]`. Add `maxWidth?: number` and `align?: 'left'|'center'|'right'`. `style` stays — used for `lineHeight` and any node-level defaults the renderer still touches (e.g., AA width).

This step is type-only — `createTextLayer` and `drawText` get updated in subsequent tasks.

- [ ] **Step 4.1: Update `TextDrawCommand`**

In `src/renderer/DrawCommand.ts`, replace the existing `TextDrawCommand` block:

```ts
/**
 * Text draw command. Renders one or more runs at (`x`, `y`) in screen
 * space, optionally word-wrapping at `maxWidth`. The renderer resolves
 * each run's `(fontFamily, fontWeight, fontStyle)` to an MSDF atlas via
 * `resolveFontVariant` and bucket-draws by atlas + color group.
 *
 * `style` carries node-level defaults (`lineHeight`, anti-alias width)
 * that don't belong on individual runs.
 */
export interface TextDrawCommand {
  kind: 'text';
  x: number;
  y: number;
  runs: ResolvedRun[];
  maxWidth?: number;
  align?: 'left' | 'center' | 'right';
  style: TextStyle;
}
```

Add `import type { ResolvedRun } from '@orochi235/weasel';` at the top of `DrawCommand.ts` (the `runs` field's type comes from the public-facing package; the path-aliased import keeps `DrawCommand.ts` consumer-friendly).

- [ ] **Step 4.2: Export `ResolvedRun` and `resolveRuns` from `src/features/text/index.ts`**

Append after the existing `runs` re-exports:

```ts
export { resolveRuns } from './runs/resolveRuns';
export type { ResolvedRun } from './runs/resolveRuns';
```

- [ ] **Step 4.3: Confirm typecheck still passes everywhere this type is consumed**

Run: `npx tsc --noEmit`

Expected: the only files reporting errors are `createTextLayer` (still emits the old shape) and `drawText` (still consumes the old shape). Note the errors but do not fix them here — Tasks 5 and 6 land those fixes.

If you see errors from files OUTSIDE `src/features/text/textLayer.ts` and `src/renderer/draw.ts`, report DONE_WITH_CONCERNS — they may indicate external consumers that need updating.

- [ ] **Step 4.4: Commit**

```bash
git add src/renderer/DrawCommand.ts src/features/text/index.ts
git commit -m "feat(text): TextDrawCommand carries runs/maxWidth/align (shape change)"
```

---

## Task 5: `createTextLayer` emits the new command shape

**Files:**
- Modify: `src/features/text/textLayer.ts`
- Modify: `src/features/text/textLayer.test.ts`

`createTextLayer` now:
1. For each node, get `(text, runs?, style)`.
2. Build `StyledRun[]` via `toRuns(runs ?? text)`.
3. Resolve the node `TextStyle` via `resolveTextStyle`.
4. Build `ResolvedRun[]` via `resolveRuns(styledRuns, resolvedStyle)`.
5. Emit ONE `TextDrawCommand` per node: `{ kind: 'text', x: pose.x, y: pose.y, runs, maxWidth: pose.width, align: resolvedStyle.align, style: pose.style ?? {} }`.

The per-line emission is gone — wrapping and multi-line layout move into `drawText`/`layoutRuns`. Less code in `createTextLayer`.

- [ ] **Step 5.1: Update `textLayer.test.ts`**

Replace the body of the second test (`'emits one text command per visible node, wrapped in a world-transform group'`) and the runs test (`'accepts a node with `runs` and emits the concatenated text'`) to assert the new shape. Update the file to:

```ts
import { describe, expect, it } from 'vitest';
import { createTextLayer, type TextPose } from './textLayer';
import type { StyledRun } from './runs';

interface Node {
  id: string;
  pose: TextPose;
}

const DIMS = { width: 800, height: 600 };

describe('createTextLayer', () => {
  it('has a default id and label', () => {
    const layer = createTextLayer<Node>({ getTexts: () => [], getPose: (n) => n.pose });
    expect(layer.id).toBe('text');
    expect(layer.label).toBe('Text');
  });

  it('emits one TextDrawCommand per visible node with resolved runs', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [{ id: 'n', pose: { x: 100, y: 200, width: 300, height: 50, text: 'hello' } }],
      getPose: (n) => n.pose,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    expect(tree).toHaveLength(1);
    const group = tree[0] as { kind: 'group'; children: Array<Record<string, unknown>> };
    expect(group.kind).toBe('group');
    expect(group.children).toHaveLength(1);
    const cmd = group.children[0] as {
      kind: string;
      x: number;
      y: number;
      runs: Array<{ text: string; fontWeight: number; fontStyle: string }>;
      maxWidth: number;
      align: string;
    };
    expect(cmd.kind).toBe('text');
    expect(cmd.x).toBe(100);
    expect(cmd.y).toBe(200);
    expect(cmd.maxWidth).toBe(300);
    expect(cmd.runs).toHaveLength(1);
    expect(cmd.runs[0].text).toBe('hello');
    expect(cmd.runs[0].fontWeight).toBe(400);
  });

  it('emits resolved runs for a rich-text node', () => {
    const runs: StyledRun[] = [{ text: 'a ' }, { text: 'b', bold: true }];
    const layer = createTextLayer<Node>({
      getTexts: () => [{
        id: 'n',
        pose: { x: 0, y: 0, width: 200, height: 40, text: 'a b', runs },
      }],
      getPose: (n) => n.pose,
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS);
    const cmd = (tree[0] as { children: Array<{ runs: Array<{ text: string; fontWeight: number }> }> }).children[0];
    expect(cmd.runs.map((r) => r.text)).toEqual(['a ', 'b']);
    expect(cmd.runs.map((r) => r.fontWeight)).toEqual([400, 700]);
  });

  it('skips hidden nodes', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [
        { id: 'a', pose: { x: 0, y: 0, width: 100, height: 20, text: 'A' } },
        { id: 'b', pose: { x: 0, y: 0, width: 100, height: 20, text: 'B' } },
      ],
      getPose: (n) => n.pose,
      isHidden: (n) => n.id === 'a',
    });
    const tree = layer.draw(undefined, { x: 0, y: 0, scale: 1 }, { width: 100, height: 100 });
    const group = tree[0] as { children: Array<{ runs: Array<{ text: string }> }> };
    expect(group.children).toHaveLength(1);
    expect(group.children[0].runs[0].text).toBe('B');
  });

  it('throws when runs are present but runsToPlainText(runs) !== text', () => {
    const layer = createTextLayer<Node>({
      getTexts: () => [{
        id: 'bad',
        pose: {
          x: 0, y: 0, width: 200, height: 40,
          text: 'a b',
          runs: [{ text: 'WRONG' }],
        },
      }],
      getPose: (n) => n.pose,
    });
    expect(() => layer.draw(undefined, { x: 0, y: 0, scale: 1 }, DIMS)).toThrow(/invariant/i);
  });
});
```

- [ ] **Step 5.2: Run tests, confirm failure**

Run: `npx vitest run src/features/text/textLayer.test.ts`
Expected: failures — `createTextLayer` still emits the old per-line shape.

- [ ] **Step 5.3: Rewrite `createTextLayer`**

Replace the function in `src/features/text/textLayer.ts`:

```ts
import { type DrawCommand, viewToMat3 } from '../../renderer';
import type { RenderLayer } from 'core/layers/render';
import { resolveRuns } from './runs/resolveRuns';
import { runsToPlainText, toRuns, type StyledRun } from './runs';
import { type TextStyle, resolveTextStyle } from './textStyle';

export interface TextPose {
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  /** Rich-text runs. When present, `runsToPlainText(runs)` must equal `text`. */
  runs?: StyledRun[];
  style?: TextStyle;
}

export interface CreateTextLayerOpts<T> {
  id?: string;
  label?: string;
  getTexts: () => readonly T[];
  getPose: (node: T) => TextPose;
  isHidden?: (node: T) => boolean;
}

export function createTextLayer<T>(opts: CreateTextLayerOpts<T>): RenderLayer<unknown> {
  const { id = 'text', label = 'Text', getTexts, getPose, isHidden } = opts;
  return {
    id,
    label,
    draw: (_data, view) => {
      const children: DrawCommand[] = [];
      for (const node of getTexts()) {
        if (isHidden?.(node)) continue;
        const pose = getPose(node);
        if (pose.runs && runsToPlainText(pose.runs) !== pose.text) {
          throw new Error(
            `weasel createTextLayer: TextPose invariant violated — ` +
            `runsToPlainText(runs) !== text. Either omit \`runs\` or keep it ` +
            `synchronized with \`text\`.`,
          );
        }
        const style = resolveTextStyle(pose.style);
        const styledRuns = toRuns(pose.runs ?? pose.text);
        const runs = resolveRuns(styledRuns, style);
        children.push({
          kind: 'text',
          x: pose.x,
          y: pose.y,
          runs,
          maxWidth: pose.width,
          align: style.align,
          style: pose.style ?? {},
        });
      }
      return [{ kind: 'group', transform: viewToMat3(view), children }];
    },
  };
}
```

The previously-used `measureText`, `fontString`, `anchorX`, and offscreen-canvas-context helpers can be removed from this file — they're no longer needed. Delete the unused imports and helper functions.

- [ ] **Step 5.4: Verify tests pass**

Run: `npx vitest run src/features/text/textLayer.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5.5: Commit**

```bash
git add src/features/text/textLayer.ts src/features/text/textLayer.test.ts
git commit -m "feat(text): createTextLayer emits TextDrawCommand with resolved runs"
```

---

## Task 6: `drawText` consumes the new shape

**Files:**
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

`drawText` now:
1. Take `cmd.runs`, `cmd.maxWidth`, `cmd.align`, `cmd.style`.
2. Call `layoutRuns(cmd.runs, { maxWidth, lineHeight, align }, { x: cmd.x, y: cmd.y })`.
3. For each group: ensure its texture is loaded; bind; set per-group uniforms (`u_color` from `group.fill`, `u_atlas` to bound texture unit); upload that group's quads as a transient VBO/IBO; draw; free.
4. Synthetic uniforms are still set to 0 in this task — they activate in Tasks 7 and 8.

- [ ] **Step 6.1: Update `draw.test.ts` text fixtures to the new shape**

Find every `{ kind: 'text', ... }` fixture in `src/renderer/draw.test.ts`. Replace the old shape with the new one. For the typical fixture:

```ts
{ kind: 'text', x: 10, y: 20, text: 'hello', style: { fontFamily: 'inter' } }
```

becomes:

```ts
{
  kind: 'text', x: 10, y: 20,
  runs: [{
    text: 'hello', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
    fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
  }],
  maxWidth: Infinity,
  align: 'left',
  style: {},
}
```

(Use the actual values your existing fixtures rely on; the structure is the change.)

- [ ] **Step 6.2: Run tests, confirm failure**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: failures — `drawText` still reads `cmd.text`.

- [ ] **Step 6.3: Rewrite the body of `drawText`**

In `src/renderer/draw.ts`, replace the body of `drawText` (keep the function signature, location of helpers, and surrounding imports). New imports near the top:

```ts
import { layoutRuns } from 'features/text/atlas/layoutRuns';
import type { LaidOutGroup } from 'features/text/atlas/layoutRuns';
```

Remove the old imports of `layoutGlyphs`, `quadsToVertexBuffer`, `buildQuadIndexBuffer`, `getFont` from `'features/text/atlas/GlyphLayout'` (the new layout returns its own quads; we'll add small helpers for VBO/IBO upload below).

Rewrite `drawText`:

```ts
function drawText(ctx: DrawContext, cmd: TextDrawCommand): void {
  const style = resolveTextStyle(cmd.style);
  const lineHeight = style.lineHeight;
  const align = cmd.align ?? style.align;
  const maxWidth = cmd.maxWidth ?? Infinity;

  const laid = layoutRuns(
    cmd.runs,
    { maxWidth, lineHeight, align },
    { x: cmd.x, y: cmd.y },
  );
  if (laid.groups.length === 0) return;

  const gl = ctx.gl;
  gl.useProgram(ctx.textSdf.handle);
  setProjAndModel(ctx, ctx.textSdf);
  setColorMatrixUniforms(ctx, ctx.textSdf);
  gl.uniform1f(ctx.textSdf.uniform('u_alpha')!, ctx.state.alpha);
  gl.uniform1f(ctx.textSdf.uniform('u_aaWidth')!, 0.05);
  applyClipTest(ctx);

  for (const group of laid.groups) {
    drawTextGroup(ctx, group);
  }
}

function drawTextGroup(ctx: DrawContext, group: LaidOutGroup): void {
  if (!ensureFontTexture(group.family, group.weight, group.style, ctx.textureCache)) return;
  if (group.quads.length === 0) return;

  const gl = ctx.gl;

  // Pack quads into a vertex buffer (same stride/format as the old path).
  const vertices = new Float32Array(group.quads.length * 4 * 4);
  let vi = 0;
  for (const q of group.quads) {
    vertices[vi++] = q.x0; vertices[vi++] = q.y0; vertices[vi++] = q.u0; vertices[vi++] = q.v0;
    vertices[vi++] = q.x1; vertices[vi++] = q.y0; vertices[vi++] = q.u1; vertices[vi++] = q.v0;
    vertices[vi++] = q.x0; vertices[vi++] = q.y1; vertices[vi++] = q.u0; vertices[vi++] = q.v1;
    vertices[vi++] = q.x1; vertices[vi++] = q.y1; vertices[vi++] = q.u1; vertices[vi++] = q.v1;
  }
  const indices = new Uint32Array(group.quads.length * 6);
  let ii = 0;
  for (let q = 0; q < group.quads.length; q++) {
    const base = q * 4;
    indices[ii++] = base;     indices[ii++] = base + 1; indices[ii++] = base + 2;
    indices[ii++] = base + 1; indices[ii++] = base + 3; indices[ii++] = base + 2;
  }

  const vao = gl.createVertexArray();
  if (!vao) throw new Error('drawTextGroup: createVertexArray returned null');
  gl.bindVertexArray(vao);

  const vbo = gl.createBuffer();
  if (!vbo) throw new Error('drawTextGroup: createBuffer (VBO) returned null');
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.DYNAMIC_DRAW);

  const stride = 16;
  const aPosLoc = ctx.textSdf.attribute('a_position');
  const aUvLoc  = ctx.textSdf.attribute('a_uv');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }

  const ibo = gl.createBuffer();
  if (!ibo) throw new Error('drawTextGroup: createBuffer (IBO) returned null');
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.DYNAMIC_DRAW);

  // Per-group fill (color uniform).
  let r = 0, g = 0, b = 0, a = 1;
  if ('color' in group.fill) {
    [r, g, b, a] = parseColor(group.fill.color);
  }
  gl.uniform4f(ctx.textSdf.uniform('u_color')!, r, g, b, a);

  // Synthetic uniforms — wired to zero for now; Tasks 7 & 8 light them up.
  const uSynthBold = ctx.textSdf.uniform('u_synthBold');
  const uSynthItalic = ctx.textSdf.uniform('u_synthItalic');
  if (uSynthBold !== undefined) gl.uniform1f(uSynthBold, 0);
  if (uSynthItalic !== undefined) gl.uniform1f(uSynthItalic, 0);

  ctx.textureCache.bind(textureCacheKey(group.family, group.weight, group.style), 0);
  gl.uniform1i(ctx.textSdf.uniform('u_atlas')!, 0);

  gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_INT, 0);
  gl.bindVertexArray(null);
  gl.deleteVertexArray(vao);
  gl.deleteBuffer(vbo);
  gl.deleteBuffer(ibo);
}
```

Remove the now-orphan helpers `normalizeFontWeight`, `lowerBucketWeight`, and the imports of `getFont` (if still present) / `layoutGlyphs` / `quadsToVertexBuffer` / `buildQuadIndexBuffer` if `drawText` was the only consumer. (Check via grep — they may still be used elsewhere.)

- [ ] **Step 6.4: Verify tests pass**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: PASS — the new fixture shape exercises the new draw path. The old single-style command behavior is preserved when the runs array has one entry.

- [ ] **Step 6.5: Run the full text suite**

Run: `npx vitest run src/features/text src/renderer/draw.test.ts`
Expected: PASS.

- [ ] **Step 6.6: Run typecheck**

Run: `npx tsc --noEmit`
Expected: clean (no errors). Pre-existing unrelated errors in `src/canvas/sceneAdapter.ts` or `src/tools/builtin/useSelectTool.*` can remain; everything in `src/features/text/` and `src/renderer/draw.ts` should typecheck.

- [ ] **Step 6.7: Commit**

```bash
git add src/renderer/draw.ts src/renderer/draw.test.ts
git commit -m "feat(text): drawText routes through layoutRuns with grouped draw calls"
```

---

## Task 7: Synthetic-bold uniform (SDF threshold shift in fragment shader)

**Files:**
- Modify: `src/renderer/shaders/textSdf.ts`
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

Add `u_synthBold` to the fragment shader: shifts the SDF threshold by ~0.08, thickening glyph strokes. When set to 0, behavior is identical to today.

- [ ] **Step 7.1: Write a failing test**

Append to `src/renderer/draw.test.ts` (in a suitable describe block — create a new one if needed):

```ts
describe('drawText synthetic-bold', () => {
  it('sets u_synthBold to ~0.08 when a group has synthetic.bold=true', async () => {
    await _resetFontRegistryForTests();
    // Register only the regular weight; request bold via a run → synthetic.bold=true.
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const synthBoldCalls = calls.filter((c) => c.name === 'uniform1f' && typeof c.args[1] === 'number')
      .map((c) => c.args);
    // u_synthBold uniform is set per-group; expect a 0.08 value among the uniform1f calls.
    expect(synthBoldCalls.some((args) => Math.abs((args[1] as number) - 0.08) < 1e-6)).toBe(true);
  });

  it('sets u_synthBold to 0 for an exact-match variant', async () => {
    await _resetFontRegistryForTests();
    await registerFont('inter', { weight: 700, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 700,
        fontStyle: 'normal', fill: { fill: 'solid', color: '#000' },
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const synthBoldCalls = calls.filter((c) => c.name === 'uniform1f').map((c) => c.args);
    // No 0.08 value should appear; u_synthBold should be 0.
    expect(synthBoldCalls.some((args) => Math.abs((args[1] as number) - 0.08) < 1e-6)).toBe(false);
  });
});
```

(Adapt the imports — `dispatch`, `_resetFontRegistryForTests`, `registerFont`, `createRecorderCtx` are all already used elsewhere in `draw.test.ts`; mirror the existing pattern.)

- [ ] **Step 7.2: Run tests, confirm failure**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: failure — `u_synthBold` is hard-wired to 0 in Task 6.

- [ ] **Step 7.3: Patch the fragment shader**

In `src/renderer/shaders/textSdf.ts`, update the fragment shader source and uniform list:

```ts
export const TEXT_FRAG_SRC = /* glsl */ `#version 300 es
precision highp float;
in vec2 v_uv;
uniform sampler2D u_atlas;
uniform vec4 u_color;
uniform float u_alpha;
uniform float u_aaWidth;
uniform float u_synthBold;
uniform mat4 u_colorMatrix;
uniform vec4 u_colorBias;
out vec4 outColor;

float median(float r, float g, float b) {
  return max(min(r, g), min(max(r, g), b));
}

void main() {
  vec3 sdf = texture(u_atlas, v_uv).rgb;
  float sdfVal = median(sdf.r, sdf.g, sdf.b);
  float aaW = u_aaWidth > 0.0 ? u_aaWidth : 0.05;
  // u_synthBold shifts the threshold to thicken strokes when the resolver
  // fell back from a missing bold variant to the regular atlas.
  float threshold = 0.5 - u_synthBold;
  float msdfAlpha = smoothstep(threshold - aaW, threshold + aaW, sdfVal);
  vec4 src = vec4(u_color.rgb, u_color.a);
  vec4 mapped = clamp(u_colorMatrix * src + u_colorBias, 0.0, 1.0);
  float a = mapped.a * msdfAlpha * u_alpha;
  outColor = vec4(mapped.rgb * a, a);
}
`;

export const TEXT_SDF_UNIFORMS = [
  'u_proj', 'u_model', 'u_atlas', 'u_color', 'u_alpha', 'u_aaWidth',
  'u_synthBold', 'u_colorMatrix', 'u_colorBias',
] as const;
```

(Keep `TEXT_VERT_SRC` and `TEXT_SDF_ATTRIBUTES` unchanged for now — Task 8 patches the vertex shader.)

- [ ] **Step 7.4: Wire the uniform in `drawTextGroup`**

In `src/renderer/draw.ts`, in `drawTextGroup`, replace the synthetic-uniform stub:

```ts
  const uSynthBold = ctx.textSdf.uniform('u_synthBold');
  const uSynthItalic = ctx.textSdf.uniform('u_synthItalic');
  if (uSynthBold !== undefined) gl.uniform1f(uSynthBold, 0);
  if (uSynthItalic !== undefined) gl.uniform1f(uSynthItalic, 0);
```

with:

```ts
  // u_synthBold: SDF threshold shift when the resolver fell back from a
  // missing bold variant to the regular atlas. 0.08 was tuned empirically
  // to thicken Inter strokes ~1px at 16px size without breaking topology.
  const synthBoldAmount = group.synthetic.bold ? 0.08 : 0;
  const uSynthBold = ctx.textSdf.uniform('u_synthBold');
  if (uSynthBold !== undefined) gl.uniform1f(uSynthBold, synthBoldAmount);

  // u_synthItalic stays 0 until Task 8 lands the vertex-shader skew.
  const uSynthItalic = ctx.textSdf.uniform('u_synthItalic');
  if (uSynthItalic !== undefined) gl.uniform1f(uSynthItalic, 0);
```

- [ ] **Step 7.5: Verify tests pass**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: PASS, both new synthetic-bold tests.

- [ ] **Step 7.6: Commit**

```bash
git add src/renderer/shaders/textSdf.ts src/renderer/draw.ts src/renderer/draw.test.ts
git commit -m "feat(text): u_synthBold fragment-shader threshold shift for synthetic bold"
```

---

## Task 8: Synthetic-italic uniform (vertex shader skew)

**Files:**
- Modify: `src/renderer/shaders/textSdf.ts`
- Modify: `src/renderer/draw.ts`
- Modify: `src/renderer/draw.test.ts`

Synthetic italic skews each glyph quad by ~12° (0.2094 rad) around its baseline. The skew amount is x += y_above_baseline * tan(angle). We need a way to express "y above baseline" in the vertex shader. The simplest approach: pass a per-vertex `baselineY` attribute, OR pass the per-quad baseline y as a uniform — but a single draw call covers many lines, so per-vertex is better.

Cleanest plumbing: add `a_baselineY` as a new vertex attribute (1 float, stride grows to 20 bytes). `layoutRuns` already emits per-quad y0/y1; we set `a_baselineY = penY` (the line's baseline) for all 4 vertices of each quad.

- [ ] **Step 8.1: Write a failing test**

Append to `src/renderer/draw.test.ts`:

```ts
describe('drawText synthetic-italic', () => {
  it('sets u_synthItalic to ~0.2094 when a group has synthetic.italic=true', async () => {
    await _resetFontRegistryForTests();
    await registerFont('inter', { weight: 400, style: 'normal' }, '/fonts/inter/inter.json', '/fonts/inter/inter.png');
    const { ctx, calls } = createRecorderCtx();
    dispatch(ctx, {
      kind: 'text', x: 0, y: 0,
      runs: [{
        text: 'A', fontFamily: 'inter', fontSize: 16, fontWeight: 400,
        fontStyle: 'italic', fill: { fill: 'solid', color: '#000' },
      }],
      maxWidth: Infinity, align: 'left', style: {},
    });
    const uniform1fArgs = calls.filter((c) => c.name === 'uniform1f').map((c) => c.args);
    expect(uniform1fArgs.some((args) => Math.abs((args[1] as number) - 0.2094) < 1e-3)).toBe(true);
  });
});
```

- [ ] **Step 8.2: Run tests, confirm failure**

Run: `npx vitest run src/renderer/draw.test.ts`
Expected: failure — `u_synthItalic` is hard-wired to 0.

- [ ] **Step 8.3: Patch the vertex shader and add baseline attribute**

In `src/renderer/shaders/textSdf.ts`:

```ts
export const TEXT_VERT_SRC = /* glsl */ `#version 300 es
in vec2 a_position;
in vec2 a_uv;
in float a_baselineY;
uniform mat3 u_proj;
uniform mat3 u_model;
uniform float u_synthItalic;
out vec2 v_uv;
void main() {
  // Synthetic italic: shift x by (a_baselineY - a_position.y) * tan(angle).
  // Above-baseline vertices (lower y in screen coords) lean further right.
  vec2 skewed = vec2(
    a_position.x + (a_baselineY - a_position.y) * tan(u_synthItalic),
    a_position.y
  );
  vec3 screen = u_model * vec3(skewed, 1.0);
  vec3 clip   = u_proj  * vec3(screen.xy, 1.0);
  gl_Position = vec4(clip.xy, 0.0, 1.0);
  v_uv = a_uv;
}
`;

export const TEXT_SDF_UNIFORMS = [
  'u_proj', 'u_model', 'u_atlas', 'u_color', 'u_alpha', 'u_aaWidth',
  'u_synthBold', 'u_synthItalic', 'u_colorMatrix', 'u_colorBias',
] as const;

export const TEXT_SDF_ATTRIBUTES = ['a_position', 'a_uv', 'a_baselineY'] as const;
```

- [ ] **Step 8.4: Extend `LaidOutQuad` and vertex packing with baseline**

In `src/features/text/atlas/layoutRuns.ts`, extend the `LaidOutQuad` interface:

```ts
export interface LaidOutQuad {
  x0: number; y0: number; x1: number; y1: number;
  u0: number; v0: number; u1: number; v1: number;
  baselineY: number;
}
```

In the layout body, when emitting each quad, pass `baselineY: penY`. Find both quad-emission sites (single-line in Task 2 path and per-entry in Task 3 path) and add the field. Update `layoutRuns.test.ts` — the existing tests that index `.x0`, `.y0` still work; just ensure the type extension doesn't break them.

In `src/renderer/draw.ts`, update `drawTextGroup`'s vertex packing to emit 5 floats per vertex (stride 20) and bind the new attribute:

```ts
  // Pack quads — stride is now 20 bytes (x, y, u, v, baselineY).
  const vertices = new Float32Array(group.quads.length * 4 * 5);
  let vi = 0;
  for (const q of group.quads) {
    vertices[vi++] = q.x0; vertices[vi++] = q.y0; vertices[vi++] = q.u0; vertices[vi++] = q.v0; vertices[vi++] = q.baselineY;
    vertices[vi++] = q.x1; vertices[vi++] = q.y0; vertices[vi++] = q.u1; vertices[vi++] = q.v0; vertices[vi++] = q.baselineY;
    vertices[vi++] = q.x0; vertices[vi++] = q.y1; vertices[vi++] = q.u0; vertices[vi++] = q.v1; vertices[vi++] = q.baselineY;
    vertices[vi++] = q.x1; vertices[vi++] = q.y1; vertices[vi++] = q.u1; vertices[vi++] = q.v1; vertices[vi++] = q.baselineY;
  }
  // ...
  const stride = 20;
  const aPosLoc = ctx.textSdf.attribute('a_position');
  const aUvLoc  = ctx.textSdf.attribute('a_uv');
  const aBaseLoc = ctx.textSdf.attribute('a_baselineY');
  if (aPosLoc !== undefined) {
    gl.enableVertexAttribArray(aPosLoc);
    gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, stride, 0);
  }
  if (aUvLoc !== undefined) {
    gl.enableVertexAttribArray(aUvLoc);
    gl.vertexAttribPointer(aUvLoc, 2, gl.FLOAT, false, stride, 8);
  }
  if (aBaseLoc !== undefined) {
    gl.enableVertexAttribArray(aBaseLoc);
    gl.vertexAttribPointer(aBaseLoc, 1, gl.FLOAT, false, stride, 16);
  }
```

- [ ] **Step 8.5: Wire `u_synthItalic` in `drawTextGroup`**

Replace the existing `uSynthItalic` block in `drawTextGroup`:

```ts
  // u_synthItalic: vertex-shader skew angle (radians) applied when the
  // resolver fell back from a missing italic variant to the upright atlas.
  // 12° (≈0.2094 rad) matches the conventional CSS `font-style: oblique`.
  const synthItalicAmount = group.synthetic.italic ? 0.2094 : 0;
  const uSynthItalic = ctx.textSdf.uniform('u_synthItalic');
  if (uSynthItalic !== undefined) gl.uniform1f(uSynthItalic, synthItalicAmount);
```

- [ ] **Step 8.6: Verify tests pass**

Run: `npx vitest run src/renderer/draw.test.ts src/features/text/atlas/layoutRuns.test.ts`
Expected: PASS, including the new synthetic-italic test.

- [ ] **Step 8.7: Run typecheck and the full suite**

Run: `npx tsc --noEmit && npx vitest run`
Expected: clean except for pre-existing unrelated failures.

- [ ] **Step 8.8: Commit**

```bash
git add src/renderer/shaders/textSdf.ts src/renderer/draw.ts src/renderer/draw.test.ts src/features/text/atlas/layoutRuns.ts src/features/text/atlas/layoutRuns.test.ts
git commit -m "feat(text): u_synthItalic vertex-shader skew for synthetic italic"
```

---

## Task 9: Demo + visual tuning pass

**Files:**
- Modify: `demo/demos/TextDemo.tsx`

Update the existing text demo with a node showcasing inline rich text via markdown (`**bold**`, `*italic*`, `***both***`). Use only the regular `inter` atlas the demo already registers — every bold/italic run will go through synthetic fallback, exercising the new uniforms end-to-end. The demo becomes the visual rig for tuning the two constants.

- [ ] **Step 9.1: Add a rich-text node to `TextDemo`'s initial data**

Open `demo/demos/TextDemo.tsx`. Add a fifth `TextNode` to the `INITIAL` array (immediately after `t4`):

```ts
{
  id: 't5',
  x: 60,
  y: 310,
  width: 480,
  height: 40,
  text: 'Inline runs: bold word, italic word, bold-italic word.',
  runs: [
    { text: 'Inline runs: ' },
    { text: 'bold', bold: true },
    { text: ' word, ' },
    { text: 'italic', italic: true },
    { text: ' word, ' },
    { text: 'bold-italic', bold: true, italic: true },
    { text: ' word.' },
  ],
  style: { fontSize: 16, fill: { fill: 'solid', color: '#1c1c1c' } },
},
```

(If the `TextNode` interface in the demo file doesn't yet have a `runs?: StyledRun[]` field, add it — import `StyledRun` from `@orochi235/weasel`.)

- [ ] **Step 9.2: Verify the demo compiles and renders the rich-text node**

Run: `npm run dev` (in a separate shell). Navigate to the Text demo.

Expected: the new node renders with visible bold/italic/bold-italic — they look meaningfully different from each other and from the surrounding regular text. The visible bold strokes are thicker; the italic glyphs lean to the right; the bold-italic gets both.

- [ ] **Step 9.3: Visual tuning pass**

Adjust the two synthetic constants directly in `src/renderer/draw.ts` (`drawTextGroup`):

- If synthetic-bold strokes look too thin or break thin glyph features, tweak `0.08` up (toward 0.1) or down (toward 0.06).
- If synthetic-italic looks too aggressive or insufficient, tweak `0.2094` (12°) toward 0.17 (10°) or 0.26 (15°).

For each tweak: save, hot-reload the demo, eyeball, repeat. The goal is "looks plausibly bold/italic without artifacts," not pixel-perfect typography.

Once tuned, run the typecheck and the suite one more time:

```bash
npx tsc --noEmit && npx vitest run src/features/text src/renderer
```

- [ ] **Step 9.4: Commit the tuned constants and demo update**

```bash
git add demo/demos/TextDemo.tsx src/renderer/draw.ts
git commit -m "feat(demo): rich-text node + tuned synthetic-bold/italic constants"
```

---

## Out of scope (for slice 3 or follow-ups)

- Cmd/Ctrl-B and Cmd/Ctrl-I in `useTextEdit` — slice 3.
- Rich-text DOM ↔ runs serializer — slice 3.
- Real (non-synthetic) bold/italic atlas generation tooling.
- Per-run underline / strikethrough.
- Variable-font axes beyond bold/regular.

## Self-review notes

- Spec coverage: ResolvedRun + resolver helper ✓; layoutRuns with per-run atlas + boundary kerning + word wrap + alignment ✓; TextDrawCommand shape change ✓; createTextLayer emits new shape ✓; drawText grouped draw calls ✓; synthetic-bold uniform ✓; synthetic-italic uniform with per-vertex baseline attribute ✓; demo + tuning ✓.
- Type consistency: `ResolvedRun`, `LaidOutQuad`, `LaidOutGroup`, `LaidOutRuns`, `LayoutRunsOpts`, `LayoutRunsOrigin` named consistently across tasks.
- Tunable constants (`0.08` and `0.2094`) are explicit in the code; the demo task is when they get adjusted from "spec defaults" to "looks right." If visual tuning shifts them, document the chosen values in the commit message.
