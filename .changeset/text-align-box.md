---
"@weasel-js/text": patch
"@weasel-js/core": patch
---

`kit:text` nodes with `align: 'center'` or `'right'` now align within
`pose.width`. They were anchored on `pose.x`, so centered text hung half outside
the left edge of its box and right-aligned text ended at that edge.

Alignment has its own width, separate from the wrap width:
`LayoutRunsOpts.alignWidth` and `TextDrawCommand.width`, both defaulting to
`maxWidth`, and a trailing `width` argument on `textCommand` /
`textCommandFromRuns`. The painter passes its pose width there and still does
not wrap. `textLineBoxes` and `caretIndexAt` align within `pose.width` even at
`maxWidth: Infinity`, so the silhouette and the caret follow the paint. A
`layoutRuns` call or text command that sets no alignment width lays out exactly
as before.
