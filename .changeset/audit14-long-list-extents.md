---
"@weasel-js/geom": patch
"@weasel-js/core": patch
"@weasel-js/diagram": patch
"@weasel-js/diagram-formats": patch
"@weasel-js/guides": patch
"@weasel-js/hud": patch
"@weasel-js/labkit": patch
"@weasel-js/p-touch": patch
"@weasel-js/plot": patch
"@weasel-js/renderer": patch
"@weasel-js/svg": patch
"@weasel-js/text": patch
"@weasel-js/ui-logic": patch
"@weasel-js/ui": patch
"@weasel-js/audio": patch
"@weasel-js/prefs": patch
"@weasel-js/forge": patch
---

Layouts, bounds, legends, and reports over a long list no longer overflow the call stack. Each read the least or greatest of its items by spreading them all into `Math.min` or `Math.max`, which throws a `RangeError` past a few hundred thousand of them: a grid of a million nodes, a million pages, a polyline of a million points, a store of a million prefs records. geom adds `minOf` and `maxOf`, which answer as those spreads do (`Infinity` or `-Infinity` for none, `NaN` for any `NaN`) from a loop, optionally through a function of each item.
