---
'@weasel-js/diagram-formats': patch
---

A Mermaid sequence message, note, `activate`, `deactivate`, or `destroy` naming a participant id with a space in it
is refused naming its line, as a declaration already was, where it made a participant whose `participant` line the
reader then refused.
