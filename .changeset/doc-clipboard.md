---
'@weasel-js/core': patch
'@weasel-js/editor': patch
---

Copy and paste for an app whose own document owns its nodes, with no `InsertAdapter` to write. Core's new `useClipboard` takes the app's `copy(ids)` and `paste(items, at)` functions and returns the `clipboard` dep's shape; `paste` reports the new ids and the copies the next paste steps on from. `useClipboardOps` is now `useClipboard` over an adapter, and behaves as before, except that a copy which finds nothing to take keeps the last copy instead of emptying the clipboard. `@weasel-js/editor`'s `useDocClipboard` adds `clipboard.copy` and `clipboard.paste` commands, bound to Cmd/Ctrl+C and V, and the document undoes the paste. `InsertAdapter.commitPaste`'s docs now say that what it returns becomes the next paste's clipboard, so it must be shaped like `snapshotSelection`'s items.
