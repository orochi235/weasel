---
'@weasel-js/history': patch
---

A journal with another journal still active inside it now cancels that one along with its own entries, and refuses to commit (throwing, as opening a second journal does) until it is committed, canceled or suspended. Before, cancel left the inner journal's edits applied and the inner journal open, and commit recorded an entry that did not include them, so undoing it did not return to where the outer journal began.
