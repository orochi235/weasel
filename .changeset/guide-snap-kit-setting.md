---
'@weasel-js/core': patch
'@weasel-js/guides': patch
---

A gesture's `GestureContext` carries the canvas's kit settings as `kitSettings`, so a behavior or snap strategy can read a setting at the moment it uses one; move, resize, rotate, insert, and clone now ask for the `kitSettings` dep to fill it.

`@weasel-js/guides`' snap reach is the `targets.guideSnapPx` kit setting: `guideSnapStrategy` and every `snapToGuides` read it off the gesture when given no `tolerance`, and fall back to `DEFAULT_GUIDE_TOLERANCE_PX` where nothing sets it. `guidesKitSettingsSchema` holds the leaf for a settings page. The package now names `@weasel-js/prefs` and `@weasel-js/react` as peer dependencies.
