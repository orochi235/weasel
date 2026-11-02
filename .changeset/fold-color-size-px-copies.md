---
'@weasel-js/paint': patch
'@weasel-js/core': patch
'@weasel-js/theme': patch
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
'@weasel-js/forge': patch
'@weasel-js/diagram-formats': patch
---

paint exports `relativeLuminance` and `luminanceContrast`, the WCAG luminance and ratio `contrastRatio` is built on; core re-exports both. theme's `luminance`/`contrast`, its test helpers, ui's painted-contrast helpers and forge's pixel contrast readout now use them.

Color strings that theme's `withAlpha`/`atAlpha`, ui's `TokenPanel` hex conversion and diagram-formats' DOT and Mermaid writers read are parsed by paint's `parseColor`. The `TokenPanel` color input now converts float and percent `rgb()` channels, named colors and `hsl()` without a browser, and diagram-formats writes percent `rgb()` channels as hex instead of passing them through. diagram-formats now depends on `@weasel-js/paint`.

labkit's loupe and ui's `Timeline` ruler and lane graph measure their element with core's `useElementSize`.
