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
to `system-ui`. Nothing is fetched from a third-party host either way.

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

## Licenses

Code is MIT. The two bundled fonts are SIL Open Font License 1.1 — see `NOTICE`
and `fonts/README.md`.
