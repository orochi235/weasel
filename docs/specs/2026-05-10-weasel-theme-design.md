# weasel-theme design

**Date:** 2026-05-10
**Status:** Spec — ready for plan

## Problem

weasel has two consumer-facing widget packages today:

- **weasel-ui** — DOM/React components (PropertiesPanel, RangePicker, …). Themed via
  CSS variables in `packages/ui/src/tokens.css` (the `--wui-*` namespace).
- **weasel-hud** — WebGL widgets rendered into the canvas (button, label, rect, text,
  image). Themed inline: every widget option (`fill`, `pressedFill`, `textColor`,
  …) is a separate hex string the consumer either supplies per widget or accepts
  the hardcoded default for.

An app using both packages has to define one palette in CSS *and* repeat the same
colors in JS widget options to get visual consistency. Adding light/dark mode
means doubling the duplication. Future weasel-ui components (a `<Button>` that
hasn't been built yet) will want button-state tokens that weasel-ui's tokens.css
doesn't define.

## Goal

Stand up `@weasel-js/theme` as the canonical home for the design system's
tokens:

- Single CSS file (`tokens.css`) and a parallel TS module (`tokens.ts`) exporting
  the same values as a typed object for non-DOM fallback consumers (read: weasel-hud).
- One namespace for all weasel design tokens: `--wzl-*`. Replaces the existing
  `--wui-*` namespace; mechanical rename across weasel-ui's components.
- Adds the four button-state tokens (`--wzl-button-fill`, `…-hover`, `…-pressed`,
  `--wzl-button-text`) needed by weasel-hud's button widget and by future
  weasel-ui buttons.
- Both consumer packages read from this package; neither depends on the other.
- weasel-hud reads tokens via `getComputedStyle(canvasEl)` on every draw, so live
  CSS changes (dark-mode toggles, etc.) take effect on the next state-driven
  redraw without machinery on the HUD side.

## Settled design choices

| Axis | Choice | Notes |
|---|---|---|
| Token home | New `packages/theme/` package | Neither weasel-ui nor weasel-hud depends on the other. |
| Namespace | `--wzl-*` (renamed from `--wui-*`) | More accurate now that tokens span DOM + WebGL widgets. |
| Token vocabulary | 12 pre-existing + 4 new button-state = 16 | Font tokens deliberately excluded. |
| Per-widget overrides | Inline style props win over theme | "Explicit > implicit" — additive, non-breaking change. |
| Theme refresh cadence | Read on every HUD draw | One `getComputedStyle` + ~16 property lookups; sub-millisecond. |
| Theme refresh trigger | Piggybacks on existing redraw events | Consumer calls `hud.markDirty()` after manual CSS swaps. |
| Cross-package | weasel-ui's CSS components migrate to `--wzl-*` | Mechanical sed-style rename. |
| Legacy `--wui-*` | Dropped | Migrate the one WeaselDraw demo import; this is exploratory work, no published external consumers. |

## Architecture

### Package layout

```
packages/theme/
  package.json       # @weasel-js/theme, private
  tsconfig.json
  README.md
  src/
    index.ts         # barrel: exports DEFAULT_TOKENS, TokenName
    tokens.ts        # TS source-of-truth values
    tokens.css       # CSS :root declarations matching tokens.ts
    tokens.test.ts   # parity test (keys in CSS match keys in TS)
```

### Token vocabulary

`packages/theme/src/tokens.css`:

```css
:root {
  --wzl-text: #1a1a1a;
  --wzl-text-muted: #6a6a6a;
  --wzl-panel-bg: #f4f4f4;
  --wzl-panel-border: #d4d4d4;
  --wzl-input-bg: #ffffff;
  --wzl-accent: #4a8fd4;
  --wzl-danger: #c64a3a;
  --wzl-track-bg: #e3e3e3;
  --wzl-track-border: #c2c2c2;
  --wzl-thumb-fill: #ffffff;
  --wzl-thumb-border: #6a6a6a;
  --wzl-thumb-text: #1a1a1a;
  --wzl-button-fill: #ffffff;
  --wzl-button-fill-hover: #f5f5f5;
  --wzl-button-fill-pressed: #e0e0e0;
  --wzl-button-text: var(--wzl-text);
}
```

`packages/theme/src/tokens.ts` exports the same set as a typed object,
with `--wzl-button-text`'s value resolved to the literal `#1a1a1a` (TS exports
can't reference each other syntactically the way CSS can with `var()`):

```ts
export const DEFAULT_TOKENS = {
  '--wzl-text': '#1a1a1a',
  '--wzl-text-muted': '#6a6a6a',
  // ...all 16 keys, with --wzl-button-text resolved to '#1a1a1a'...
} as const;

export type TokenName = keyof typeof DEFAULT_TOKENS;
```

### weasel-ui migration

- `packages/ui/src/tokens.css` is **deleted**.
- All references to `--wui-*` in `packages/ui/src/*.module.css` are rewritten
  to `--wzl-*`. Mechanical sed-style rename, ~30-50 references.
- The one demo currently importing `@weasel-js/ui/tokens.css` (WeaselDraw,
  per the existing alias in `vite.config.ts`) migrates to
  `@weasel-js/theme/tokens.css`.
- `package.json`'s `./tokens.css` export entry is removed from weasel-ui.

### weasel-hud token resolution

A new module `packages/hud/src/theme.ts` resolves tokens by reading from
the canvas element's computed style with `DEFAULT_TOKENS` as fallback. It exports
a typed `ResolvedTokens` object that maps to camelCase fields for ergonomic
widget consumption:

```ts
export interface ResolvedTokens {
  text: string;
  textMuted: string;
  panelBg: string;
  panelBorder: string;
  inputBg: string;
  accent: string;
  danger: string;
  trackBg: string;
  trackBorder: string;
  thumbFill: string;
  thumbBorder: string;
  thumbText: string;
  buttonFill: string;
  buttonFillHover: string;
  buttonFillPressed: string;
  buttonText: string;
}

export function readTokens(canvasEl: HTMLCanvasElement | null): ResolvedTokens;
```

`readTokens(null)` (called during the boot window before the canvas ref populates)
returns `DEFAULT_TOKENS` mapped to camelCase — no DOM read, no failure.

### `HudDrawCtx` extension

```ts
export interface HudDrawCtx {
  dims: { width: number; height: number };
  defaultFont: string;
  tokens: ResolvedTokens;   // NEW
}
```

### `attachHud` change

The HUD layer's `draw` function calls `readTokens(api.element)` once per draw and
includes the result in `HudDrawCtx`:

```ts
draw: (_data, _view, dims): DrawCommand[] => {
  const tokens = readTokens(api.element);
  const ctx: HudDrawCtx = { dims, defaultFont: DEFAULT_FONT_FAMILY, tokens };
  const out: DrawCommand[] = [];
  for (const w of hud.widgets()) {
    if (w.hidden) continue;
    for (const cmd of w.draw(ctx)) out.push(cmd);
  }
  return out;
},
```

### Widget integration

**`label.ts` / `text.ts`:** when the consumer omits `color`, the widget reads
`ctx.tokens.text` in `draw()`. The factory no longer captures a hardcoded
default; the resolution happens per draw.

**`button.ts`:** the four colors (`fill`, `pressedFill`, `hoverFill`, `textColor`)
become per-draw resolutions:

```ts
draw(ctx: HudDrawCtx): DrawCommand[] {
  const fill         = opts.fill         ?? ctx.tokens.buttonFill;
  const hoverFill    = opts.hoverFill    ?? ctx.tokens.buttonFillHover;
  const pressedFill  = opts.pressedFill  ?? ctx.tokens.buttonFillPressed;
  const textColor    = opts.textColor    ?? ctx.tokens.buttonText;
  // ...existing draw logic...
}
```

The hardcoded `'#ffffff'` etc. constants in the current `createButton` are
deleted; defaults now come exclusively from the theme.

**`rect.ts`, `text.ts` when consumer supplies color, `image.ts`:** no theme
involvement. `rect`'s fill is required; `text`'s color is consumer-supplied;
`image` has no theme-able properties.

## Data flow

```
Consumer app
  imports @weasel-js/theme/tokens.css  ─┐
                                                │
weasel-ui components read `var(--wzl-*)` via CSS
                                                │
weasel-hud reads the same vars via
  getComputedStyle(canvasEl) on every draw
                                                │
DEFAULT_TOKENS fallback fires when CSS unset ───┘
```

No runtime dependency direction between weasel-ui and weasel-hud. Both depend on
weasel-theme; weasel-theme depends on nothing.

## Errors & edge cases

| Case | Behavior |
|---|---|
| `api.element` is null (boot window) | `readTokens(null)` returns `DEFAULT_TOKENS` mapped to camelCase. One-frame visual stability. |
| Consumer never imports `tokens.css` | `getPropertyValue` returns empty; falls back to `DEFAULT_TOKENS`. HUD looks identical to spec defaults. |
| Consumer sets a CSS variable to an invalid color | Renderer's existing color parser handles it (clamps or warns — pre-existing). |
| Consumer changes a CSS variable mid-session (dark-mode toggle) | Next `requestRedraw` reads the new value. If nothing else triggers redraw, HUD stays on old theme. **Consumer responsibility:** call `hud.markDirty()` after manual theme swap. |
| `DEFAULT_TOKENS` drifts from `tokens.css` | `tokens.test.ts` parity check fails. |
| Consumer overrides one widget's color and changes the theme | Override wins; theme change only affects widgets using the default. |

The mid-session-theme-change case is the only user-visible gap: the HUD's "read
on draw" model is reactive to state-driven redraws, not to CSS-mutation events.
Documenting the `hud.markDirty()` call is the v1 mitigation; automatic
detection (`MutationObserver`, `prefers-color-scheme` media-query listener) is a
future enhancement, not v1.

## Testing

**`packages/theme/src/tokens.test.ts`**:
- DEFAULT_TOKENS keys match the set of `--wzl-*` keys defined in `tokens.css`
  (catches drift when one is edited without the other)

**`packages/hud/src/theme.test.ts`**:
- `readTokens(null)` returns DEFAULT_TOKENS-equivalent values
- `readTokens(canvasEl)` returns DEFAULT_TOKENS values when no CSS variables are
  set (i.e., consumer hasn't imported tokens.css)
- `readTokens(canvasEl)` picks up CSS variables set directly on the canvas
- `readTokens(canvasEl)` picks up CSS variables cascaded from an ancestor

**`packages/hud/src/widgets/button.test.ts`** — extend:
- Button uses `ctx.tokens.buttonFill` when `opts.fill` is omitted
- Button respects `opts.fill` when supplied (theme overridden)
- Same for `pressedFill` / `hoverFill` / `textColor`

**`packages/hud/src/widgets/label.test.ts`** — extend:
- Label uses `ctx.tokens.text` when `opts.color` is omitted
- Label respects `opts.color` when supplied

**`packages/hud/src/integration.test.tsx`** — extend:
- Set `--wzl-button-fill` directly on the canvas element, render a button, assert
  the resulting `DrawCommand`'s fill color reflects the CSS variable

**Out of scope for v1 testing.** Pixel-diff. CSS-variable cascade through specific
selectors. Animation/transition of CSS variables.

## Out of scope for v1

- **Token-reference values** in widget options (e.g., `fill: 'danger'`). Q3 option
  C — a typed union for color props that resolves either to a literal hex or to a
  token name. Low-priority TODO; useful for "I want this button to use the
  semantic 'danger' color" without writing out the CSS var.
- **`hud.refreshTheme()` cache-and-invalidate escape hatch.** Caching tokens would
  save microseconds; not worth the complexity.
- **Automatic detection of `prefers-color-scheme` changes** or `MutationObserver`
  on theme-affecting attributes. Consumers call `hud.markDirty()` manually.
- **Font tokens (`--wzl-font-family`, `--wzl-font-size`).** Font registration is
  the renderer's domain; per-widget font size is a per-widget decision, not theme.
- **Light/dark mode variants** as part of weasel-theme itself. Consumers handle
  this via their app-level CSS (e.g., `[data-theme="dark"] { --wzl-text: #fff; }`).
- **Theme tokens for rect, image, text-with-explicit-color.** These aren't theme
  consumers and stay as-is.

## Open questions

1. **Should `--wzl-button-text: var(--wzl-text)` alias be preserved in `tokens.ts`
   somehow?** As written, the TS export hardcodes `'#1a1a1a'` for button-text,
   losing the "follows --wzl-text" relationship at the fallback level. Probably
   acceptable — the alias is for consumers who override `--wzl-text` in CSS;
   they'd also (separately) override `--wzl-button-text` if they wanted to break
   the link, or rely on the CSS alias. The TS fallback's hardcoded value just
   needs to be a sensible default when no CSS is loaded.

2. **weasel-ui rename pass: one commit or per-component?** A single rename commit
   touches ~30-50 lines across ~5 component .module.css files. Single commit is
   simpler; per-component is more easily revertible. Plan picks one.

3. **Keep `package.json`'s `./tokens.css` export on weasel-ui as a re-import?**
   A one-line `@import` shim would preserve any external consumer's existing
   `import '@weasel-js/ui/tokens.css'` path. The spec assumes there are no
   external consumers (this is pre-publication exploratory work) and drops it.
   Plan should verify by searching the repo for any reference to that subpath.
