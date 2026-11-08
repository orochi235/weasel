---
'@weasel-js/text': patch
'@weasel-js/text-dom': patch
'@weasel-js/core': patch
---

Fix text editing and mixed-face line heights

- A character typed under an armed style (Cmd+B at a collapsed caret) keeps the styling of the run it is typed into.
- Text committed through an input method takes the armed style, and small-caps letters it typed are re-split once the composition ends.
- A paste that ends the text with a line break keeps that break on commit.
- A line holding two faces grows to clear the lower one's descent, as CSS does, so canvas lines no longer overlap or sit closer than the edit overlay's.
- The scene edit overlay sizes `{ px }` font sizes and letter spacing as `kit:text` draws them, at any zoom. `TextEditScreenPose` takes a new `pxScale`.
