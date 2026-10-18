---
'@weasel-js/core': patch
---

The pen's close and anchor-snap reach and the knife's close reach are kit settings: `targets.penCloseHitPx`, `targets.penAnchorSnapPx`, and `targets.sliceCloseHitPx`, each 8 screen px where nothing sets it, and each in `coreKitSettingsSchema`. A tool's own `closeHitRadius` or `anchorSnapRadius` option still wins over a provider.
