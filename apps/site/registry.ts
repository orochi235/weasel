import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import DEMO_SOURCES from 'virtual:demo-sources';
import TIMESTAMPS from 'virtual:demo-timestamps';

/** One tab in the code panel. `path` and `language` are known up front so the
 *  tab strip renders immediately; `load()` fetches that file's text on demand. */
export interface DemoSourceTab {
  /** Tab label and pane-meta path (e.g. `apps/site/demos/data/clipping.scene.json`). */
  path: string;
  /** prism-react-renderer language. */
  language: 'json' | 'tsx' | 'ts' | 'css' | 'md';
  load: () => Promise<string>;
}

/** What the nav needs. Small, eager, and the only thing a registry literal
 *  declares — the payload below hangs off `path` and `load`. */
interface DemoMeta {
  id: string;
  title: string;
  category: string;
  description: string;
  hint?: string;
  /** Path to the demo file relative to repo root, for display in the source pane. */
  path: string;
  /** Loads the demo component. Kept out of the entry bundle so choosing one
   *  demo doesn't download all of them. */
  load: () => Promise<ComponentType>;
  /** Outbound "see also" links rendered under the description — e.g. a
   *  consumer project that exercises the demonstrated component for real. */
  links?: { label: string; href: string }[];
}

export interface DemoEntry extends DemoMeta {
  Component: LazyExoticComponent<ComponentType>;
  /** The demo's own TSX first, then a tab per companion file it imports. */
  sources: DemoSourceTab[];
  /** ISO-8601 date of the first git commit adding this demo's source. */
  created?: string;
  /** ISO-8601 date of the most recent git commit touching this demo's source. */
  lastModified?: string;
}

const DEMO_META: DemoMeta[] = [
  // ─── Foundations ──────────────────────────────────────────────────────────
  {
    id: 'scene',
    title: 'Scene primitive',
    category: 'Foundations',
    description: 'useScene + SceneCanvas — a kit-owned scene graph with first-class layers, parenting, and undo/redo. Five system layers (garden / blueprint / structures / zones / plantings) demonstrate the eric-shape; two plant leaves are parented under a planter container on the structures layer. A registered consumer op (`setColor`) records onto the same undo stack as kit mutations like setPose. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z are wired via useUndoRedo.',
    hint: 'Drag rectangles to move; click "Recolor selection" then undo with Cmd+Z.',
    load: () => import('./demos/SceneDemo').then((m) => m.SceneDemo),
    path: 'apps/site/demos/SceneDemo.tsx',
  },
  {
    id: 'gestures',
    title: 'Gestures',
    category: 'Foundations',
    description: 'Every gesture *form* in `src/interactions/gestures` on one surface — pick a mode and the canvas binds to that one gesture, drawing a live overlay so the differences between the drag variants are visible, not just described. `useDragGesture` traces the pointer and reports world + client coords and phase; `useDragRect` reports normalized marquee bounds; `useDragRadial` reports angle + radius instead of x/y; `startThresholdDrag` suppresses move events until the pointer crosses a dead-zone; the same `useDragGesture` with a `thresholdReached` predicate distinguishes click from drag via `wasSubThreshold`; `useHandleDrag` reports coords local to a rect element; `useDragHandle` + `useDropZone` route a typed payload to the drop zone whose `accepts()` matches. A footer shows live modifier state.',
    hint: 'Pick a gesture above, then drag on the canvas. Watch the overlay + readout — each drag variant reports motion differently.',
    load: () => import('./demos/GesturesDemo').then((m) => m.GesturesDemo),
    path: 'apps/site/demos/GesturesDemo.tsx',
  },

  // ─── Tools ────────────────────────────────────────────────────────────────
  {
    id: 'transform',
    title: 'Transform (move · resize · rotate · clone)',
    category: 'Tools',
    description: 'The select tool\'s full transform surface on one canvas. Body-drag moves (snapping to the 20-unit grid via gridSnapStrategy); corner handles resize in each leaf\'s local frame (ROTATED_POSE_DESCRIPTOR keeps the diagonal corner pinned even on a rotated rect); the handle above a selection rotates it; Alt+drag clones (the select tool\'s default alt-drag binding → cloneAction). toolBundle="exhaustive" registers the select/rotate tools and the clone action — no palette is rendered, so select stays active throughout.',
    hint: 'Drag a body to move; drag a corner to resize; drag the top handle to rotate; Alt+drag to clone. Shift-click to multi-select.',
    load: () => import('./demos/TransformDemo').then((m) => m.TransformDemo),
    path: 'apps/site/demos/TransformDemo.tsx',
  },
  {
    id: 'move-snap',
    title: 'Move + Snap (planting)',
    category: 'Tools',
    description: 'snapToContainer + snapBackOrDelete behaviors wired via selectTool={{ move: { behaviors } }}. Drag the green token over a bin and dwell 250 ms to plant it (reparent + snap to slot). Release on empty canvas within 30 px of the start to snap back; farther than 30 px also snaps back (onFreeRelease: "snap-back").',
    hint: 'Drag the token into a bin and hold to plant it.',
    load: () => import('./demos/MoveSnapDemo').then((m) => m.MoveSnapDemo),
    path: 'apps/site/demos/MoveSnapDemo.tsx',
  },
  {
    id: 'alignment-guides',
    title: 'Alignment guides',
    category: 'Tools',
    description: 'Drag the purple rect: its edges and center snap to the other rects and the page, drawing a full-length guide line. Candidates are derived from sibling bounds via deriveAlignmentGuides + alignMoveBehavior; the matched line is published to a ref the createGuidesLayer overlay reads each frame.',
    hint: 'Drag the purple rectangle near another rect’s edge or center.',
    load: () => import('./demos/AlignmentGuidesDemo').then((m) => m.AlignmentGuidesDemo),
    path: 'apps/site/demos/AlignmentGuidesDemo.tsx',
  },
  {
    id: 'insert',
    title: 'Insert',
    category: 'Tools',
    description: 'useInsert — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
    hint: 'Drag on empty space to draw.',
    load: () => import('./demos/InsertDemo').then((m) => m.InsertDemo),
    path: 'apps/site/demos/InsertDemo.tsx',
  },
  {
    id: 'layer-list',
    title: 'Layer list',
    category: 'Tools',
    description: 'LayerList from @weasel-js/ui wired to a scene. Click rows or rects to select. Drag rows to reorder. Drag a selected row to move the whole selection.',
    hint: 'Drag the rows up and down.',
    load: () => import('./demos/LayerListDemo').then((m) => m.LayerListDemo),
    path: 'apps/site/demos/LayerListDemo.tsx',
  },
  {
    id: 'selection-panel',
    title: 'Selection properties panel',
    category: 'Tools',
    description:
      'SelectionPanel from @weasel-js/ui wired to a scene with the kit\'s pre-baked property schemas (defaultNodeProperties). Click a shape to inspect and edit its kind-specific properties; shift-click several — including different kinds — to see the schema intersection and per-field Mixed state. Edits fan out to the whole selection as one undo step.',
    hint: 'Select shapes and edit X/Y/W/H, fill, stroke. Shift-click a rect and the ellipse for Mixed state.',
    load: () => import('./demos/SelectionPanelDemo').then((m) => m.SelectionPanelDemo),
    path: 'apps/site/demos/SelectionPanelDemo.tsx',
  },
  {
    id: 'text',
    title: 'Text editing',
    category: 'Text',
    description: 'createTextLayer + useTextEdit + createSetTextOp, composed with useMove, useResize, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit at the clicked glyph (caretIndexAt resolves the click to a character offset and seeds the contenteditable caret); commits flow through createSetTextOp so they\'re undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette.',
    hint: 'Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels.',
    load: () => import('./demos/TextDemo').then((m) => m.TextDemo),
    path: 'apps/site/demos/TextDemo.tsx',
  },

  {
    id: 'text-script',
    title: 'Superscript & baseline shift',
    category: 'Text',
    description: "StyledRun.script: 'super' | 'sub' sets a run as a superscript or subscript — a raised or lowered baseline and a smaller size together, the pair <sup> and <sub> imply. It is a preset over two primitives rather than a mechanism of its own: baselineShift raises or lowers a run off the line's shared baseline in ems of the inherited font size, and fontScale multiplies that inherited size (an absolute fontSize still wins). Naming either directly overrides that half and leaves the other alone, which is what the two sliders do. resolveRuns folds all of it into one world-unit offset and a final size, so layout places a run against a baseline and an offset without knowing superscripts exist — which is why a shifted run carries its own decoration rules with it. The bottom row is the other half of the story: every run on a line now shares one baseline, sunk to clear the tallest run's ascent, so mixing sizes aligns them the way inline text aligns everywhere else. overline joins underline and strikethrough on both the node style and the run.",
    hint: "Drag the sliders and watch the rows that aren't shifted: they don't move. A shift displaces its own run and never feeds back into the line's baseline or height.",
    load: () => import('./demos/TextScriptDemo').then((m) => m.TextScriptDemo),
    path: 'apps/site/demos/TextScriptDemo.tsx',
  },

  {
    id: 'text-outlines',
    title: 'Outline tier',
    category: 'Text',
    description: 'Above a size threshold (48 on-screen px by default) text stops being sampled from a distance field and is drawn as real glyph geometry: registerFontOutlines() supplies the font bytes, the glyph outline is tessellated once in em space, and every instance is a scale-and-translate of the cached triangles into one batched draw call. Exact at any zoom, where an SDF reconstructed from a raster shows contour wobble as you magnify it — and because a glyph becomes an ordinary path, gradient and pattern fills come along for free. The tier is metric-neutral by construction: advances, kerning and line breaking still come from the SDF tier, so crossing the threshold changes what glyphs look like and never where they sit.',
    hint: 'Toggle the checkbox: the same lines fall back to the baked MSDF atlas, without moving. Zoom in and the small lines cross the threshold too — the rule is on-screen size, not document size.',
    load: () => import('./demos/TextOutlinesDemo').then((m) => m.TextOutlinesDemo),
    path: 'apps/site/demos/TextOutlinesDemo.tsx',
  },

  {
    id: 'point-snap',
    title: 'Point-snap resize',
    category: 'Tools',
    description: 'useResize with pointSnapBehaviors — drag the bottom-right corner of the rotated rectangle and watch the world-space dragged corner snap to a 20-unit grid intersection. The local-frame pose back-solves automatically.',
    hint: 'Drag the bottom-right corner.',
    load: () => import('./demos/PointSnapDemo').then((m) => m.PointSnapDemo),
    path: 'apps/site/demos/PointSnapDemo.tsx',
  },
  {
    id: 'image',
    title: 'Image (embedded)',
    category: 'Tools',
    description: 'Raster image nodes rendered by the built-in `kit:image` painter. Each node\'s `data.image.src` is an embedded `data:image/svg+xml,…` URI — the whole image is a string, so it lives on the node and round-trips through `scene.toJSON()` with no external asset or blob plumbing. The kit\'s `imageCache` decodes each `src` to an `ImageBitmap` once (keyed by the string), painting a faint placeholder until it resolves, and `<SceneCanvas>` repaints when it does. The Image tool in the palette drag-inserts another copy via the standard `insertAction` + insert dep.',
    hint: 'Pick the Image tool and drag on empty space to drop a copy; click/drag to select and move.',
    load: () => import('./demos/ImageDemo').then((m) => m.ImageDemo),
    path: 'apps/site/demos/ImageDemo.tsx',
  },
  {
    id: 'ingestion',
    title: 'Content ingestion',
    category: 'Tools',
    description: 'OS file drop, clipboard paste, and a file picker all landing through one content-handler registry. Raster images are handled by the kit\'s built-in `kit:image` handler; SVG files land through `kit:svg` as a single embedded node with the source bytes preserved (`ingestion={{ svg: { unpack: unpackSvgFiles } }}`, with the unpacker imported from `@weasel-js/svg`, would parse them into native scene nodes instead); plain text is intercepted by a consumer handler that echoes it in the readout — demonstrating the registered-handler path a real app extends with its own MIME types. The `weasel-dropover` class on the canvas provides drag-hover feedback. All three arrival paths call the same `runIngest` pipeline: each handler declares a MIME glob (`match`), and the dispatcher partitions items in priority order.',
    hint: 'Drop an image file onto the canvas; paste an image from the clipboard; or click "Insert image…" to use the file picker. Try pasting or dropping plain text too.',
    load: () => import('./demos/IngestionDemo').then((m) => m.IngestionDemo),
    path: 'apps/site/demos/IngestionDemo.tsx',
  },

  // ─── Selection & actions ──────────────────────────────────────────────────
  {
    id: 'multi-select',
    title: 'Multi-select',
    category: 'Selection & actions',
    description: 'selectionMode="multi" — shift-click to extend the selection. With more than one item selected, the overlay collapses to a single union AABB with corner handles, clicks inside the union drag the whole set, and the corner handles resize the union (each member is scaled via the same remapBounds path).',
    hint: 'Click a rect to select; shift-click another to add it; drag the body or grab a corner.',
    load: () => import('./demos/MultiSelectDemo').then((m) => m.MultiSelectDemo),
    path: 'apps/site/demos/MultiSelectDemo.tsx',
  },
  {
    id: 'lasso',
    title: 'Lasso',
    category: 'Selection & actions',
    description: 'useLassoTool — free-form polygon selection sibling to the rectangular marquee. Press L to switch from select to lasso, then drag to paint a closed polygon. The on-screen radio toggles the hit mode plumbed through `selectFromLasso({ mode })`: `centers` (rect center inside polygon — Photoshop-style snap), `intersect` (any overlap — Figma default), `enclosed` (rect fully inside — strict). Backed by `arrayAdapter`/`sceneToAdapter`\'s default `hitTestLasso`, which composes `polygonContainsRectCenter` / `polygonIntersectsRect` / `polygonContainsRect` from `@weasel-js/core`.',
    hint: 'Press L for lasso, drag to paint a polygon. Switch the radio to compare hit modes.',
    load: () => import('./demos/LassoDemo').then((m) => m.LassoDemo),
    path: 'apps/site/demos/LassoDemo.tsx',
  },
  // ─── Geometry ─────────────────────────────────────────────────────────────
  {
    id: 'path-pose',
    title: 'Path as pose',
    category: 'Geometry',
    description: 'A scene where the object\'s pose IS a Path — no rect→shape adapter step. Canvas\'s internal useResize is generalized over TPose via the optional `geometry` opt; passing `pathPoseDescriptor` lets it read bounds via boundsOfPath and remap every coord through an affine scale against the dragged AABB. Move uses the kit\'s `translatePath` as its translatePose, and snap-to-grid runs through `pathOriginProjection` so it snaps the path origin rather than every vertex. Body-drag to move; corner handles to resize.',
    hint: 'Drag the polygon body to move it; drag a corner to resize.',
    load: () => import('./demos/PathPoseDemo').then((m) => m.PathPoseDemo),
    path: 'apps/site/demos/PathPoseDemo.tsx',
  },
  {
    id: 'compound-paths',
    title: 'Compound paths',
    category: 'Geometry',
    description: 'Five non-rect shapes on one canvas, all editable end-to-end via Canvas + the `geometry={pathPoseDescriptor}` prop. Ghost (multi-contour PolygonPath with evenodd eye holes and Q-curve curls), rubber duck (composePath fuse of separate body/head/beak/eye PolygonPaths), Hamburglar silhouette (disjoint cape + hat subpaths under one pose — verifies the selection overlay draws one outer AABB around discontinuous shapes), goose (extreme aspect ratio long neck — stresses resize anchoring), octopus (eight open-polyline tentacles around a closed body subpath — exercises the open-subpath rendering path). Hit-testing uses pointInPath against the real silhouette; the adapter wires pathPoseDescriptor.intersectsRect for area-select.',
    hint: 'Click to select, drag to move, drag a corner to resize, shift-click to multi-select. Click "honk" above the goose.',
    load: () => import('./demos/CompoundPathsDemo').then((m) => m.CompoundPathsDemo),
    path: 'apps/site/demos/CompoundPathsDemo.tsx',
  },
  {
    id: 'bezier-edit',
    title: 'Bezier edit',
    category: 'Geometry',
    description: 'Control-point editing on a polygon path. Click to select (selection AABB shows), double-click the curve to enter anchor-edit mode (selection AABB hides; anchor + control-handle circles + tangent lines render), drag any anchor or control to mutate the curve, Esc to exit. v1 corner-only behavior: dragging an anchor moves only its on-curve coord — adjacent controls stay put in world space (Illustrator "Convert Anchor Point" semantics). Smoothing (Figma\'s default move-anchor-moves-controls) plugs in next iteration; insert/delete anchors and marquee-select are deferred.',
    hint: 'Click to select. Double-click to edit anchors. Drag anchors or control handles. Esc to exit edit mode.',
    load: () => import('./demos/BezierEditDemo').then((m) => m.BezierEditDemo),
    path: 'apps/site/demos/BezierEditDemo.tsx',
  },
  {
    id: 'curve-lab',
    title: 'Curve representations lab',
    category: 'Geometry',
    description: 'The same anchor set rendered as cubic Bezier, quadratic Bezier, NURBS, and Spiro (κ-curves v1) side by side. Toggle the curvature comb, inflection marks, and anchor / control chrome to see where the representations diverge. Five seeded presets; pen-tool authoring is v1.1.',
    hint: 'Switch presets to see the differences; toggle overlays for analysis.',
    load: () => import('./demos/CurveLabDemo').then((m) => m.CurveLabDemo),
    path: 'apps/site/demos/CurveLabDemo.tsx',
  },
  {
    id: 'boolean-ops',
    title: 'Boolean ops',
    category: 'Geometry',
    description: 'Five Pathfinder-style polygon-boolean operations on path geometry: union, intersect, subtract (back minus front, Illustrator "Minus Front" semantics), exclude (XOR), divide (fracture along intersections). Backed by `pathUnion` / `pathIntersect` / `pathSubtract` / `pathExclude` / `pathDivide` from the kit, which wrap a vendored `polygon-clipping` engine. The `useBooleans` hook composes these into one undoable selection action and auto-registers six `pathfinder.*` Actions with the ambient ActionsRegistry; the top "Interactive" region renders them via the kit\'s `<ActionBar group="pathfinder"/>` (from `@weasel-js/ui`), while the static rows below show each op applied to the same rect + circle inputs.',
    hint: 'In the Interactive region: click empty space to deselect, click both paths to re-enable. Click a Pathfinder button to commit the op; Reset restores the two source paths.',
    load: () => import('./demos/BooleanOpsDemo').then((m) => m.BooleanOpsDemo),
    path: 'apps/site/demos/BooleanOpsDemo.tsx',
  },
  {
    id: 'shape-tools',
    title: 'Shape tools',
    category: 'Geometry',
    description: 'Five new shape tools — ellipse, line, polygon, star, pencil — wired into a `<ToolPalette>`. Each tool produces a node via its `create` factory and commits through `ctx.applyOps + createInsertOp`. Switch tools via the palette on the left.',
    hint: 'Click a tool button. Drag in the canvas to create shapes. Pencil: freehand stroke; close-near-start to mark closed.',
    load: () => import('./demos/ShapeToolsDemo').then((m) => m.ShapeToolsDemo),
    path: 'apps/site/demos/ShapeToolsDemo.tsx',
  },
  {
    id: 'stroke-markers',
    title: 'Stroke markers',
    category: 'Geometry',
    description: 'Arrowheads and line terminators as stroke style — `markerStart` / `markerMid` / `markerEnd` on a Stroke, resolved through the marker registry. Each entry declares its own inset, so the ribbon stops at a filled head\'s base instead of spiking through its tip the way SVG does, while an open V still reaches the vertex. The bottom row is a thick translucent stroke where that inset is visible.',
    hint: 'Every head takes the line\'s own paint; no second definition per color.',
    load: () => import('./demos/StrokeMarkersDemo').then((m) => m.StrokeMarkersDemo),
    path: 'apps/site/demos/StrokeMarkersDemo.tsx',
  },

  {
    id: 'layout',
    title: 'Layout',
    category: 'Composition',
    description: 'Three containers side by side, one per layout strategy — freeform (absolute placement), tileGrid (2x2 cells), and snapPoint (corner snapping). All three share a single adapter and one useSelectTool. Dragging a child within its container exercises the in-container layout (cell swap, corner snap); dragging across containers reflows both sides via the layout-aware move pass.',
    hint: 'Drag a child rect within its container or into another to see layout-driven reflow.',
    load: () => import('./demos/LayoutDemo').then((m) => m.LayoutDemo),
    path: 'apps/site/demos/LayoutDemo.tsx',
  },

  // ─── Animation ────────────────────────────────────────────────────────────
  {
    id: 'animation',
    title: 'Animation',
    category: 'Animation',
    description: 'useAnimator + animateOnSetPose + animateLifecycle + momentum behavior. Programmatic setPose tweens (click "Tween A"/"Tween B"); inserts scale up from zero (click "Add card"); flicking a card releases with momentum decay. The grid panel below runs a second scene whose move behavior hands the release velocity to `animator.physics` in decay mode, then calls `setTarget` mid-flight so the same animation springs into the nearest cell.',
    hint: 'Click a Tween button, click Add card, drag-and-flick a card, or flick the block on the grid.',
    load: () => import('./demos/AnimationDemo').then((m) => m.AnimationDemo),
    path: 'apps/site/demos/AnimationDemo.tsx',
  },
  {
    id: 'easings',
    title: 'Easings',
    category: 'Animation',
    description: 'Every named curve in the kit\'s easing library tweening a marker side-by-side. Each row is one easing from the `EASINGS` lookup (`linear` + quad/cubic/quart/quint + sine/expo/circ + back/elastic/bounce, with In/Out/InOut variants); click "play all" to fire one `animator.tween` per row simultaneously, sharing a duration slider. The dim line below each track plots the curve shape (clamped to [0,1] so back/elastic overshoot rows still fit their lane — the marker itself still travels past the endpoints when the curve does).',
    hint: 'Click "play all" to fire every easing at once; drag the slider to change duration.',
    load: () => import('./demos/EasingsDemo').then((m) => m.EasingsDemo),
    path: 'apps/site/demos/EasingsDemo.tsx',
  },
  {
    id: 'timeline',
    title: 'Timeline',
    category: 'Animation',
    description: "A keyframe timeline is a tween with a playhead you can move. Three sampled tracks drive the scene — x, y, and a colour track whose `interpolate` is `lerpOklab`, so the square crossfades through OKLab rather than through sRGB's muddy midpoints. An event track fires labelled markers into the log on the right, and a nested `TimelineTrack` offset 500 ms runs a child timeline with its own duration. The transport is the point: `seek()` is a pure function of the playhead, so dragging the scrub slider repositions every sampled track and fires nothing — event tracks only cross edges under forward playback, at any nesting depth. \"add x keyframe\" pushes a key past the current end inside `timeline.edit()`, which recomputes the duration and drops the cached interpolators; the readout and the scrub range grow on the next frame.",
    hint: 'play/pause · drag scrub (it pauses first) and watch the event log stay still · toggle loop · time-scale · add x keyframe.',
    load: () => import('./demos/TimelineDemo').then((m) => m.TimelineDemo),
    path: 'apps/site/demos/TimelineDemo.tsx',
  },
  {
    id: 'rig',
    title: 'Rig',
    category: 'Animation',
    description: "A rig is a transform hierarchy and nothing more: six joints in topological order, each composed onto its already-resolved parent by `resolveSkeleton`. Both stick figures are the same skeleton. The green one is posed by `blendPoses([A, B], [1 - t, t])` called straight from the slider; the orange one is posed by a `SampledTrack<Pose>` whose `interpolate` is that identical call, looping on a timeline. Interpolating between two poses and blending two poses are the same operation, which is why the rig ships no timeline integration of its own — set the slider to the track's reported `u` while it plays and the two silhouettes coincide.",
    hint: 'Drag the blend slider · play track to loop the same blend from a SampledTrack<Pose> · toggle joint labels.',
    load: () => import('./demos/RigDemo').then((m) => m.RigDemo),
    path: 'apps/site/demos/RigDemo.tsx',
  },
  {
    id: 'side-scroller',
    title: 'Side-scroller',
    category: 'Animation',
    description:
      "A platformer, built as a load test rather than a showcase: it changes animation state every few frames, fires overlapping one-shots continuously, and never lets the clock idle. The player is an eleven-joint rig posed by cross-faded `SampledTrack<Pose>` clips — the run cycle plays on a real `animator.timeline` whose time scale tracks ground speed, while jump and fall are seeked by vertical velocity rather than played, so a short hop and a long drop both read correctly. Footsteps fire from an `EventTrack` on that looping timeline, which is the timeline-to-audio bridge under the heaviest load it will ever see. Every sound is synthesized into an `AudioBuffer` at load, so the demo ships no assets. The scene graph is off entirely; every visual is a custom render layer projecting through a camera held in a ref, which keeps a 60 Hz loop out of React state.",
    hint: 'Arrow keys or WASD to move, space to jump. Enable audio first — Web Audio needs a gesture. Reach the flagpole to end the run.',
    load: () => import('./demos/SideScrollerDemo').then((m) => m.SideScrollerDemo),
    path: 'apps/site/demos/SideScrollerDemo.tsx',
  },
  {
    id: 'scene-scroller',
    title: 'Side-scroller (scene graph)',
    category: 'Animation',
    description:
      "The side-scroller load test rebuilt on the scene graph, as the twin that shows the engine rather than routing around it. Every tile, coin, enemy, goal and bone is a leaf node drawn by the kit's built-in painters, and the camera *is* the canvas `view` — so the parallax bands are `createParallaxLayer` doing its own job rather than `deriveParallaxView` called by hand, and scene nodes project through the same transform for free. The static half of the world is where retained mode pays: 122 tile nodes are inserted once and never touched, and `nodeMemo` keeps a frame that leaves them alone from costing anything, where the immediate-mode twin rebuilds every visible tile's draw commands every frame. The moving half is where it charges: ~27 poses are rewritten per frame inside one `scene.batch`, which is one history entry and one notify. The camera costs nothing on top of that: it is written straight to the canvas handle with `setView`, so a 60 Hz pan is zero React renders. The player rig is the honest gap: a skeleton is a transform hierarchy and the scene tree stores absolute world coordinates with grouping-only parents, so `resolveSkeleton` is flattened onto eleven independent bone nodes every frame instead of being expressed as parenting.",
    hint: 'Arrow keys or WASD to move, space to jump, flagpole to finish. Compare the frame readout with the load-test side-scroller — and hit swarm +40 to insert forty nodes mid-run.',
    load: () => import('./demos/SceneScrollerDemo').then((m) => m.SceneScrollerDemo),
    path: 'apps/site/demos/SceneScrollerDemo.tsx',
  },
  {
    id: 'audio',
    title: 'Audio',
    category: 'Animation',
    description: "@weasel-js/audio schedules playback with a lookahead window against the AudioContext's hardware clock, not per animation frame — a frame can be late by tens of milliseconds and nobody sees it, but a late note is audible, so `play({ when })` books a start time the audio thread honours exactly. Every sound here is synthesized into an `AudioBuffer` by hand and handed to `engine.register()`, so the demo ships no binary assets. The context starts suspended, which is shown rather than hidden: nothing sounds until \"enable audio\" resumes it from a user gesture, with `engine.state()` live beside the button. Dragging the source dot calls `setPosition` on a looping voice; the gain and pan readouts are `spatialize()`, the same pure function the engine applies. The bars are `analyser().bands(16)` on master. Firing fifty one-shots against a per-bus limit of eight makes voice stealing observable in the active count.",
    hint: 'Click "enable audio" first · drag the orange dot · gain/mute/solo per bus · fire 50 one-shots and watch activeVoices hold at the limit.',
    load: () => import('./demos/AudioDemo').then((m) => m.AudioDemo),
    path: 'apps/site/demos/AudioDemo.tsx',
  },

  // ─── Viewport ─────────────────────────────────────────────────────────────
  {
    id: 'pan-zoom',
    title: 'Pan & Zoom',
    category: 'Viewport',
    description: 'Viewport navigation in one place. Pan via the hand tool (H = sticky, hold space = momentary) and the wheel-pan tool; zoom via ctrl/⌘+wheel (about the cursor) and the keyboard (⌘+= / ⌘+- / ⌘+0). Selection-overlay handles, marquee, and insert overlays live in screen space, so chrome stays a fixed pixel size under zoom. The two center rects show the scene-stroke trade-off: the green rect divides its line width by meanScale(view.scale) (screen-pinned — constant at every zoom); the purple rect uses a plain world-px stroke (grows and shrinks with zoom). Two further rects sit well outside the viewport so panning has somewhere to go.',
    hint: 'H = hand · hold space = momentary · drag to pan · ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · Reset view to return home.',
    load: () => import('./demos/PanZoomDemo').then((m) => m.PanZoomDemo),
    path: 'apps/site/demos/PanZoomDemo.tsx',
  },
  {
    id: 'per-axis-zoom',
    title: 'Per-axis zoom',
    category: 'Viewport',
    description: 'View.scale is {x, y} — the sliders drive each axis independently. The mode dropdown toggles fitViewToBounds between contain (uniform min), fill (uniform max — bounds overflow one axis), and stretch (per-axis exact fit, non-uniform scale). Wheel still zooms uniformly via useWheelZoomTool default axis: both.',
    hint: 'Drag the scale.x / scale.y sliders · pick a mode and click Fit · Reset returns home.',
    load: () => import('./demos/PerAxisZoomDemo').then((m) => m.PerAxisZoomDemo),
    path: 'apps/site/demos/PerAxisZoomDemo.tsx',
  },
  {
    id: 'viewport',
    title: 'Viewport (inertia · pinch · keyboard zoom)',
    category: 'Viewport',
    description: 'SceneCanvas viewport prop wires inertia pan, pinch zoom, and animated keyboard zoom in one place. Inertia uses a friction-decayed velocity loop after drag release; boundary clamping can stop or bounce the pan at configurable limits. A touch-screen pinch reaches the viewport.pinchZoom action through the dispatcher\'s two-finger multitouch stream; a trackpad pinch emits no touch pointers at all, so the browser sends ctrl+wheel and viewport.zoom claims that instead. animatedZoom tweens the discrete steps — ⌘+=, ⌘+-, ⌘+0 — through the kit animator, interpolating scale geometrically and holding the zoom anchor fixed; wheel and pinch keep jumping per sample, since their input already arrives every frame. Any pan or wheel zoom cancels a glide in progress.',
    hint: 'Drag fast and release to coast · ⌘+= / ⌘+- / ⌘+0 to zoom with easing · pan mid-zoom to interrupt it · pinch or ⌘+wheel to zoom · toggle boundary to see stop vs bounce.',
    load: () => import('./demos/ViewportDemo').then((m) => m.ViewportDemo),
    path: 'apps/site/demos/ViewportDemo.tsx',
  },
  {
    id: 'viewport-layer',
    title: 'Viewport layer (PiP · minimap)',
    category: 'Viewport',
    description: 'Prototype: createViewportLayer renders one or more source RenderLayers through an inner View, then translates and clips the result into a screen-space rect on the outer canvas. The same source can be lensed through any number of viewports — minimap (scaled-down overview, top-right) and PiP (zoomed-in slice, bottom-left) both reuse the same source layer here. Hit-testing into viewports is not yet wired — pointer events still target the outer view.',
    hint: 'pan/zoom the outer canvas; the minimap and PiP redraw through their own static inner views',
    load: () => import('./demos/ViewportLayerDemo').then((m) => m.ViewportLayerDemo),
    path: 'apps/site/demos/ViewportLayerDemo.tsx',
  },
  {
    id: 'minimap',
    title: 'Minimap (detached)',
    category: 'Viewport',
    description: '<MinimapCanvas> mounts its own <canvas> in a sidebar (separate DOM location, own WebGL2 context) and renders the same scene the main canvas shows, through a derived fit view. A dashed indicator tracks the main canvas\'s visible window in world coords; click to recenter the main view on that world point, drag to pan continuously. Pointer-independent from the main canvas — the browser routes events by element under the cursor. No tool/action/dispatcher participation; the minimap is one hardcoded gesture pair with a fixed effect.',
    hint: 'H = hand on main · click minimap to recenter · drag minimap to pan',
    load: () => import('./demos/MinimapDemo').then((m) => m.MinimapDemo),
    path: 'apps/site/demos/MinimapDemo.tsx',
  },
  {
    id: 'parallax',
    title: 'Parallax',
    category: 'Viewport',
    description: 'createParallaxLayer wraps source RenderLayers so each plane translates and/or scales at its own rate under the camera view. v1 is cosmetic: pointer events still target the outer view. Drag to pan and watch the four planes (sky/hills/ground/foreground) move at different speeds.',
    hint: 'drag to pan · sky lags at 0.1× · hills 0.4× · ground 1:1 · foreground leads at 1.3×',
    load: () => import('./demos/ParallaxDemo').then((m) => m.ParallaxDemo),
    path: 'apps/site/demos/ParallaxDemo.tsx',
  },
  {
    id: 'force-graph',
    title: 'Force-directed graph',
    category: 'Viewport',
    description: '`useSimulation` runs a velocity-Verlet integrator with a d3-force-compatible force protocol. The kit owns the loop; the forces come from `d3-force` directly (`forceManyBody`, `forceLink`, `forceCollide`, `forceCenter`). Drag a node to pin it (sets `fx`/`fy` and reheats with `alphaTarget(0.3).restart()`); release to free it. Sim ticks call `scene.setPose` so SceneCanvas redraws on scene mutations — no React-state churn from a custom render-driver.',
    hint: 'drag to pin · ctrl/⌘+wheel zoom · wheel pan · H drag to pan · ⌘+0 reset',
    load: () => import('./demos/ForceGraphDemo').then((m) => m.ForceGraphDemo),
    path: 'apps/site/demos/ForceGraphDemo.tsx',
  },
  {
    id: 'd3-sortable',
    title: 'd3 plugin: sortable bars',
    category: 'Viewport',
    description: '`@weasel-js/d3` proof of concept. Twelve bars bound to a data array via `d3Bind(scene, data, { key, animator }).pose(fn).data(fn).join()`. Click sort buttons to reorder the data; the join diffs against the scene and emits one batched op group, then `.transition().duration(600).ease(easeInOutCubic).delay(i × 30)` animates each bar to its new x-position with a stagger. Phase 2 of the d3 plugin (transition chain over `useAnimator`).',
    hint: 'click sort buttons · per-item delay staggers the move',
    load: () => import('./demos/D3SortableDemo').then((m) => m.D3SortableDemo),
    path: 'apps/site/demos/D3SortableDemo.tsx',
  },

  // ─── Rendering & paint ────────────────────────────────────────────────────
  {
    id: 'gradients',
    title: 'Gradients',
    category: 'Rendering & paint',
    description: 'Interactive editor for the three gradient paint variants — linear, radial, conic. Drag the on-canvas handles to set the gradient geometry (linear endpoints, radial center+radius, conic center+angle). Below the canvas, click the strip to add a stop, drag stops to reposition, click a swatch to recolor, right-click to delete. Showcases the `linear-gradient` / `radial-gradient` / `conic-gradient` FillStyle variants shipped with the WebGL backend.',
    hint: 'drag handles · click strip to add stops · drag stop to move · click swatch to recolor',
    load: () => import('./demos/GradientsDemo').then((m) => m.GradientsDemo),
    path: 'apps/site/demos/GradientsDemo.tsx',
  },
  {
    id: 'pattern-playground',
    title: 'Pattern playground',
    category: 'Rendering & paint',
    description: 'The four built-in tile patterns \u2014 hatch, crosshatch, dots, chunks \u2014 each filling a rect through the `pattern` FillStyle variant.',
    hint: 'four swatches, one per built-in tile',
    load: () => import('./demos/PatternPlaygroundDemo').then((m) => m.PatternPlaygroundDemo),
    path: 'apps/site/demos/PatternPlaygroundDemo.tsx',
  },
  {
    id: 'vertex-colors',
    title: 'Per-vertex colors',
    category: 'Rendering & paint',
    description: 'A heptagon whose fill is driven by an RGBA-per-vertex array — no FillStyle object, just colors baked onto the geometry. Drag a vertex handle to move it; double-click to recolor. Colors interpolate smoothly across the triangulated interior. Demonstrates the `vertexColors` field on `PathDrawCommand`, emitted from a custom `RenderLayer` slotted into the Canvas layers map.',
    hint: 'drag vertex to move · double-click vertex to recolor',
    load: () => import('./demos/VertexColorsDemo').then((m) => m.VertexColorsDemo),
    path: 'apps/site/demos/VertexColorsDemo.tsx',
  },
  {
    id: 'vertex-widths',
    title: 'Per-vertex stroke widths',
    category: 'Rendering & paint',
    description: 'Two panels. Top: a five-anchor polyline whose center anchor\'s stroke width is driven by a slider — the tessellator emits trapezoidal segments and force-bevels the miters once the taper ratio exceeds `varyingWidthJoinThreshold` (default 1.5×). Bottom: a `usePencilTool` with `pressureToWidth` configured — Apple Pencil / Wacom strokes get real pressure-modulated tapering, mouse strokes get a flat 0.5-pressure width (per the Pointer Events spec). Both panels are ordinary scene nodes whose `drawOne` emits `Stroke.vertexWidths`; the bottom one also demonstrates `pressureToWidth(p, opts)`.',
    hint: 'top: drag slider · bottom: draw strokes (Apple Pencil for real pressure)',
    load: () => import('./demos/VertexWidthsDemo').then((m) => m.VertexWidthsDemo),
    path: 'apps/site/demos/VertexWidthsDemo.tsx',
  },
  {
    id: 'color-matrix',
    title: 'Stacked color matrices',
    category: 'Rendering & paint',
    description: 'Three nested groups, each with its own preset color matrix (Identity / Grayscale / Sepia / Invert / Hue+90° / Brightness×1.5). The same base palette renders inside each group, so you can see the cumulative effect — inner-group leaves see all three matrices composed multiplicatively. Click a preset button under any group to swap that group\'s matrix and watch the entire subtree retint. Demonstrates `GroupDrawCommand.colorMatrix`.',
    hint: 'click presets to retint each group · matrices compose down the stack',
    load: () => import('./demos/ColorMatrixDemo').then((m) => m.ColorMatrixDemo),
    path: 'apps/site/demos/ColorMatrixDemo.tsx',
  },
  {
    id: 'custom-shader',
    title: 'Custom shaders',
    category: 'Rendering & paint',
    description: 'Three custom GLSL shader panels: plasma (animated sin/cos field that follows the cursor), ripple (click anywhere to spawn an expanding ring on a sampled image), and voronoi (drag the white seed points to reshape the cellular pattern). Each panel registers its program at module scope via `registerProgram()` and emits a `ShaderDrawCommand` over a panel-bound rect; the renderer compiles them via the new `shaders` prop on SceneCanvas. Custom shader API is `@experimental`.',
    hint: 'plasma follows cursor · click ripple panel · drag voronoi seeds',
    load: () => import('./demos/CustomShaderDemo').then((m) => m.CustomShaderDemo),
    path: 'apps/site/demos/CustomShaderDemo.tsx',
  },
  {
    id: 'render-to-pixels',
    title: 'Headless render-to-pixels',
    category: 'Rendering & paint',
    description: 'renderSceneToPixels() rasterizes a scene-space rect to raw RGBA at an explicit per-axis scale — no on-screen canvas, no ambient devicePixelRatio. The snapshot below is rendered at an anisotropic 2×1 px/unit onto a white background and blitted into a 2D canvas; the readout re-renders and byte-compares to demonstrate same-context determinism. This is the print/thumbnail/export primitive: physical units (dpi, mm) stay the caller\'s business.',
    hint: 'The top canvas is the live scene; the bottom image is the headless raster at 2×1 px/unit. The readout confirms two headless renders produced identical bytes.',
    load: () => import('./demos/RenderToPixelsDemo').then((m) => m.RenderToPixelsDemo),
    path: 'apps/site/demos/RenderToPixelsDemo.tsx',
  },

  // ─── Diagnostics ──────────────────────────────────────────────────────────
  {
    id: 'rotated-resize-math',
    title: 'Rotated resize math',
    category: 'Diagnostics',
    description: 'Math explainer for rotated resize: drag the bottom-right corner of each rect and watch the "fixed corner world" ledger. Green: full math (projection + anchor pinning + position correction) — ledger stays constant. Orange: no projection — distorts on rotation. Purple: no position correction — fixed corner drifts.',
    hint: 'Drag a corner handle to resize the rotated rect.',
    load: () => import('./demos/RotatedResizeMathDemo').then((m) => m.RotatedResizeMathDemo),
    path: 'apps/site/demos/RotatedResizeMathDemo.tsx',
  },
  {
    id: 'quadtree',
    title: 'Quadtree overlay',
    category: 'Diagnostics',
    description: 'A demo-local quadtree slotted into the Canvas layers map as a custom RenderLayer alongside weasel\'s stock layers (grid, scene, selection overlay). The tree rebuilds each frame from the committed rect AABBs and subdivides any cell that overlaps more than one rect (max depth 5). Demonstrates how to drop an analytical layer into the layer pipeline via `{ layer, after }`.',
    hint: 'Click to select, drag to move, drag a corner to resize. Watch the cyan cells subdivide live.',
    load: () => import('./demos/QuadtreeDemo').then((m) => m.QuadtreeDemo),
    path: 'apps/site/demos/QuadtreeDemo.tsx',
  },
  {
    id: 'debug-overlay',
    title: 'Debug overlay',
    category: 'Diagnostics',
    description: 'A dev-mode overlay layer that paints what the kit\'s interaction system "sees": object bounds (AABBs), pose origins, every hit-test shape, handle positions, snap candidates, and per-layer metadata. Pass a `DebugConfig` (or `true` / `"all"`) to `<Canvas debug={...}>` and the kit appends a screen-space overlay layer wired to a per-frame debug sink. Tree-shaken when `debug` is falsy/undefined; URL fallback `?debug=all` (or `?debug=bounds,handles`) reads from `location.search`. Each chip toggles a single feature so you can isolate visualization of, say, just hitboxes vs. just snap candidates.',
    hint: 'Toggle chips to layer the kit\'s view of the scene. Drag a box (snap chip lights up); drag a corner (handles + hitboxes light up).',
    load: () => import('./demos/DebugOverlayDemo').then((m) => m.DebugOverlayDemo),
    path: 'apps/site/demos/DebugOverlayDemo.tsx',
  },
  {
    id: 'tool-reflection',
    title: 'Tool reflection',
    category: 'Diagnostics',
    description: 'The three routing-reflection consumers operating on stub ToolDefs that mirror the gesture surface of useSelectTool + useHandTool. Action registry (left) flattens every routed slot — phase × gesture × target × modifier — into a single table. Conflict detector (middle) walks the same set looking for exact-tuple overlaps across tools; the stubs here register cleanly so it reports none. Canvas (right) runs the real tools so you can interact with the scene. Live ToolDebugOverlay coverage is gated on a SceneCanvas dispatcher hook — see Phase 4 follow-ups.',
    hint: 'Read the registry and conflict columns; click / drag rects to exercise the underlying tools.',
    load: () => import('./demos/ToolReflectionDemo').then((m) => m.ToolReflectionDemo),
    path: 'apps/site/demos/ToolReflectionDemo.tsx',
  },

  // ─── weasel-ui ────────────────────────────────────────────────────────────
  {
    id: 'perceptual-color-sliders',
    title: 'Perceptual color sliders',
    category: 'weasel-ui',
    description: 'Four representative slider variants from the perceptual-color experiment, all built on Slider: single-thumb hue, 2-thumb ordered L range with active-range hatching, 3-thumb chroma with per-thumb bounds, and a dynamic indices band with click-to-add, drag-off-vertical to remove, and shift-drag translate-all.',
    hint: 'Drag thumbs; on the indices band, click empty track to add, drag a thumb up/down to remove, hold Shift to translate all.',
    load: () => import('./demos/PerceptualColorSlidersDemo').then((m) => m.PerceptualColorSlidersDemo),
    path: 'apps/site/demos/PerceptualColorSlidersDemo.tsx',
  },
  {
    id: 'layered-curve',
    title: 'Layered curve editor',
    category: 'weasel-ui',
    description: 'LayeredCurveEditor composing three layers to reconstruct a beveled solid-of-revolution\'s cross-section: a goldenrod bevel layer (filled under, x ∈ [0, b]), a purple catmull-rom spline (x ∈ [b, half]), and a custom partition-handle layer at the seam. The two curves are held C0 continuous — the seam\'s y is synced between layers inside `onLayerChange`, demonstrating how cross-layer reactivity works (consumer-driven recompute; in-flight gestures see the freshest state each pointermove tick). The toolbar slider sets the bevel width b; the dark on-plot handle adjusts it live.',
    hint: 'Drag anchors on either curve (the seam stays attached); drag the dark vertical handle to slide b; click on a curve to insert; shift-click an anchor to delete.',
    links: [{
      label: 'Speech balloon lab (uses this editor) →',
      href: 'https://orochi235.github.io/experiments/speech-balloons/',
    }],
    load: () => import('./demos/LayeredCurveDemo').then((m) => m.LayeredCurveDemo),
    path: 'apps/site/demos/LayeredCurveDemo.tsx',
  },

  // ─── weasel-hud ───────────────────────────────────────────────────────────
  {
    id: 'hud',
    title: 'HUD widgets',
    category: 'weasel-hud',
    description: 'A button widget rendered by @weasel-js/hud in screen space over a WebGL canvas. useHud attaches a HUD layer to the canvas; hud.button() creates a click-counter button. Press events fire in the HUD dispatcher before the active tool sees the pointer down, so tool interactions are never disrupted by HUD clicks.',
    hint: 'Click the "Click me" button — the label updates with the click count.',
    load: () => import('./demos/HudDemo').then((m) => m.HudDemo),
    path: 'apps/site/demos/HudDemo.tsx',
  },
  {
    id: 'loupe',
    title: 'Loupe (hud window)',
    category: 'weasel-hud',
    description: 'A hud window — this one bare, so dragging the lens itself moves it; drag any edge or corner to resize. Vector mode re-renders the scene through a magnified inner view (crisp at any zoom, but the colors along antialiased edges are not the colors on screen). Pixel mode reads the framebuffer back at 1:1 device pixels with NEAREST magnification, which is the honest source for color. The content freezes while the pointer is over the window so the borders stay reachable, and a click inside the lens picks the color it is showing at that point.',
    hint: 'Move the pointer over the canvas to aim; drag the interior to move the window, an edge or corner to resize; click inside the lens to pick the color there. Switch to pixel mode to see device pixels.',
    load: () => import('./demos/LoupeDemo').then((m) => m.LoupeDemo),
    path: 'apps/site/demos/LoupeDemo.tsx',
  },

  // ─── labkit ───────────────────────────────────────────────────────────────
  {
    id: 'lab-loupe',
    title: 'Loupe (lab capability)',
    category: 'labkit',
    description:
      'The same magnifier as a labkit capability, painted two ways. `loupe: true` on an instrument that draws gets the canvas painter: the lens re-runs the instrument\'s own layers through a camera zoomed about the aimed point, so a hairline stays a hairline at any factor — switch Lens to `pixel` and it enlarges the pixels the stack presented instead. `loupe: { render }` on an instrument whose content is DOM gets the DOM painter: given a camera, the instrument draws itself again inside a circular clip. The lens takes no pointer events, so pan and the wheel keep working underneath it.',
    hint: 'Press the loupe button in the toolbar, then move over the content — or hold Alt for a peek without turning it on. The wheel resizes the magnification while the lens is up, and pans the trial when it is not.',
    load: () => import('./demos/LabLoupeDemo').then((m) => m.LabLoupeDemo),
    path: 'apps/site/demos/LabLoupeDemo.tsx',
  },
];

export const DEMOS: DemoEntry[] = DEMO_META.map((meta) => ({
  ...meta,
  Component: lazy(() => meta.load().then((C) => ({ default: C }))),
  sources: DEMO_SOURCES[meta.path] ?? [],
  ...TIMESTAMPS[meta.path],
}));

export const CATEGORIES = Array.from(new Set(DEMOS.map((d) => d.category)));

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
