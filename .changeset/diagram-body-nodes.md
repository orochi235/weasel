---
'@weasel-js/diagram': patch
---

`buildBody` turns a `BodySpec` into the scene nodes that draw it.

The container carrying the trait, and one leaf per row that wants drawing —
placed by the same `layoutBody` walk the row ports anchor against, so a label
and its ports cannot drift apart, and posed by `sizeToBody(at, measureBody())`,
so the authored size is grown to clear the rows and never shrunk. A row's data
is the consumer's, through one callback that is handed the row's text already
formatted; returning `null` leaves that row undrawn, which is what a `ports` or
`slot` row usually wants.

Also fixed: a row port and a compass port could land on the same point, and one
of them was then grabbable nowhere. `bodyTrait` anchors a `ports` row's entries
at `u: 0` and `u: 1`, which for a row near the vertical middle put them exactly
where `w` and `e` already were — the later region won the hit, and a node
declaring six ports offered four. A row port on a side now takes that side's
compass default with it: a body that says where its inputs attach has said what
that side is for.
