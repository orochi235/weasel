# Appearance Axes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status: written 2026-10-23, nothing built.** The design is the "Appearance axes" section of
`HANDOFF.md` and the inventory at https://claude.ai/artifact/RtvLxcSg14jqrBHiMAkdwz. Delete this
plan when the branch merges.

**Goal:** Replace the props that decide how a weasel component looks with four axes:
`stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact
color). Retire `status`, Toast's `tone`, labkit Toolbar's `variant: 'danger'`, Button's
`primary`/`secondary`, and Slider's `density`.

**Architecture:** `@weasel-js/theme` owns the value lists and the grade/emphasis → token maps.
`@weasel-js/ui` replaces `useStance` with `useAppearance`, which writes `data-stance`,
`data-grade`, `data-emphasis`, and `data-tint` on a component's root, plus inline custom properties
(`--wzl-tint`, `--wzl-grade`, `--wzl-emphasis-fg`). The stance rule generator (`gen:stances`) learns
grade and emphasis blocks. Color resolves as `hue = tint ?? grade ?? stance` in CSS, through the
order of the generated blocks. Every axis is a hint: each component decides what it draws from it.

**Tech Stack:** TypeScript, React, CSS modules and Less, vitest (`weasel-ui`, `labkit`, and `browser`
projects), the theme token build (`npm run gen:tokens -w @weasel-js/theme`).

## The values

| Axis | Values | Cascades | Replaces |
|---|---|---|---|
| `stance` | `clarify`, `aside`, `advanced`, `debug`, `preview`, `confirm`, `cancel` | yes, through the slot values a surface sets | `stance` (`scope` → `clarify`); Button `variant: 'primary'` → `confirm` |
| `grade` | `info`, `success`, `warn`, `danger` | no (a component may read its parent's `--wzl-grade` as a hint) | `status` severities, Toast `tone`, Toolbar `variant: 'danger'`, stances `danger`/`notice` |
| `emphasis` | `high`, `low` (unset is normal) | yes, through `--wzl-emphasis-fg` | `status` `accent`/`muted`/`neutral`; stance `important` → `high` |
| `tint` | palette index or `ColorSource` | no | today's `tone` prop |

Old values map like this:

| Old | New |
|---|---|
| `status="accent"` | `emphasis="high"` |
| `status="muted"` | `emphasis="low"` |
| `status="neutral"` | nothing |
| `status="success" \| "warn" \| "danger" \| "info"` | `grade="…"`, same word |
| `status="custom"` (Badge) | `tint={…}` |
| `tone={n}` / `tone={color}` | `tint={…}` |
| `stance="scope"` | `stance="clarify"` |
| `stance="danger"` | `grade="danger"` |
| `stance="notice"` | `grade="warn"` |
| `stance="important"` | `emphasis="high"` |
| Button `variant="primary"` | `stance="confirm"` (variant omitted) |
| Button `variant="secondary"` | nothing (the default) |
| Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
| labkit Toolbar `variant="danger"` | `grade="danger"` |
| Slider `density="slim"` | numeric params (Task 9) |

## Working rules for this plan

- One branch, `feat/appearance-axes`, in its own worktree (`git worktree add
  .claude/worktrees/appearance-axes -b feat/appearance-axes main`, then `npm ci` there). Enter it with
  `EnterWorktree` before any task.
- Commit by path (`git commit -- <paths>`), never `git add -A`: another session shares the main
  checkout.
- Tests while iterating: one file at a time, `npx vitest run --project=<project> <file>`. `weasel-ui`
  owns `packages/ui`, `packages/theme`, and `packages/hud`; `labkit` owns `packages/labkit`. Anything
  wider goes to the fleet (`npm run test:fleet`), never a local full run.
- The renames break callers at compile time, and that is how call sites are found: `npm run
  typecheck` goes red at Task 1 and is green again only at the end of Task 8. Each task's own tests
  pass when it ends. The branch merges whole, never part-way.
- Breaking API changes are fine: weasel breaks compatibility rather than keep alias paths. Every
  changeset is `patch`, and its prose says what broke.

---

### Task 1: Theme value lists and the tint rename

**Files:**
- Create: `packages/theme/src/appearance.ts`
- Create: `packages/theme/src/appearance.test.ts`
- Modify: `packages/theme/src/panel.ts` (move `STANCES`/`Stance` out; rename the `tone`/`tone-mix` slots)
- Modify: `packages/theme/src/colorSource.ts` (`TONE_REF` → `TINT_REF`, `'tone'` → `'tint'`, `tones` → `tints`)
- Modify: `packages/theme/src/colorListItems.ts:38` (`tones` field → `tints`)
- Modify: `packages/theme/src/index.ts` (exports)
- Modify: `packages/theme/src/panel.test.ts`, `packages/theme/src/colorSource.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/theme/src/appearance.test.ts
import { describe, expect, it } from 'vitest';
import { EMPHASES, EMPHASIS_FG, GRADES, GRADE_TOKENS, STANCES } from './appearance';

describe('appearance value lists', () => {
  it('lists the stances as angles, with no severity among them', () => {
    expect(STANCES).toEqual(['clarify', 'aside', 'advanced', 'debug', 'preview', 'confirm', 'cancel']);
  });

  it('maps every grade to a theme token', () => {
    expect(GRADES).toEqual(['info', 'success', 'warn', 'danger']);
    expect(GRADE_TOKENS).toEqual({
      info: '--wzl-info',
      success: '--wzl-success',
      warn: '--wzl-warning',
      danger: '--wzl-danger',
    });
  });

  it('maps every emphasis to the text color it lends', () => {
    expect(EMPHASES).toEqual(['high', 'low']);
    expect(EMPHASIS_FG).toEqual({ high: 'var(--wzl-accent-fg)', low: 'var(--wzl-fg-muted)' });
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run --project=weasel-ui packages/theme/src/appearance.test.ts`
Expected: FAIL, "Failed to resolve import ./appearance".

- [ ] **Step 3: Write `appearance.ts`**

```ts
// packages/theme/src/appearance.ts
/** The angle a component comes from: who it is for, how it speaks, what an action does. */
export const STANCES = ['clarify', 'aside', 'advanced', 'debug', 'preview', 'confirm', 'cancel'] as const;
export type Stance = (typeof STANCES)[number];

/** How serious, or how good. The only axis that paints red. */
export const GRADES = ['info', 'success', 'warn', 'danger'] as const;
export type Grade = (typeof GRADES)[number];

/** The token each grade paints with. */
export const GRADE_TOKENS: Readonly<Record<Grade, string>> = {
  info: '--wzl-info',
  success: '--wzl-success',
  warn: '--wzl-warning',
  danger: '--wzl-danger',
};

/** How loudly a component reads. Unset is normal. */
export const EMPHASES = ['high', 'low'] as const;
export type Emphasis = (typeof EMPHASES)[number];

/** The text color an emphasis lends to everything inside it, as `--wzl-emphasis-fg`. */
export const EMPHASIS_FG: Readonly<Record<Emphasis, string>> = {
  high: 'var(--wzl-accent-fg)',
  low: 'var(--wzl-fg-muted)',
};
```

- [ ] **Step 4: Point `panel.ts` at it and rename the slots**

In `packages/theme/src/panel.ts`, delete the `STANCES` constant and `Stance` type (lines 12–16), and
add at the top:

```ts
import { type Stance, STANCES } from './appearance';

export { type Stance, STANCES };
```

In `STANCE_SLOTS`, rename two entries:

```ts
  { name: 'tint-mix', drives: 'how much of the tint mixes into the surface' },
  { name: 'tint', drives: 'the tint a surface takes when it names none' },
  // Only a surface that names its own tint or grade recolors its controls.
  { name: 'accent', drives: 'the accent the controls inside a tinted or graded surface take; unset, the tint' },
```

In `resolveStanceSlots`, change `slot === 'tone'` to `slot === 'tint'` and update the doc comment's
"tone" words to "tint". Also update the file's top comment: a stance is the angle a surface comes
from, not a class of content.

- [ ] **Step 5: Rename the tone ref**

In `packages/theme/src/colorSource.ts`: `TONE_REF = 'tone'` becomes `TINT_REF = 'tint'`. Rename
`tonesOf` → `tintsOf`, `toneSource` → `tintSource`, `toneCss` → `tintCss`, `themeTones` →
`themeTints`, and the context field `ctx.tones` → `ctx.tints`, along with its declaration in
`colorListItems.ts:38`. Rename the theme's own list wherever `themeTones` reads it. Find it with
`grep -rn "themeTones\|tones" packages/theme/src --include='*.ts' | grep -v generated`. If the list is a
theme JSON key (`"tones"`), rename that key in every theme file under `packages/theme/themes` and
`packages/theme/src/themes`.

In `packages/theme/src/index.ts`, export `TINT_REF` in place of `TONE_REF`, and add:

```ts
export { EMPHASES, EMPHASIS_FG, type Emphasis, GRADE_TOKENS, GRADES, type Grade } from './appearance';
```

Update `panel.test.ts` and `colorSource.test.ts`: `{ ref: 'tone' }` → `{ ref: 'tint' }`, the
`stance: 'danger'` case → `stance: 'debug'`, and the slot names `tone`/`tone-mix` → `tint`/`tint-mix`.

- [ ] **Step 6: Run the theme tests**

Run: `npx vitest run --project=weasel-ui packages/theme/src/appearance.test.ts packages/theme/src/panel.test.ts packages/theme/src/colorSource.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git commit -m "add grade and emphasis lists to theme and rename its tone ref to tint" -- packages/theme/src
```

### Task 2: Theme tokens: info, clarify, confirm, and no severity stances

**Files:**
- Modify: `packages/theme/themes/weasel.json`, `packages/theme/src/themes/win9x.theme.json`, `packages/theme/src/themes/platinum.theme.json`, `packages/theme/src/themes/mac-classic.theme.json`
- Modify: `packages/theme/src/themes/win9x.test.ts`, `packages/theme/src/themes/platinum.test.ts`
- Regenerate: `packages/theme/src/generated/*`

- [ ] **Step 1: Add `info` beside `success`** in `weasel.json`. Use `#7ab8d4`, the color Badge
hardcodes today, so `info` badges keep their look:

```json
    "info-base": {
      "value": "#7ab8d4",
      "type": "color"
    },
```

next to `"success-base"`, and beside `"success": { "value": "{success-base}" }`:

```json
    "info": {
      "value": "{info-base}",
      "type": "color"
    },
```

Do the same in `win9x.theme.json` and `platinum.theme.json`, next to their `danger-base` /
`warning-base` entries. Pick a blue that sits with those themes' own `success-base`. A theme that
doesn't define `success-base` (mac-classic) inherits it and needs nothing.

- [ ] **Step 2: Rename and remove stance tokens** in `weasel.json`, `win9x.theme.json`, and
`mac-classic.theme.json`:
  - `stance-scope-*` → `stance-clarify-*` (every key, `-nested-` ones included).
  - `stance-*-tone` → `stance-*-tint`, and `stance-*-tone-mix` → `stance-*-tint-mix`.
  - Delete `stance-danger-*`, `stance-notice-*`, and `stance-important-*`. Task 3's grade and emphasis
    blocks draw what they drew: grade paints the tint, border, and title in `--wzl-grade`; `high`
    paints border and title in `--wzl-accent-fg`.

- [ ] **Step 3: Rename the Button primary tokens.** `button-primary-*` → `button-confirm-*` in
`win9x.theme.json`, `platinum.theme.json`, and `mac-classic.theme.json`, and in the two tests that
name them.

- [ ] **Step 4: Regenerate and check**

Run: `npm run gen:tokens -w @weasel-js/theme`, then
`grep -rnE "stance-(scope|danger|notice|important)|stance-[a-z]+-tone|button-primary" packages/theme/src/generated packages/theme/themes packages/theme/src/themes`
Expected: no output.

Run: `npx vitest run --project=weasel-ui packages/theme/src/themes/win9x.test.ts packages/theme/src/themes/platinum.test.ts packages/theme/src/weasel.definition.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git commit -m "add the info grade token and rename stance tokens for clarify, tint and confirm" -- packages/theme
```

### Task 3: `useAppearance` and the generated rules

**Files:**
- Create: `packages/ui/src/components/appearance.ts` (replaces `stance.ts`)
- Create: `packages/ui/src/components/appearance.test.tsx`
- Delete: `packages/ui/src/components/stance.ts`
- Modify: `packages/ui/src/components/stanceCss.ts`, `packages/ui/src/components/stanceCss.test.ts`, `packages/ui/src/components/stanceSurfaces.ts`
- Modify: `packages/ui/package.json` (the `./stance` subpath export → `./appearance`), `packages/ui/src/index.ts`, `packages/labkit/src/passthrough/weasel-ui.ts`
- Regenerate: every stylesheet `STANCE_SURFACES` names (`npm run gen:stances`)

- [ ] **Step 1: Write the failing hook test**

```tsx
// packages/ui/src/components/appearance.test.tsx
import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useAppearance } from './appearance';

describe('useAppearance', () => {
  it('renders nothing for a component given no axis', () => {
    expect(renderHook(() => useAppearance({})).result.current).toEqual({});
  });

  it('marks each axis it is given', () => {
    const { result } = renderHook(() => useAppearance({ stance: 'debug', grade: 'warn', emphasis: 'low' }));
    expect(result.current).toMatchObject({ 'data-stance': 'debug', 'data-grade': 'warn', 'data-emphasis': 'low' });
  });

  it('writes the grade token and the emphasis color as inherited properties', () => {
    const { result } = renderHook(() => useAppearance({ grade: 'danger', emphasis: 'high' }));
    expect(result.current.style).toEqual({
      '--wzl-grade': 'var(--wzl-danger)',
      '--wzl-emphasis-fg': 'var(--wzl-accent-fg)',
    });
  });

  it('resolves a palette index to the tint ref', () => {
    const { result } = renderHook(() => useAppearance({ tint: 2 }));
    expect(result.current['data-tint']).toBe('2');
    expect(result.current.style?.['--wzl-tint' as never]).toBeDefined();
  });
});
```

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/appearance.test.tsx`
Expected: FAIL, "Failed to resolve import ./appearance".

- [ ] **Step 2: Write `appearance.ts`**

```ts
// packages/ui/src/components/appearance.ts
import type { ColorSource } from '@weasel-js/paint';
import { EMPHASIS_FG, type Emphasis, GRADE_TOKENS, type Grade, type Stance, TINT_REF } from '@weasel-js/theme';
import { useColorCss } from '@weasel-js/theme/react';
import type { CSSProperties } from 'react';

export type { Emphasis, Grade, Stance } from '@weasel-js/theme';

/**
 * How a component looks, as hints: each component decides what it draws from
 * each one. Color resolves as tint, then grade, then stance; emphasis sets how
 * loudly that color shows.
 */
export interface AppearanceProps {
  /** The angle it comes from: for advanced users, debug output, the confirming action. */
  stance?: Stance;
  /** How serious, or how good. */
  grade?: Grade;
  /** How loudly it reads. Passes to everything inside it as `--wzl-emphasis-fg`. */
  emphasis?: Emphasis;
  /**
   * An exact color: an index into the theme's tint list, wrapping, or a color
   * source. Belongs to this element alone.
   */
  tint?: number | ColorSource;
}

export interface AppearanceAttrs {
  'data-stance'?: Stance;
  'data-grade'?: Grade;
  'data-emphasis'?: Emphasis;
  'data-tint'?: string;
  style?: CSSProperties;
}

export function useAppearance({ stance, grade, emphasis, tint }: AppearanceProps): AppearanceAttrs {
  const css = useColorCss();
  if (stance === undefined && grade === undefined && emphasis === undefined && tint === undefined) return {};
  const color = css(typeof tint === 'number' ? { ref: TINT_REF, index: tint } : tint);
  const style: Record<string, string> = {};
  if (color !== undefined) style['--wzl-tint'] = color;
  if (grade !== undefined) style['--wzl-grade'] = `var(${GRADE_TOKENS[grade]})`;
  if (emphasis !== undefined) style['--wzl-emphasis-fg'] = EMPHASIS_FG[emphasis];
  return {
    'data-stance': stance,
    'data-grade': grade,
    'data-emphasis': emphasis,
    'data-tint': color === undefined ? undefined : typeof tint === 'number' ? String(tint) : color,
    style: Object.keys(style).length === 0 ? undefined : (style as CSSProperties),
  };
}
```

Delete `stance.ts`. In `packages/ui/package.json`, rename the `./stance` export to
`./appearance`, and repoint `packages/labkit/src/chrome/types.ts:2` and
`packages/labkit/src/passthrough/weasel-ui.ts` at it. In `packages/ui/src/index.ts`, export
`useAppearance`, `AppearanceProps`, `AppearanceAttrs`, `Grade`, `Emphasis`, and `Stance` in place of
`useStance`/`StanceProps`/`StanceAttrs`.

Run the hook test. Expected: PASS.

- [ ] **Step 3: Write failing generator assertions.** Add to `stanceCss.test.ts`, inside
`describe('stance rules')`:

```ts
  const panel = STANCE_SURFACES.find((s) => s.id === 'panel')!;

  it('names the tint, never a tone', () => {
    for (const surface of STANCE_SURFACES) {
      const text = stanceCss(surface);
      expect(text).not.toMatch(/tone/);
      expect(text).toContain(`${surface.selector} {\n  --wzl-tint: initial;\n}`);
    }
  });

  it('paints a graded surface after its stance, so grade wins the hue and tint wins over both', () => {
    const text = stanceCss(panel);
    const grade = text.indexOf(`.panel[data-grade] {`);
    expect(grade).toBeGreaterThan(text.lastIndexOf(`.panel[data-stance=`));
    expect(text).toContain(`.panel[data-grade][data-nested]`);
    expect(text.slice(grade)).toContain('--_s-tint: var(--wzl-tint, var(--wzl-grade));');
    expect(text.slice(grade)).toContain('--_s-border-color: var(--wzl-grade);');
    expect(text.slice(grade)).toContain('--_s-title-color: var(--wzl-grade);');
  });

  it('draws high emphasis in the accent and low emphasis muted', () => {
    const text = stanceCss(panel);
    expect(text).toContain(".panel[data-emphasis='high'] {\n  --_s-border-color: var(--wzl-accent-fg);\n  --_s-title-color: var(--wzl-accent-fg);\n}");
    expect(text).toContain(".panel[data-emphasis='low'] {\n  --_s-title-color: var(--wzl-fg-muted);\n}");
  });

  it('recolors the controls of a tinted or graded surface', () => {
    expect(stanceCss(panel)).toContain('.panel[data-tint],\n.panel[data-grade] {\n  --wzl-accent: var(--_s-accent);');
  });
```

Also rename `name === 'tone'` to `name === 'tint'` in the existing fallback test.

Run: `npx vitest run --project=weasel-ui packages/ui/src/components/stanceCss.test.ts`
Expected: the new cases FAIL.

- [ ] **Step 4: Teach `stanceCss.ts` the grade and emphasis blocks**

In `stanceCss.ts`:
- `TONE_BASE` → `TINT_BASE = 'var(--wzl-tint, var(--_s-surface))'`, and `ACCENT_BASE = 'var(--wzl-tint)'`.
- In `stanced()`: `name === 'tone'` → `name === 'tint'`, and `${stance}-tone` / `${stance}-nested-tone` →
  `${stance}-tint` / `${stance}-nested-tint`. The outer `var(--wzl-tone, …)` becomes `var(--wzl-tint, …)`.
- The reset rule becomes `${sel} {\n  --wzl-tint: initial;\n}`.
- The `stanceless` field's doc says "takes a tint and no stance".

After the stance blocks, push emphasis and then grade, so the source order is stance, emphasis, grade:

```ts
  const has = (name: string) => name in surface.base;
  const decls = (pairs: [string, string][]) => pairs.filter(([name]) => has(name)).map(([name, v]) => `  --_s-${name}: ${v};`);
  const emphasis: Record<string, [string, string][]> = {
    high: [['border-color', 'var(--wzl-accent-fg)'], ['title-color', 'var(--wzl-accent-fg)']],
    low: [['title-color', 'var(--wzl-fg-muted)']],
  };
  for (const [level, pairs] of Object.entries(emphasis)) {
    const body = decls(pairs);
    if (body.length) rules.push(`${sel}[data-emphasis='${level}'] {\n${body.join('\n')}\n}`);
  }
  const graded = decls([
    ['tint', 'var(--wzl-tint, var(--wzl-grade))'],
    ['border-color', 'var(--wzl-grade)'],
    ['title-color', 'var(--wzl-grade)'],
    ['accent', 'var(--wzl-tint, var(--wzl-grade))'],
  ]);
  // A nested stanced surface's block is (0,3,0); its graded twin must match that to win on order.
  const gradeSel = surface.nests ? `${sel}[data-grade],\n${sel}[data-grade][data-nested]` : `${sel}[data-grade]`;
  if (graded.length) rules.push(`${gradeSel} {\n${graded.join('\n')}\n}`);
```

Change the `fills` selectors from `${sel}[data-tone],\n${sel}[data-stance]` to
`${sel}[data-tint],\n${sel}[data-grade],\n${sel}[data-stance]`, with `--_s-tint` / `--_s-tint-mix` in
the `color-mix`. Change the `sinks` and `accent` selectors from `${sel}[data-tone]` to
`${sel}[data-tint],\n${sel}[data-grade]`.

In `stanceSurfaces.ts`, rename the `tone`/`tone-mix` base keys to `tint`/`tint-mix`, `TONE_BASE` →
`TINT_BASE`, and `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`. If that token is defined in the
theme JSONs, rename it there too and rerun `gen:tokens`. Change the badge surface's comment to say
"the color its grade or emphasis would otherwise paint".

- [ ] **Step 5: Regenerate and run**

Run: `npm run gen:stances`, then `npx vitest run --project=weasel-ui packages/ui/src/components/stanceCss.test.ts packages/ui/src/components/appearance.test.tsx`
Expected: PASS.

Run: `grep -rnE "\-\-wzl-tone\b|data-tone|_s-tone" packages apps --include='*.css' --include='*.less' --include='*.ts' --include='*.tsx' | grep -vE "node_modules|/dist/"`
Expected: output only in component sources Tasks 4–8 migrate; no generated region left.

- [ ] **Step 6: Commit**

```bash
git commit -m "replace useStance with useAppearance and generate grade and emphasis rules" -- packages/ui packages/labkit/src/chrome/types.ts packages/labkit/src/passthrough/weasel-ui.ts packages/theme
```

### Task 4: Containers and the surfaces that take a stance

Every component that called `useStance` takes `AppearanceProps` instead and spreads
`useAppearance(...)` on its root, in the same place `useStance` went:

`Callout`, `Dialog`, `MotifFrame` (and `MotifFrameProps` in `MotifFrame/types.ts`), `PropertyPanel`,
`PropertyGroup`, `Subpanel`, `LayerList` (`layerListProps.ts`), labkit `ControlPanel`, `ControlMatrix`,
`SidebarRegion`, and the `SidebarSection` type in `packages/labkit/src/chrome/types.ts`.

**Files:** the components above, their tests and stories, `packages/hud/src/widgets/window/window.ts`
and `window.test.ts`, and `packages/forge/src/story/library.ts`.

- [ ] **Step 1: Swap the hook.** In each file, replace

```ts
import { type StanceProps, useStance } from '../stance';
// …
const stanced = useStance({ stance, tone });
```

with

```ts
import { type AppearanceProps, useAppearance } from '../appearance';
// …
const appearance = useAppearance({ stance, grade, emphasis, tint });
```

and destructure `grade`, `emphasis`, and `tint` where `tone` was. Props interfaces extend
`AppearanceProps` where they extended `StanceProps`. `PropertyPanel.tsx:75` keeps
`stance === 'debug'` making the panel selectable. The `ControlPanel.tsx:251` and
`ControlMatrix.tsx:225` guards become `title === undefined && stance === undefined && grade === undefined && emphasis === undefined && tint === undefined && …`.

- [ ] **Step 2: Migrate the hud window.** `window.ts` resolves slots without the cascade, through
`resolveStanceSlots`. Add `grade?: Grade` and `emphasis?: Emphasis` beside `stance` in its options,
and `setGrade`/`setEmphasis` beside `setStance`. After resolving the stance slots, apply the same
overrides the generator writes: a grade sets `tint`, `border-color`, and `title-color` to the
resolved `GRADE_TOKENS[grade]` token; `high` sets `border-color` and `title-color` to `--wzl-accent-fg`;
`low` sets `title-color` to `--wzl-fg-muted`. Rename its `tone` option to `tint`. In `window.test.ts`, the
`stance: 'danger'` case becomes `grade: 'danger'` and keeps asserting the danger ring; the
`stance: 'scope'` case becomes `stance: 'clarify'`.

- [ ] **Step 3: Migrate call sites.** Apply the "Old → New" table to every caller:

```bash
grep -rnE "stance=[\"'{]+'?(danger|notice|important|scope)|stance: ?'(danger|notice|important|scope)'|\btone=[{\"']|\btone: ?[0-9'{]" packages apps --include='*.tsx' --include='*.ts' | grep -vE "node_modules|/dist/"
```

Leave KeyDiagram's per-key `tone` (Task 7) and Toast's `tone` (Task 6) for later. Rewrite
`Dialog.tsx:57`'s doc to "a destructive confirm is `grade="danger"`".

- [ ] **Step 4: Run the affected tests**

Run each of: `npx vitest run --project=weasel-ui packages/ui/src/components/Properties/PropertyPanel.stance.test.tsx`,
`… packages/ui/src/components/Dialog/Dialog.test.tsx`, `… packages/ui/src/components/Callout/Callout.test.tsx`,
`… packages/ui/src/components/MotifFrame/MotifFrame.test.tsx`, `… packages/hud/src/widgets/window/window.test.ts`,
`npx vitest run --project=labkit packages/labkit/src/controls/ControlPanel.sections.test.tsx`.
Expected: PASS. `PropertyPanel.stance.test.tsx:90` now expects `{ grade: 'danger', tint: '2' }`.

Run: `npm run typecheck`. Expected: errors only in Badge, Code, Button, DetailList, Toast, Toolbar,
and Slider callers.

- [ ] **Step 5: Browser check.** These colors are `var()` chains, which jsdom cannot resolve. In
headless Chrome (playwright MCP), open forge's PropertyPanel and Dialog stories from this worktree
(start `npm run dev:forge` with `WAKE_EXTRA=<port>`). Confirm that a `grade="danger"` dialog draws a
red border and title, that `stance="clarify"` matches what `scope` drew before, and that a
`grade="danger"` panel nested in a `stance="clarify"` panel is red. Post each screenshot with
`transom post`.

- [ ] **Step 6: Commit**

```bash
git commit -m "move containers and the hud window onto stance, grade, emphasis and tint" -- <every path touched>
```

### Task 5: Badge, Code, Button, Powerline, and DetailList

**Files:**
- Modify: `packages/ui/src/components/Badge/{types.ts,Badge.tsx,Badge.module.css}`, `Code/{Code.tsx,Code.module.css}`, `Button/{Button.tsx,Button.module.css}`, `Powerline/Powerline.tsx`, `DetailList/{DetailList.tsx,DetailList.module.css}`, `packages/labkit/src/primitives/Readout.tsx`
- Modify: their tests and stories, plus every caller (Step 5)

- [ ] **Step 1: Write the failing tests.** In `Badge.test.tsx`, replace the stance/status case with:

```tsx
  it('marks grade and emphasis, never a status', () => {
    const { container } = render(<Badge grade="warn" emphasis="low">x</Badge>);
    const badge = container.firstElementChild as HTMLElement;
    expect(badge.dataset).toMatchObject({ grade: 'warn', emphasis: 'low' });
    expect(badge.dataset.status).toBeUndefined();
  });
```

In `Button.test.tsx`, replace the `[data-status=…]` stylesheet assertions (lines 164–166) with:

```tsx
  it('takes the confirm stance in place of a primary variant', () => {
    const { getByRole } = render(<Button stance="confirm">Go</Button>);
    expect(getByRole('button').dataset.stance).toBe('confirm');
  });

  it("colors a link from emphasis and grade, falling back to the accent", () => {
    const css = readFileSync(resolve(__dirname, 'Button.module.css'), 'utf8');
    expect(css).toMatch(/\.variant_link\s*\{[^}]*--btn-link-fg:\s*var\(--wzl-emphasis-fg, var\(--wzl-accent-fg\)\)/);
    expect(css).toMatch(/\.variant_link\[data-grade\]\s*\{\s*--btn-link-fg:\s*var\(--wzl-grade\)/);
  });
```

In `Code.test.tsx`, change line 67's assertion the same way:
`.code { --code-status-fg: var(--wzl-emphasis-fg, …) }` and `.code[data-grade] { --code-status-fg: var(--wzl-grade) }`.

Run the three files. Expected: FAIL.

- [ ] **Step 2: Types.** Delete `BadgeStatus`, `CodeStatus`, `ButtonStatus`, and `DetailRowStatus`.
Badge, Code, and Button props extend `AppearanceProps` and lose `status`. `DetailRow` and labkit's
`Readout` rows take `grade?: Grade` in place of `status`. `ButtonVariant` becomes
`'solid' | 'ghost' | 'link'`, defaulting to `'solid'`, the old `secondary`.

- [ ] **Step 3: CSS.** Each component maps the axes once, replacing its `[data-status=…]` table:

```css
/* Badge.module.css: replaces lines 70–76 */
.badge { --badge-status-edge: var(--wzl-emphasis-fg, var(--wzl-border)); }
.badge[data-grade] { --badge-status-edge: var(--wzl-grade); }
```

```css
/* Code.module.css: replaces lines 19–23 */
.code { --code-status-fg: var(--wzl-emphasis-fg, inherit); }
.code[data-grade] { --code-status-fg: var(--wzl-grade); }
```

```css
/* Button.module.css: replaces lines 266–271 */
.variant_link { --btn-link-fg: var(--wzl-emphasis-fg, var(--wzl-accent-fg)); }
.variant_link[data-grade] { --btn-link-fg: var(--wzl-grade); }
```

Badge's `[data-status='neutral']` rules (lines 95 and 153) become `.badge:not([data-grade])`, and its
`--wzl-fg-muted` fallback becomes `var(--wzl-emphasis-fg, var(--wzl-fg-muted))`. Badge's `custom`
status is gone: `tint` reaches `--_s-accent` through the generated rules.

Button: rename `.variant_secondary` → `.variant_solid`. `.variant_primary` becomes
`.variant_solid[data-stance='confirm']`, and `--wzl-button-primary-*` reads become
`--wzl-button-confirm-*`. `stance="cancel"` draws as plain `solid` (a hint nothing styles yet).
`.variant_primary.pressed` (line 288) becomes `.variant_solid[data-stance='confirm'].pressed`.

DetailList: its `[data-status]` dot colors become one rule,
`.row[data-grade] .dot { background: var(--wzl-grade); }`. Pass `grade` through `useAppearance`, or
write `data-grade` and `--wzl-grade` the same way.

- [ ] **Step 4: Powerline.** Its segments take `grade`, `emphasis`, and `tint` in place of
`status`/`tone`, passed through to its Badge pieces. `GestureRoute.tsx`, devtools
`DecisionPath.tsx`, and draw's `dev/badgeTokens.ts` build segment objects: map them with the table.

- [ ] **Step 5: Migrate every caller**

```bash
grep -rnE "status=[\"'{]|status: ?'(neutral|muted|accent|success|warn|danger|info|custom)'|variant=[\"'{]+(primary|secondary)|variant: ?'(primary|secondary)'" packages apps --include='*.tsx' --include='*.ts' --include='*.mdx' | grep -vE "node_modules|/dist/"
```

Expected after migrating: matches only for unrelated `status` props. Check each remaining hit by hand;
an HTTP status or a job status is not an appearance.

- [ ] **Step 6: Tests, typecheck, browser**

Run each of: `npx vitest run --project=weasel-ui packages/ui/src/components/Badge/Badge.test.tsx`,
`… Button/Button.test.tsx`, `… Code/Code.test.tsx`, `… DetailList/` (the directory),
`npx vitest run --project=browser packages/ui/src/components/Badge/Badge.browser.test.tsx`.
Expected: PASS. Then `npm run typecheck`.

In headless Chrome, screenshot the Badge, Button, and Code stories. Confirm `emphasis="low"` badges
are muted, `emphasis="high"` badges are accent, a `stance="confirm"` button is accent-filled, and a
link button with `grade="danger"` is red. Post the screenshots with `transom post`.

- [ ] **Step 7: Commit**

```bash
git commit -m "replace status on Badge, Code, Button and DetailList with grade and emphasis" -- <every path touched>
```

### Task 6: Toast and labkit Toolbar

**Files:**
- Modify: `packages/ui/src/components/Toast/{queue.ts,Toast.tsx,Toast.module.css}` and tests
- Modify: `packages/labkit/src/primitives/Toolbar.tsx`, its Less, and its tests
- Modify: the toast callers (`grep -rn "toast\.\(warning\|error\)\|tone: '" packages apps`)

- [ ] **Step 1: Failing test.** In the Toast queue test, replace the tone cases with:

```ts
  it('queues a toast by grade', () => {
    toast.warn('Low disk');
    toast.danger('Write failed');
    expect(queue.visibleToasts.map((t) => t.content.grade)).toEqual(['warn', 'danger']);
  });
```

Run it. Expected: FAIL, "toast.warn is not a function".

- [ ] **Step 2: Implement.** `ToastTone` is deleted; `ToastContent.tone` → `grade: Grade`, and
`add(tone, …)` → `add(grade, …)`. `toast` has `info`, `success`, `warn`, and `danger` methods, and
calling `toast(…)` alone stays `info`. In `Toast.tsx`, the `toneClass` map gives way to
`data-grade={t.content.grade}` and `--wzl-grade` on the toast root, written through `useAppearance({ grade })`.
`Toast.module.css`'s `.toneInfo`/`.toneSuccess`/`.toneWarning`/`.toneError` rules collapse into
`.toast[data-grade]` reading `var(--wzl-grade)`.

Toolbar: `variant?: 'default' | 'danger'` → `grade?: 'danger'`, so the button reddens on hover for
actions that discard work. `lk-toolbar-button--danger` keys off `[data-grade='danger']`.

- [ ] **Step 3: Callers, tests, typecheck.** Migrate the toast and Toolbar callers. Run the Toast
tests (`--project=weasel-ui`) and the Toolbar tests (`--project=labkit`), then `npm run typecheck`.
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git commit -m "name toasts and labkit toolbar buttons by grade" -- <every path touched>
```

### Task 7: KeyDiagram's per-key `tone`

**Files:** `packages/ui/src/components/Keycaps/KeyDiagram.tsx` and its tests and stories.

- [ ] **Step 1:** Rename the mark field `tone` → `tint` (an exact color for one key, so `tint` by the
table). Update its tests and stories. Run `npx vitest run --project=weasel-ui packages/ui/src/components/Keycaps/`.
Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git commit -m "rename KeyDiagram's per-key tone to tint" -- packages/ui/src/components/Keycaps
```

### Task 8: No tone, status, or old stance left anywhere

- [ ] **Step 1: Sweep**

```bash
grep -rnE "\btone\b|ToastTone|BadgeStatus|CodeStatus|ButtonStatus|DetailRowStatus|useStance|StanceProps|TONE_REF|'scope'|'notice'|'important'|variant_primary|variant_secondary" packages apps docs --include='*.ts' --include='*.tsx' --include='*.css' --include='*.less' --include='*.md' --include='*.mdx' | grep -vE "node_modules|/dist/|generated|CHANGELOG|docs/superpowers"
```

Expected: hits only where the word means something else, such as the prose word "tone" in a
docstring about sound, or `scope` as a code scope. Fix each real hit.

- [ ] **Step 2: Gates.** Run `npm run check:size` (files a split touched stay under their allowance),
`npm run check:imports`, and `npm run typecheck`. Expected: PASS.

- [ ] **Step 3: Commit** any stragglers, by path.

### Task 9: Slider's `density` becomes numeric params

**❓ Decide before starting:** `slim` changes more than sizes. It also turns the thumb from a tab
spanning the track into a round dot centered on it, and drops its border and blur
(`Slider.module.css:102–115`). Numbers cover size and radius, not the face. The proposal below
covers the face with a radius (a round dot is a radius of half its size) and a border width of 0.
Confirm with Mike before building it.

**Files:** `packages/ui/src/components/Slider/{types.ts,SliderBody.tsx,Slider.module.css,Slider.density.test.tsx,Slider.stories.tsx}`, and the callers: `Jog.tsx:132`, `TokenPanel/Scale.tsx:163`, `Timeline/Transport.tsx:142`, forge `TransportBar.tsx:17`, labkit `LensZoom.tsx:54`, labkit `ZoomControl.tsx:50`, `apps/theme-editor/src/ThemePreview.tsx:47`, and `sliderSlop.browser.test.tsx:30`.

- [ ] **Step 1: Failing test** (rewrite `Slider.density.test.tsx`, renamed `Slider.metrics.test.tsx`):

```tsx
  it('writes each metric it is given, a number as px and a string as-is', () => {
    const { container } = render(
      <Slider {...base} trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)" thumbRadius="50%" thumbBorder={0} />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.style.getPropertyValue('--rp-track-height')).toBe('var(--wzl-slider-track-h)');
    expect(root.style.getPropertyValue('--rp-thumb-size')).toBe('var(--wzl-slider-thumb-size)');
    expect(root.style.getPropertyValue('--rp-thumb-radius')).toBe('50%');
    expect(root.style.getPropertyValue('--rp-thumb-border')).toBe('0px');
  });

  it('writes nothing it is not given', () => {
    const root = render(<Slider {...base} />).container.firstElementChild as HTMLElement;
    for (const name of ['--rp-track-height', '--rp-thumb-size', '--rp-thumb-radius', '--rp-thumb-border']) {
      expect(root.style.getPropertyValue(name)).toBe('');
    }
  });
```

- [ ] **Step 2: Implement.** In `types.ts`, `density` is deleted, `trackHeight` widens to
`number | string`, and `thumbSize`, `thumbRadius`, and `thumbBorder` (`number | string`) arrive.
`SliderBody.tsx` writes each as its `--rp-*` property, a number as `${n}px`. `Slider.module.css`:
the thumb reads `--rp-thumb-radius` and `--rp-thumb-border`. A thumb given a `--rp-thumb-size` is
centered and square at that size, replacing the `.slim .thumb` rules, which are deleted along with
the `.slim` class.

- [ ] **Step 3: Callers.** Each `density="slim"` becomes
`trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)" thumbRadius="50%" thumbBorder={0}`.
The callers repeating that set should share one constant, exported from Slider as `ROW_SLIDER_METRICS`
and spread as `{...ROW_SLIDER_METRICS}`.

- [ ] **Step 4: Tests and browser.** Run the metrics test and
`npx vitest run --project=browser packages/ui/src/components/sliderSlop.browser.test.tsx`. Then
screenshot the Jog and Transport stories in headless Chrome, before and after, and post both with
`transom post`. They must match.

- [ ] **Step 5: Commit**

```bash
git commit -m "replace Slider's density presets with numeric track and thumb params" -- <every path touched>
```

### Task 10: Docs, changeset, and merge

- [ ] **Step 1: Durable record.** Add an "Appearance props" section to `docs/conventions.md`: the
values table above, the hue chain, what cascades, and "every axis is a hint". Move the decisions with
their dates (2026-10-23) out of `HANDOFF.md` into it, and delete the handoff's "Appearance axes"
section.

- [ ] **Step 2: Changeset.** `.changeset/appearance-axes.md`, every package `patch`. The prose names
each removed prop, each removed value, and its replacement (the Old → New table), and says the
change is breaking.

- [ ] **Step 3: Fleet.** Run `npm run test:fleet`, `npm run test:gate`, and
`npm run test:fleet:postbuild -- HEAD`, each detached to a log (`nohup … > log`). Run
`npm run test:fleet:matrix -- HEAD` as well, since this touches theme build output. Each must be
green, with `fleet-tree: … match <sha>` in its log.

- [ ] **Step 4: Merge.** Merge to `main`, delete this plan, update `docs/TODO.md` if any entry names
`status`/`tone`/`stance` values, run `npm run test:fleet` on `main`, and remove the worktree and
branch.
