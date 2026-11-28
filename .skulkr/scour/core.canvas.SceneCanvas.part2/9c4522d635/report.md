# core.canvas.SceneCanvas.part2: saturation

Repeated blind reviews of the area `core.canvas.SceneCanvas.part2` (45 files) at the frozen commit
`9c4522d635`, with no fixes between them, from `codex`, `claude`.
Each occasion is one review, or one ingested report; its findings are matched against the ledger of distinct
defects so far. Reviews stop once fewer than one defect is estimated unseen, the chance that the next occasion
finds something new falls under 15%, the next defect would cost over $1.49, or 40 occasions have run.
Stopped: the next occasion's chance of a new finding is under 15% (14.2%). The next defect should cost about $1.72. `skulkr scour report core.canvas.SceneCanvas.part2` rewrites this file from the ledger.

## Yield by occasion

The estimates on each row are Chao2 over every occasion up to it. "Unseen" is the estimated number of defects no
occasion has found; "next-new" is the chance the next occasion's finding is one of them. "$/defect" is what every
occasion up to the row has cost, divided by the distinct defects found so far.

|   # | source | findings | new | distinct |  Q1 |  Q2 | est. total | unseen | next-new |  cost | $/defect | minutes |
|----:|--------|---------:|----:|---------:|----:|----:|-----------:|-------:|---------:|------:|---------:|--------:|
|   1 | codex  |        3 |   3 |        3 |   3 |   0 |          – |      – |        – | $0.16 |    $0.05 |     1.7 |
|   2 | claude |        2 |   2 |        5 |   5 |   0 |       10.0 |    5.0 |   100.0% | $1.49 |    $0.33 |     4.3 |
|   3 | claude |        4 |   3 |        8 |   7 |   1 |       24.3 |   16.3 |    68.1% | $1.26 |    $0.36 |     2.7 |
|   4 | claude |        2 |   1 |        9 |   7 |   2 |       18.2 |    9.2 |    53.5% | $1.19 |    $0.45 |     2.3 |
|   5 | claude |        4 |   3 |       12 |  10 |   1 |       52.0 |   40.0 |    63.5% | $0.66 |    $0.40 |     2.8 |
|   6 | claude |        5 |   2 |       14 |  11 |   1 |       64.4 |   50.4 |    53.1% | $0.58 |    $0.38 |     2.4 |
|   7 | claude |        5 |   2 |       16 |  12 |   2 |       46.9 |   30.9 |    45.5% | $1.51 |    $0.43 |     3.1 |
|   8 | claude |        6 |   4 |       20 |  16 |   2 |       76.0 |   56.0 |    49.8% | $0.72 |    $0.38 |     4.0 |
|   9 | claude |        1 |   0 |       20 |  15 |   3 |       53.3 |   33.3 |    44.6% | $1.41 |    $0.45 |     3.0 |
|  10 | claude |        3 |   2 |       22 |  17 |   3 |       65.3 |   43.4 |    46.7% | $1.72 |    $0.49 |     3.5 |
|  11 | claude |        3 |   2 |       24 |  19 |   2 |      106.0 |   82.0 |    49.0% | $0.70 |    $0.47 |     2.2 |
|  12 | claude |        4 |   0 |       24 |  18 |   2 |       98.3 |   74.3 |    42.0% | $1.12 |    $0.52 |     2.3 |
|  13 | claude |        4 |   1 |       25 |  18 |   3 |       74.8 |   49.8 |    38.1% | $1.31 |    $0.55 |     2.8 |
|  14 | claude |        4 |   1 |       26 |  19 |   2 |      109.8 |   83.8 |    37.4% | $1.22 |    $0.58 |     2.6 |
|  15 | claude |        5 |   0 |       26 |  16 |   5 |       49.9 |   23.9 |    27.8% | $1.20 |    $0.62 |     2.4 |
|  16 | claude |        1 |   0 |       26 |  16 |   4 |       56.0 |   30.0 |    27.6% | $1.29 |    $0.67 |     2.7 |
|  17 | claude |        4 |   1 |       27 |  17 |   3 |       72.3 |   45.3 |    27.7% | $1.07 |    $0.69 |     3.2 |
|  18 | claude |        2 |   0 |       27 |  16 |   4 |       57.2 |   30.2 |    25.1% | $0.73 |    $0.72 |     2.5 |
|  19 | claude |        4 |   0 |       27 |  14 |   6 |       42.5 |   15.5 |    20.2% | $0.69 |    $0.74 |     2.5 |
|  20 | claude |        4 |   1 |       28 |  15 |   4 |       54.7 |   26.7 |    20.5% | $0.93 |    $0.75 |     3.0 |
|  21 | claude |        5 |   0 |       28 |  13 |   6 |       41.4 |   13.4 |    16.4% | $0.79 |    $0.78 |     2.4 |
|  22 | claude |        3 |   0 |       28 |  12 |   7 |       37.8 |    9.8 |    14.2% | $1.00 |    $0.81 |     3.3 |

## Estimates

Chao2 over one source is a floor for what that reviewer can find: its reviews resemble each other, so it misses
the same things every time. Chapman between two sources is better while they find different kinds of defect.

| over           | estimator | occasions | distinct | est. total | unseen | next-new | overlap |
|----------------|-----------|----------:|---------:|-----------:|-------:|---------:|--------:|
| codex          | Chao2     |         1 |        3 |          – |      – |        – |       – |
| claude         | Chao2     |        21 |       25 |       30.5 |    5.5 |    10.8% |       – |
| all sources    | Chao2     |        22 |       28 |       37.8 |    9.8 |    14.2% |       – |
| codex × claude | Chapman   |         – |       28 |      103.0 |   75.0 |        – |       0 |

## Defects

Each source's column counts the occasions that found the defect.

| id  | defect                                                                                                                                                               | where                                                                                                                                            | first | codex | claude | severity |
|-----|----------------------------------------------------------------------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|------:|------:|-------:|----------|
| D1  | A dropped or rounded-away animation proposal under a controlled camera leaves the write flag set, so the next outside camera update fails to interrupt the animation | packages/core/src/canvas/SceneCanvas/useCanvasCamera.ts:64                                                                                       |     1 |     1 |      0 | medium   |
| D2  | Edge-pan bounds clamp with ancestor-scaled client dimensions in place of layout dimensions, so the world span is wrong under a CSS transform                         | packages/core/src/canvas/SceneCanvas/useEdgePan.ts:99                                                                                            |     1 |     1 |      0 | medium   |
| D3  | The finiteness guard sums pick-box fields, so a finite box near 1e308 overflows to infinity and is rejected (bounds return null)                                     | packages/core/src/canvas/SceneCanvas/useScenePickers.ts:214                                                                                      |     1 |     1 |      0 | low      |
| D4  | Departure ghosts fold an envelope parent's own pose into its children's world transform, which the scene's composition skips, so ghosts draw at the wrong place      | packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:94 (draw) and :72 (compose)                                                       |     2 |     0 |      4 | –        |
| D5  | A preset's own tool named in defaultTools bypasses the 'inserts nothing' check                                                                                       | packages/core/src/canvas/SceneCanvas/toolRegistry.ts:51-57 (resolveToolRegistry)                                                                 |     2 |     0 |     10 | –        |
| D6  | On scene swap, the selection seed uses the `initial` captured at mount rather than the current prop                                                                  | packages/core/src/canvas/SceneCanvas/useCanvasSelection.ts:53-62 (useSeed)                                                                       |     3 |     0 |     15 | –        |
| D7  | A tool's `extendClickLocked` set to `undefined` in `selectTool` erases the kit's path-edit lock                                                                      | packages/core/src/canvas/SceneCanvas/useSceneCanvasPathEdit.ts:35-40 (selectToolWithDefaults)                                                    |     3 |     0 |      2 | –        |
| D8  | The handle `addView` returns keeps drawing its id after a re-add has replaced its props                                                                              | packages/core/src/canvas/SceneCanvas/useSceneCanvasHandle.ts:18-26 (addView)                                                                     |     3 |     0 |      2 | –        |
| D9  | useViewportWithoutView warns that navigation "does nothing" when `viewport` only switches navigation off                                                             | packages/core/src/canvas/SceneCanvas/useViewportWithoutView.ts:11 (useViewportWithoutView)                                                       |     4 |     0 |      7 | –        |
| D10 | A full actions[slot] descriptor whose id differs from its slot registers under entry.id, so the resolver sees itself as stale on every registry change               | packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:113 (applyActionsProp), :85 (isStale)                                             |     5 |     0 |      4 | –        |
| D11 | routing={[]} silently turns off double-click naming, so a double-click on a grouped member names the member instead of its outermost group                           | packages/core/src/canvas/SceneCanvas/useScenePicking.ts:112 (doubleClickNames)                                                                   |     5 |     0 |      1 | –        |
| D12 | useContentBounds's cached committed box is not invalidated when the adapter (and so committedPoseOf) changes                                                         | packages/core/src/canvas/SceneCanvas/useContentBounds.ts:57 (returned callback)                                                                  |     5 |     0 |      1 | –        |
| D13 | The defaultActiveTool doc says it is ignored under any consumer `tools` prop, but only the takeover form ignores it                                                  | packages/core/src/canvas/SceneCanvas/toolProps.ts:55-59 (SceneCanvasToolProps.defaultActiveTool)                                                 |     6 |     0 |      3 | –        |
| D14 | A press routed to a view id the registry does not hold loses lod-aware and pixel picking, even though it uses the surface's camera                                   | packages/core/src/canvas/SceneCanvas/useScenePickers.ts:288-291 (askedBy) with :365-370 (askedOwnView)                                           |     6 |     0 |      1 | –        |
| D15 | Muting the marker-drag action for a given id still leaves that view's markers claiming presses                                                                       | packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:130 (useCanvasTools, markerDrag) with useSceneGestureDispatcher.ts:200 (useMarkerGate)    |     7 |     0 |      1 | –        |
| D16 | Departure ghosts of a removed scrolling container's children leave out the container's scroll offset, so they draw in the wrong place                                | packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:80 (draw, child pose)                                                             |     7 |     0 |      4 | –        |
| D17 | SceneCanvas never passes a style to its dispatcher-overlay layer, so DispatcherOverlayStyle (including roles) cannot reach the marquee/lasso/polyline paint          | packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:131 (useSceneCanvasLayers), :182                                                    |     8 |     0 |      4 | –        |
| D18 | An overlay style field passed as undefined erases the default instead of falling back to it                                                                          | packages/core/src/canvas/SceneCanvas/useDispatcherOverlayLayer.ts:85 (draw)                                                                      |     8 |     0 |      1 | –        |
| D19 | Re-registering the standard actions under the same ids leaves a configured pinch zoom buried under the kit default                                                   | packages/core/src/canvas/SceneCanvas/useSceneStandardActions.ts:150 (useSceneStandardActions → useViewportActions rev)                           |     8 |     0 |      3 | –        |
| D20 | A removed node inside a container that draws copies leaves only one departure ghost, where the preview ghost draws one per copy                                      | packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:93 (draw)                                                                         |     8 |     0 |      2 | –        |
| D21 | The actions prop's warn-once warnings repeat on every render when actions is an inline literal                                                                       | packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:39 (useActionsPropResolver)                                                       |    10 |     0 |      1 | –        |
| D22 | A selectionOverlay slot with outline.follow 'shape' and poseById puts chrome on the stroke even with boundsIncludeStroke false                                       | packages/core/src/canvas/SceneCanvas/useSelectionOverlayLayer.ts:55 (useSelectionOverlayLayer)                                                   |    10 |     0 |      1 | –        |
| D23 | defaultActiveTool under a ToolsApi takeover throws instead of being ignored                                                                                          | packages/core/src/canvas/SceneCanvas/useCanvasTools.ts:121 (useCanvasTools)                                                                      |    11 |     0 |      2 | –        |
| D24 | resolveToolRegistry repeats its patch warnings on every render                                                                                                       | packages/core/src/canvas/SceneCanvas/toolRegistry.ts:73 and :78 (resolveToolRegistry)                                                            |    11 |     0 |      1 | –        |
| D25 | actions={null} mutes the presets' own actions, though the resolver says it leaves them, and only until they re-register                                              | packages/core/src/canvas/SceneCanvas/useActionsPropResolver.ts:105 (applyActionsProp), with useSceneStandardActions.ts:150,207                   |    13 |     0 |      1 | –        |
| D26 | The preview ghost paints a node whose hidden container is still in the scene, where the departure ghost leaves that case out                                         | packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:88 (drawEntry / roots loop)                                                         |    14 |     0 |      2 | –        |
| D27 | Departure and preview ghosts paint nodes on layers that layerVisibility / layerOrder hide                                                                            | packages/core/src/canvas/SceneCanvas/useDepartureGhostLayer.ts:57 (draw), packages/core/src/canvas/SceneCanvas/usePreviewGhostLayer.ts:84 (draw) |    17 |     0 |      2 | –        |
| D28 | A custom selectionOverlay layer entry loses its before/after anchors, unlike pathEditingOverlay                                                                      | packages/core/src/canvas/SceneCanvas/useSceneCanvasLayers.ts:176 (layers memo) with useSelectionOverlayLayer.ts:53                               |    20 |     0 |      2 | –        |
