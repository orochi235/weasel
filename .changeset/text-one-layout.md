---
"@weasel-js/text": patch
"@weasel-js/core": patch
"@weasel-js/svg": patch
---

Text wraps only where its style says so, and everything that lays a text node
out now agrees. `TextStyle.wrap` (default `false`) breaks lines between words
at the pose width; without it a line runs as long as its text and the width
only resolves `align`.

Before this, `kit:text` never wrapped while `createTextLayer`, `textLineBoxes`,
`caretIndexAt`, `fitTextPose` and the edit overlay all wrapped at the pose
width. Opening an edit on a `kit:text` line longer than its box reflowed it,
and a double-click could put the caret on a line the canvas never drew.

**Breaking:**

- `createTextLayer` and `fitTextPose` (`axis: 'height'`) no longer wrap unless
  the style sets `wrap: true`. Add it to text that should keep wrapping.
- `TextLineBoxesOpts.maxWidth` and `caretIndexAt`'s `opts` argument are gone,
  along with the `CaretIndexAtOpts` type. Both read `style.wrap`.
- The edit overlay is `white-space: pre` for unwrapped text, sized to its
  content, and never breaks inside a word in either mode.

New: `layoutTextPose` and `textPoseLayoutInput` in `@weasel-js/text`, and
`textCommandFromPose` in `@weasel-js/core`, which `kit:text` and
`createTextLayer` both emit. `textLineBoxes` and `caretIndexAt` now resolve
`align: 'start' | 'end'` against `direction` as the painters do, and
`useSceneTextEdit` maps a double-click through the node's `verticalAlign`
(`getVerticalAlign` for custom data), which it used to ignore. SVG export
writes `data-weasel-wrap="true"` and import reads it back.
