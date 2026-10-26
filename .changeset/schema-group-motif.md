---
'@weasel-js/prefs': patch
'@weasel-js/ui': patch
---

A schema group or section can name the motif its frame is drawn in: `motif: 'hero'` on a `PrefGroup` or `PrefSection`. `PrefsForm`, `PrefsPane` and `SelectionPanel` pass it to the group's `MotifFrame`, which looks the name up in the new `named` prop of a `<DefaultMotif>` above (`<DefaultMotif named={{ hero: stereo() }}>`). A name nothing defines draws the form's own look, as an unset one does. `MotifFrame`'s `motif` takes such a name as well as a motif.
