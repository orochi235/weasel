---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`KeySequence` takes a new `joins` prop saying where its separator goes: `'all'` puts one between every pair of chips (`⌘ + ⇧ + K`), `'key'`, the default, puts one before every non-modifier key (`⌘ ⇧ + K`, `⌘ + K + L`) — the same as before for a single key, but a second key is now joined too, and `'none'` draws none. The `KeySequenceJoins` type is exported, and labkit's `weasel-ui` passthrough carries it.

Breaking: `separator` is now only the glyph and no longer accepts `null`, and an empty string no longer means "no separator". Pass `joins="none"` instead.
