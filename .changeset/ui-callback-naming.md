---
'@weasel-js/ui': patch
---

`@weasel-js/ui` now spells the live/committed callback pair one way, on every
control that has both: **`onInput` fires continuously through a gesture, and
`onChange` fires once when it commits.**

Four components move to it. `ColorField`, `GradientEditor` and
`GradientHandles` already used this sense and are unchanged.

| Component | was (live / committed) | now |
|---|---|---|
| `Slider` | `onChange` / `onCommit` | `onInput` / `onChange` |
| `ResizeHandle` | `onChange` / `onChangeEnd` | `onInput` / `onChange` |
| `CurveEditor` | `onChange` / `onChangeCommit` | `onInput` / `onChange` |
| `PointPlotter` | `onChange` / `onChangeCommit` | `onInput` / `onChange` |

Four spellings had grown up, and two of them disagreed about what `onChange`
meant — so a reader who learned `Slider` guessed `ColorField` backwards. The
surviving pair is the DOM's own: `input` fires while you type or drag, `change`
when the edit is done. It also means a single-callback control like `ToggleBar`
keeps `onChange` with commit semantics intact.

**Migrating is a rename, but `onChange` still compiles while meaning something
new, so read this before running a codemod.** On the four components above,
`onChange` used to be the live callback and is now the committed one. Passing a
live handler to `onChange` type-checks and then only fires on release. The
committed names (`onCommit`, `onChangeEnd`, `onChangeCommit`) are gone, so those
fail loudly; the live rename is the one to do by hand.

Behavior is unchanged, including which callback is required: these four are
fully controlled, so `onInput` is required (without it the control freezes
mid-drag) and `onChange` is optional. `ColorField` and `GradientEditor` buffer
internally and keep the opposite. Required-ness follows the control's state
model, not the naming.

`CurveEditor`'s layer-gesture `onCommit(state, ctx)` is a different protocol and
is untouched.
