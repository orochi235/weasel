---
'@weasel-js/history': patch
---

A journal whose pushes coalesced committed an entry that undid only the last of them: two same-key edits inside the coalesce window, then `commit`, then undo on the parent, stopped at the value between the two. `Journal.commit` now hands the parent both halves of each entry, so undo returns to the state the session opened on and redo to the one it closed on.
