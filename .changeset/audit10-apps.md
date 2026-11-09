---
'@weasel-js/theme': patch
---

applyTheme leaves out more token values that would break its stylesheet.

- A value that opens a comment, holds a line break inside a quoted string, or ends in a backslash is now left out with a development warning, like one holding `;`, `{` or `}`. Each of these used to end its declaration or rule early, and a `/*` commented out every theme rule after it.
