---
'@weasel-js/editor': patch
---

Default keys move off chords a browser takes first. Each is a breaking change for anyone relying on the old key.

- `FILE_KEYS.new`, and so `useNewCommand`'s default, is Alt+N instead of Cmd/Ctrl+N, which every browser keeps for a new window.
