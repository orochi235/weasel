---
'@weasel-js/routing': patch
---

`useOngoingAction` no longer commits an open edit during StrictMode's rehearsal unmount. The
commit on unmount now waits a microtask, and a remount with the same action id in that time
keeps the edit open; a real unmount still commits it, and changing the id still commits the old
action's edit at once.
