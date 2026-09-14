# Theme engine (phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-09-13, not started.** Delete this file when the branch merges.

**Goal:** Give `@weasel-js/theme` a layered theme definition format and an engine that derives, bakes and emits it, and move weasel's own theme onto it without changing a single emitted value.

**Architecture:** Runtime types and axis selection live in `packages/theme/src/` and import no generator. The generators, derivation, baking and emitters live in `packages/theme/src/engine/`, published as `@weasel-js/theme/engine`. `scripts/build-tokens.ts` reads `packages/theme/themes/*.json` and calls the emitters. The design is `docs/superpowers/specs/2026-09-10-theme-engine-and-editor-design.md`; read its Phase 1 before starting.

**Tech Stack:** TypeScript, tsup, vitest (`weasel-ui` project owns `packages/theme` and `packages/paint`; `draw` owns `apps/theme-editor`; `core` owns `packages/core`), Playwright for one browser probe.

**Worktree:** `.worktrees/theme-engine`, branch `theme-engine`. Every path below is relative to that worktree. Never commit `package-lock.json` changes an install made.

**Commands used throughout**
- Theme tests: `npx vitest run --project=weasel-ui packages/theme`
- Typecheck: `npx tsc --noEmit` from the worktree root (not from a package)
- Regenerate tokens: `npm run gen:tokens -w @weasel-js/theme`
- Test ownership: `npm run check:test-projects`

**Hazards found while planning**
- `hexToRgba` (`packages/theme/src/dtcg/color.ts`) throws on any non-hex value, so an `alpha` on a reference to an `rgba()` token dies. Nothing in this arc creates one; don't add one.
- `tests/visual/playwright.config.ts` starts or *reuses* a server on 5177, which is also `dev:theme-editor`'s port. The probe in Task 14 uses `page.setContent` and needs no page from that server, but stop any theme-editor dev server before running it or Playwright attaches to the wrong app.

## File map

| Path | Responsibility |
|---|---|
| `packages/paint/src/colorSpaces.ts` (moved from core) | sRGB ↔ OKLab/OKLCH conversions |
| `packages/theme/src/axes.ts` | `Selection`, `ByAxis`, `pick`, `fullSelection`, `enumerateSelections`, `selectionKey` — runtime-safe |
| `packages/theme/src/definition.ts` | `ThemeDefinition` and its layer types — types only |
| `packages/theme/src/theme.ts` | runtime `Theme`, `defineTheme`, `weaselTheme` |
| `packages/theme/src/engine.ts` | barrel for `@weasel-js/theme/engine` |
| `packages/theme/src/engine/color/oklch.ts`, `generate.ts` (moved from the app) | color math, categorical generator |
| `packages/theme/src/engine/ramps.ts` | lightness and categorical ramp generators |
| `packages/theme/src/engine/scales.ts` | numeric scales |
| `packages/theme/src/engine/merge.ts` | `extends` chain at definition level |
| `packages/theme/src/engine/derive.ts` | `derive(definition, selection)` → tokens, provenance, issues |
| `packages/theme/src/engine/semantics.ts` | semantic rule kinds |
| `packages/theme/src/engine/deps.ts` | axis dependencies per token |
| `packages/theme/src/engine/bake.ts` | definition → runtime `Theme` tokens |
| `packages/theme/src/engine/emit/{css,themes,manifest,dtcg}.ts` | emitters |
| `packages/theme/themes/weasel.json` | weasel's theme definition (replaces `tokens/weasel/`) |
| `apps/theme-editor/src/palette/crayons.ts` | named crayon colors, split out of `generate.ts` |

---

### Task 1: Move the color-space conversions into `@weasel-js/paint`

**Files:**
- Move: `packages/core/src/animation/colorSpaces.ts` → `packages/paint/src/colorSpaces.ts`
- Move: `packages/core/src/animation/colorSpaces.test.ts` → `packages/paint/src/colorSpaces.test.ts`
- Modify: `packages/paint/src/index.ts`, `packages/core/src/animation/index.ts:36-41`, `packages/core/src/animation/colorHelpers.ts:9`
- Create: `.changeset/color-spaces-in-paint.md`

`colorSpaces.ts` has no imports, and core already depends on paint, so this is a pure move.

- [ ] **Step 1: Move both files**

```bash
git mv packages/core/src/animation/colorSpaces.ts packages/paint/src/colorSpaces.ts
git mv packages/core/src/animation/colorSpaces.test.ts packages/paint/src/colorSpaces.test.ts
```

- [ ] **Step 2: Export from paint.** Append to `packages/paint/src/index.ts`:

```ts
export {
  srgbU8ToOklab,
  oklabToSrgbU8,
  lerpOklab,
  oklabToOklch,
  oklchToOklab,
  lerpOklch,
  lerpColorArray,
  type ColorSpace,
} from './colorSpaces';
```

- [ ] **Step 3: Re-export from core by name.** In `packages/core/src/animation/index.ts` change `} from './colorSpaces';` to `} from '@weasel-js/paint';` (keep the name list — a star re-export of another workspace package emits no binding). In `colorHelpers.ts` change `from './colorSpaces'` to `from '@weasel-js/paint'`.

- [ ] **Step 4: Run the moved test and core's animation tests**

Run: `npx vitest run --project=weasel-ui packages/paint && npx vitest run --project=core packages/core/src/animation`
Expected: all pass; `colorSpaces.test.ts` now reports under `weasel-ui`.

- [ ] **Step 5: Typecheck and ownership**

Run: `npx tsc --noEmit && npm run check:test-projects`
Expected: exit 0 for both.

- [ ] **Step 6: Changeset and commit**

`.changeset/color-spaces-in-paint.md`:

```md
---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

The sRGB ↔ OKLab/OKLCH conversions (`srgbU8ToOklab`, `oklabToOklch`, `lerpOklch` and the rest) now live in `@weasel-js/paint`. `@weasel-js/core` still exports every one of them, so no import changes.
```

```bash
git add packages/paint packages/core/src/animation .changeset/color-spaces-in-paint.md
git commit -m "move the OKLab and OKLCH conversions from core into paint"
```

---

### Task 2: Move the palette math into `@weasel-js/theme/engine`

**Files:**
- Create: `apps/theme-editor/src/palette/crayons.ts`
- Move: `apps/theme-editor/src/palette/{oklch.ts,generate.ts,generate.test.ts,cost.test.ts,surfaceDistance.test.ts}` → `packages/theme/src/engine/color/`
- Create: `packages/theme/src/engine.ts`
- Modify: `packages/theme/package.json`, `packages/theme/tsup.config.ts`, `tsconfig.json:60-62`, root `package.json` (`build:leaves`)
- Modify: `apps/theme-editor/src/{SwatchPanel.tsx,presets.ts,PaletteLab.tsx,PalettePreview.tsx,AnchorList.tsx}`, `apps/theme-editor/src/palette/crayons.test.ts`

- [ ] **Step 1: Split the crayons out.** Cut everything from the doc comment above `export const CRAYONS` through `export const YELLOW_ANCHOR` (the end of `apps/theme-editor/src/palette/generate.ts`) into `apps/theme-editor/src/palette/crayons.ts`, headed by:

```ts
import { chromaCap, toHex, vividAt, type Anchor } from '@weasel-js/theme/engine';
```

- [ ] **Step 2: Move the algorithm and its tests**

```bash
mkdir -p packages/theme/src/engine/color
for f in oklch.ts generate.ts generate.test.ts cost.test.ts surfaceDistance.test.ts; do
  git mv apps/theme-editor/src/palette/$f packages/theme/src/engine/color/$f
done
```

In `packages/theme/src/engine/color/oklch.ts` change `from '@weasel-js/core'` to `from '@weasel-js/paint'`.

- [ ] **Step 3: Replace the crayon references in the moved test.** In `generate.test.ts`, drop `crayonHex` and `YELLOW_ANCHOR` from the import and add below the imports:

```ts
/** `crayonAnchor('yellow')` and `crayonHex('yellow')` from the theme editor, as of 2026-09-13. */
const YELLOW_ANCHOR: Anchor = { name: 'yellow', hue: 110, lightness: 0.9 };
const YELLOW_HEX = '#e7e82a';
```

Import `type Anchor` from `./generate`, and replace `crayonHex('yellow')` with `YELLOW_HEX`.

- [ ] **Step 4: Create the engine barrel** `packages/theme/src/engine.ts`:

```ts
export * from './engine/color/oklch';
export * from './engine/color/generate';
```

(Star re-exports inside one package are fine; the trap is only across packages.)

- [ ] **Step 5: Publish the subpath.** In `packages/theme/package.json` add to `exports`, after `"./react"`:

```json
"./engine": { "import": "./dist/engine.js", "types": "./dist/engine.d.ts" },
```

and add `"dependencies": { "@weasel-js/paint": "1.5.0" }` (the same specifier core uses; re-read `packages/core/package.json` in case a release moved it). In `tsup.config.ts` make the entry `{ index: 'src/index.ts', react: 'src/react.tsx', engine: 'src/engine.ts' }`. In root `tsconfig.json` add beside the other theme paths:

```json
"@weasel-js/theme/engine": ["./packages/theme/src/engine.ts"],
```

In root `package.json` `build:leaves`, move `-w @weasel-js/paint` ahead of `-w @weasel-js/theme`: theme's `.d.ts` build now resolves paint's.

- [ ] **Step 6: Point the app at the engine.** `SwatchPanel.tsx`, `presets.ts`, `PaletteLab.tsx`, `PalettePreview.tsx`, `AnchorList.tsx` and `palette/crayons.test.ts` import `generate`, `oklch` names from `@weasel-js/theme/engine`, and `CRAYONS`/`crayonHex`/`crayonAnchor` from `./palette/crayons` (`./crayons` in the test).

- [ ] **Step 7: Run everything the move touched**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx vitest run --project=draw apps/theme-editor`
Expected: all pass, including `cost.test.ts`'s 400ms budget and chroma floor.

Run: `npx tsc --noEmit && npm run check:test-projects && npm run build -w @weasel-js/paint -w @weasel-js/theme && ls packages/theme/dist/engine.js packages/theme/dist/engine.d.ts`
Expected: exit 0, both files listed.

- [ ] **Step 8: Commit** (no changeset: `engine` is new surface described in Task 13's changeset)

```bash
git add apps/theme-editor packages/theme tsconfig.json package.json
git restore --staged package-lock.json 2>/dev/null; git checkout -- package-lock.json 2>/dev/null
git commit -m "move the palette generator into @weasel-js/theme/engine"
```

---

### Task 3: Axes and the definition types

**Files:**
- Create: `packages/theme/src/axes.ts`, `packages/theme/src/axes.test.ts`, `packages/theme/src/definition.ts`

`axes.ts` is runtime code: `resolveTheme` uses `pick` on baked themes, so it must import nothing from `engine/`.

- [ ] **Step 1: Write the failing test** `packages/theme/src/axes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { enumerateSelections, fullSelection, isByAxis, pick, selectionKey, type AxisDefs } from './axes';

const AXES: AxisDefs = {
  mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
  density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
};

describe('axes', () => {
  it('fills missing and unknown axis values with defaults', () => {
    expect(fullSelection(AXES, { mode: 'light', density: 'nope' })).toEqual({ mode: 'light', density: 'comfortable' });
  });

  it('enumerates the cross product in declaration order', () => {
    expect(enumerateSelections(AXES).map((s) => selectionKey(AXES, s))).toEqual([
      'mode=dark,density=comfortable',
      'mode=dark,density=compact',
      'mode=light,density=comfortable',
      'mode=light,density=compact',
    ]);
  });

  it('recognizes a by object and nothing else', () => {
    expect(isByAxis({ by: 'mode', dark: 1, light: 2 })).toBe(true);
    expect(isByAxis({ value: '#fff', type: 'color' })).toBe(false);
    expect(isByAxis(['a'])).toBe(false);
  });

  it('picks through nested by objects', () => {
    const v = { by: 'mode', dark: { by: 'density', comfortable: 4, compact: 3 }, light: 5 };
    expect(pick(v, fullSelection(AXES, { density: 'compact' }))).toEqual({ ok: true, value: 3 });
    expect(pick(v, fullSelection(AXES, { mode: 'light' }))).toEqual({ ok: true, value: 5 });
  });

  it('reports a missing value instead of throwing', () => {
    expect(pick({ by: 'mode', dark: 1 }, fullSelection(AXES, { mode: 'light' }))).toEqual({
      ok: false, axis: 'mode', value: 'light',
    });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/axes.test.ts`
Expected: FAIL, cannot resolve `./axes`.

- [ ] **Step 3: Implement** `packages/theme/src/axes.ts`:

```ts
/** One value of an axis. `scheme` becomes `color-scheme` in that value's CSS blocks. */
export interface AxisValue {
  readonly scheme?: 'dark' | 'light';
}

export interface AxisDef {
  readonly default: string;
  readonly values: Readonly<Record<string, AxisValue>>;
}

/** Key order is declaration order, which selectors and selection keys follow. */
export type AxisDefs = Readonly<Record<string, AxisDef>>;

/** A partial choice of axis values, e.g. `{ mode: 'light' }`. */
export type Selection = Readonly<Record<string, string>>;

/** `{ by: 'mode', dark: …, light: … }`: a value that differs per axis value. */
export type ByAxis<T> = { readonly by: string } & { readonly [axisValue: string]: Varying<T> | string };

export type Varying<T> = T | ByAxis<T>;

export type Picked<T> = { ok: true; value: T } | { ok: false; axis: string; value: string };

export function isByAxis(v: unknown): v is ByAxis<unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && typeof (v as { by?: unknown }).by === 'string';
}

/** Every axis given a known value; anything missing or unknown takes its default. */
export function fullSelection(axes: AxisDefs, selection: Selection = {}): Selection {
  const out: Record<string, string> = {};
  for (const [name, def] of Object.entries(axes)) {
    const v = selection[name];
    out[name] = v !== undefined && v in def.values ? v : def.default;
  }
  return out;
}

export function enumerateSelections(axes: AxisDefs): Selection[] {
  let out: Record<string, string>[] = [{}];
  for (const [name, def] of Object.entries(axes)) {
    out = out.flatMap((s) => Object.keys(def.values).map((v) => ({ ...s, [name]: v })));
  }
  return out;
}

/** `mode=dark,density=compact`, axes in declaration order. */
export function selectionKey(axes: AxisDefs, selection: Selection): string {
  const full = fullSelection(axes, selection);
  return Object.keys(axes).map((a) => `${a}=${full[a]}`).join(',');
}

export function pick<T>(v: Varying<T>, selection: Selection): Picked<T> {
  let cur: unknown = v;
  while (isByAxis(cur)) {
    const axis = cur.by;
    const value = selection[axis];
    if (value === undefined || value === 'by' || !(value in cur)) return { ok: false, axis, value: value ?? '' };
    cur = cur[value];
  }
  return { ok: true, value: cur as T };
}
```

- [ ] **Step 4: Write the definition types** `packages/theme/src/definition.ts` (types only; tsc checks them):

```ts
import type { AxisDefs, Varying } from './axes';
import type { TokenValue } from './dtcg/types';

/** A number, or `{seeds.name}`. */
export type NumberParam = Varying<number | string>;

export interface PinObject {
  readonly value: TokenValue;
  readonly type?: string;
  readonly description?: string;
  readonly alpha?: number;
}

/** A bare value or `{ value, type?, description?, alpha? }`. The value may be a `{token}` reference. */
export type PinValue = TokenValue | PinObject;

export interface LightnessRampDef {
  readonly kind: 'lightness';
  readonly steps: readonly string[];
  /** First and last step's OKLCH lightness. */
  readonly lightness: readonly [NumberParam, NumberParam];
  /** 0 walks evenly; 1 follows a smoothstep S. */
  readonly curve?: NumberParam;
  /** Degrees. Ignored when an anchor is given. */
  readonly hue?: NumberParam;
  readonly chroma?: { readonly peak: NumberParam; readonly darkBias?: NumberParam };
  /** Step name → exact hex (or `{seeds.name}`). The first anchor supplies hue and chroma. */
  readonly anchor?: Readonly<Record<string, string>>;
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

export interface CategoricalRampDef {
  readonly kind: 'categorical';
  readonly steps: readonly string[];
  /** Any of the palette generator's `Constraints` except `count` and `anchors`. */
  readonly gates?: Readonly<Record<string, Varying<number | string>>>;
  readonly anchors?: readonly { readonly name: string; readonly hue: number; readonly lightness: number; readonly chroma?: number }[];
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

export type RampDef = LightnessRampDef | CategoricalRampDef;

export interface ScaleDef {
  readonly steps: readonly string[];
  readonly base: NumberParam;
  /** Linear: `base + step × i`. */
  readonly step?: NumberParam;
  /** Geometric: `base × ratio^i`. */
  readonly ratio?: NumberParam;
  readonly description?: string;
  readonly describe?: Readonly<Record<string, string>>;
}

interface SemanticCommon {
  readonly type?: string;
  readonly description?: string;
  /** Audited, never applied. */
  readonly check?: { readonly contrast: number; readonly against: readonly string[] };
}

export type StepRule = SemanticCommon & { readonly ramp: string; readonly step: Varying<string> };
export type OffsetRule = SemanticCommon & { readonly from: string; readonly offset: number; readonly dir: 'lighter' | 'darker' | 'away' };
export type ContrastRule = SemanticCommon & { readonly ramp: string; readonly contrast: { readonly min: number; readonly against: readonly string[] } };
export type RefRule = SemanticCommon & { readonly ref: string; readonly alpha?: number };
export type LiteralRule = SemanticCommon & { readonly value: TokenValue };
export type SemanticRule = StepRule | OffsetRule | ContrastRule | RefRule | LiteralRule;

export interface ThemeDefinition {
  readonly name: string;
  /** Another definition's name. Absent or null: extends nothing. */
  readonly extends?: string | null;
  readonly description?: string;
  readonly axes?: AxisDefs;
  readonly seeds?: Readonly<Record<string, Varying<number | string>>>;
  readonly ramps?: Readonly<Record<string, RampDef>>;
  readonly scales?: Readonly<Record<string, ScaleDef>>;
  readonly semantics?: Readonly<Record<string, Varying<SemanticRule>>>;
  readonly components?: Readonly<Record<string, Varying<PinValue>>>;
  readonly pins?: Readonly<Record<string, Varying<PinValue>>>;
}
```

- [ ] **Step 5: Run the test and typecheck**

Run: `npx vitest run --project=weasel-ui packages/theme/src/axes.test.ts && npx tsc --noEmit`
Expected: 5 passed; tsc exit 0.

- [ ] **Step 6: Commit** `packages/theme/src/{axes.ts,axes.test.ts,definition.ts}` as "add theme axes, selections and the layered definition types".

---

### Task 4: Ramp and scale generators

**Files:**
- Create: `packages/theme/src/engine/ramps.ts`, `packages/theme/src/engine/ramps.test.ts`, `packages/theme/src/engine/scales.ts`, `packages/theme/src/engine/scales.test.ts`

These take plain numbers. Resolving `{seeds.x}` and `by` values happens in `derive` (Task 6).

The gray parameters below were fitted on 2026-09-13 to the hand-measured proposal in the spec; a script measured max ΔL 0.0081 and max ΔC 0.0026 with this exact envelope, so the test's 0.01 / 0.003 bounds hold with little room. If the test misses by a hair, check that `envelopeMax` samples 1001 points before touching the bounds.

- [ ] **Step 1: Write the failing ramp test** `packages/theme/src/engine/ramps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_CONSTRAINTS } from './color/generate';
import { hueGap, toLch } from './color/oklch';
import { categoricalRamp, lightnessRamp } from './ramps';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const PROPOSED = ['#f5f6f7', '#e0e1e4', '#c6c8cb', '#a7a9ae', '#85888e', '#64676f', '#464a51', '#2f3137', '#1c1e22', '#0c0e12'];
const GRAY = { steps: STEPS, lightness: [0.973, 0.163] as const, curve: 0.41, hue: 266, peak: 0.0116, darkBias: 0.84 };

describe('lightnessRamp', () => {
  it('reproduces the proposed gray ramp from its fitted parameters', () => {
    const ramp = lightnessRamp(GRAY);
    STEPS.forEach((s, i) => {
      const got = toLch(ramp[s]);
      const want = toLch(PROPOSED[i]);
      expect(Math.abs(got.L - want.L), `L at ${s}`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(got.C - want.C), `C at ${s}`).toBeLessThanOrEqual(0.003);
    });
  });

  it('walks lightness monotonically and stays in gamut', () => {
    const ramp = lightnessRamp(GRAY);
    const ls = STEPS.map((s) => toLch(ramp[s]).L);
    for (let i = 1; i < ls.length; i += 1) expect(ls[i]).toBeLessThan(ls[i - 1]);
    for (const s of STEPS) expect(ramp[s]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('emits an anchored step exactly and takes its hue from the anchor', () => {
    const ramp = lightnessRamp({ ...GRAY, steps: ['soft', 'base', 'strong'], lightness: [0.252, 0.471], curve: 0, anchor: { base: '#2E1F7A' } });
    expect(ramp.base).toBe('#2e1f7a');
    expect(hueGap(toLch(ramp.strong).H, toLch('#2e1f7a').H)).toBeLessThan(3);
  });
});

describe('categoricalRamp', () => {
  it('names the generated set by step, in generation order', () => {
    const steps = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'];
    const { colors, feasible } = categoricalRamp(steps, DEFAULT_CONSTRAINTS, []);
    expect(feasible).toBe(true);
    expect(Object.keys(colors)).toEqual(steps);
    expect(new Set(Object.values(colors)).size).toBe(10);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/ramps.test.ts`
Expected: FAIL, cannot resolve `./ramps`.

- [ ] **Step 3: Implement** `packages/theme/src/engine/ramps.ts`:

```ts
import { DEFAULT_CONSTRAINTS, generate, type Anchor, type Constraints } from './color/generate';
import { toHex, toLch } from './color/oklch';

export interface LightnessParams {
  readonly steps: readonly string[];
  readonly lightness: readonly [number, number];
  readonly curve: number;
  readonly hue: number;
  readonly peak: number;
  readonly darkBias: number;
  readonly anchor?: Readonly<Record<string, string>>;
}

const smoothstep = (t: number) => t * t * (3 - 2 * t);
const envelope = (t: number, darkBias: number) => Math.sin(Math.PI * t) + darkBias * t;

function envelopeMax(darkBias: number): number {
  let max = 0;
  for (let i = 0; i <= 1000; i += 1) max = Math.max(max, envelope(i / 1000, darkBias));
  return max;
}

/** Step name → hex. See the spec's "Ramps" for the walk and the envelope. */
export function lightnessRamp(p: LightnessParams): Record<string, string> {
  const n = p.steps.length;
  const at = (i: number) => (n === 1 ? 0 : i / (n - 1));
  const max = envelopeMax(p.darkBias);

  let { hue, peak } = p;
  const anchorIndex = p.steps.findIndex((s) => p.anchor?.[s] !== undefined);
  if (anchorIndex !== -1) {
    const a = toLch(p.anchor![p.steps[anchorIndex]]);
    const e = envelope(at(anchorIndex), p.darkBias);
    hue = a.H;
    peak = e > 1e-6 ? (a.C * max) / e : a.C;
  }

  const out: Record<string, string> = {};
  p.steps.forEach((step, i) => {
    const fixed = p.anchor?.[step];
    if (fixed !== undefined) {
      out[step] = fixed.toLowerCase();
      return;
    }
    const t = at(i);
    const L = p.lightness[0] + (p.lightness[1] - p.lightness[0]) * (t + (smoothstep(t) - t) * p.curve);
    out[step] = toHex(L, (peak * envelope(t, p.darkBias)) / max, hue);
  });
  return out;
}

export function categoricalRamp(
  steps: readonly string[],
  gates: Partial<Constraints>,
  anchors: readonly Anchor[],
): { colors: Record<string, string>; feasible: boolean } {
  const palette = generate({ ...DEFAULT_CONSTRAINTS, ...gates, count: steps.length, anchors: [...anchors] });
  const colors: Record<string, string> = {};
  steps.forEach((step, i) => {
    colors[step] = palette.swatches[i].hex.toLowerCase();
  });
  return { colors, feasible: palette.feasible };
}
```

If `Constraints.anchors` is typed `readonly Anchor[]`, drop the spread.

- [ ] **Step 4: Run the ramp test**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/ramps.test.ts`
Expected: 4 passed.

- [ ] **Step 5: Write the failing scale test** `packages/theme/src/engine/scales.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { scale } from './scales';

describe('scale', () => {
  it('steps linearly from base', () => {
    expect(scale(['xs', 'sm', 'md', 'lg'], { base: 4, step: 4 })).toEqual({ xs: '4px', sm: '8px', md: '12px', lg: '16px' });
  });

  it('steps geometrically and rounds to whole px', () => {
    expect(scale(['a', 'b', 'c'], { base: 10, ratio: 1.25 })).toEqual({ a: '10px', b: '13px', c: '16px' });
  });

  it('refuses both or neither of step and ratio', () => {
    expect(() => scale(['a'], { base: 1, step: 1, ratio: 2 })).toThrow(/exactly one/);
    expect(() => scale(['a'], { base: 1 })).toThrow(/exactly one/);
  });
});
```

- [ ] **Step 6: Run it to see it fail**, then implement `packages/theme/src/engine/scales.ts`:

```ts
export interface ScaleParams {
  readonly base: number;
  readonly step?: number;
  readonly ratio?: number;
}

export function scale(steps: readonly string[], p: ScaleParams): Record<string, string> {
  if ((p.step === undefined) === (p.ratio === undefined)) {
    throw new Error('A scale takes exactly one of `step` and `ratio`');
  }
  const out: Record<string, string> = {};
  steps.forEach((name, i) => {
    const v = p.step !== undefined ? p.base + p.step * i : p.base * p.ratio! ** i;
    out[name] = `${Math.round(v)}px`;
  });
  return out;
}
```

- [ ] **Step 7: Run both tests, typecheck, commit**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx tsc --noEmit`
Expected: all pass; tsc exit 0.

Commit `packages/theme/src/engine/{ramps,ramps.test,scales,scales.test}.ts` as "generate lightness ramps, categorical ramps and numeric scales".

---

### Task 5: The `extends` chain, and the engine's result types

**Files:**
- Create: `packages/theme/src/engine/merge.ts`, `packages/theme/src/engine/merge.test.ts`, `packages/theme/src/engine/types.ts`

Merging happens at the definition level, so a child's semantics can walk a parent's ramps. An entry is replaced whole: a child that redefines `ramps.gray` replaces every parameter of it.

- [ ] **Step 1: Write the result types** `packages/theme/src/engine/types.ts`:

```ts
import type { FlatTokens, RawToken } from '../dtcg/types';

export type Layer = 'ramps' | 'scales' | 'semantics' | 'components' | 'pins';

export interface Provenance {
  readonly layer: Layer;
  /** `lightness`, `categorical`, `linear`, `geometric`, `step`, `offset`, `contrast`, `ref`, `value`. */
  readonly rule: string;
  /** A pin replaced what the rule produced. Only these count as overridden. */
  readonly pinned: boolean;
  /** What the rule alone produced, when `pinned`. */
  readonly generated?: RawToken;
}

export type Issue =
  | { readonly kind: 'missing-axis-value'; readonly path: string; readonly axis: string; readonly value: string }
  | { readonly kind: 'untyped-pin'; readonly token: string }
  | { readonly kind: 'infeasible-ramp'; readonly ramp: string }
  | { readonly kind: 'contrast-unmet'; readonly token: string; readonly min: number; readonly against: readonly string[] }
  | { readonly kind: 'check-failed'; readonly token: string; readonly against: string; readonly min: number; readonly ratio: number }
  | { readonly kind: 'invalid'; readonly path: string; readonly message: string };

export interface DeriveResult {
  /** In layer order, then definition order within a layer. */
  readonly tokens: FlatTokens;
  readonly provenance: Readonly<Record<string, Provenance>>;
  readonly issues: readonly Issue[];
}
```

- [ ] **Step 2: Write the failing test** `packages/theme/src/engine/merge.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { mergeChain } from './merge';

const base: ThemeDefinition = {
  name: 'base',
  axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
  ramps: {
    gray: { kind: 'lightness', steps: ['a', 'b'], lightness: [0.9, 0.2] },
    accent: { kind: 'lightness', steps: ['x'], lightness: [0.5, 0.5] },
  },
  pins: { 'radius-md': '5px' },
};
const defs: Record<string, ThemeDefinition> = { base };
const lookup = (n: string) => defs[n];

describe('mergeChain', () => {
  it('replaces entries whole and inherits the rest, keeping the parent key order', () => {
    const child: ThemeDefinition = {
      name: 'child',
      extends: 'base',
      ramps: { gray: { kind: 'lightness', steps: ['a'], lightness: [0.8, 0.3] } },
    };
    const m = mergeChain(child, lookup);
    expect(m.name).toBe('child');
    expect(Object.keys(m.ramps!)).toEqual(['gray', 'accent']);
    expect(m.ramps!.gray.steps).toEqual(['a']);
    expect(m.pins).toEqual({ 'radius-md': '5px' });
    expect(m.axes).toEqual(base.axes);
  });

  it('throws on an unknown parent and on a cycle', () => {
    expect(() => mergeChain({ name: 'c', extends: 'nope' }, lookup)).toThrow(/nope/);
    const loop: Record<string, ThemeDefinition> = { a: { name: 'a', extends: 'b' }, b: { name: 'b', extends: 'a' } };
    expect(() => mergeChain(loop.a, (n) => loop[n])).toThrow(/cycle/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/merge.test.ts`
Expected: FAIL, cannot resolve `./merge`.

- [ ] **Step 4: Implement** `packages/theme/src/engine/merge.ts`:

```ts
import type { ThemeDefinition } from '../definition';

export type Lookup = (name: string) => ThemeDefinition | undefined;

const LAYERS = ['axes', 'seeds', 'ramps', 'scales', 'semantics', 'components', 'pins'] as const;

/** The definition with its whole `extends` chain folded in, child entries winning. */
export function mergeChain(def: ThemeDefinition, lookup?: Lookup, seen: ReadonlySet<string> = new Set()): ThemeDefinition {
  if (seen.has(def.name)) throw new Error(`extends cycle at theme "${def.name}"`);
  if (!def.extends) return def;
  const parentDef = lookup?.(def.extends);
  if (!parentDef) throw new Error(`Theme "${def.name}" extends "${def.extends}", which is not defined`);
  const parent = mergeChain(parentDef, lookup, new Set([...seen, def.name]));
  const out: Record<string, unknown> = { ...def };
  for (const layer of LAYERS) out[layer] = { ...(parent[layer] ?? {}), ...(def[layer] ?? {}) };
  return out as unknown as ThemeDefinition;
}
```

- [ ] **Step 5: Run the test, typecheck, commit**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/merge.test.ts && npx tsc --noEmit`
Expected: 2 passed; tsc exit 0.

Commit `packages/theme/src/engine/{merge,merge.test,types}.ts` as "merge a theme definition's extends chain".

---

### Task 6: `derive` — seeds, ramps, scales, pins, and the simple semantics

**Files:**
- Create: `packages/theme/src/engine/derive.ts`, `packages/theme/src/engine/derive.test.ts`, `packages/theme/src/engine/semantics.ts`

This task handles the `step`, `ref` and literal semantic rules. Task 7 adds `offset`, `contrast` and `check` to the same file. `deriveSemantics` is lazy from the start because those rules read other semantics that may come later in the definition.

- [ ] **Step 1: Write the failing test** `packages/theme/src/engine/derive.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { derive } from './derive';

const T: ThemeDefinition = {
  name: 't',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16], describe: { '50': 'lightest' } } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: '{seeds.unit}' } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2, type: 'color' },
    shadow: { value: 'rgba(0, 0, 0, 0.6)', type: 'color' },
  },
  components: { 'tb-height': { value: '28px', type: 'dimension' } },
  pins: { 'gray-900': '#141820', 'radius-md': { value: '5px', type: 'dimension' } },
};

describe('derive', () => {
  it('emits in layer order, then definition order, with a pinned token left in place', () => {
    expect(Object.keys(derive(T).tokens)).toEqual([
      'gray-50', 'gray-900', 'space-sm', 'space-md', 'surface', 'line', 'shadow', 'tb-height', 'radius-md',
    ]);
  });

  it('resolves seeds per selection', () => {
    expect(derive(T, { density: 'compact' }).tokens['space-md'].value).toBe('6px');
    expect(derive(T).tokens['space-md'].value).toBe('8px');
  });

  it('points a step semantic at the ramp token for the selection', () => {
    expect(derive(T).tokens.surface.value).toBe('{gray-900}');
    expect(derive(T, { mode: 'light' }).tokens.surface.value).toBe('{gray-50}');
    expect(derive(T).tokens.line).toMatchObject({ value: '{surface}', alpha: 0.2 });
  });

  it('records what a pin overrode, and treats a pin with nothing under it as authored', () => {
    const { tokens, provenance } = derive(T);
    expect(tokens['gray-900'].value).toBe('#141820');
    expect(provenance['gray-900']).toMatchObject({ layer: 'ramps', rule: 'lightness', pinned: true });
    expect(provenance['gray-900'].generated?.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(provenance['radius-md']).toEqual({ layer: 'pins', rule: 'value', pinned: false });
    expect(tokens['gray-50'].description).toBe('lightest');
  });

  it('reports an untyped pin and a missing axis value without throwing', () => {
    // `edge` is referenced by nothing, so leaving it underived dangles no reference.
    const { issues } = derive(
      { ...T, pins: { ...T.pins, loose: '1px' }, semantics: { ...T.semantics, edge: { ramp: 'gray', step: { by: 'mode', dark: '900' } } } },
      { mode: 'light' },
    );
    expect(issues).toContainEqual({ kind: 'untyped-pin', token: 'loose' });
    expect(issues).toContainEqual({ kind: 'missing-axis-value', path: 'semantics.edge.step', axis: 'mode', value: 'light' });
  });

  it('throws on a dangling reference', () => {
    expect(() => derive({ ...T, pins: { a: { value: '{nope}', type: 'color' } } })).toThrow(/nope/);
  });

  it('reports a categorical ramp whose gates cannot be met', () => {
    const steps = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const { issues } = derive({
      name: 'x',
      ramps: { swatch: { kind: 'categorical', steps, gates: { hueFloor: (40 * 12) / 360, minDistance: 0, minSurfaceDistance: 0 } } },
    });
    expect(issues).toContainEqual({ kind: 'infeasible-ramp', ramp: 'swatch' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/derive.test.ts`
Expected: FAIL, cannot resolve `./derive`.

- [ ] **Step 3: Implement** `packages/theme/src/engine/semantics.ts`:

```ts
import { pick, type Selection, type Varying } from '../axes';
import type { SemanticRule } from '../definition';
import type { RawToken, TokenValue } from '../dtcg/types';
import type { Issue } from './types';

export interface SemanticContext {
  readonly sel: Selection;
  /** Ramp and scale tokens derived so far. */
  readonly tokens: Readonly<Record<string, RawToken>>;
  /** Ramp name → its steps, in order. */
  readonly ramps: Readonly<Record<string, readonly string[]>>;
  /** The value a pin will give this token for the selection, if one does. Rules that measure color read final colors, not generated ones. */
  readonly pinned: (name: string) => TokenValue | undefined;
  readonly issues: Issue[];
}

export interface DerivedSemantic {
  readonly token: RawToken;
  readonly rule: string;
  /** Set when the semantic ended on a ramp step. */
  readonly position?: { readonly ramp: string; readonly index: number };
}

type Get = (name: string) => DerivedSemantic | undefined;

export function deriveSemantics(
  rules: Readonly<Record<string, Varying<SemanticRule>>>,
  ctx: SemanticContext,
): Map<string, DerivedSemantic> {
  const done = new Map<string, DerivedSemantic>();
  const inProgress = new Set<string>();

  const get: Get = (name) => {
    if (done.has(name)) return done.get(name);
    if (!(name in rules)) return undefined;
    if (inProgress.has(name)) throw new Error(`Semantic cycle at "${name}" (${[...inProgress].join(' → ')})`);
    inProgress.add(name);
    const picked = pick(rules[name], ctx.sel);
    let derived: DerivedSemantic | undefined;
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}`, axis: picked.axis, value: picked.value });
    } else {
      derived = deriveOne(name, picked.value, ctx, get);
    }
    inProgress.delete(name);
    if (derived) done.set(name, derived);
    return derived;
  };

  for (const name of Object.keys(rules)) get(name);
  return new Map(Object.keys(rules).filter((n) => done.has(n)).map((n) => [n, done.get(n)!]));
}

function deriveOne(name: string, r: SemanticRule, ctx: SemanticContext, get: Get): DerivedSemantic | undefined {
  const description = r.description;

  if ('value' in r) {
    if (r.type === undefined) ctx.issues.push({ kind: 'untyped-pin', token: name });
    return { rule: 'value', token: { type: r.type ?? 'unknown', value: r.value, alpha: undefined, description } };
  }

  if ('ref' in r) {
    const type = r.type ?? ctx.tokens[r.ref]?.type ?? get(r.ref)?.token.type ?? 'unknown';
    return { rule: 'ref', token: { type, value: `{${r.ref}}`, alpha: r.alpha, description } };
  }

  if ('step' in r) {
    const picked = pick(r.step, ctx.sel);
    if (!picked.ok) {
      ctx.issues.push({ kind: 'missing-axis-value', path: `semantics.${name}.step`, axis: picked.axis, value: picked.value });
      return undefined;
    }
    return atStep(name, r.ramp, (ctx.ramps[r.ramp] ?? []).indexOf(picked.value), 'step', description, ctx);
  }

  ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'rule kind not supported yet' });
  return undefined;
}

export function atStep(
  name: string,
  ramp: string,
  index: number,
  rule: string,
  description: string | undefined,
  ctx: SemanticContext,
): DerivedSemantic | undefined {
  const steps = ctx.ramps[ramp];
  if (!steps || index < 0 || index >= steps.length) {
    ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `no such step on ramp "${ramp}"` });
    return undefined;
  }
  return {
    rule,
    position: { ramp, index },
    token: { type: 'color', value: `{${ramp}-${steps[index]}}`, alpha: undefined, description },
  };
}
```

- [ ] **Step 4: Implement** `packages/theme/src/engine/derive.ts`:

```ts
import { fullSelection, pick, type Selection, type Varying } from '../axes';
import type { PinObject, PinValue, RampDef, ThemeDefinition } from '../definition';
import { resolveTokens } from '../dtcg/resolve';
import type { RawToken, TokenValue } from '../dtcg/types';
import { mergeChain, type Lookup } from './merge';
import { categoricalRamp, lightnessRamp } from './ramps';
import { scale } from './scales';
import { deriveSemantics } from './semantics';
import type { DeriveResult, Issue, Layer, Provenance } from './types';

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const TOKEN_REF = /^\{([^}.]+)\}$/;

interface ParamContext {
  readonly sel: Selection;
  readonly seeds: Readonly<Record<string, number | string>>;
  readonly issues: Issue[];
}

function param(v: Varying<number | string>, path: string, ctx: ParamContext): number | string | undefined {
  const picked = pick(v, ctx.sel);
  if (!picked.ok) {
    ctx.issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
    return undefined;
  }
  const raw = picked.value;
  const m = typeof raw === 'string' ? SEED_REF.exec(raw.trim()) : null;
  if (!m) return raw;
  if (!(m[1] in ctx.seeds)) {
    ctx.issues.push({ kind: 'invalid', path, message: `unknown seed "${m[1]}"` });
    return undefined;
  }
  return ctx.seeds[m[1]];
}

function num(v: Varying<number | string> | undefined, path: string, ctx: ParamContext): number | undefined {
  if (v === undefined) return undefined;
  const x = param(v, path, ctx);
  if (x === undefined || typeof x === 'number') return x;
  ctx.issues.push({ kind: 'invalid', path, message: 'expected a number' });
  return undefined;
}

function rampColors(name: string, ramp: RampDef, ctx: ParamContext): Record<string, string> | undefined {
  const path = `ramps.${name}`;
  if (ramp.kind === 'lightness') {
    const l0 = num(ramp.lightness[0], `${path}.lightness`, ctx);
    const l1 = num(ramp.lightness[1], `${path}.lightness`, ctx);
    if (l0 === undefined || l1 === undefined) return undefined;
    const anchor: Record<string, string> = {};
    for (const [step, v] of Object.entries(ramp.anchor ?? {})) {
      const x = param(v, `${path}.anchor.${step}`, ctx);
      if (typeof x === 'string') anchor[step] = x;
    }
    return lightnessRamp({
      steps: ramp.steps,
      lightness: [l0, l1],
      curve: num(ramp.curve, `${path}.curve`, ctx) ?? 0,
      hue: num(ramp.hue, `${path}.hue`, ctx) ?? 0,
      peak: num(ramp.chroma?.peak, `${path}.chroma.peak`, ctx) ?? 0,
      darkBias: num(ramp.chroma?.darkBias, `${path}.chroma.darkBias`, ctx) ?? 0,
      anchor,
    });
  }
  const gates: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(ramp.gates ?? {})) {
    const x = param(v, `${path}.gates.${k}`, ctx);
    if (x !== undefined) gates[k] = x;
  }
  const { colors, feasible } = categoricalRamp(ramp.steps, gates, ramp.anchors ?? []);
  if (!feasible) ctx.issues.push({ kind: 'infeasible-ramp', ramp: name });
  return colors;
}

const isPinObject = (v: PinValue): v is PinObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

/** Derive every token of `definition` for one selection. Unmet rules are reported in `issues`; cycles and dangling references throw. */
export function derive(definition: ThemeDefinition, selection: Selection = {}, lookup?: Lookup): DeriveResult {
  const def = mergeChain(definition, lookup);
  const sel = fullSelection(def.axes ?? {}, selection);
  const issues: Issue[] = [];
  const seeds: Record<string, number | string> = {};
  for (const [k, v] of Object.entries(def.seeds ?? {})) {
    const picked = pick(v, sel);
    if (picked.ok) seeds[k] = picked.value;
    else issues.push({ kind: 'missing-axis-value', path: `seeds.${k}`, axis: picked.axis, value: picked.value });
  }
  const ctx: ParamContext = { sel, seeds, issues };

  const tokens: Record<string, RawToken> = {};
  const provenance: Record<string, Provenance> = {};
  const put = (name: string, token: RawToken, layer: Layer, rule: string) => {
    tokens[name] = token;
    provenance[name] = { layer, rule, pinned: false };
  };

  const rampSteps: Record<string, readonly string[]> = {};
  for (const [name, ramp] of Object.entries(def.ramps ?? {})) {
    rampSteps[name] = ramp.steps;
    const colors = rampColors(name, ramp, ctx);
    if (!colors) continue;
    for (const step of ramp.steps) {
      put(`${name}-${step}`, { type: 'color', value: colors[step], alpha: undefined, description: ramp.describe?.[step] }, 'ramps', ramp.kind);
    }
  }

  for (const [name, s] of Object.entries(def.scales ?? {})) {
    const base = num(s.base, `scales.${name}.base`, ctx);
    const step = num(s.step, `scales.${name}.step`, ctx);
    const ratio = num(s.ratio, `scales.${name}.ratio`, ctx);
    if (base === undefined) continue;
    try {
      const values = scale(s.steps, { base, step, ratio });
      for (const st of s.steps) {
        put(`${name}-${st}`, { type: 'dimension', value: values[st], alpha: undefined, description: s.describe?.[st] }, 'scales', step !== undefined ? 'linear' : 'geometric');
      }
    } catch (e) {
      issues.push({ kind: 'invalid', path: `scales.${name}`, message: (e as Error).message });
    }
  }

  const pinned = (name: string): TokenValue | undefined => {
    const v = def.pins?.[name];
    const picked = v === undefined ? undefined : pick(v, sel);
    if (!picked?.ok) return undefined;
    return isPinObject(picked.value) ? picked.value.value : picked.value;
  };
  for (const [name, d] of deriveSemantics(def.semantics ?? {}, { sel, tokens, ramps: rampSteps, pinned, issues })) {
    put(name, d.token, 'semantics', d.rule);
  }

  const refType = (value: TokenValue): string | undefined => {
    const m = typeof value === 'string' ? TOKEN_REF.exec(value.trim()) : null;
    return m ? tokens[m[1]]?.type : undefined;
  };
  const toToken = (name: string, v: Varying<PinValue>, path: string, prior: RawToken | undefined): RawToken | undefined => {
    const picked = pick(v, sel);
    if (!picked.ok) {
      issues.push({ kind: 'missing-axis-value', path, axis: picked.axis, value: picked.value });
      return undefined;
    }
    const obj: PinObject = isPinObject(picked.value) ? picked.value : { value: picked.value };
    const type = obj.type ?? prior?.type ?? refType(obj.value);
    if (type === undefined) issues.push({ kind: 'untyped-pin', token: name });
    return { type: type ?? 'unknown', value: obj.value, alpha: obj.alpha, description: obj.description ?? prior?.description };
  };

  for (const [name, v] of Object.entries(def.components ?? {})) {
    const token = toToken(name, v, `components.${name}`, undefined);
    if (token) put(name, token, 'components', 'value');
  }

  for (const [name, v] of Object.entries(def.pins ?? {})) {
    const prior = tokens[name];
    const token = toToken(name, v, `pins.${name}`, prior);
    if (!token) continue;
    tokens[name] = token;
    provenance[name] = prior
      ? { ...provenance[name], pinned: true, generated: prior }
      : { layer: 'pins', rule: 'value', pinned: false };
  }

  resolveTokens(tokens);
  return { tokens, provenance, issues };
}
```

- [ ] **Step 5: Export from the barrel.** Append to `packages/theme/src/engine.ts`:

```ts
export { derive } from './engine/derive';
export { mergeChain, type Lookup } from './engine/merge';
export { lightnessRamp, categoricalRamp, type LightnessParams } from './engine/ramps';
export { scale, type ScaleParams } from './engine/scales';
export type { DeriveResult, Issue, Layer, Provenance } from './engine/types';
export type * from './definition';
```

- [ ] **Step 6: Run the test, typecheck, commit**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx tsc --noEmit`
Expected: all pass; tsc exit 0.

Commit `packages/theme/src/engine.ts` and `packages/theme/src/engine/{derive,derive.test,semantics}.ts` as "derive a theme definition's tokens for one selection".

---

### Task 7: The `offset`, `contrast` and `check` rules

**Files:**
- Modify: `packages/theme/src/engine/semantics.ts`
- Create: `packages/theme/src/engine/semantics.test.ts`

Colors are measured on final values: a pinned ramp step is read at its pin. The fixture pins gray to weasel's shipping ramp, where the spec's expectation was checked by hand on 2026-09-13 — walking from beside raised (700) toward the light end, 600 and 500 fail 3:1 against raised and 400 clears 3.14 / 3.66 / 4.03; in light, walking from beside sunken (200), 300 and 400 fail against paper and 500 clears 7.40 / 6.52 / 4.96.

- [ ] **Step 1: Write the failing test** `packages/theme/src/engine/semantics.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { derive } from './derive';

const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'];
const SHIPPING = ['#f5f5f6', '#e6e7e9', '#c9cbcf', '#9ea1a8', '#6f737b', '#4d5058', '#383b42', '#25272c', '#181a1e', '#0e0f12'];
const by = (dark: string, light: string) => ({ by: 'mode', dark, light });

const W: ThemeDefinition = {
  name: 'w',
  axes: { mode: { default: 'dark', values: { dark: {}, light: {} } } },
  ramps: { gray: { kind: 'lightness', steps: STEPS, lightness: [0.973, 0.163], curve: 0.41, hue: 266, chroma: { peak: 0.0116, darkBias: 0.84 } } },
  semantics: {
    // Declared before the surfaces it reads, on purpose.
    'border-strong': { ramp: 'gray', contrast: { min: 3, against: ['surface', 'surface-raised', 'surface-sunken'] } },
    surface: { ramp: 'gray', step: by('800', '50') },
    'surface-raised': { ramp: 'gray', step: by('700', '100') },
    'surface-sunken': { ramp: 'gray', step: by('900', '200') },
    'fg-muted': { from: 'surface', offset: 5, dir: 'away' },
    deeper: { from: 'surface', offset: 1, dir: 'darker' },
    paler: { from: 'surface', offset: 1, dir: 'lighter' },
    fg: { ramp: 'gray', step: by('100', '900'), check: { contrast: 4.5, against: ['surface'] } },
    border: { ramp: 'gray', step: by('700', '200'), check: { contrast: 3, against: ['surface'] } },
  },
  pins: Object.fromEntries(STEPS.map((s, i) => [`gray-${s}`, SHIPPING[i]])),
};

const at = (mode: string) => derive(W, { mode });

describe('contrast rule', () => {
  it('walks away from the surfaces to the first step that clears every one', () => {
    expect(at('dark').tokens['border-strong'].value).toBe('{gray-400}');
    expect(at('light').tokens['border-strong'].value).toBe('{gray-500}');
  });

  it('reports when no step clears, and still yields a value', () => {
    const { tokens, issues } = derive(
      { ...W, semantics: { ...W.semantics, 'border-strong': { ramp: 'gray', contrast: { min: 30, against: ['surface'] } } } },
      { mode: 'dark' },
    );
    expect(issues).toContainEqual({ kind: 'contrast-unmet', token: 'border-strong', min: 30, against: ['surface'] });
    expect(tokens['border-strong'].value).toMatch(/^\{gray-\d+\}$/);
  });
});

describe('offset rule', () => {
  it('goes away from the reference toward the far end, so it flips with the mode', () => {
    expect(at('dark').tokens['fg-muted'].value).toBe('{gray-300}');
    expect(at('light').tokens['fg-muted'].value).toBe('{gray-500}');
  });

  it('reads darker and lighter from the ramp colors, not the step order', () => {
    expect(at('dark').tokens.deeper.value).toBe('{gray-900}');
    expect(at('dark').tokens.paler.value).toBe('{gray-700}');
  });
});

describe('check', () => {
  it('audits without changing the value', () => {
    const { tokens, issues } = at('dark');
    expect(tokens.border.value).toBe('{gray-700}');
    expect(issues.flatMap((i) => (i.kind === 'check-failed' ? [i.token] : []))).toEqual(['border']);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/semantics.test.ts`
Expected: FAIL — `offset` and `contrast` report "rule kind not supported yet".

- [ ] **Step 3: Implement.** In `semantics.ts`, add the imports and the color reader at the top of the file:

```ts
import { contrast, toLch } from './color/oklch';

const TOKEN_REF = /^\{([^}.]+)\}$/;
const HEX = /^#[0-9a-f]{6}$/i;
```

Inside `deriveSemantics`, after `get` is declared, add:

```ts
  /** A token's final solid color as hex, following references; undefined for anything else. */
  const color = (value: TokenValue | undefined, depth = 0): string | undefined => {
    if (typeof value !== 'string' || depth > 32) return undefined;
    const v = value.trim();
    const m = TOKEN_REF.exec(v);
    if (!m) return HEX.test(v) ? v.toLowerCase() : undefined;
    const name = m[1];
    const token = ctx.tokens[name] ?? get(name)?.token;
    if (token?.alpha !== undefined) return undefined;
    return color(ctx.pinned(name) ?? token?.value, depth + 1);
  };
```

Pass `color` into `deriveOne` (add a parameter `color: (v: TokenValue | undefined) => string | undefined`), and in `get`, after `derived = deriveOne(...)`, run the audit:

```ts
      const check = picked.value.check;
      if (derived && check) {
        const self = color(derived.token.value);
        for (const a of check.against) {
          const other = color(`{${a}}`);
          if (!self || !other) {
            ctx.issues.push({ kind: 'invalid', path: `semantics.${name}.check`, message: `"${a}" is not a solid color` });
            continue;
          }
          const ratio = contrast(self, other);
          if (ratio < check.contrast) ctx.issues.push({ kind: 'check-failed', token: name, against: a, min: check.contrast, ratio });
        }
      }
```

Replace the `rule kind not supported yet` fallthrough at the end of `deriveOne` with:

```ts
  const lightnessOf = (hex: string | undefined) => (hex ? toLch(hex).L : Number.NaN);
  const rampColor = (ramp: string, step: string) => color(`{${ramp}-${step}}`);

  if ('from' in r) {
    const from = get(r.from);
    if (!from?.position) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `"${r.from}" does not end on a ramp step` });
      return undefined;
    }
    const { ramp, index } = from.position;
    const steps = ctx.ramps[ramp];
    const last = steps.length - 1;
    const darker = lightnessOf(rampColor(ramp, steps[last])) < lightnessOf(rampColor(ramp, steps[0])) ? 1 : -1;
    const sign = r.dir === 'darker' ? darker : r.dir === 'lighter' ? -darker : index <= last / 2 ? 1 : -1;
    const target = index + sign * r.offset;
    if (target < 0 || target > last) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `offset ${r.offset} runs off ramp "${ramp}"` });
    }
    return atStep(name, ramp, Math.max(0, Math.min(last, target)), 'offset', description, ctx);
  }

  if ('contrast' in r) {
    const steps = ctx.ramps[r.ramp];
    if (!steps) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: `no ramp "${r.ramp}"` });
      return undefined;
    }
    const last = steps.length - 1;
    const colors = steps.map((s) => rampColor(r.ramp, s));
    const against = r.contrast.against.map((a) => ({ a, hex: color(`{${a}}`) }));
    if (colors.some((c) => !c) || against.some((x) => !x.hex)) {
      ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'contrast needs solid colors on both sides' });
      return undefined;
    }
    const meanL = against.reduce((sum, x) => sum + lightnessOf(x.hex), 0) / against.length;
    const sign = Math.abs(lightnessOf(colors[last]) - meanL) >= Math.abs(lightnessOf(colors[0]) - meanL) ? 1 : -1;
    const onRamp = r.contrast.against
      .map((a) => {
        const p = get(a)?.position;
        if (p?.ramp === r.ramp) return p.index;
        return a.startsWith(`${r.ramp}-`) ? steps.indexOf(a.slice(r.ramp.length + 1)) : -1;
      })
      .filter((i) => i >= 0);
    const start = onRamp.length === 0 ? (sign > 0 ? 0 : last) : sign > 0 ? Math.max(...onRamp) + 1 : Math.min(...onRamp) - 1;

    let best = { index: -1, worst: Number.NEGATIVE_INFINITY };
    for (let i = start; i >= 0 && i <= last; i += sign) {
      const worst = Math.min(...against.map((x) => contrast(colors[i]!, x.hex!)));
      if (worst >= r.contrast.min) return atStep(name, r.ramp, i, 'contrast', description, ctx);
      if (worst > best.worst) best = { index: i, worst };
    }
    ctx.issues.push({ kind: 'contrast-unmet', token: name, min: r.contrast.min, against: [...r.contrast.against] });
    return best.index >= 0 ? atStep(name, r.ramp, best.index, 'contrast', description, ctx) : undefined;
  }

  ctx.issues.push({ kind: 'invalid', path: `semantics.${name}`, message: 'unrecognized rule' });
  return undefined;
```

- [ ] **Step 4: Run the engine tests, typecheck, commit**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx tsc --noEmit`
Expected: all pass, including Task 6's; tsc exit 0.

Commit `packages/theme/src/engine/{semantics,semantics.test}.ts` as "derive offset and contrast semantics, and audit checks".

---

### Task 8: Axis dependencies

**Files:**
- Create: `packages/theme/src/engine/deps.ts`, `packages/theme/src/engine/deps.test.ts`

Nothing in a definition declares what a token varies on. This works it out statically: `own` is the axes the token's own entry varies on (a `by`, or a seed that has one); `all` adds everything reachable through references, rule inputs and ramp colors. The CSS emitter (Task 10) lists `own` tokens first in a block and `all`-only tokens after them. A pin replaces its token's entry, so a pinned token's dependencies are the pin's.

- [ ] **Step 1: Write the failing test** `packages/theme/src/engine/deps.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { axisDependencies } from './deps';

const D: ThemeDefinition = {
  name: 'd',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  seeds: { unit: { by: 'density', comfortable: 4, compact: 3 } },
  ramps: { gray: { kind: 'lightness', steps: ['50', '900'], lightness: [0.97, 0.16] } },
  scales: { space: { steps: ['sm', 'md'], base: '{seeds.unit}', step: 4 } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '900', light: '50' } },
    line: { ref: 'surface', alpha: 0.2 },
    edge: { ramp: 'gray', contrast: { min: 3, against: ['surface'] } },
    pad: { ref: 'space-md' },
    chip: { ref: 'pad' },
    mixed: { by: 'mode', dark: { ref: 'pad' }, light: { value: '1px', type: 'dimension' } },
  },
  pins: { 'radius-md': '5px', hairline: '{line}' },
};

describe('axisDependencies', () => {
  const deps = axisDependencies(D);

  it('finds a by on the token itself, directly or through a seed', () => {
    expect(deps.surface).toEqual({ own: ['mode'], all: ['mode'] });
    expect(deps['space-md']).toEqual({ own: ['density'], all: ['density'] });
  });

  it('follows references, rule inputs and pin values', () => {
    expect(deps.line).toEqual({ own: [], all: ['mode'] });
    expect(deps.edge).toEqual({ own: [], all: ['mode'] });
    expect(deps.hairline).toEqual({ own: [], all: ['mode'] });
  });

  it('counts a token that reaches density only through a chain of references', () => {
    expect(deps.chip).toEqual({ own: [], all: ['density'] });
  });

  it('orders axes by declaration and leaves invariant tokens empty', () => {
    expect(deps.mixed).toEqual({ own: ['mode'], all: ['mode', 'density'] });
    expect(deps['radius-md']).toEqual({ own: [], all: [] });
    expect(deps['gray-50']).toEqual({ own: [], all: [] });
  });

  it('takes a pinned token’s dependencies from its pin', () => {
    const pinned = axisDependencies({ ...D, pins: { ...D.pins, surface: '#000000' } });
    expect(pinned.surface).toEqual({ own: [], all: [] });
    expect(pinned.line).toEqual({ own: [], all: [] });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/deps.test.ts`
Expected: FAIL, cannot resolve `./deps`.

- [ ] **Step 3: Implement** `packages/theme/src/engine/deps.ts`:

```ts
import { isByAxis } from '../axes';
import type { SemanticRule, ThemeDefinition } from '../definition';
import { mergeChain, type Lookup } from './merge';

export interface AxisDependency {
  /** Axes this token's own entry varies on. */
  readonly own: readonly string[];
  /** `own` plus everything reachable through references and rule inputs. */
  readonly all: readonly string[];
}

interface Node {
  readonly axes: Set<string>;
  readonly seeds: Set<string>;
  readonly edges: Set<string>;
}

const SEED_REF = /^\{seeds\.([\w-]+)\}$/;
const TOKEN_REF = /^\{([^}.]+)\}$/;

const node = (): Node => ({ axes: new Set(), seeds: new Set(), edges: new Set() });

/** Collect `by` axes, seed references and `{token}` references anywhere in a value. */
function scan(v: unknown, into: Node): void {
  if (typeof v === 'string') {
    const s = v.trim();
    const seed = SEED_REF.exec(s);
    if (seed) into.seeds.add(seed[1]);
    else {
      const ref = TOKEN_REF.exec(s);
      if (ref) into.edges.add(ref[1]);
    }
    return;
  }
  if (Array.isArray(v)) {
    for (const x of v) scan(x, into);
    return;
  }
  if (typeof v === 'object' && v !== null) {
    if (isByAxis(v)) into.axes.add(v.by);
    for (const [k, x] of Object.entries(v)) if (k !== 'by') scan(x, into);
  }
}

/** The non-`by` values under a possibly nested `by` object. */
function leaves(v: unknown): unknown[] {
  return isByAxis(v) ? Object.entries(v).filter(([k]) => k !== 'by').flatMap(([, x]) => leaves(x)) : [v];
}

export function axisDependencies(definition: ThemeDefinition, lookup?: Lookup): Record<string, AxisDependency> {
  const def = mergeChain(definition, lookup);
  const nodes = new Map<string, Node>();

  for (const [name, ramp] of Object.entries(def.ramps ?? {})) {
    const n = node();
    scan(ramp, n);
    for (const step of ramp.steps) nodes.set(`${name}-${step}`, n);
  }
  for (const [name, s] of Object.entries(def.scales ?? {})) {
    const n = node();
    scan(s, n);
    for (const step of s.steps) nodes.set(`${name}-${step}`, n);
  }
  for (const [name, rule] of Object.entries(def.semantics ?? {})) {
    const n = node();
    scan(rule, n);
    for (const leaf of leaves(rule) as SemanticRule[]) {
      if ('ref' in leaf) n.edges.add(leaf.ref);
      if ('from' in leaf) n.edges.add(leaf.from);
      if ('step' in leaf) for (const s of leaves(leaf.step)) n.edges.add(`${leaf.ramp}-${String(s)}`);
      if ('contrast' in leaf) {
        for (const a of leaf.contrast.against) n.edges.add(a);
        for (const s of def.ramps?.[leaf.ramp]?.steps ?? []) n.edges.add(`${leaf.ramp}-${s}`);
      }
    }
    nodes.set(name, n);
  }
  for (const layer of [def.components, def.pins]) {
    for (const [name, v] of Object.entries(layer ?? {})) {
      const n = node();
      scan(v, n);
      nodes.set(name, n);
    }
  }

  const order = Object.keys(def.axes ?? {});
  const sorted = (s: Set<string>) => order.filter((a) => s.has(a));
  const ownOf = (n: Node) => {
    const out = new Set(n.axes);
    for (const seed of n.seeds) {
      const s = node();
      scan(def.seeds?.[seed], s);
      for (const a of s.axes) out.add(a);
    }
    return out;
  };

  const memo = new Map<string, Set<string>>();
  const allOf = (name: string, visiting: Set<string>): Set<string> => {
    const cached = memo.get(name);
    if (cached) return cached;
    const n = nodes.get(name);
    if (!n || visiting.has(name)) return new Set();
    visiting.add(name);
    const out = ownOf(n);
    for (const e of n.edges) for (const a of allOf(e, visiting)) out.add(a);
    visiting.delete(name);
    memo.set(name, out);
    return out;
  };

  const result: Record<string, AxisDependency> = {};
  for (const [name, n] of nodes) result[name] = { own: sorted(ownOf(n)), all: sorted(allOf(name, new Set())) };
  return result;
}
```

A step semantic's edges include its ramp tokens, which carry no axes unless the ramp's parameters vary, so `surface` stays `own: ['mode']` with nothing added.

- [ ] **Step 4: Export, run, typecheck, commit.** Add `export { axisDependencies, type AxisDependency } from './engine/deps';` to `packages/theme/src/engine.ts`.

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx tsc --noEmit`
Expected: all pass; tsc exit 0.

Commit `packages/theme/src/engine.ts` and `packages/theme/src/engine/{deps,deps.test}.ts` as "work out which axes each theme token depends on".

---

### Task 9: Baking

**Files:**
- Create: `packages/theme/src/engine/bake.ts`, `packages/theme/src/engine/bake.test.ts`

`bake` runs `derive` for every selection and folds the results back into one token record with no rules left. References stay references. A token whose derived value differs between selections becomes a `by` over exactly the axes that change it, found by flipping one axis at a time. A theme that extends another keeps only the tokens whose derived value differs from its parent's somewhere, so `extends` at runtime still rebases through the parent's references. A selection that produced no value leaves its branch out.

- [ ] **Step 1: Write the failing test** `packages/theme/src/engine/bake.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../definition';
import { bake } from './bake';

const P: ThemeDefinition = {
  name: 'p',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  ramps: { gray: { kind: 'lightness', steps: ['50', '800'], lightness: [0.97, 0.2] } },
  semantics: {
    surface: { ramp: 'gray', step: { by: 'mode', dark: '800', light: '50' } },
    line: { ref: 'surface', alpha: 0.2, type: 'color' },
    gap: { by: 'mode', dark: { by: 'density', comfortable: { value: '4px', type: 'dimension' }, compact: { value: '3px', type: 'dimension' } }, light: { value: '4px', type: 'dimension' } },
    glow: { by: 'mode', dark: { value: '#ffffff', type: 'color' } },
  },
  pins: { 'gray-800': '#181a1e' },
};
const defs: Record<string, ThemeDefinition> = { p: P };

describe('bake', () => {
  const baked = bake(P);

  it('keeps references and splits only what varies', () => {
    expect(baked.tokens.surface).toEqual({
      by: 'mode',
      dark: { type: 'color', value: '{gray-800}' },
      light: { type: 'color', value: '{gray-50}' },
    });
    expect(baked.tokens.line).toEqual({ type: 'color', value: '{surface}', alpha: 0.2 });
    expect(baked.tokens['gray-800']).toEqual({ type: 'color', value: '#181a1e' });
  });

  it('nests a two-axis token in axis declaration order', () => {
    expect(baked.tokens.gap).toEqual({
      by: 'mode',
      dark: { by: 'density', comfortable: { type: 'dimension', value: '4px' }, compact: { type: 'dimension', value: '3px' } },
      light: { by: 'density', comfortable: { type: 'dimension', value: '4px' }, compact: { type: 'dimension', value: '4px' } },
    });
  });

  it('leaves out a branch the definition never produced', () => {
    expect(baked.tokens.glow).toEqual({ by: 'mode', dark: { type: 'color', value: '#ffffff' } });
  });

  it('keeps only what a child changes', () => {
    const child = bake({ name: 'c', extends: 'p', pins: { 'gray-800': '#222222' } }, (n) => defs[n]);
    expect(child).toMatchObject({ name: 'c', extends: 'p' });
    expect(Object.keys(child.tokens)).toEqual(['gray-800']);
    expect(child.axes).toEqual(P.axes);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/bake.test.ts`
Expected: FAIL, cannot resolve `./bake`.

- [ ] **Step 3: Implement** `packages/theme/src/engine/bake.ts`:

```ts
import { enumerateSelections, fullSelection, selectionKey, type AxisDefs, type Selection, type Varying } from '../axes';
import type { ThemeDefinition } from '../definition';
import type { RawToken } from '../dtcg/types';
import { derive } from './derive';
import { mergeChain, type Lookup } from './merge';

/** A definition with every rule run: plain or `by`-varying tokens, references intact. */
export interface BakedTheme {
  readonly name: string;
  readonly extends: string | null;
  readonly axes: AxisDefs;
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
}

/** Drop undefined fields so tokens compare and serialize the same way. */
function normalize(t: RawToken): RawToken {
  return {
    type: t.type,
    value: t.value,
    ...(t.alpha !== undefined ? { alpha: t.alpha } : {}),
    ...(t.description !== undefined ? { description: t.description } : {}),
  };
}

const same = (a: RawToken | undefined, b: RawToken | undefined) => JSON.stringify(a) === JSON.stringify(b);

type Table = Map<string, Record<string, RawToken>>;

function table(def: ThemeDefinition, axes: AxisDefs, lookup: Lookup | undefined): Table {
  const out: Table = new Map();
  for (const sel of enumerateSelections(axes)) {
    const { tokens } = derive(def, sel, lookup);
    const normalized: Record<string, RawToken> = {};
    for (const [name, t] of Object.entries(tokens)) normalized[name] = normalize(t);
    out.set(selectionKey(axes, sel), normalized);
  }
  return out;
}

export function bake(definition: ThemeDefinition, lookup?: Lookup): BakedTheme {
  const axes = mergeChain(definition, lookup).axes ?? {};
  const own = table(definition, axes, lookup);
  const parentDef = definition.extends ? lookup?.(definition.extends) : undefined;
  const parent = parentDef ? table(parentDef, axes, lookup) : undefined;

  const at = (t: Table | undefined, sel: Selection, name: string) => t?.get(selectionKey(axes, sel))?.[name];

  const names = [...new Set([...own.values()].flatMap((tokens) => Object.keys(tokens)))];
  const defaultTokens = own.get(selectionKey(axes, {})) ?? {};
  names.sort((a, b) => (a in defaultTokens ? 0 : 1) - (b in defaultTokens ? 0 : 1));

  const selections = enumerateSelections(axes);
  const tokens: Record<string, Varying<RawToken>> = {};
  for (const name of names) {
    if (parent && selections.every((sel) => same(at(own, sel, name), at(parent, sel, name)))) continue;

    const varying = Object.keys(axes).filter((axis) =>
      selections.some((sel) =>
        Object.keys(axes[axis].values).some((v) => !same(at(own, sel, name), at(own, { ...sel, [axis]: v }, name))),
      ),
    );

    const build = (i: number, sel: Record<string, string>): Varying<RawToken> | undefined => {
      if (i === varying.length) return at(own, fullSelection(axes, sel), name);
      const axis = varying[i];
      const branch: Record<string, unknown> = { by: axis };
      for (const v of Object.keys(axes[axis].values)) {
        const x = build(i + 1, { ...sel, [axis]: v });
        if (x !== undefined) branch[v] = x;
      }
      return branch as Varying<RawToken>;
    };
    const value = build(0, {});
    if (value !== undefined) tokens[name] = value;
  }

  return { name: definition.name, extends: definition.extends ?? null, axes, tokens };
}
```

`Array.prototype.sort` is stable, so the sort only moves tokens the default selection lacks to the end and keeps derivation order otherwise.

- [ ] **Step 4: Export, run, typecheck, commit.** Add `export { bake, type BakedTheme } from './engine/bake';` to `packages/theme/src/engine.ts`.

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine && npx tsc --noEmit`
Expected: all pass; tsc exit 0.

Commit `packages/theme/src/engine.ts` and `packages/theme/src/engine/{bake,bake.test}.ts` as "bake a theme definition into plain and axis-varying tokens".

---

### Task 10: Emitters for `tokens.css`, `manifest.ts` and `themes.ts`

**Files:**
- Modify: `packages/theme/src/axes.ts` (add `pickAll`)
- Create: `packages/theme/src/engine/emit/css.ts`, `emit/manifest.ts`, `emit/themes.ts`, `emit/emit.test.ts`

These are pure functions from baked themes to file text. Task 11 wires them into `build-tokens.ts`. Keep the comment and doc-comment text of today's generated files: copy it from `packages/theme/scripts/build-tokens.ts` where the steps say so.

- [ ] **Step 1: Add `pickAll`** to `packages/theme/src/axes.ts` (the runtime needs it too):

```ts
/** Every entry of a varying record that has a value for this selection, in record order. */
export function pickAll<T>(record: Readonly<Record<string, Varying<T>>>, selection: Selection): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [name, v] of Object.entries(record)) {
    const picked = pick(v, selection);
    if (picked.ok) out[name] = picked.value;
  }
  return out;
}
```

- [ ] **Step 2: Write the failing test** `packages/theme/src/engine/emit/emit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { ThemeDefinition } from '../../definition';
import { bake } from '../bake';
import { axisDependencies } from '../deps';
import { emitCss } from './css';
import { emitManifest } from './manifest';
import { emitThemes } from './themes';

const E: ThemeDefinition = {
  name: 'e',
  axes: {
    mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  semantics: {
    surface: { by: 'mode', dark: { ref: 'ink', type: 'color', description: 'The page.' }, light: { ref: 'paper', type: 'color' } },
    gap: { by: 'density', comfortable: { value: '4px', type: 'dimension' }, compact: { value: '3px', type: 'dimension' } },
  },
  pins: {
    ink: { value: '#111111', type: 'color' },
    paper: { value: '#eeeeee', type: 'color' },
    line: { value: '{surface}', type: 'color', alpha: 0.2 },
    pad: { value: '{gap}', type: 'dimension' },
    'pad-edge': { by: 'mode', dark: { value: '{pad}', type: 'dimension' }, light: { value: '0px', type: 'dimension' } },
  },
};

const input = (def: ThemeDefinition, isDefault = true) => ({ baked: bake(def), deps: axisDependencies(def), isDefault });
const css = emitCss([input(E)]);

describe('emitCss', () => {
  it('declares every token in :root, in order, with the default scheme and descriptions', () => {
    expect(css).toContain(':root {\n  color-scheme: dark;\n  /* The page. */\n  --wzl-surface: var(--wzl-ink);\n  --wzl-gap: 4px;\n');
    expect(css).toContain('  --wzl-line: color-mix(in srgb, var(--wzl-surface) 20%, transparent);\n');
  });

  it('writes a block per axis value: own values first, then what depends through a reference', () => {
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-mode='light'],\n[data-wzl-mode='light'] {\n  color-scheme: light;\n  --wzl-surface: var(--wzl-paper);\n  --wzl-line: color-mix(in srgb, var(--wzl-surface) 20%, transparent);\n}\n",
    );
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-density='compact'],\n[data-wzl-density='compact'] {\n  --wzl-gap: 3px;\n  --wzl-pad: var(--wzl-gap);\n}\n",
    );
  });

  it('puts a token that depends on two axes in the compound blocks only', () => {
    expect(css).toContain(
      "[data-wzl-theme='e'][data-wzl-mode='light'][data-wzl-density='compact'],\n[data-wzl-mode='light'][data-wzl-density='compact'] {\n  --wzl-pad-edge: 0px;\n}\n",
    );
    const single = css.split('\n\n').filter((b) => /^\[data-wzl-theme='e'\]\[data-wzl-\w+='\w+'\],/.test(b));
    expect(single.some((b) => b.includes('--wzl-pad-edge'))).toBe(false);
  });

  it('gives a non-default theme no :root and a theme-scoped selector only', () => {
    const other = emitCss([input({ ...E, name: 'o' }, false)]);
    expect(other).not.toContain(':root');
    expect(other).toContain("[data-wzl-theme='o'][data-wzl-mode='light'] {\n");
  });
});

describe('emitManifest', () => {
  it('lists the default theme’s tokens in order with resolved default values', () => {
    const text = emitManifest(input(E));
    expect(text).toContain("  { name: '--wzl-surface', type: \"color\", group: \"surface\", defaultValue: \"#111111\", description: \"The page.\" },");
    expect(text.indexOf("'--wzl-surface'")).toBeLessThan(text.indexOf("'--wzl-ink'"));
  });
});

describe('emitThemes', () => {
  it('resolves every selection and carries the definition and the baked form', () => {
    const text = emitThemes([{ definition: E, baked: bake(E) }]);
    expect(text).toContain("'mode=light,density=compact'");
    expect(text).toContain("'--wzl-pad-edge': \"0px\"");
    expect(text).toContain('export const THEME_SOURCES');
    expect(text).toContain('export const BAKED_THEMES');
    expect(text).toMatch(/export type TokenName =\n {2}\| '--wzl-gap'/);
  });
});
```

- [ ] **Step 3: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/emit`
Expected: FAIL, cannot resolve `./css`.

- [ ] **Step 4: Implement** `packages/theme/src/engine/emit/css.ts`:

```ts
import { fullSelection, pickAll, type AxisDefs, type Selection } from '../../axes';
import { resolveTokens } from '../../dtcg/resolve';
import type { RawToken } from '../../dtcg/types';
import type { BakedTheme } from '../bake';
import type { AxisDependency } from '../deps';

export interface EmitInput {
  readonly baked: BakedTheme;
  readonly deps: Readonly<Record<string, AxisDependency>>;
  /** The default theme alone gets `:root` and the unscoped selectors. */
  readonly isDefault: boolean;
}

const REF = /^\{([^}]+)\}$/;

/** `{gray-100}` → `gray-100`. A group prefix (`{color.gray-100}`) is dropped, as `resolveTokens` does. */
function refTarget(token: RawToken): string | null {
  const m = typeof token.value === 'string' ? REF.exec(token.value.trim()) : null;
  if (!m) return null;
  const dot = m[1].indexOf('.');
  return dot === -1 ? m[1] : m[1].slice(dot + 1);
}

export function cssValue(name: string, token: RawToken): string {
  const target = refTarget(token);
  if (target === null) return resolveTokens({ [name]: token })[name];
  if (token.alpha === undefined) return `var(--wzl-${target})`;
  return `color-mix(in srgb, var(--wzl-${target}) ${Math.round(token.alpha * 100)}%, transparent)`;
}

/** Non-empty subsets of the axes, in declaration order, smallest first. */
function axisSets(axes: AxisDefs): string[][] {
  const names = Object.keys(axes);
  const sets: string[][] = [];
  for (let mask = 1; mask < 1 << names.length; mask += 1) sets.push(names.filter((_, i) => mask & (1 << i)));
  return sets.sort((a, b) => a.length - b.length);
}

function combinations(axes: AxisDefs, set: readonly string[]): Selection[] {
  let out: Record<string, string>[] = [{}];
  for (const axis of set) out = out.flatMap((s) => Object.keys(axes[axis].values).map((v) => ({ ...s, [axis]: v })));
  return out;
}

export function emitCss(themes: readonly EmitInput[]): string {
  const lines = [
    '/* GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    ' * Source: packages/theme/themes/<theme>.json',
    ' */',
    '',
  ];

  for (const { baked, deps, isDefault } of themes) {
    const { axes, name: theme } = baked;
    const defaults = pickAll(baked.tokens, fullSelection(axes, {}));
    const order = Object.keys(defaults);

    if (isDefault) {
      // The default selection's scheme, not just its values: a surface that never calls
      // applyTheme would otherwise get dark colors with light native widgets.
      lines.push(':root {');
      for (const def of Object.values(axes)) {
        const scheme = def.values[def.default]?.scheme;
        if (scheme) lines.push(`  color-scheme: ${scheme};`);
      }
      for (const name of order) {
        const desc = defaults[name].description;
        if (desc) lines.push(`  /* ${desc} */`);
        lines.push(`  --wzl-${name}: ${cssValue(name, defaults[name])};`);
      }
      lines.push('}', '');
    }

    for (const set of axisSets(axes)) {
      const key = set.join(',');
      const members = order.filter((n) => (deps[n]?.all ?? []).join(',') === key);
      const ownFirst = [...members.filter((n) => (deps[n]?.own.length ?? 0) > 0), ...members.filter((n) => (deps[n]?.own.length ?? 0) === 0)];
      const schemeAxis = set.length === 1 ? set[0] : undefined;

      for (const combo of combinations(axes, set)) {
        const scheme = schemeAxis ? axes[schemeAxis].values[combo[schemeAxis]]?.scheme : undefined;
        if (ownFirst.length === 0 && !scheme) continue;
        const attrs = set.map((a) => `[data-wzl-${a}='${combo[a]}']`).join('');
        lines.push(isDefault ? `[data-wzl-theme='${theme}']${attrs},` : `[data-wzl-theme='${theme}']${attrs} {`);
        if (isDefault) lines.push(`${attrs} {`);
        if (scheme) lines.push(`  color-scheme: ${scheme};`);
        const values = pickAll(baked.tokens, fullSelection(axes, combo));
        for (const name of ownFirst) if (values[name]) lines.push(`  --wzl-${name}: ${cssValue(name, values[name])};`);
        lines.push('}', '');
      }
    }
  }

  return lines.join('\n');
}
```

A theme that extends another only has its own tokens in `baked.tokens`, so its blocks carry only what it changed — the parent's blocks supply the rest.

- [ ] **Step 5: Implement** `packages/theme/src/engine/emit/manifest.ts`. The text around the rows is today's, from `emitManifest` in `packages/theme/scripts/build-tokens.ts`, with "mode" widened to "selection".

```ts
import { fullSelection, pickAll } from '../../axes';
import { resolveTokens } from '../../dtcg/resolve';
import type { EmitInput } from './css';

export function emitManifest({ baked }: EmitInput): string {
  const all = pickAll(baked.tokens, fullSelection(baked.axes, {}));
  const resolved = resolveTokens(all);
  const rows = Object.entries(all).map(([name, token]) => {
    const group = name.includes('-') ? name.slice(0, name.indexOf('-')) : name;
    return `  { name: '--wzl-${name}', type: ${JSON.stringify(token.type)}, group: ${JSON.stringify(group)}, defaultValue: ${JSON.stringify(resolved[name])}, description: ${JSON.stringify(token.description ?? '')} },`;
  });
  return [
    '// GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    '',
    '/** One row of `TOKEN_MANIFEST`: a token, its DTCG type, the name-prefix',
    ' *  group it belongs to, its value in the default theme and selection, and',
    ' *  the description it was authored with (empty string if none). */',
    'export interface TokenManifestEntry {',
    '  readonly name: string;',
    '  readonly type: string;',
    '  readonly group: string;',
    '  readonly defaultValue: string;',
    '  readonly description: string;',
    '}',
    '',
    '/** Every token of the default theme at its default selection, described.',
    ' *  Meant for tooling that presents the token set — docs pages, token',
    ' *  browsers, the Storybook CSS-vars addon — not for resolving values at',
    ' *  runtime. */',
    'export const TOKEN_MANIFEST: readonly TokenManifestEntry[] = [',
    rows.join('\n'),
    '];',
    '',
  ].join('\n');
}
```

- [ ] **Step 6: Implement** `packages/theme/src/engine/emit/themes.ts`:

```ts
import { enumerateSelections, pickAll, selectionKey } from '../../axes';
import type { ThemeDefinition } from '../../definition';
import { resolveTokens } from '../../dtcg/resolve';
import type { BakedTheme } from '../bake';

export interface ThemesInput {
  readonly definition: ThemeDefinition;
  readonly baked: BakedTheme;
}

/** A child's baked tokens over its parent's, so every selection resolves completely. */
function flatten(baked: BakedTheme, byName: ReadonlyMap<string, BakedTheme>): BakedTheme['tokens'] {
  const parent = baked.extends ? byName.get(baked.extends) : undefined;
  if (baked.extends && !parent) throw new Error(`Theme "${baked.name}" extends "${baked.extends}", which is not in themes/`);
  return { ...(parent ? flatten(parent, byName) : {}), ...baked.tokens };
}

export function emitThemes(themes: readonly ThemesInput[]): string {
  const byName = new Map(themes.map((t) => [t.baked.name, t.baked]));
  const names = new Set<string>();

  const entries = themes.map(({ baked }) => {
    const tokens = flatten(baked, byName);
    const selections = enumerateSelections(baked.axes).map((sel) => {
      const resolved = resolveTokens(pickAll(tokens, sel));
      for (const n of Object.keys(resolved)) names.add(`--wzl-${n}`);
      const body = Object.entries(resolved).map(([n, v]) => `        '--wzl-${n}': ${JSON.stringify(v)},`).join('\n');
      return `      '${selectionKey(baked.axes, sel)}': {\n${body}\n      },`;
    });
    return [
      `  ${JSON.stringify(baked.name)}: {`,
      `    name: ${JSON.stringify(baked.name)},`,
      `    axes: ${JSON.stringify(baked.axes)},`,
      '    selections: {',
      selections.join('\n'),
      '    },',
      '  },',
    ].join('\n');
  });

  const sources = Object.fromEntries(themes.map((t) => [t.definition.name, t.definition]));
  const bakedAll = Object.fromEntries(themes.map((t) => [t.baked.name, t.baked]));

  return [
    '// GENERATED by packages/theme/scripts/build-tokens.ts — do not edit.',
    '',
    "import type { AxisDefs } from '../axes';",
    "import type { ThemeDefinition } from '../definition';",
    "import type { BakedTheme } from '../engine/bake';",
    '',
    '/** Every design token the built-in themes declare, spelled as the CSS',
    ' *  custom property it becomes. */',
    'export type TokenName =',
    `${[...names].sort().map((n) => `  | '${n}'`).join('\n')};`,
    '',
    '/** A built-in theme with its aliases already collapsed: every selection',
    ' *  (keyed `mode=dark`, axes in declaration order) maps every token name to',
    ' *  a final CSS value. */',
    'export interface GeneratedTheme {',
    '  readonly name: string;',
    '  readonly axes: AxisDefs;',
    '  readonly selections: Readonly<Record<string, Readonly<Record<TokenName, string>>>>;',
    '}',
    '',
    '/** The built-in themes, resolved, keyed by theme name. Read this to list',
    ' *  or preview themes without resolving a token graph yourself. */',
    'export const THEMES = {',
    entries.join('\n'),
    '} as const satisfies Record<string, GeneratedTheme>;',
    '',
    '/** The built-in themes as authored. The theme editor reads these. */',
    `export const THEME_SOURCES: Readonly<Record<string, ThemeDefinition>> = ${JSON.stringify(sources, null, 2)};`,
    '',
    '/** The built-in themes with every rule run and references intact. This is',
    ' *  what `weaselTheme` is built from, so the runtime entry bundles no generator. */',
    `export const BAKED_THEMES: Readonly<Record<string, BakedTheme>> = ${JSON.stringify(bakedAll, null, 2)};`,
    '',
  ].join('\n');
}
```

- [ ] **Step 7: Run, typecheck, commit.** Export `emitCss`, `cssValue`, `emitManifest`, `emitThemes` and their input types from `packages/theme/src/engine.ts`.

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine packages/theme/src/axes.test.ts && npx tsc --noEmit`
Expected: all pass; tsc exit 0.

Commit `packages/theme/src/axes.ts`, `packages/theme/src/engine.ts` and `packages/theme/src/engine/emit/` as "emit tokens.css, the token manifest and themes.ts from baked themes".

---

### Task 11: Convert weasel's DTCG source to `themes/weasel.json`, and prove the output unchanged

**Files:**
- Create: `packages/theme/scripts/convert-dtcg-theme.ts` (deleted in Task 12)
- Create: `packages/theme/scripts/gate-conversion.ts` (deleted in Task 12)
- Create: `packages/theme/themes/weasel.json` (generated by the first script, then committed)

Nothing reads `weasel.json` yet; `build-tokens.ts` still reads `tokens/weasel/`. This task only proves the new pipeline would emit the same declarations. See the spec's "Converting weasel" for why the gate compares declarations and not bytes.

- [ ] **Step 1: Write the converter** `packages/theme/scripts/convert-dtcg-theme.ts`:

```ts
/** One-off: tokens/weasel/ (DTCG) → themes/weasel.json. Deleted once the conversion lands. */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '../src/definition';
import { flattenTokens } from '../src/dtcg/flatten';
import type { RawToken } from '../src/dtcg/types';
import { DEFAULT_CONSTRAINTS } from '../src/engine/color/generate';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../tokens/weasel');
const read = (p: string) => JSON.parse(readFileSync(resolve(src, p), 'utf8'));

const manifest: { name: string; defaultMode: string; modes: Record<string, { colorScheme: 'dark' | 'light' }> } = read('theme.json');
const primitives = flattenTokens(read('primitives.tokens.json'));
const modeNames = Object.keys(manifest.modes);
const modes = Object.fromEntries(modeNames.map((m) => [m, flattenTokens(read(`modes/${m}.tokens.json`))]));

/** `{color.gray-800}` → `gray-800`, or null for a literal. */
const refName = (t: RawToken) => {
  const m = typeof t.value === 'string' ? /^\{(?:[\w-]+\.)?([^}.]+)\}$/.exec(t.value.trim()) : null;
  return m ? m[1] : null;
};
const extra = (t: RawToken) => ({
  ...(t.alpha !== undefined ? { alpha: t.alpha } : {}),
  ...(t.description ? { description: t.description } : {}),
});

const pin = (t: RawToken) => {
  const ref = refName(t);
  return { value: ref ? `{${ref}}` : t.value, type: t.type, ...extra(t) };
};
const rule = (t: RawToken) => {
  const ref = refName(t);
  return ref ? { ref, type: t.type, ...extra(t) } : { value: t.value, type: t.type, ...extra(t) };
};

const { count: _count, anchors: _anchors, ...gates } = DEFAULT_CONSTRAINTS;

const definition = {
  name: manifest.name,
  axes: {
    mode: {
      default: manifest.defaultMode,
      values: Object.fromEntries(modeNames.map((m) => [m, { scheme: manifest.modes[m].colorScheme }])),
    },
  },
  ramps: {
    gray: {
      kind: 'lightness',
      steps: ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900'],
      lightness: [0.973, 0.163],
      curve: 0.41,
      hue: 266,
      chroma: { peak: 0.0116, darkBias: 0.84 },
    },
    accent: { kind: 'lightness', steps: ['soft', 'base', 'strong'], lightness: [0.252, 0.471], curve: 0, anchor: { base: '#2e1f7a' } },
    swatch: {
      kind: 'categorical',
      steps: ['fuchsia', 'green', 'sky', 'amber', 'teal', 'red', 'blue', 'citron', 'rose', 'violet'],
      gates,
    },
  },
  semantics: Object.fromEntries(
    Object.keys(modes[manifest.defaultMode]).map((name) => [
      name,
      { by: 'mode', ...Object.fromEntries(modeNames.map((m) => [m, rule(modes[m][name])])) },
    ]),
  ),
  pins: Object.fromEntries(Object.entries(primitives).map(([name, t]) => [name, pin(t)])),
} satisfies ThemeDefinition;

mkdirSync(resolve(here, '../themes'), { recursive: true });
writeFileSync(resolve(here, '../themes/weasel.json'), `${JSON.stringify(definition, null, 2)}\n`);
console.log(`wrote themes/weasel.json: ${Object.keys(definition.pins).length} pins, ${Object.keys(definition.semantics).length} semantics`);
```

If `satisfies ThemeDefinition` rejects the `kind` strings as `string`, add `as const` to each ramp object.

- [ ] **Step 2: Run it**

Run: `cd packages/theme && npx tsx scripts/convert-dtcg-theme.ts && cd ../..`
Expected: `wrote themes/weasel.json: 89 pins, 11 semantics`

- [ ] **Step 3: Write the gate** `packages/theme/scripts/gate-conversion.ts`. It compares one directory of generated output against another: declarations per CSS block (with each declaration's description), manifest rows by name, and every resolved theme value.

```ts
/** One-off gate for the DTCG → definition conversion. Usage: tsx gate-conversion.ts <old-dir> <new-dir> */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const [oldDir, newDir] = process.argv.slice(2).map((d) => resolve(d));
const failures: string[] = [];

function blocks(css: string): Map<string, Map<string, string>> {
  const out = new Map<string, Map<string, string>>();
  for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const selector = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim().replace(/\s+/g, ' ');
    const decls = new Map<string, string>();
    let pending = '';
    for (const line of m[2].split('\n').map((l) => l.trim()).filter(Boolean)) {
      const comment = /^\/\* (.*) \*\/$/.exec(line);
      if (comment) {
        pending = comment[1];
        continue;
      }
      const d = /^([\w-]+)\s*:\s*(.+);$/.exec(line);
      if (d) decls.set(d[1], `${d[2]}${pending ? `  /* ${pending} */` : ''}`);
      pending = '';
    }
    out.set(selector, decls);
  }
  return out;
}

const read = (dir: string, f: string) => readFileSync(resolve(dir, f), 'utf8');

const before = blocks(read(oldDir, 'tokens.css'));
const after = blocks(read(newDir, 'tokens.css'));
if ([...before.keys()].sort().join('|') !== [...after.keys()].sort().join('|')) {
  failures.push(`selectors differ:\n  old ${[...before.keys()].join(' | ')}\n  new ${[...after.keys()].join(' | ')}`);
}
for (const [selector, decls] of before) {
  const next = after.get(selector) ?? new Map();
  for (const [prop, value] of decls) if (next.get(prop) !== value) failures.push(`${selector} ${prop}: ${value} → ${next.get(prop)}`);
  for (const prop of next.keys()) if (!decls.has(prop)) failures.push(`${selector} ${prop}: added`);
}

const rows = (text: string) => new Map([...text.matchAll(/^ {2}\{ name: '([^']+)'.*$/gm)].map((m) => [m[1], m[0]]));
const oldRows = rows(read(oldDir, 'manifest.ts'));
const newRows = rows(read(newDir, 'manifest.ts'));
if (oldRows.size !== newRows.size) failures.push(`manifest rows ${oldRows.size} → ${newRows.size}`);
for (const [name, row] of oldRows) if (newRows.get(name) !== row) failures.push(`manifest ${name}:\n  ${row}\n  ${newRows.get(name)}`);

const oldThemes = await import(resolve(oldDir, 'themes.ts'));
const newThemes = await import(resolve(newDir, 'themes.ts'));
for (const [mode, values] of Object.entries(oldThemes.THEMES.weasel.modes as Record<string, Record<string, string>>)) {
  const next = newThemes.THEMES.weasel.selections[`mode=${mode}`] ?? {};
  for (const [name, v] of Object.entries(values)) if (next[name] !== v) failures.push(`THEMES ${mode} ${name}: ${v} → ${next[name]}`);
  if (Object.keys(next).length !== Object.keys(values).length) failures.push(`THEMES ${mode}: ${Object.keys(values).length} → ${Object.keys(next).length} tokens`);
}
const tokenNames = (text: string) => [...text.matchAll(/^ {2}\| '([^']+)'/gm)].map((m) => m[1]).join(',');
if (tokenNames(read(oldDir, 'themes.ts')) !== tokenNames(read(newDir, 'themes.ts'))) failures.push('TokenName differs');

console.log(failures.length === 0 ? 'gate: same declarations, rows and values' : failures.join('\n'));
process.exit(failures.length === 0 ? 0 : 1);
```

The two `themes.ts` files import types from `'../dtcg/types'` and friends; `tsx` erases type-only imports, so loading them from a temp directory works. If one fails to load, copy `src/` beside the temp directory's parent instead.

- [ ] **Step 4: Emit with the engine into a temp directory.** Write `packages/theme/scripts/emit-preview.ts` (deleted in Task 12, where `build-tokens.ts` takes over):

```ts
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ThemeDefinition } from '../src/definition';
import { axisDependencies, bake, derive, emitCss, emitManifest, emitThemes } from '../src/engine';

const out = resolve(process.argv[2]);
const definition: ThemeDefinition = JSON.parse(readFileSync(resolve(import.meta.dirname, '../themes/weasel.json'), 'utf8'));
for (const mode of Object.keys(definition.axes!.mode.values)) {
  const { issues } = derive(definition, { mode });
  if (issues.length) throw new Error(`weasel ${mode}: ${JSON.stringify(issues, null, 2)}`);
}
const input = { baked: bake(definition), deps: axisDependencies(definition), isDefault: true };
mkdirSync(out, { recursive: true });
writeFileSync(resolve(out, 'tokens.css'), emitCss([input]));
writeFileSync(resolve(out, 'manifest.ts'), emitManifest(input));
writeFileSync(resolve(out, 'themes.ts'), emitThemes([{ definition, baked: input.baked }]));
```

- [ ] **Step 5: Run the gate**

```bash
GATE=$(mktemp -d)
mkdir -p "$GATE/old" "$GATE/new"
cp packages/theme/src/generated/{tokens.css,manifest.ts,themes.ts} "$GATE/old/"
npx tsx packages/theme/scripts/emit-preview.ts "$GATE/new"
npx tsx packages/theme/scripts/gate-conversion.ts "$GATE/old" "$GATE/new"
```

Expected: `gate: same declarations, rows and values`, exit 0.

A failure here is the point of the task — fix the converter or an emitter, never the gate. The likely ones: a mode token whose description exists in one mode only (the `:root` comment must come from the default mode's branch), a primitive reference whose group prefix survived (`{color.x}`), and a `type` lost on a reference semantic.

- [ ] **Step 6: Commit** `packages/theme/themes/weasel.json` and the three scripts as "convert weasel's DTCG tokens to a theme definition".

---

### Task 12: Switch `@weasel-js/theme` onto the engine (breaking)

**Files:**
- Rewrite: `packages/theme/scripts/build-tokens.ts`, `packages/theme/src/theme.ts`, `resolveTheme.ts`, `applyTheme.ts`, `react.tsx`, `loadDTCG.ts`, `index.ts`
- Rewrite tests: `theme.test.ts`, `resolveTheme.test.ts`, `applyTheme.test.ts`, `react.test.tsx`, `loadDTCG.test.ts`, `generated/generated.test.ts`, `dtcg/source.test.ts`
- Regenerate: `packages/theme/src/generated/{tokens.css,themes.ts,manifest.ts}`
- Delete: `packages/theme/tokens/`, `scripts/convert-dtcg-theme.ts`, `scripts/gate-conversion.ts`, `scripts/emit-preview.ts`

The repo does not typecheck between this task and Task 13, which moves the callers. Commit once, at the end of Task 13.

- [ ] **Step 1: Rewrite `build-tokens.ts`** whole:

```ts
/**
 * Generates every token artifact from the theme definitions in themes/. Run via
 * `npm run gen:tokens -w @weasel-js/theme`; CI re-runs it and fails on a diff,
 * so the committed output under src/generated/ is never edited by hand.
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { enumerateSelections } from '../src/axes';
import type { ThemeDefinition } from '../src/definition';
import { axisDependencies, bake, derive, emitCss, emitManifest, emitThemes, mergeChain } from '../src/engine';

const here = dirname(fileURLToPath(import.meta.url));
const THEMES_DIR = resolve(here, '../themes');
// Overridable so the determinism check can generate into a temp dir instead of
// rewriting the committed files other tests are reading from concurrently.
const OUT_DIR = process.env.WZL_TOKENS_OUT_DIR
  ? resolve(process.env.WZL_TOKENS_OUT_DIR)
  : resolve(here, '../src/generated');

const definitions: ThemeDefinition[] = readdirSync(THEMES_DIR)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => JSON.parse(readFileSync(resolve(THEMES_DIR, f), 'utf8')));
const byName = new Map(definitions.map((d) => [d.name, d]));
const lookup = (name: string) => byName.get(name);

const roots = definitions.filter((d) => !d.extends);
if (roots.length !== 1) throw new Error(`themes/ needs exactly one theme that extends nothing; found ${roots.length}`);
const ordered = [roots[0], ...definitions.filter((d) => d.extends)];

const problems = ordered.flatMap((def) =>
  enumerateSelections(mergeChain(def, lookup).axes ?? {}).flatMap((sel) =>
    derive(def, sel, lookup).issues.map((issue) => `${def.name} ${JSON.stringify(sel)}: ${JSON.stringify(issue)}`),
  ),
);
if (problems.length > 0) {
  console.error(problems.join('\n'));
  process.exit(1);
}

const themes = ordered.map((definition) => ({
  definition,
  baked: bake(definition, lookup),
  deps: axisDependencies(definition, lookup),
  isDefault: definition === roots[0],
}));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(resolve(OUT_DIR, 'tokens.css'), emitCss(themes));
writeFileSync(resolve(OUT_DIR, 'themes.ts'), emitThemes(themes));
writeFileSync(resolve(OUT_DIR, 'manifest.ts'), emitManifest(themes[0]));

console.log(`Generated ${themes.length} theme(s) → ${OUT_DIR}`);
```

- [ ] **Step 2: Regenerate and re-run the gate against `main`'s output**

```bash
GATE=$(mktemp -d); mkdir -p "$GATE/old"
for f in tokens.css themes.ts manifest.ts; do git show main:packages/theme/src/generated/$f > "$GATE/old/$f"; done
npm run gen:tokens -w @weasel-js/theme
npx tsx packages/theme/scripts/gate-conversion.ts "$GATE/old" packages/theme/src/generated
```

Expected: `Generated 1 theme(s)`, then `gate: same declarations, rows and values`.

- [ ] **Step 3: Delete the DTCG source and the one-off scripts**

```bash
git rm -r packages/theme/tokens packages/theme/scripts/convert-dtcg-theme.ts packages/theme/scripts/gate-conversion.ts packages/theme/scripts/emit-preview.ts
grep -rn "tokens/weasel\|tokens/<theme>" --exclude-dir=node_modules --exclude-dir=dist --exclude-dir=.git . | grep -v CHANGELOG
```

Fix every prose hit the grep prints (README, docs) to name `themes/<theme>.json`. Leave dated specs and plans alone.

- [ ] **Step 4: Rewrite the runtime.** `packages/theme/src/theme.ts`:

```ts
import { isByAxis, type AxisDefs, type Varying } from './axes';
import type { PinObject, PinValue, ThemeDefinition } from './definition';
import type { RawToken, TokenValue } from './dtcg/types';
import { BAKED_THEMES } from './generated/themes';

/**
 * A theme ready to resolve: its axes and its tokens, each plain or varying by
 * axis, references intact. A `by` that leaves a value out contributes nothing
 * for that selection, so the theme it extends supplies it.
 */
export interface Theme {
  readonly name: string;
  readonly extends: Theme | null;
  readonly axes: AxisDefs;
  readonly tokens: Readonly<Record<string, Varying<RawToken>>>;
}

/** What `defineTheme` accepts: a definition whose `extends` is a `Theme`, holding pins and components only. */
export type ThemeInput = Omit<ThemeDefinition, 'extends'> & { readonly extends?: Theme | null };

const isPinObject = (v: PinValue): v is PinObject =>
  typeof v === 'object' && v !== null && !Array.isArray(v) && 'value' in v;

function toRaw(v: Varying<PinValue>): Varying<RawToken> {
  if (isByAxis(v)) {
    const out: Record<string, unknown> = { by: v.by };
    for (const [k, x] of Object.entries(v)) if (k !== 'by') out[k] = toRaw(x as Varying<PinValue>);
    return out as Varying<RawToken>;
  }
  const obj: PinObject = isPinObject(v) ? v : { value: v as TokenValue };
  return { type: obj.type ?? 'unknown', value: obj.value, alpha: obj.alpha, description: obj.description };
}

/** The built-in theme, from the baked output of themes/weasel.json. */
export const weaselTheme: Theme = {
  name: 'weasel',
  extends: null,
  axes: BAKED_THEMES.weasel.axes,
  tokens: BAKED_THEMES.weasel.tokens,
};

/**
 * Build a theme from pins. Unless `extends` says otherwise the result layers
 * onto `weaselTheme`, so a theme only names what it changes. A definition with
 * seeds, ramps, scales or semantics needs deriving first.
 */
export function defineTheme(input: ThemeInput): Theme {
  const rules = (['seeds', 'ramps', 'scales', 'semantics'] as const).filter((k) => Object.keys(input[k] ?? {}).length > 0);
  if (rules.length > 0) {
    throw new Error(
      `Theme "${input.name}" has ${rules.join(', ')}, which need deriving. Bake it with \`bake\` from @weasel-js/theme/engine.`,
    );
  }
  const tokens: Record<string, Varying<RawToken>> = {};
  for (const [name, v] of Object.entries({ ...input.components, ...input.pins })) tokens[name] = toRaw(v);
  return {
    name: input.name,
    extends: input.extends === undefined ? weaselTheme : input.extends,
    axes: input.axes ?? {},
    tokens,
  };
}
```

`packages/theme/src/resolveTheme.ts`:

```ts
import { fullSelection, pickAll, type AxisDefs, type Selection } from './axes';
import { resolveTokens } from './dtcg/resolve';
import type { FlatTokens } from './dtcg/types';
import type { TokenName } from './generated/themes';
import type { Theme } from './theme';

/** The output of `resolveTheme`: every token of a theme, for one selection, keyed
 *  by CSS custom-property name and flattened to a final CSS value. */
export type ResolvedTheme = Readonly<Record<TokenName, string>>;

/** Root-first, so the leaf theme's tokens land last. */
export function themeChain(theme: Theme): Theme[] {
  const out: Theme[] = [];
  for (let t: Theme | null = theme; t; t = t.extends) out.unshift(t);
  return out;
}

/** Every axis the chain declares; a descendant's definition of an axis wins. */
export function themeAxes(theme: Theme): AxisDefs {
  return Object.assign({}, ...themeChain(theme).map((t) => t.axes));
}

/**
 * Merge the extends chain at a selection, resolve every alias, and key the
 * result by CSS custom-property name. A missing or unknown axis value takes the
 * axis default.
 *
 * Pure — no DOM. An unresolvable reference throws rather than falling back.
 */
export function resolveTheme(theme: Theme, selection: Selection = {}): ResolvedTheme {
  const sel = fullSelection(themeAxes(theme), selection);
  let merged: FlatTokens = {};
  for (const t of themeChain(theme)) merged = { ...merged, ...pickAll(t.tokens, sel) };
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(resolveTokens(merged))) out[`--wzl-${name}`] = value;
  return out as ResolvedTheme;
}
```

In `packages/theme/src/applyTheme.ts`, keep the sheet plumbing and replace `applyTheme`:

```ts
/**
 * Apply `theme` at `selection` to `el`'s subtree.
 *
 * Stamps `data-wzl-theme` and one `data-wzl-<axis>` per axis, and ensures a
 * matching rule block exists in a module-owned stylesheet. Deliberately not
 * inline properties: the cascade then does the work, per-subtree overrides are
 * just a different theme name, and no `!important` is ever needed. No-op
 * outside a DOM.
 */
export function applyTheme(el: HTMLElement, theme: Theme, selection: Selection = {}): void {
  if (typeof document === 'undefined') return;

  const axes = themeAxes(theme);
  const sel = fullSelection(axes, selection);
  const key = `${theme.name}::${selectionKey(axes, sel)}`;
  const body = Object.entries(resolveTheme(theme, sel))
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ');
  const attrs = Object.keys(axes).map((a) => `[data-wzl-${a}='${sel[a]}']`).join('');
  const rule = `[data-wzl-theme='${theme.name}']${attrs} { ${body} }`;
  if (emitted.get(key) !== rule) {
    emitted.set(key, rule);
    flushRules();
  }

  el.setAttribute('data-wzl-theme', theme.name);
  for (const a of Object.keys(axes)) el.setAttribute(`data-wzl-${a}`, sel[a]);
}
```

with imports `import { fullSelection, selectionKey, type Selection } from './axes';` and `import { resolveTheme, themeAxes } from './resolveTheme';`, and the `emitted` map's comment changed from `theme.name::mode` to `theme.name::selection key`.

In `packages/theme/src/react.tsx`, replace `mode` with `selection` throughout:

```ts
/** What `<ThemeProvider>` publishes: the theme, the full selection in force, and the
 *  fully resolved token record for that pair. */
export interface ThemeContextValue {
  readonly theme: Theme;
  readonly selection: Selection;
  readonly resolved: ResolvedTheme;
}

/** Props for `<ThemeProvider>`. */
export interface ThemeProviderProps {
  readonly theme?: Theme;
  /** Axis values, e.g. `{ mode: 'light' }`. A missing axis takes its default. */
  readonly selection?: Selection;
  /** Applied to the wrapper element, so it can be the layout element too. */
  readonly className?: string;
  readonly style?: React.CSSProperties;
  readonly children: React.ReactNode;
}

export function ThemeProvider({ theme = weaselTheme, selection, className, style, children }: ThemeProviderProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const axes = themeAxes(theme);
  const full = fullSelection(axes, selection);
  // Keyed on the selection's content: callers pass a fresh object every render.
  const key = selectionKey(axes, full);

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, selection: full, resolved: resolveTheme(theme, full) }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, key],
  );

  useLayoutEffect(() => {
    if (ref.current) applyTheme(ref.current, theme, value.selection);
  }, [theme, value]);

  const attrs = Object.fromEntries(Object.keys(axes).map((a) => [`data-wzl-${a}`, full[a]]));
  return (
    <ThemeContext.Provider value={value}>
      <div ref={ref} className={className} style={style} data-wzl-theme={theme.name} {...attrs}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}
```

Keep the existing doc comment above `ThemeProvider` and the two hooks unchanged; add imports `fullSelection, selectionKey, type Selection` from `./axes` and `themeAxes` from `./resolveTheme`. If the repo's linter is biome rather than eslint, use its suppression syntax (`// biome-ignore lint/correctness/useExhaustiveDependencies: keyed on selection content`) instead.

`packages/theme/src/loadDTCG.ts` — same document shape as today, new `Theme`:

```ts
import { flattenTokens } from './dtcg/flatten';
import type { RawToken } from './dtcg/types';
import type { Varying } from './axes';
import { themeAxes } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

interface DtcgDocument {
  name?: unknown;
  defaultMode?: unknown;
  extends?: Theme | null;
  primitives?: Record<string, unknown>;
  modes?: Record<string, Record<string, unknown>>;
}

/**
 * Build a `Theme` from a DTCG document — the interchange path, for tokens
 * exported by a design tool rather than authored in TS. A token a mode leaves
 * out takes the document's primitive of the same name, or else the base theme's.
 */
export function loadDTCG(doc: DtcgDocument): Theme {
  if (typeof doc.name !== 'string' || doc.name === '') {
    throw new Error('DTCG document needs a string "name"');
  }
  const base = doc.extends === undefined ? weaselTheme : doc.extends;
  const primitives = flattenTokens(doc.primitives ?? {});
  const modeNames = Object.keys(doc.modes ?? {});
  const modes = Object.fromEntries(modeNames.map((m) => [m, flattenTokens(doc.modes![m])]));

  const tokens: Record<string, Varying<RawToken>> = { ...primitives };
  for (const name of new Set(modeNames.flatMap((m) => Object.keys(modes[m])))) {
    const branch: Record<string, unknown> = { by: 'mode' };
    for (const m of modeNames) {
      const t = modes[m][name] ?? primitives[name];
      if (t) branch[m] = t;
    }
    tokens[name] = branch as Varying<RawToken>;
  }

  const inherited = base ? themeAxes(base).mode?.default : undefined;
  const defaultMode = typeof doc.defaultMode === 'string' ? doc.defaultMode : (inherited ?? 'dark');
  const axes = modeNames.length > 0
    ? { mode: { default: defaultMode, values: Object.fromEntries(modeNames.map((m) => [m, {}])) } }
    : {};
  return { name: doc.name, extends: base, axes, tokens };
}
```

`packages/theme/src/index.ts`:

```ts
export { THEMES, THEME_SOURCES, BAKED_THEMES, type TokenName, type GeneratedTheme } from './generated/themes';
export { TOKEN_MANIFEST, type TokenManifestEntry } from './generated/manifest';

export { defineTheme, weaselTheme, type Theme, type ThemeInput } from './theme';
export { resolveTheme, themeAxes, type ResolvedTheme } from './resolveTheme';
export { applyTheme } from './applyTheme';
export { loadDTCG } from './loadDTCG';
export { fullSelection, selectionKey, type AxisDef, type AxisDefs, type AxisValue, type ByAxis, type Selection, type Varying } from './axes';
export type { ThemeDefinition, PinValue, PinObject } from './definition';
export type { RawToken, FlatTokens } from './dtcg/types';
```

`TokenInput` and `ThemeSource` are gone on purpose; the changeset in Task 15 says so.

- [ ] **Step 5: Rewrite the theme package's tests.** Each keeps its cases, moved onto selections and pins.

`theme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { themeAxes } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

describe('defineTheme', () => {
  it('defaults to extending the built-in theme', () => {
    const t = defineTheme({ name: 'acme' });
    expect(t.extends).toBe(weaselTheme);
    expect(themeAxes(t).mode.default).toBe('dark');
  });

  it('normalizes a bare pin', () => {
    const t = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } });
    expect(t.tokens['accent-base']).toEqual({ type: 'unknown', value: '#ff0000', alpha: undefined, description: undefined });
  });

  it('keeps a pin that varies by mode', () => {
    const t = defineTheme({ name: 'acme', pins: { surface: { by: 'mode', light: '#eeeeee' } } });
    expect(t.tokens.surface).toEqual({ by: 'mode', light: { type: 'unknown', value: '#eeeeee', alpha: undefined, description: undefined } });
  });

  it('can opt out of the base entirely', () => {
    expect(defineTheme({ name: 'bare', extends: null }).extends).toBeNull();
  });

  it('refuses a definition that needs deriving, and names the engine', () => {
    expect(() => defineTheme({ name: 'x', ramps: { gray: { kind: 'lightness', steps: ['a'], lightness: [0.5, 0.5] } } })).toThrow(
      /@weasel-js\/theme\/engine/,
    );
  });

  it('exposes the built-in theme with both modes', () => {
    expect(Object.keys(weaselTheme.axes.mode.values).sort()).toEqual(['dark', 'light']);
  });
});
```

`resolveTheme.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveTheme } from './resolveTheme';
import { defineTheme, weaselTheme } from './theme';

describe('resolveTheme', () => {
  it('resolves the built-in theme per mode', () => {
    expect(resolveTheme(weaselTheme, { mode: 'dark' })['--wzl-surface']).toBe('#181a1e');
    expect(resolveTheme(weaselTheme, { mode: 'light' })['--wzl-surface']).toBe('#f5f5f6');
  });

  it('rebases aliases when a base primitive is overridden', () => {
    const acme = defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } });
    expect(resolveTheme(acme)['--wzl-accent']).toBe('#ff0000');
  });

  it('inherits every unspecified token from the base', () => {
    expect(resolveTheme(defineTheme({ name: 'acme' }))['--wzl-radius-md']).toBe('5px');
  });

  it('picks a varying pin per selection', () => {
    const acme = defineTheme({ name: 'acme', pins: { surface: { by: 'mode', dark: '#111111', light: '#eeeeee' } } });
    expect(resolveTheme(acme, { mode: 'light' })['--wzl-surface']).toBe('#eeeeee');
    expect(resolveTheme(acme, { mode: 'dark' })['--wzl-surface']).toBe('#111111');
  });

  it('falls through to the base where a by leaves a value out', () => {
    const acme = defineTheme({ name: 'acme', pins: { backdrop: { by: 'mode', dark: 'url(x.png)' } } });
    expect(resolveTheme(acme, { mode: 'dark' })['--wzl-backdrop']).toBe('url(x.png)');
    expect(resolveTheme(acme, { mode: 'light' })['--wzl-backdrop']).toBe('none');
  });

  it('falls back to the default for an unknown axis value', () => {
    expect(resolveTheme(weaselTheme, { mode: 'nope' })['--wzl-surface']).toBe('#181a1e');
  });

  it('throws naming the token when a theme opts out of the base and is incomplete', () => {
    const bare = defineTheme({ name: 'bare', extends: null, pins: { fg: '{nope}' } });
    expect(() => resolveTheme(bare)).toThrow(/nope/);
  });
});
```

`applyTheme.test.ts`: keep `readSheetText` and `beforeEach`; change every `applyTheme(x, theme, 'light')` to `applyTheme(x, theme, { mode: 'light' })` (and `'dark'` likewise); change `defineTheme({ name: 'acme', tokens: { 'accent-base': '#ff0000' }, modes: {} })` to `defineTheme({ name: 'acme', pins: { 'accent-base': '#ff0000' } })`; change each `modes: { light: { 'color-accent': '#111111' } }` to `pins: { 'color-accent': '#111111' }` (same for `#222222`, `#333333`). Add:

```ts
  it('stamps one attribute per axis and scopes the rule to all of them', () => {
    const dense = defineTheme({
      name: 'dense',
      axes: { density: { default: 'comfortable', values: { comfortable: {}, compact: {} } } },
      pins: { gap: { by: 'density', comfortable: '4px', compact: '3px' } },
    });
    const el = document.createElement('div');
    applyTheme(el, dense, { mode: 'light', density: 'compact' });
    expect(el.getAttribute('data-wzl-density')).toBe('compact');
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
    expect(readSheetText()).toMatch(/data-wzl-theme=["']dense["']\]\[data-wzl-mode=["']light["']\]\[data-wzl-density=["']compact["']\]/);
    expect(readSheetText()).toContain('--wzl-gap: 3px');
  });
```

`react.test.tsx`: the probe renders `` `${theme.name}/${selection.mode}/${resolved['--wzl-surface']}` `` from `useTheme()`; `mode="light"` becomes `selection={{ mode: 'light' }}`, `mode="dark"` becomes `selection={{ mode: 'dark' }}`, and the custom theme is `defineTheme({ name: 'acme', pins: { surface: '#123456' } })`. Expected strings are unchanged.

`loadDTCG.test.ts`: `resolveTheme(theme, 'dark')` becomes `resolveTheme(theme, { mode: 'dark' })`. Nothing else changes.

`generated/generated.test.ts`, `describe('generated themes.ts')` becomes:

```ts
describe('generated themes.ts', () => {
  const dark = THEMES.weasel.selections['mode=dark'];
  const light = THEMES.weasel.selections['mode=light'];

  it('exposes both modes of the weasel theme', () => {
    expect(Object.keys(THEMES.weasel.selections).sort()).toEqual(['mode=dark', 'mode=light']);
  });

  it('resolves aliases to literals', () => {
    expect(dark['--wzl-surface']).toBe('#181a1e');
    expect(light['--wzl-surface']).toBe('#f5f5f6');
  });

  it('computes alpha tokens exactly instead of approximating them', () => {
    expect(dark['--wzl-line']).toBe('rgba(230, 231, 233, 0.2)');
    expect(light['--wzl-line']).toBe('rgba(14, 15, 18, 0.2)');
  });

  it('exposes the definition as authored, so references survive for extends and the editor', () => {
    expect((THEME_SOURCES.weasel.pins!.accent as { value: string }).value).toBe('{accent-base}');
    expect(Object.keys(THEME_SOURCES.weasel.semantics!)).toContain('surface');
    expect(BAKED_THEMES.weasel.tokens.accent).toMatchObject({ value: '{accent-base}' });
  });

  it('carries the token groups labkit contributed', () => {
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-z-modal']).toBe('30');
    expect(dark['--wzl-swatch-fuchsia']).toBe('#f641f7');
    expect(dark['--wzl-backdrop']).toBe('none');
    // Mode-invariant: the swatch set does not flip.
    expect(light['--wzl-swatch-fuchsia']).toBe('#f641f7');
    expect((THEME_SOURCES.weasel.pins!.backdrop as { type: string }).type).toBe('gradient');
  });

  it('flips accent-fg per mode', () => {
    expect(dark['--wzl-accent-fg']).toBe('#5841b8');
    expect(light['--wzl-accent-fg']).toBe('#2e1f7a');
  });
});
```

with `import { BAKED_THEMES, THEME_SOURCES, THEMES } from './themes';` at the top. The `tokens.css` and `manifest.ts` describes stay as they are.

`dtcg/source.test.ts` keeps its `EXPECTED_NAMES` list and reads the definition instead:

```ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ThemeDefinition } from '../definition';
import { derive } from '../engine/derive';

const here = dirname(fileURLToPath(import.meta.url));
const weasel: ThemeDefinition = JSON.parse(readFileSync(resolve(here, '../../themes/weasel.json'), 'utf8'));

// EXPECTED_NAMES: unchanged from before.

describe('weasel theme definition', () => {
  it('declares exactly the intended token vocabulary', () => {
    expect(Object.keys(derive(weasel, { mode: 'dark' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('declares the same token names in every mode', () => {
    expect(Object.keys(derive(weasel, { mode: 'light' }).tokens).sort()).toEqual(EXPECTED_NAMES);
  });

  it('derives with no issues in any mode', () => {
    expect(derive(weasel, { mode: 'dark' }).issues).toEqual([]);
    expect(derive(weasel, { mode: 'light' }).issues).toEqual([]);
  });
});
```

Rename it `git mv packages/theme/src/dtcg/source.test.ts packages/theme/src/weasel.definition.test.ts` and fix the relative paths (`./definition`, `./engine/derive`, `../themes/weasel.json`) — it no longer tests DTCG.

- [ ] **Step 6: Run the theme package's tests**

Run: `npx vitest run --project=weasel-ui packages/theme`
Expected: every file passes, including `determinism.test.ts` (it regenerates into a temp dir and compares bytes with the files Step 2 wrote). Don't run `tsc` yet; the callers are Task 13.

---

### Task 13: Move the callers onto selections

**Files:**
- Modify: `packages/hud/src/attach.ts:47`, `packages/hud/src/react/useHud.ts:35`, nine hud test files
- Modify: `packages/labkit/src/lab/Lab.tsx` (two `<ThemeProvider>`s), `packages/labkit/src/lab/LabShell.tsx`, `packages/labkit/src/theme/interstellar.test.ts`
- Modify: `apps/draw/src/theme.ts`, `apps/draw/src/main.tsx:83`, `apps/forge/forge.frame.tsx:22,34`, `.storybook/preview.tsx:272-276`
- Create: `.changeset/theme-engine.md`

Only `<ThemeProvider>`'s `mode` prop changes. `LabShell` and `Lab` have `mode` props of their own; leave those alone.

- [ ] **Step 1: hud.** In `attach.ts` and `react/useHud.ts`, `resolveTheme(weaselTheme, weaselTheme.defaultMode)` becomes `resolveTheme(weaselTheme)`. Then:

```bash
grep -rl "resolveTheme(weaselTheme, 'dark')" packages/hud/src | xargs sed -i '' "s/resolveTheme(weaselTheme, 'dark')/resolveTheme(weaselTheme, { mode: 'dark' })/g"
grep -rn "resolveTheme(" packages/hud/src
```

Expected: every remaining call passes an object or nothing.

- [ ] **Step 2: labkit.** In `Lab.tsx`, `<ThemeProvider theme={interstellarTheme} mode={resolvedMode} className="lk-lab">` becomes `<ThemeProvider theme={interstellarTheme} selection={{ mode: resolvedMode }} className="lk-lab">`, and the second provider's `mode={resolvedMode}` line becomes `selection={{ mode: resolvedMode }}`. In `LabShell.tsx`, `<ThemeProvider theme={interstellarTheme} mode={resolved}>` becomes `<ThemeProvider theme={interstellarTheme} selection={{ mode: resolved }}>`. In `interstellar.test.ts`, `resolveTheme(interstellarTheme, 'dark')` and `'light'` become `{ mode: 'dark' }` and `{ mode: 'light' }`.

- [ ] **Step 3: apps and Storybook.** `apps/draw/src/theme.ts`:

```ts
export const drawTheme = defineTheme({
  name: 'weasel-draw',
  pins: {
    // Accent for active toggle states (grid, snap, etc.). Reads in the same
    // family as Switch, RangeSlider, and Checkbox active states.
    'app-accent': '{accent-strong}',
    'app-accent-bg': { type: 'color', value: '{accent-strong}', alpha: 0.22 },
    // Shared chrome surface — top bar, status bar, sidebars.
    'chrome-bg': '{surface}',
    'chrome-border': '{border}',
  },
});
```

(keep its doc comment). `apps/draw/src/main.tsx`: `<ThemeProvider theme={drawTheme} mode={mode}>` → `<ThemeProvider theme={drawTheme} selection={{ mode }}>`. `apps/forge/forge.frame.tsx`: `mode={useResolvedMode(picked)}` → `selection={{ mode: useResolvedMode(picked) }}`, and `applyTheme(root, weaselTheme, mode)` → `applyTheme(root, weaselTheme, { mode })`. `.storybook/preview.tsx`: `mode={mode}` on the labkit wrapper's provider → `selection={{ mode }}`.

- [ ] **Step 4: Typecheck the whole repo**

Run: `npx tsc --noEmit`
Expected: exit 0. Any error naming `mode`, `modes`, `defaultMode`, `tokens:` in a `defineTheme` call, or `ThemeSource` is a caller this list missed: move it the same way and add it to this task's file list.

- [ ] **Step 5: Run every affected project**

```bash
npx vitest run --project=weasel-ui packages/theme packages/hud packages/ui/src/overlays packages/ui/src/components/overlayPortal.test.tsx
npx vitest run --project=labkit packages/labkit/src/lab packages/labkit/src/theme
npx vitest run --project=forge apps/forge
npm run check:test-projects
```

Expected: all pass.

- [ ] **Step 6: Changeset** `.changeset/theme-engine.md` (patch — see the repo CLAUDE.md; the prose says what breaks):

```md
---
'@weasel-js/theme': patch
'@weasel-js/hud': patch
'@weasel-js/labkit': patch
---

Themes are now authored as layered definitions and built by an engine, published as `@weasel-js/theme/engine`: seeds, generated ramps and scales, semantic rules (a step, an offset from another semantic, the first step that clears a contrast target, a reference), components and pins, any of which can vary by axis. `derive` produces a theme's tokens for one selection with provenance and validation issues, and `bake` folds every selection into a runtime `Theme`. weasel's own theme is `themes/weasel.json`, every value pinned, and emits the same CSS declarations as before.

**Breaking.** A theme varies by *axes* rather than modes, and `mode` is one axis:

- `resolveTheme(theme, selection?)` and `applyTheme(el, theme, selection?)` take `{ mode: 'light' }` instead of `'light'`; a missing axis takes its default. `applyTheme` stamps one `data-wzl-<axis>` attribute per axis.
- `<ThemeProvider selection={{ mode }}>` replaces `mode`, and `useTheme()` returns `selection` instead of `mode`.
- `Theme` holds `axes` and `tokens` (each token plain or `{ by: 'mode', dark, light }`) instead of `defaultMode`, `tokens` and `modes`. Read an axis default with `themeAxes(theme).mode.default`.
- `defineTheme` takes `{ name, extends?, axes?, pins }`, where a pin is a value or `{ value, type, alpha, description }` and references are written `{token}` (not `{color.token}`). It throws on a definition with rules; bake those with the engine.
- `THEMES.<name>.modes.<mode>` is now `THEMES.<name>.selections['mode=<mode>']`. `THEME_SOURCES` holds definitions, `BAKED_THEMES` is new, and `TokenInput` and `ThemeSource` are removed.
```

- [ ] **Step 7: Commit Tasks 12 and 13 together**

```bash
git add packages/theme packages/hud packages/labkit apps/draw apps/forge .storybook .changeset/theme-engine.md
git status --short
git commit -m "move @weasel-js/theme onto theme definitions and axis selections"
```

Check `git status --short` before committing: nothing under `node_modules`, no `package-lock.json`.

---

### Task 14: interstellar as a definition, and DTCG export

**Files:**
- Create: `packages/theme/src/engine/emit/dtcg.ts`, `packages/theme/src/engine/emit/dtcg.test.ts`
- Create: `packages/labkit/src/theme/interstellar.theme.json`
- Modify: `packages/labkit/src/theme/interstellar.ts`, `Interstellar.stories.tsx:21`
- Delete: `packages/labkit/src/theme/interstellar.tokens.json`

- [ ] **Step 1: Write the failing test** `packages/theme/src/engine/emit/dtcg.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { loadDTCG } from '../../loadDTCG';
import { resolveTheme } from '../../resolveTheme';
import { defineTheme, weaselTheme } from '../../theme';
import { toDTCG } from './dtcg';

describe('toDTCG', () => {
  it('round-trips the built-in theme through loadDTCG', () => {
    const back = loadDTCG({ ...toDTCG(weaselTheme), extends: null });
    for (const mode of ['dark', 'light']) {
      expect(resolveTheme(back, { mode })).toEqual(resolveTheme(weaselTheme, { mode }));
    }
  });

  it('round-trips a theme that leaves a mode out, so it still falls through', () => {
    const t = defineTheme({ name: 'x', pins: { backdrop: { by: 'mode', dark: { value: 'url(a.png)', type: 'gradient' } }, 'radius-md': { value: '9px', type: 'dimension' } } });
    const back = loadDTCG({ ...toDTCG(t), extends: weaselTheme });
    for (const mode of ['dark', 'light']) expect(resolveTheme(back, { mode })).toEqual(resolveTheme(t, { mode }));
  });

  it('refuses a theme with an axis other than mode', () => {
    const t = defineTheme({ name: 'd', axes: { density: { default: 'a', values: { a: {}, b: {} } } }, pins: { gap: { by: 'density', a: '1px', b: '2px' } } });
    expect(() => toDTCG(t)).toThrow(/mode/);
  });
});
```

- [ ] **Step 2: Run it to see it fail**, then implement `packages/theme/src/engine/emit/dtcg.ts`:

```ts
import { isByAxis, pick } from '../../axes';
import { ALPHA_EXT, type RawToken } from '../../dtcg/types';
import type { Theme } from '../../theme';

type Group = Record<string, unknown> & { $type: string };

/** A theme's own tokens as a DTCG document `loadDTCG` reads back. `extends` is not carried; pass it to `loadDTCG`. */
export function toDTCG(theme: Theme): { name: string; defaultMode?: string; primitives: Record<string, Group>; modes: Record<string, Record<string, Group>> } {
  const extraAxes = Object.keys(theme.axes).filter((a) => a !== 'mode');
  if (extraAxes.length > 0) throw new Error(`DTCG export supports a mode axis only; "${theme.name}" also varies by ${extraAxes.join(', ')}`);

  const put = (into: Record<string, Group>, name: string, t: RawToken) => {
    into[t.type] ??= { $type: t.type };
    into[t.type][name] = {
      $value: t.value,
      ...(t.description ? { $description: t.description } : {}),
      ...(t.alpha !== undefined ? { $extensions: { [ALPHA_EXT]: t.alpha } } : {}),
    };
  };

  const primitives: Record<string, Group> = {};
  const modes: Record<string, Record<string, Group>> = {};
  const modeValues = new Set<string>(Object.keys(theme.axes.mode?.values ?? {}));
  for (const [name, v] of Object.entries(theme.tokens)) {
    if (!isByAxis(v)) {
      put(primitives, name, v);
      continue;
    }
    if (v.by !== 'mode') throw new Error(`DTCG export supports a mode axis only; "${name}" varies by ${v.by}`);
    for (const key of Object.keys(v)) if (key !== 'by') modeValues.add(key);
    for (const mode of modeValues) {
      const picked = pick(v, { mode });
      if (picked.ok) put((modes[mode] ??= {}), name, picked.value);
    }
  }
  for (const mode of modeValues) modes[mode] ??= {};

  return { name: theme.name, ...(theme.axes.mode ? { defaultMode: theme.axes.mode.default } : {}), primitives, modes };
}
```

Export `toDTCG` from `packages/theme/src/engine.ts`.

Run: `npx vitest run --project=weasel-ui packages/theme/src/engine/emit/dtcg.test.ts`
Expected: 3 passed. The weasel round trip only holds if `loadDTCG` gives a token in every mode the same value — weasel's baked semantics are `by: mode` objects with both branches, so it does.

- [ ] **Step 3: Convert interstellar.** Write the definition from today's theme (one command; the output file is what gets committed):

```bash
npx tsx -e "
import { writeFileSync } from 'node:fs';
import { isByAxis } from './packages/theme/src/axes';
import { interstellarTheme } from './packages/labkit/src/theme/interstellar';
const pin = (t) => ({ value: t.value, type: t.type, ...(t.alpha !== undefined ? { alpha: t.alpha } : {}), ...(t.description ? { description: t.description } : {}) });
const conv = (v) => isByAxis(v) ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, k === 'by' ? x : conv(x)])) : pin(v);
const pins = Object.fromEntries(Object.entries(interstellarTheme.tokens).map(([n, v]) => [n, conv(v)]));
writeFileSync('packages/labkit/src/theme/interstellar.theme.json', JSON.stringify({ name: 'interstellar', axes: interstellarTheme.axes, pins }, null, 2) + '\n');
"
```

Then `packages/labkit/src/theme/interstellar.ts`:

```ts
import { defineTheme, type Theme, type ThemeInput } from '@weasel-js/theme';
import definition from './interstellar.theme.json' with { type: 'json' };

/**
 * labkit's theme: a cosmic dark and a warm parchment light, extending the
 * built-in weasel theme. A pins-only theme definition: nothing in it is
 * derived, so it loads without the engine.
 */
export const interstellarTheme: Theme = defineTheme(definition as ThemeInput);
```

```bash
git rm packages/labkit/src/theme/interstellar.tokens.json
```

In `Interstellar.stories.tsx:21`, the description becomes `'A pins-only theme definition in \`src/theme/interstellar.theme.json\`, loaded with \`defineTheme\`; it extends the built-in weasel theme, overriding values rather than adding tokens.'`

- [ ] **Step 4: Run labkit's theme tests and typecheck**

Run: `npx vitest run --project=labkit packages/labkit/src/theme && npx tsc --noEmit`
Expected: `interstellar.test.ts` passes unchanged from Task 13 (dark surface `#0a0a14`, light backdrop `none`); tsc exit 0.

- [ ] **Step 5: Commit** `packages/theme/src/engine.ts`, `packages/theme/src/engine/emit/dtcg*.ts` and `packages/labkit/src/theme/` as "export themes to DTCG, and author interstellar as a theme definition". Add to `.changeset/theme-engine.md`'s prose: "`toDTCG` in `@weasel-js/theme/engine` writes a theme back out as a DTCG document. labkit's interstellar theme is now `interstellar.theme.json`."

---

### Task 15: Browser probe for a token that depends on two axes through a reference

**Files:**
- Create: `tests/visual/theme-axes.spec.ts`

jsdom resolves neither `var()` nor `color-mix()`, so only a browser shows whether the compound blocks actually stop a reference from freezing at `:root`'s selection. The probe loads the emitted CSS with `page.setContent` and reads computed widths, so it needs no page from the visual suite's server — but Playwright still starts or reuses one on 5177. Stop any `dev:theme-editor` server first (it also binds 5177), or Playwright attaches to it.

- [ ] **Step 1: Write the probe** `tests/visual/theme-axes.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import type { ThemeDefinition } from '../../packages/theme/src/definition';
import { axisDependencies, bake, emitCss } from '../../packages/theme/src/engine';

// `frame` varies by mode itself and reaches density only through `edge` → `gap`.
// Declared in :root alone, `var(--wzl-edge)` would resolve once, at :root's
// density, and every compact subtree would inherit the comfortable value.
const PROBE: ThemeDefinition = {
  name: 'probe',
  axes: {
    mode: { default: 'dark', values: { dark: {}, light: {} } },
    density: { default: 'comfortable', values: { comfortable: {}, compact: {} } },
  },
  pins: {
    gap: { by: 'density', comfortable: { value: '40px', type: 'dimension' }, compact: { value: '30px', type: 'dimension' } },
    edge: { value: '{gap}', type: 'dimension' },
    frame: { by: 'mode', dark: { value: '{edge}', type: 'dimension' }, light: { value: '100px', type: 'dimension' } },
  },
};

const css = emitCss([{ baked: bake(PROBE), deps: axisDependencies(PROBE), isDefault: true }]);

test('a token that depends on two axes through a reference resolves per subtree', async ({ page }) => {
  const cell = (mode: string, density: string) =>
    `<div data-wzl-mode="${mode}" data-wzl-density="${density}"><div class="probe" id="${mode}-${density}"></div></div>`;
  await page.setContent(
    `<style>${css}\n.probe { width: var(--wzl-frame); height: 1px; }</style>` +
      cell('dark', 'comfortable') + cell('dark', 'compact') + cell('light', 'comfortable') + cell('light', 'compact'),
  );
  const width = (id: string) => page.$eval(`#${id}`, (el) => getComputedStyle(el).width);
  expect(await width('dark-comfortable')).toBe('40px');
  expect(await width('dark-compact')).toBe('30px');
  expect(await width('light-comfortable')).toBe('100px');
  expect(await width('light-compact')).toBe('100px');
});
```

- [ ] **Step 2: Watch it fail against a broken emitter.** Temporarily change `emitCss`'s compound-set loop to `for (const set of axisSets(axes).filter((s) => s.length === 1))` and run:

Run: `npx playwright test --config tests/visual/playwright.config.ts theme-axes`
Expected: FAIL on `dark-compact` (reads `40px`, frozen at the default density). Revert the change.

If it passes with compound blocks removed, the probe is measuring nothing: check that `frame` really is absent from every single-axis block in the emitted CSS before going further.

- [ ] **Step 3: Run it for real**

Run: `npx playwright test --config tests/visual/playwright.config.ts theme-axes`
Expected: 1 passed.

- [ ] **Step 4: Commit** `tests/visual/theme-axes.spec.ts` as "probe in a browser that two-axis tokens resolve per subtree".

---

### Task 16: Close out

**Files:**
- Modify: `docs/superpowers/specs/2026-09-10-theme-engine-and-editor-design.md` (status line), `docs/TODO.md` (the theme editor entry)

- [ ] **Step 1: Pre-push gates.** Check `ps` for another session's full test run first; don't start one beside it.

```bash
npm run check:bumps
npx tsc --noEmit
npm run build
npm run check:manifests
npm run test:smoke:consumer
npm test
```

Expected: every one exits 0. `test:smoke:consumer` is the one that catches a missing `./engine` export or a star re-export across packages. If `npm test` fails in a file this branch never touched, say so and rerun that file alone rather than rerunning the suite.

- [ ] **Step 2: Screenshot the theme editor after a hard reload.** Phase 1 changes no visual, but the palette lab now imports from the engine. Start `npm run dev:theme-editor` from this worktree (port 5177; stop any other server on it first), open `#/palette` headless with the chrome-devtools MCP, hard-reload, and screenshot it in both modes. Put the screenshots on the slopboard wall (`~/src/slopboard/bin/slop <file>`).

- [ ] **Step 3: Update the docs.** The spec's status line becomes: "**Status: phase 1 (the engine) built on branch `theme-engine`, 2026-09-xx; phase 2 (the editor) not started.**" The TODO entry is rewritten around what is left: the `#/theme` editor, its plan to be written from the spec's Phase 2, and its dependency on `TokenPanel` merging from `forge-sidebar-clicks`.

- [ ] **Step 4: Commit** the two docs as "record the theme engine as built and the editor as next". When the branch merges, delete this plan in the merge commit.
