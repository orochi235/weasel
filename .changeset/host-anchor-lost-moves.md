---
'@weasel-js/core': patch
---

Fixes: a panel held by `useHostAnchor` could be left behind for good when its host moved several times in quick succession, or moved while wholly outside the viewport. After each move the hook rebuilds the frame it watches the host through, and a move that landed before the rebuilt frame's first report was taken for a host partly off screen and never reported. That first report is now checked against the box the frame was built around.
