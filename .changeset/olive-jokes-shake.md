---
"@weasel-js/core": minor
---

Reorder: `Cmd/Ctrl+Shift+]` and `Cmd/Ctrl+Shift+[` now bring-to-front and
send-to-back. The shortcut every drawing app uses could never fire — modifier
matching is strict, so a binding without `shift` in its spec cannot match a
keystroke that holds it, which also made the shifted `'}'` / `'{'` characters
in those key lists unreachable. `Cmd+Alt+]` / `Cmd+Alt+[` remain as the
fallback for browsers that reserve `Cmd+Shift+[`/`]` for tab switching.

`BUNDLE_TOOLS.standard` no longer includes `pencil`. Freehand is a specialist
instrument rather than part of the everyday shape-drawing set; it is still in
`exhaustive`. Consumers wanting it back can pass `tools={{ pencil: true }}`
alongside the bundle.
