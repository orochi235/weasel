# Runtime Pluggable Themes — Implementation Plan (Plan B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a theme a value a consumer can define, extend, and apply at runtime — reaching DOM chrome and the WebGL HUD through one path — and retire the deprecated alias tier.

**Architecture:** `@weasel-js/theme` gains a pure resolver over *unresolved* token sources (so `extends` can rebase aliases), an `applyTheme` that stamps data attributes and adopts a generated rule block, and a React binding at a separate entry. The HUD stops reading the DOM and receives the same resolved record the CSS was built from.

**Tech Stack:** TypeScript, Vitest, tsup. React as an *optional* peer on `@weasel-js/theme`.

**Spec:** `docs/superpowers/specs/2026-08-08-dtcg-pluggable-theming-design.md` (§3–§7). Plan A (`2026-08-09-dtcg-token-source.md`) is merged. Plan C covers labkit.

---

## Prerequisites

Plan A merged (commit `2c4a4fdf`). `packages/theme/src/dtcg/{flatten,resolve,color,types}.ts` and `packages/theme/tokens/weasel/` exist.

## Design notes that drive the tasks

**Why the generator must emit raw sources.** Plan A's `THEMES` holds *resolved* strings. That is enough for the HUD but not for `extends`: a brand theme overriding `--wzl-accent-base` must see `--wzl-accent` follow, and that only works if the alias graph survives to resolution time. So the generator gains a second export, `THEME_SOURCES`, carrying the unresolved `FlatTokens` per theme. `THEMES` stays as the pre-resolved fast path for the built-in theme.

**Why `applyTheme` doesn't write inline properties.** Custom properties set via `el.style.setProperty` are inline styles, which the repo's coding rules push back on, and they lose to nothing in the cascade — making per-subtree overrides awkward. Instead `applyTheme` stamps `data-wzl-theme` / `data-wzl-mode` and ensures a rule block exists in a module-owned stylesheet. Cascade-native, no `!important`.

**Known live regression to fix first.** Plan A renamed `data-theme` → `data-wzl-mode`, but `packages/ui/src/components/Foundations/Foundations.stories.tsx:348` still sets `data-theme`. That story's light/dark swatch comparison is currently broken. `npm test` did not catch it because the `storybook` vitest project is opt-in (`npm run test:stories`).

## File Structure

**Created:** `packages/theme/src/theme.ts` (Theme type + `defineTheme`), `packages/theme/src/resolveTheme.ts`, `packages/theme/src/applyTheme.ts`, `packages/theme/src/loadDTCG.ts`, `packages/theme/src/react.tsx`, plus a `.test.ts` beside each.

**Modified:** `packages/theme/scripts/build-tokens.ts`, `packages/theme/src/index.ts`, `packages/theme/package.json`, `packages/theme/tokens/weasel/*.json`, `packages/hud/src/{theme,widget,attach,index}.ts` + hud tests, ~30 CSS Modules in `packages/ui/src/components/`, `apps/draw/src/app.css`, `packages/ui/src/components/Foundations/Foundations.stories.tsx`.

**Deleted:** `packages/hud/src/theme.ts` (folded into the shared resolved record).

---

## Task 1: Fix the `data-theme` story regression

**Files:**
- Modify: `packages/ui/src/components/Foundations/Foundations.stories.tsx:348,361`

- [ ] **Step 1: Reproduce**

```bash
npm run test:stories 2>&1 | tail -20
```

Expected: the Foundations swatch-pair story renders both halves identically (the forced-override half no longer flips), or fails its assertion. Note whichever you see — that is the bug.

- [ ] **Step 2: Rename the attribute**

Line 348, `data-theme={theme}` → `data-wzl-mode={theme}`. Line 361's prose says "a forced data-theme override" — change to "a forced data-wzl-mode override".

- [ ] **Step 3: Verify**

```bash
npm run test:stories 2>&1 | tail -20
```

Expected: PASS, and the two swatch halves visibly differ again.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/Foundations/Foundations.stories.tsx
git commit -m "fix(ui): Foundations story uses the renamed mode attribute

Plan A renamed data-theme to data-wzl-mode; this story was the one
consumer and was missed because the storybook vitest project is opt-in."
```

- [ ] **Step 5: Close the gap that hid it**

Add `test:stories` to the `prepublishOnly` chain in the root `package.json`, after `test`:

```json
"prepublishOnly": "npm run typecheck && npm run lint && npm run test && npm run test:stories && npm run build && npm run check:manifests && npm run test:smoke:consumer"
```

This is the gate that should have caught it. Commit separately:

```bash
git add package.json
git commit -m "chore: run story tests in the publish gate"
```

---

## Task 2: Generator emits unresolved token sources

**Files:**
- Modify: `packages/theme/scripts/build-tokens.ts`
- Test: `packages/theme/src/generated/generated.test.ts`

- [ ] **Step 1: Add the failing assertion**

Append to the `generated themes.ts` describe block in
`packages/theme/src/generated/generated.test.ts`:

```ts
  it('exposes unresolved sources so extends can rebase aliases', async () => {
    const { THEME_SOURCES } = await import('./themes');
    // --wzl-accent is an alias, not a literal, in the source form.
    expect(THEME_SOURCES.weasel.primitives['accent'].value).toBe('{color.accent-base}');
    // Mode layers carry only what differs.
    expect(Object.keys(THEME_SOURCES.weasel.modes.dark)).toContain('surface');
    expect(Object.keys(THEME_SOURCES.weasel.modes.dark)).not.toContain('gray-50');
  });
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/generated/
```

Expected: FAIL — `THEME_SOURCES` is not exported.

- [ ] **Step 3: Emit it**

In `emitThemes` in `packages/theme/scripts/build-tokens.ts`, add a second export
after `THEMES`. Insert before the closing `].join('\n')`:

```ts
    '',
    'export interface ThemeSource {',
    '  readonly primitives: Readonly<Record<string, RawToken>>;',
    '  readonly modes: Readonly<Record<string, Readonly<Record<string, RawToken>>>>;',
    '}',
    '',
    'export const THEME_SOURCES: Readonly<Record<string, ThemeSource>> = ' +
      `${JSON.stringify(
        Object.fromEntries(
          themes.map(({ manifest, primitives, modes }) => [manifest.name, { primitives, modes }]),
        ),
        null,
        2,
      )};`,
```

and add the type import at the top of the emitted file by prepending to the
returned array:

```ts
    "import type { RawToken } from '../dtcg/types';",
    '',
```

- [ ] **Step 4: Regenerate and verify**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run --project=weasel-ui packages/theme/src/generated/
```

Expected: PASS (11 tests). The determinism test must also still pass.

- [ ] **Step 5: Commit**

```bash
git add packages/theme
git commit -m "feat(theme): generate unresolved token sources for extends"
```

---

## Task 3: `defineTheme` and the Theme type

**Files:**
- Create: `packages/theme/src/theme.ts`
- Test: `packages/theme/src/theme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/theme.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defineTheme, weaselTheme } from './theme';

describe('defineTheme', () => {
  it('defaults to extending the built-in theme', () => {
    const t = defineTheme({ name: 'acme', modes: {} });
    expect(t.extends).toBe(weaselTheme);
    expect(t.defaultMode).toBe('dark');
  });

  it('accepts a partial mode layer', () => {
    const t = defineTheme({
      name: 'acme',
      modes: { dark: { 'accent-base': '#ff0000' } },
    });
    expect(t.modes.dark['accent-base']).toEqual({
      type: 'color', value: '#ff0000', alpha: undefined, description: undefined,
    });
  });

  it('accepts mode-invariant tokens', () => {
    const t = defineTheme({ name: 'acme', tokens: { 'radius-md': '9px' }, modes: {} });
    expect(t.tokens['radius-md'].value).toBe('9px');
  });

  it('can opt out of the base entirely', () => {
    const t = defineTheme({ name: 'bare', extends: null, modes: {} });
    expect(t.extends).toBeNull();
  });

  it('exposes the built-in theme with both modes', () => {
    expect(Object.keys(weaselTheme.modes).sort()).toEqual(['dark', 'light']);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/theme.test.ts
```

Expected: FAIL — cannot resolve `./theme`.

- [ ] **Step 3: Write `theme.ts`**

```ts
import type { FlatTokens, RawToken } from './dtcg/types';
import { THEME_SOURCES } from './generated/themes';

/** Authoring shorthand: a bare string is a literal or a `{ref}`. */
export type TokenInput = string | number | RawToken;

export interface ThemeInput {
  readonly name: string;
  /** Base to layer onto. Defaults to `weaselTheme`; `null` opts out. */
  readonly extends?: Theme | null;
  readonly defaultMode?: string;
  /** Mode-invariant overrides. */
  readonly tokens?: Readonly<Record<string, TokenInput>>;
  readonly modes: Readonly<Record<string, Readonly<Record<string, TokenInput>>>>;
}

export interface Theme {
  readonly name: string;
  readonly extends: Theme | null;
  readonly defaultMode: string;
  readonly tokens: FlatTokens;
  readonly modes: Readonly<Record<string, FlatTokens>>;
}

function normalize(input: Readonly<Record<string, TokenInput>>): FlatTokens {
  const out: FlatTokens = {};
  for (const [name, v] of Object.entries(input)) {
    out[name] =
      typeof v === 'object'
        ? v
        : { type: 'unknown', value: v, alpha: undefined, description: undefined };
  }
  return out;
}

/** The built-in theme, materialized from the generated source. */
export const weaselTheme: Theme = {
  name: 'weasel',
  extends: null,
  defaultMode: 'dark',
  tokens: THEME_SOURCES.weasel.primitives as FlatTokens,
  modes: THEME_SOURCES.weasel.modes as Record<string, FlatTokens>,
};

export function defineTheme(input: ThemeInput): Theme {
  const base = input.extends === undefined ? weaselTheme : input.extends;
  const modes: Record<string, FlatTokens> = {};
  for (const [mode, tokens] of Object.entries(input.modes)) modes[mode] = normalize(tokens);
  return {
    name: input.name,
    extends: base,
    defaultMode: input.defaultMode ?? base?.defaultMode ?? 'dark',
    tokens: normalize(input.tokens ?? {}),
    modes,
  };
}
```

`type: 'unknown'` is honest: an authoring shorthand carries no DTCG type, and
nothing downstream needs one — `serialize` only branches on type for array
values, and a shorthand string is never an array.

- [ ] **Step 4: Run to confirm it passes**

```bash
npx vitest run --project=weasel-ui packages/theme/src/theme.test.ts
```

Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/theme.ts packages/theme/src/theme.test.ts
git commit -m "feat(theme): Theme type and defineTheme with extends"
```

---

## Task 4: `resolveTheme`

**Files:**
- Create: `packages/theme/src/resolveTheme.ts`
- Test: `packages/theme/src/resolveTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/resolveTheme.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { defineTheme, weaselTheme } from './theme';
import { resolveTheme } from './resolveTheme';

describe('resolveTheme', () => {
  it('resolves the built-in theme per mode', () => {
    expect(resolveTheme(weaselTheme, 'dark')['--wzl-surface']).toBe('#181a1e');
    expect(resolveTheme(weaselTheme, 'light')['--wzl-surface']).toBe('#f5f5f6');
  });

  it('rebases aliases when a base primitive is overridden', () => {
    const acme = defineTheme({ name: 'acme', tokens: { 'accent-base': '#ff0000' }, modes: {} });
    // --wzl-accent aliases {color.accent-base}, so it must follow the override.
    expect(resolveTheme(acme, 'dark')['--wzl-accent']).toBe('#ff0000');
  });

  it('inherits every unspecified token from the base', () => {
    const acme = defineTheme({ name: 'acme', modes: {} });
    expect(resolveTheme(acme, 'dark')['--wzl-radius-md']).toBe('5px');
  });

  it('lets a mode layer win over mode-invariant tokens', () => {
    const acme = defineTheme({
      name: 'acme',
      tokens: { surface: '#111111' },
      modes: { light: { surface: '#eeeeee' } },
    });
    expect(resolveTheme(acme, 'light')['--wzl-surface']).toBe('#eeeeee');
    expect(resolveTheme(acme, 'dark')['--wzl-surface']).toBe('#111111');
  });

  it('falls back to defaultMode for an unknown mode', () => {
    expect(resolveTheme(weaselTheme, 'nope')['--wzl-surface']).toBe('#181a1e');
  });

  it('throws naming the token when a theme opts out of the base and is incomplete', () => {
    const bare = defineTheme({ name: 'bare', extends: null, modes: { dark: { fg: '{color.nope}' } } });
    expect(() => resolveTheme(bare, 'dark')).toThrow(/nope/);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/resolveTheme.test.ts
```

Expected: FAIL — cannot resolve `./resolveTheme`.

- [ ] **Step 3: Write `resolveTheme.ts`**

```ts
import { resolveTokens } from './dtcg/resolve';
import type { FlatTokens } from './dtcg/types';
import type { Theme } from './theme';
import type { TokenName } from './generated/themes';

export type ResolvedTheme = Readonly<Record<TokenName, string>>;

/** Root-first so the leaf theme's overrides land last. */
function chain(theme: Theme): Theme[] {
  const out: Theme[] = [];
  for (let t: Theme | null = theme; t; t = t.extends) out.unshift(t);
  return out;
}

/**
 * Merge the extends chain, layer the mode over it, resolve every alias, and
 * key the result by CSS custom-property name.
 *
 * Pure — no DOM. An unresolvable reference throws rather than falling back.
 */
export function resolveTheme(theme: Theme, mode: string): ResolvedTheme {
  const themes = chain(theme);
  const effectiveMode = mode in theme.modes || themes.some((t) => mode in t.modes)
    ? mode
    : theme.defaultMode;

  let merged: FlatTokens = {};
  for (const t of themes) merged = { ...merged, ...t.tokens };
  for (const t of themes) merged = { ...merged, ...(t.modes[effectiveMode] ?? {}) };

  const resolved = resolveTokens(merged);
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(resolved)) out[`--wzl-${name}`] = value;
  return out as ResolvedTheme;
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npx vitest run --project=weasel-ui packages/theme/src/resolveTheme.test.ts
```

Expected: PASS (6 tests). If "rebases aliases" fails, `THEME_SOURCES` is
handing back resolved strings rather than the raw alias — recheck Task 2.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/resolveTheme.ts packages/theme/src/resolveTheme.test.ts
git commit -m "feat(theme): resolveTheme — extends chain, mode layering, alias rebase"
```

---

## Task 5: `applyTheme`

**Files:**
- Create: `packages/theme/src/applyTheme.ts`
- Test: `packages/theme/src/applyTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/applyTheme.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { defineTheme, weaselTheme } from './theme';

describe('applyTheme', () => {
  beforeEach(() => {
    document.head.innerHTML = '';
    document.adoptedStyleSheets = [];
    __resetThemeSheet();
  });

  it('stamps the theme and mode attributes', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, 'light');
    expect(el.getAttribute('data-wzl-theme')).toBe('weasel');
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('writes no inline custom properties', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, 'light');
    expect(el.getAttribute('style')).toBeNull();
  });

  it('emits one rule block per (theme, mode) pair, not per call', () => {
    const el = document.createElement('div');
    applyTheme(el, weaselTheme, 'light');
    applyTheme(el, weaselTheme, 'light');
    applyTheme(document.createElement('div'), weaselTheme, 'light');
    expect(readSheetText().match(/data-wzl-theme='weasel'\]\[data-wzl-mode='light'/g)).toHaveLength(1);
  });

  it('emits a distinct block for a custom theme', () => {
    const acme = defineTheme({ name: 'acme', tokens: { 'accent-base': '#ff0000' }, modes: {} });
    applyTheme(document.createElement('div'), acme, 'dark');
    const text = readSheetText();
    expect(text).toContain("data-wzl-theme='acme'");
    expect(text).toContain('--wzl-accent: #ff0000');
  });
});

/** Read whichever delivery mechanism applyTheme chose. */
function readSheetText(): string {
  const adopted = document.adoptedStyleSheets
    .flatMap((s) => [...s.cssRules].map((r) => r.cssText))
    .join('\n');
  const styleEl = document.getElementById('wzl-themes')?.textContent ?? '';
  return adopted + styleEl;
}
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/applyTheme.test.ts
```

Expected: FAIL — cannot resolve `./applyTheme`.

- [ ] **Step 3: Write `applyTheme.ts`**

```ts
import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const STYLE_ID = 'wzl-themes';
const emitted = new Set<string>();
let sheet: CSSStyleSheet | null = null;
let styleEl: HTMLStyleElement | null = null;

/** Test seam — drops the module-level cache so each case starts clean. */
export function __resetThemeSheet(): void {
  emitted.clear();
  sheet = null;
  styleEl = null;
}

function appendRule(css: string): void {
  // Constructable stylesheets where available; a <style> element otherwise.
  if (typeof CSSStyleSheet !== 'undefined' && 'replaceSync' in CSSStyleSheet.prototype) {
    if (!sheet) {
      sheet = new CSSStyleSheet();
      document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet];
    }
    sheet.insertRule(css, sheet.cssRules.length);
    return;
  }
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = STYLE_ID;
    document.head.appendChild(styleEl);
  }
  styleEl.textContent += `${css}\n`;
}

/**
 * Apply `theme` at `mode` to `el`'s subtree.
 *
 * Stamps two data attributes and ensures a matching rule block exists in a
 * module-owned stylesheet. Deliberately not inline properties: the cascade
 * then does the work, per-subtree overrides are just a different theme name,
 * and no `!important` is ever needed. No-op outside a DOM.
 */
export function applyTheme(el: HTMLElement, theme: Theme, mode: string): void {
  if (typeof document === 'undefined') return;

  const key = `${theme.name}::${mode}`;
  if (!emitted.has(key)) {
    const resolved = resolveTheme(theme, mode);
    const body = Object.entries(resolved)
      .map(([name, value]) => `${name}: ${value};`)
      .join(' ');
    appendRule(`[data-wzl-theme='${theme.name}'][data-wzl-mode='${mode}'] { ${body} }`);
    emitted.add(key);
  }

  el.setAttribute('data-wzl-theme', theme.name);
  el.setAttribute('data-wzl-mode', mode);
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npx vitest run --project=weasel-ui packages/theme/src/applyTheme.test.ts
```

Expected: PASS (4 tests). If jsdom rejects `insertRule` on a constructed sheet,
the feature detection is wrong for this environment — make the detection also
require `document.adoptedStyleSheets` to be an array, and the `<style>` fallback
will carry the tests.

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/applyTheme.ts packages/theme/src/applyTheme.test.ts
git commit -m "feat(theme): applyTheme via adopted stylesheet, not inline props"
```

---

## Task 6: `loadDTCG`

**Files:**
- Create: `packages/theme/src/loadDTCG.ts`
- Test: `packages/theme/src/loadDTCG.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/loadDTCG.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { loadDTCG } from './loadDTCG';
import { resolveTheme } from './resolveTheme';

describe('loadDTCG', () => {
  it('builds a Theme from a DTCG document', () => {
    const theme = loadDTCG({
      name: 'acme',
      defaultMode: 'dark',
      primitives: { color: { $type: 'color', 'accent-base': { $value: '#ff0000' } } },
      modes: { dark: { color: { $type: 'color', surface: { $value: '#000000' } } } },
    });
    expect(theme.name).toBe('acme');
    expect(resolveTheme(theme, 'dark')['--wzl-accent']).toBe('#ff0000');
    expect(resolveTheme(theme, 'dark')['--wzl-surface']).toBe('#000000');
  });

  it('throws on a document with no name', () => {
    expect(() => loadDTCG({ primitives: {}, modes: {} })).toThrow(/name/i);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/loadDTCG.test.ts
```

Expected: FAIL — cannot resolve `./loadDTCG`.

- [ ] **Step 3: Write `loadDTCG.ts`**

```ts
import { flattenTokens } from './dtcg/flatten';
import type { FlatTokens } from './dtcg/types';
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
 * exported by a design tool rather than authored in TS.
 */
export function loadDTCG(doc: DtcgDocument): Theme {
  if (typeof doc.name !== 'string' || doc.name === '') {
    throw new Error('DTCG document needs a string "name"');
  }
  const modes: Record<string, FlatTokens> = {};
  for (const [mode, body] of Object.entries(doc.modes ?? {})) {
    modes[mode] = flattenTokens(body);
  }
  const base = doc.extends === undefined ? weaselTheme : doc.extends;
  return {
    name: doc.name,
    extends: base,
    defaultMode: typeof doc.defaultMode === 'string' ? doc.defaultMode : (base?.defaultMode ?? 'dark'),
    tokens: flattenTokens(doc.primitives ?? {}),
    modes,
  };
}
```

- [ ] **Step 4: Run to confirm it passes**

```bash
npx vitest run --project=weasel-ui packages/theme/src/loadDTCG.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add packages/theme/src/loadDTCG.ts packages/theme/src/loadDTCG.test.ts
git commit -m "feat(theme): loadDTCG for design-tool interchange"
```

---

## Task 7: React entry

**Files:**
- Create: `packages/theme/src/react.tsx`
- Test: `packages/theme/src/react.test.tsx`
- Modify: `packages/theme/package.json`, `packages/theme/tsup.config.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/theme/src/react.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ThemeProvider, useTheme } from './react';
import { defineTheme } from './theme';

function Probe(): React.ReactElement {
  const { resolved, mode, theme } = useTheme();
  return <span data-testid="p">{`${theme.name}/${mode}/${resolved['--wzl-surface']}`}</span>;
}

describe('ThemeProvider', () => {
  it('provides the resolved theme to descendants', () => {
    render(
      <ThemeProvider mode="light">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('weasel/light/#f5f5f6');
  });

  it('applies to its own wrapper element', () => {
    const { container } = render(
      <ThemeProvider mode="light">
        <span />
      </ThemeProvider>,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute('data-wzl-mode')).toBe('light');
  });

  it('carries a custom theme through', () => {
    const acme = defineTheme({ name: 'acme', tokens: { surface: '#123456' }, modes: {} });
    render(
      <ThemeProvider theme={acme} mode="dark">
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('acme/dark/#123456');
  });

  it('defaults to the built-in theme and its default mode', () => {
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId('p').textContent).toBe('weasel/dark/#181a1e');
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/react.test.tsx
```

Expected: FAIL — cannot resolve `./react`.

- [ ] **Step 3: Write `react.tsx`**

```tsx
import React, { createContext, useContext, useMemo, useRef, useLayoutEffect } from 'react';
import { applyTheme } from './applyTheme';
import { resolveTheme, type ResolvedTheme } from './resolveTheme';
import { weaselTheme, type Theme } from './theme';

export interface ThemeContextValue {
  readonly theme: Theme;
  readonly mode: string;
  readonly resolved: ResolvedTheme;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  readonly theme?: Theme;
  readonly mode?: string;
  readonly children: React.ReactNode;
}

/**
 * Applies a theme to a wrapper element and publishes the resolved record.
 *
 * Consumers that draw outside the DOM (the WebGL HUD) read `resolved` and
 * never touch `getComputedStyle`.
 */
export function ThemeProvider({ theme = weaselTheme, mode, children }: ThemeProviderProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null);
  const effectiveMode = mode ?? theme.defaultMode;

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, mode: effectiveMode, resolved: resolveTheme(theme, effectiveMode) }),
    [theme, effectiveMode],
  );

  useLayoutEffect(() => {
    if (ref.current) applyTheme(ref.current, theme, effectiveMode);
  }, [theme, effectiveMode]);

  return (
    <ThemeContext.Provider value={value}>
      <div ref={ref} data-wzl-theme={theme.name} data-wzl-mode={effectiveMode}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a <ThemeProvider>');
  return ctx;
}
```

The attributes are set in JSX *and* by `applyTheme` — the JSX pair makes the
first paint correct before the effect runs; `applyTheme` is what guarantees the
rule block exists.

- [ ] **Step 4: Add the entry point**

`packages/theme/package.json` — add to `exports`:

```json
    "./react": {
      "import": "./dist/react.js",
      "types": "./dist/react.d.ts"
    },
```

add React as an *optional* peer:

```json
  "peerDependencies": { "react": ">=18" },
  "peerDependenciesMeta": { "react": { "optional": true } },
```

and add the entry in `packages/theme/tsup.config.ts`:

```ts
export default defineConfig(
  packagePreset({ entry: { index: 'src/index.ts', react: 'src/react.tsx' }, external: ['react'] }),
);
```

- [ ] **Step 5: Verify**

```bash
npx vitest run --project=weasel-ui packages/theme/src/react.test.tsx
npm run build -w @weasel-js/theme
npm run check:manifests
```

Expected: 4 tests PASS; build emits `dist/react.js` + `dist/react.d.ts`; manifest
check OK with the new advertised path.

- [ ] **Step 6: Commit**

```bash
git add packages/theme
git commit -m "feat(theme): React binding at @weasel-js/theme/react

React is an optional peer so the core entry stays framework-free and
both ui and hud can import the context without depending on each other."
```

---

## Task 8: Add the three real semantic tokens

**Files:**
- Modify: `packages/theme/tokens/weasel/primitives.tokens.json`, `modes/dark.tokens.json`, `modes/light.tokens.json`
- Modify: `packages/theme/src/dtcg/source.test.ts`

- [ ] **Step 1: Update the parity list**

`source.test.ts`'s `LEGACY_NAMES` pins the pre-DTCG vocabulary. Rename the const
to `EXPECTED_NAMES`, drop the 16 deprecated entries (`text`, `text-muted`, `bg`,
`muted`, `panel-bg`, `panel-border`, `input-bg`, `track-bg`, `track-border`,
`thumb-fill`, `thumb-border`, `thumb-text`, `button-fill`, `button-fill-hover`,
`button-fill-pressed`, `button-text`), and add the three replacements:

```ts
  'fg-inverse', 'surface-hover', 'surface-pressed',
```

Update the test name to `'declares exactly the intended token vocabulary'`.

- [ ] **Step 2: Run it to confirm it fails**

```bash
npx vitest run --project=weasel-ui packages/theme/src/dtcg/source.test.ts
```

Expected: FAIL — the source still declares the deprecated tier and lacks the
three new names.

- [ ] **Step 3: Add the new tokens**

In `primitives.tokens.json`, delete the entire deprecated block (from `"text"`
through `"button-text"`) and add in its place:

```json
    "surface-hover":   { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.10 }, "$description": "Hover wash over a raised surface. Same formula as line-subtle, different job — do not collapse them." },
    "surface-pressed": { "$value": "{color.fg}", "$extensions": { "com.weasel.alpha": 0.18 }, "$description": "Pressed wash over a raised surface." },
```

In both mode files, replace `"thumb-text"` with `"fg-inverse"` — dark keeps
`{color.gray-900}`, light keeps `{color.gray-50}`:

```json
    "fg-inverse": { "$value": "{color.gray-900}", "$description": "Text drawn on a filled foreground-colored element (e.g. a slider thumb). Flips with the mode, so it is a semantic, not an alias to a primitive." },
```

- [ ] **Step 4: Regenerate and verify**

```bash
npm run gen:tokens -w @weasel-js/theme
npx vitest run --project=weasel-ui packages/theme/
```

Expected: `source.test.ts` PASSES. `generated.test.ts` and `determinism.test.ts`
still pass. **Other packages will now fail to render correctly** — the aliases
are gone and Task 9 migrates their call sites. Do not run the full suite yet.

- [ ] **Step 5: Commit**

```bash
git add packages/theme
git commit -m "feat(theme): fg-inverse, surface-hover, surface-pressed; drop the alias tier

Three of the sixteen deprecated aliases were not aliases. thumb-text
flips between modes, so it is a semantic (fg-inverse). The two button
fills are alpha-over-fg values that happen to compute to line-subtle's
result while meaning something entirely different."
```

---

## Task 9: Migrate the ~264 call sites

**Files:**
- Modify: ~30 CSS Modules under `packages/ui/src/components/`, plus `apps/draw/src/**`, `packages/hud/src/**`

- [ ] **Step 1: Record the before state**

```bash
grep -rhoE 'var\(--wzl-(text|text-muted|bg|muted|panel-bg|panel-border|input-bg|track-bg|track-border|thumb-fill|thumb-border|thumb-text|button-fill|button-fill-hover|button-fill-pressed|button-text)[,)]' packages apps --include="*.css" --include="*.tsx" --include="*.ts" | grep -v node_modules | wc -l
```

Expected: 264.

- [ ] **Step 2: Run the codemod**

Write and run `/tmp/alias-codemod.mjs`:

```js
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

// Order matters: longer names first, so --wzl-text-muted is not eaten by --wzl-text.
const MAP = [
  ['button-fill-pressed', 'surface-pressed'],
  ['button-fill-hover', 'surface-hover'],
  ['button-fill', 'surface-raised'],
  ['button-text', 'fg'],
  ['panel-border', 'border'],
  ['panel-bg', 'surface'],
  ['input-bg', 'surface-sunken'],
  ['track-border', 'border'],
  ['track-bg', 'surface-sunken'],
  ['thumb-border', 'border-strong'],
  ['thumb-fill', 'fg-muted'],
  ['thumb-text', 'fg-inverse'],
  ['text-muted', 'fg-muted'],
  ['text', 'fg'],
  ['muted', 'fg-muted'],
  ['bg', 'surface'],
];

const files = execFileSync('git', ['ls-files', 'packages', 'apps'], { encoding: 'utf8' })
  .split('\n')
  .filter((f) => /\.(css|tsx?|less)$/.test(f));

let changed = 0;
for (const file of files) {
  const before = readFileSync(file, 'utf8');
  let after = before;
  for (const [from, to] of MAP) {
    // Match the whole var() call so an inline fallback is dropped with it.
    after = after.replace(
      new RegExp(`var\\(\\s*--wzl-${from}\\s*(?:,[^)]*)?\\)`, 'g'),
      `var(--wzl-${to})`,
    );
  }
  if (after !== before) {
    writeFileSync(file, after);
    changed++;
  }
}
console.log(`rewrote ${changed} files`);
```

```bash
node /tmp/alias-codemod.mjs
```

- [ ] **Step 3: Verify none remain**

```bash
grep -rnE 'var\(--wzl-(text|text-muted|bg|muted|panel-bg|panel-border|input-bg|track-bg|track-border|thumb-fill|thumb-border|thumb-text|button-fill|button-fill-hover|button-fill-pressed|button-text)[,)]' packages apps --include="*.css" --include="*.tsx" --include="*.ts" | grep -v node_modules | grep -v "/dist/"
```

Expected: no output. Any hit is a name the regex missed — fix by hand.

- [ ] **Step 4: Verify nothing rendered moved**

```bash
npm run typecheck && npx vitest run --project=weasel-ui && npm run test:visual
```

Expected: all pass. Every mapping is value-preserving by construction —
`--wzl-muted` *was* `var(--wzl-fg-muted)` — so a visual diff means a mapping is
wrong, not that a baseline needs updating. **Do not run `test:visual:update`.**

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "refactor: migrate 264 deprecated alias references

Every mapping is value-preserving — each alias was already a var() of
its replacement. Inline var() fallbacks are dropped with the rewrite;
the tokens are always defined."
```

---

## Task 10: HUD reads the resolved theme

**Files:**
- Delete: `packages/hud/src/theme.ts`
- Modify: `packages/hud/src/{widget,attach,index}.ts`, `packages/hud/src/theme.test.ts` → delete, `packages/hud/src/widgets/*.test.ts`, `packages/hud/src/integration.test.tsx`

- [ ] **Step 1: Widen the widget context type**

`packages/hud/src/widget.ts:2,19` — replace the local import with the shared one:

```ts
import type { ResolvedTheme } from '@weasel-js/theme';
// …
  tokens: ResolvedTheme;
```

- [ ] **Step 2: Update the five field reads**

The HUD reads only five fields across 19 sites. Rewrite each to the token name:

| was | becomes |
|---|---|
| `tokens.text` (7) | `tokens['--wzl-fg']` |
| `tokens.buttonFill` (5) | `tokens['--wzl-surface-raised']` |
| `tokens.buttonText` (3) | `tokens['--wzl-fg']` |
| `tokens.buttonFillPressed` (2) | `tokens['--wzl-surface-pressed']` |
| `tokens.buttonFillHover` (2) | `tokens['--wzl-surface-hover']` |

```bash
grep -rn "tokens\.\(text\|buttonFill\|buttonText\|buttonFillPressed\|buttonFillHover\)" packages/hud/src
```

- [ ] **Step 3: Replace the DOM bridge**

`packages/hud/src/attach.ts:9,41` — drop `import { readTokens } from './theme'` and
take the theme from the caller instead:

```ts
import { resolveTheme, weaselTheme, type ResolvedTheme } from '@weasel-js/theme';
// …
      const ctx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens: theme };
```

where `theme: ResolvedTheme` is a new option on the attach call, defaulting to
`resolveTheme(weaselTheme, weaselTheme.defaultMode)`. This is the change that
makes headless rendering themeable.

- [ ] **Step 4: Retire the module and its export**

```bash
git rm packages/hud/src/theme.ts packages/hud/src/theme.test.ts
```

`packages/hud/src/index.ts:18` — replace

```ts
export { readTokens, type ResolvedTokens } from './theme';
```

with a re-export of the shared type so existing importers have a target:

```ts
export type { ResolvedTheme } from '@weasel-js/theme';
```

- [ ] **Step 5: Update the test fixtures**

Five test files build a default fixture via `readTokens(null)`. Replace each:

```ts
import { resolveTheme, weaselTheme } from '@weasel-js/theme';
const DEFAULT_RESOLVED_TOKENS = resolveTheme(weaselTheme, 'dark');
```

Files: `widgets/rect.test.ts`, `widgets/image.test.ts`, `widgets/label.test.ts`,
`widgets/text.test.ts`, `widgets/button.test.ts`, and `integration.test.tsx`
(which also calls `readTokens(canvas)` at line 133 — use the same resolved
record).

- [ ] **Step 6: Verify**

```bash
npx vitest run --project=weasel-ui packages/hud
npm run typecheck
npm run test:visual
```

Expected: all pass. The HUD now renders from the same record the CSS was built
from, with no `getComputedStyle` anywhere.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor(hud): read the resolved theme instead of the DOM

Deletes the getComputedStyle bridge and its 16-field ResolvedTokens
struct, every entry of which pointed at a now-deleted alias. Widgets read
token names directly, and attach() takes the theme as an option — which
is what makes headless render and node tests themeable."
```

---

## Task 11: `apps/draw` becomes a theme, and light mode gets a switch

**Files:**
- Modify: `apps/draw/src/app.css:6-11`
- Create: `apps/draw/src/theme.ts`
- Modify: `apps/draw/src/App.tsx`, `apps/draw/src/main.tsx`

- [ ] **Step 1: Define the app's theme**

Create `apps/draw/src/theme.ts`:

```ts
import { defineTheme } from '@weasel-js/theme';

/** WeaselDraw's chrome palette, as a real theme rather than a parallel prefix. */
export const drawTheme = defineTheme({
  name: 'weasel-draw',
  modes: {},
  tokens: {
    'chrome-bg': '{color.surface}',
    'chrome-border': '{color.border}',
    'app-accent': '{color.accent-strong}',
  },
});
```

`--wd-accent-bg` was `color-mix(… 22%, transparent)`; express it with the alpha
extension instead of a literal:

```ts
    'app-accent-bg': { type: 'color', value: '{color.accent-strong}', alpha: 0.22, description: undefined },
```

- [ ] **Step 2: Point the CSS at the new names**

In `apps/draw/src/app.css`, delete the four `--wd-*` declarations at lines 6–11.
Then rewrite every `var(--wd-X)` reference to its `--wzl-` counterpart:

```bash
grep -rn -- "--wd-" apps/draw/src | grep -v node_modules
```

| was | becomes |
|---|---|
| `--wd-accent` | `--wzl-app-accent` |
| `--wd-accent-bg` | `--wzl-app-accent-bg` |
| `--wd-chrome-bg` | `--wzl-chrome-bg` |
| `--wd-chrome-border` | `--wzl-chrome-border` |

- [ ] **Step 3: Apply it at the root**

In `apps/draw/src/main.tsx`, wrap the app:

```tsx
import { ThemeProvider } from '@weasel-js/theme/react';
import { drawTheme } from './theme';
// …
  <ThemeProvider theme={drawTheme} mode={mode}>
    <App />
  </ThemeProvider>
```

- [ ] **Step 4: Wire a mode toggle**

Nothing currently sets a mode, so light mode is unreachable. Hold `mode` in
state, defaulting from `matchMedia('(prefers-color-scheme: light)')`, and add a
toggle to the existing status bar next to the build-info span
(`apps/draw/src/App.tsx`). Persist to `localStorage` under `wd-mode`.

- [ ] **Step 5: Verify by eye**

```bash
npm run dev:draw
```

Open the app, toggle the control, and confirm chrome, panels, and the canvas
HUD all flip together — the HUD flipping is the proof that one override point
reaches every surface.

- [ ] **Step 6: Verify by test**

```bash
npm run typecheck && npx vitest run --project=draw && npm run test:visual
```

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(draw): app palette is a theme; wire a light/dark toggle

Replaces the parallel --wd-* prefix with an extends-based theme and
gives light mode a switch — it has been reachable only by hand-editing
an attribute since the mode axis landed."
```

---

## Task 12: Public surface, docs, changeset

**Files:**
- Modify: `packages/theme/src/index.ts`, `packages/theme/README.md`, `docs/TODO.md`, `docs/extending.md`
- Create: `.changeset/runtime-pluggable-themes.md`

- [ ] **Step 1: Export the new surface**

`packages/theme/src/index.ts` — append:

```ts
export { defineTheme, weaselTheme, type Theme, type ThemeInput, type TokenInput } from './theme';
export { resolveTheme, type ResolvedTheme } from './resolveTheme';
export { applyTheme } from './applyTheme';
export { loadDTCG } from './loadDTCG';
```

Do **not** export `__resetThemeSheet` — it is a test seam.

`DEFAULT_TOKENS` can now go: its only consumer was the HUD bridge deleted in
Task 10. Confirm and remove:

```bash
grep -rn "DEFAULT_TOKENS" packages apps --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "/dist/"
```

- [ ] **Step 2: Document theme authoring**

Add a "Custom themes" section to `packages/theme/README.md`:

````markdown
## Custom themes

```ts
import { defineTheme, applyTheme } from '@weasel-js/theme';

const acme = defineTheme({
  name: 'acme',
  tokens: { 'accent-base': '#ff3366' },   // aliases rebase onto it
  modes: { light: { surface: '#fffdf8' } },
});

applyTheme(document.documentElement, acme, 'light');
```

`extends` defaults to the built-in theme, so a partial theme can never be
accidentally incomplete. Overriding a primitive rebases every alias that
references it — set `accent-base` and `--wzl-accent`, `--wzl-accent-hover`,
`--wzl-focus-ring` and `--wzl-glass-tint` all follow.

Themes exported from a design tool load through `loadDTCG(json)`.

In React, `<ThemeProvider theme={acme} mode="light">` from
`@weasel-js/theme/react` does the same and publishes the resolved record via
`useTheme()` — which is how canvas and WebGL surfaces stay in sync without
reading the DOM.
````

- [ ] **Step 3: Update the TODO**

In `docs/TODO.md`, mark Plan B done in the P1 Theming entry and leave Plan C as
the remaining item.

- [ ] **Step 4: Write the changeset**

Create `.changeset/runtime-pluggable-themes.md`:

```markdown
---
"@weasel-js/theme": minor
"@weasel-js/hud": minor
"@weasel-js/ui": patch
---

Themes are values you can define, extend, and apply.

`defineTheme` / `resolveTheme` / `applyTheme` / `loadDTCG`, plus a React
binding at `@weasel-js/theme/react`. A theme extends the built-in one by
default, so a partial theme can't be incomplete; overriding a primitive
rebases every alias that references it. `applyTheme` stamps data attributes
and adopts a rule block rather than writing inline properties, so the cascade
still does the work and per-subtree overrides are just a different theme name.

The WebGL HUD no longer reads CSS custom properties through
`getComputedStyle`. It receives the same resolved record the stylesheet was
built from, which also makes headless rendering themeable for the first time.
`readTokens` and `ResolvedTokens` are gone from `@weasel-js/hud`; use
`ResolvedTheme` and pass a theme to `attach`.

The sixteen deprecated `--wzl-*` aliases are removed (264 call sites migrated).
Three were never aliases and became real semantics: `--wzl-fg-inverse`,
`--wzl-surface-hover`, `--wzl-surface-pressed`.
```

- [ ] **Step 5: Full gate**

```bash
npm run typecheck && npm run lint && npm test && npm run test:stories && npm run build && npm run check:manifests && npm run test:smoke:consumer && npm run test:visual
```

Expected: all clean.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "docs(theme): document custom themes and the runtime API"
```

---

## Done when

- A consumer can write `defineTheme({...})` and see it reach DOM chrome and the
  WebGL HUD through one call.
- `getComputedStyle` appears nowhere in `packages/hud`.
- No `--wzl-*` deprecated alias remains, and the three replacements are real
  mode-aware semantics.
- `apps/draw` has no `--wd-*` prefix and light mode has a working switch.
- `npm run test:visual` passes unchanged throughout — every migration step is
  value-preserving.
