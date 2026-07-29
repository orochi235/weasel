# Text Properties Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give text two editing surfaces — node-level typography through the existing schema-driven `SelectionPanel`, and caret-range styling through a new tool options bar — backed by three new style keys and a public run-algebra API.

**Architecture:** Node-level properties are declared as schema leaves under `data.style.*` and rendered by machinery that already exists; the only kit change they need is N-segment node paths. Caret-range styling is a genuinely different thing (it addresses a range, not a path), so it gets pure run-algebra functions in core, a thin hook surface over them, and new chrome in `@weasel-js/ui`.

**Tech Stack:** TypeScript, React 19, vitest, WebGL2 (MSDF text), tsup, changesets.

**Spec:** `docs/superpowers/specs/2026-07-28-text-properties-design.md`

**Depends on:** `docs/superpowers/plans/2026-07-28-font-package-extraction.md` must land first — Task 11 imports `listFonts()` from `@weasel-js/font`, and every path below assumes the glyph tier has already moved. **This plan is written against the post-extraction tree.**

---

## Orientation for someone new to this repo

- `packages/core` is `@weasel-js/core`. Text lives in `packages/core/src/features/text/`. Inside core, imports use bare aliases (`core/paint-types`, `features/text/...`) mapped in the root `tsconfig.json`.
- **Text is runs, not a string.** A text node's content is `StyledRun[]` — `{ text, bold?, italic?, fontFamily?, fontSize?, fill? }`. A node also has a `TextStyle` that runs inherit from. `resolveTextStyle` fills defaults at render time; defaults are never written back to the node.
- **Two vitest projects matter here.** `npm run test:kit` runs `packages/core/**`; `npm run test:ui` runs everything else under `packages/**`. Draw's tests are `npm run test:draw`.
- **Never run `git add -A`** — another session may share this checkout. Stage explicit paths.
- The GL text path is tested with a fake GL recorder; see `packages/core/src/renderer/draw.test.ts` (~line 296) for the established setup, including how a fixture font gets registered by stubbing `fetch`.

---

## File Structure

**Created:**

| Path | Responsibility |
| --- | --- |
| `packages/core/src/features/text/runs/rangeStyle.ts` | `styleAtRange` / `applyStyleToRange` — the pure run algebra |
| `packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.tsx` | Chrome strip above the workspace; knows nothing about text |
| `packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.module.css` | Its styles, from theme tokens |
| `packages/ui/src/components/ToolOptionsBar/index.ts` | Barrel |
| `apps/draw/src/ui/CharacterOptions/CharacterOptions.tsx` | The bar's first tenant — caret-range controls |
| `apps/draw/src/ui/CharacterOptions/FontFamilySelect.tsx` | Custom-leaf renderer reading the font registry |

**Modified:** `packages/ui/src/components/SelectionPanel/model.ts`, `.../SelectionPanel.tsx`, `packages/core/src/features/text/textStyle.ts`, `.../runs.ts`, `.../useTextEdit.ts`, `.../domRuns.ts`, `.../atlas/layoutRuns.ts`, `packages/core/src/renderer/draw.ts`, `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts`, `packages/svg/src/{cascade,parse,serialize}.ts`, `apps/draw/src/App.tsx`.

---

## Task 1: N-segment node paths

`SelectionPanel`'s model splits a node path at the **first** dot and reads exactly one level, and `commit` mirrors that with a shallow spread. `data.style.fontSize` would resolve to `data['style.fontSize']` — undefined — and writing it would create a literally-dotted key. Everything else in this plan depends on fixing that.

**Files:**
- Modify: `packages/ui/src/components/SelectionPanel/model.ts`, `packages/ui/src/components/SelectionPanel/SelectionPanel.tsx`
- Test: `packages/ui/src/components/SelectionPanel/model.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/ui/src/components/SelectionPanel/model.test.ts`. Match the existing file's import style and node-fixture helpers rather than inventing new ones — read the top of the file first.

```ts
describe('nested node paths', () => {
  const node = makeNode({ pose: { x: 1 }, data: { style: { fontSize: 18, fill: { color: '#f00' } } } });

  it('reads a three-segment path', () => {
    expect(nodeValueAt(node, 'data.style.fontSize')).toBe(18);
  });

  it('reads a four-segment path', () => {
    expect(nodeValueAt(node, 'data.style.fill.color')).toBe('#f00');
  });

  it('returns undefined for a missing intermediate segment', () => {
    expect(nodeValueAt(makeNode({ data: {} }), 'data.style.fontSize')).toBeUndefined();
  });

  it('still reads two-segment paths', () => {
    expect(nodeValueAt(node, 'pose.x')).toBe(1);
  });

  it('aggregates a nested path to MIXED when nodes disagree', () => {
    const a = makeNode({ data: { style: { fontSize: 12 } } });
    const b = makeNode({ data: { style: { fontSize: 18 } } });
    expect(aggregateValue([a, b], 'data.style.fontSize')).toBe(MIXED);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/SelectionPanel/model.test.ts`
Expected: FAIL — the three- and four-segment reads return `undefined`.

- [ ] **Step 3: Generalize the read path**

In `packages/ui/src/components/SelectionPanel/model.ts`, `splitNodePath` currently returns `{ head, key }` from the first dot. Keep it (other call sites use it) but make `nodeValueAt` walk:

```ts
/** Read a node value at a dotted path of any depth (`pose.x`,
 *  `data.style.fontSize`, `data.style.fill.color`). Returns `undefined` if any
 *  intermediate segment is missing or not an object. */
export function nodeValueAt(node: AnyNode, path: string): unknown {
  const segments = path.split('.');
  const head = segments[0];
  let cursor: unknown = head === 'pose' ? node.pose : head === 'data' ? node.data : undefined;
  for (let i = 1; i < segments.length; i++) {
    if (cursor == null || typeof cursor !== 'object') return undefined;
    cursor = (cursor as Record<string, unknown>)[segments[i]];
  }
  return cursor;
}
```

- [ ] **Step 4: Generalize the write path**

In `SelectionPanel.tsx`, `commit` currently does `{ ...node.data, [key]: value }`. Replace the per-node write with an immutable nested set. Add this helper next to `commit`:

```ts
/** Immutably set `value` at a dotted path within `root`, cloning each level
 *  on the way down so React sees new object identities. */
function setAtPath(root: object, segments: readonly string[], value: unknown): object {
  const [head, ...rest] = segments;
  if (rest.length === 0) return { ...root, [head]: value };
  const child = (root as Record<string, unknown>)[head];
  const childObj = child != null && typeof child === 'object' ? (child as object) : {};
  return { ...root, [head]: setAtPath(childObj, rest, value) };
}
```

…and rewrite the body of the `scene.batch` loop:

```ts
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        const [head, ...rest] = leaf.path.split('.');
        if (rest.length === 0) continue;
        if (head === 'pose') {
          scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
        }
      }
```

Note the missing-intermediate case creates the object (`childObj` defaults to `{}`), which is what you want: setting `data.style.fontSize` on a node with no `style` yet must work.

- [ ] **Step 5: Run the tests**

Run: `npm run test:ui`
Expected: PASS — new tests plus the existing `SelectionPanel.test.tsx` suite, which exercises two-segment paths and must be unaffected.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/SelectionPanel/model.ts packages/ui/src/components/SelectionPanel/SelectionPanel.tsx packages/ui/src/components/SelectionPanel/model.test.ts
git commit -m "feat(ui): SelectionPanel reads and writes nested node paths

A one-level property model was always going to fail the first nested data
shape it met; text style is that shape."
```

---

## Task 2: New style keys

**Files:**
- Modify: `packages/core/src/features/text/textStyle.ts`, `packages/core/src/features/text/runs.ts`
- Test: `packages/core/src/features/text/textStyle.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/features/text/textStyle.test.ts`:

```ts
describe('new typography keys', () => {
  it('defaults letterSpacing to 0 and decoration to off', () => {
    const s = resolveTextStyle({});
    expect(s.letterSpacing).toBe(0);
    expect(s.underline).toBe(false);
    expect(s.strikethrough).toBe(false);
  });

  it('passes explicit values through', () => {
    const s = resolveTextStyle({ letterSpacing: 1.5, underline: true, strikethrough: true });
    expect(s.letterSpacing).toBe(1.5);
    expect(s.underline).toBe(true);
    expect(s.strikethrough).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/textStyle.test.ts`
Expected: FAIL — properties don't exist on the resolved type.

- [ ] **Step 3: Add the keys**

In `textStyle.ts`, add to `TextStyle` (keep the existing doc-comment style — every field documents its default):

```ts
  /** Extra advance added after each glyph, in world units. Default 0. */
  letterSpacing?: number;
  /** Default `false`. */
  underline?: boolean;
  /** Default `false`. */
  strikethrough?: boolean;
```

Add the same three (non-optional) to `ResolvedTextStyle`, add `letterSpacing: 0, underline: false, strikethrough: false` to `DEFAULT_TEXT_STYLE`, and extend `resolveTextStyle`'s return with the `??` fallbacks matching every other field.

In `runs.ts`, add the same three optional keys to `StyledRun`, following its existing comment convention ("Every field except `text` is optional; missing fields fall back to the node-level `TextStyle`").

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit`
Expected: PASS. `resolveRuns` merges run over style generically, so it should need no change — if a test says otherwise, read `runs/resolveRuns.ts` before touching it.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text/textStyle.ts packages/core/src/features/text/runs.ts packages/core/src/features/text/textStyle.test.ts
git commit -m "feat(text): letterSpacing, underline, strikethrough on TextStyle and StyledRun"
```

---

## Task 3: Run algebra

`useTextEdit` has a private `toggleFlagInRange(runs, start, end, flag)` (top of `useTextEdit.ts`) that splits runs at range boundaries, patches the overlap, and coalesces adjacent identical runs. That logic is right; it's just unreachable and single-purpose. Generalize it into two exported functions.

**Files:**
- Create: `packages/core/src/features/text/runs/rangeStyle.ts`
- Test: `packages/core/src/features/text/runs/rangeStyle.test.ts`
- Modify: `packages/core/src/features/text/index.ts`

- [ ] **Step 1: Write the failing tests**

`packages/core/src/features/text/runs/rangeStyle.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { styleAtRange, applyStyleToRange, MIXED_STYLE } from './rangeStyle';
import type { StyledRun } from '../runs';

const runs: StyledRun[] = [
  { text: 'Hello ' },
  { text: 'brave', bold: true },
  { text: ' world' },
];

describe('styleAtRange', () => {
  it('reports a concrete value when the whole range agrees', () => {
    expect(styleAtRange(runs, 6, 11).bold).toBe(true);
  });

  it('reports MIXED_STYLE when the range straddles a boundary', () => {
    expect(styleAtRange(runs, 0, 11).bold).toBe(MIXED_STYLE);
  });

  it('treats an absent flag as false, not undefined', () => {
    expect(styleAtRange(runs, 0, 5).bold).toBe(false);
  });

  it('returns an empty style for a collapsed range', () => {
    expect(styleAtRange(runs, 3, 3)).toEqual({});
  });
});

describe('applyStyleToRange', () => {
  it('splits runs at the range boundaries', () => {
    const out = applyStyleToRange(runs, 0, 5, { underline: true });
    expect(out.map((r) => r.text)).toEqual(['Hello', ' ', 'brave', ' world']);
    expect(out[0].underline).toBe(true);
    expect(out[1].underline).toBeUndefined();
  });

  it('coalesces adjacent runs that end up identical', () => {
    const out = applyStyleToRange([{ text: 'ab' }, { text: 'cd', bold: true }], 2, 4, { bold: false });
    expect(out).toEqual([{ text: 'abcd' }]);
  });

  it('round-trips: what it sets is what styleAtRange reads back', () => {
    const out = applyStyleToRange(runs, 2, 9, { fontSize: 24 });
    expect(styleAtRange(out, 2, 9).fontSize).toBe(24);
  });

  it('is a no-op for a collapsed range', () => {
    expect(applyStyleToRange(runs, 4, 4, { bold: true })).toEqual(runs);
  });

  it('clamps a range that overruns the text length', () => {
    const out = applyStyleToRange(runs, 6, 999, { italic: true });
    expect(out.at(-1)?.italic).toBe(true);
  });
});
```

Setting a flag to `false` must **delete** the key rather than storing `false`, which is what makes the coalescing test above pass — `{ text: 'cd' }` and `{ text: 'ab' }` are only identical if the key is gone.

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/runs/rangeStyle.test.ts`
Expected: FAIL — `Cannot find module './rangeStyle'`.

- [ ] **Step 3: Implement**

`packages/core/src/features/text/runs/rangeStyle.ts`. Port the splitting and coalescing structure from `toggleFlagInRange` in `useTextEdit.ts` — read it first, it is ~40 lines and already correct.

```ts
/**
 * Range-addressed styling over `StyledRun[]`. The panel addresses node paths;
 * a caret addresses a character range — these are the functions for the
 * second case. Pure and React-free so the semantics are unit-testable, the
 * same split `SelectionPanel` makes between `model.ts` and its component.
 */

import type { StyledRun } from '../runs';

/** Sentinel for "the runs in this range disagree at this key." */
export const MIXED_STYLE: unique symbol = Symbol('weasel:mixed-style');
export type MixedStyle = typeof MIXED_STYLE;

/** Every styleable key of a run, each either a concrete value or MIXED_STYLE. */
export type RangeStyle = {
  [K in Exclude<keyof StyledRun, 'text'>]?: StyledRun[K] | MixedStyle;
};

type StyleKey = Exclude<keyof StyledRun, 'text'>;

const STYLE_KEYS: readonly StyleKey[] = [
  'bold', 'italic', 'underline', 'strikethrough',
  'fontFamily', 'fontSize', 'letterSpacing', 'fill',
];
```

Implement `styleAtRange(runs, start, end): RangeStyle` by walking runs, tracking each run's `[pos, pos+len)` against `[start, end)`, and for every overlapping run comparing each key against the first seen value — differing values become `MIXED_STYLE`. Boolean flags read as `run[key] ?? false` so absent and `false` agree. A collapsed or empty range returns `{}`.

Implement `applyStyleToRange(runs, start, end, patch: Partial<StyledRun>): StyledRun[]` by clamping `end` to the total text length, returning a copy unchanged when `start >= end`, then for each run emitting up to three pieces (before / inside / after). The inside piece takes the patch, with `undefined` and `false` **deleting** the key rather than storing it. Finally coalesce: walk the output and merge neighbors whose every non-`text` key is equal.

Write a small `sameStyle(a, b)` helper for the coalescing comparison — it needs to compare `fill` structurally, not by reference, since `applyStyleToRange` spreads runs.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run --project=kit packages/core/src/features/text/runs/rangeStyle.test.ts`
Expected: PASS, all cases.

- [ ] **Step 5: Point `toggleFlagInRange` at the new function**

In `useTextEdit.ts`, replace the private `toggleFlagInRange` body with a call through `applyStyleToRange`, preserving its "if every run in range already has the flag, clear it; else set it" semantics:

```ts
function toggleFlagInRange(
  runs: readonly StyledRun[],
  start: number,
  end: number,
  flag: 'bold' | 'italic',
): StyledRun[] {
  const current = styleAtRange(runs, start, end)[flag];
  return applyStyleToRange(runs, start, end, { [flag]: current !== true });
}
```

`current` is `MIXED_STYLE` for a mixed range, so `current !== true` sets the flag — mixed becomes "all on", which matches every text editor's behavior and the old `allSet` logic.

- [ ] **Step 6: Export from the barrel**

In `packages/core/src/features/text/index.ts`, beside the existing `resolveRuns` export:

```ts
export { styleAtRange, applyStyleToRange, MIXED_STYLE } from './runs/rangeStyle';
export type { RangeStyle, MixedStyle } from './runs/rangeStyle';
```

- [ ] **Step 7: Run the full kit suite**

Run: `npm run test:kit`
Expected: PASS — critically `useTextEdit.test.ts` (559 lines, the largest text test) must pass unchanged, proving the refactor preserved bold/italic behavior.

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/features/text/runs/rangeStyle.ts packages/core/src/features/text/runs/rangeStyle.test.ts packages/core/src/features/text/useTextEdit.ts packages/core/src/features/text/index.ts
git commit -m "feat(text): public run algebra — styleAtRange, applyStyleToRange

toggleFlagInRange becomes a special case of the general function instead of
the only way to reach run splitting."
```

---

## Task 4: Hook surface for the caret range

**Files:**
- Modify: `packages/core/src/features/text/useTextEdit.ts`
- Test: `packages/core/src/features/text/useTextEdit.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/features/text/useTextEdit.test.ts`, following that file's existing harness for mounting the hook and driving the overlay (read it first — it already simulates DOM selections).

```ts
describe('range styling surface', () => {
  it('reports the current selection as character offsets', async () => {
    // …start an edit, select characters 0..5 using the file's existing helper…
    expect(result.current.selection).toEqual({ start: 0, end: 5 });
  });

  it('reports rangeStyle for the selection', async () => {
    // …with runs [{text:'ab', bold:true}, {text:'cd'}], select 0..4…
    expect(result.current.rangeStyle?.bold).toBe(MIXED_STYLE);
  });

  it('applies a patch to the selected range', async () => {
    // …select 0..2, then:
    act(() => result.current.applyStyleToSelection({ underline: true }));
    expect(committedRuns[0]).toMatchObject({ text: 'ab', underline: true });
  });

  it('reports null selection when not editing', () => {
    expect(result.current.selection).toBeNull();
    expect(result.current.rangeStyle).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/useTextEdit.test.ts`
Expected: FAIL — `selection`, `rangeStyle`, `applyStyleToSelection` are not on the return value.

- [ ] **Step 3: Implement**

The hook already converts DOM selection to character offsets for its bold/italic path — it uses `domPositionToCharOffset` from `domRuns.ts` against the overlay element. Reuse that; do not write a second conversion.

Add state that tracks the live selection (a `selectionchange` listener while editing, or read on demand — prefer whichever the existing code already does for its shortcut handler), and extend the return:

```ts
  return {
    editingId, startEdit, cancelEdit, commit, isEditing,
    selection, rangeStyle, applyStyleToSelection,
  };
```

`applyStyleToSelection(patch)` reads the current offsets, calls `applyStyleToRange`, writes back through the same path `toggleFlagInRange`'s caller uses (including restoring the DOM selection afterward — that logic already exists around `useTextEdit.ts:248`, do not duplicate it).

Update `UseTextEditReturn` in the same file, and confirm the three new members are exported types where needed.

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text/useTextEdit.ts packages/core/src/features/text/useTextEdit.test.ts
git commit -m "feat(text): useTextEdit exposes selection, rangeStyle, applyStyleToSelection"
```

---

## Task 5: Letter-spacing in layout

**Files:**
- Modify: `packages/core/src/features/text/atlas/layoutRuns.ts`
- Test: `packages/core/src/features/text/atlas/layoutRuns.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `packages/core/src/features/text/atlas/layoutRuns.test.ts`, reusing the file's existing fixture-font setup:

```ts
describe('letterSpacing', () => {
  it('adds tracking to each advance', () => {
    const plain = layoutRuns([{ ...run, text: 'AB' }], opts, origin);
    const tracked = layoutRuns([{ ...run, text: 'AB', letterSpacing: 4 }], opts, origin);
    const plainWidth = plain.bounds.width;
    expect(tracked.bounds.width).toBeCloseTo(plainWidth + 4 * 2);
  });

  it('is a no-op at 0', () => {
    const a = layoutRuns([{ ...run, text: 'AB' }], opts, origin);
    const b = layoutRuns([{ ...run, text: 'AB', letterSpacing: 0 }], opts, origin);
    expect(b.bounds.width).toBe(a.bounds.width);
  });
});
```

Note tracking applies **after** each glyph including the last — that is what CSS `letter-spacing` does, and matching CSS keeps the DOM overlay and the canvas in agreement. The expectation above encodes that (`4 * 2` for two glyphs).

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/atlas/layoutRuns.test.ts`
Expected: FAIL — widths equal.

- [ ] **Step 3: Implement**

In `layoutRuns.ts`, the per-glyph walk advances the pen by `xadvance` plus any kerning. Add the run's tracking to that advance. `ResolvedRun` carries `letterSpacing` after Task 2 (via `resolveRuns` merging run over style); read it as `run.letterSpacing ?? 0`.

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit`
Expected: PASS — including `measureTextBounds.test.ts`, which measures through `layoutRuns`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text/atlas/layoutRuns.ts packages/core/src/features/text/atlas/layoutRuns.test.ts
git commit -m "feat(text): letterSpacing adjusts glyph advance in layoutRuns"
```

---

## Task 6: Decoration geometry

The hard one. Read this whole task before starting.

`layoutRuns` returns `groups`, each a `LaidOutGroup { family, weight, style, synthetic, source, page, fill, quads }`, where `LaidOutQuad` is `{ x0, y0, x1, y1, u0, v0, u1, v1, baselineY }`. Groups are keyed by variant + fill (see `groupKey` / `fillKey` near the top of the file), so **two runs that differ only in underline currently merge into one group** — and you would have no way to know which glyphs to underline. Fixing that is step one.

**Files:**
- Modify: `packages/core/src/features/text/atlas/layoutRuns.ts`, `packages/core/src/renderer/draw.ts`
- Test: `packages/core/src/features/text/atlas/layoutRuns.test.ts`, `packages/core/src/renderer/draw.test.ts`

- [ ] **Step 1: Write the failing grouping test**

```ts
it('does not merge runs that differ only in decoration', () => {
  const laid = layoutRuns(
    [{ ...run, text: 'AB' }, { ...run, text: 'CD', underline: true }],
    opts, origin,
  );
  expect(laid.groups).toHaveLength(2);
  expect(laid.groups.map((g) => g.underline)).toEqual([false, true]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/atlas/layoutRuns.test.ts`
Expected: FAIL — one group, no `underline` property.

- [ ] **Step 3: Extend the group key**

Add `underline: boolean` and `strikethrough: boolean` to `LaidOutGroup`, include both in `groupKey(...)`, and populate them from the run. This is the change that makes decoration addressable at all.

- [ ] **Step 4: Write the failing draw test**

In `packages/core/src/renderer/draw.test.ts`, using the existing GL-recorder harness:

```ts
it('emits decoration quads through the path-fill program', () => {
  // …draw a text command whose style sets underline: true…
  const pathFillDraws = recorder.callsTo('drawElements', { program: 'pathFill' });
  expect(pathFillDraws.length).toBeGreaterThan(0);
});

it('emits nothing extra when decoration is off', () => {
  // …same command without underline…
  expect(recorder.callsTo('drawElements', { program: 'pathFill' })).toHaveLength(0);
});
```

The recorder's exact assertion API is whatever `makeGLRecorder` already provides — read it and match it rather than inventing `callsTo`.

- [ ] **Step 5: Implement decoration emission**

In `drawText` (`packages/core/src/renderer/draw.ts`, ~line 795), after the glyph groups are drawn, walk the groups again and emit rectangles for those with `underline` or `strikethrough`:

- **Per line, per group.** Bucket a group's quads by `baselineY`; each bucket yields one rect spanning `min(x0) … max(x1)` at that baseline. Bucketing prevents one rect from spanning a wrapped line break.
- **Vertical placement.** `BmFont` carries no underline metrics — only `info`, `common.base` (baseline), and `common.lineHeight`. Derive: underline top at `baselineY + 0.10 * fontSize`, strikethrough top at `baselineY - 0.30 * fontSize`, both `0.05 * fontSize` thick. Put these three factors in named constants at the top of the file with a comment saying they are derived, not measured — a future HarfBuzz or OpenType path would replace them with real `underlinePosition`/`underlineThickness`.
- **Paint.** Each rect takes its group's `fill`, so decoration follows the run's color automatically.
- **Program.** These are solid rectangles, not glyphs — use the path-fill program the `DrawContext` already carries, not `textSdf`. Apply the same clip test and color-matrix/alpha uniforms the glyph path applies.
- **Merging.** Adjacent groups on the same baseline with identical decoration and fill should merge into one rect so no seam shows at a run join.

The `dy` vertical-align offset is applied to quads **before** this point, so `baselineY` is already final — do not re-apply it.

- [ ] **Step 6: Run the tests**

Run: `npm run test:kit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src/features/text/atlas/layoutRuns.ts packages/core/src/features/text/atlas/layoutRuns.test.ts packages/core/src/renderer/draw.ts packages/core/src/renderer/draw.test.ts
git commit -m "feat(text): underline and strikethrough geometry

Decoration joins the group key so runs that differ only in decoration stay
addressable; rects derive from common.base since BmFont ships no underline
metrics."
```

---

## Task 7: DOM overlay round-trip

**Files:**
- Modify: `packages/core/src/features/text/domRuns.ts`
- Test: `packages/core/src/features/text/domRuns.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
it('round-trips the new style keys', () => {
  const runs: StyledRun[] = [
    { text: 'a', underline: true },
    { text: 'b', strikethrough: true, letterSpacing: 2 },
  ];
  const parent = document.createElement('div');
  runsToDom(runs, parent);
  expect(domToRuns(parent)).toEqual(runs);
});

it('renders decoration as inline style, not element wrappers', () => {
  const parent = document.createElement('div');
  runsToDom([{ text: 'a', underline: true, strikethrough: true }], parent);
  expect(parent.querySelector('u')).toBeNull();
  expect(parent.firstElementChild).toHaveStyle({ textDecoration: 'underline line-through' });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/features/text/domRuns.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

`runsToDom` builds one `<span data-run>` per run and sets inline styles (`fontWeight`, `fontStyle`, `fontSize`, `fontFamily`, `color`). Follow that exact shape — do **not** introduce `<u>`/`<s>` wrappers, which would give `domToRuns` a second representation to unwrap:

```ts
    const decorations: string[] = [];
    if (run.underline) decorations.push('underline');
    if (run.strikethrough) decorations.push('line-through');
    if (decorations.length > 0) span.style.textDecoration = decorations.join(' ');
    if (run.letterSpacing != null) span.style.letterSpacing = `${run.letterSpacing}px`;
```

Mirror the reads in `domToRuns`, parsing `textDecoration` for the two tokens and `letterSpacing` back to a number.

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/features/text/domRuns.ts packages/core/src/features/text/domRuns.test.ts
git commit -m "feat(text): DOM overlay round-trips decoration and tracking"
```

---

## Task 8: SVG round-trip

**Files:**
- Modify: `packages/svg/src/cascade.ts`, `packages/svg/src/parse.ts`, `packages/svg/src/serialize.ts`
- Test: the matching `*.test.ts` files in `packages/svg/src/`

- [ ] **Step 1: Write the failing tests**

Add a serialize test asserting a run with `letterSpacing: 2` and `underline: true` emits `letter-spacing="2"` and `text-decoration="underline"`, and a parse test asserting those attributes come back as run keys. Add a round-trip case if the file already has one (`serialize → parse → deep equal`) — prefer extending it over writing a new pair.

- [ ] **Step 2: Run to verify they fail**

Run: `npm run test:ui -- packages/svg`
Expected: FAIL.

- [ ] **Step 3: Implement**

- `cascade.ts` line ~33 lists the inherited presentation attributes (`'font-size', 'font-family', 'font-weight', 'font-style', 'text-anchor'`). Add `'letter-spacing'` and `'text-decoration'` — both inherit in SVG/CSS, so they belong in this list.
- `parse.ts` reads run-level attributes around lines 659 and 685 (element and `<tspan>`/style paths). Add both keys in both places, mapping `text-decoration` containing `underline` → `underline: true` and `line-through` → `strikethrough: true`.
- `serialize.ts` writes run attributes around lines 271 (node style) and 318 (run). Add both, using the existing `trimNumber` helper for `letter-spacing`.

- [ ] **Step 4: Run the tests**

Run: `npm run test:ui -- packages/svg`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/svg/src
git commit -m "feat(svg): letter-spacing and text-decoration round-trip"
```

---

## Task 9: Schema leaves for the text kind

**Files:**
- Modify: `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts`
- Test: `packages/core/src/canvas/SceneCanvas/defaultNodeProperties.test.ts` (create if absent)

- [ ] **Step 1: Write the failing test**

```ts
it('gives text nodes Character and Paragraph groups', () => {
  const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
  const text = entry.schema.children.text as ToolPrefGroup;
  expect(Object.keys(text.children)).toContain('character');
  expect(Object.keys(text.children)).toContain('paragraph');
});

it('addresses typography through nested style paths', () => {
  const entry = inferredNodeProperties.find((e) => e.name === 'text')!;
  const character = ((entry.schema.children.text as ToolPrefGroup).children.character) as ToolPrefGroup;
  expect(Object.keys(character.children)).toEqual([
    'data.style.fontSize',
    'data.style.fontFamily',
    'data.style.fontWeight',
    'data.style.fontStyle',
    'data.style.letterSpacing',
    'data.style.underline',
    'data.style.strikethrough',
    'data.style.fill.color',
  ]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=kit packages/core/src/canvas/SceneCanvas/defaultNodeProperties.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

In `shapeSchema`'s `opts.text` branch, alongside the existing `'data.text'` leaf, add the two groups. Available leaf kinds are `number | boolean | string | enum | color | custom` (`packages/core/src/tools/prefs.ts`):

```ts
            character: {
              name: 'Character',
              children: {
                'data.style.fontSize': { kind: 'number', name: 'Size', description: 'Font size, world units.', default: 16, min: 1, step: 1 },
                'data.style.fontFamily': { kind: 'font-family', name: 'Font', description: 'Registered font family.', default: 'sans-serif' },
                'data.style.fontWeight': { kind: 'number', name: 'Weight', description: 'Font weight, 100–900.', default: 400, min: 100, max: 900, step: 100 },
                'data.style.fontStyle': { kind: 'enum', name: 'Style', description: 'Upright or italic.', default: 'normal', options: [{ value: 'normal', label: 'Normal' }, { value: 'italic', label: 'Italic' }] },
                'data.style.letterSpacing': { kind: 'number', name: 'Tracking', description: 'Extra advance per glyph, world units.', default: 0, step: 0.1 },
                'data.style.underline': { kind: 'boolean', name: 'Underline', description: 'Underline the text.', default: false },
                'data.style.strikethrough': { kind: 'boolean', name: 'Strikethrough', description: 'Strike through the text.', default: false },
                'data.style.fill.color': { kind: 'color', name: 'Color', description: 'Text color.', default: '#000000ff', alpha: true },
              },
            },
            paragraph: {
              name: 'Paragraph',
              children: {
                'data.style.align': { kind: 'enum', name: 'Align', description: 'Horizontal alignment.', default: 'left', options: [{ value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' }] },
                'data.style.lineHeight': { kind: 'number', name: 'Leading', description: 'Line height as a multiple of font size.', default: 1.2, min: 0.5, step: 0.1 },
              },
            },
```

Two deliberate choices to preserve:

1. **`data.style.fill.color`, not `data.style.fill`.** `TextStyle.fill` is a `FillStyle` union (`{ fill: 'solid', color }`, patterns, gradients), and the `color` leaf kind edits a string. The four-segment path — which Task 1 made possible — edits the solid case directly. Non-solid fills read as `undefined` here and the control shows empty; that is a known v1 limitation, and a `custom` leaf is the escape hatch if it ever needs to handle gradients.
2. **`kind: 'font-family'` is a custom leaf**, not `enum`. This schema is built at module load, but fonts register asynchronously at runtime, so a static `options` array would always be stale. `ToolPrefCustom` covers any kind string outside the built-ins, and `SelectionPanel` dispatches it to an app-supplied renderer (Task 11 writes it).

- [ ] **Step 4: Run the tests**

Run: `npm run test:kit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/canvas/SceneCanvas/defaultNodeProperties.ts packages/core/src/canvas/SceneCanvas/defaultNodeProperties.test.ts
git commit -m "feat(core): Character and Paragraph schema groups for text nodes"
```

---

## Task 10: `ToolOptionsBar`

**Files:**
- Create: `packages/ui/src/components/ToolOptionsBar/{ToolOptionsBar.tsx,ToolOptionsBar.module.css,index.ts,ToolOptionsBar.stories.tsx}`
- Modify: `packages/ui/src/index.ts`
- Test: `packages/ui/src/components/ToolOptionsBar/ToolOptionsBar.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('renders its label and children', () => {
  render(<ToolOptionsBar label="Text"><button>B</button></ToolOptionsBar>);
  expect(screen.getByRole('toolbar', { name: /text/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'B' })).toBeInTheDocument();
});

it('renders as an empty reserved row with no children', () => {
  const { container } = render(<ToolOptionsBar />);
  expect(container.firstElementChild).toBeInTheDocument();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/ToolOptionsBar`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

A horizontal strip: optional context label, then a children slot. `role="toolbar"`, `aria-label` from the label. It knows nothing about text — it is chrome any tool can fill. Styles come from theme tokens (`--wzl-*`) in the CSS Module; **no inline styles and no `!important`** — match the conventions in `SidebarPanel.module.css`.

The empty case must still render the row, because draw reserves it permanently (Task 11).

Keep it small. This is deliberately not a tool-prefs renderer yet; the follow-on of driving it from the active tool's `ToolPrefGroup` is out of scope for this plan.

- [ ] **Step 4: Add a story and export it**

Story with three states: empty, one control group, many controls (overflow). Add the component to `packages/ui/src/index.ts`.

- [ ] **Step 5: Run the tests**

Run: `npm run test:ui && npm run test:stories`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/ui/src/components/ToolOptionsBar packages/ui/src/index.ts
git commit -m "feat(ui): ToolOptionsBar — a contextual options row above the workspace"
```

---

## Task 11: Character controls in draw

**Files:**
- Create: `apps/draw/src/ui/CharacterOptions/{CharacterOptions.tsx,FontFamilySelect.tsx,index.ts}`
- Modify: `apps/draw/src/App.tsx`
- Test: `apps/draw/src/ui/CharacterOptions/CharacterOptions.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
it('toggles bold on the selected range', async () => {
  const applyStyleToSelection = vi.fn();
  render(<CharacterOptions rangeStyle={{ bold: false }} applyStyleToSelection={applyStyleToSelection} />);
  await userEvent.click(screen.getByRole('button', { name: /bold/i }));
  expect(applyStyleToSelection).toHaveBeenCalledWith({ bold: true });
});

it('renders a mixed range as indeterminate', () => {
  render(<CharacterOptions rangeStyle={{ bold: MIXED_STYLE }} applyStyleToSelection={vi.fn()} />);
  expect(screen.getByRole('button', { name: /bold/i })).toHaveAttribute('aria-pressed', 'mixed');
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:draw`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the controls**

`CharacterOptions` takes `rangeStyle: RangeStyle | null` and `applyStyleToSelection: (patch: Partial<StyledRun>) => void` — props, not hooks, so it stays testable in isolation. Assemble from existing `@weasel-js/ui` components:

- `ToggleBar` with `mode="multiple"` for bold / italic / underline / strikethrough. Its props are `{ items, value: readonly V[], onChange: (next: V[]) => void }`.
- `NumberField` for size and tracking.
- `FontFamilySelect` (below) for family.
- `ColorField` for fill.

`MIXED_STYLE` renders indeterminate. Read `packages/ui/src/components/SelectionPanel/SelectionPanel.tsx` for how it renders `mixed` and match that presentation — two mixed-state idioms in one app is one too many.

- [ ] **Step 4: Implement the font-family renderer**

`FontFamilySelect` calls `listFonts()` from `@weasel-js/font` for its options. When the current value isn't among them, show it as an explicit entry labeled as unregistered, using `ResolveResult.substituted` to name what is actually rendering (`resolveFontVariant(family, weight, style).substituted`). This is the whole point of the structural report added in the font spec — do not reduce it to a console warning.

Register it in draw's `WD_RENDERERS` map under the `'font-family'` kind, so `SelectionPanel` dispatches the custom leaf from Task 9 to it. `WD_RENDERERS` is already passed as `renderers={WD_RENDERERS}` in `App.tsx`.

- [ ] **Step 5: Mount the bar**

In `App.tsx`, render `<ToolOptionsBar>` above the workspace, **permanently reserved** — always present, filled with `<CharacterOptions>` only while `editingId != null`. Mounting on demand would resize the canvas mid-edit, and draw's canvas is sized to the page.

With a collapsed caret (no range selected), the bar edits the node's `TextStyle` instead of a range — the same values the sidebar shows — so it is never dead chrome. Wire that by routing the patch through the scene update rather than `applyStyleToSelection` when `selection.start === selection.end`.

- [ ] **Step 6: Run the tests**

Run: `npm run test:draw`
Expected: PASS.

- [ ] **Step 7: Verify in the real app**

Start the dev server yourself (do not ask the user to): `npm run dev:draw`, open the URL, draw a text box, type, select part of it, and confirm bold/size/family/color apply to the selection and that the sidebar's Character group edits the node. Screenshot the result and `open` it so it lands on screen.

- [ ] **Step 8: Commit**

```bash
git add apps/draw/src/ui/CharacterOptions apps/draw/src/App.tsx
git commit -m "feat(draw): Character options bar bound to the caret range"
```

---

## Task 12: Changeset and docs

**Files:**
- Create: `.changeset/text-properties.md`
- Modify: `docs/TODO.md`, `packages/core/src/features/text/README.md`

- [ ] **Step 1: Write the changeset**

```markdown
---
"@weasel-js/core": minor
"@weasel-js/ui": minor
"@weasel-js/svg": minor
---

Text properties: `TextStyle` and `StyledRun` gain `letterSpacing`,
`underline`, and `strikethrough`, with GL rendering, DOM-overlay, and SVG
round-trips for all three. `styleAtRange` / `applyStyleToRange` expose run
algebra publicly, and `useTextEdit` gains `selection`, `rangeStyle`, and
`applyStyleToSelection`. Text nodes get Character and Paragraph schema
groups. `SelectionPanel` reads and writes node paths of any depth. New
`ToolOptionsBar` component.
```

The lockstep `fixed` group carries every package to the same version, so listing three is enough.

- [ ] **Step 2: Close the TODO item**

`docs/TODO.md` §Text's "(P2) Text properties panel (Character + Paragraph)" is now done. Per the repo's retention policy, delete the whole block rather than marking it `[x]` — git log is the archive — **unless** it has open follow-ups, in which case keep only those. Genuine follow-ups from this work: letter-spacing on a per-character basis in the DOM overlay is CSS-approximate; decoration thickness is derived rather than read from font metrics; `ToolOptionsBar` is not yet driven by tool prefs.

- [ ] **Step 3: Update the text README**

Add the new keys to the module map and note that run algebra is now public.

- [ ] **Step 4: Commit**

```bash
git add .changeset/text-properties.md docs/TODO.md packages/core/src/features/text/README.md
git commit -m "docs(text): close the properties-panel TODO; changeset"
```

---

## Task 13: Full green gate

- [ ] **Step 1: Run the release gate**

Run: `npm run typecheck && npm run test && npm run build && npm run check:manifests && npm run test:smoke:consumer`
Expected: PASS at every stage. This is what `prepublishOnly` and CI run. `npm run test` alone does not typecheck production code, which is why `typecheck` leads.

- [ ] **Step 2: Run the visual suite**

Run: `npm run test:visual`
Expected: PASS.

Decoration and tracking are new rendering, so **new baselines are expected here** — unlike the font extraction, which changed no geometry. Inspect each diff before accepting: an underline should appear under the glyphs at the right offset, not through them. Accept with `npm run test:visual:update` **only** after looking at the images.

- [ ] **Step 3: Commit any baseline updates**

```bash
git add tests/visual
git commit -m "test(visual): baselines for decoration and tracking"
```

---

## Done means

- The sidebar shows Character and Paragraph groups for a selected text node, aggregating to `MIXED` across a multi-selection.
- A tool options bar sits above the workspace, permanently reserved, carrying caret-range controls while editing and editing node style with a collapsed caret.
- `styleAtRange` / `applyStyleToRange` are public and cover splitting, patching, coalescing, and mixed derivation.
- Underline, strikethrough, and tracking render in GL, survive a contenteditable edit, and round-trip through SVG.
- The font picker lists registered families and names the substitution when one isn't registered.
- The full `prepublishOnly` gate is green and visual baselines were inspected, not blind-accepted.
