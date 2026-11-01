---
'@weasel-js/hud': patch
---

`useLoupe` from `@weasel-js/hud/react` keeps a canvas loupe to a React app's settings: pass the canvas
ref, a `Hud` from `useHud`, the layers to magnify, `{ visible, mode, factor }`, and the color, pick, and
close callbacks. It builds the lens once and follows later settings without rebuilding it, so the lens
keeps its position and size. It was WeaselDraw's own hook.
