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

/** Where the sidebar files a demo: a feature section, or a package's heading
 *  under Packages. Exactly one. */
type Placement =
  | { category: string; package?: never }
  | { package: string; category?: never };

/** What the nav needs. Small, eager, and the only thing a registry literal
 *  declares — the payload below hangs off `path` and `load`. */
interface DemoInfo {
  id: string;
  title: string;
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

type DemoMeta = DemoInfo & Placement;

export type DemoEntry = DemoMeta & {
  Component: LazyExoticComponent<ComponentType>;
  /** The demo's own TSX first, then a tab per companion file it imports. */
  sources: DemoSourceTab[];
  /** ISO-8601 date of the first git commit adding this demo's source. */
  created?: string;
  /** ISO-8601 date of the most recent git commit touching this demo's source. */
  lastModified?: string;
};

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
  {
    id: 'tiled-surface',
    title: 'Tiled surface',
    category: 'Foundations',
    description: 'Two independent scenes, two cameras, one WebGL context. Each `<SceneCanvas>` paints into a rect of one host-owned canvas via `paintInto` and takes pointer input from its own transparent box via `inputElement`. `WeaselRenderer.setTarget()` sets the viewport and scissor per frame, so each pane\u2019s frame clear stops at its own edge instead of erasing its neighbour. Each pane gets its own `<WeaselProvider isolate>` \u2014 a shared `<ActionsProvider>` lets only the newest canvas under it respond to input. The right pane carries a pixel-mode loupe, whose `region` is the pane\u2019s `getSurfaceRect()` so it reads back this pane\u2019s pixels and not the shared canvas\u2019s at the same offset.',
    hint: 'Drag a rectangle in either pane. The right pane is at 2\u00d7 zoom and panned, so its drags move half as far in world units. Move over the right pane to aim its loupe.',
    load: () => import('./demos/TiledSurfaceDemo').then((m) => m.TiledSurfaceDemo),
    path: 'apps/site/demos/TiledSurfaceDemo.tsx',
  },

  // ─── Tools ────────────────────────────────────────────────────────────────
  {
    id: 'transform',
    title: 'Transform (move · resize · rotate · clone)',
    category: 'Tools',
    description: 'The select tool\'s full transform surface on one canvas. Body-drag moves (snapping to the 20-unit grid via gridSnapStrategy); corner handles resize in each leaf\'s local frame (ROTATED_POSE_DESCRIPTOR keeps the diagonal corner pinned even on a rotated rect); the handle above a selection rotates it; Alt+drag clones (the move preset\'s alt-drag binding → cloneAction). features={[\'pick\', \'move\', \'transform\']} is the whole setup: pick brings the select tool, move and transform bring the drag, handle and clone bindings. No palette is rendered, so select stays active throughout.',
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
    id: 'insert',
    title: 'Insert',
    category: 'Tools',
    description: 'useInsert — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
    hint: 'Drag on empty space to draw.',
    load: () => import('./demos/InsertDemo').then((m) => m.InsertDemo),
    path: 'apps/site/demos/InsertDemo.tsx',
  },
  {
    id: 'slice',
    title: 'Slice',
    category: 'Tools',
    description: 'useSliceTool — the knife. A drag cuts along a straight line and an Alt-drag along its freehand trail. Clicks place a cut one point at a time; Enter or a double-click cuts along them, and a click on the first point closes the cut into a loop, which cuts the region it encloses out of the fill as its own piece. `<SceneCanvas>` publishes the `slice` dep the tool commits through: every path the cut crosses is swapped for its pieces in one undo step, and the pieces of a selected shape stay selected. A consumer replaces that with `useSliceDep`.',
    hint: 'Drag across a shape to cut it. Click points and press Enter, or click back on the first point to cut out a hole. Cmd/Ctrl+Z undoes a cut; V selects and drags the pieces apart, K returns to the knife.',
    load: () => import('./demos/SliceDemo').then((m) => m.SliceDemo),
    path: 'apps/site/demos/SliceDemo.tsx',
  },
  {
    id: 'text',
    title: 'Text editing',
    package: 'text',
    description: 'createTextLayer + useTextEdit + createSetTextOp, composed with useMove, useResize, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit at the clicked glyph (caretIndexAt resolves the click to a character offset and seeds the contenteditable caret); commits flow through createSetTextOp so they\'re undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette.',
    hint: 'Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels.',
    load: () => import('./demos/TextDemo').then((m) => m.TextDemo),
    path: 'apps/site/demos/TextDemo.tsx',
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
    description: 'useSelection({ mode: "multi" }) — shift-click to extend the selection. With more than one item selected, the overlay collapses to a single union AABB with corner handles, clicks inside the union drag the whole set, and the corner handles resize the union (each member is scaled via the same remapBounds path).',
    hint: 'Click a rect to select; shift-click another to add it; drag the body or grab a corner.',
    load: () => import('./demos/MultiSelectDemo').then((m) => m.MultiSelectDemo),
    path: 'apps/site/demos/MultiSelectDemo.tsx',
  },
  {
    id: 'align',
    title: 'Align & flip to the cursor',
    category: 'Selection & actions',
    description: 'The align.* actions take a `to` param and flip a `pivot` param naming what the selection lines up against: \'union\' (the selection itself), \'pointer\', a world point or rect, or a key node { node: id }. This demo binds keys through the `actions` prop: a letter aligns to the selection\'s union, the same letter with Shift aligns to wherever the cursor is, and F mirrors about the cursor.',
    hint: 'All three rects start selected. Press L, T or C to align left, top or centers; hold Shift to align to the cursor instead. Press F to flip about the cursor.',
    load: () => import('./demos/AlignDemo').then((m) => m.AlignDemo),
    path: 'apps/site/demos/AlignDemo.tsx',
  },
  {
    id: 'lasso',
    title: 'Lasso',
    category: 'Selection & actions',
    description: 'useLassoTool — free-form polygon selection sibling to the rectangular marquee. Press L to switch from select to lasso, then drag to paint a closed polygon. The on-screen radio sets `toolOptions.lasso.mode`: `centers` (shape center inside the polygon — Photoshop-style snap), `intersect` (any overlap — Figma default), `enclosed` (shape wholly inside — strict). Each mode tests the polygon against the shape\'s drawn outline, rotation included.',
    hint: 'Press L for lasso, drag to paint a polygon. Switch the radio to compare hit modes.',
    load: () => import('./demos/LassoDemo').then((m) => m.LassoDemo),
    path: 'apps/site/demos/LassoDemo.tsx',
  },
  // ─── Geometry ─────────────────────────────────────────────────────────────
  {
    id: 'path-pose',
    title: 'Path as pose',
    category: 'Geometry',
    description: 'A scene where the object\'s pose IS a Path — no rect→shape adapter step. The demo wires no `poseDescriptor`, so the canvas\'s default reads the Path pose: resize takes bounds via boundsOfPath and remaps every coord through an affine scale against the dragged AABB, and move translates the path through the same descriptor. `gridSnapStrategy(20)` snaps the path origin rather than every vertex. Body-drag to move; corner handles to resize.',
    hint: 'Drag the polygon body to move it; drag a corner to resize.',
    load: () => import('./demos/PathPoseDemo').then((m) => m.PathPoseDemo),
    path: 'apps/site/demos/PathPoseDemo.tsx',
  },
  {
    id: 'compound-paths',
    title: 'Compound paths',
    category: 'Geometry',
    description: 'Five non-rect shapes on one canvas, all editable end-to-end: the canvas\'s default pose descriptor reads Path poses, so the demo wires no geometry of its own. Ghost (multi-contour PolygonPath with evenodd eye holes and Q-curve curls), rubber duck (composePath fuse of separate body/head/beak/eye PolygonPaths), Hamburglar silhouette (disjoint cape + hat subpaths under one pose — verifies the selection overlay draws one outer AABB around discontinuous shapes), goose (extreme aspect ratio long neck — stresses resize anchoring), octopus (eight open-polyline tentacles around a closed body subpath — exercises the open-subpath rendering path). Hit-testing follows the painter\'s silhouette (the default `picking: \'shape\'`); area-select tests each path through the same descriptor.',
    hint: 'Click to select, drag to move, drag a corner to resize, shift-click to multi-select. Click "honk" above the goose.',
    load: () => import('./demos/CompoundPathsDemo').then((m) => m.CompoundPathsDemo),
    path: 'apps/site/demos/CompoundPathsDemo.tsx',
  },
  {
    id: 'path-anchor-edit',
    title: 'Path anchor editing',
    category: 'Geometry',
    description: 'Anchor editing on a canvas with no mode registry: the demo passes no `modes`, so the kit\'s standard bindings alone route every step. Double-clicking a path runs `enterPathEdit`, which draws that node\'s anchors. Dragging an anchor or a control handle runs `editAnchors` and rewrites the node\'s `data.path`. Escape runs `exitPathEdit`, after which a drag moves the shape again. The nodes use the same `{ path, fill }` data the built-in shape tools create, so the default painter draws them.',
    hint: 'Double-click a shape, then drag its anchors. Esc to finish.',
    load: () => import('./demos/PathAnchorEditDemo').then((m) => m.PathAnchorEditDemo),
    path: 'apps/site/demos/PathAnchorEditDemo.tsx',
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
    description: 'Five new shape tools — ellipse, line, polygon, star, pencil — wired into a `<ToolPalette>`. Each tool declares a drag binding to the kit\'s insert action, which mints the node. Switch tools from the palette above the canvas.',
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


  // ─── Animation ────────────────────────────────────────────────────────────
  {
    id: 'animation',
    title: 'Animation',
    category: 'Animation',
    description: 'useAnimator + animateOnSetPose + animateLifecycle + momentum behavior. Programmatic setPose tweens (click "Tween A"/"Tween B"); inserts scale up from zero (click "Add card"); flicking a card releases with momentum decay. The grid panel below runs a second scene whose move behavior hands the release velocity to `animator.physics` in decay mode, then calls `setTarget` mid-flight so the same animation springs into the nearest cell. The panel at the bottom lists `animator.live()` — each running animation\'s id, kind, label or cancel-key, and progress — beside the lifecycle events `animator.watch()` delivers.',
    hint: 'Click a Tween button, click Add card, drag-and-flick a card, or flick the block on the grid.',
    load: () => import('./demos/AnimationDemo').then((m) => m.AnimationDemo),
    path: 'apps/site/demos/AnimationDemo.tsx',
  },
  {
    id: 'vertex-color-animation',
    title: 'Vertex-color animation',
    category: 'Animation',
    description: 'Three strokes colored one RGBA per anchor, each animated by one helper. `cycleVertexColors` rotates the top stroke\'s colors along its anchors for as long as it runs; with OKLCh ticked it blends neighboring hues in a perceptual space instead of RGB. `tweenVertexColors` changes every anchor of the middle stroke at once, and `staggerVertexColors` runs the same change down the bottom stroke one anchor after another. The helpers write to `animator.colorOverrides`, and passing the animator to `<SceneCanvas>` paints those colors onto the scene\'s own path nodes, so no frame touches the scene. When a tween or stagger ends, the demo writes its final colors into the node so the stroke keeps them.',
    hint: 'Click tween or stagger, and again to go back. Pause the cycle or tick OKLCh.',
    load: () => import('./demos/VertexColorAnimationDemo').then((m) => m.VertexColorAnimationDemo),
    path: 'apps/site/demos/VertexColorAnimationDemo.tsx',
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
    description: "A rig is a transform hierarchy and nothing more: six joints in topological order, each composed onto its already-resolved parent by `resolveSkeleton`. Both stick figures are the same skeleton. The green one is posed by `blendPoses([A, B], [1 - t, t])` called straight from the slider; the orange one is posed by a `SampledTrack<Pose>` whose `interpolate` is that identical call, looping on a timeline. Interpolating between two poses and blending two poses are the same operation, which is why the rig ships no timeline integration of its own — set the slider to the track's reported `u` while it plays and the two silhouettes coincide. The green figure's arm also reaches for a target the move action drags: `solveIk` rewrites the arm's rotations inside the blended pose, so its answer is one more pose.",
    hint: 'Drag the blend slider · drag the red target for the arm to reach · play track to loop the same blend from a SampledTrack<Pose> · toggle joint labels.',
    load: () => import('./demos/RigDemo').then((m) => m.RigDemo),
    path: 'apps/site/demos/RigDemo.tsx',
  },
  {
    id: 'scene-scroller',
    title: 'Side-scroller',
    category: 'Animation',
    description:
      "A platformer built as a load test rather than a showcase: it changes animation state every few frames, fires overlapping one-shots continuously, and never lets the clock idle. Every tile, coin, enemy, goal and bone is a scene node drawn by the kit's built-in painters, and the camera *is* the canvas `view`, written straight to the canvas handle with `setView`, so a 60 Hz pan is zero React renders and each parallax band is one hill authored once, repeated by `createTiledLayer` inside `createParallaxLayer`, so no painter keeps wrap-around bookkeeping. The static half of the world is where retained mode pays: 122 tile nodes are inserted once and never touched, and `nodeMemo` keeps a frame that leaves them alone from costing anything. The moving half is ~27 poses rewritten per frame inside `scene.untracked`, which records nothing, since a simulation step is not an edit, and notifies once. The player is an eleven-joint rig posed by cross-faded `SampledTrack<Pose>` clips. Footsteps are an `EventTrack` on a looping run-cycle timeline whose time scale tracks ground speed, and each step `book`s against the audio engine's clock, so it lands at its true sub-frame time rather than on the frame that noticed it. Jumps, stomps, hits, coins and the goal fanfare are synth voices booked with `playNote`; footsteps, landings and the junk-metal music bed are noise and off-harmonic partials an oscillator cannot make, so they are synthesized into `AudioBuffer`s at load. Either way the demo ships no assets. A head knock blurs the world through a `LayerGroup` and leaves the HUD sharp. The player rig is the honest gap: `resolveSkeleton` is still flattened onto eleven independent bone nodes every frame rather than expressed as parenting, which the scene tree now supports.",
    hint: 'Arrow keys or WASD to move, space to jump. Enable audio first — Web Audio needs a gesture. Reach the flagpole to end the run, and hit swarm +40 to insert forty nodes mid-run.',
    load: () => import('./demos/SceneScrollerDemo').then((m) => m.SceneScrollerDemo),
    path: 'apps/site/demos/SceneScrollerDemo.tsx',
  },

  // ─── Viewport ─────────────────────────────────────────────────────────────
  {
    id: 'pan-zoom',
    title: 'Pan & Zoom',
    category: 'Viewport',
    description: 'Viewport navigation in one place. Pan via the hand tool (H = sticky, hold space = momentary) and the wheel-pan tool; zoom via ctrl/⌘+wheel (about the cursor) and the keyboard (⌘+= / ⌘+- / ⌘+0). The two center rects show the scene-stroke trade-off: the green rect divides its line width by meanScale(view.scale) (screen-pinned — constant at every zoom); the purple rect uses a plain world-px stroke (grows and shrinks with zoom). Two further rects sit well outside the viewport so panning has somewhere to go.',
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
    id: 'canvas-view',
    title: 'Canvas views (PiP · paint-only inset)',
    category: 'Viewport',
    description: 'A <CanvasView> is a second camera over a rect of the same canvas: one scene, one GL context, and input inside the rect routed through that camera by the kit\'s own dispatcher. The PiP (bottom-left) is interactive — a click picks what it shows, a drag moves a node in its world units, the wheel pans it alone, and the selection is shared with the canvas. The overview (top-right) is interactive={false}: it paints only, and input over it reaches the canvas beneath. Declaring the same thing through the views prop or SceneCanvasApi.addView is equivalent.',
    hint: 'click or drag a node inside the PiP · wheel over the PiP to pan it · clicks on the overview fall through to the canvas',
    load: () => import('./demos/CanvasViewDemo').then((m) => m.CanvasViewDemo),
    path: 'apps/site/demos/CanvasViewDemo.tsx',
  },
  {
    id: 'minimap',
    title: 'Minimap',
    category: 'Viewport',
    description: 'Two minimaps over one scene. The inset one is a single ambient entry, createMinimapContribution: a view in the corner of the main canvas, the press and drag that recenter the main camera, the visible-rect indicator and a linked crosshair. The detached <MinimapCanvas> beside it runs the same actions on a canvas of its own. One PointerContextProvider spans both, so each draws a crosshair where the pointer is on the other.',
    hint: 'press or drag either minimap to recenter · watch the crosshair follow the pointer',
    load: () => import('./demos/MinimapDemo').then((m) => m.MinimapDemo),
    path: 'apps/site/demos/MinimapDemo.tsx',
  },
  {
    id: 'parallax',
    title: 'Parallax',
    category: 'Viewport',
    description: 'Four planes move at their own rate under one camera. Sky and ground are paint: tiled render layers wrapped by createParallaxLayer. Hills and trees are scene nodes on layers declaring `parallax`, so SceneCanvas draws them through their plane, and picking and editing — a click, a marquee, a drag, a resize or rotate handle, and the anchors a double-click opens — land on them where they are drawn, zooming planes included. Play intro tweens every plane\'s anchor with the animator — through a ParallaxPlane for the paint, and scene.setLayerParallax inside scene.untracked for the scene layers.',
    hint: 'scroll to pan · click or marquee a hill or tree · sky 0.1× · hills 0.4× · ground 1:1 · trees 1.3×',
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

  // ─── Rendering & paint ────────────────────────────────────────────────────
  {
    id: 'stroke-and-fill',
    title: 'Stroke and fill',
    category: 'Rendering & paint',
    description: 'One scene, three shapes, one panel driven by the selection. Click the rect and its Fill swatch opens a `PaintInput` popover whose kind bar reaches solid, the three gradients (linear, radial, conic), the four built-in tile patterns and a mesh \u2014 pick a gradient or a mesh and `SceneGradientHandles` puts its geometry on the artwork. Its Stroke swatch and width slider paint the other slot. Click the heptagon for a swatch per vertex (`vertexColors`, one RGBA per anchor); click the polyline for the taper slider that drives `Stroke.vertexWidths`, force-bevelling the miters past the default 1.5\u00d7 taper ratio. Double-click any shape to drag its anchors. The pencil tool draws pressure-tapered strokes into the same scene via `pressureToWidth`.',
    hint: 'click a shape \u00b7 edit fill / stroke in the panel \u00b7 drag gradient handles \u00b7 double-click to move anchors',
    load: () => import('./demos/StrokeAndFillDemo').then((m) => m.StrokeAndFillDemo),
    path: 'apps/site/demos/StrokeAndFillDemo.tsx',
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
    description: 'Three custom GLSL shader panels: plasma (animated sin/cos field that follows the cursor), ripple (click anywhere to spawn an expanding ring on a sampled image), and voronoi (drag the white seed points to reshape the cellular pattern). Each panel registers its program at module scope via `registerProgram()` and emits a `ShaderDrawCommand` over a panel-bound rect; the renderer compiles them via the `shaders` prop on SceneCanvas. Ripple and voronoi pass each array uniform as one flat list — `u_ripples: [x, y, t, x, y, t, …]` fills `uniform vec3 u_ripples[8]` from slot 0. Custom shader API is `@experimental`.',
    hint: 'plasma follows cursor · click ripple panel · drag voronoi seeds',
    load: () => import('./demos/CustomShaderDemo').then((m) => m.CustomShaderDemo),
    path: 'apps/site/demos/CustomShaderDemo.tsx',
  },
  {
    id: 'effects',
    title: 'Full-screen effect passes',
    category: 'Rendering & paint',
    description: 'A layer\'s pixels rendered into a texture, run through shader passes, then composited back. The world layer carries `effects: [...blur({ radius }), ...vignette({ amount })]`; the HUD layer above it carries none and stays sharp — which is the difference between a real pass and a CSS `filter` on the canvas, since the filter blurs the HUD too. Effects live on `GroupDrawCommand`, so the same field works on a container node or the whole tree; `RenderLayer.effects` is that field folded into the group a layer is already wrapped in. Nothing is allocated until a group declares one. Write your own with `registerEffect(id, frag)`.',
    hint: 'drag the radius to 0 and back · the HUD never blurs',
    load: () => import('./demos/EffectsDemo').then((m) => m.EffectsDemo),
    path: 'apps/site/demos/EffectsDemo.tsx',
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
    description: 'A dev-mode overlay layer that paints what the kit\'s interaction system "sees": object bounds (AABBs), pose origins, every hit-test shape, handle positions, snap candidates, per-layer metadata, the last pan or zoom, and a frame panel with paint cost and draw calls per layer. `renderDebugSnapshot` rasterizes the scene and the overlay into one image for a bug report. Pass a `DebugConfig` (or `true` / `"all"`) to `<Canvas debug={...}>` and the kit appends a screen-space overlay layer wired to a per-frame debug sink. Tree-shaken when `debug` is falsy/undefined; URL fallback `?debug=all` (or `?debug=bounds,handles`) reads from `location.search`. Each chip toggles a single feature so you can isolate visualization of, say, just hitboxes vs. just snap candidates.',
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

  // ─── Packages ─────────────────────────────────────────────────────────────
  {
    id: 'perceptual-color-sliders',
    title: 'Perceptual color sliders',
    package: 'ui',
    description: 'Four representative slider variants from the perceptual-color experiment, all built on Slider: single-thumb hue, 2-thumb ordered L range with active-range hatching, 3-thumb chroma with per-thumb bounds, and a dynamic indices band with click-to-add, drag-off-vertical to remove, and shift-drag translate-all.',
    hint: 'Drag thumbs; on the indices band, click empty track to add, drag a thumb up/down to remove, hold Shift to translate all.',
    load: () => import('./demos/PerceptualColorSlidersDemo').then((m) => m.PerceptualColorSlidersDemo),
    path: 'apps/site/demos/PerceptualColorSlidersDemo.tsx',
  },
  {
    id: 'layered-curve',
    title: 'Layered curve editor',
    package: 'ui',
    description: 'LayeredCurveEditor composing three layers to reconstruct a beveled solid-of-revolution\'s cross-section: a goldenrod bevel layer (filled under, x ∈ [0, b]), a purple catmull-rom spline (x ∈ [b, half]), and a custom partition-handle layer at the seam. The two curves are held C0 continuous — the seam\'s y is synced between layers inside `onLayerChange`, demonstrating how cross-layer reactivity works (consumer-driven recompute; in-flight gestures see the freshest state each pointermove tick). The toolbar slider sets the bevel width b; the dark on-plot handle adjusts it live.',
    hint: 'Drag anchors on either curve (the seam stays attached); drag the dark vertical handle to slide b; click on a curve to insert; shift-click an anchor to delete.',
    links: [{
      label: 'Speech balloon lab (uses this editor) →',
      href: 'https://orochi235.github.io/experiments/speech-balloons/',
    }],
    load: () => import('./demos/LayeredCurveDemo').then((m) => m.LayeredCurveDemo),
    path: 'apps/site/demos/LayeredCurveDemo.tsx',
  },
  {
    id: 'layer-list',
    title: 'Layer list',
    package: 'ui',
    description: 'LayerList from @weasel-js/ui wired to a scene. Click rows or rects to select. Drag rows to reorder. Drag a selected row to move the whole selection.',
    hint: 'Drag the rows up and down.',
    load: () => import('./demos/LayerListDemo').then((m) => m.LayerListDemo),
    path: 'apps/site/demos/LayerListDemo.tsx',
  },
  {
    id: 'selection-panel',
    title: 'Selection properties panel',
    package: 'ui',
    description:
      'SelectionPanel from @weasel-js/ui wired to a scene with the kit\'s pre-baked property schemas (defaultNodeProperties). Click a shape to inspect and edit its kind-specific properties; shift-click several — including different kinds — to see the schema intersection and per-field Mixed state. Edits fan out to the whole selection as one undo step.',
    hint: 'Select shapes and edit X/Y/W/H, fill, stroke. Shift-click a rect and the ellipse for Mixed state.',
    load: () => import('./demos/SelectionPanelDemo').then((m) => m.SelectionPanelDemo),
    path: 'apps/site/demos/SelectionPanelDemo.tsx',
  },
  {
    id: 'quantity',
    title: 'Quantities',
    package: 'quantity',
    description: "`@weasel-js/quantity`: one number shown through every built-in display. The field at the top is a `UnitField` holding the value; each row shows `qty(value, display)` for its own display — the text, the spoken form a screen reader gets as `aria-valuetext`, and the html with each `data-part` span outlined, plus MathML where the kind has one. `fraction({ form: 'diagonal' })` writes the fraction diagonally in the text itself, so it stays diagonal on a canvas that never sees CSS, `fraction({ of: 'π' })` counts in a named constant (`3π/4`, spoken `3 pi over 4`), and `unit('\"')` shows inches with the mark. The second table is measured, not declared: each kind runs over a few sample values and reports whether it rounds to whole numbers, keeps a sign, reads the current value back exactly, writes anything beyond digits, speaks differently from how it reads, and has MathML. Below, a `BandEditor` whose band edges are tagged `fraction()` quantities: the JSON under it shows each edge keep its tag through drags, splits and merges.",
    hint: 'Type a value into the field at the top, or pick a preset; every row follows. Drag a seam and watch the JSON stay tagged.',
    load: () => import('./demos/QuantityDemo').then((m) => m.QuantityDemo),
    path: 'apps/site/demos/QuantityDemo.tsx',
  },
  {
    id: 'text-script',
    title: 'Superscript & baseline shift',
    package: 'text',
    description: "StyledRun.script: 'super' | 'sub' sets a run as a superscript or subscript — a raised or lowered baseline and a smaller size together, the pair <sup> and <sub> imply. It is a preset over two primitives rather than a mechanism of its own: baselineShift raises or lowers a run off the line's shared baseline in ems of the inherited font size, and fontScale multiplies that inherited size (an absolute fontSize still wins). Naming either directly overrides that half and leaves the other alone, which is what the two sliders do. resolveRuns folds all of it into one world-unit offset and a final size, so layout places a run against a baseline and an offset without knowing superscripts exist — which is why a shifted run carries its own decoration rules with it. The bottom row is the other half of the story: every run on a line now shares one baseline, sunk to clear the tallest run's ascent, so mixing sizes aligns them the way inline text aligns everywhere else. overline joins underline and strikethrough on both the node style and the run.",
    hint: "Drag the sliders and watch the rows that aren't shifted: they don't move. A shift displaces its own run and never feeds back into the line's baseline or height.",
    load: () => import('./demos/TextScriptDemo').then((m) => m.TextScriptDemo),
    path: 'apps/site/demos/TextScriptDemo.tsx',
  },
  {
    id: 'small-caps',
    title: 'Small caps',
    package: 'text',
    description: "`fontVariantCaps: 'small-caps'` on a `StyledRun` or a node's `TextStyle` draws lowercase letters as capitals at a smaller size, synthesized rather than read from a font's `smcp` feature. The size is the face's x-height over its cap height, from its `OS/2` table, so a small capital stands as tall as the lowercase it replaces; a face that states neither height gets 70%. Small caps reads the text after `textTransform`, as CSS does: `capitalize` raises each first letter to a full capital and small caps sets the rest. The text is never rewritten — carets, selection and the edit overlay all address what was typed, and the overlay sets its capitals at the canvas's size, not the browser's own.",
    hint: 'Double-click a line to edit it: the overlay shows the same capitals, and commits the letters you typed.',
    load: () => import('./demos/SmallCapsDemo').then((m) => m.SmallCapsDemo),
    path: 'apps/site/demos/SmallCapsDemo.tsx',
  },
  {
    id: 'text-nodes',
    title: 'Text nodes',
    package: 'text',
    description: "A node whose data carries `text` needs no layer and no `drawOne`: the kit's built-in `kit:text` painter draws it, reading the same node data every other text path reads — `style` for size, weight and slant, `runs` over `text` when both are present, `fill` for ink, and the pose's width and height as the box `align` and `verticalAlign` resolve within. Rotation comes from the pose like any other node's. This is the path a scene gets by default, and the one editing commits back into: double-click a node to edit it in place. No node declares `style.wrap`, so a line typed past its box stays one line on the canvas and in the editor alike.",
    hint: 'One node per painter feature. Double-click to edit.',
    load: () => import('./demos/TextNodesDemo').then((m) => m.TextNodesDemo),
    path: 'apps/site/demos/TextNodesDemo.tsx',
  },
  {
    id: 'text-outlines',
    title: 'Outline tier',
    package: 'font',
    description: 'Above a size threshold (48 on-screen px by default) text stops being sampled from a distance field and is drawn as real glyph geometry: registerFontOutlines() supplies the font bytes, the glyph outline is tessellated once in em space, and every instance is a scale-and-translate of the cached triangles into one batched draw call. Exact at any zoom, where an SDF reconstructed from a raster shows contour wobble as you magnify it — and because a glyph becomes an ordinary path, gradient and pattern fills come along for free. The tier is metric-neutral by construction: advances, kerning and line breaking still come from the SDF tier, so crossing the threshold changes what glyphs look like and never where they sit.',
    hint: 'Toggle the checkbox: the same lines fall back to the baked MSDF atlas, without moving. Zoom in and the small lines cross the threshold too — the rule is on-screen size, not document size.',
    load: () => import('./demos/TextOutlinesDemo').then((m) => m.TextOutlinesDemo),
    path: 'apps/site/demos/TextOutlinesDemo.tsx',
  },
  {
    id: 'font-fallback',
    title: 'Font fallback',
    package: 'font',
    description: "Every text run asks for a family, and resolveFontVariant decides where its glyphs come from. A family registered with registerFont draws from its baked MSDF atlas. A family enrolled with registerCanvasFont is rasterized by the browser at runtime and turned into a distance field, so any installed font works at some cost in sharpness. A family that was never registered goes to the fallback policy: 'substitute' draws it in the default family and reports the swap on ResolveResult.substituted, 'canvas' rasterizes the real typeface as if it had been enrolled, and 'none' draws nothing. The policy is process-wide and only decides for families with no registration of their own, which is why the top two lines never change.",
    hint: 'Switch the policy and watch the bottom line: Inter under substitute, Courier New under canvas, blank under none. The table reads resolveFontVariant for each line.',
    load: () => import('./demos/FontFallbackDemo').then((m) => m.FontFallbackDemo),
    path: 'apps/site/demos/FontFallbackDemo.tsx',
  },
  {
    id: 'audio',
    title: 'Audio',
    package: 'audio',
    description: "@weasel-js/audio schedules playback with a lookahead window against the AudioContext's hardware clock, not per animation frame — a frame can be late by tens of milliseconds and nobody sees it, but a late note is audible, so `play({ when })` books a start time the audio thread honours exactly. Every sound here is synthesized into an `AudioBuffer` by hand and handed to `engine.register()`, so the demo ships no binary assets. The context starts suspended, which is shown rather than hidden: nothing sounds until \"enable audio\" resumes it from a user gesture, with `engine.state()` live beside the button. Dragging the source dot calls `setPosition` on a looping voice; the gain and pan readouts are `spatialize()`, the same pure function the engine applies. The bars are `analyser().bands(16)` on master. Firing fifty one-shots against a per-bus limit of eight makes voice stealing observable in the active count. The pattern row is `createPatternPlayer`: sixteen steps of `playNote` synth voices — harmonic partials under an ADSR envelope — booked a step at a time through the same lookahead scheduler, so a tempo change lands on the next step. The music inserts row toggles a filter, a feedback delay and a convolution reverb in the `music` bus's insert chain; each toggle is `bypass()`, a crossfade of that slot rather than a rewire, so it never clicks.",
    hint: 'Click "enable audio" first · drag the orange dot · gain/mute/solo per bus · fire 50 one-shots and watch activeVoices hold at the limit · play the pattern and toggle the music inserts.',
    load: () => import('./demos/AudioDemo').then((m) => m.AudioDemo),
    path: 'apps/site/demos/AudioDemo.tsx',
  },
  {
    id: 'd3-sortable',
    title: 'd3 plugin: sortable bars',
    package: 'd3',
    description: '`@weasel-js/d3` proof of concept. Twelve bars bound to a data array via `d3Bind(scene, data, { key, animator }).pose(fn).data(fn).join()`. Click sort buttons to reorder the data; the join diffs against the scene and emits one batched op group, then `.transition().duration(600).ease(easeInOutCubic).delay(i × 30)` animates each bar to its new x-position with a stagger. Phase 2 of the d3 plugin (transition chain over `useAnimator`).',
    hint: 'click sort buttons · per-item delay staggers the move',
    load: () => import('./demos/D3SortableDemo').then((m) => m.D3SortableDemo),
    path: 'apps/site/demos/D3SortableDemo.tsx',
  },
  {
    id: 'diagram-nodes',
    title: 'Diagram node bodies',
    package: 'diagram',
    description: "Any scene node becomes a diagram participant by carrying the DiagramNode trait — nothing has to be authored through @weasel-js/diagram to take part. These four came from the optional body builder, which is what a node uses when it should read as a flowchart box: buildBody measures the rows, grows the authored pose to clear them, and returns the container carrying the trait plus one ordinary text node per row, so the kit's own text painter draws them and editing and styling work unchanged. The outline vocabulary is stadium, diamond, rect and parallelogram, painted by registerDiagramShape. The 'scale' box carries a port row, whose ports anchor to the row's own edges rather than to the node's perimeter — the visual-programming shape, where an operator's inputs line up with the rows they feed. Orange squares are the ports, cast from the node's bounds onto the outline so an edge meets the shape rather than its bounding box; they are declared as affordances rather than merely painted, so the kit's region walk gives them their cursor and their hit-test.",
    hint: 'Drag a box to move it, or drag one orange port onto another to author an edge between them — the dashed line follows your pointer and snaps when a port is in reach.',
    load: () => import('./demos/DiagramNodesDemo').then((m) => m.DiagramNodesDemo),
    path: 'apps/site/demos/DiagramNodesDemo.tsx',
  },
  {
    id: 'diagram-edges',
    title: 'Diagram edges and routers',
    package: 'diagram',
    description: "An edge is an ordinary leaf scene node, not something the plugin paints: dependsOn names the two participants it joins and derivePath runs a router over them, so the path recomputes whenever either end moves and nothing has to keep a parallel graph in sync. Making it a scene node is what buys selection, hit-testing, styling, z-order, SVG export, undo and copy/paste without implementing any of them. The three shipped routers are one per row here — straight goes there directly, orthogonal leaves along each port's normal and turns once, and bezier leaves and arrives along them so the edge reads as plugged into its port rather than aimed at it. An end that names no port resolves to whichever one faces the other end. An edge label is a node too: it depends on the edge and derives its pose from the route the edge derived, so it never routes anything itself — the three here sit at 'start', 'mid' and 'end'.",
    hint: 'Drag either box in a row. The path re-routes as you go, the labels ride along it, and the end an edge attaches to changes when the other box crosses to the far side.',
    load: () => import('./demos/DiagramEdgesDemo').then((m) => m.DiagramEdgesDemo),
    path: 'apps/site/demos/DiagramEdgesDemo.tsx',
  },
  {
    id: 'diagram-layout',
    title: 'Diagram layout',
    package: 'diagram',
    description: "layered ranks a pipeline by longest path, tree centers a parent over its children's block, and force relaxes a graph that has no direction to read it in. Each is a plain function of the graph — no scene, no ops — that returns the new top-left for only the nodes that move, so pressing the same button twice writes nothing the second time and pushes no undo entry. Three rules keep a re-layout from scrambling an arrangement someone made: no RNG anywhere, order within a rank seeded from where the boxes already sit rather than from crossing-minimization, and a node marked pinned that nothing moves. The whole rearrangement is one scene.batch, so it undoes in one step.",
    hint: 'Press a button, then press the same one again — nothing moves, and Cmd+Z takes the whole rearrangement back in one step. Drag two boxes past each other first and the layout keeps the order you put them in.',
    load: () => import('./demos/DiagramLayoutDemo').then((m) => m.DiagramLayoutDemo),
    path: 'apps/site/demos/DiagramLayoutDemo.tsx',
  },
  {
    id: 'diagram-live',
    title: 'Live diagram layout',
    package: 'diagram',
    description: "The same relaxation the Force button runs, a tick a frame instead of all at once. Each frame goes to the scene's ephemeral override channel — the one a drag already publishes to — so the edges follow the boxes as they move and the document is untouched until the run settles, at which point the whole arrangement lands as one undo entry. Dragging a box mid-run needs no gesture from the plugin: the move tool publishes an override, and a node carrying an override the run did not put there is a pin, held with fx/fy while its neighbors relax around it. The loop runs behind useVisibleRaf, so a tab nobody is looking at stops relaxing and picks up where it left off.",
    hint: 'Press Relax, then grab a box and drag it while the graph is still moving — the rest answers, and lets go when you do. Cmd+Z takes the whole settled arrangement back in one step.',
    load: () => import('./demos/DiagramLiveDemo').then((m) => m.DiagramLiveDemo),
    path: 'apps/site/demos/DiagramLiveDemo.tsx',
  },
  {
    id: 'hud',
    title: 'HUD widgets',
    package: 'hud',
    description: 'A button widget rendered by @weasel-js/hud in screen space over a WebGL canvas. useHud attaches a HUD layer to the canvas; hud.button() creates a click-counter button. Press events fire in the HUD dispatcher before the active tool sees the pointer down, so tool interactions are never disrupted by HUD clicks.',
    hint: 'Click the "Click me" button — the label updates with the click count. Tab moves focus between the buttons; Enter or Space presses.',
    load: () => import('./demos/HudDemo').then((m) => m.HudDemo),
    path: 'apps/site/demos/HudDemo.tsx',
  },
  {
    id: 'hud-gallery',
    title: 'HUD widget gallery',
    package: 'hud',
    description: "Every widget @weasel-js/hud ships, side by side, each created with the HUD's own factory and captioned with the options it shows. rect is a solid fill — the backdrop behind each cell is one too. text takes its own size and color; label is text with the HUD's defaults, 13px in the theme's foreground and font. image draws an ImageBitmap stretched to its bounds: the same 5×5 sprite with nearest and linear sampling, a sub-rectangle of it picked out with source, and a mirrored copy. The button's press handler calls setFlip on that copy, and the HUD redraws on its own.",
    hint: 'Press "Flip the F" — the linear-sampled sprite mirrors back and forth.',
    load: () => import('./demos/HudGalleryDemo').then((m) => m.HudGalleryDemo),
    path: 'apps/site/demos/HudGalleryDemo.tsx',
  },
  {
    id: 'loupe',
    title: 'Loupe (hud window)',
    package: 'hud',
    description: 'A hud window — this one bare, so dragging the lens itself moves it; drag any edge or corner to resize. Vector mode re-renders the scene through a magnified inner view (crisp at any zoom, but the colors along antialiased edges are not the colors on screen). Pixel mode reads the framebuffer back at 1:1 device pixels with NEAREST magnification, which is the honest source for color. The content freezes while the pointer is over the window so the borders stay reachable, and a click inside the lens picks the color it is showing at that point. Tick "edit through the lens" and the lens takes input as a view on the canvas: a press inside it selects the block it magnifies, and a drag moves it at the lens\u2019s scale, so eight screen pixels at 8× move it one world unit. The window then grows a dotted grip strip across its top to be moved by.',
    hint: 'Move the pointer over the canvas to aim; drag the interior to move the window, an edge or corner to resize; click inside the lens to pick the color there. Switch to pixel mode to see device pixels. Tick "edit through the lens", aim at a block, then drag it inside the lens; the grip strip along the top still moves the window.',
    load: () => import('./demos/LoupeDemo').then((m) => m.LoupeDemo),
    path: 'apps/site/demos/LoupeDemo.tsx',
  },
  {
    id: 'annotation-capture',
    title: 'Annotation capture',
    package: 'labkit',
    description:
      "Draw on a lab's picture, then export the picture with the marks on it. The instrument hands over its own SVG as the base, so the marks serialize beside it into one document — vector all the way through, and rasterized once at the end. The toolbar's Export panel is labkit's caller; the buttons under the pane are the lab's own, calling `annotations.capture()` and doing what they like with the Blob.",
    hint: 'Pick a tool from the palette, draw over the quadrants, then Capture. Change the hue and the mark goes dashed — its stored position no longer describes the picture.',
    load: () => import('./demos/AnnotationCaptureDemo').then((m) => m.AnnotationCaptureDemo),
    path: 'apps/site/demos/AnnotationCaptureDemo.tsx',
  },
  {
    id: 'lab-loupe',
    title: 'Loupe (labkit)',
    package: 'labkit',
    description:
      'The same magnifier as labkit\'s `<TrialLoupe>`, from `@weasel-js/labkit/loupe`, painted three ways. Mounted in a drawing instrument\'s `render`, inside its canvas stack, it gets the canvas painter: the lens re-runs the stack\'s own layers through a camera zoomed about the aimed point, so a hairline stays a hairline at any factor — switch Lens to `pixel` and it enlarges the pixels the stack presented instead. Wrapped around DOM content with a `render` of its own, it gets the DOM painter: given a camera, the content draws itself again inside a circular clip. Given a `source`, it enlarges the pixels of any canvas — the Foreign WebGL trial is a WebGL view labkit did not create, drawn without `preserveDrawingBuffer`, which hands the lens a `createCanvasSource(gl)` and calls its `capture()` after each frame, because that canvas is blank to anyone reading it later. Mounting one is what gives the trial its Loupe toggle. The lens takes no pointer events, so pan and the wheel keep working underneath it.',
    hint: 'Press the loupe button in the toolbar, then move over the content — or hold Alt for a peek without turning it on. The wheel resizes the magnification while the lens is up, and pans the trial when it is not.',
    load: () => import('./demos/LabLoupeDemo').then((m) => m.LabLoupeDemo),
    path: 'apps/site/demos/LabLoupeDemo.tsx',
  },
  {
    id: 'auto-controls',
    title: 'Auto controls',
    package: 'labkit',
    description:
      'A control the reader is not pinning. `Columns` and `Gap` declare `.auto(fn)`, so while they are unpinned the instrument reads what their resolver computed from `Width` — drag Width and both follow, and the ghosted sliders draw the numbers they resolved to rather than the values underneath. Pin one and it stops following, at whatever it was showing. `Caption` resolves from `Columns`, which is usually auto itself — resolution is demand-driven, so the count resolves first and the caption names what was actually drawn rather than a number that was true when someone typed it. `Width` and `Tint` are `.manual()` — one is what the others divide by and the other goes straight into a fill, so neither has anything sensible to do with `undefined` and neither offers the state at all.',
    hint: 'Drag Width: Columns and Gap track it, and the caption renames itself to match. Shift-click a row — or click the dot beside its label — to pin or unpin it; the handle stays where it was. Width and Tint have no dot.',
    load: () => import('./demos/AutoControlsDemo').then((m) => m.AutoControlsDemo),
    path: 'apps/site/demos/AutoControlsDemo.tsx',
  },
  {
    id: 'bidi',
    title: 'Bidirectional text',
    package: 'bidi',
    description: "Runs the Unicode Bidirectional Algorithm over one line of mixed Latin, Hebrew, Arabic, digits and brackets. The top row lists each character in logical order with its bidi class and embedding level. The row below is the visual order that `reorder` produces, and outlined characters are ones `mirror` swapped because they sit in a right-to-left run. The last line prints the result with the browser's own bidi switched off, directly under the browser's rendering of the same text, so the two can be compared.",
    hint: 'Pick a preset or type your own mixed-direction text, then switch the paragraph direction between auto, ltr and rtl.',
    load: () => import('./demos/BidiDemo').then((m) => m.BidiDemo),
    path: 'apps/site/demos/BidiDemo.tsx',
  },
  {
    id: 'cursor',
    title: 'Tool cursors',
    package: 'cursor',
    description: "Every built-in tool cursor glyph as a tile. Hovering a tile sets its baked CSS cursor, and the red dot marks the hotspot, the point that actually clicks. The size slider declares the selected glyph as a canvas tool's cursor. Browsers silently drop cursor images larger than 128px, so past that size the package switches from a CSS `url()` cursor to one the canvas paints under the pointer, and the tool declaring it does not change.",
    hint: 'Hover the tiles, pick one, then drag the size slider past 128px and move over the canvas.',
    load: () => import('./demos/CursorDemo').then((m) => m.CursorDemo),
    path: 'apps/site/demos/CursorDemo.tsx',
  },
  {
    id: 'history',
    title: 'Undo history',
    package: 'history',
    description: "The undo engine on its own, with no scene graph and no canvas: a row of colored chips whose every change is an invertible op, and the undo and redo stacks listed beside them. Dragging the hue slider fires an op on every input event, and because those ops share a coalesce key they merge into one undo entry, which counts the pushes it holds. Releasing the slider seals that entry, so the next drag gets an entry of its own. An edit session is a `Journal`: it keeps its own undo history while it is open, then either lands in the main history as a single entry or is thrown away.",
    hint: 'Add, remove and recolor chips, then undo; begin an edit session, make several changes, and commit or discard it.',
    load: () => import('./demos/HistoryDemo').then((m) => m.HistoryDemo),
    path: 'apps/site/demos/HistoryDemo.tsx',
  },
  {
    id: 'geom',
    title: 'Curve geometry',
    package: 'geom',
    description: "A cubic Bézier and what the geometry kernel computes about it: the loose box around its control points next to the tight box around the curve itself, the curve's length, the curve split at a parameter t into a cubic of its own (with its control points) and how much of the length it holds, and the nearest point on the curve to a probe, with its t. The points are ordinary scene nodes moved by the kit's own move tool, and the overlay reads their positions while you drag, so every figure updates live. The kernel is plain functions over numbers, with no scene or renderer types, which is why the same calls serve hit-testing, bounds and layout everywhere else in weasel.",
    hint: 'Drag the black endpoints, the hollow control points or the red probe, and slide t to see that equal steps in t are not equal steps along the curve.',
    load: () => import('./demos/GeomDemo').then((m) => m.GeomDemo),
    path: 'apps/site/demos/GeomDemo.tsx',
  },
  {
    id: 'curve-lab',
    title: 'Curve representations lab',
    package: 'geom',
    description: 'The same anchor set rendered as cubic Bezier, quadratic Bezier, NURBS, and Spiro (κ-curves v1) side by side. Toggle the curvature comb, inflection marks, and anchor / control chrome to see where the representations diverge. Five seeded presets; pen-tool authoring is v1.1.',
    hint: 'Switch presets to see the differences; toggle overlays for analysis.',
    load: () => import('./demos/CurveLabDemo').then((m) => m.CurveLabDemo),
    path: 'apps/site/demos/CurveLabDemo.tsx',
  },
  {
    id: 'easings',
    title: 'Easings',
    package: 'geom',
    description: 'Every named curve in the kit\'s easing library tweening a marker side-by-side. Each row is one easing from the `EASINGS` lookup (`linear` + quad/cubic/quart/quint + sine/expo/circ + back/elastic/bounce, with In/Out/InOut variants); click "play all" to fire one `animator.tween` per row simultaneously, sharing a duration slider. The dim line below each track plots the curve shape (clamped to [0,1] so back/elastic overshoot rows still fit their lane — the marker itself still travels past the endpoints when the curve does).',
    hint: 'Click "play all" to fire every easing at once; drag the slider to change duration.',
    load: () => import('./demos/EasingsDemo').then((m) => m.EasingsDemo),
    path: 'apps/site/demos/EasingsDemo.tsx',
  },
  {
    id: 'alignment-guides',
    title: 'Alignment guides',
    package: 'guides',
    description: 'Drag the purple rect: its edges and center snap to the other rects and the page, drawing a segment from the aligned rects to it. Drag it level with the green and yellow rects and it also snaps to their gap, marking each equal gap with its size. With the rect tool, the corner being drawn snaps to alignment lines too. Candidates are derived from sibling bounds via deriveAlignmentGuides; alignMoveBehavior shapes the move (getSpacingTargets turns on the equal-gap snap) and alignInsertBehavior the insert, and both publish what matched to refs the createGuidesLayer overlay reads each frame.',
    hint: 'Drag the purple rectangle near another rect’s edge or center, or pick the rect tool and draw one beside them.',
    load: () => import('./demos/AlignmentGuidesDemo').then((m) => m.AlignmentGuidesDemo),
    path: 'apps/site/demos/AlignmentGuidesDemo.tsx',
  },
  {
    id: 'point-snap',
    title: 'Point-snap resize',
    package: 'guides',
    description: 'useResize with pointSnapBehaviors — drag the bottom-right corner of the rotated rectangle and watch the world-space dragged corner snap to a 20-unit grid intersection. The local-frame pose back-solves automatically.',
    hint: 'Drag the bottom-right corner.',
    load: () => import('./demos/PointSnapDemo').then((m) => m.PointSnapDemo),
    path: 'apps/site/demos/PointSnapDemo.tsx',
  },
  {
    id: 'layout',
    title: 'Layout',
    package: 'guides',
    description: 'Three containers side by side, one per layout strategy — freeform (absolute placement), tileGrid (2x2 cells), and snapPoint (corner snapping). All three share a single adapter and one useSelectTool. Dragging a child within its container exercises the in-container layout (cell swap, corner snap); dragging across containers reflows both sides via the layout-aware move pass, and a child dropped outside every container leaves its own for the top level. Each container declares its layout on its scene node, so the scene keeps it arranged after any change to its children — "add tile" drops a new child into the grid and the scene places it in the nearest free cell, in the same undo step. With "animate reflow" on, `useAnimatedReflow` glides the displaced siblings to their slots through the animator, for a drag and for the scene\'s own reflows alike.',
    hint: 'Drag a child rect within its container or into another to see layout-driven reflow.',
    load: () => import('./demos/LayoutDemo').then((m) => m.LayoutDemo),
    path: 'apps/site/demos/LayoutDemo.tsx',
  },
  {
    id: 'svg',
    title: 'SVG round trip',
    package: 'svg',
    description: "Editable SVG source on the left. `parseSvg` reads it, `svgNodesToKitDrafts` turns it into ordinary scene nodes, and the kit's built-in path, text and image painters draw them on the canvas. The select tool moves and resizes those nodes, and the text below is `serializeSvg` over whatever the scene holds now, so every edit shows up as changed coordinates in the output. `serializeSvg` is synchronous, so the export first awaits `warmSvg`, which loads a paint kind kept out of the bundle until used, like the mesh preset's. Warnings from both directions are listed instead of thrown.",
    hint: 'Pick a preset or edit the source, then drag or resize shapes on the canvas and watch the exported SVG below change.',
    load: () => import('./demos/SvgDemo').then((m) => m.SvgDemo),
    path: 'apps/site/demos/SvgDemo.tsx',
  },
  {
    id: 'paint',
    title: 'Paint as data',
    package: 'paint',
    description: "In `@weasel-js/paint` a fill or a stroke is a plain object: solid colors, linear, radial and conic gradients, tile patterns, dashes, caps and joins. There is no renderer, class or handle behind any of it. Each swatch's paint goes through `JSON.stringify` and back before its canvas draws it, so the text beside each swatch is exactly what the renderer consumed. The colors and the dash array come from the package's own helpers (`oklchDegToHex`, `contrastLineColor`, `dashForStrokeStyle`).",
    hint: 'Read each JSON block against the swatch beside it: that object is the whole paint.',
    load: () => import('./demos/PaintDemo').then((m) => m.PaintDemo),
    path: 'apps/site/demos/PaintDemo.tsx',
  },
  {
    id: 'loupe-model',
    title: 'Loupe model',
    package: 'loupe',
    description: "The magnifier's model on its own: where the loupe is aimed, how far it magnifies, and what color is under the aim. The mosaic and the lens are one plain SVG. The whole painter is a `LoupeSurface` that knows each cell's color, plus an SVG `viewBox` set from `loupeInnerView`. The Loupe (hud window) and Loupe (lab capability) demos are painters over this same model, for a WebGL canvas and a lab.",
    hint: 'Move over the mosaic to aim, scroll to change the magnification, and click inside the lens to pick a color.',
    load: () => import('./demos/LoupeModelDemo').then((m) => m.LoupeModelDemo),
    path: 'apps/site/demos/LoupeModelDemo.tsx',
  },
  {
    id: 'gesture-grammar',
    title: 'Route grammar and matcher',
    package: 'gestures',
    description: "The gestures package on its own: the route grammar the dispatcher's bindings are written in, and the pure matcher that decides whether an input fits a binding. The top half parses a route like `[initial] click => empty +shift` into its phase, gesture, arg, target and modifier slots, prints it back in canonical form and reads it out in plain English. The bottom half is a plain div with no canvas and no scene. It turns your clicks, drags, wheel and keys into the package's normalized input events and runs `matchSpec` against the route you typed, converted with `routeToSpec`, then a list of example specs, showing each one's `specificity`. The package has no DOM and no React on purpose, so turning browser events into its input events is the consumer's job, and this demo does that itself.",
    hint: 'Edit the route or pick a preset. Then click, drag, right-click, scroll or type on the pad (Shift, Alt and Cmd/Ctrl count), and drag while you scroll or press Escape to see phase-gated specs match.',
    load: () => import('./demos/GestureGrammarDemo').then((m) => m.GestureGrammarDemo),
    path: 'apps/site/demos/GestureGrammarDemo.tsx',
  },
  {
    id: 'modes',
    title: 'App modes',
    package: 'modes',
    description: "Three modes defined by the app (Draw, Focus and Review) share one canvas, and one mode registry holds which of them is active. Each mode lists the capability tags it allows. The canvas and the tool palette check each tool against that list, so a tool the mode doesn't allow greys out and stops responding. Focus uses the package's scoping dim to fade the other shapes and make them ignore the pointer, and each mode has its own workspace tint and decoration painter. Buttons, number keys and Escape all go through the registry, so every one of these effects comes from the active mode rather than from a hand-written switch.",
    hint: 'Select a shape and press 2 to focus on it, press 3 to review sizes with every editing tool disabled, and Escape to go back to Draw.',
    load: () => import('./demos/ModesDemo').then((m) => m.ModesDemo),
    path: 'apps/site/demos/ModesDemo.tsx',
  },
  {
    id: 'routing',
    title: 'Dispatcher without a scene',
    package: 'routing',
    description: "The gesture dispatcher with no scene and no canvas. Seven actions and one hand tool are declared as plain data and fed input from a small SVG surface. For each input the table lists every binding that matched, in the order the dispatcher ranks them: tier first (hotkey, then active tool, then always-on), then how narrowly the binding targets. Each row also shows what happened to that binding: it fired, it was outranked, its eligibility rule failed, or its `enabled()` check said no. The dispatcher is driven directly (`createDispatcher`, `handleInput`, `resolveAll`) so the precedence rules show without `SceneCanvas` in between.",
    hint: 'Click and drag the boxes, press Escape or Delete, then turn on Hand tool or Locked mode (or hold Space) and repeat the same input to see a different binding win.',
    load: () => import('./demos/RoutingDemo').then((m) => m.RoutingDemo),
    path: 'apps/site/demos/RoutingDemo.tsx',
  },
  {
    id: 'kernel3d',
    title: 'Boxes in 3D',
    package: 'kernel3d',
    description: "Three boxes in 3D on an ordinary `SceneCanvas` whose scene holds 3D poses. The kernel draws nothing, so the demo's renderer is one layer that projects each box's corners through the orbit camera and paints the faces far to near. Everything else is the kit's own: the select tool picks through the kernel's ray-cast `nodeAtPoint`, and the selection outline and marquee read the kernel's `poseDescriptor`, which reports each box as the screen rectangle it covers. The orbit tool and the wheel dolly are the kernel's own tool and actions, driving a `camera3d` dep.",
    hint: 'Click a box to select it, or drag on empty space to marquee. Switch to Orbit and drag to turn the camera, then scroll to dolly; the outline follows the box.',
    load: () => import('./demos/Kernel3dDemo').then((m) => m.Kernel3dDemo),
    path: 'apps/site/demos/Kernel3dDemo.tsx',
  },
];

export const DEMOS: DemoEntry[] = DEMO_META.map((meta) => ({
  ...meta,
  Component: lazy(() => meta.load().then((C) => ({ default: C }))),
  sources: DEMO_SOURCES[meta.path] ?? [],
  ...TIMESTAMPS[meta.path],
}));

export const CATEGORIES = Array.from(new Set(DEMOS.flatMap((d) => (d.category ? [d.category] : []))));

/** Package names (unscoped) that have at least one demo, sorted by name. */
export const PACKAGES = Array.from(new Set(DEMOS.flatMap((d) => (d.package ? [d.package] : [])))).sort();

/** The heading a demo is filed under. */
export function placeOf(d: DemoMeta): string {
  return d.category ?? d.package;
}

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
