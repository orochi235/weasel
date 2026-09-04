# Control Skin Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Tick each box as you finish it** — an unchecked box on shipped work reads as open work, and nothing recomputes it. `[~]` marks a step deliberately not run here; the text beside it says where it went instead.

**Goal:** Collapse weasel-ui's six slider treatments and four field treatments onto the property-row skin, so adding a control anywhere in the kit doesn't mean re-authoring its track, thumb and box.

**Architecture:** Four new theme tokens carry slider geometry and tint. One shared CSS module (`range.module.css`, following the existing `segmentedControl.module.css` precedent) owns the native-`<input type="range">` skin and is imported by the three surfaces that render that DOM. `Slider` — the multi-thumb canvas widget — keeps its own chrome but gains a `density="slim"` reading so `ZoomControl` can match. Boxed fields read `var(--wzl-field-h, var(--wzl-control-h))`, with density set by a container rather than hard-coded per stylesheet.

**Tech Stack:** React 19, TypeScript, CSS modules (vite), Less (labkit), DTCG token pipeline (`packages/theme`), vitest, react-aria-components.

**Spec:** `docs/superpowers/specs/2026-09-03-control-skin-unification-design.md`

**Worktree:** `/Users/mike/src/weasel/.claude/worktrees/control-skin`, branch `control-skin`. All paths below are relative to it. Deps are installed there already.

---

## Commands you will need

| Purpose | Command |
|---|---|
| weasel-ui + theme tests | `npx vitest run --project=weasel-ui` |
| labkit tests | `npx vitest run --project=labkit` |
| core tests | `npx vitest run --project=kit` |
| Typecheck | `npx tsc --noEmit` (**from the repo root of the worktree**) |
| Regenerate tokens | `npm run gen:tokens -w @weasel-js/theme` |
| Storybook | `npm run dev:storybook` (port 6010) |

`tsc -p packages/<pkg>/tsconfig.json` exits 1 with pre-existing `TS6059` errors on a clean tree. Always typecheck from the root.

## Verification policy — this overrides the per-task steps below

Several tasks below say "run the full ui suite". **Don't.** Per task, run:

1. Your focused test file.
2. `npx tsc --noEmit` from the worktree root.
3. A project suite **only if you changed a `.ts`/`.tsx` file** — and only the project that covers it.

A CSS-only change cannot move the `weasel-ui` suite: CSS modules are not processed in that project (only `labkit` sets `css: true`), so 2748 tests re-run to observe nothing. The full sweep happens once, in Final verification.

**Never run a suite while another agent is running one.** Vitest takes ~11 of this machine's 12 cores, so two concurrent runs contend and produce timeouts that are not real failures — `packages/bidi/src/conformance.test.ts` has already failed this way at 5000ms and passes in 3.08s alone. A timeout in a file you did not touch is contention, not a regression: say so, don't chase it.

**Theme switching in Storybook:** `&globals=theme:dark` sets `data-theme`, which nothing reads. `tokens.css` keys off `data-wzl-mode`. Use the lab header's Auto/Light/Dark buttons in labkit stories; for bare `@weasel-js/ui` stories set `data-wzl-mode` by hand on the root element.

---

## File Structure

**Created**
- `packages/ui/src/components/range.module.css` — the single native-range skin (track, thumb, focus, disabled) plus an `.alpha` modifier. Sits at `components/` root, not in a component folder, because three components import it.
- `packages/ui/src/components/range.test.tsx` — contract tests that the three surfaces apply the shared class.

**Modified**
- `packages/theme/tokens/weasel/primitives.tokens.json` — four slider tokens + `field-pad-x`.
- `packages/theme/src/generated/{tokens.css,themes.ts,manifest.ts}` — regenerated, committed.
- `packages/ui/src/components/InlineRange/InlineRange.module.css` + `.tsx` — drop own track/thumb, import shared.
- `packages/ui/src/components/Properties/Properties.module.css` — drop own track/thumb, adopt `--wzl-field-h`, one focus rule.
- `packages/ui/src/components/Properties/PropertyPanel.tsx` — apply shared class to the two range inputs; set density vars on the list root.
- `packages/ui/src/components/Slider/Slider.{tsx,module.css}` — `density` prop, `--rp-thumb-size`, delete the false token comment.
- `packages/ui/src/components/{Input,NumberField,ComboBox}/*.module.css` — height/padding from the field vars.
- `packages/ui/src/components/NumberField/NumberField.{tsx,module.css}` — `ghost` variant.
- `packages/ui/src/components/ColorField/ColorField.module.css` — chip focus rule.
- `packages/ui/src/components/Foundations/Foundations.stories.tsx` — drop the five dead alias names.
- `apps/site/canvas-kit-demo.css` — drop the five dead alias declarations.
- `packages/labkit/src/theme/base.less` — full range skin replacing `accent-color`.
- `packages/labkit/src/primitives/ZoomControl.tsx` — `density="slim"`, ghost readout.
- `packages/labkit/src/annotations/MarkList.tsx` — bare `<input>` → `<Input>`.

**Separate repo (Task 12)** — `~/src/experiments/speech-balloons`.

---

### Task 1: Slider and field tokens

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json`
- Regenerate: `packages/theme/src/generated/{tokens.css,themes.ts,manifest.ts}`

The generator discards the type-group key and prefixes the leaf verbatim, so `dimension.slider-track-h` emits `--wzl-slider-track-h`. Percentages are off-label for `$type: dimension`, but leaves emit verbatim and nothing validates units.

- [x] **Step 1: Add the tokens**

In `primitives.tokens.json`, inside the existing `"dimension"` group, after the `"control-h"` line:

```json
    "slider-track-h":    { "$value": "4px", "$description": "Height of a linear range track. The kit's single-thumb ranges all wear this; Slider's default 24px canvas track does not." },
    "slider-thumb-size": { "$value": "8px", "$description": "Diameter of a linear range thumb." },
    "slider-track-tint": { "$value": "18%", "$description": "Accent proportion in a range track. Mixed into a real property, never into another custom property." },
    "slider-thumb-tint": { "$value": "70%", "$description": "Accent proportion in a range thumb." },
    "field-pad-x":       { "$value": "8px", "$description": "Horizontal padding inside a boxed field. Pairs with --wzl-field-h, which is a container override and has no :root default." },
```

- [x] **Step 2: Run the determinism test to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/generated/determinism.test.ts`
Expected: FAIL — "`tokens.css` is stale — run `npm run gen:tokens -w @weasel-js/theme` and commit"

This is the guard that a token edit was regenerated. Watching it fail is the point.

- [x] **Step 3: Regenerate**

Run: `npm run gen:tokens -w @weasel-js/theme`

- [x] **Step 4: Verify the emitted names**

Run: `grep -n 'wzl-slider-\|wzl-field-pad-x' packages/theme/src/generated/tokens.css`
Expected: five lines, in the `:root` block, e.g. `  --wzl-slider-track-h: 4px;`

- [x] **Step 5: Run the theme tests**

Run: `npx vitest run --project=weasel-ui packages/theme/`
Expected: PASS. `generated.test.ts` and `tokens.generated.test.ts` assert specific named values and are not count-based, so they need no edit.

- [x] **Step 6: Commit**

```bash
git add packages/theme/tokens/weasel/primitives.tokens.json packages/theme/src/generated
git commit -m "add slider geometry and field padding tokens"
```

---

### Task 2: Delete the dead slider aliases

`--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`, `--wzl-thumb-border`, `--wzl-thumb-text` have zero readers repo-wide and are listed under "Deprecated aliases". `Slider.module.css` still tells consumers to re-skin through them, which is false — the rule beneath that comment uses `--wzl-fg-inverse` and `--wzl-fg-muted`.

**Files:**
- Modify: `apps/site/canvas-kit-demo.css:443-447`
- Modify: `packages/ui/src/components/Foundations/Foundations.stories.tsx:323-324`
- Modify: `packages/ui/src/components/Slider/Slider.module.css:58-61`

- [x] **Step 1: Confirm they are unread**

Run: `grep -rn 'var(--wzl-track-bg\|var(--wzl-track-border\|var(--wzl-thumb-fill\|var(--wzl-thumb-border\|var(--wzl-thumb-text' packages apps --include='*.css' --include='*.less' --include='*.ts' --include='*.tsx' | grep -v dist`
Expected: no output. If anything prints, stop and report — the alias is live and this task's premise is wrong.

- [x] **Step 2: Delete the declarations**

In `apps/site/canvas-kit-demo.css`, delete these five lines:

```css
  --wzl-track-bg: var(--ckd-surface-2);
  --wzl-track-border: var(--ckd-border-2);
  --wzl-thumb-fill: var(--ckd-muted);
  --wzl-thumb-border: var(--ckd-border);
  --wzl-thumb-text: #000;
```

- [x] **Step 3: Drop them from the Foundations listing**

In `Foundations.stories.tsx`, in the `'Deprecated aliases'` entry, delete these two lines:

```tsx
      '--wzl-track-bg', '--wzl-track-border',
      '--wzl-thumb-fill', '--wzl-thumb-border', '--wzl-thumb-text',
```

- [x] **Step 4: Fix the false comment**

In `Slider.module.css`, replace:

```css
  /* Thumb text reads against `--wzl-thumb-fill`, which can differ from the
     surrounding panel text color. Default = dark; consumers re-skin via
     `--wzl-thumb-text` if they pick a dark thumb fill. */
  color: var(--wzl-fg-inverse);
```

with:

```css
  color: var(--wzl-fg-inverse);
```

- [x] **Step 5: Typecheck and test**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui`
Expected: PASS

- [x] **Step 6: Commit**

```bash
git add apps/site/canvas-kit-demo.css packages/ui/src/components/Foundations/Foundations.stories.tsx packages/ui/src/components/Slider/Slider.module.css
git commit -m "delete five slider tokens nothing read"
```

---

### Task 3: The shared range module

**Files:**
- Create: `packages/ui/src/components/range.module.css`
- Create: `packages/ui/src/components/range.test.tsx`
- Modify: `packages/ui/src/components/InlineRange/InlineRange.module.css`
- Modify: `packages/ui/src/components/InlineRange/InlineRange.tsx`

- [x] **Step 1: Write the failing test**

Create `packages/ui/src/components/range.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InlineRange } from './InlineRange/InlineRange';
import shared from './range.module.css';

// CSS modules are not processed in the `weasel-ui` vitest project, so these
// assert the contract — that the shared class is applied — not the pixels.
// The look is checked by screenshot.
describe('shared range skin', () => {
  it('InlineRange wears the shared range class', () => {
    const { container } = render(<InlineRange value={50} onChange={() => {}} />);
    const input = container.querySelector('input[type="range"]');
    expect(input).not.toBeNull();
    expect(input?.className.split(' ')).toContain(shared.range);
  });

  it('InlineRange keeps a caller className alongside it', () => {
    const { container } = render(
      <InlineRange value={50} className="mine" onChange={() => {}} />,
    );
    const cls = container.querySelector('input[type="range"]')?.className.split(' ') ?? [];
    expect(cls).toContain(shared.range);
    expect(cls).toContain('mine');
  });
});
```

- [x] **Step 2: Run it to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/range.test.tsx`
Expected: FAIL — cannot resolve `./range.module.css`.

- [x] **Step 3: Create the shared module**

Create `packages/ui/src/components/range.module.css`:

```css
/* The one skin for a native <input type="range">. Imported by InlineRange and
   by the property rows, which render the same DOM and used to carry three
   independently authored copies of these rules.

   The track is painted here rather than left to `accent-color`: a UA fills the
   left of the track with the accent but draws the remainder near-white on a
   dark surface whatever `color-scheme` says, and overriding the track's
   background removes the accent fill instead of recolouring the remainder. */
.range {
  appearance: none;
  -webkit-appearance: none;
  width: 100%;
  min-inline-size: 48px;
  /* The box is taller than the track so the thumb has room to spill; a surface
     where the element itself IS the track overrides this. */
  height: var(--wzl-range-box-h, 12px);
  margin: 0;
  padding: 0;
  /* Default keeps the element out of the way so the track pseudo-element shows;
     a surface that paints the element itself sets this. */
  background: var(--wzl-range-bg, transparent);
  cursor: pointer;
}

.range::-webkit-slider-runnable-track {
  height: var(--wzl-slider-track-h);
  border-radius: var(--wzl-radius-sm);
  background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-track-tint), transparent);
}

.range::-moz-range-track {
  height: var(--wzl-slider-track-h);
  border-radius: var(--wzl-radius-sm);
  background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-track-tint), transparent);
}

.range::-webkit-slider-thumb {
  appearance: none;
  -webkit-appearance: none;
  width: var(--wzl-slider-thumb-size);
  height: var(--wzl-slider-thumb-size);
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-thumb-tint), transparent);
  /* Centres an 8px thumb on a 4px track. Webkit does not centre it for you. */
  margin-top: calc((var(--wzl-slider-track-h) - var(--wzl-slider-thumb-size)) / 2);
}

.range::-moz-range-thumb {
  width: var(--wzl-slider-thumb-size);
  height: var(--wzl-slider-thumb-size);
  border: none;
  border-radius: 50%;
  background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-thumb-tint), transparent);
}

.range:focus-visible {
  outline: 2px solid var(--wzl-focus-ring);
  outline-offset: 2px;
}

.range:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

/* Alpha variant: a fainter track, used where the row already carries a colour
   swatch and the slider must not compete with it. */
.alpha::-webkit-slider-runnable-track {
  background: color-mix(in srgb, var(--wzl-accent) 10%, transparent);
}

.alpha::-moz-range-track {
  background: color-mix(in srgb, var(--wzl-accent) 10%, transparent);
}

/* A dead alpha track keeps its groove but loses its thumb, so the affordance
   reads inert rather than merely dimmed. Keyed off `:disabled`, which ColorRow
   already sets on the input — not off a class on the row. */
.alpha:disabled::-webkit-slider-runnable-track,
.alpha:disabled::-moz-range-track {
  background: color-mix(in srgb, var(--wzl-fg) 5%, transparent);
}

.alpha:disabled::-webkit-slider-thumb,
.alpha:disabled::-moz-range-thumb {
  background: transparent;
}
```

- [x] **Step 4: Point InlineRange at it**

Replace the whole of `packages/ui/src/components/InlineRange/InlineRange.module.css` with:

```css
/* Track and thumb come from the shared range skin. What is local to
   InlineRange is the filled-to-N% paint, which no other surface has:
   `--slider-fill` carries the value, since no static rule expresses it. */
.range {
  flex: 1;
  --wzl-range-bg: linear-gradient(
    to right,
    var(--wzl-accent) 0 var(--slider-fill, 0%),
    var(--wzl-border-strong) var(--slider-fill, 0%) 100%
  );
  --wzl-range-box-h: var(--wzl-slider-track-h);
  /* The gradient above IS the track, so the shared track paint must not land on top of it. */
  --wzl-range-track-bg: transparent;
  border-radius: var(--wzl-radius-pill);
}
```

**Why variables and not overriding declarations.** InlineRange is the only surface
where the element *itself* is the painted track, so it disagrees with the shared
module about `height`, `background`, and the track pseudo-element's `background`. Each
disagreement, written as a competing declaration, would be two rules at (0,1,0) across
a file boundary — resolved by stylesheet emission order, not by intent, and silently
broken by a bundler reordering imports. Routing each through a variable leaves one
declaration to win. The result is **zero selector overlap between the two files**:
local declares `.range` and nothing else.

The shared module's track rules therefore read
`background: var(--wzl-range-track-bg, color-mix(…))` rather than the `color-mix()`
directly.

In `InlineRange.tsx`, add the shared import and put it first in the class list:

```tsx
import { type CSSProperties, type InputHTMLAttributes, type ReactElement } from 'react';
import shared from '../range.module.css';
import s from './InlineRange.module.css';
```

and change the `className` line to:

```tsx
      className={[shared.range, s.range, className].filter(Boolean).join(' ')}
```

- [x] **Step 5: Run the test to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/range.test.tsx`
Expected: PASS, 2 tests

- [x] **Step 6: Run the full ui suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui`
Expected: PASS

- [~] **Step 7: Screenshot check** — deferred to the consolidated visual pass

Run `npm run dev:storybook`, open the `InlineRange` story, and check it in both modes by setting `data-wzl-mode="light"` then `"dark"` on the story root in devtools. The thumb is now 8px and 70% accent (it was 12px solid); the fill gradient is unchanged.

- [x] **Step 8: Commit**

```bash
git add packages/ui/src/components/range.module.css packages/ui/src/components/range.test.tsx packages/ui/src/components/InlineRange
git commit -m "give the kit one native-range skin and put InlineRange on it"
```

---

### Task 4: Property rows onto the shared skin

**Files:**
- Modify: `packages/ui/src/components/Properties/Properties.module.css:224-266` (slider), `:401-438` (alpha)
- Modify: `packages/ui/src/components/Properties/PropertyPanel.tsx` (`SliderRow` ~`:231`, `ColorRow` ~`:363`)
- Modify: `packages/ui/src/components/range.test.tsx`

- [x] **Step 1: Extend the test**

Append to `packages/ui/src/components/range.test.tsx`, inside the existing `describe`:

```tsx
  it('SliderRow wears the shared range class', async () => {
    const { SliderRow } = await import('./Properties/PropertyPanel');
    const { container } = render(
      <SliderRow label="Bevel" value={5} min={0} max={10} step={1} onChange={() => {}} />,
    );
    const input = container.querySelector('input[type="range"]');
    expect(input?.className.split(' ')).toContain(shared.range);
  });

  it('ColorRow alpha wears the shared range and alpha classes', async () => {
    const { ColorRow } = await import('./Properties/PropertyPanel');
    const { container } = render(
      <ColorRow label="Fill" value="#3b82f6" alpha={1} onChange={() => {}} onAlphaChange={() => {}} />,
    );
    const cls = container.querySelector('input[type="range"]')?.className.split(' ') ?? [];
    expect(cls).toContain(shared.range);
    expect(cls).toContain(shared.alpha);
  });

  it('a disabled alpha track stays disabled on the input', () => {
    // The inert treatment is keyed off :disabled in the shared module, so the
    // prop has to keep reaching the element and not only the row's class.
    const { container } = render(
      <ColorRow
        label="Fill"
        value="#3b82f6"
        alpha={1}
        alphaDisabled
        onChange={() => {}}
        onAlphaChange={() => {}}
      />,
    );
    expect(container.querySelector('input[type="range"]')).toBeDisabled();
  });
```

- [x] **Step 2: Run to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/range.test.tsx`
Expected: FAIL on the two new cases — the range inputs carry no shared class.

- [x] **Step 3: Apply the class in PropertyPanel.tsx**

Add the import beside the existing `s`:

```tsx
import shared from '../range.module.css';
```

In `SliderRow`, the range input gains a className:

```tsx
      <input
        type="range"
        className={shared.range}
        tabIndex={-1}
        min={min}
        max={max}
        step={step}
        value={value}
```

In `ColorRow`, the alpha input's `className` is `s.alpha` today; make it:

```tsx
          className={`${shared.range} ${shared.alpha} ${s.alpha}`}
```

`s.alpha` stays because it carries the grid placement. The inert treatment needs no
class here — `disabled={alphaDisabled}` is already on this input, and the shared
module keys off `:disabled`.

- [x] **Step 4: Delete the superseded CSS**

In `Properties.module.css`, delete the block from `.row input[type='range'] {` through the closing brace of `.row input[type='range']::-moz-range-thumb` (lines ~224-266), and the alpha track/thumb rules at ~409-438 — `.rowColor input[type='range'].alpha::-webkit-slider-runnable-track` and everything through the last `.rowColor.alphaDisabled ... ::-moz-range-thumb`.

**Keep** these — they are layout, not skin, and the shared module does not carry them:

```css
.row:has(> input[type='range']) { justify-content: flex-end; }
.row:has(> input[type='range']) > .rowLabel { align-items: baseline; justify-content: space-between; gap: 4px; margin-bottom: -4px; }
.row > input[type='range'] { margin-top: auto; }
.rowInline input[type='range'] { width: auto; }
.rowColor input[type='range'].alpha { grid-column: 1 / -1; grid-row: 2; height: 12px; width: 100%; margin: 0; }
```

Also delete `.rowColor.alphaDisabled input[type='range'].alpha { cursor: not-allowed; opacity: 0.55; }` — the shared `.range:disabled` rule says the same thing and reaches the element directly. Check whether `s.alphaDisabled` still has any other rule before removing the class from `ColorRow`; if it does not, leave the class in place anyway, since it is the row-level hook a consumer may style.

- [x] **Step 5: Run to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/range.test.tsx`
Expected: PASS, 4 tests

- [x] **Step 6: Full suite, typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui && npx vitest run --project=labkit`
Expected: PASS

- [~] **Step 7: Screenshot check** — deferred to the consolidated visual pass at the end of the plan; Storybook not started for this task.

Storybook: `Properties/Gallery`, `Properties/SliderRow`, `Properties/SpeechBalloonPanels`. Both modes. The rows should look **unchanged** — this task moves where the rules live, not what they say. A visible difference means the shared module's values drifted from the originals.

- [x] **Step 8: Commit**

```bash
git add packages/ui/src/components/Properties packages/ui/src/components/range.test.tsx
git commit -m "put the property rows on the shared range skin"
```

**Cascade finding (deviation from the KEEP list above):** `.row > input[type='range'] { margin-top: auto; }`
was also deleted. It and the old `.row input[type='range'] { margin: 0 }` were both (0,2,1), so the later
`margin: 0` won and `margin-top: auto` was dead. Moving the skin to the (0,1,0) `.range` class would have
resurrected it. Measured in Chrome on a stretched row: `margin-top` `0px` before vs `45.5px` after, moving
the label to the row top. `justify-content: flex-end` already bottom-aligns the track, which is what the
comment above that block claims, so nothing was lost.

---

### Task 5: labkit's bare-range default

A bare `<input type="range">` inside `.lk-root` currently gets `accent-color` and native chrome. Safe to skin at zero specificity: every kit range surface sets `appearance: none` and its own pseudo-elements above it.

**Files:**
- Modify: `packages/labkit/src/theme/base.less:69-71`

- [x] **Step 1: Replace the rule**

Replace:

```less
  :where(input[type="range"]) {
    accent-color: var(--wzl-accent);
  }
```

with:

```less
  // Mirrors packages/ui/src/components/range.module.css so a consumer's bare
  // range matches the kit's. A weasel-ui component's own module class outranks
  // this, which is what keeps InlineRange's gradient track intact.
  :where(input[type="range"]) {
    appearance: none;
    -webkit-appearance: none;
    height: 12px;
    background: transparent;
    cursor: pointer;

    &::-webkit-slider-runnable-track {
      height: var(--wzl-slider-track-h);
      border-radius: var(--wzl-radius-sm);
      background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-track-tint), transparent);
    }

    &::-moz-range-track {
      height: var(--wzl-slider-track-h);
      border-radius: var(--wzl-radius-sm);
      background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-track-tint), transparent);
    }

    &::-webkit-slider-thumb {
      appearance: none;
      -webkit-appearance: none;
      width: var(--wzl-slider-thumb-size);
      height: var(--wzl-slider-thumb-size);
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-thumb-tint), transparent);
      margin-top: calc((var(--wzl-slider-track-h) - var(--wzl-slider-thumb-size)) / 2);
    }

    &::-moz-range-thumb {
      width: var(--wzl-slider-thumb-size);
      height: var(--wzl-slider-thumb-size);
      border: none;
      border-radius: 50%;
      background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-thumb-tint), transparent);
    }
  }
```

- [x] **Step 2: Test and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=labkit`
Expected: PASS

- [~] **Step 3: Screenshot check**

Storybook: any labkit lab story. Confirm `InlineRange` inside a lab still shows its gradient fill — if the bare rule has flattened it, the `:where()` specificity assumption is wrong and this task must be scoped to `input[type=range]:not([class])` instead. Check both modes.

- [x] **Step 4: Commit**

```bash
git add packages/labkit/src/theme/base.less
git commit -m "skin a bare range input in labkit, not just its accent color"
```

---

### Task 6: `Slider` density, and `ZoomControl` wearing it

`ZoomControl` passes no `trackHeight`, so it inherits `Slider`'s 24px canvas track and looks nothing like a property row.

**Files:**
- Modify: `packages/ui/src/components/Slider/Slider.tsx:83-103` (props), `:481` (root style)
- Modify: `packages/ui/src/components/Slider/Slider.module.css` (`.thumb` width)
- Create: `packages/ui/src/components/Slider/Slider.density.test.tsx`
- Modify: `packages/labkit/src/primitives/ZoomControl.tsx:45`

- [x] **Step 1: Write the failing test**

Create `packages/ui/src/components/Slider/Slider.density.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Slider } from './Slider';
import s from './Slider.module.css';

const base = {
  min: 0,
  max: 10,
  thumbs: [{ value: 5 }],
  onInput: () => {},
};

describe('Slider density', () => {
  it('sets no track or thumb var by default', () => {
    const { container } = render(<Slider {...base} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('');
  });

  it('drives both vars and marks itself slim', () => {
    const { container } = render(<Slider {...base} density="slim" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('var(--wzl-slider-track-h)');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('var(--wzl-slider-thumb-size)');
    expect(root.className.split(' ')).toContain(s.slim);
  });

  it('lets an explicit trackHeight win over the density', () => {
    const { container } = render(<Slider {...base} density="slim" trackHeight={20} />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('20px');
  });
});
```

- [x] **Step 2: Run to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Slider/Slider.density.test.tsx`
Expected: FAIL — `density` is not a prop; the slim cases get `''`.

- [x] **Step 3: Add the prop**

In `Slider.tsx`, add to `SliderProps` after `trackHeight`:

```tsx
  trackHeight?: number;
  /** `'slim'` drives the track and thumb from the kit's slider tokens, so a
   *  Slider matches the property rows. `trackHeight` still wins if given. */
  density?: 'default' | 'slim';
```

Destructure it at `:194`:

```tsx
  const { thumbs, onInput, onChange, min, max, step, constraint, trackHeight, density, ariaLabel, className } = props;
```

Above the `return`, build the root's class and style:

```tsx
  const slim = density === 'slim';
  const rootVars: Record<string, string> = {};
  if (slim) {
    rootVars['--rp-track-height'] = 'var(--wzl-slider-track-h)';
    rootVars['--rp-thumb-size'] = 'var(--wzl-slider-thumb-size)';
  }
  // An explicit trackHeight wins: a caller who named a number meant it.
  if (trackHeight !== undefined) rootVars['--rp-track-height'] = `${trackHeight}px`;
  const rootClass = [s.root, slim && s.slim, className].filter(Boolean).join(' ');
```

and replace the root `<div>`'s `className` and `style` at `:479-482` with:

```tsx
    <div
      className={rootClass}
      style={Object.keys(rootVars).length > 0 ? (rootVars as CSSProperties) : undefined}
    >
```

- [x] **Step 4: Make the thumb read the var**

In `Slider.module.css`, in `.thumb`, replace:

```css
  width: 14px;
  margin-left: -7px;
```

with:

```css
  width: var(--rp-thumb-size, 14px);
  margin-left: calc(var(--rp-thumb-size, 14px) / -2);
```

and, so a slim thumb reads as a dot rather than a bar, add after the `.thumb` block:

```css
/* A slim slider's thumb is round and flush with the track, matching the
   property rows. The default thumb keeps its 2px spill and rounded-rect face. */
.slim .thumb {
  top: 50%;
  bottom: auto;
  height: var(--rp-thumb-size);
  transform: translateY(-50%);
  border-radius: 50%;
  border: none;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
  box-shadow: none;
  background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-thumb-tint), transparent);
}
```

- [x] **Step 5: Run to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Slider/Slider.density.test.tsx`
Expected: PASS, 3 tests

- [x] **Step 6: Put ZoomControl on it**

In `packages/labkit/src/primitives/ZoomControl.tsx`, add `density="slim"` to the `<Slider>`:

```tsx
      <Slider
        className="lk-zoom__slider"
        ariaLabel="Zoom"
        density="slim"
        min={toTrack(min)}
        max={toTrack(max)}
```

- [x] **Step 7: Full suites, typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui && npx vitest run --project=labkit`
Expected: PASS

- [~] **Step 8: Screenshot check**

Storybook: the `Slider` and `GradientEditor` stories must be **unchanged** (no `density`), and any lab story with a zoom control now shows a 4px track with a small round thumb. Both modes.

- [x] **Step 9: Commit**

```bash
git add packages/ui/src/components/Slider packages/labkit/src/primitives/ZoomControl.tsx
git commit -m "give Slider a slim density and put the zoom control on it"
```

---

### Task 7: One field height, set by the container

Today: 24px RAC frames (22px inside `.lk-toolbar`), 20px property rows via a `--wzl-prop-field-height` that nothing ever sets. After: everything reads `var(--wzl-field-h, var(--wzl-control-h))`, and the property list declares its own density. The fallback form is load-bearing — it resolves per element, so `.lk-toolbar`'s 22px still reaches its fields. Do **not** add a `--wzl-field-h` token with a `:root` default.

**Files:**
- Modify: `packages/ui/src/components/{Input,NumberField,ComboBox}/*.module.css` (`.frame`)
- Modify: `packages/ui/src/components/Properties/Properties.module.css` (`.list`, the text/number rules, `.row select`)

- [x] **Step 1: Frames read the field vars**

In each of `Input/Input.module.css`, `NumberField/NumberField.module.css` and `ComboBox/ComboBox.module.css`, in `.frame`, replace:

```css
  height: var(--wzl-control-h);
```

with:

```css
  height: var(--wzl-field-h, var(--wzl-control-h));
```

In `Input.module.css` only, `.frame` also has `padding: 0 8px` — replace with:

```css
  padding: 0 var(--wzl-field-pad-x);
```

In `NumberField.module.css` and `ComboBox.module.css` the padding is on `.frame input` as `padding: 0 8px` — replace both with:

```css
  padding: 0 var(--wzl-field-pad-x);
```

- [x] **Step 2: The property list declares its density**

In `Properties.module.css`, add to the `.list` rule:

```css
.list {
  display: grid;
  grid-template-columns: 1fr 1fr;
  column-gap: 10px;
  row-gap: 4px;
  align-items: stretch;
  /* A property panel is dense: its fields are shorter and tighter than a
     standalone Input. Set here, on the container, so one declaration moves
     every field in the panel. */
  --wzl-field-h: 20px;
  --wzl-field-pad-x: 6px;
}
```

- [x] **Step 3: Retire `--wzl-prop-field-height`**

In `Properties.module.css`, in the `.row input[type='text']:not(.readoutInput), .row input[type='number']` rule, replace:

```css
  height: var(--wzl-prop-field-height, 20px);
  padding: 0 6px;
```

with:

```css
  height: var(--wzl-field-h, var(--wzl-control-h));
  padding: 0 var(--wzl-field-pad-x);
```

and in `.row select`, replace `height: var(--wzl-prop-field-height, 20px);` with `height: var(--wzl-field-h, var(--wzl-control-h));`.

- [x] **Step 3b: Right-align numeric fields**

`NumberRow` is the only numeric field in the kit that is not right-aligned — `NumberField`'s inner input and the `.readoutInput` beside a slider both already are. So a labkit control panel renders a column of numbers that do not line up. Add to `Properties.module.css`, after the shared text/number rule:

```css
/* Numbers right-align so a column of them shares a decimal position; text does
   not, so this cannot live in the rule the two share. */
.row input[type='number'] {
  text-align: right;
}
```

Do NOT add `text-align` to the shared `.row input[type='text']:not(.readoutInput), .row input[type='number']` rule — that would right-align text fields too.

Check afterwards that `.row input[type='number']` is not also declared in `range.module.css` (it will not be — that file only styles `input[type='range']`), and that this is the only `text-align` declaration reaching the element.

- [x] **Step 4: Confirm nothing still reads the retired name**

Run: `grep -rn 'wzl-prop-field-height' packages apps --include='*.css' --include='*.less' --include='*.ts' --include='*.tsx' | grep -v dist`
Expected: no output.

- [x] **Step 5: Test and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui && npx vitest run --project=labkit`
Expected: PASS

- [~] **Step 6: Screenshot check**

Three things to look at, both modes:
1. `Properties/Gallery` — rows should be **unchanged** at 20px, except that numeric fields now right-align.
2. A labkit `ControlPanel` story — a column of numeric rows should share a right edge.
3. A labkit toolbar story containing a `NumberField` — should still be 22px, proving the `var(--wzl-field-h, var(--wzl-control-h))` fallback resolves per element. If it went to 24px, someone declared `--wzl-field-h` at `:root`; remove that.

- [x] **Step 7: Commit**

```bash
git add packages/ui/src/components/Input packages/ui/src/components/NumberField packages/ui/src/components/ComboBox packages/ui/src/components/Properties
git commit -m "size every boxed field from one container-set height"
```

---

### Task 8: One focus rule for the boxed family

Four treatments today: `border-color` + `box-shadow` (RAC frames), a bare `outline` (property rows), a background swap (ghost readout), nothing (color chip). The RAC treatment wins — it already handles the invalid state and does not disturb layout.

**Files:**
- Modify: `packages/ui/src/components/Properties/Properties.module.css`
- Modify: `packages/ui/src/components/ColorField/ColorField.module.css`

- [x] **Step 1: Property rows adopt it**

Replace:

```css
.row input[type='text']:not(.readoutInput):focus,
.row input[type='number']:focus {
  outline: 1px solid var(--wzl-accent);
}
```

with:

```css
.row input[type='text']:not(.readoutInput):focus,
.row input[type='number']:focus {
  outline: none;
  border-color: var(--wzl-focus-ring);
  box-shadow: 0 0 0 1px var(--wzl-focus-ring);
}
```

- [x] **Step 2: The ghost readout sources the ring colour**

In `.readoutInput:focus`, replace `border-color: var(--wzl-accent);` with `border-color: var(--wzl-focus-ring);`. Keep `background: var(--wzl-surface-sunken);` — the fill is the ghost's affordance and is not a focus ring.

- [x] **Step 3: The colour chip gains one**

In `ColorField.module.css`, after the `.color` rule, add:

```css
.color:focus-visible {
  outline: none;
  border-color: var(--wzl-focus-ring);
  box-shadow: 0 0 0 1px var(--wzl-focus-ring);
}
```

- [~] **Step 4: Test and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui`
Expected: PASS

CSS-only change; controller instructed `npx tsc --noEmit` only (PASS) and no suite run — CSS modules aren't compiled by the `weasel-ui` vitest project, so it can't observe a stylesheet edit.

- [~] **Step 5: Screenshot check**

Tab through `Properties/Gallery` and the `ColorField` story in both modes. Every boxed field should show the same 1px ring. This is the one task in the plan that deliberately changes how the property rows look.

Skipped — controller instructed not to start Storybook.

- [x] **Step 6: Commit**

```bash
git add packages/ui/src/components/Properties/Properties.module.css packages/ui/src/components/ColorField/ColorField.module.css
git commit -m "give every boxed field the same focus ring"
```

---

### Task 9: `NumberField`'s ghost variant

`hideSteppers` removes the stepper column but leaves the sunken box painted, so `ZoomControl`'s readout cannot match a property row's.

**Files:**
- Modify: `packages/ui/src/components/NumberField/NumberField.tsx`
- Modify: `packages/ui/src/components/NumberField/NumberField.module.css`
- Create: `packages/ui/src/components/NumberField/NumberField.ghost.test.tsx`
- Modify: `packages/labkit/src/primitives/ZoomControl.tsx`

- [x] **Step 1: Write the failing test**

Create `packages/ui/src/components/NumberField/NumberField.ghost.test.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberField } from './NumberField';
import s from './NumberField.module.css';

describe('NumberField ghost', () => {
  it('paints the frame by default', () => {
    const { container } = render(<NumberField aria-label="n" value={1} onChange={() => {}} />);
    const frame = container.querySelector(`.${s.frame}`);
    expect(frame).not.toBeNull();
    expect(frame?.className.split(' ')).not.toContain(s.ghost);
  });

  it('adds the ghost class when asked', () => {
    const { container } = render(
      <NumberField aria-label="n" value={1} ghost onChange={() => {}} />,
    );
    const frame = container.querySelector(`.${s.frame}`);
    expect(frame?.className.split(' ')).toContain(s.ghost);
  });
});
```

- [x] **Step 2: Run to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/NumberField/NumberField.ghost.test.tsx`
Expected: FAIL — `ghost` is not a prop.

- [x] **Step 3: Add the prop**

In `NumberField.tsx`, add to `NumberFieldProps` after `hideSteppers`:

```tsx
  /** Hide the up/down stepper buttons. Defaults to false. */
  hideSteppers?: boolean;
  /** Render with no box until focused — the readout treatment the property
   *  rows use, for a value that sits inside other chrome rather than in a form. */
  ghost?: boolean;
```

Destructure it and apply the class:

```tsx
  const { label, description, errorMessage, hideSteppers, ghost, placeholder, className, ...rest } = props;
```

```tsx
      <Group className={ghost ? `${s.frame} ${s.ghost}` : s.frame}>
```

- [x] **Step 4: Add the styles**

Append to `NumberField.module.css`:

```css
/* Reads as a value until you touch it. Mirrors the property rows' editable
   readout, so a number sitting inside other chrome does not draw a second box
   around itself. */
.ghost {
  height: auto;
  background: transparent;
  border-color: transparent;
  color: var(--wzl-accent);
  font-weight: var(--wzl-font-weight-medium);
}

.ghost input {
  padding: 1px 0;
}

.ghost:hover {
  background: color-mix(in srgb, currentColor 8%, transparent);
}

.ghost:focus-within {
  background: var(--wzl-surface-sunken);
  border-color: var(--wzl-focus-ring);
  box-shadow: none;
}
```

- [x] **Step 5: Run to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/NumberField/NumberField.ghost.test.tsx`
Expected: PASS, 2 tests

- [x] **Step 6: Put ZoomControl's readout on it**

In `ZoomControl.tsx`, add `ghost` beside `hideSteppers`:

```tsx
      <NumberField
        className="lk-zoom__field"
        aria-label="Zoom"
        value={zoom}
        minValue={min}
        maxValue={max}
        step={0.01}
        hideSteppers
        ghost
```

- [x] **Step 7: Full suites, typecheck**

Run: `npx tsc --noEmit` plus the focused file. Full suites are the arc's single closing sweep.
Expected: PASS

- [~] **Step 8: Screenshot check** (skipped — deferred to the arc's closing pass)

Storybook: a lab story with a zoom control. The percentage should read as accent-coloured text with no box, filling on hover and focus. Both modes.

- [x] **Step 9: Commit**

```bash
git add packages/ui/src/components/NumberField packages/labkit/src/primitives/ZoomControl.tsx
git commit -m "give NumberField a ghost variant and use it for zoom"
```

---

### Task 10: `MarkList`'s title input

The only bare `<input type="text">` in labkit. It gets no rule anywhere, so it renders UA chrome — and it does not inherit the Oswald face, because the UA sets `font: -webkit-small-control`.

**Files:**
- Modify: `packages/labkit/src/annotations/MarkList.tsx`
- Modify: `packages/labkit/src/annotations/Annotations.less`

- [x] **Step 1: Check for an existing test**

Run: `grep -rn 'lk-mark-list__title\|Title of' packages/labkit/src --include='*.test.tsx'`

If a test queries by the `lk-mark-list__title` class, it must keep passing — `<Input>` accepts `className`, so pass it through. If it queries by the `Title of …` aria-label, that is preserved by `aria-label` below.

- [x] **Step 2: Swap the element**

In `MarkList.tsx`, add the import:

```tsx
import { Input } from '../passthrough/weasel-ui';
```

Confirm `Input` is re-exported there first: `grep -n 'Input' packages/labkit/src/passthrough/weasel-ui.ts`. If it is not, add it to that file the way `NumberField` and `Slider` are.

Replace the bare input:

```tsx
            <Input
              className="lk-mark-list__title"
              aria-label={`Title of ${a.kind} on ${a.target}`}
              value={a.title ?? ''}
              placeholder="Untitled"
              onChange={(next) => marks.update(a.id, { title: next })}
            />
```

`Input` wraps React Aria's `TextField`, whose `onChange` hands you the **string**, not an event. That is the one behavioural difference from the bare element — do not write `e.target.value`.

- [x] **Step 3: Give the class a layout-only rule**

In `Annotations.less`, beside the other `.lk-mark-list__*` rules, add:

```less
// Box and typography come from <Input>. This only says how the field shares
// the row.
.lk-mark-list__title {
  width: 100%;
}
```

- [x] **Step 4: Test and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=labkit`
Expected: PASS

- [~] **Step 5: Screenshot check**

Storybook: the labkit annotations story. The title field should now match the kit's other inputs. Both modes.

- [x] **Step 6: Commit**

```bash
git add packages/labkit/src/annotations
git commit -m "render a mark's title with the kit's Input"
```

---

### Task 11: Changeset

**Files:**
- Create: `.changeset/control-skin-unification.md`

- [x] **Step 1: Write it**

```markdown
---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

One skin for the kit's sliders and fields.

Adds `--wzl-slider-track-h`, `--wzl-slider-thumb-size`, `--wzl-slider-track-tint`,
`--wzl-slider-thumb-tint` and `--wzl-field-pad-x`. A new shared `range.module.css`
gives `InlineRange` and the property rows one native-range skin instead of three
hand-authored copies; a bare `<input type="range">` inside `.lk-root` now wears it
too.

`Slider` gains `density="slim"`, which drives its track and thumb from those tokens;
`ZoomControl` uses it. `NumberField` gains `ghost`, the transparent-until-focused
readout the property rows already had.

Boxed fields size from `var(--wzl-field-h, var(--wzl-control-h))` — set
`--wzl-field-h` on a container to change a whole panel's density. `PropertyList`
sets its own, so property rows keep their 20px look.

`NumberRow` right-aligns its value, so a column of numeric property rows shares a
decimal position. `NumberField` and the slider readout already did.

Behaviour changes worth knowing: `InlineRange`'s thumb is 8px and translucent rather
than 12px and solid; every boxed field now focuses with the 1px ring the React Aria
fields already used, replacing the property rows' bare outline; and the colour chip
has a focus ring where it previously had none.

Removes `--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`,
`--wzl-thumb-border` and `--wzl-thumb-text`, which nothing read.
```

Every changeset in this repo is `patch`. Do not write `minor` or `major`, and do not write a `bump-approved` marker — that needs Mike's explicit OK in conversation, every time.

- [x] **Step 2: Verify the bump check passes**

Run: `npm run check:bumps`
Expected: PASS

- [x] **Step 3: Commit**

```bash
git add .changeset/control-skin-unification.md
git commit -m "add a changeset for the control skin work"
```

---

### Task 12: speech-balloons

**Different repo:** `~/src/experiments/speech-balloons`. It consumes labkit through a symlink at `node_modules/@weasel-js/labkit → ../../weasel/packages/labkit`, and resolves labkit's **`dist`** — so run `npm run build -w @weasel-js/labkit` (and the theme + ui builds it depends on) in the worktree before expecting changes to show, or point the symlink at this worktree.

Its `workspace`→`trial` migration is already committed (`f6889d9`); it boots against a current labkit.

**Files:**
- Modify: `~/src/experiments/speech-balloons/src/Lab.tsx`
- Modify: `~/src/experiments/speech-balloons/src/styles.css`

- [ ] **Step 1: Replace the zoom bar**

In `Lab.tsx`, the `.sb-zoom-bar` block (~`:692-707`) is a hand-rolled label, −/+ buttons, bare range, readout, `1:1` and `Fit`. Replace the label, buttons, range and readout with `<ZoomControl>`, keeping `1:1` and `Fit` — `ZoomControl` owns only the continuous part.

```tsx
            <div className="sb-zoom-bar">
              <ZoomControl
                zoom={view.zoom}
                min={0.1}
                max={4}
                onZoomChange={(z) => store.updateTrialView('balloon', { ...view, zoom: z })}
              />
              <button type="button" onClick={() => store.updateTrialView('balloon', { ...view, zoom: 1 })} title="Reset to 100%">1:1</button>
              <button type="button" onClick={fitZoomToStage} title="Fit content to viewport">Fit</button>
            </div>
```

Add `ZoomControl` to the existing `@weasel-js/labkit` import block at the top of the file.

`ZoomControl`'s slider is log2-scaled with detents at the octaves, so zoom no longer moves linearly under the thumb. That is the intended behaviour and is why the −/+ buttons go: the detents reach 25/50/100/200/400% by drag.

- [ ] **Step 2: Replace the toolbar's font select**

There are exactly two `.sb-field` sites, at `:546` and `:568`. Only the first has a property-row equivalent.

Replace the `:546` block:

```tsx
          <label className="sb-field">
            <span>Font</span>
            <select
              value={runtime.fontFamily}
              onChange={(e) => setRuntime((r) => ({ ...r, fontFamily: e.target.value }))}
            >
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
```

with:

```tsx
          <SelectRow
            label="Font"
            value={runtime.fontFamily}
            options={FONT_OPTIONS}
            onChange={(v) => setRuntime((r) => ({ ...r, fontFamily: v }))}
          />
```

`SelectRow`'s `options` takes `ReadonlyArray<{ value: T; label: ReactNode }>`, which is the shape `FONT_OPTIONS` already has — check it before assuming, and map it if not.

The `:568` site is a multi-line `<textarea rows={2}>`. `TextRow` is single-line and there is no multi-line property row, so **leave it and `.sb-field-text` / `.sb-text-multiline` alone**.

Update the comment above `:546`, which currently claims all three fields keep raw HTML — after this only the textarea and the checkboxes do:

```tsx
          {/* The multi-line text area and the checkboxes keep raw HTML: there is
              no multi-line property row, and a checkbox here is a toolbar toggle
              rather than a labelled panel row. */}
```

- [ ] **Step 3: Delete the superseded CSS**

In `styles.css`, delete:
- the whole `/* ── Sliders ── */` section (the bare `input[type=range]` block and its four pseudo-element rules) — the kit now provides this;
- `.sb-zoom-bar .sb-zoom-slider`, `.sb-zoom-bar .sb-zoom-readout` and `.sb-zoom-bar .sb-zoom-label`;
- `select` from the `.sb-field select, .sb-field input[type=text], .sb-field textarea` selector list, and `select:focus` from the `:focus` rule below it.

Keep, because the textarea site still uses them: `.sb-field`, `.sb-field > span`, `.sb-field-text .sb-text-multiline`, and the trimmed rules above. Keep `.sb-zoom-bar` itself — it is the strip's layout — and its `button` rules, which still style `1:1` and `Fit`.

- [ ] **Step 4: Verify it runs**

The dev server is already up on <http://localhost:5180/>. Load it, confirm no console errors, and confirm the zoom bar and toolbar now match the property panels.

- [ ] **Step 5: Screenshot check**

Capture the full window and compare against the pre-change reference. The property panels must be unchanged; the zoom bar and toolbar should now match them.

- [ ] **Step 6: Commit (in the speech-balloons repo)**

```bash
cd ~/src/experiments/speech-balloons
git add src/Lab.tsx src/styles.css
git commit -m "use the kit's zoom control and select row"
```

**Unrelated bug, do not fix here:** `.sb-checkbox` sets `color: var(--fg-muted)` (`#aaa`), which is invisible against the light toolbar the app currently renders — the three checkbox labels in the top strip read as bare squares. Note it and move on.

---

### Task 13: A unit suffix on `NumberRow`

`SliderRow` takes `unit?: ReactNode` and renders it as a dim suffix beside its readout. `NumberRow` takes none, so a number typed directly carries no indication of what it measures — the same value is `20` in one row and `20 px` in the row above it. Give the typed number the same affordance.

Display only: `unit` never participates in parsing, and the value stays a number. It sits after the input rather than inside it, so the field keeps its own box and the digits keep the full width they had.

**Files:**
- Modify: `packages/ui/src/components/Properties/PropertyPanel.tsx` (`NumberRowProps` ~`:435`, `NumberRow` ~`:451`)
- Modify: `packages/ui/src/components/Properties/Properties.module.css`
- Create: `packages/ui/src/components/Properties/NumberRow.unit.test.tsx`

- [x] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NumberRow } from './PropertyPanel';

describe('NumberRow unit', () => {
  it('renders no suffix by default', () => {
    const { container } = render(<NumberRow label="Width" value={20} onChange={() => {}} />);
    expect(container.textContent).not.toContain('px');
  });

  it('renders a string unit after the input', () => {
    const { container } = render(
      <NumberRow label="Width" value={20} unit="px" onChange={() => {}} />,
    );
    const input = container.querySelector('input[type="number"]');
    expect(input).not.toBeNull();
    expect(container.textContent).toContain('px');
    // After the input, not before — the suffix reads as a trailing unit.
    expect(input?.nextElementSibling?.textContent).toBe('px');
  });

  it('renders a node unit as given', () => {
    const { container } = render(
      <NumberRow label="Angle" value={90} unit={<sup>°</sup>} onChange={() => {}} />,
    );
    expect(container.querySelector('sup')?.textContent).toBe('°');
  });
});
```

- [x] **Step 2: Run it to watch it fail**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/NumberRow.unit.test.tsx`
Expected: FAIL on the second and third cases — `unit` is not a prop, so nothing renders.

- [x] **Step 3: Add the prop**

In `NumberRowProps`, after `placeholder`:

```tsx
  /**
   * Optional suffix rendered after the field. A string becomes a dim "word"
   * unit (e.g. "px"); pass JSX like `<sup>°</sup>` for symbol units. Display
   * only — it never participates in parsing, and the value stays a number.
   */
  unit?: ReactNode;
```

Destructure it, and wrap the input so the suffix has somewhere to sit. Read the current `NumberRow` body first; keep its existing input untouched and only add the wrapper and suffix:

```tsx
      {unit == null ? (
        input
      ) : (
        <span className={s.fieldUnitGroup}>
          {input}
          {typeof unit === 'string' ? <span className={s.readoutUnit}>{unit}</span> : unit}
        </span>
      )}
```

where `input` is the `<input type="number">` element the component already builds. Reuse `s.readoutUnit` — it is the same dim typography `SliderRow` uses, and a second class for the same appearance would drift.

- [x] **Step 4: Add the wrapper style**

In `Properties.module.css`:

Inline-block, matching `.readoutGroup` — a flex container sinks a `<sup>` onto the baseline, which that rule's own comment already states. `gap` doesn't apply, so the spacing goes on the suffix in this context only (a bare `.readoutUnit` margin would leak into `SliderRow`).

```css
.fieldUnitGroup {
  display: inline-block;
  white-space: nowrap;
  min-width: 0;
}

.fieldUnitGroup .readoutUnit {
  margin-left: 4px;
}
```

Add `.fieldUnitGroup sup` to the existing `.readoutGroup sup` selector list rather than writing a second rule.

Check afterwards whether `.row input[type='number']` still sizes correctly inside it — it has `width: var(--wzl-prop-number-width, 9ch)`, which the wrapper must not collapse.

- [x] **Step 5: Run to verify it passes**

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/NumberRow.unit.test.tsx`
Expected: PASS, 3 tests

- [ ] **Step 6: Full suite and typecheck**

Run: `npx tsc --noEmit && npx vitest run --project=weasel-ui`
Expected: PASS

- [x] **Step 7: Commit**

```bash
git add packages/ui/src/components/Properties
git commit -m "give a typed number the same unit suffix a slider has"
```

---

### Task 14: A config leaf can declare its unit

`ControlPanel` renders a lab's config schema as property rows. It already reads `min`, `max`, `step` and `control` off a leaf through `extra<T>(leaf, key)`, an open accessor over the leaf's own keys — so a `unit` needs no change to any leaf type. Wire it, and both the slider and the typed number pick it up.

This is the half that makes units the default rather than an option: every schema-driven lab panel gets them by declaring one key.

**Files:**
- Modify: `packages/labkit/src/controls/ControlPanel.tsx` (~`:158-193`)
- Create or extend a test under `packages/labkit/src/controls/`

- [x] **Step 1: Write the failing test**

Find the existing `ControlPanel` test file and follow its setup rather than inventing one — check `packages/labkit/src/controls/` and `packages/labkit/src/config/` for how a schema is built for a test. Then assert that a numeric leaf declaring `unit: 'px'` renders `px`, for both the slider form (`control: 'slider'` with min and max) and the plain number form.

- [x] **Step 2: Run it to watch it fail**

Run: `npx vitest run --project=labkit <your test path>`
Expected: FAIL — the unit is not read or passed.

- [x] **Step 3: Read it and pass it**

Beside the existing `min`/`max`/`step` reads:

```tsx
      const unit = extra<string>(leaf, 'unit');
```

Pass `unit={unit}` to both the `<SliderRow>` and the `<NumberRow>` in that branch.

A leaf's `unit` is a string, not a node — a schema is data. A consumer wanting `<sup>°</sup>` uses the row directly, or supplies a `renderers` override. Do not add markup-from-string mapping.

- [x] **Step 4: Run to verify it passes**

Run: `npx vitest run --project=labkit <your test path>`
Expected: PASS

- [ ] **Step 5: Full suites and typecheck** — `tsc --noEmit` clean; the suites are left to the arc's consolidated sweep

Run: `npx tsc --noEmit && npx vitest run --project=labkit && npx vitest run --project=weasel-ui`
Expected: PASS

- [x] **Step 6: Document the key**

`min`/`max`/`step`/`control` are documented wherever labkit describes a config leaf's extras — find that (check `packages/labkit/docs/`, `packages/labkit/README.md`, and the `config` source's own docstrings) and add `unit` beside them, in one line. If they are documented nowhere, add nothing: do not start a new document for one key.

- [x] **Step 7: Commit**

```bash
git add packages/labkit/src/controls
git commit -m "let a config leaf declare the unit its number is in"
```

---

### Task 15: The leaf's display unit is `suffix`, and a builder can set it

Task 14 read a leaf's `unit` as a display string. That key is already taken:
`ToolPrefNumber` (`packages/core/src/tools/prefs.ts`) declares
`unit?: ToolPrefNumberUnit`, a conversion descriptor `{ toDisplay, fromDisplay, suffix? }`
that `SelectionPanel` consumes. Two meanings for one key in one system is what
`docs/taxonomy.md` warns against, and it left the string form guarded by a `typeof`
check rather than named honestly.

`suffix` is the right word and the codebase already uses it — it is the field inside
`ToolPrefNumberUnit` that carries exactly this string. `unit` goes back to meaning
the descriptor, and nothing has to learn unit conversion.

Second half: no builder method sets the string today, so it is reachable only from a
hand-written leaf. `NumberNode` gains one.

**Files:**
- Modify: `packages/labkit/src/controls/ControlPanel.tsx`
- Modify: `packages/labkit/src/controls/ControlPanel.test.tsx`
- Modify: `packages/labkit/src/config/builder.ts`
- Modify: `packages/labkit/src/config/builder.test.ts`
- Modify: `.changeset/control-skin-unification.md`

- [x] **Step 1: Extend the builder test first**

`packages/labkit/src/config/builder.test.ts` already covers `.range()`, `.step()` and
the other `NumberNode` methods — follow whatever shape those assertions use rather
than inventing one. Add a case asserting `f.number(20).suffix('px')` puts
`suffix: 'px'` on the leaf's annotations.

- [x] **Step 2: Run it to watch it fail**

Run: `npx vitest run --project=labkit packages/labkit/src/config/builder.test.ts`
Expected: FAIL — `.suffix` is not a function.

- [x] **Step 3: Add the builder method**

In `builder.ts`, on `NumberNode`, beside `step()`:

```ts
  /** A display suffix for the value — `'px'`, `'ms'`, `'°'`. Presentation only:
   *  it is never parsed, and the stored value stays a plain number. */
  suffix(suffix: string): this {
    return this.ann({ suffix });
  }
```

- [x] **Step 4: Point `ControlPanel` at `suffix`**

Replace Task 14's guarded `unit` read with a plain one:

```tsx
      const suffix = extra<string>(leaf, 'suffix');
```

and pass `unit={suffix}` to both `SliderRow` and `NumberRow` — the *row* prop stays
`unit`, which is correct weasel-ui vocabulary and matches `SliderRow`'s existing API.
Only the leaf key changes.

Delete the `typeof declaredUnit === 'string'` guard and the test that pinned it: with
`suffix` carrying the string, a leaf's `unit` is unambiguously the descriptor and
`ControlPanel` simply does not read it. Do not leave a `unit` fallback — a second
accepted spelling is how both spellings end up in use.

- [x] **Step 5: Update the ControlPanel tests**

The Task 14 tests declare `unit: 'px'` on a raw leaf. Change them to `suffix: 'px'`,
and now that a builder method exists, build the schema with `f.number(…).suffix('px')`
instead of the `as unknown as PrefLeaf` cast — the cast only existed because the key
was undeclarable.

- [x] **Step 6: Run both focused files**

Run: `npx vitest run --project=labkit packages/labkit/src/config/builder.test.ts packages/labkit/src/controls/ControlPanel.test.tsx`
Expected: PASS

- [x] **Step 7: Typecheck**

Run: `npx tsc --noEmit` from the worktree root.

- [x] **Step 8: Correct the changeset**

`.changeset/control-skin-unification.md` currently ends with a paragraph describing
the `unit` collision and the `typeof` guard. That situation no longer exists — replace
it, do not append to it:

```markdown
A number leaf declares its display suffix with `.suffix('px')`, which `ControlPanel`
passes to the row. `unit` on a leaf keeps its existing meaning — the
`{ toDisplay, fromDisplay, suffix }` conversion descriptor `SelectionPanel` reads —
and `ControlPanel` does not interpret it.
```

- [x] **Step 9: Commit**

```bash
git add packages/labkit/src/config packages/labkit/src/controls .changeset/control-skin-unification.md docs/superpowers/plans/2026-09-03-control-skin-unification.md
git commit -m "name a leaf's display suffix suffix, not unit"
```

---

## Final verification

- [ ] `npx tsc --noEmit` from the worktree root — clean
- [ ] `npx vitest run --project=weasel-ui` — pass
- [ ] `npx vitest run --project=labkit` — pass
- [ ] `npx vitest run --project=kit` — pass
- [ ] `npm run check:bumps` — pass
- [ ] `npm run check:manifests` — pass
- [ ] Storybook, **both modes** via the lab header's Light/Dark buttons: `Properties/Gallery`, `Properties/SpeechBalloonPanels`, `InlineRange`, `Slider`, `GradientEditor`, a labkit lab with a zoom control, the annotations sidebar
- [ ] `git status` in the worktree shows no stray `package-lock.json` — a worktree install rewrites it with the root checkout's versions and it must not be committed
