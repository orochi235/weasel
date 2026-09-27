---
"@weasel-js/ui": patch
"@weasel-js/labkit": patch
---

`KeySequence` takes a new `joins` prop saying where its separator goes: `'all'` puts one between every pair of chips (`⌘ + ⇧ + K`), `'key'` puts one between the last modifier and the key (`⌘ ⇧ + K`, the default and the previous behavior), and `'none'` draws none. The `KeySequenceJoins` type is exported, and labkit's `weasel-ui` passthrough carries it.

Breaking: `separator` is now only the glyph and no longer accepts `null`, and an empty string no longer means "no separator". Pass `joins="none"` instead.
