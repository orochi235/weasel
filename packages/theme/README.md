# @weasel-js/theme

Design tokens shared by weasel-ui and weasel-hud — generated from a DTCG
source into CSS custom properties plus a parallel TS export.

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

## Editing tokens

`src/generated/` is generated — never edit it. Change `tokens/weasel/*.json`,
then:

```sh
npm run gen:tokens -w @weasel-js/theme
```

CI re-runs the generator and fails if the committed output differs.

Token names are flat leaf keys inside `$type` groups: `color.fg-muted` becomes
`--wzl-fg-muted`. The group carries `$type` and contributes nothing to the name,
because `--wzl-accent` and `--wzl-accent-base` are both real tokens and DTCG
forbids a token that is also a group.

## Licenses

Code is MIT. The two bundled fonts are SIL Open Font License 1.1 — see `NOTICE`
and `fonts/README.md`.
