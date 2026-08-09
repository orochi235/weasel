---
"@weasel-js/core": minor
---

Underline and strikethrough shortcuts, and the core boundary goes strict.

Cmd/Ctrl+U toggles underline and Cmd/Ctrl+Shift+X toggles strikethrough, both
through `toggleFlagInRange` like bold and italic — so they toggle *off*, a mixed
range turns fully on, and a collapsed caret gets a pending style that styles the
next character only. `rangeStyle.ts` had listed both flags all along; only
`useTextEdit`'s `StyleFlag` and its keydown switch were narrower.

Underline in particular had to be intercepted rather than merely supported.
Left alone, the browser ran its own `formatUnderline` and `domToRuns`' `<u>`
flattening made that look like it had worked while bypassing the run algebra
entirely. The flattening stays — it's what lets pasted decoration survive — but
it was never the mechanism. Bare Cmd+X is deliberately left to the browser so
cutting text mid-edit still works; only Cmd+Shift+X is claimed.

The `core/` ← `features/`/`interactions/` lint rule no longer exempts type
imports. Three types core named across the boundary moved down to where core
can own them — `Path` to `core/geometry/path.ts`, `RectPose` to
`core/scene/types.ts` (whose doc comment already claimed it lived in core), and
`ModifierState` to `core/modifierState.ts` — each with a re-export left at its
old address, so no importer changes.
