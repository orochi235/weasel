---
'@weasel-js/hud': patch
'@weasel-js/theme': patch
'@weasel-js/paint': patch
---

The hud `window` takes a `stance` and a `tone`, like the kit's DOM panels, with `setStance` / `setTone` to change them. It draws them in WebGL from the resolved theme: the stance's `--wzl-stance-<stance>-<slot>` values restyle its fill, border and title, and the tone mixes into the fill in oklab. A numeric tone indexes the theme's tone list through the new `HudDrawCtx.toneAt`, which `attachHud` builds from its new `tones` option and `useHud` fills from the app's `<ThemeProvider>`. A widget drawn by hand, as in a test, now needs a `toneAt` in its draw context.

`@weasel-js/theme` adds `resolveStanceSlots`, the stance lookup for a surface drawn without the cascade. `@weasel-js/paint` adds `mixOklab`, which matches CSS `color-mix(in oklab, …)`, alpha included.
