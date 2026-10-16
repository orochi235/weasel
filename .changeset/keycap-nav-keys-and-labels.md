---
"@weasel-js/ui": patch
---

`keySpecFromKey` knows Home, End, PageUp, PageDown, PrintScreen, Insert, ScrollLock, and Pause. In symbol mode they draw ↖ ↘ ⇞ ⇟ ⎙ ⎀ ⇳ ⎉ on every platform; by default they show the text a key prints (Home, End, PgUp, PgDn, PrtSc, Ins, ScrLk, Pause).

A new `labels` option on `keySpecsFromMods`, `keySpecFromKey`, `keySpecsFromShortcut`, and `keySpecsFromChord` replaces any label, by a modifier's logical name (`mod`, `shift`, `alt`, `ctrl`, `meta`) or a key's `KeyboardEvent.key`, up to a whole keyboard's worth. A letter key is found whichever case it is named in. `KeyLabels` is its type.
