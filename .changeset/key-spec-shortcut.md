---
'@weasel-js/core': patch
---

Export `keySpecShortcut(spec)` — the chip form of one gesture spec, or
`undefined` where a spec has none — and `actionBindings(action)`, the flat
binding list `actionShortcuts` already reads.

`actionShortcuts` is now a dedupe over `keySpecShortcut`, so the spec-to-chip
mapping has one implementation. It had two: ToolkitBuilder's binding table
projected key specs inline, and rendered a `'optional'` modifier as a keycap
the reader has to press. Surfaces that render drag, click and wheel specs
alongside keyboard ones can now share the keyboard half without taking
`actionShortcuts`' action-at-a-time shape.
