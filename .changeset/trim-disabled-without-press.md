---
"@weasel-js/path-tools": patch
---

Trim segment is disabled with `NotApplicable` when it has no click and the press in its params reaches no piece it could cut, so a command palette or menu no longer offers a trim that does nothing. A click still enables it, and the run decides from the click's point, as for Extend to next path.
