---
'@weasel-js/core': patch
---

`clipboard.paste` takes an optional world point: `useClipboardOps().paste(at?)`, the `clipboard` dep's `paste(at?)`, and the action's `worldX`/`worldY` params. Given one, the paste lands there instead of at the pointer, so Paste chosen from a context menu pastes where it was opened.
