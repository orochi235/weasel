# DTCG tokens and pluggable themes

**Date:** 2026-08-08
**Status:** approved, not yet implemented
**Closes:** the P1 "Make theming resilient and implementation-agnostic" item in
`docs/TODO.md` (Plugins & packaging → Theming).

## Problem

Theming is a set of loosely-coupled conventions that each surface re-derives.
Four readers of the same intent exist today, none of which the others enforce:

1. `packages/theme/src/tokens.css` — 72 `--wzl-*` custom properties in three
   tiers (primitive ramp, semantic, deprecated aliases), plus `[data-theme]`
   blocks that hand-restate ~10 semantic tokens per mode.
2. `packages/theme/src/tokens.ts` — a literal TS mirror with `var()` references
   pre-resolved by hand. Its own header concedes that `color-mix()` values are
   "plausible hex approximations." `tokens.test.ts` checks **key** parity only,
   so values can and do drift silently.
3. `packages/hud/src/theme.ts` — WebGL can't read custom properties, so it
   bridges through `getComputedStyle` into a hardcoded 16-field
   `ResolvedTokens`. Every one of those 16 points at a *deprecated* alias.
4. `scripts/vite-plugin-weasel-tokens.ts` — 125 lines of regex parsing
   `tokens.css` off disk to populate the Storybook CSS Vars panel.
5. `packages/labkit/src/theme/*.less` — an entirely separate `--lk-*` token
   system with its own named themes, built by `lessc`. See §10.

Themes are not pluggable in any meaningful sense. A "theme" is
`data-theme="light"|"dark"` hardcoded in our own stylesheet, or a consumer
overriding raw CSS variables at their own scope. There is no theme value, no
registration, and no way to ship a third theme without editing `tokens.css`.

Separately, `tokens.css` `@import`s Oswald from Google Fonts at runtime, and
`packages/labkit` already ships `oswald-latin-variable.woff2` in `src/` and
`dist/` with no `LICENSE`, no `OFL.txt`, and no attribution — an OFL compliance
gap in a published package (`@weasel-js/labkit@0.7.2`, not marked private).

## Decisions

1. **DTCG JSON is the single source.** One generator emits the CSS, the TS
   objects, the `TokenName` union, and the Storybook manifest. Drift becomes
   impossible rather than detected.
2. **Modes live inside a theme.** A theme declares mode-invariant primitives
   plus one semantic layer per mode. `weasel` has `dark` and `light`; a brand
   theme that extends it gets a coherent pair. Only the light/dark axis — no
   generalized density/contrast axes.
3. **The resolved theme object is authoritative at runtime.** `resolveTheme`
   is pure and works headless. The DOM is an output, not an input.
   Consequence, accepted: a consumer who hand-writes `--wzl-accent: red` in
   their own CSS themes DOM chrome but not the canvas. The supported way to
   theme both is to define a theme.
4. **The deprecated alias tier is deleted**, not preserved as generated
   aliases. ~264 call sites get migrated.
5. **Fonts are bundled, not fetched.** The Google Fonts `@import` is removed.
6. **labkit converges onto the shared system**, and its `interstellar` theme is
   the proof case for pluggability. Its additional token groups (data-viz
   swatches, spacing scale, z-layers, gradients) are contributed to the shared
   source, so the schema must express them from the start.

## Design

### 1. Token source

`packages/theme/tokens/<theme>/` becomes the only hand-edited theming artifact:

```
tokens/weasel/
  theme.json                 # { name, defaultMode: "dark", modes: ["dark", "light"] }
  primitives.tokens.json     # gray/accent/status ramps, radii, motion, typography
  modes/dark.tokens.json     # semantic layer
  modes/light.tokens.json
```

Standard DTCG throughout: `$type` / `$value`, aliases as `"$value": "{gray.800}"`,
`$description` carried into generated comments and the Storybook panel.

Two things DTCG doesn't express, both handled as namespaced `$extensions`:

**Alpha-over-alias.** `--wzl-line*` and the button hover/pressed fills mean
"foreground at N%", which is why they're `color-mix()` today:

```json
"line": {
  "$value": "{semantic.fg}",
  "$extensions": { "com.weasel.alpha": 0.2 }
}
```

The CSS generator emits `color-mix(in srgb, var(--wzl-fg) 20%, transparent)`, so
DOM chrome keeps auto-tinting if `--wzl-fg` is overridden downstream. The JS
resolver computes the concrete `rgba()`. Both outputs are then honest — today's
TS mirror is not.

**Modes.** DTCG has no mode concept, so modes are sibling token sets in
`modes/`, named by the manifest.

### 2. Generated artifacts

One generator, `packages/theme/scripts/build-tokens.mjs`, run via `prebuild` and
verified in CI. All outputs are committed so a git install or a `.d.ts` build
never needs to run it.

| Output | Replaces |
|---|---|
| `src/generated/tokens.css` | hand-written `tokens.css` |
| `src/generated/themes.ts` | hand-mirrored `DEFAULT_TOKENS` |
| `src/generated/tokenName.ts` (`TokenName` union) | hand-written type |
| `src/generated/manifest.ts` | `scripts/vite-plugin-weasel-tokens.ts` — **deleted** |

`tokens.test.ts`'s key-parity check is deleted; it tests a problem that no
longer exists. It is replaced by a CI check that re-running the generator
produces no diff.

The Storybook CSS Vars addon stops consuming the `virtual:weasel-tokens` module
and imports `manifest.ts` directly. Both `.storybook/main.ts` and
`packages/ui/.storybook/main.ts` drop the plugin registration.

The generated `tokens.css` carries the built-in theme only. Its purpose is
zero-JS correctness — plain `<link>`, SSR first paint. Third-party themes need
no build step at all (see §4).

### 3. Runtime API

`@weasel-js/theme` keeps zero dependencies:

```ts
resolveTheme(theme: Theme, mode: string): ResolvedTheme
applyTheme(el: HTMLElement, theme: Theme, mode: string): void
defineTheme({ name, extends, modes }): Theme      // authoring in TS
loadDTCG(json: unknown): Theme                    // authoring in JSON / tool interchange
export const weaselTheme: Theme
```

`resolveTheme` is pure, in this order:

1. Walk the `extends` chain root-first, deep-merging token maps.
2. Merge the selected mode layer over the primitives.
3. Resolve `{alias.path}` references transitively. A cycle throws, naming the
   path.
4. Apply `com.weasel.alpha` extensions.
5. Freeze and return a `Record<TokenName, string>`.

An unresolvable reference or a token missing after the merge **throws**, naming
the token. It does not fall back silently. Because `extends: weaselTheme` is the
default, a partial theme cannot be accidentally incomplete unless it explicitly
opts out of the base. A missing *mode* falls back to `defaultMode`.

### 4. Applying a theme

`applyTheme` does not write inline custom properties. It:

1. Stamps `data-wzl-theme="<name>"` and `data-wzl-mode="<mode>"` on the element.
2. Ensures a rule block
   `[data-wzl-theme="acme"][data-wzl-mode="dark"] { --wzl-…: …; }` exists in a
   module-owned `CSSStyleSheet` adopted into the document
   (`adoptedStyleSheets`), falling back to an appended `<style>` element where
   unsupported, and no-op under SSR.

This keeps the cascade doing the work: no inline styles, no `!important`, no
specificity fights. Per-subtree override is just a different theme name on a
subtree. And because the rules are emitted at runtime from the resolved object,
**a third-party theme requires no build step** — the generator exists for our
own shipped CSS, not as a consumer obligation.

`data-theme` is renamed to `data-wzl-theme` + `data-wzl-mode`. Prerelease, so
the rename is free; blast radius is three files.

### 5. Canvas / WebGL

`packages/hud/src/theme.ts` loses `getComputedStyle`, `TOKEN_KEYS`, and the
16-field `ResolvedTokens` struct. The HUD receives the same `ResolvedTheme`
record the DOM path was built from, and reads semantic token names directly.

Beyond removing a DOM round-trip, this makes headless render, node tests, and
`renderSceneToPixels` themeable, which they currently are not.

### 6. React binding

A separate entry point, `@weasel-js/theme/react`, exporting `<ThemeProvider>`
and `useTheme()`, with React declared as an **optional** peer
(`peerDependenciesMeta`). The core entry stays framework-free.

Both `@weasel-js/ui` and `@weasel-js/hud` already peer-depend on React and can
import from this entry, so neither package has to depend on the other to share
theme context.

### 7. Alias migration

The deprecated tier is deleted and its ~264 references migrated by codemod. The
mapping is mostly 1:1, but **three cases are not aliases at all** and need real
semantic tokens introduced:

| Deprecated | Refs | Becomes |
|---|---:|---|
| `--wzl-muted` | 56 | `--wzl-fg-muted` |
| `--wzl-panel-border` | 68 | `--wzl-border` |
| `--wzl-input-bg` | 26 | `--wzl-surface-sunken` |
| `--wzl-text-muted` | 23 | `--wzl-fg-muted` |
| `--wzl-text` | 21 | `--wzl-fg` |
| `--wzl-panel-bg` | 20 | `--wzl-surface` |
| `--wzl-bg` | 19 | `--wzl-surface` |
| `--wzl-track-bg` | 5 | `--wzl-surface-sunken` |
| `--wzl-track-border` | 5 | `--wzl-border` |
| `--wzl-thumb-fill` | 5 | `--wzl-fg-muted` |
| `--wzl-thumb-border` | 5 | `--wzl-border-strong` |
| `--wzl-button-text` | 4 | `--wzl-fg` |
| `--wzl-thumb-text` | 3 | **new** `--wzl-fg-inverse` |
| `--wzl-button-fill-pressed` | 2 | **new** `--wzl-surface-pressed` |
| `--wzl-button-fill-hover` | 2 | **new** `--wzl-surface-hover` |
| `--wzl-button-fill` | 0 | deleted outright |

`--wzl-thumb-text` flips between modes (`gray-900` dark, `gray-50` light), so it
is a mode-varying semantic, not an alias to a primitive — hence
`--wzl-fg-inverse`. The two button fills are alpha-over-`fg` values that happen
to share `--wzl-line-subtle`'s computed result while meaning something entirely
different; collapsing them onto the line tokens would be wrong.

The codemod also drops inline `var(--wzl-x, fallback)` fallbacks, which are
dead once the token is guaranteed defined. 56 of the `--wzl-muted` references
carry one.

`apps/draw`'s four `--wd-*` properties become a small `extends`-based theme,
deleting the parallel prefix.

### 8. Fonts and OFL compliance

Both faces are OFL-1.1 and bundleable. Oswald's notice is
`Copyright 2016 The Oswald Project Authors (https://github.com/googlefonts/OswaldFont)`
with **no Reserved Font Name**, so subsetting does not trigger the
rename-your-derivative requirement. Inter is OFL-1.1 and already vendored at
`assets/fonts/inter/` with its `LICENSE.txt`.

```
packages/theme/
  fonts/
    oswald-latin-variable.woff2   # moved from packages/labkit, single-sourced
    inter-latin-variable.woff2
    OFL-Oswald.txt
    OFL-Inter.txt
  src/fonts.css                   # @font-face rules, package-relative URLs
```

- New side-effect entry `@weasel-js/theme/fonts.css`. Opt-in; consumers who skip
  it get the `system-ui` fallback already present in the token font stacks.
- The Google Fonts `@import` is deleted. This fixes privacy, offline, CSP, and
  FOUT along with the compliance gap.
- Latin subsets, variable weight, ~28 KB each. Full Unicode coverage would be
  several hundred KB for a face nobody asked to download.
- `packages/theme/LICENSE` stays MIT; a new `NOTICE` names the two OFL fonts and
  points at the `OFL-*.txt` files.
- `packages/labkit` loses its duplicate copy and gains the `LICENSE` file it is
  currently missing.

### 9. Tests

- **Resolver units:** alias chains, cycle detection, `extends` deep-merge,
  alpha extension, mode fallback, missing-token throw.
- **Generator determinism:** CI re-runs the generator and fails on any diff
  against the committed output.
- **`applyTheme`:** asserts attributes are stamped and the rule block is adopted
  once per `(theme, mode)` pair, not per call.
- **Migration:** the existing visual baseline suite carries the alias codemod.
  Both modes must render.
- **Consumer smoke test:** `@weasel-js/theme` imports and resolves with no CSS
  import present.

### 10. labkit convergence

`packages/labkit` carries a complete parallel theming system, discovered while
planning. It is a fifth reader, and the only place in the repo that already does
named pluggable themes:

- `src/theme/tokens.less` defines 42 `--lk-*` custom properties — surface, text,
  accent, radius, spacing, typography, z-layers — sharing no names with
  `--wzl-*` while covering much of the same ground. 22 files reference them
  across 24 Less files.
- Two named themes ship as public exports (`@weasel-js/labkit/theme-light.css`,
  `/theme-interstellar.css`), applied by `<LabShell theme="…">` via
  `.lk-theme-*` classes, with a `prefers-color-scheme` default on top.
- `build:css` shells out to `lessc` three times.

It diverged because it was vendored in from its own repo — its README still
documents `file:../labkit` installation and a separate docs site.

**`interstellar` becomes the proof case for the whole design.** A theme
mechanism whose only exercise is our own light/dark pair demonstrates nothing;
interstellar is a genuinely different look (cosmic gradient, glass surfaces,
violet accent) authored by a different hand, which is exactly the third-party
case `defineTheme`/`extends` exists to serve.

Convergence:

- `interstellar` and `lk-light` become DTCG themes extending `weasel`.
- `--lk-*` collapses into `--wzl-*` wherever it duplicates an existing concept.
- labkit's genuinely additional tokens are contributed as **new token groups in
  the shared source**, not as a labkit-private tier: a ten-color data-viz swatch
  set, a spacing scale, z-layer constants, and a `gradient` `$type` for
  `--lk-space-nebula`. The DTCG schema must express all four from the start —
  designing the schema around only weasel's current token set would force a v2.
- The `lessc` pipeline and the three CSS exports are replaced by generated
  output; `<LabShell theme>` routes through `applyTheme`.

## Delivery

Three plans, each shippable on its own:

- **Plan A — token source of truth.** Fonts/OFL, DTCG source, generator,
  generated artifacts replacing `tokens.css` / `tokens.ts` / the Storybook
  plugin. Everything renders identically; nothing hand-mirrors anything.
- **Plan B — runtime themes.** `resolveTheme` / `applyTheme` / `defineTheme` /
  `loadDTCG`, the React entry, HUD bridge removal, the alias migration and its
  three new semantic tokens, the `data-theme` rename, `apps/draw` as a theme.
- **Plan C — labkit convergence.** §10.

## Out of scope

- Generalized mode axes (density, contrast). Named themes plus a light/dark
  mode axis only.
- A per-component token override API.
- A runtime theme-editing UI.
- Migrating `apps/site/canvas-kit-demo.css`'s raw `--wzl-font-ui` override
  beyond whatever the rename breaks. Raw CSS overrides remain supported for DOM
  chrome; they are simply not the path that reaches the canvas.
- Publishing. This lands on a branch; release is a separate decision.
