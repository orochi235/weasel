---
'@weasel-js/core': patch
'@weasel-js/select': patch
'@weasel-js/routing': patch
'@weasel-js/diagram': patch
---

Cmd-click toggles and Shift-click selects a range, by default. This changes the defaults: anyone relying on Shift-click toggling a node, or on Cmd-click picking past groups, has to move.

- `useSelection`'s `extend` key now defaults to Cmd on Apple platforms and Ctrl elsewhere, and `range` defaults to Shift. Passing `extend: 'shift'` keeps the old behavior: Shift toggles and nothing ranges.
- On a canvas, a Shift-click selects every node a click there could select whose center lies in the box the last node clicked and the pressed one span, read where each is drawn (turned and framed), of any kind. A group whose center lies in the box comes whole; inside an entered group, the range stays inside it.
- `select.deep`, which selects the node under the pointer past every group, moves from Cmd-press to Cmd+Alt-press (Ctrl+Alt off macOS). With Shift it ranges among the nodes around the one it picked.
- `UseSelectToolOptions.between` sets what a range covers; `useSelectTool` defaults it to the box rule above, and `useSelectToolWith` without it walks the selection's order. `SelectionApi.applyClick` takes the range as an optional third argument, and `@weasel-js/select`'s `SelectContext` takes it as `between`, ahead of `order`.
