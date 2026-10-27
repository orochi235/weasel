---
'@weasel-js/routing': patch
---

Escape in an open keymap now cancels a gesture in flight before it closes the keymap. A `holdPreview` hold started from a keymap whose leader is still held used to keep running: Escape closed the keymap, and the key's release then ran the action. Now Escape reaches the canvas's cancel binding (core's `cancelGesture`) while anything is in flight, the hold's preview comes down, its release runs nothing, and the keymap stays open for a second Escape to close. With nothing in flight, or no binding that takes Escape, it closes the keymap as before.
