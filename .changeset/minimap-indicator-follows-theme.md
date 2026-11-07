---
'@weasel-js/minimap': patch
'@weasel-js/core': patch
---

The minimap's view indicator now strokes in the theme's `--wzl-accent`, the color its crosshair already used, read
off the minimap's canvas and re-read when a theme or mode attribute above it changes; it was white in every theme.
An `indicatorStyle.stroke` still wins. `computeIndicatorCommand` takes the default stroke as a fifth argument, and
the linked crosshair now follows a theme change too rather than keeping the color it read when attached. Core
exports `watchThemeOf`, which reports when the colors read off an element may have changed.
