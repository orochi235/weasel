---
'@weasel-js/diagram-formats': patch
---

A Mermaid sequence diagram reads back as it was written: a participant id that is not a plain name, or is `title`, is renamed, keeping its text as the label (one holding a space or a `:` made the file unreadable); a blank participant label is dropped with a warning instead of writing `A as`, which does not read; an `&` before a `#` or `;` the writer spells as an entity is kept; and a title opening with `:` keeps it.
