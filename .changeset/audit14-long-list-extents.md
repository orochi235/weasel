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

Layouts, bounds, legends and reports over hundreds of thousands of items no longer overflow the call stack. This covers, for example, a grid of a million nodes, a million pages, a polyline of a million points and a store of a million prefs records.

<!-- entry: fix -->
