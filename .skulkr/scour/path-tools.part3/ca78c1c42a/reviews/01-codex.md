# Review saturation for `path-tools.part3`

Snapshot `ca78c1c42a92855c2a3e72ac749e4854d9c29849`. The tracked working tree was clean at the start of review. Scope is the 37 listed files in the working-tree [Skulkr partition](.skulkr/partition.json). Passes shared context.

| Pass | Focus | New | Distinct | No-new streak |
|---:|---|---:|---:|---:|
| 1 | Shape Builder cache ownership and scene replacement | 1 | 1 | 0 |
| 2 | Outline conversion failure and gesture journal cleanup | 1 | 2 | 0 |
| 3 | Warp storage validation and topology preservation | 1 | 3 | 0 |
| 4 | Slice and Snip candidate resolution and pending cut lifecycle | 0 | 3 | 1 |
| 5 | Spiro insertion, contour indexing and pointer preview | 0 | 3 | 2 |
| 6 | Tool bindings, Tug replay and shared adapter contracts | 0 | 3 | 3 |

Stopped after three consecutive passes with zero new defects.

### 1. Shape Builder can commit to a previous scene after the adapter changes

[shapeBuilderActions.ts](packages/path-tools/src/shapeBuilder/shapeBuilderActions.ts#L25) · Pass 1 · P2 · Source-traced

Use a persistent tool instance with two successive scene adapters, each with the same operand ids, order, paint and world paths. Hovering in the first scene primes the cache. The same serialized key in the second scene returns the first scene's plan, whose commit closure captured the first adapter. A click in the second scene can edit the first scene while handing replacement ids back through the second scene's operands.

### 2. A failed gesture commit can leave converted text and its journal open

[outlineSession.ts](packages/path-tools/src/shared/outlineSession.ts#L89) · Pass 2 · P2 · Source-traced

Convert text through an outline session, then let the supplied apply callback throw while committing the gesture. The conversion has already changed scene nodes under an open journal. commit exits before closing or canceling it, so the converted nodes remain and the history journal is left active after the failed gesture.

### 3. A warp stays editable after the stored path changes command topology

[pathWarp.ts](packages/path-tools/src/warp/pathWarp.ts#L124) · Pass 3 · P2 · Source-traced

Take a node holding a live warp whose result has multiple drawing commands. Rewrite a stored line command as a move command while keeping all coordinates and command counts unchanged. sameUnder accepts the modified path because it checks command count and coordinate positions only. resolvePathWarp can therefore re-open the old warp and a subsequent control edit can restore the segment the path edit removed.

Source and tests were left untouched.
