---
'@weasel-js/text': patch
'@weasel-js/bidi': patch
'@weasel-js/core': patch
'@weasel-js/svg': patch
---

Right-to-left text lays out in visual order everywhere once a bidi engine is registered: `registerBidi(bidi)` (from `@weasel-js/text` or `@weasel-js/core`, with `bidi` from `@weasel-js/bidi`) gives `layoutRuns` an engine to fall back on when its options carry none, so painting, picking, the caret, `measureTextBounds`, and `textToPath` all reorder.

An omitted `direction` now means `'auto'` for alignment as well as for reordering: each paragraph's first strong character decides which edge `start` and `end` are. `TextStyle.direction` and `LayoutRunsOpts.direction` accept `'auto'`, `ResolvedTextStyle.direction` defaults to it, and a text command carries `direction` and the unresolved `align`. `paragraphDirection(text, direction)` answers which way a text reads.

Breaking for a custom engine: `BidiResolver` gains `baseLevel(analysis)`, which `@weasel-js/bidi`'s `bidi` implements. `TextDrawCommand.align` and `TextPoseLayoutInput.opts.align` may now be `start`, `end`, or `justify`.

The edit overlay states the same direction in CSS, and `@weasel-js/svg` writes the direction a text actually reads in and keeps a stated `ltr` through a round trip.
