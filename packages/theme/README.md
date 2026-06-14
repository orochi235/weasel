# weasel-theme

Design tokens shared by `@weasel-js/ui` (DOM/React widgets) and
`@weasel-js/hud` (WebGL widgets). Single namespace: `--wzl-*`.

## Usage

```ts
// In your app shell, import the CSS for default values:
import '@weasel-js/theme/tokens.css';
```

Override individual tokens at any DOM level:

```css
[data-theme="dark"] {
  --wzl-text: #f4f4f4;
  --wzl-panel-bg: #1a1a1a;
}
```

For non-DOM consumers (weasel-hud), the TS export `DEFAULT_TOKENS` provides
the same values as a typed object for fallback when CSS isn't loaded.

## Editing tokens

`tokens.ts` and `tokens.css` are maintained side-by-side. The parity test
in `tokens.test.ts` catches drift between them. If you edit one, edit
the other and run `pnpm exec vitest run packages/theme/`.
