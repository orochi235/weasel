---
'@weasel-js/core': patch
'@weasel-js/text-dom': patch
---

Fixes: editing a text node whose pose is turned or carries a `transform` put the edit overlay on the node's unturned, unskewed box, and a double-click opened the editor from that box where no text is drawn. `useSceneTextEdit` hands the overlay the frame the node is drawn in, and takes a double-click back through it before testing it against the text.

Adds API: `TextEditScreenPose.frame`, the linear part `[a, b, c, d]` of the frame a text box is drawn in, applied about the box's center. `useTextEdit` writes it into the overlay's CSS transform with the `zoom`.
