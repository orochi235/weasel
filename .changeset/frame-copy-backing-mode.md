---
'@weasel-js/forge': patch
---

A Live lens backs its copy of a story in the compared mode, so a transparent story under an opposite-mode lens no
longer shows the lab through it. The workshop applies an isolated story's copy's globals to the copy's host through
the frame config's `applyGlobals`, as it already did for an in-document story's host, and the copy's host and the
lens's "Nothing under the reticle" message paint `--wzl-surface`: they named `--wzl-bg`, which no theme defines, and
so painted nothing.
