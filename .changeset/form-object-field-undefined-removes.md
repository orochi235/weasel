---
'@weasel-js/ui': patch
---

In a `PrefsForm`, an `object` leaf's field written as `undefined` (an enum `encoding` whose `write` returns it, or a cleared `clearable` enum) left the key in the committed object holding `undefined`. The key is now removed, as `SelectionPanel` already did and as the `encoding` contract says.
