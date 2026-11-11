---
"@weasel-js/text-dom": patch
---

Editing a text node no longer loses styling its runs held. The edit overlay used to drop a run's `fontScale` beside an absolute `fontSize`, and its `bold` beside its own `fontWeight`, and it respelled a solid fill's color as the browser serializes it (`#ff0000` came back as `rgb(255, 0, 0)`, and a `{ color }` paint gained `kind: 'solid'`), or lost the fill outright when the browser could not parse the color. Each is now kept in an attribute on the run's span and read back as written.
