---
'@weasel-js/core': patch
---

The pen tool snaps to existing anchors. An anchor placed within
`anchorSnapRadius` screen pixels (default 8) of any existing path's anchor
lands exactly on it, which makes stitching paths end to end precise. Anchor
snapping takes precedence over `snapPoint`, which still applies away from
anchors; `anchorSnapRadius: 0` turns it off.

This is additive: `usePenTool` gains the `anchorSnapRadius` option.
