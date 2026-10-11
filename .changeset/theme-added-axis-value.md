---
'@weasel-js/theme': patch
---

A theme that adds an axis value, such as a new density or mode through `defineTheme`, no longer makes `resolveTheme`, `applyTheme`, and `<ThemeProvider>` throw `Token "..." references "...", which is not defined`. A theme it extends that never declared the new value is read at its own default for that axis, which is what `tokens.css` already showed through the cascade. `resolveTheme`, `bake`, `emitCss`, and `emitThemes` now share that one rule, so the stylesheet and the resolved record agree.
