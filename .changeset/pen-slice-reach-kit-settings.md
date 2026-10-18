---
'@weasel-js/core': patch
---

The pen's and the knife's close reach are kit settings: `targets.penCloseHitPx` and `targets.sliceCloseHitPx`, each 8 screen px where nothing sets it, and each in `coreKitSettingsSchema`. A tool's own `closeHitRadius` option still wins over a provider.
