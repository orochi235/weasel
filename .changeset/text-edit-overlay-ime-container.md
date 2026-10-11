---
'@weasel-js/core': patch
---

Three fixes to `useTextEdit`. Turning underline, strikethrough, overline, or italic off for a selection in a node that sets it left the selection drawn with it until the edit committed; the overlay now drops the node's flag when the node does. Enter and Escape pressed to confirm or dismiss an IME candidate no longer end the edit. An edit started before `container` was set now mounts its overlay when the container arrives, instead of leaving the node hidden with no editor.
