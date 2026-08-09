# labkit Convergence — Implementation Plan (Plan C)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete labkit's parallel theming system. Its 42 `--lk-*` custom
properties collapse into `--wzl-*`, its `lessc` theme pipeline disappears, and
`interstellar` becomes a third-party `Theme` value — the proof that
`defineTheme`/`loadDTCG`/`extends` serve someone other than us.

**Architecture:** Concepts labkit has and weasel lacks (a spacing scale,
z-layers, a ten-color data-viz swatch set, a backdrop gradient, control height,
glass blur, font sizes) become new token groups in the *shared* DTCG source, so
they get a `TokenName` entry and a weasel default. Interstellar contributes no
tokens — only values, as a DTCG document loaded at runtime through `loadDTCG`.
`<Lab>`/`<LabShell>` mount a `<ThemeProvider>` and their `theme` prop becomes a
`mode` prop.

**Tech Stack:** TypeScript, Vitest, Less (for structure only — no more theme
compiles), Storybook.

**Spec:** `docs/superpowers/specs/2026-08-08-dtcg-pluggable-theming-design.md`
§10. Plans A (`2026-08-09-dtcg-token-source.md`) and B
(`2026-08-09-runtime-pluggable-themes.md`) are merged.

---

## Prerequisites

Plan B merged. `defineTheme`, `resolveTheme`, `applyTheme`, `loadDTCG` and
`@weasel-js/theme/react` exist; `apps/draw` already demonstrates the
`extends`-based app-theme pattern (`apps/draw/src/theme.ts`,
`apps/draw/src/main.tsx`).

## Design notes that drive the tasks

**One theme, two modes — not two themes.** labkit ships `light` and
`interstellar` as sibling *themes*, but that is a Less artifact.
`tokens.less :root` holds interstellar; its `@media (prefers-color-scheme:
light)` block holds a warm parchment palette; `.lk-theme-light` /
`.lk-theme-interstellar` merely force one or the other. Every token that
differs between them is a color that flips with the OS. That is a mode axis.
So: one `interstellar` theme with `dark` (cosmic) and `light` (parchment)
modes, and the public `<Lab theme>` / `<LabShell theme>` prop becomes
`mode: 'auto' | 'light' | 'dark'`. This deviates from spec §10's "interstellar
and lk-light become DTCG themes" — §10 described the files, not the axis.

**Interstellar is loaded, not generated.** It does *not* go in
`packages/theme/tokens/`. The generator globs that directory, so anything
placed there is baked into `@weasel-js/theme`'s own `tokens.css` and
`THEMES` — the opposite of a third-party theme. Interstellar is a DTCG JSON
file inside labkit, turned into a `Theme` at import time by `loadDTCG`. That is
the interchange path with no build step, and it is currently the only thing
exercising `loadDTCG` at all.

**New concepts go in the shared source, values go in interstellar.** A token
that exists only in a leaf theme has no `TokenName` entry, so `ResolvedTheme`
cannot type it. Every new *name* therefore lands in
`packages/theme/tokens/weasel/` with a weasel default; interstellar overrides
only *values*. This is also what makes the collapse legible — after it, one
grep answers "what tokens exist".

**Three live bugs the collapse fixes.** These are rendering changes, not
value-preserving migrations, and must be called out when they land:

1. `--lk-text-dim` is referenced six times and defined nowhere, with no
   fallback. Those declarations are invalid at computed-value time, so the
   elements inherit their parent's color instead of reading muted.
2. `--lk-space-2` is referenced twice with no fallback, so two paddings in
   `Workspace.less` compute to `0`.
3. A whole third naming generation — `--lk-color-text`, `--lk-color-surface`,
   `--lk-color-border`, `--lk-color-hover`, `--lk-color-active`,
   `--lk-color-canvas-bg`, `--lk-color-surface-hover`, `--lk-color-text-muted`,
   `--lk-surface`, `--lk-surface-raised`, `--lk-bg-sunken`, `--lk-radius-md` —
   is referenced across seven files and defined nowhere. Each falls back to a
   hardcoded light-mode hex, which is why `LayerList`, `Palette`, `DragGhost`,
   `ControlPanel` and `CanvasStack` do not follow the theme today.

**Per-instance properties are not tokens and do not move.**
`--lk-panel-accent` (EffectCard), `--lk-layer-card-accent` (LayerStack),
`--lk-grid-rows` / `--lk-grid-cols` (WorkspaceGrid) are set from JS per
element. They stay `--lk-*` — they are component API.

**Value conflicts are the point of `extends`.** labkit's font weights
(300/500/700) and radius (6px) differ from weasel's (200/300/400, 5px) because
labkit sets Oswald at different cuts. Interstellar overrides them. If those
overrides were unnecessary the theme mechanism would be proving nothing.

**labkit has no visual baselines.** `tests/visual/` covers the kit and
`apps/draw`, not labkit. Verification is the Storybook stories, screenshotted
before and after.

## File Structure

**Created:**
`packages/labkit/src/theme/interstellar.tokens.json`,
`packages/labkit/src/theme/interstellar.ts` (+ `.test.ts`),
`packages/theme/tokens/weasel/` gains no files but grows existing ones.

**Modified:**
`packages/theme/tokens/weasel/primitives.tokens.json`,
`packages/theme/tokens/weasel/modes/{dark,light}.tokens.json`,
`packages/theme/src/generated/*` (regenerated),
24 `.less` files under `packages/labkit/src/` and
`packages/labkit/examples/drag-lab/styles.less`,
`packages/labkit/src/lab/{Lab,LabShell}.tsx` + their tests,
`packages/labkit/src/lab/LabContext.ts`,
`packages/labkit/src/state/{types,store}.ts` + `store.test.ts`,
`packages/labkit/src/theme/Interstellar.stories.tsx`,
`packages/labkit/package.json`, `packages/labkit/README.md`,
`.storybook/preview.tsx`.

**Deleted:**
`packages/labkit/src/theme/tokens.less`,
`packages/labkit/src/theme/light.less`,
`packages/labkit/src/theme/interstellar.less`.

## Token mapping

Reference for Tasks 1–3. "new" means the name is added to the shared source in
Task 1.

### Colors — collapse onto existing weasel semantics

| `--lk-*` | `--wzl-*` |
| --- | --- |
| `bg` | `surface` |
| `bg-elevated` | `surface-raised` |
| `bg-canvas`, `bg-sunken`, `color-canvas-bg` | `surface-sunken` |
| `border`, `color-border` | `border` |
| `divider` | `line-subtle` |
| `text`, `color-text` | `fg` |
| `text-muted`, `color-text-muted` | `fg-muted` |
| `text-disabled`, `text-dim` | `fg-subtle` |
| `surface`, `surface-raised`, `color-surface` | `surface-raised` |
| `color-hover`, `color-surface-hover` | `surface-hover` |
| `color-active` | `surface-pressed` |
| `accent` | `accent` |
| `accent-hover` | `accent-hover` |
| `focus-ring` | `focus-ring` |

### Typography and sizing — collapse where a weasel token exists

| `--lk-*` | `--wzl-*` | note |
| --- | --- | --- |
| `font` | `font-ui` | |
| `font-display` | `font-display` | |
| `font-mono` | `font-mono` | |
| `font-weight-light` | `font-weight-light` | value differs (300 vs 200) — interstellar overrides |
| `font-weight-bold` | `font-weight-bold` | value differs (700 vs 400) — interstellar overrides |
| `radius-sm` | `radius-sm` | same value |
| `radius`, `radius-md` | `radius-md` | value differs (6px vs 5px) — interstellar overrides |

### New names in the shared source

| new `--wzl-*` | `$type` | weasel default | interstellar |
| --- | --- | --- | --- |
| `font-weight-medium` | fontWeight | `350` | `500` |
| `font-size` | dimension | `13px` | — |
| `font-size-sm` | dimension | `11px` | — |
| `radius-lg` | dimension | `14px` | — |
| `control-h` | dimension | `28px` | — |
| `glass-blur` | dimension | `3px` | `12px` |
| `space-xs` / `space-sm` / `space-md` / `space-lg` | dimension | `4px` / `8px` / `12px` / `16px` | — |
| `z-toolbar` / `z-overlay` / `z-modal` | number | `10` / `20` / `30` | — |
| `swatch-green` … `swatch-magenta` (10) | color | labkit's values | — |
| `backdrop` | gradient | `none` | the nebula |

`--lk-space-2` maps to `space-sm`. `--lk-spacing-xs/sm/md/lg` map to
`space-xs/sm/md/lg`. `--lk-control-height` maps to `control-h`.
`--lk-space-nebula` maps to `backdrop`.

The ten swatches stay mode-invariant primitives, which is what they are today —
neither the light media block nor `.lk-theme-light` overrides them, so a light
labkit already shows the bright set. Preserving that keeps this migration
value-preserving; a light-mode swatch ramp is a separate design question.

---

## Task 1: New token groups in the shared source

The DTCG schema must express all four of spec §10's additions before anything
consumes them. `gradient` and `number` need no resolver code — a non-array
value serializes through `String(value)` — but nothing proves that today.

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json`
- Test: `packages/theme/src/dtcg/resolve.test.ts`, `packages/theme/src/generated/generated.test.ts`

- [ ] **Step 1: Assert the two unproven `$type`s round-trip**

Append to `packages/theme/src/dtcg/resolve.test.ts`:

```ts
it('passes gradient and number values through verbatim', () => {
  const out = resolveTokens({
    backdrop: {
      type: 'gradient',
      value: 'radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)',
    },
    'z-modal': { type: 'number', value: 30 },
  });
  expect(out.backdrop).toBe('radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)');
  expect(out['z-modal']).toBe('30');
});
```

Run `npx vitest run --project=weasel-ui packages/theme/src/dtcg/`. Expect PASS —
this is a characterization test, not a red test. If it fails, `serialize` needs
the two types added and that becomes Step 1a.

- [ ] **Step 2: Add the failing generated-output assertion**

Append to the `generated themes.ts` describe block in
`packages/theme/src/generated/generated.test.ts`:

```ts
it('carries the token groups labkit contributed', async () => {
  const { THEMES, THEME_SOURCES } = await import('./themes');
  const dark = THEMES.weasel.modes.dark;
  expect(dark['--wzl-space-md']).toBe('12px');
  expect(dark['--wzl-z-modal']).toBe('30');
  expect(dark['--wzl-swatch-cyan']).toBe('#00dfff');
  expect(dark['--wzl-backdrop']).toBe('none');
  // Mode-invariant: the swatch set does not flip.
  expect(THEMES.weasel.modes.light['--wzl-swatch-cyan']).toBe('#00dfff');
  expect(THEME_SOURCES.weasel.primitives['backdrop'].type).toBe('gradient');
});
```

```bash
npx vitest run --project=weasel-ui packages/theme/src/generated/
```

Expected: FAIL — none of those tokens exist.

- [ ] **Step 3: Add the groups**

In `packages/theme/tokens/weasel/primitives.tokens.json`, extend the existing
`color` and `dimension` groups and add three new ones. Leaf keys must be unique
across groups — `flattenTokens` throws otherwise.

Into `color`:

```json
    "swatch-green":   { "$value": "#2fdd18" },
    "swatch-pink":    { "$value": "#ff5885" },
    "swatch-cyan":    { "$value": "#00dfff" },
    "swatch-gold":    { "$value": "#dcb700" },
    "swatch-amber":   { "$value": "#ff8c00" },
    "swatch-violet":  { "$value": "#a497ff" },
    "swatch-mint":    { "$value": "#00e7af" },
    "swatch-sky":     { "$value": "#00b8ff" },
    "swatch-orange":  { "$value": "#ff6b00" },
    "swatch-magenta": { "$value": "#ff6eff" }
```

Give the group a `$description` on `swatch-green` noting the set is ordered for
categorical data and is deliberately mode-invariant.

Into `dimension`:

```json
    "radius-lg":   { "$value": "14px" },
    "control-h":   { "$value": "28px", "$description": "Height of an interactive control — button, input, select. Distinct from tb-height, which sizes the strip a row of them sits in." },
    "glass-blur":  { "$value": "3px", "$description": "Backdrop blur radius for frosted surfaces. Pairs with glass-tint." },
    "font-size":    { "$value": "13px" },
    "font-size-sm": { "$value": "11px" },
    "space-xs": { "$value": "4px" },
    "space-sm": { "$value": "8px" },
    "space-md": { "$value": "12px" },
    "space-lg": { "$value": "16px" }
```

Into `fontWeight`: `"font-weight-medium": { "$value": 350 }`.

New groups:

```json
  "number": {
    "$type": "number",
    "z-toolbar": { "$value": 10 },
    "z-overlay": { "$value": 20 },
    "z-modal":   { "$value": 30 }
  },

  "gradient": {
    "$type": "gradient",
    "backdrop": { "$value": "none", "$description": "Layered backdrop fill for a page or lab root. `none` in the built-in theme; a theme with a signature background sets it." }
  }
```

- [ ] **Step 4: Regenerate and verify**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run --project=weasel-ui packages/theme/
```

Expected: PASS, including the determinism test. `git diff` on
`packages/theme/src/generated/` should show only additions.

- [ ] **Step 5: Confirm nothing rendered differently**

```bash
npm run test:visual
```

Expected: PASS unchanged. Nothing consumes the new tokens yet.

- [ ] **Step 6: Commit**

```bash
git add packages/theme/tokens packages/theme/src
git commit -m "feat(theme): spacing, z-layer, swatch and gradient token groups

Names labkit needs, contributed to the shared source rather than a
labkit-private tier, so each gets a TokenName entry and a weasel default.
gradient and number were already expressible; now they are proven."
```

---

## Task 2: Interstellar as a loaded DTCG theme

**Files:**
- Create: `packages/labkit/src/theme/interstellar.tokens.json`, `packages/labkit/src/theme/interstellar.ts`, `packages/labkit/src/theme/interstellar.test.ts`
- Modify: `packages/labkit/src/index.ts`, `packages/labkit/package.json`

- [ ] **Step 1: Write the failing test**

`packages/labkit/src/theme/interstellar.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { resolveTheme } from '@weasel-js/theme';
import { interstellarTheme } from './interstellar';

describe('interstellarTheme', () => {
  it('extends weasel and resolves both modes', () => {
    const dark = resolveTheme(interstellarTheme, 'dark');
    const light = resolveTheme(interstellarTheme, 'light');

    // Values carried over verbatim from the retired Less.
    expect(dark['--wzl-surface']).toBe('#0a0a14');
    expect(dark['--wzl-accent']).toBe('#b08adb');
    expect(light['--wzl-surface']).toBe('#fafaf7');
    expect(light['--wzl-accent']).toBe('#a86f3c');

    // Inherited from weasel — interstellar overrides values, not the token set.
    expect(dark['--wzl-space-md']).toBe('12px');
    expect(dark['--wzl-swatch-cyan']).toBe('#00dfff');

    // Deliberate divergences from the base.
    expect(dark['--wzl-radius-md']).toBe('6px');
    expect(dark['--wzl-font-weight-light']).toBe('300');
    expect(dark['--wzl-glass-blur']).toBe('12px');
  });

  it('carries the cosmic backdrop in dark and drops it in light', () => {
    expect(resolveTheme(interstellarTheme, 'dark')['--wzl-backdrop']).toContain(
      'radial-gradient',
    );
    expect(resolveTheme(interstellarTheme, 'light')['--wzl-backdrop']).toBe('none');
  });
});
```

```bash
npx vitest run --project=labkit packages/labkit/src/theme/
```

Expected: FAIL — the module does not exist.

- [ ] **Step 2: Author the DTCG document**

`packages/labkit/src/theme/interstellar.tokens.json`. Mode-invariant overrides
go in `primitives`; everything that flips goes in `modes`. Transcribe values
from `src/theme/tokens.less` — the `:root` block is dark, the
`prefers-color-scheme: light` block is light.

```json
{
  "name": "interstellar",
  "defaultMode": "dark",
  "primitives": {
    "dimension": {
      "$type": "dimension",
      "radius-md": { "$value": "6px" },
      "glass-blur": { "$value": "12px" }
    },
    "fontWeight": {
      "$type": "fontWeight",
      "font-weight-light": { "$value": 300 },
      "font-weight-medium": { "$value": 500 },
      "font-weight-bold": { "$value": 700 }
    }
  },
  "modes": {
    "dark": {
      "color": {
        "$type": "color",
        "surface": { "$value": "#0a0a14" },
        "surface-raised": { "$value": "rgba(20, 20, 36, 0.55)" },
        "surface-sunken": { "$value": "#02020a" },
        "border": { "$value": "rgba(255, 255, 255, 0.14)" },
        "line-subtle": { "$value": "rgba(255, 255, 255, 0.08)" },
        "fg": { "$value": "#e8e8f0" },
        "fg-muted": { "$value": "#a8a8c0" },
        "fg-subtle": { "$value": "#5a5a78" },
        "accent": { "$value": "#b08adb" },
        "accent-hover": { "$value": "#c6a3ee" },
        "focus-ring": { "$value": "rgba(176, 138, 219, 0.45)" }
      },
      "gradient": {
        "$type": "gradient",
        "backdrop": { "$value": "radial-gradient(ellipse 60% 80% at 18% 30%, rgba(150, 80, 200, 0.22), transparent 70%), radial-gradient(ellipse 55% 90% at 78% 70%, rgba(220, 100, 140, 0.18), transparent 65%), radial-gradient(ellipse 50% 70% at 50% 50%, rgba(60, 110, 200, 0.18), transparent 75%), radial-gradient(ellipse at center, #0a0a18 0%, #02020a 100%)" }
      }
    },
    "light": {
      "color": {
        "$type": "color",
        "surface": { "$value": "#fafaf7" },
        "surface-raised": { "$value": "#ffffff" },
        "surface-sunken": { "$value": "#f0ebe2" },
        "border": { "$value": "#c9bba5" },
        "line-subtle": { "$value": "rgba(0, 0, 0, 0.08)" },
        "fg": { "$value": "#2a2018" },
        "fg-muted": { "$value": "#6b5c4a" },
        "fg-subtle": { "$value": "#a89b85" },
        "accent": { "$value": "#a86f3c" },
        "accent-hover": { "$value": "#c2854f" },
        "focus-ring": { "$value": "rgba(168, 111, 60, 0.35)" }
      }
    }
  }
}
```

Light mode inherits `backdrop: none` from weasel, which is exactly what
`.lk-theme-light.lk-lab { background: var(--lk-bg) }` did by hand.

`--lk-text-disabled` and `--lk-text-dim` both land on `fg-subtle`; the light
palette defined only the former, so `fg-subtle` takes its value.

- [ ] **Step 3: Load it**

`packages/labkit/src/theme/interstellar.ts`:

```ts
import { loadDTCG, type Theme } from '@weasel-js/theme';
import doc from './interstellar.tokens.json' with { type: 'json' };

/**
 * labkit's theme: a cosmic dark and a warm parchment light, extending the
 * built-in weasel theme. Authored as DTCG and loaded at import time — the
 * interchange path a theme exported from a design tool would take.
 */
export const interstellarTheme: Theme = loadDTCG(doc);
```

If the JSON import assertion trips tsup or the `.d.ts` rollup, fall back to
`export default` from a `.ts` module holding the same object literal typed as
the DTCG document shape — but try the JSON first; it is the honest interchange
demonstration.

Export `interstellarTheme` from `packages/labkit/src/index.ts`. Move
`@weasel-js/theme` from `devDependencies` to `dependencies` in
`packages/labkit/package.json` — it is now imported by shipped source. (tsup's
`noExternal: [/^@weasel-js\//]` bundles it, so this is a correctness statement
about the source, not a change to what ships.)

- [ ] **Step 4: Verify**

```bash
npx vitest run --project=labkit packages/labkit/src/theme/
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/theme packages/labkit/src/index.ts packages/labkit/package.json
git commit -m "feat(labkit): interstellar is a DTCG theme extending weasel

Authored as a DTCG document and loaded through loadDTCG at import time —
the first real exercise of the interchange path. Values transcribed from
tokens.less unchanged; the Less itself goes in a later commit."
```

---

## Task 3: Collapse `--lk-*` into `--wzl-*`

Mechanical for the 24 Less files, plus the three bug fixes. Do it in one commit
so a bisect lands on a coherent state — the Less files and the theme wiring
must change together or labkit renders unthemed.

**Files:**
- Modify: every `.less` under `packages/labkit/src/` and `packages/labkit/examples/drag-lab/styles.less`
- Delete: `packages/labkit/src/theme/{tokens,light,interstellar}.less`

- [ ] **Step 1: Rewrite the references**

Work from the mapping table above. A `sed` pass gets most of it, but read every
hunk — several names collide across the three naming generations (`--lk-surface`
is a *raised* surface; `--lk-bg` is the base surface).

- [ ] **Step 2: Fix the structural rules in `base.less`**

`base.less` keeps the `@font-face`, the `.lk-root` element defaults, the
`.lk-lab` backdrop and the starscape pseudo-element. Drop
`@import './tokens.less'`. The two theme-class rules become mode selectors —
`<ThemeProvider>` stamps `data-wzl-mode` on a wrapper element above `.lk-lab`:

```less
.lk-lab {
  background: var(--wzl-backdrop, var(--wzl-surface));
  background-attachment: fixed;
}

[data-wzl-mode='light'] .lk-lab {
  background-attachment: scroll;
}

[data-wzl-mode='light'] .lk-lab::before {
  display: none;
}
```

The dark case needs no selector — `--wzl-backdrop` is `none` in light, so the
`background` declaration already collapses to the surface color.

Delete `tokens.less`, `light.less` and `interstellar.less`, and drop the two
theme imports from `styles.less` if present.

- [ ] **Step 3: Confirm nothing dangles**

```bash
grep -rn "\-\-lk-" packages/labkit/src packages/labkit/examples --include="*.less" --include="*.tsx" --include="*.ts"
```

Expected: only `--lk-panel-accent`, `--lk-layer-card-accent`, `--lk-grid-rows`,
`--lk-grid-cols` — the four per-instance properties.

Then confirm every remaining `--wzl-*` reference names a real token:

```bash
grep -rho "var(--wzl-[a-z0-9-]*" packages/labkit/src | sed 's/var(//' | sort -u
```

Cross-check each against `TOKEN_MANIFEST`. Anything not in it is a typo or a
missing Task 1 token — resolve it now, not at review.

- [ ] **Step 4: Commit with the wiring**

Hold this commit until Task 4 passes; they land together.

---

## Task 4: `<Lab>` and `<LabShell>` route through `<ThemeProvider>`

**Files:**
- Modify: `packages/labkit/src/lab/{Lab,LabShell,LabContext}.tsx|ts`, `packages/labkit/src/state/{types,store}.ts`
- Test: `packages/labkit/src/lab/{Lab,LabShell}.test.tsx`, `packages/labkit/src/state/store.test.ts`

- [ ] **Step 1: Rewrite the assertions**

`LabShell.test.tsx` and `Lab.test.tsx` assert `.lk-theme-light` /
`.lk-theme-interstellar` class names. Replace each with the attribute the
provider stamps:

```tsx
test('mode="light" stamps the light mode', () => {
  const { container } = render(<LabShell title="t" mode="light">x</LabShell>);
  expect(container.querySelector('[data-wzl-mode="light"]')).not.toBeNull();
  expect(container.querySelector('[data-wzl-theme="interstellar"]')).not.toBeNull();
});

test('mode="auto" follows the OS preference', () => {
  // matchMedia is stubbed per-test; assert the stubbed branch resolves to dark.
});
```

```bash
npx vitest run --project=labkit packages/labkit/src/lab/ packages/labkit/src/state/
```

Expected: FAIL.

- [ ] **Step 2: Rename the prop and the store slice**

`'auto' | 'light' | 'interstellar'` becomes `'auto' | 'light' | 'dark'`
everywhere: `LabShellProps.theme` → `mode`, `LabProps.theme` → `mode`,
`LabContext.theme`/`setTheme` → `mode`/`setMode`, `LabState.theme` → `mode`,
`store.setTheme` → `setMode`.

`LabTheme` is a published type name. Rename to `LabMode` and keep
`export type LabTheme = LabMode` — no; do not keep it. The prop it described no
longer exists, so an alias would only let stale call sites typecheck against a
prop that is gone. Rename it outright and note the break in the changeset.

The persisted storage bucket is `labStorageKey(key, 'theme')`. Keep the bucket
name `'theme'` but widen the hydration guard to accept the old values, mapping
`'interstellar'` → `'dark'`, so a user's stored preference survives:

```ts
const themeRaw = options.storage.read(labStorageKey(options.storageKey, 'theme'));
const stored = themeRaw === 'interstellar' ? 'dark' : themeRaw;
if (stored === 'light' || stored === 'dark' || stored === 'auto') hydratedMode = stored;
```

- [ ] **Step 3: Resolve `auto` and mount the provider**

`auto` is not a mode the resolver knows — it is "read the OS". Add a small hook
beside `Lab`:

```ts
/** The OS preference, live. Only consulted when mode is 'auto'. */
function useSystemMode(): 'light' | 'dark' { /* matchMedia + subscription */ }
```

`apps/draw/src/useColorMode.ts` is the reference for the subscription shape;
labkit's version is simpler because there is no stored-choice opt-out — the
store already holds the explicit choice.

In `Lab.tsx`, wrap the tree:

```tsx
<ThemeProvider theme={interstellarTheme} mode={resolvedMode}>
  <div className="lk-lab" style={backdropStyle}>…</div>
</ThemeProvider>
```

`LabShell` used standalone must theme itself too, so it mounts its own
`<ThemeProvider>`. Nesting one inside `Lab`'s is harmless — same theme, same
mode, and `applyTheme` emits its rule block once per `(theme, mode)` pair.

The `nebula` prop keeps working; its inline custom property is now
`--wzl-backdrop`, and the `themeValue === 'interstellar'` guard becomes
`resolvedMode === 'dark'`.

- [ ] **Step 4: Verify**

```bash
npx vitest run --project=labkit
```

Expected: PASS.

- [ ] **Step 5: Commit Tasks 3 and 4 together**

```bash
git add packages/labkit/src packages/labkit/examples
git commit -m "refactor(labkit): --lk-* collapses into --wzl-*; Lab mounts a ThemeProvider

The 42-token parallel tier is gone. The theme prop was a mode prop all
along — 'auto' | 'light' | 'dark' now, with stored 'interstellar' mapping
to 'dark' on hydration.

Fixes three sets of references that were defined nowhere and silently fell
back: --lk-text-dim (6 sites, no fallback, so those elements inherited
their parent color), --lk-space-2 (2 sites, no fallback, so two paddings
computed to 0), and the --lk-color-* generation across LayerList, Palette,
DragGhost, ControlPanel and CanvasStack, which pinned them to hardcoded
light-mode hexes that never followed the theme."
```

---

## Task 5: Retire the `lessc` theme pipeline

**Files:**
- Modify: `packages/labkit/package.json`, `.storybook/preview.tsx`

- [ ] **Step 1: Drop the two theme compiles and the two exports**

`build:css` becomes a single compile:

```json
"build:css": "lessc src/styles.less dist/styles.css",
```

Remove `"./theme-light.css"` and `"./theme-interstellar.css"` from `exports`.
These are public entry points; their removal is the breaking change the
changeset must lead with.

- [ ] **Step 2: Fix the Storybook preview**

`.storybook/preview.tsx` imports `theme/light.less` and `theme/interstellar.less`
(now deleted) and drives a `lk-theme-*` class from a `labkit theme` toolbar
control. Replace: keep the toolbar control, rename its values to
`auto`/`light`/`dark`, and have the labkit decorator wrap the story in
`<ThemeProvider theme={interstellarTheme} mode={…}>` instead of composing a
class string.

- [ ] **Step 3: Verify the build and the bundle**

```bash
npm run build -w @weasel-js/labkit
ls packages/labkit/dist/*.css
npm run test:smoke:consumer -w @weasel-js/labkit
```

Expected: `dist/styles.css` only. The smoke test should still pass; if it
asserts on the removed entry points, update it.

- [ ] **Step 4: Commit**

```bash
git add packages/labkit/package.json .storybook/preview.tsx
git commit -m "build(labkit): one CSS artifact, no theme compiles

theme-light.css and theme-interstellar.css are gone — a theme is a value
now, not a stylesheet you import."
```

---

## Task 6: The Interstellar story reads the resolved theme

`Interstellar.stories.tsx` reaches into the DOM
(`document.querySelector('.lk-theme-interstellar')` + `getComputedStyle`) to
show token values. That class no longer exists, and reading computed style is
exactly what Plan B removed from the HUD.

**Files:**
- Modify: `packages/labkit/src/theme/Interstellar.stories.tsx`, `packages/labkit/src/theme/Interstellar.stories.less`

- [ ] **Step 1: Read from context**

Replace the `getComputedStyle` block with `useTheme().resolved`, keyed by
`--wzl-*` name. The swatch grid's token list moves to `--wzl-swatch-*`, and the
nebula panel reads `--wzl-backdrop`.

- [ ] **Step 2: Verify**

```bash
npm run test:stories
```

Expected: PASS.

- [ ] **Step 3: Screenshot both modes**

labkit has no visual baselines, so this is the check that the migration was
value-preserving. Run Storybook, capture the Interstellar story and one dense
component story (`LayerStack` or `PropertyPanel`) in each mode, and compare
against the same captures taken from `HEAD` before Task 3. Expect: identical
except the three documented bug fixes — muted labels that were inheriting now
read subtle, two `Workspace` paddings appear, and `LayerList` / `Palette` /
`DragGhost` / `ControlPanel` / `CanvasStack` follow the theme in dark mode
instead of staying light.

Present the before/after to the user before moving on.

- [ ] **Step 4: Commit**

```bash
git add packages/labkit/src/theme
git commit -m "refactor(labkit): the theme story reads the resolved record

No getComputedStyle, no .lk-theme-* probe — the same record the stylesheet
was built from."
```

---

## Task 7: Docs, changeset, TODO

**Files:**
- Modify: `packages/labkit/README.md`, `packages/theme/README.md`, `docs/TODO.md`
- Create: `.changeset/labkit-convergence.md`

- [ ] **Step 1: labkit README**

Replace the theming section — it is already wrong, documenting a
`theme="dark"` value that has not existed since interstellar replaced `dark`.
`<Lab mode>` / `<LabShell mode>`, the `interstellarTheme` export, and one
paragraph on applying it somewhere else:

````markdown
## Theming

labkit ships one theme, `interstellar` — a cosmic dark and a warm parchment
light — as a value, not a stylesheet:

```tsx
import { interstellarTheme } from '@weasel-js/labkit';
import { ThemeProvider } from '@weasel-js/theme/react';

<ThemeProvider theme={interstellarTheme} mode="dark">…</ThemeProvider>
```

`<Lab>` and `<LabShell>` do this for you; `mode` is `"auto"` (follow the OS),
`"light"` or `"dark"`. Only `dist/styles.css` needs importing — the token
values arrive through the provider.
````

- [ ] **Step 2: theme README**

Add one line to the "Custom themes" section pointing at `interstellarTheme` as
a worked example of a theme authored as DTCG and loaded at runtime.

- [ ] **Step 3: TODO**

Mark the P1 Theming entry done and delete the "Remaining" list — Plan C was the
last item. Per the repo's retention policy, if the entry has no open
follow-ups, delete the whole block rather than leaving a `[x]`.

- [ ] **Step 4: Changeset**

`.changeset/labkit-convergence.md`:

```markdown
---
"@weasel-js/labkit": major
"@weasel-js/theme": minor
---

labkit's theming collapses into the shared system.

**Breaking.** `@weasel-js/labkit/theme-light.css` and
`/theme-interstellar.css` are gone, and so are the 42 `--lk-*` custom
properties — component styles read `--wzl-*` now. `<Lab>` and `<LabShell>`
take `mode` (`"auto" | "light" | "dark"`) instead of `theme`
(`"auto" | "light" | "interstellar"`); a stored `"interstellar"` preference
hydrates as `"dark"`. `LabTheme` is now `LabMode`.

`interstellar` is exported as a `Theme` value — authored as a DTCG document,
loaded through `loadDTCG`, extending the built-in theme. It overrides values
only: labkit's font weights, radius and glass blur differ from weasel's, and
`extends` rebases everything else.

Fixes three sets of references that had no definition and silently fell back
to hardcoded light-mode values or to nothing, which is why `LayerList`,
`Palette`, `DragGhost`, `ControlPanel` and `CanvasStack` did not follow the
theme.

`@weasel-js/theme` gains the token groups labkit contributed: a four-step
spacing scale, three z-layer constants, a ten-color categorical swatch set,
`--wzl-backdrop`, `--wzl-control-h`, `--wzl-glass-blur`, `--wzl-radius-lg`,
`--wzl-font-size`, `--wzl-font-size-sm` and `--wzl-font-weight-medium`.
```

- [ ] **Step 5: Full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run test:stories && npm run build && npm run check:manifests && npm run test:smoke:consumer && npm run test:visual
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(labkit): theming section reflects the shared system"
```

---

## Done when

- `grep -rn "\-\-lk-" packages/labkit` returns only the four per-instance
  properties.
- `packages/labkit/src/theme/` contains no `.less` token files, and `build:css`
  runs `lessc` once.
- `interstellarTheme` is a public export, built by `loadDTCG` from a DTCG
  document, and resolving it in either mode reproduces the values the retired
  Less produced.
- Storybook's labkit stories theme through `<ThemeProvider>`, and the token
  story reads `useTheme().resolved` rather than `getComputedStyle`.
- The five components that never followed the theme now do, in both modes.
- `npm run test:visual` passes unchanged — nothing outside labkit moved.
