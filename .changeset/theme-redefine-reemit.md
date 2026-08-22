---
'@weasel-js/theme': patch
---

A theme redefined under a name it already used now replaces its CSS

`applyTheme` cached emitted rules on `theme.name::mode` and skipped anything
already seen. `defineTheme` takes a caller-supplied name and enforces no
uniqueness, so an edit-and-reapply — a module re-evaluated by HMR, a theme
editor rebuilding its theme — produced a new `Theme` under the same name and
was swallowed as a cache hit, pinning the first token values for the life of
the page.

The cache now holds the rule text it published for each key and republishes
when it differs. Rewriting the sheet rather than appending keeps it the size
of the theme set, so a theme reapplied under one name cannot stack rules.

`resolveTheme` consequently runs on every `applyTheme` call rather than once
per name. That call happens when the theme or mode changes, not per frame.
