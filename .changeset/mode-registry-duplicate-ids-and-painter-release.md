---
'@weasel-js/modes': patch
---

`createModeRegistry` throws when two modes share an id, where it used to keep the second for lookups and list both. `ModeDecorations.register` now returns a release that removes the painter, so a painter registered from a component can be taken out when the component unmounts; a call that ignored the old `void` return is unaffected.
