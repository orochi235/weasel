---
'@weasel-js/paint': patch
'@weasel-js/core': patch
---

The sRGB ↔ OKLab/OKLCH conversions (`srgbU8ToOklab`, `oklabToOklch`, `lerpOklch` and the rest) now live in `@weasel-js/paint`. `@weasel-js/core` still exports every one of them, so no import changes.
