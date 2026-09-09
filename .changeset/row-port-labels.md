---
"@weasel-js/diagram": patch
---

`layoutRowPorts` places a `ports` row's ports inside the row box, on the same
terms `layoutBody` places one box per row. Both sides are cut into the same
number of slots — the longer side's count — so the nth input faces the nth
output; each port's label box is as wide as its own text and pinned to its own
edge of the row.

Two things follow. `RowPort.label` is drawn now rather than only measured:
`buildBody` takes a `portLabel` callback and emits one text node per labeled
port, the same way `row` emits one per row. And `bodyTrait` anchors each row
port to its own slot instead of stacking every port on a side at the row's
vertical center, where a second port was grabbable nowhere.

`buildBody` also marks every leaf it emits `pickable: false`. The innermost hit
wins, so a body whose rows answer a press is a body that cannot be dragged —
which each consumer was otherwise left to discover and patch itself.
