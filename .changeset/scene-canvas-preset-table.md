---
'@weasel-js/core': patch
---

`<SceneCanvas>` reads what each `features` preset turns on (its actions, tools, ambient bindings, and chrome) from one table, and `features/chrome-caps` builds the rule context the canvas used to assemble inline.

Changes behavior: `FEATURE_ACTION_IDS` and `COMPOSITE_FEATURES.draw` list `move` after `rotate`; the order is the order ambient bindings are matched in. The rule context `<SceneCanvas>` hands to chrome rules no longer carries an untyped `view` property; read `zoom`.
