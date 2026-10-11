---
'@weasel-js/hud': patch
---

`useHud(ref, { font: { metricsUrl, atlasUrl } })` with the font object written inline detached and re-attached the HUD on every render of the component: the frame cache was dropped and a hovered widget got a `hoverleave` with the pointer still on it. `useHudContribution` handed `<SceneCanvas ambient>` a new entry each render for the same reason. Both now compare the font by its URLs.
