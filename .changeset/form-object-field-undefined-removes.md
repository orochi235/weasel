---
'@weasel-js/ui': patch
---

In a `PrefsForm`, an `object` leaf's field written as `undefined` (by an enum `encoding` whose `write` returns it, say) left the key in the committed object holding `undefined`. The key is now removed, as `SelectionPanel` already did and as the `encoding` contract says.
