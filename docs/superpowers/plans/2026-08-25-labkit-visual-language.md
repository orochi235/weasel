# labkit visual language (arc 4) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give labkit's chrome one type, weight and shape scale; give three orphaned readouts a home; and add the lint that stops the scales eroding again.

**Architecture:** Tokens are authored as DTCG JSON and *generated* into CSS — never edited in `src/generated/`. Phase 1 widens the token set with no consumer changes, so nothing renders differently. Phases 2 and 3 migrate `packages/ui` then `packages/labkit` onto it. Phase 4 makes the structural moves (region contributions, border de-duplication, toolbar role) and lands the lint that holds the line.

**Tech Stack:** DTCG tokens (`packages/theme`), LESS (labkit) + CSS modules (ui), React 19, vitest + Testing Library, Storybook 9, tsx for lint scripts.

**Spec:** `docs/superpowers/specs/2026-08-25-labkit-visual-language-design.md`

**Branch:** `feat/labkit-arc4` (already created; the spec commit is on it)

---

## Rules that apply to every task

**Never edit `packages/theme/src/generated/`.** Those files are build output. Edit
`packages/theme/tokens/weasel/**` and run `npm run gen:tokens -w @weasel-js/theme`. CI re-runs
the generator and fails on a diff, so the regenerated files must be committed alongside the
source edit in the same commit.

**The main checkout is shared with a concurrent session.** Never `git add -A`. Stage the explicit
paths each task names, and run `git status` before assuming the tree is yours.

**Never `git stash`.** The stash stack is shared across every worktree of this repo, so a
`stash`/`pop` pair run here can pop another session's work into your tree — there is currently a
`draw-load-cost-wip` entry on it that is not ours. To capture a visual baseline, check out the
prior commit into a throwaway worktree, or capture from a second Storybook started on the parent
commit. If you truly must, use `git stash push -u -m "<unique-tag>"`, record the SHA from
`git stash list --format='%H %gs'`, restore with `git stash apply <sha>` — never `pop` — and drop
your own entry by re-finding it by tag.

**jsdom cannot catch a layout collapse.** Any task that changes a container's box ends with a
Storybook screenshot check, not just a green test run. This is not optional: arc 3 shipped a
collapse that passed all 7903 tests while rendering an empty page.

**Switching theme in Storybook takes the in-page toggle, not the URL.** `<Lab>` mounts its own
`ThemeProvider` defaulting to `Auto`, which follows `prefers-color-scheme`. Storybook's
`&globals=theme:dark` sets `data-theme` on `<html>`, which that provider ignores — so the URL
global renders whatever the browser's OS preference is, and a "both themes" check done that way
verifies one theme twice. Click the lab header's `Auto` / `Light` / `Dark` buttons instead.

**Read theme values off the painted element, not off `.lk-root`.** The mode toggle applies the
theme to a nested node, so `getComputedStyle(document.querySelector('.lk-root'))` still reports
light-mode token values while the trial renders dark. Assert against `.lk-trial` (or whichever
element the rule targets).

**Changesets are always `patch`** (repo rule, `CLAUDE.md`). Do not write a `bump-approved` marker.

---

## File structure

| File | Responsibility | Phase |
|---|---|---|
| `packages/theme/tokens/weasel/primitives.tokens.json` | the base scale — sizes, weights, radii, line-height, letter-spacing | 1 |
| `packages/theme/tokens/weasel/modes/{dark,light}.tokens.json` | mode-varying color, incl. the new shadow + trial-border tokens | 1 |
| `packages/theme/src/generated/*` | build output, regenerated never hand-edited | 1 |
| `packages/labkit/src/theme/interstellar.tokens.json` | labkit's theme override; loses its now-redundant `fontWeight` block | 1 |
| `packages/ui/src/components/**/*.module.css` | 42 CSS modules — the bulk of the untokenized surface | 2 |
| `packages/labkit/src/ui/properties/PropertyPanel.less` | 592 lines, densest defect concentration | 3 |
| `packages/labkit/src/**/*.less` | remaining 26 stylesheets | 3 |
| `packages/labkit/src/chrome/builtins.tsx` | where the three orphans get contributed | 4 |
| `packages/labkit/src/primitives/Toolbar.tsx` | gains `role="toolbar"` + roving tabindex | 4 |
| `packages/labkit/src/primitives/useRovingTabIndex.ts` | **new** — the roving-focus hook, so `Toolbar.tsx` stays declarative | 4 |
| `packages/labkit/scripts/check-design-tokens.ts` | **new** — the lint; sibling of `check-class-prefix.ts` | 4 |

---

# Phase 1 — Tokens

Nothing renders differently in this phase. Every task adds token surface; consumers migrate in
phases 2–4.

### Task 1: Widen the font-size scale

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json` (the `dimension` group)
- Modify (generated, do not hand-edit): `packages/theme/src/generated/tokens.css`, `manifest.ts`, `themes.ts`
- Test: `packages/theme/src/generated/tokens.generated.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/generated/tokens.generated.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');

/** Reads a `--wzl-<name>: <value>;` declaration out of the generated CSS. */
function tokenValue(name: string): string | null {
  const m = css.match(new RegExp(`--wzl-${name}:\\s*([^;]+);`));
  return m ? m[1].trim() : null;
}

describe('font-size scale', () => {
  it('covers every rank the chrome uses', () => {
    expect(tokenValue('font-size-2xs')).toBe('9px');
    expect(tokenValue('font-size-xs')).toBe('10px');
    expect(tokenValue('font-size-sm')).toBe('11px');
    expect(tokenValue('font-size')).toBe('13px');
    expect(tokenValue('font-size-lg')).toBe('16px');
    expect(tokenValue('font-size-xl')).toBe('20px');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/theme/src/generated/tokens.generated.test.ts
```

Expected: FAIL — `expected null to be '9px'` (only `font-size` and `font-size-sm` exist today).

- [ ] **Step 3: Add the tokens to the DTCG source**

In `packages/theme/tokens/weasel/primitives.tokens.json`, inside the `"dimension"` group, replace
the two existing font-size entries with the full ladder:

```json
    "font-size-2xs": {
      "$value": "9px",
      "$description": "Shortcut keys and index badges. Below this a glyph stops resolving at 1x."
    },
    "font-size-xs": {
      "$value": "10px",
      "$description": "Tool-button labels under an icon."
    },
    "font-size-sm": {
      "$value": "11px",
      "$description": "Chrome labels, status readouts, section headings."
    },
    "font-size": {
      "$value": "13px",
      "$description": "Controls and body text."
    },
    "font-size-lg": {
      "$value": "16px",
      "$description": "Panel and dialog titles."
    },
    "font-size-xl": {
      "$value": "20px",
      "$description": "The lab title. Replaces labkit's local --lk-title-size."
    },
```

- [ ] **Step 4: Regenerate and run the test**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run packages/theme/src/generated/tokens.generated.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/tokens/weasel/primitives.tokens.json \
        packages/theme/src/generated \
        packages/theme/src/generated/tokens.generated.test.ts
git commit -m "add the missing font-size ranks to the token scale"
```

---

### Task 2: Unify the font-weight scale on 300/500/700

The base theme's 200/300/350/400 and interstellar's 300/500/700 make one token name mean two
things. Base widens to interstellar's, and interstellar's override becomes redundant and is
deleted. `font-weight-light` is dropped — its six users want `normal`.

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json` (the `fontWeight` and `fontFamily` groups)
- Modify: `packages/labkit/src/theme/interstellar.tokens.json`
- Test: `packages/theme/src/generated/tokens.generated.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `packages/theme/src/generated/tokens.generated.test.ts`:

```ts
describe('font-weight scale', () => {
  it('is one ladder of three ranks', () => {
    expect(tokenValue('font-weight-normal')).toBe('300');
    expect(tokenValue('font-weight-medium')).toBe('500');
    expect(tokenValue('font-weight-bold')).toBe('700');
  });

  it('drops the light rank, which nothing distinguishes from normal', () => {
    expect(tokenValue('font-weight-light')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/theme/src/generated/tokens.generated.test.ts -t 'font-weight'
```

Expected: FAIL — `font-weight-medium` is `350`, and `font-weight-light` is `200` rather than absent.

- [ ] **Step 3: Rewrite the fontWeight group**

In `packages/theme/tokens/weasel/primitives.tokens.json`, replace the whole `"fontWeight"` group:

```json
  "fontWeight": {
    "$type": "fontWeight",
    "font-weight-normal": { "$value": 300 },
    "font-weight-medium": { "$value": 500 },
    "font-weight-bold": { "$value": 700 }
  },
```

- [ ] **Step 4: Correct the now-false description on `font-ui`**

Same file, in the `"fontFamily"` group. The existing `$description` on `font-ui` asserts a
constraint this task removes, so it must not survive unedited:

```json
    "font-ui": {
      "$value": ["Oswald", "Helvetica Neue Condensed", "Arial Narrow", "system-ui", "sans-serif"],
      "$description": "Condensed UI/display face."
    },
```

- [ ] **Step 5: Delete the redundant interstellar override**

In `packages/labkit/src/theme/interstellar.tokens.json`, remove the entire `"fontWeight"` block
from `"primitives"`. It now restates the base scale. After the edit, `"primitives"` reads:

```json
  "primitives": {
    "dimension": {
      "$type": "dimension",
      "radius-md": { "$value": "6px" },
      "glass-blur": { "$value": "12px" }
    }
  },
```

- [ ] **Step 6: Regenerate and run the test**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run packages/theme/src/generated/tokens.generated.test.ts
```

Expected: PASS.

- [ ] **Step 7: Find every `font-weight-light` consumer and repoint it**

```bash
grep -rn 'font-weight-light' packages/labkit/src packages/ui/src
```

Expected: 6 sites — `labkit/src/theme/base.less:27`, `:139`, `ui/layers/LayerStack.less:16`,
`ui/properties/PropertyPanel.less:17`, `:87`, `:586`, plus `PropertyGroup.less:15`. Replace each
`var(--wzl-font-weight-light)` with `var(--wzl-font-weight-normal)`.

- [ ] **Step 8: Verify nothing still references the dropped token**

```bash
grep -rn 'font-weight-light' packages/ apps/ --include=*.less --include=*.css --include=*.tsx --include=*.json
```

Expected: no output.

- [ ] **Step 9: Screenshot both themes**

Open `http://localhost:6031/iframe.html?id=labkit-chrome-regions--every-region&viewMode=story`
and switch theme with the lab header's Light / Dark buttons (see the rule above — the URL global
does not drive the lab). Body text moves 300→300 (unchanged); anything that read `light` moves
200→300 on the base theme. Confirm no text has become invisible or clipped.

- [ ] **Step 10: Commit**

```bash
git add packages/theme/tokens/weasel/primitives.tokens.json \
        packages/theme/src/generated \
        packages/labkit/src/theme/interstellar.tokens.json \
        packages/labkit/src/theme/base.less \
        packages/labkit/src/ui/layers/LayerStack.less \
        packages/labkit/src/ui/properties/PropertyPanel.less \
        packages/labkit/src/ui/properties/PropertyGroup.less
git commit -m "unify the font-weight scale on 300/500/700 across both themes"
```

---

### Task 3: Add line-height and letter-spacing tokens

41 raw line-heights and 24 raw letter-spacings against zero tokens.

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json`
- Test: `packages/theme/src/generated/tokens.generated.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
describe('line-height and letter-spacing', () => {
  it('has a line-height for each role', () => {
    expect(tokenValue('leading-tight')).toBe('1');
    expect(tokenValue('leading-snug')).toBe('1.2');
    expect(tokenValue('leading')).toBe('1.4');
  });

  it('has a tracking scale for uppercase chrome', () => {
    expect(tokenValue('tracking-none')).toBe('0');
    expect(tokenValue('tracking-wide')).toBe('0.06em');
    expect(tokenValue('tracking-wider')).toBe('0.08em');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/theme/src/generated/tokens.generated.test.ts -t 'line-height'
```

Expected: FAIL — all six are null.

- [ ] **Step 3: Add a `number` entry per line-height and a `dimension` entry per tracking**

Line-heights are unitless, so they belong in the existing `"number"` group:

```json
  "number": {
    "$type": "number",
    "z-toolbar": { "$value": 10 },
    "z-overlay": { "$value": 20 },
    "z-modal": { "$value": 30 },
    "leading-tight": { "$value": 1, "$description": "Single-line controls; the box sets the height." },
    "leading-snug": { "$value": 1.2, "$description": "Headings and two-line labels." },
    "leading": { "$value": 1.4, "$description": "Body and anything that wraps." }
  },
```

Tracking carries `em`, so it goes in `"dimension"`:

```json
    "tracking-none": { "$value": "0" },
    "tracking-wide": { "$value": "0.06em", "$description": "Uppercase section headings." },
    "tracking-wider": { "$value": "0.08em", "$description": "Uppercase at 11px and below." },
```

- [ ] **Step 4: Regenerate and run the test**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run packages/theme/src/generated/tokens.generated.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/tokens/weasel/primitives.tokens.json packages/theme/src/generated
git commit -m "add line-height and letter-spacing tokens"
```

---

### Task 4: Add the pill radius, the shadow, and the trial border

Three shape/color tokens the migration needs. The shadow is the one that fixes a real bug: the
trial's shadow derives from `--wzl-fg`, the *text* color, so on interstellar dark it casts a
near-white shadow on a near-black field.

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json`
- Modify: `packages/theme/tokens/weasel/modes/dark.tokens.json`, `modes/light.tokens.json`
- Test: `packages/theme/src/generated/tokens.generated.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

```ts
describe('shape and elevation', () => {
  it('has a pill radius so 999px stops being written by hand', () => {
    expect(tokenValue('radius-pill')).toBe('999px');
  });

  it('derives elevation from a shadow color, never from the foreground', () => {
    for (const decl of css.matchAll(/--wzl-shadow:\s*([^;]+);/g)) {
      expect(decl[1]).not.toContain('--wzl-fg');
    }
    expect(css).toContain('--wzl-shadow:');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/theme/src/generated/tokens.generated.test.ts -t 'shape and elevation'
```

Expected: FAIL — `radius-pill` is null.

- [ ] **Step 3: Add `radius-pill` to the dimension group**

In `primitives.tokens.json`, `"dimension"`:

```json
    "radius-pill": {
      "$value": "999px",
      "$description": "Fully rounded ends — segmented controls, progress tracks."
    },
```

- [ ] **Step 4: Add a shadow color and a trial border per mode**

In `packages/theme/tokens/weasel/modes/dark.tokens.json`, add to the `"color"` group:

```json
    "shadow":         { "$value": "rgba(0, 0, 0, 0.6)", "$description": "Elevation. Always darker than any surface — never derived from fg, which is near-white on dark." },
    "border-raised":  { "$value": "{color.gray-500}", "$description": "The line separating a raised surface from the field behind it. Held at 3:1 against surface, which the general-purpose border is not." }
```

In `packages/theme/tokens/weasel/modes/light.tokens.json`, add the same two keys to `"color"`:

```json
    "shadow":         { "$value": "rgba(0, 0, 0, 0.18)" },
    "border-raised":  { "$value": "{color.gray-500}" }
```

- [ ] **Step 5: Ship no composite shadow token**

The obvious convenience token — `--wzl-shadow-1: 0 1px 3px var(--wzl-shadow)` — is unsound and
must not be added. A `var()` inside a *custom property* is substituted where that property is
**declared**, so a `shadow-1` declared in `:root` bakes in the dark `--wzl-shadow` and inherits
that frozen value into the light-mode block: light mode silently gets the dark shadow.
Verified in a browser. The same var-in-a-real-property resolves correctly per element, so the
consumer writes `box-shadow: 0 1px 3px var(--wzl-shadow)` and there is nothing to get wrong.

`--wzl-line`, `--wzl-line-subtle`, `--wzl-line-strong`, `--wzl-surface-hover` and
`--wzl-surface-pressed` are already broken this way — pre-existing, out of scope here, and
recorded as a TODO entry in Task 14.

- [ ] **Step 6: Regenerate and run the test**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run packages/theme/src/generated/tokens.generated.test.ts
```

Expected: PASS.

- [ ] **Step 7: Add the interstellar values for both new colors**

The interstellar theme sets its own palette, so it needs both keys or it falls back to the base
theme's grays, which do not match its warm/violet fields. In
`packages/labkit/src/theme/interstellar.tokens.json`, add to `modes.dark.color`:

```json
        "shadow": { "$value": "rgba(0, 0, 0, 0.7)" },
        "border-raised": { "$value": "rgba(255, 255, 255, 0.32)" },
```

and to `modes.light.color`:

```json
        "shadow": { "$value": "rgba(80, 60, 40, 0.18)" },
        "border-raised": { "$value": "#a89478" },
```

- [ ] **Step 8: Verify the contrast target is met**

The spec requires the trial border at 3:1 against the workspace. Check both interstellar modes:

```bash
node -e '
const lum = (hex) => {
  const c = hex.replace("#","").match(/../g).map(h => {
    const v = parseInt(h,16)/255;
    return v <= 0.03928 ? v/12.92 : ((v+0.055)/1.055)**2.4;
  });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
};
const ratio = (a,b) => { const [x,y] = [lum(a),lum(b)].sort((p,q)=>q-p); return (x+0.05)/(y+0.05); };
console.log("light: border-raised #a89478 vs surface #fafaf7 =", ratio("#a89478","#fafaf7").toFixed(2));
'
```

Expected: a ratio of at least 3.00 for light. For dark, `rgba(255,255,255,0.32)` composites over
`#0a0a14` to roughly `#57575e`; verify in the browser with the DevTools contrast picker rather
than by hand, since the trial surface is itself translucent.

If either mode falls short, raise the alpha (dark) or darken the hex (light) and re-check. Do not
proceed with a failing ratio.

- [ ] **Step 9: Commit**

```bash
git add packages/theme/tokens/weasel packages/theme/src/generated \
        packages/labkit/src/theme/interstellar.tokens.json
git commit -m "add pill radius, a shadow token, and a 3:1 raised-surface border"
```

---

### Task 5: Changeset for the token surface

**Files:**
- Create: `.changeset/labkit-arc4-tokens.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/labkit-arc4-tokens.md`. It is `patch` — the repo rule admits no exceptions,
and writing a `bump-approved` marker requires Mike's explicit OK in conversation:

```markdown
---
'@weasel-js/theme': patch
---

Widen the design-token scale: six font-size ranks in place of two, one
font-weight ladder (300/500/700) shared by both themes rather than two that
disagree, line-height and letter-spacing tokens where there were none, a pill
radius, and a shadow token.

Additive except for two removals. `--wzl-font-weight-light` is gone; use
`--wzl-font-weight-normal`. `--wzl-font-weight-medium` resolves to 500 rather
than 350 under the base theme, so anything that pinned itself to the old value
will render heavier.
```

- [ ] **Step 2: Verify the bump checker passes**

```bash
npm run check:bumps
```

Expected: PASS (exit 0).

- [ ] **Step 3: Commit**

```bash
git add .changeset/labkit-arc4-tokens.md
git commit -m "add a changeset for the widened token scale"
```

---

# Phase 2 — `packages/ui`

42 CSS modules, 3675 lines, and the largest untokenized surface: zero tokenized font-sizes or
font-weights across the whole package.

### Task 6: The ui type migration

**Files:**
- Modify: 42 files under `packages/ui/src/components/**/*.module.css`
- Test: `packages/ui/src/tokenUsage.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/ui/src/tokenUsage.test.ts`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('.', import.meta.url).pathname;

function cssFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) cssFiles(full, out);
    else if (full.endsWith('.css')) out.push(full);
  }
  return out;
}

/** `font-size: 11px` — a literal length, not a var() or `inherit`. */
const RAW_FONT_SIZE = /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/;

describe('packages/ui type tokens', () => {
  it('sizes every glyph from the scale', () => {
    const offenders = cssFiles(SRC)
      .filter((f) => !f.includes('Foundations'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f, i: i + 1, line }))
          .filter(({ line }) => RAW_FONT_SIZE.test(line)),
      )
      .map(({ f, i, line }) => `${f}:${i} ${line.trim()}`);
    expect(offenders).toEqual([]);
  });
});
```

`Foundations` is excluded because it is the token *documentation* page — it renders literals on
purpose to show what a token resolves to.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/ui/src/tokenUsage.test.ts
```

Expected: FAIL listing ~66 offending lines (76 raw px sites less the ~10 in `Foundations`).

- [ ] **Step 3: Migrate font-size, one component at a time**

Work down the list the test prints. The mapping is fixed by the spec — apply it mechanically:

| was | becomes |
|---|---|
| `9px` | `var(--wzl-font-size-2xs)` |
| `10px` | `var(--wzl-font-size-xs)` |
| `11px`, `12px` | `var(--wzl-font-size-sm)` |
| `13px`, `14px` | `var(--wzl-font-size)` |
| `16px` | `var(--wzl-font-size-lg)` |
| `18px` | `var(--wzl-font-size-xl)` |

Two component-local indirections keep their own name but get a token default:
`var(--btn-fontsize, 14px)` → `var(--btn-fontsize, var(--wzl-font-size))` in
`segmentedControl.module.css:45` and `ToggleBar/ToggleBar.module.css:41`;
`var(--badge-font-size, 10px)` → `var(--badge-font-size, var(--wzl-font-size-xs))` in
`Badge/Badge.module.css:7`.

Also fix the fallback that contradicts its token — `BandEditor/BandEditor.module.css:12` has
`var(--wzl-font-size-sm, 0.75rem)`, where 0.75rem is 12px and the token is 11px:

```css
  font: var(--wzl-font-weight-medium) var(--wzl-font-size-sm) / var(--wzl-leading-tight) var(--wzl-font-ui);
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npx vitest run packages/ui/src/tokenUsage.test.ts
```

Expected: PASS.

- [ ] **Step 5: Migrate font-weight in the same files**

`grep -rn 'font-weight' packages/ui/src --include=*.css`. Map `300` → `normal`, `400`/`500` →
`medium`, `600`/`700` → `bold`. Also fix `BandEditor.module.css` lines 12, 40 and 66, whose
`var(--wzl-font-weight-medium, 500)` fallback now agrees with the token and can drop the fallback
entirely.

- [ ] **Step 6: Run the full ui suite**

```bash
npm run test:ui
```

Expected: PASS. Any snapshot that pinned a px font-size will fail — update it, since the size
change is the intent.

- [ ] **Step 7: Screenshot the ui components**

The 12→11 and 14→13 folds change 24 sites. Open Storybook and check `Button`, `Badge`, `Tabs`,
`Dialog`, `Toast`, `Tooltip`, `Select` and `ToolButton` in both themes. A control whose text now
overflows its box is a real regression, not an acceptable consequence.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src
git commit -m "size every glyph in ui from the type scale"
```

---

### Task 7: The ui shape and color migration

**Files:**
- Modify: `packages/ui/src/components/**/*.module.css`
- Test: `packages/ui/src/tokenUsage.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `packages/ui/src/tokenUsage.test.ts`:

```ts
/** `border-radius: 3px` — a literal, but `50%` and `0` are legitimate. */
const RAW_RADIUS = /border-radius:[^;}]*\b\d*\.?\d+(px|rem|em)\b/;
/** A bare hex or rgba() that is not inside a var() fallback. */
const RAW_COLOR = /(?<!var\([^)]{0,80})(#[0-9a-fA-F]{3,8}\b|rgba?\()/;

describe('packages/ui shape and color tokens', () => {
  it('rounds every corner from the scale', () => {
    const offenders = cssFiles(SRC)
      .filter((f) => !f.includes('Foundations'))
      .flatMap((f) =>
        readFileSync(f, 'utf8')
          .split('\n')
          .map((line, i) => ({ f, i: i + 1, line }))
          .filter(({ line }) => RAW_RADIUS.test(line)),
      )
      .map(({ f, i, line }) => `${f}:${i} ${line.trim()}`);
    expect(offenders).toEqual([]);
  });

  it('spells danger exactly one way', () => {
    const reds = ['#ff5b5b', '#c43c3c', '#f04438', '#ffb3a8'];
    const offenders = cssFiles(SRC).flatMap((f) =>
      readFileSync(f, 'utf8')
        .split('\n')
        .map((line, i) => ({ f, i: i + 1, line }))
        .filter(({ line }) => reds.some((r) => line.toLowerCase().includes(r))),
    ).map(({ f, i, line }) => `${f}:${i} ${line.trim()}`);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/ui/src/tokenUsage.test.ts -t 'shape and color'
```

Expected: FAIL — radii listing ~40 sites, danger listing the 6 `#ff5b5b` fallbacks plus
`Badge.module.css:62`.

- [ ] **Step 3: Migrate the radii**

| was | becomes |
|---|---|
| `2px`, `3px`, `4px` | `var(--wzl-radius-sm)` |
| `5px`, `8px` | `var(--wzl-radius-md)` |
| `999px`, `9999px` | `var(--wzl-radius-pill)` |

The four corner-pair forms in `segmentedControl.module.css:58,62` and
`ToggleBar.module.css:54,58` become e.g.
`border-radius: var(--wzl-radius-pill) 0 0 var(--wzl-radius-pill)`.
Leave `50%` (8 sites — real circles) and `0` (7 sites — segment resets) alone.

- [ ] **Step 4: Collapse the danger reds**

Replace `var(--wzl-danger, #ff5b5b)` with `var(--wzl-danger)` in all six of
`Input`, `Checkbox`, `Field`, `ComboBox`, `Select`, `NumberField`. In `Badge/Badge.module.css:62`,
replace the bare `#c43c3c` with `var(--wzl-danger)`. The fallbacks were the drift: `#ff5b5b` is
not `--wzl-danger-base`'s `#d94a3f`.

- [ ] **Step 5: Replace the surface rgba() literals**

`Button.module.css` alone holds 23. `--wzl-surface-hover`, `--wzl-surface-pressed` and
`--wzl-line-subtle` are each defined as exactly the `color-mix` being hand-written. Map
`rgba(255,255,255,0.05..0.08)` on an interactive element to `var(--wzl-surface-hover)`, the
heavier step to `var(--wzl-surface-pressed)`, and a hairline to `var(--wzl-line-subtle)`.

Where a literal has no token equivalent, leave it and note it — a wrong token is worse than an
honest literal, and Task 13's lint has an allowlist for exactly this.

- [ ] **Step 6: Run the tests**

```bash
npx vitest run packages/ui/src/tokenUsage.test.ts && npm run test:ui
```

Expected: PASS.

- [ ] **Step 7: Screenshot hover and pressed states**

The rgba→token swap is the highest-risk step in this task: a wrong mapping is invisible at rest
and only shows on interaction. In Storybook, hover and press `Button` in every variant, in both
themes.

- [ ] **Step 8: Commit**

```bash
git add packages/ui/src
git commit -m "round and color ui from the token scale"
```

---

# Phase 3 — `packages/labkit`

### Task 8: Convert `labkit/src/ui/properties` from rem to px

The two packages size type in different units — ui in px, `labkit/src/ui/properties` in rem/em.
This task removes the second system before Task 9 tokenizes what is left.

**Files:**
- Modify: `packages/labkit/src/ui/properties/PropertyPanel.less`, `PropertyGroup.less`, `CurveField.less`
- Modify: `packages/labkit/src/ui/layers/LayerStack.less`
- Modify: `packages/labkit/src/ui/properties/storyLayouts.tsx`

- [ ] **Step 1: List every site**

```bash
grep -rn '[0-9]\(\.[0-9]*\)\?r\?em' packages/labkit/src/ui --include=*.less --include=*.tsx
```

Expected: 16 `font-size` sites plus 5 inside `font:` shorthands.

- [ ] **Step 2: Convert at 16px root**

| was | px | token |
|---|---|---|
| `0.7em`, `0.72rem` | 11.2, 11.5 | `var(--wzl-font-size-sm)` |
| `0.75rem`, `0.78rem`, `0.78em` | 12, 12.5 | `var(--wzl-font-size-sm)` |
| `0.85rem` | 13.6 | `var(--wzl-font-size)` |
| `0.9rem` | 14.4 | `var(--wzl-font-size)` |
| `1rem` | 16 | `var(--wzl-font-size-lg)` |
| `1.05rem` | 16.8 | `var(--wzl-font-size-lg)` |

The five `font:` shorthands (`PropertyPanel.less:233,251,377,528,586`,
`LayerStack` and `Slider` equivalents) each expand — a shorthand hides a size from every grep,
which is why they are being removed rather than converted in place. `PropertyPanel.less:233`:

```less
  font-weight: var(--wzl-font-weight-medium);
  font-size: var(--wzl-font-size);
  line-height: var(--wzl-leading-tight);
```

- [ ] **Step 3: Fix the hardcoded family in the story helper**

`packages/labkit/src/ui/properties/storyLayouts.tsx:10` hardcodes
`'300 0.72rem/1 Oswald, system-ui'`, bypassing the token. Replace the literal font shorthand with
the tokens:

```tsx
font: 'var(--wzl-font-weight-normal) var(--wzl-font-size-sm)/var(--wzl-leading-tight) var(--wzl-font-ui)',
```

- [ ] **Step 4: Verify no rem/em survives in the tree**

```bash
grep -rn '[0-9]\(\.[0-9]*\)\?r\?em' packages/labkit/src/ui --include=*.less --include=*.tsx
```

Expected: no output.

- [ ] **Step 5: Screenshot the property panel**

Open `labkit/UI/Properties/PropertyPanel` in Storybook, both themes. Every row moved size; a row
whose readout now clips its `calc(5em - 24px)` width is a regression this task introduced.

- [ ] **Step 6: Commit**

```bash
git add packages/labkit/src/ui
git commit -m "size labkit's property panel in px, from the type scale"
```

---

### Task 9: The labkit stylesheet migration

**Files:**
- Modify: 27 `.less` files under `packages/labkit/src`
- Test: `packages/labkit/src/tokenUsage.test.ts` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/labkit/src/tokenUsage.test.ts` — the same shape as
`packages/ui/src/tokenUsage.test.ts`, walking `.less` instead of `.css`, and skipping
`theme/base.less` (the starfield) and `theme/Interstellar.stories.less`:

```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = new URL('.', import.meta.url).pathname;
const SKIP = ['theme/base.less', 'theme/Interstellar.stories.less'];

function lessFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) lessFiles(full, out);
    else if (full.endsWith('.less') && !SKIP.some((s) => full.endsWith(s))) out.push(full);
  }
  return out;
}

const RAW_FONT_SIZE = /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/;
const RAW_RADIUS = /border-radius:[^;}]*\b\d*\.?\d+(px|rem|em)\b/;

function offenders(re: RegExp): string[] {
  return lessFiles(SRC).flatMap((f) =>
    readFileSync(f, 'utf8')
      .split('\n')
      .map((line, i) => ({ f, i: i + 1, line }))
      .filter(({ line }) => re.test(line))
      .map(({ i, line }) => `${f}:${i} ${line.trim()}`),
  );
}

describe('labkit type and shape tokens', () => {
  it('sizes every glyph from the scale', () => expect(offenders(RAW_FONT_SIZE)).toEqual([]));
  it('rounds every corner from the scale', () => expect(offenders(RAW_RADIUS)).toEqual([]));
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/labkit/src/tokenUsage.test.ts
```

Expected: FAIL listing the remaining raw sizes and the `3px`/`2px`/`4px`/`1px`/`999px` radii.

- [ ] **Step 3: Apply the same mappings as Tasks 6 and 7**

Plus these labkit-specific fixes:

- `LayerStack.less:49` `border-radius: 1px` is a bug — `var(--wzl-radius-sm)`.
- `JobProgress.less:12` `999px` → `var(--wzl-radius-pill)`.
- `theme/base.less:22-23` — delete `--lk-title-size: 20px` and point
  `LabShell.less:27` at `var(--wzl-font-size-xl)`. Its comment — *"the theme ships only body
  sizes (13px / 11px), so headings pick their own"* — was true when written and Task 1 makes it
  false. Delete the comment with the token; leaving it would assert a gap that no longer exists.

- [ ] **Step 4: Retire the hand-written monospace stacks**

```bash
grep -rn 'ui-monospace\|font-family:\s*monospace' packages/labkit/src --include=*.less
```

Expected: `PropertyPanel.less:513` (an inline stack) and `LayerList.less:39` (a bare `monospace`
keyword with no stack at all). Both become `var(--wzl-font-mono)`.

- [ ] **Step 5: Fix the two `#0a0a14` foregrounds**

`PropertyPanel.less:394` and `:399` set `color: #0a0a14` — a copy of interstellar's `surface`
value used as a foreground, so it stays near-black in light mode and is illegible on the accent
fill. Both become `var(--wzl-fg-inverse)`, which exists for this and flips with the mode.

- [ ] **Step 6: Collapse labkit's danger reds**

`PropertyPanel.less:560-562` uses `#ffb3a8` and `rgba(240, 68, 56, …)`:

```less
  color: var(--wzl-danger-fg, var(--wzl-danger));
  border-color: color-mix(in srgb, var(--wzl-danger) 40%, transparent);
  background: color-mix(in srgb, var(--wzl-danger) 8%, transparent);
```

- [ ] **Step 7: Give the layers checkbox an accent**

`LayerList`/`LayerStack` renders a bare `<input type="checkbox">` with no `accent-color`, so it
renders OS blue against a warm accent — the one unthemed control in the chrome. In
`LayerList.less`, add:

```less
input[type='checkbox'] {
  accent-color: var(--wzl-accent);
}
```

- [ ] **Step 8: Run the tests**

```bash
npx vitest run packages/labkit/src/tokenUsage.test.ts && npx vitest run --project=labkit
```

Expected: PASS.

- [ ] **Step 9: Screenshot both themes, both stories**

`labkit/Chrome/Regions → EveryRegion` and `labkit/Lab/LabFullChrome → AllChrome`, dark and light.
Confirm specifically that the light-mode toggle text (the `#0a0a14` fix) is now legible.

- [ ] **Step 10: Commit**

```bash
git add packages/labkit/src
git commit -m "draw labkit's chrome from the type, shape and color scales"
```

---

# Phase 4 — Structure

### Task 10: One border per seam

**Files:**
- Modify: `packages/labkit/src/trial/Trial.less:67,72`
- Test: `packages/labkit/src/trial/trialChrome.borders.test.tsx` (new)

- [ ] **Step 1: Write the failing test**

Create `packages/labkit/src/trial/trialChrome.borders.test.tsx`:

```tsx
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const less = readFileSync(new URL('./Trial.less', import.meta.url), 'utf8');

/** Grabs the body of one rule by selector. */
function rule(selector: string): string {
  const i = less.indexOf(selector);
  if (i === -1) throw new Error(`no rule for ${selector}`);
  return less.slice(i, less.indexOf('}', i));
}

describe('trial chrome seams', () => {
  it('lets the component draw its own border, not the wrapper', () => {
    expect(rule('.lk-trial__toolbar')).not.toMatch(/border-bottom:\s*[^;]*solid/);
    expect(rule('.lk-trial__status')).not.toMatch(/border-top:\s*[^;]*solid/);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/labkit/src/trial/trialChrome.borders.test.tsx
```

Expected: FAIL — both wrappers declare a border today.

- [ ] **Step 3: Delete the wrapper borders**

`Toolbar` and `StatusBar` are used outside a trial; the wrappers are not, so the component keeps
its border. In `Trial.less`, remove `border-bottom: 1px solid var(--wzl-line-subtle);` from
`.lk-trial__toolbar` and `border-top: 1px solid var(--wzl-line-subtle);` from `.lk-trial__status`.

- [ ] **Step 4: Point the trial's own border and shadow at the new tokens**

Same file, `.lk-trial` (lines 11-14):

```less
  background: var(--wzl-surface-raised);
  border: var(--wzl-border-w) solid var(--wzl-border-raised);
  border-radius: var(--wzl-radius-md);
  box-shadow: 0 1px 3px var(--wzl-shadow);
```

- [ ] **Step 5: Run the test**

```bash
npx vitest run packages/labkit/src/trial/trialChrome.borders.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Screenshot — this task changes container boxes**

Two borders became one, so the trial is 2px shorter. Open `EveryRegion` in both themes and
confirm: no doubled hairline at the toolbar or status seam, the trial border now clearly visible
against the workspace, and the shadow reading as *below* the trial rather than as a halo.

- [ ] **Step 7: Commit**

```bash
git add packages/labkit/src/trial/Trial.less packages/labkit/src/trial/trialChrome.borders.test.tsx
git commit -m "draw one border per trial seam and fix the elevation direction"
```

---

### Task 11: Contribute the three orphaned readouts

`FpsMeter`, `ScaleIndicator` and `ZoomControl` are exported, styled, and rendered nowhere — zero
production call sites. All three are components with live state rather than text or an icon
button, so all three use the `render` escape arm of `TrialContribution`. That is what the escape
is for, and it keeps the declaration honest.

**Files:**
- Modify: `packages/labkit/src/chrome/builtins.tsx`
- Test: `packages/labkit/src/chrome/builtins.test.ts` (extend)

- [ ] **Step 1: Write the failing test**

Append to `packages/labkit/src/chrome/builtins.test.ts`:

```ts
describe('view readouts', () => {
  it('contributes fps and scale to the status bar when the trial has a canvas', () => {
    const out = builtinContributions(canvasInstrument, ctxWithZoom(1));
    const status = out.filter((c) => c.region === 'status').map((c) => c.id);
    expect(status).toContain('fps');
    expect(status).toContain('scale');
  });

  it('contributes the zoom control to the viewport, replacing the readout', () => {
    const out = builtinContributions(canvasInstrument, ctxWithZoom(1));
    const viewport = out.filter((c) => c.region === 'viewport').map((c) => c.id);
    expect(viewport).toContain('zoom-control');
    expect(out.map((c) => c.id)).not.toContain('zoom-readout');
  });

  it('contributes none of them to a trial with no canvas', () => {
    const out = builtinContributions(plainInstrument, ctxWithZoom(null));
    expect(out.map((c) => c.id)).not.toContain('fps');
    expect(out.map((c) => c.id)).not.toContain('zoom-control');
  });
});
```

Reuse the `canvasInstrument` / `plainInstrument` / `ctxWithZoom` helpers already at the top of
that file; if a helper for a canvas-bearing instrument does not exist, add one mirroring the
existing fixture shape.

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/labkit/src/chrome/builtins.test.ts -t 'view readouts'
```

Expected: FAIL — none of `fps`, `scale`, `zoom-control` are contributed.

- [ ] **Step 3: Contribute them**

In `packages/labkit/src/chrome/builtins.tsx`, add the imports:

```tsx
import { FpsMeter } from '../primitives/FpsMeter';
import { ScaleIndicator } from '../primitives/ScaleIndicator';
import { ZoomControl } from '../primitives/ZoomControl';
```

Then inside the existing `if (instrument.canvas != null && zoom !== null) {` block, replace the
`zoom-readout` push with the zoom control, and add the two readouts. Keep the three icon buttons
— the spec replaces the *readout*, not the steppers:

```tsx
    out.push({
      id: 'zoom-control',
      region: 'viewport',
      group: 'zoom',
      render: (c) => (
        <ZoomControl zoom={c.zoom ?? 1} onZoomChange={c.setZoom} />
      ),
    });
    out.push({
      id: 'scale',
      region: 'status',
      group: 'view',
      render: () => <ScaleIndicator />,
    });
    out.push({
      id: 'fps',
      region: 'status',
      group: 'view',
      end: true,
      render: () => <FpsMeter />,
    });
```

`ScaleIndicator` takes no props here: it reads zoom from `CanvasStackContext`, which a
canvas-bearing trial already provides.

- [ ] **Step 4: Run the test**

```bash
npx vitest run packages/labkit/src/chrome/builtins.test.ts
```

Expected: PASS.

- [ ] **Step 5: Check the region renderers accept a `render` contribution**

```bash
grep -n 'render' packages/labkit/src/chrome/regions/StatusRegion.tsx packages/labkit/src/chrome/regions/ViewportRegion.tsx
```

Both must branch on `contribution.render` before reading `item`. If either does not, add the
branch — the union permits `render` on every region, so a renderer that assumes `item` will crash
on these three.

- [ ] **Step 6: Run the whole labkit suite**

```bash
npx vitest run --project=labkit
```

Expected: PASS. `FpsMeter` drives `requestAnimationFrame`; if a test times out, the fixture needs
fake timers, not a change to the component.

- [ ] **Step 7: Screenshot — this task changes container boxes**

`EveryRegion`, both themes. The status bar now carries a scale bar and an FPS readout rather than
`100%` alone; the viewport controls now carry a slider and an editable field beside the three
steppers. Confirm the viewport control cluster has not outgrown its corner at a narrow trial
width — resize the Storybook frame to ~500px and check.

- [ ] **Step 8: Shrink the title bar**

With the readouts homed, the title bar carries name plus grip only. In `Trial.less`, its
`min-height: 24px` becomes the height its 15.4px of text needs:

```less
  min-height: calc(var(--wzl-font-size-sm) * var(--wzl-leading) + var(--wzl-space-xs));
```

Screenshot again — a title bar that clips its own descenders is the failure mode here.

- [ ] **Step 9: Commit**

```bash
git add packages/labkit/src/chrome packages/labkit/src/trial/Trial.less
git commit -m "contribute the fps, scale and zoom readouts to their regions"
```

---

### Task 12: The toolbar role and roving tabindex

`<Toolbar>` renders a bare `<div>`, so `Toolbar.Group`'s `role="group"` sits inside nothing. The
APG toolbar pattern obliges roving tabindex and arrow-key navigation; claiming the role without
them tells a screen-reader user to press keys that do nothing.

**Files:**
- Create: `packages/labkit/src/primitives/useRovingTabIndex.ts`
- Create: `packages/labkit/src/primitives/useRovingTabIndex.test.ts`
- Modify: `packages/labkit/src/primitives/Toolbar.tsx`
- Test: `packages/labkit/src/primitives/Toolbar.test.tsx` (new)

- [ ] **Step 1: Write the failing hook test**

Create `packages/labkit/src/primitives/useRovingTabIndex.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { nextIndex } from './useRovingTabIndex';

describe('nextIndex', () => {
  it('steps forward and wraps', () => {
    expect(nextIndex(0, 'ArrowRight', 3)).toBe(1);
    expect(nextIndex(2, 'ArrowRight', 3)).toBe(0);
  });

  it('steps back and wraps', () => {
    expect(nextIndex(1, 'ArrowLeft', 3)).toBe(0);
    expect(nextIndex(0, 'ArrowLeft', 3)).toBe(2);
  });

  it('jumps to the ends', () => {
    expect(nextIndex(1, 'Home', 3)).toBe(0);
    expect(nextIndex(1, 'End', 3)).toBe(2);
  });

  it('returns null for a key it does not handle', () => {
    expect(nextIndex(1, 'Enter', 3)).toBeNull();
  });

  it('returns null when there is nothing to move to', () => {
    expect(nextIndex(0, 'ArrowRight', 0)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/labkit/src/primitives/useRovingTabIndex.test.ts
```

Expected: FAIL — `Failed to resolve import "./useRovingTabIndex"`.

- [ ] **Step 3: Write the hook**

Create `packages/labkit/src/primitives/useRovingTabIndex.ts`:

```ts
import { type KeyboardEvent, useCallback, useEffect, useRef } from 'react';

/** Where a key takes focus within `count` items, or null if it does not move it. */
export function nextIndex(current: number, key: string, count: number): number | null {
  if (count === 0) return null;
  switch (key) {
    case 'ArrowRight':
      return (current + 1) % count;
    case 'ArrowLeft':
      return (current - 1 + count) % count;
    case 'Home':
      return 0;
    case 'End':
      return count - 1;
    default:
      return null;
  }
}

/**
 * The APG roving-tabindex contract: exactly one item in the tab order, arrows
 * moving focus within. `tabIndex` is written onto the DOM nodes rather than
 * threaded through props, because the items are arbitrary children — the
 * container never sees them as a list it could index.
 */
export function useRovingTabIndex<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);

  const items = useCallback(
    (): HTMLElement[] =>
      ref.current
        ? Array.from(
            ref.current.querySelectorAll<HTMLElement>('button:not([disabled]), [role="button"]'),
          )
        : [],
    [],
  );

  const setTabStop = useCallback(
    (index: number) => {
      for (const [i, el] of items().entries()) el.tabIndex = i === index ? 0 : -1;
    },
    [items],
  );

  // Establish the initial tab stop, and re-establish it whenever the button set
  // changes — a toolbar's contributions are dynamic.
  useEffect(() => {
    setTabStop(0);
    if (!ref.current) return;
    const mo = new MutationObserver(() => setTabStop(0));
    mo.observe(ref.current, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, [setTabStop]);

  const onKeyDown = useCallback(
    (e: KeyboardEvent<T>) => {
      const found = items();
      const current = found.indexOf(document.activeElement as HTMLElement);
      const next = nextIndex(current === -1 ? 0 : current, e.key, found.length);
      if (next === null) return;
      e.preventDefault();
      found[next]?.focus();
      setTabStop(next);
    },
    [items, setTabStop],
  );

  return { ref, onKeyDown };
}
```

- [ ] **Step 4: Run the hook test**

```bash
npx vitest run packages/labkit/src/primitives/useRovingTabIndex.test.ts
```

Expected: PASS.

- [ ] **Step 5: Write the failing Toolbar test**

Create `packages/labkit/src/primitives/Toolbar.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { Toolbar } from './Toolbar';

function threeButtons() {
  return render(
    <Toolbar aria-label="Trial actions">
      <Toolbar.Group aria-label="History">
        <Toolbar.Button onClick={() => {}} title="Undo">
          U
        </Toolbar.Button>
        <Toolbar.Button onClick={() => {}} title="Redo">
          R
        </Toolbar.Button>
      </Toolbar.Group>
      <Toolbar.Button onClick={() => {}} title="Close">
        X
      </Toolbar.Button>
    </Toolbar>,
  );
}

describe('Toolbar', () => {
  it('claims the toolbar role and is nameable', () => {
    threeButtons();
    expect(screen.getByRole('toolbar', { name: 'Trial actions' })).toBeInTheDocument();
  });

  it('keeps exactly one button in the tab order', () => {
    threeButtons();
    const inOrder = screen.getAllByRole('button').filter((b) => b.tabIndex === 0);
    expect(inOrder).toHaveLength(1);
  });

  it('moves focus with the arrow keys, wrapping at the end', async () => {
    const user = userEvent.setup();
    threeButtons();
    await user.tab();
    expect(screen.getByTitle('Undo')).toHaveFocus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByTitle('Redo')).toHaveFocus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    expect(screen.getByTitle('Undo')).toHaveFocus();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

```bash
npx vitest run packages/labkit/src/primitives/Toolbar.test.tsx
```

Expected: FAIL — `Unable to find an accessible element with the role "toolbar"`.

- [ ] **Step 7: Wire the hook into Toolbar**

In `packages/labkit/src/primitives/Toolbar.tsx`, replace the `Toolbar` function and extend its
props. `ToolbarProps` gains a name, since a toolbar with a role must be nameable:

```tsx
/** Props for `<Toolbar>`. */
export interface ToolbarProps {
  children: ReactNode;
  /** Names the toolbar for assistive tech. Required by the APG pattern when a
   *  view holds more than one. */
  'aria-label'?: string;
}

export function Toolbar({ children, 'aria-label': ariaLabel }: ToolbarProps) {
  const { ref, onKeyDown } = useRovingTabIndex<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className="lk-toolbar"
      role="toolbar"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
    >
      {children}
    </div>
  );
}
```

Add the import at the top: `import { useRovingTabIndex } from './useRovingTabIndex';`

Nothing else in `Toolbar.tsx` changes. `Button` needs no `tabIndex` prop: the hook writes
`tabIndex` onto the DOM nodes, which is why it can manage arbitrary children rather than a list
the container has to index.

- [ ] **Step 8: Run both tests**

```bash
npx vitest run packages/labkit/src/primitives/Toolbar.test.tsx packages/labkit/src/primitives/useRovingTabIndex.test.ts
```

Expected: PASS.

- [ ] **Step 9: Remove the biome suppression**

In `Toolbar.tsx`, delete the `// biome-ignore lint/a11y/useSemanticElements:` comment above the
`Group` div. `role="group"` inside `role="toolbar"` is now correct, so the rule no longer fires.

```bash
npm run lint -w @weasel-js/labkit
```

Expected: PASS with no suppression and no new diagnostic.

- [ ] **Step 10: Pass a name from the trial**

`TrialChrome` renders the toolbar via `ToolbarRegion`. Give it a label so the new role is named:
in `packages/labkit/src/chrome/regions/ToolbarRegion.tsx`, pass
`aria-label="Trial actions"` to `<Toolbar>`.

- [ ] **Step 11: Check it by keyboard in the browser**

Open `EveryRegion`. Tab into the toolbar — focus should land on undo and the rest of the bar
should be skipped by further tabbing. Arrow right through every button and confirm it wraps.
A visible focus ring must follow; if it does not, the outline rule at `Toolbar.less:82` needs the
roving element rather than `:focus-visible` alone.

- [ ] **Step 12: Commit**

```bash
git add packages/labkit/src/primitives/Toolbar.tsx \
        packages/labkit/src/primitives/Toolbar.test.tsx \
        packages/labkit/src/primitives/useRovingTabIndex.ts \
        packages/labkit/src/primitives/useRovingTabIndex.test.ts \
        packages/labkit/src/chrome/regions/ToolbarRegion.tsx
git commit -m "give the toolbar its role, roving tabindex and arrow-key navigation"
```

---

### Task 13: The lint that holds the scales

Without this the 5618 lines re-accumulate — nothing today stops the next hardcoded size. The
sibling precedent is `packages/labkit/scripts/check-class-prefix.ts`, already wired into
labkit's `lint` script.

**Files:**
- Create: `packages/labkit/scripts/check-design-tokens.ts`
- Modify: `packages/labkit/package.json` (the `lint` script)
- Test: `packages/labkit/scripts/check-design-tokens.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/labkit/scripts/check-design-tokens.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findOffenders } from './check-design-tokens';

describe('findOffenders', () => {
  it('flags a raw font-size', () => {
    const out = findOffenders('a.less', '.x { font-size: 12px; }');
    expect(out).toHaveLength(1);
    expect(out[0].match).toContain('font-size');
  });

  it('accepts a tokenized one', () => {
    expect(findOffenders('a.less', '.x { font-size: var(--wzl-font-size); }')).toEqual([]);
  });

  it('flags a fallback that disagrees with its token', () => {
    const out = findOffenders('a.less', '.x { font-size: var(--wzl-font-size-sm, 12px); }');
    expect(out).toHaveLength(1);
    expect(out[0].match).toMatch(/disagrees/);
  });

  it('accepts a fallback that agrees', () => {
    expect(findOffenders('a.less', '.x { font-size: var(--wzl-font-size-sm, 11px); }')).toEqual([]);
  });

  it('accepts a literal on an allowlisted file', () => {
    expect(findOffenders('theme/base.less', '.x { background: #fff; }')).toEqual([]);
  });

  it('accepts 50% and 0 radii', () => {
    expect(findOffenders('a.less', '.x { border-radius: 50%; }')).toEqual([]);
    expect(findOffenders('a.less', '.x { border-radius: 0; }')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
npx vitest run packages/labkit/scripts/check-design-tokens.test.ts
```

Expected: FAIL — `Failed to resolve import "./check-design-tokens"`.

- [ ] **Step 3: Write the script**

Create `packages/labkit/scripts/check-design-tokens.ts`. It exports `findOffenders` for the test
and runs as a CLI when invoked directly:

```ts
#!/usr/bin/env tsx
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export interface Offender {
  file: string;
  line: number;
  match: string;
}

/** Files whose literals are deliberate. The starfield is structure, not color;
 *  the Foundations and story pages render literals to document the tokens. */
const ALLOWLIST = ['theme/base.less', 'theme/Interstellar.stories.less', 'Foundations'];

/** The token values a `var(--token, fallback)` fallback must agree with. */
const TOKEN_VALUES: Record<string, string> = {
  '--wzl-font-size-2xs': '9px',
  '--wzl-font-size-xs': '10px',
  '--wzl-font-size-sm': '11px',
  '--wzl-font-size': '13px',
  '--wzl-font-size-lg': '16px',
  '--wzl-font-size-xl': '20px',
  '--wzl-font-weight-normal': '300',
  '--wzl-font-weight-medium': '500',
  '--wzl-font-weight-bold': '700',
  '--wzl-radius-sm': '3px',
  '--wzl-radius-md': '5px',
  '--wzl-radius-lg': '14px',
  '--wzl-radius-pill': '999px',
};

const RAW = [
  { name: 'font-size', re: /font-size:[^;}]*\b\d*\.?\d+(px|rem|em|pt|ex|ch)\b/ },
  { name: 'font-weight', re: /font-weight:[^;}]*(?<!-)\b[1-9]00\b/ },
  { name: 'border-radius', re: /border-radius:[^;}]*\b\d*\.?\d+(px|rem|em)\b/ },
];

const VAR_FALLBACK = /var\(\s*(--wzl-[\w-]+)\s*,\s*([^)]+)\)/g;

export function findOffenders(file: string, source: string): Offender[] {
  if (ALLOWLIST.some((a) => file.includes(a))) return [];
  const out: Offender[] = [];
  source.split('\n').forEach((line, i) => {
    for (const { name, re } of RAW) {
      if (re.test(line)) out.push({ file, line: i + 1, match: `raw ${name}: ${line.trim()}` });
    }
    for (const m of line.matchAll(VAR_FALLBACK)) {
      const [, token, fallback] = m;
      const expected = TOKEN_VALUES[token];
      if (expected && fallback.trim() !== expected) {
        out.push({
          file,
          line: i + 1,
          match: `fallback disagrees with ${token}: got ${fallback.trim()}, token is ${expected}`,
        });
      }
    }
  });
  return out;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (full.endsWith('.less') || full.endsWith('.css')) out.push(full);
  }
  return out;
}

// CLI: scan labkit's and ui's stylesheets, print every offender, exit 1 if any.
const invokedDirectly = process.argv[1]?.endsWith('check-design-tokens.ts');
if (invokedDirectly) {
  const roots = [
    new URL('../src', import.meta.url).pathname,
    new URL('../../ui/src', import.meta.url).pathname,
  ];
  const offenders = roots.flatMap((root) =>
    walk(root).flatMap((f) => findOffenders(relative(root, f), readFileSync(f, 'utf8'))),
  );
  for (const o of offenders) console.error(`${o.file}:${o.line}  ${o.match}`);
  if (offenders.length > 0) {
    console.error(`\n${offenders.length} design-token violation(s).`);
    process.exit(1);
  }
  console.log('design tokens: clean');
}
```

- [ ] **Step 4: Run the test**

```bash
npx vitest run packages/labkit/scripts/check-design-tokens.test.ts
```

Expected: PASS.

- [ ] **Step 5: Run the CLI against the real tree**

```bash
npx tsx packages/labkit/scripts/check-design-tokens.ts
```

Expected: `design tokens: clean`. If it prints offenders, phases 2–3 left work behind — fix those
sites rather than widening the allowlist. Widening the allowlist to make the check pass defeats
the check.

- [ ] **Step 6: Wire it into lint**

In `packages/labkit/package.json`, extend the `lint` script:

```json
    "lint": "biome check . && tsx scripts/check-class-prefix.ts && tsx scripts/check-design-tokens.ts",
```

- [ ] **Step 7: Verify it fails on a reintroduced literal**

A check nobody has watched fail is not known to work. Temporarily add `font-size: 12px;` to any
rule in `packages/labkit/src/primitives/StatusBar.less`, then:

```bash
npm run lint -w @weasel-js/labkit
```

Expected: FAIL naming `primitives/StatusBar.less` and the line. Revert the edit and re-run;
expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/labkit/scripts/check-design-tokens.ts \
        packages/labkit/scripts/check-design-tokens.test.ts \
        packages/labkit/package.json
git commit -m "fail the lint on a hardcoded size, weight, radius or contradicting fallback"
```

---

### Task 14: Changeset, docs, and the full gate

**Files:**
- Create: `.changeset/labkit-arc4-chrome.md`
- Modify: `docs/TODO.md`
- Modify: `docs/handoffs/2026-08-25-labkit-presentation-pass.md`

- [ ] **Step 1: Write the changeset**

Create `.changeset/labkit-arc4-chrome.md` — `patch`, per the repo rule:

```markdown
---
'@weasel-js/labkit': patch
'@weasel-js/ui': patch
---

Draw labkit's chrome and the ui components from one type, weight and shape
scale. Sizes fold onto six ranks, so a 12px label renders at 11 and a 14px one
at 13; corners fold onto four radii.

Three components that were exported but rendered nowhere now appear in the
default chrome: FpsMeter and ScaleIndicator in the status bar, ZoomControl in
the viewport controls. The trial's box-shadow no longer derives from the
foreground color, so elevation reads as elevation on dark themes.

`<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
one button in the tab order, arrows moving focus within, Home and End jumping
to the ends. It takes an `aria-label`.
```

- [ ] **Step 2: Update the TODO**

In `docs/TODO.md`, the P1 `labkit arc 4` entry is now done. Per `CLAUDE.md`'s retention policy,
a completed block stays inline only while it has open follow-ups. Arc 4 was the last of the four,
and the presentation-pass line at `docs/TODO.md:26` referenced it — delete both that line and the
arc-3 `[x]` block above the arc-4 entry, since its only open follow-up *was* arc 4.

Anything genuinely left over becomes its own entry. Add one for the literals the migration could
not tokenize:

```markdown
- **(P2) A mode-varying token referenced from a `:root` primitive freezes at the
  dark value.** CSS substitutes a `var()` inside a *custom property* at the scope
  where that property is declared, so a primitive in `:root` that references a
  mode semantic inherits the default mode's value into every other mode's block.
  `--wzl-line`, `--wzl-line-subtle`, `--wzl-line-strong`, `--wzl-surface-hover`
  and `--wzl-surface-pressed` are all authored this way and all resolve to their
  dark values in light mode. Arc 4 sidestepped it by not adding a composite
  `--wzl-shadow-1`, but the five existing ones are still wrong.

  It only bites the raw-`tokens.css` + `data-wzl-mode` path — `applyTheme.ts`
  re-emits every resolved token into one rule, so labkit is fine. The broken path
  is what `packages/ui/.storybook/preview.ts` uses, which is why the Foundations
  page's own light/dark comparison is misleading. The fix is in
  `build-tokens.ts`: emit a primitive that references a mode semantic into each
  mode block rather than into `:root`. A test must switch `data-wzl-mode` and
  read a computed value — `generated.test.ts` already asserts the `color-mix`
  mechanism is *present*, which is what let this pass.

- **(P3) The color literals with no token equivalent.** The arc-4 pass tokenized
  what had a token and left the rest rather than inventing a mapping —
  `check-design-tokens` covers size, weight and radius but not color, for that
  reason. What remains is `Badge`'s tone palette (`#7ab8d4`, `#d4a574`) and the
  `GradientHandles` / `Keycaps` literals. Each needs a semantic name before it
  can be a token.
```

- [ ] **Step 3: Update the handoff**

`docs/handoffs/2026-08-25-labkit-presentation-pass.md` says arc 4 is "not started" and lists three
things under "Left open" that this plan settled. All four arcs are now merged, so the handoff has
no remaining job: delete the file. Its traps are the part worth keeping — move the two that are
not arc-specific (the jsdom layout-collapse trap and the `:where()` specificity trap) into
`packages/labkit/CLAUDE.md` if one exists, or the repo `CLAUDE.md` if not.

- [ ] **Step 4: Run the full release gate**

This is what CI runs. It is slow; run it in the background rather than blocking on it.

```bash
npm run check:bumps && npm run typecheck && npm run lint && npm run test && npm run test:stories
```

Expected: PASS. `test:stories` is the one that matters most here — it renders every story, so a
component broken by the size folds surfaces there.

- [ ] **Step 5: Screenshot the whole lab, both themes, one last time**

`labkit/Lab/LabFullChrome → AllChrome` and `labkit/Chrome/Regions → EveryRegion`, dark and light.
This is the arc's deliverable; look at it as a whole rather than checking individual fixes.

- [ ] **Step 6: Commit**

```bash
git add .changeset/labkit-arc4-chrome.md docs/TODO.md docs/handoffs
git commit -m "record arc 4 and retire the presentation-pass handoff"
```

---

## Verification checklist

Before calling the arc done:

- [ ] `npx tsx packages/labkit/scripts/check-design-tokens.ts` prints `design tokens: clean`
- [ ] The lint has been *watched to fail* on a reintroduced literal (Task 13 step 7)
- [ ] `npm run typecheck && npm run lint && npm run test && npm run test:stories` all pass
- [ ] `EveryRegion` and `AllChrome` screenshotted in **both** themes — three of the fixed defects
      are mode-specific and a dark-only check misses all of them
- [ ] The trial border measures at least 3:1 against the workspace in both modes
- [ ] Tab + arrow keys walk the toolbar, with a visible focus ring
- [ ] No `pnpm-lock.yaml`, and `package-lock.json` is unchanged unless a dependency actually moved
