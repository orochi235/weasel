---
'@weasel-js/diagram': patch
---

`parseDiagramTheme` checks a theme's optional fields, and refuses a non-finite font size or an empty `series`.

The optional fields are the header colors, outline widths and dashes, and the connector's label color, width, dash, markers and trim.

<!-- entry: fix data -->
