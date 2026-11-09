---
'@weasel-js/theme': patch
---

A fix to which theme values `applyTheme` writes into its shared stylesheet.

- `applyTheme` leaves out a token value that leaves a `(` or `[` open (`var(--x`, `url(a.woff`), and warns once as it does for other values that would break the rule. Before, the open bracket ran on through every later declaration and rule in the sheet, so one bad pin unstyled every theme written after it.
