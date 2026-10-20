---
'@weasel-js/ui': patch
'@weasel-js/forge': patch
'@weasel-js/labkit': patch
---

Five new `@weasel-js/ui` entry points reach exports that were only on the root barrel: `@weasel-js/ui/stance` (`useStance` and its types), `@weasel-js/ui/portal-host` (`OverlayPortalProvider`, `useOverlayPortal` and the rest of the overlay portal helpers), `@weasel-js/ui/color` (`oklchToHex`, `chromaAt`, `rampColor`, `colorRamp`), `@weasel-js/ui/paint-gradient-track` (`paintGradientTrack`) and `@weasel-js/ui/kit-settings` (`uiKitSettingsSchema`). The root barrel still exports what it did. forge and labkit now import ui only by subpath, outside labkit's `weasel-ui` passthrough.
