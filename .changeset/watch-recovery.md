---
'@weasel-js/forge': patch
---

Additive: a forge dev server now serves an edit the OS file watcher never reported. Each module is stamped with
its file's modification time when vite reads it; a request for a module whose file has changed since, and a check
of every served file once the watcher has been quiet for two seconds, sends the change through as if the event had
arrived, and logs `[watch] <file> changed with no file event`. `watchRecovery()` from `@weasel-js/forge/vite` gives
any other vite dev server the same, and the `[watch]` warning about missing file events says when a server has it.
