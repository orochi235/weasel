I couldn't write `.skulk/out/findings.md` because permission to write it was refused, so the whole findings document is below. Two more things to know before reading it. The frozen commit `04c3a6536306f9e757e77a6ab15759ff43b02241` isn't in this clone (`git cat-file` reports a bad object), so I read the tree at HEAD (`782733b19c`), where `packages/devtools/src/views` has no uncommitted changes. And the dixeram `take` tool isn't among my tools, but this turn had nothing to file.

```markdown
# Findings: devtools.views (round 45)

The frozen commit 04c3a6536306f9e757e77a6ab15759ff43b02241 is not in this clone. These files were read at HEAD 782733b19c; `packages/devtools/src/views` is clean there.

## The State tab's overlay switches drop later steps of an Alt-drag sweep, because each step is compared with the render the sweep began in
- where: packages/devtools/src/views/StateView.tsx:55-58 (StateView, CheckboxGroup onChange)
- scenario: Overlays A, B and C are all on. Alt-press A to solo it: onChange(['A']) sends `{B:false, C:false}`. Before the refresh re-renders, the drag reaches B: onChange(['B']) is compared with the stale `st.overlays`, which still has all three on. So it sends `{A:false, C:false}` and never `B:true`. The page ends with nothing on while the group shows B soloed. The same loss hits any sweep step that undoes an earlier step within one round trip: a flag swept on and then back off sends nothing the second time. Commit 39070452ef ("send every overlay flag … so an Alt-drag's later steps reach the page") fixed this by sending every flag. Commit 9041378cfb, which removed useValueChanges, put back the filter that sends only flags differing from the render, and the bug returned.
- evidence: read (the code and both commits' diffs; the sweep sequence is reasoned, not run)
- severity: medium

## GestureRoute draws a key route's arg as one literal key, so a wildcard reads as the `*` key and optional modifiers in the arg disappear
- where: packages/devtools/src/views/GestureRoute.tsx:43-61 (gestureRouteSegments)
- scenario: `parseRoute` fills a missing arg with `'*'` (routeGrammar.ts:152-153), so `[initial] keyDown` (any key) gets `parsed.arg === '*'`. `argIsKey` is then true, and the strip draws a KeyCap labeled `*`, the same as a binding to the asterisk key. Likewise `keyDown(z?shift)` is valid grammar (`parseKeyRoute`), but the strip draws one KeyCap from the whole string `z?shift` and drops the optional-shift chord. `describeRoute` in gestures answers both cases the other way: it reads `'*'` as "any key" (`concreteArg`) and folds the key route's optional modifiers into the route's own (`keyRouteOf`). So two renderers in the repo give different answers for the same route.
- evidence: read
- severity: low

## Overlay flags changed by the app go stale in the State and Frame tabs, because no notice covers them
- where: packages/devtools/src/views/FrameView.tsx:33-38 (FrameView); packages/devtools/src/views/StateView.tsx:16 (StateView)
- scenario: The overlay flags the page reports are the canvas's own `debug` prop with the panel's override laid over it (page/attach.ts:66, handlers.ts:77). `DevtoolsArea` has no overlay area, and the views listen for none: FrameView queries `get-state` with `[]`, and StateView with selection, view and tool only. If the app turns `fps` on through its own `debug` prop while the Frame tab is open, the tab keeps saying "measures its paints only while the fps overlay is on" and never polls. If the app turns it off, the tab keeps polling and shows the last frame frozen. The State tab's switches show the old values until a selection, view or tool change happens to re-read them.
- evidence: read (it is inferred, not run, that an app changes `debug` while the panel is open)
- severity: low

## Files read
packages/devtools/src/views/Bindings.tsx
packages/devtools/src/views/CoordTable.tsx
packages/devtools/src/views/DecisionPath.tsx
packages/devtools/src/views/DispatchView.module.css
packages/devtools/src/views/DispatchView.tsx
packages/devtools/src/views/FallthroughDiagram.fixtures.ts
packages/devtools/src/views/FallthroughDiagram.module.css
packages/devtools/src/views/FallthroughDiagram.stories.tsx
packages/devtools/src/views/FallthroughDiagram.tsx
packages/devtools/src/views/FrameView.module.css
packages/devtools/src/views/FrameView.tsx
packages/devtools/src/views/GestureRoute.module.css
packages/devtools/src/views/GestureRoute.stories.module.css
packages/devtools/src/views/GestureRoute.stories.tsx
packages/devtools/src/views/GestureRoute.tsx
packages/devtools/src/views/HistoryTable.tsx
packages/devtools/src/views/HistoryView.module.css
packages/devtools/src/views/HistoryView.tsx
packages/devtools/src/views/NodeDetail.tsx
packages/devtools/src/views/RegistryBrowser.module.css
packages/devtools/src/views/RegistryBrowser.tsx
packages/devtools/src/views/RegistryEntryDetail.tsx
packages/devtools/src/views/RegistryView.module.css
packages/devtools/src/views/RegistryView.tsx
packages/devtools/src/views/SceneView.module.css
packages/devtools/src/views/SceneView.tsx
packages/devtools/src/views/StateView.module.css
packages/devtools/src/views/StateView.tsx
packages/devtools/src/views/TraceTable.module.css
packages/devtools/src/views/TraceTable.tsx
packages/devtools/src/views/ValueView.module.css
packages/devtools/src/views/ValueView.tsx
packages/devtools/src/views/formatAge.ts
packages/devtools/src/views/keyName.ts
packages/devtools/src/views/note.module.css
packages/devtools/src/views/sequenced.ts
packages/devtools/src/views/useSceneTree.ts

<!-- done: 3 findings, files read: 37 -->
```

<!-- done: 3 findings, files read: 37 -->