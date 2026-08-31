---
'@weasel-js/core': patch
'@weasel-js/ui': patch
---

A schema leaf can hold an object, with its fields hanging off it

A compound value — a stroke, a shadow, a pattern spec — could be described as
sibling leaves addressing into it (`data.stroke.width`, `data.stroke.cap`).
It shouldn't be: each control then writes one field of a value it can only
half see, and writing a field into something that isn't an object yet corrupts
it outright.

`ToolPrefObject` describes the value instead. Its `children` are ordinary
leaves whose paths are relative to the object, and every child edit commits
the parent object whole. A field that is itself a union declares the kind that
edits that union — a stroke's `paint` is a `paint` leaf. `fromScalar` lifts a
value still held in a scalar form before a child edit lands on it, which is
how a stroke stored as a bare colour string gains a width.

`defaultNodeProperties` describes `data.stroke` this way, so the panel shows
Color, Width, Cap, Join and Align under one Stroke block, and the separate
`data.strokeWidth` leaf is gone. `SelectionPanel` now honours `block`, which
`PrefsForm` already did. The one-off `stroke` pref kind added days ago is
replaced by this general one.

`dash` has no leaf: it is a `number[]` and no kind edits one. It survives
import, export and rendering untouched.
