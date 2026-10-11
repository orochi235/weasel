---
'@weasel-js/core': patch
---

A layer hidden with `layerVisibility`, or left out of `layerOrder`, no longer receives `onUncapturedMove`. Clicks already passed through such a layer, but hover was still delivered, so a hidden HUD kept hit-testing its widgets, firing their hover events, and requesting redraws.
