---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
---

Edge labels are obstacles, and they dodge. An `avoid` connector now routes around every other
connector's label, 4 world units clear (`labelClearance`), and never around its own; within one
commit a label is restationed on its connector's new route before the next connector routes.
`AvoidEdge.label` carries it, filled from the scene and from `DiagramView`'s specs. An obstacle's
`kind` may now be `'label'`.

After any edit, `useLabelPlacement(scene)` (or `installLabelPlacement` outside React) moves a label
that sits on a shape, another label, or another connector along its own connector, or across it,
to the nearest clear station, in that edit's own undo entry, and sizes a label to the text an edit
gives it. The chosen station is stored on the label trait as `placed`, which `labelDerivePose`
reads before `at` and `offset`; `dodge: false` opts a label out. Labels hold still during a drag
and settle on release. `DiagramView` takes `labels="dodge"`, `createSpecLabelPlacer` is that step
on its own, and `placeLabels` — the placement alone, over plain boxes and routes — is in
`@weasel-js/diagram/layout` with `labelCenter`.

Core adds `documentDepOf(scene, id)`: a dependency at the pose and path the document holds, with
no override counted, for a reader such as an edit pass.

weaselchart places edge labels, so a shape dropped on a label moves the label off it on release.
