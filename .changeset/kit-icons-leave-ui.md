---
'@weasel-js/ui': major
'@weasel-js/ui-canvas': minor
---

`kitIcons` moves from `@weasel-js/ui/kit-icons` to `@weasel-js/ui-canvas/kit-icons`.

This is breaking: import it from `@weasel-js/ui-canvas/kit-icons`. It lists core's, editing's, the shapes', the paint kinds' and ui's tables, which ui alone cannot name. `@weasel-js/ui/icons` still has ui's own.

<!-- entry: breaking api -->
