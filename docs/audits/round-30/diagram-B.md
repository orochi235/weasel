# diagram-B findings (round 30)

## registerMarkShape({ geometry }) throws beside any other mark painter, and has no id to avoid it
- where: packages/diagram/src/marks.ts:108 (registerMarkShape), packages/diagram/src/marks.ts:84 (markShape); same shape at packages/diagram/src/shape.ts:117 (registerDiagramShape)
- scenario: a page mounts a `DiagramView` (which registers the shared default `diagram:mark` entry, DiagramView.tsx:89) and a second canvas whose poses are not rects calls `registerMarkShape({ geometry: myPose })`. `markShape(opts)` builds a fresh entry whose id is hard-wired to `'diagram:mark'`, and since 42aab0cb66 the global `defaultNodeShapes.register` throws `ExtensionConflictError` for a different entry under a held id. The same happens for two mounts of one component that registers a geometry-specific mark painter (each call builds a new entry). `markShape` takes no `id` option, so the caller cannot pick a distinct id; only `{ replace: true }` via `registerNodeShape` directly, which then displaces DiagramView's painter. `registerDiagramShape({ geometry })` / `({ read })` without an `id` has the same throw (two mounts, or one beside DiagramView); there an `id` exists but the README (`registerDiagramShape()` "once") and the default say nothing about needing one. Should: let a geometry-specific mark painter register under its own id (an `id` option as diagramShape has, or an id derived per geometry), or reuse one entry per options.
- evidence: read
- severity: medium

## diagram.layout stays enabled (and re-runs push a no-op history entry) after a layout, because a pose counts as unmoved only on exact float equality
- where: packages/diagram/src/layoutAction.ts:137-139 (layoutPoses: `if (dx === 0 && dy === 0) continue`), used by createLayoutAction's `enabled` (layoutAction.ts:267-270) via writesNothing
- scenario: run `diagram.layout` once. Each node is written as `x + (at.x - x)` (RECT translate, core poseDescriptor.ts:120), which is not `at.x` in about 1 case in 6 for arbitrary doubles (ran: 100 000 random pairs in [0,1000), 16 565 mismatches). Re-planning gives the same `at`, so `dx = at.x - stored.x` is ±1 ulp, the pose is "moved", `writesNothing` is false, and the action stays enabled; invoking it writes ulp-sized poses as a fresh "Layout" undo entry. With n nodes the chance every one lands exactly is ~0.83^n, so on most real diagrams the 2026-11-15 ruling ("disabled when the layout would move nothing", unruled.md:2468) does not hold. routeWrites already uses ROUTE_TOLERANCE for the same reason (routeWrites.ts:31); the pose side has no tolerance. Should: treat |dx|,|dy| under a tolerance as no move (or write `at` directly for rect bounds).
- evidence: read; ran (arithmetic of x + (at - x) vs at in node, scratch only — not the layout code itself)
- severity: medium

## Mermaid flowchart `@{ … }` metadata splits a quoted label at its commas (and ends at a quoted `}`)
- where: packages/diagram-formats/src/mermaid/flowchart/parse.ts:49 (metaOf → common/styles.ts:17 splitTop / :30 propsOf); packages/diagram-formats/src/mermaid/flowchart/lex.ts:135-139 (mark, `@{` branch)
- scenario: `flowchart TD\n  A@{ shape: rect, label: "Hello, world" }`. splitTop splits on every comma outside parentheses, quotes not considered, so the pairs are `shape: rect`, `label: "Hello`, `world"`. metaOf's `^".*"$` test fails on `"Hello`, so node A reads with the text `"Hello` (stray quote kept) and the rest of the label is lost with no warning. Likewise `A@{ label: "a}b" }`: the lexer ends the metadata at the first `}` (`text.indexOf('}', this.i)`), leaving `b" }` to be lexed as a node, which throws or misreads. Kanban's reader already parses quoted metadata properly (kanban/parse.ts:22 metaOf); the flowchart path does not. Should: split metadata on commas outside quotes, and find the closing `}` outside quotes.
- evidence: read
- severity: medium

## The new unknown-ref and unknown-theme dev warnings keep a module-wide, unbounded "warned" set, so they fire once per id per process, not per diagram
- where: packages/diagram/src/unknownRefs.ts:5 (`warned`, warnUnknownRefs); packages/diagram/src/theme/resolve.ts:46 (`warnedThemeIds`, diagramThemeFrom)
- scenario: an editor that rebuilds `diagramScene` as the user types data (or a theme id) adds every distinct misspelled id to a set that is never cleared; in a long dev session it grows without bound. And because the set is process-wide, a second, unrelated diagram (or the same one after the user fixed and later re-broke it) that names `"nowhere"` gets no warning at all — the commit's own test ("warning once per unknown id") only passes because no earlier test in the file used the same id. Should: dedupe per call (a local set inside warnUnknownRefs, as the doc "once per id" for one data set implies) or bound the set the way marks.ts bounds PARSED.
- evidence: read
- severity: low

## applyDiagramTheme throws on any scene holding a locked node, layer, or sequence the theme would recolor
- where: packages/diagram/src/theme/applyTheme.ts:44-51 (writeAll) and :68-77 (applyDiagramTheme); packages/diagram/src/theme/themeWrites.ts:143 (themeWrites — no lock test); also the relayoutBodies/redrawSequences writes in the same batch
- scenario: lock one shape (or a whole layer) in a themed diagram, then switch the theme (chart app's applyChartTheme → applyDiagramTheme). themeWrites returns new data for every shape, row, connector and label, locked ones included; writeAll calls `scene.update` on each, and the scene's lock guard (core lockGuard.ts refuse, fieldEdits.ts:50) throws `Scene: cannot update "<id>" — … is locked`. The batch fails and the theme switch does nothing but throw. A text-size change across themes also re-lays bodies via setPose, refused the same way. Round 28 fixed this class for router commands, add-lane and layout (they now skip or disable on locks); the theme path still has no `isLocked` check and no `scene.unlocked` wrapper. Should: decide one way — skip locked nodes (as layout does) or recolor them inside `scene.unlocked` (a theme is a document-wide look, not an edit of the node) — instead of throwing.
- evidence: read
- severity: high

## installFaceRemeasure throws from a microtask when a late font lands on a scene with a locked body or label
- where: packages/diagram/src/faceRemeasure.ts:34-50 (remeasureText) → packages/diagram/src/bodyRelayout.ts:124-139 (relayoutBodies: scene.update / setPose with no lock check); installFaceRemeasure's queueMicrotask(run) at faceRemeasure.ts:69
- scenario: a diagram whose text was measured before a lazily registered face loaded, with one shape locked (or on a locked layer). When the face lands, remeasureText walks every body and label, and relayoutBodies writes the locked body's new row heights (`scene.update`) and grown pose (`setPose`). `untracked` only keeps the writes out of history; it does not lift the lock guard (core lockGuard.ts: only `unlocked()`/replays lift it), so the scene throws `cannot update "<id>" … locked`. It throws inside a microtask, so it surfaces as an uncaught error, and every body, label and sequence after the locked one in render order keeps its stale fallback-face size. Should: run the remeasure inside `scene.unlocked` (it restores what the text already says, like a replay) or skip locked nodes.
- evidence: read
- severity: medium

<!-- done: 6 findings, files read: 45 -->
