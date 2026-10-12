---
'@weasel-js/core': patch
---

core: a node grabbed while a reflow transition was still gliding it, then dropped onto another node with `reparentOnDrop` on, landed where its document pose plus the drag put it, off from where the drag showed it by however far the glide had left to go. It now lands where it was shown. Not breaking.
