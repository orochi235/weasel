---
"@weasel-js/text-dom": patch
"@weasel-js/core": patch
---

A text node with `overflow: 'clip'`, such as a sticky note, scrolls its text inside its box while it is edited.

The wheel scrolls it, and a caret moved out of view by the arrow keys, typing, a click or select-all brings it back. The box, and the paper the canvas paints there, stays put. The edit opens scrolled to where `verticalAlign` puts the text on the canvas, so a bottom-aligned note opens on its last line, and the scroll ends with the edit. `TextEditScreenPose.clip` asks for this, so any `useTextEdit` host gets it.

<!-- entry: new api -->
