---
'@weasel-js/core': patch
---

The hand tool pans from wherever a drag starts.

- A drag with the hand tool (or held Space) that starts on chrome holding an exclusive claim, such as a measurement or a selection handle, pans the view. Before, the chrome's own binding took the drag, so a hand drag starting on a measurement moved the measurement. The hand and the eyedropper now share one target that reads through chrome.
