# @weasel-js/theme

Design tokens shared by weasel-ui and weasel-hud — generated from a theme
definition into CSS custom properties plus a parallel TS export.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/api/).

## Install

```sh
npm install @weasel-js/theme
```

## Usage

```ts
import { THEMES, TOKEN_MANIFEST, type TokenName } from '@weasel-js/theme';
import '@weasel-js/theme/tokens.css';   // required — component styles read these
import '@weasel-js/theme/fonts.css';    // optional — bundled Oswald + Inter
```

`tokens.css` is required; component styles reference the custom properties it
declares. `fonts.css` is optional — skip it and the token font stacks fall back
to `system-ui`. It sets `:root`'s font as well as declaring the faces; import
`@weasel-js/theme/faces.css` instead for the `@font-face` rules alone. Nothing is fetched from a third-party host either way.

Modes are selected with a data attribute, which cascades:

```html
<html data-wzl-mode="light">
```

## Custom themes

```ts
import { defineTheme, applyTheme } from '@weasel-js/theme';

const acme = defineTheme({
  name: 'acme',
  pins: {
    'accent-base': '#ff3366',                    // aliases rebase onto it
    surface: { by: 'mode', light: '#fffdf8' },   // dark keeps the base's
  },
});

applyTheme(document.documentElement, acme, { mode: 'light' });
```

`extends` defaults to the built-in theme, so a partial theme can never be
accidentally incomplete. Overriding a primitive rebases every alias that
references it — set `accent-base` and `--wzl-accent`, `--wzl-accent-hover`,
`--wzl-focus-ring` and `--wzl-glass-tint` all follow.

Themes exported from a design tool load through `loadDTCG(json)`.
`interstellarTheme` in `@weasel-js/labkit` is a worked example of the other
path: a pins-only definition in JSON, passed to `defineTheme`.

In React, `<ThemeProvider theme={acme} selection={{ mode: 'light' }}>` from
`@weasel-js/theme/react` does the same and publishes the resolved record via
`useTheme()` — which is how canvas and WebGL surfaces stay in sync without
reading the DOM.

## The engine

`@weasel-js/theme/engine` is for authoring layered theme definitions: seeds,
generated ramps and scales, semantic rules, components and pins. `derive`
produces a definition's tokens for one selection, with where each came from and
any issues; `bake` folds every selection into the tokens a runtime `Theme`
holds; `toDTCG` writes a theme out as a DTCG document. The runtime entry never
loads it.

```ts
import { bake, derive } from '@weasel-js/theme/engine';
import { weaselTheme, type Theme, type ThemeDefinition } from '@weasel-js/theme';

const slate: ThemeDefinition = {
  name: 'slate',
  axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: { scheme: 'light' } } } },
  ramps: { slate: { kind: 'lightness', steps: ['100', '500', '900'], lightness: [0.96, 0.22] } },
  semantics: {
    surface: { by: 'mode', dark: { ramp: 'slate', step: '900' }, light: { ramp: 'slate', step: '100' } },
    fg: { by: 'mode', dark: { ref: 'slate-100' }, light: { ref: 'slate-900' } },
  },
};

const { tokens, provenance, issues } = derive(slate, { mode: 'light' });
const theme: Theme = { ...bake(slate), extends: weaselTheme };
```

### Axes in DTCG

DTCG has one variant dimension, so a document from `toDTCG` holds mode in
`modes` and every other axis at its default value. That part is plain DTCG: a
tool that ignores extensions reads a theme at `density=comfortable` (or whatever
each axis defaults to). The other values ride in the root's
`$extensions["com.weasel.axes"]`, which `loadDTCG` reads back:

```json
"$extensions": {
  "com.weasel.axes": {
    "axes": { "mode": { … }, "density": { "default": "comfortable", "values": { "compact": {}, "comfortable": {}, "roomy": {} } } },
    "varies": { "gap": ["density"] },
    "overrides": {
      "density=compact": { "primitives": { "dimension": { "$type": "dimension", "gap": { "$value": "2px" } } }, "modes": {} },
      "density=roomy":   { "primitives": { "dimension": { "$type": "dimension", "gap": { "$value": "8px" } } }, "modes": {} }
    }
  }
}
```

- `axes` — every axis the theme resolves with, mode included.
- `varies` — for each token that depends on an axis besides mode, which ones.
- `overrides` — a layer shaped like the document (`primitives` and `modes`) for
  each combination of non-default values some token varies by. The key names
  only the axes off their default, in axis order: `density=compact`,
  `density=roomy,contrast=high`.

A token listed in `varies` takes its value at a selection from the layer whose
key matches that selection's non-default values on its own axes — the plain
groups when all are at default. Absent from that layer, it has no value there
and falls through to the theme it extends. Axes a token varies by
independently cost one layer per value; only a token whose value depends on two
axes at once adds layers for their combinations. This follows the same idea as
the DTCG resolver module's modifiers and Tokens Studio's theme groups: a base
set plus per-dimension overrides rather than one mode per combination.

## Editing tokens

`src/generated/` is generated — never edit it. Change `themes/weasel.json`,
then:

```sh
npm run gen:tokens -w @weasel-js/theme
```

CI re-runs the generator and fails if the committed output differs.

Token names are the definition's keys: `fg-muted` becomes `--wzl-fg-muted`, and
a reference in a pin's value is written `{fg-muted}`, while a semantic's `ref`
names the token bare (`"ref": "gray-800"`).

## Override hooks

Ten custom properties resize kit components and **no theme declares them**:
`--wzl-swatch-size`, `--wzl-timeline-label-w`, `--wzl-number-field-width` and
the rest. Kit CSS reads each one with a fallback, so setting it on any
container is what changes it, and leaving it alone takes the fallback:

```css
.dense-panel { --wzl-swatch-size: 20px; --wzl-number-field-width: 6ch; }
```

They are declared in `src/hooks.ts` and land in `TOKEN_MANIFEST` with
`hook: true`, which is where to find the current list, each one's fallback and
what it sizes:

```ts
import { TOKEN_MANIFEST } from '@weasel-js/theme';
const hooks = TOKEN_MANIFEST.filter((t) => t.hook);
```

They stay out of `tokens.css` on purpose. A `:root` value would outrank the
fallback written beside every read, so the two would have to agree forever, and
`npm run check:token-reads` would stop requiring that the fallback be there at
all. Adding a hook means adding it to `src/hooks.ts` and regenerating.

## Licenses

Code is MIT. The two bundled fonts are SIL Open Font License 1.1 — see `NOTICE`
and `fonts/README.md`.
