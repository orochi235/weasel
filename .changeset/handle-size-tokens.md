---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

New `--wzl-handle-size`, `--wzl-handle-size-sm` and `--wzl-handle-size-lg` size every draggable handle the kit draws on a plot or a timeline: the default rank, the inert one a locked or pinned point wears, and the emphasized one a curve's endpoint wears. Timeline's dope-sheet keys and event marks, CurveEditor's endpoint and locked diamonds and `createKeyframeLayer`'s keys were three independent literals; they are now one number each, written in the theme definition.

CSS reads the tokens directly. Code that draws rather than styles — SVG geometry attributes, canvas, WebGL — reads them through `tokenPx(name, resolved?)` from `@weasel-js/theme`, or `handleSize` / `handleHalf` from `@weasel-js/ui`, which return the number without a `getComputedStyle`. Pass a `ResolvedTheme` (from `useTheme().resolved`) where a live theme override has to reach the drawing; without one the built-in theme's value is used.

The locked anchor in `createFunctionLayer` was 7.1px and is now 7px.

`@weasel-js/ui` now depends on `@weasel-js/theme`.
