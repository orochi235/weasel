---
"@weasel-js/text-dom": patch
"@weasel-js/core": patch
---

Edit text that runs past a clipped node's box. A text node with `overflow: 'clip'`, a sticky note among them, now scrolls its text inside its box while it is edited: the wheel scrolls it, and a caret moved out of the box by the arrow keys, typing, a click, or select-all brings it back into view. The box, and the paper the canvas paints there, stays put. The edit opens scrolled to where `verticalAlign` puts the text on the canvas, so a bottom-aligned note opens on its last line, and the scroll ends with the edit. `TextEditScreenPose.clip` asks for this, so any `useTextEdit` host gets it.
