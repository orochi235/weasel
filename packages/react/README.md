# @weasel-js/react

Generic React pieces the weasel packages share. No weasel domain in it.

| Export | What it does |
|---|---|
| `useLatest` | A ref holding the value of the last committed render |
| `useStableByContent` | One identity for a value rebuilt equal every render |
| `assignRef` | Writes a value into a ref prop of either shape |
| `useVisibleRaf` | A frame loop that runs only while the document, and optionally an element, is visible |
| `useNearViewport` | Whether an element is within a margin of the viewport |
| `useCanvasFocus` | DOM focus on a canvas, as state and as a getter for per-frame code |
| `KitSettingsProvider`, `useKitSetting`, `createKitSettingsStore` | Kit-wide settings a package augments `KitSettings` with |
| `usePrefersReducedMotion`, `useSystemColorScheme` | The system's motion and color-scheme preferences |
| `adoptCss`, `adoptCssOnce` | A stylesheet in an element's document or shadow root |

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/react).

## Install

```sh
npm install @weasel-js/react
```

## Usage

```ts
import { useLatest } from '@weasel-js/react';
```

## License

MIT
