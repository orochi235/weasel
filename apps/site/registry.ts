import type { ComponentType } from 'react';
import { TransformDemo } from './demos/TransformDemo';
import { MoveSnapDemo } from './demos/MoveSnapDemo';
import { AlignmentGuidesDemo } from './demos/AlignmentGuidesDemo';
import { RotatedResizeMathDemo } from './demos/RotatedResizeMathDemo';
import { MultiSelectDemo } from './demos/MultiSelectDemo';
import { InsertDemo } from './demos/InsertDemo';
import { TextDemo } from './demos/TextDemo';
import { QuadtreeDemo } from './demos/QuadtreeDemo';
import { PathPoseDemo } from './demos/PathPoseDemo';
import { CompoundPathsDemo } from './demos/CompoundPathsDemo';
import { BezierEditDemo } from './demos/BezierEditDemo';
import { CurveLabDemo } from './demos/CurveLabDemo';
import { BooleanOpsDemo } from './demos/BooleanOpsDemo';
import { SceneDemo } from './demos/SceneDemo';
import { PanZoomDemo } from './demos/PanZoomDemo';
import { PerAxisZoomDemo } from './demos/PerAxisZoomDemo';
import { AnimationDemo } from './demos/AnimationDemo';
import { LayoutDemo } from './demos/LayoutDemo';
import { DebugOverlayDemo } from './demos/DebugOverlayDemo';
import { EasingsDemo } from './demos/EasingsDemo';
import { ViewportDemo } from './demos/ViewportDemo';
import { ViewportLayerDemo } from './demos/ViewportLayerDemo';
import { MinimapDemo } from './demos/MinimapDemo';
import { ParallaxDemo } from './demos/ParallaxDemo';
import { ForceGraphDemo } from './demos/ForceGraphDemo';
import { D3SortableDemo } from './demos/D3SortableDemo';
import { PerceptualColorSlidersDemo } from './demos/PerceptualColorSlidersDemo';
import { LayeredCurveDemo } from './demos/LayeredCurveDemo';
import { GradientPlaygroundDemo } from './demos/GradientPlaygroundDemo';
import { VertexColorsDemo } from './demos/VertexColorsDemo';
import { VertexWidthsDemo } from './demos/VertexWidthsDemo';
import { ColorMatrixDemo } from './demos/ColorMatrixDemo';
import { CustomShaderDemo } from './demos/CustomShaderDemo';
import { LassoDemo } from './demos/LassoDemo';
import { HudDemo } from './demos/HudDemo';
import { LayerListDemo } from './demos/LayerListDemo';
import { SelectionPanelDemo } from './demos/SelectionPanelDemo';
import { GesturesDemo } from './demos/GesturesDemo';
import { RenderToPixelsDemo } from './demos/RenderToPixelsDemo';

import TransformDemoFull from './demos/TransformDemo.tsx?raw';
import MoveSnapDemoFull from './demos/MoveSnapDemo.tsx?raw';
import AlignmentGuidesDemoFull from './demos/AlignmentGuidesDemo.tsx?raw';
import RotatedResizeMathDemoFull from './demos/RotatedResizeMathDemo.tsx?raw';
import MultiSelectDemoFull from './demos/MultiSelectDemo.tsx?raw';
import InsertDemoFull from './demos/InsertDemo.tsx?raw';
import TextDemoFull from './demos/TextDemo.tsx?raw';
import QuadtreeDemoFull from './demos/QuadtreeDemo.tsx?raw';
import PathPoseDemoFull from './demos/PathPoseDemo.tsx?raw';
import CompoundPathsDemoFull from './demos/CompoundPathsDemo.tsx?raw';
import BezierEditDemoFull from './demos/BezierEditDemo.tsx?raw';
import CurveLabDemoFull from './demos/CurveLabDemo.tsx?raw';
import BooleanOpsDemoFull from './demos/BooleanOpsDemo.tsx?raw';
import SceneDemoFull from './demos/SceneDemo.tsx?raw';
import PanZoomDemoFull from './demos/PanZoomDemo.tsx?raw';
import PerAxisZoomDemoFull from './demos/PerAxisZoomDemo.tsx?raw';
import AnimationDemoFull from './demos/AnimationDemo.tsx?raw';
import LayoutDemoFull from './demos/LayoutDemo.tsx?raw';
import DebugOverlayDemoFull from './demos/DebugOverlayDemo.tsx?raw';
import EasingsDemoFull from './demos/EasingsDemo.tsx?raw';
import ViewportDemoFull from './demos/ViewportDemo.tsx?raw';
import ViewportLayerDemoFull from './demos/ViewportLayerDemo.tsx?raw';
import MinimapDemoFull from './demos/MinimapDemo.tsx?raw';
import ParallaxDemoFull from './demos/ParallaxDemo.tsx?raw';
import ForceGraphDemoFull from './demos/ForceGraphDemo.tsx?raw';
import D3SortableDemoFull from './demos/D3SortableDemo.tsx?raw';
import PerceptualColorSlidersDemoFull from './demos/PerceptualColorSlidersDemo.tsx?raw';
import LayeredCurveDemoFull from './demos/LayeredCurveDemo.tsx?raw';
import GradientPlaygroundDemoFull from './demos/GradientPlaygroundDemo.tsx?raw';
import VertexColorsDemoFull from './demos/VertexColorsDemo.tsx?raw';
import VertexWidthsDemoFull from './demos/VertexWidthsDemo.tsx?raw';
import ColorMatrixDemoFull from './demos/ColorMatrixDemo.tsx?raw';
import CustomShaderDemoFull from './demos/CustomShaderDemo.tsx?raw';
import LassoDemoFull from './demos/LassoDemo.tsx?raw';
import HudDemoFull from './demos/HudDemo.tsx?raw';
import LayerListDemoFull from './demos/LayerListDemo.tsx?raw';
import SelectionPanelDemoFull from './demos/SelectionPanelDemo.tsx?raw';
import GesturesDemoFull from './demos/GesturesDemo.tsx?raw';
import RenderToPixelsDemoFull from './demos/RenderToPixelsDemo.tsx?raw';
import { PointSnapDemo } from './demos/PointSnapDemo';
import PointSnapDemoFull from './demos/PointSnapDemo.tsx?raw';
import { ShapeToolsDemo } from './demos/ShapeToolsDemo';
import ShapeToolsDemoFull from './demos/ShapeToolsDemo.tsx?raw';
import { ImageDemo } from './demos/ImageDemo';
import ImageDemoFull from './demos/ImageDemo.tsx?raw';
import { IngestionDemo } from './demos/IngestionDemo';
import IngestionDemoFull from './demos/IngestionDemo.tsx?raw';
import { ToolReflectionDemo } from './demos/ToolReflectionDemo';
import ToolReflectionDemoFull from './demos/ToolReflectionDemo.tsx?raw';
import ToolReflectionDemoCss from './demos/ToolReflectionDemo.module.css?raw';

// Scene-data JSON for demos that load via `sceneFromJSON`. Surfaced alongside
// the TSX in the source pane so consumers can see the format.
import SceneSceneJson from './demos/data/scene.scene.json?raw';
import LayoutSceneJson from './demos/data/layout.scene.json?raw';

/** Extra source pane entry: typically a companion file (scene JSON, fixture)
 *  that the demo loads alongside its TSX. Surfaced as a tab in the code panel. */
export interface DemoExtra {
  /** Tab label and pane-meta path (e.g. `apps/site/demos/data/clipping.scene.json`). */
  path: string;
  /** Raw file contents. */
  code: string;
  /** prism-react-renderer language. */
  language: 'json' | 'tsx' | 'ts' | 'css' | 'md';
}

export interface DemoEntry {
  id: string;
  title: string;
  category: string;
  description: string;
  hint?: string;
  Component: ComponentType;
  /** Full source of the demo file as it ships in this repo. */
  full: string;
  /** Path to the demo file relative to repo root, for display in the source pane. */
  path: string;
  /** Additional source files (e.g. scene JSON) shown as extra tabs. */
  extras?: DemoExtra[];
  /** Outbound "see also" links rendered under the description — e.g. a
   *  consumer project that exercises the demonstrated component for real. */
  links?: { label: string; href: string }[];
  /** ISO-8601 date of the first git commit adding this demo's source.
   *  Auto-populated by `virtual:demo-timestamps` — leave unset in the
   *  registry literal. */
  created?: string;
  /** ISO-8601 date of the most recent git commit touching this demo's
   *  source. Auto-populated by `virtual:demo-timestamps` — leave unset
   *  in the registry literal. */
  lastModified?: string;
}

export const DEMOS: DemoEntry[] = [
  // ─── Foundations ──────────────────────────────────────────────────────────
  {
    id: 'scene',
    title: 'Scene primitive',
    category: 'Foundations',
    description: 'useScene + SceneCanvas — a kit-owned scene graph with first-class layers, parenting, and undo/redo. Five system layers (garden / blueprint / structures / zones / plantings) demonstrate the eric-shape; two plant leaves are parented under a planter container on the structures layer. A registered consumer op (`setColor`) records onto the same undo stack as kit mutations like setPose. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z are wired via useUndoRedo.',
    hint: 'Drag rectangles to move; click "Recolor selection" then undo with Cmd+Z.',
    Component: SceneDemo,
    full: SceneDemoFull,
    path: 'apps/site/demos/SceneDemo.tsx',
    extras: [{ path: 'apps/site/demos/data/scene.scene.json', code: SceneSceneJson, language: 'json' }],
  },
  {
    id: 'gestures',
    title: 'Gestures',
    category: 'Foundations',
    description: 'Every gesture *form* in `src/interactions/gestures` on one surface — pick a mode and the canvas binds to that one gesture, drawing a live overlay so the differences between the drag variants are visible, not just described. `useDragGesture` traces the pointer and reports world + client coords and phase; `useDragRect` reports normalized marquee bounds; `useDragRadial` reports angle + radius instead of x/y; `startThresholdDrag` suppresses move events until the pointer crosses a dead-zone; the same `useDragGesture` with a `thresholdReached` predicate distinguishes click from drag via `wasSubThreshold`; `useHandleDrag` reports coords local to a rect element; `useDragHandle` + `useDropZone` route a typed payload to the drop zone whose `accepts()` matches. A footer shows live modifier state.',
    hint: 'Pick a gesture above, then drag on the canvas. Watch the overlay + readout — each drag variant reports motion differently.',
    Component: GesturesDemo,
    full: GesturesDemoFull,
    path: 'apps/site/demos/GesturesDemo.tsx',
  },

  // ─── Tools ────────────────────────────────────────────────────────────────
  {
    id: 'transform',
    title: 'Transform (move · resize · rotate · clone)',
    category: 'Tools',
    description: 'The select tool\'s full transform surface on one canvas. Body-drag moves (snapping to the 20-unit grid via gridSnapStrategy); corner handles resize in each leaf\'s local frame (ROTATED_POSE_DESCRIPTOR keeps the diagonal corner pinned even on a rotated rect); the handle above a selection rotates it; Alt+drag clones (the select tool\'s default alt-drag binding → cloneAction). toolBundle="exhaustive" registers the select/rotate tools and the clone action — no palette is rendered, so select stays active throughout.',
    hint: 'Drag a body to move; drag a corner to resize; drag the top handle to rotate; Alt+drag to clone. Shift-click to multi-select.',
    Component: TransformDemo,
    full: TransformDemoFull,
    path: 'apps/site/demos/TransformDemo.tsx',
  },
  {
    id: 'move-snap',
    title: 'Move + Snap (planting)',
    category: 'Tools',
    description: 'snapToContainer + snapBackOrDelete behaviors wired via selectTool={{ move: { behaviors } }}. Drag the green token over a bin and dwell 250 ms to plant it (reparent + snap to slot). Release on empty canvas within 30 px of the start to snap back; farther than 30 px also snaps back (onFreeRelease: "snap-back").',
    hint: 'Drag the token into a bin and hold to plant it.',
    Component: MoveSnapDemo,
    full: MoveSnapDemoFull,
    path: 'apps/site/demos/MoveSnapDemo.tsx',
  },
  {
    id: 'alignment-guides',
    title: 'Alignment guides',
    category: 'Tools',
    description: 'Drag the purple rect: its edges and center snap to the other rects and the page, drawing a full-length guide line. Candidates are derived from sibling bounds via deriveAlignmentGuides + alignMoveBehavior; the matched line is published to a ref the createGuidesLayer overlay reads each frame.',
    hint: 'Drag the purple rectangle near another rect’s edge or center.',
    Component: AlignmentGuidesDemo,
    full: AlignmentGuidesDemoFull,
    path: 'apps/site/demos/AlignmentGuidesDemo.tsx',
  },
  {
    id: 'insert',
    title: 'Insert',
    category: 'Tools',
    description: 'useInsert — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
    hint: 'Drag on empty space to draw.',
    Component: InsertDemo,
    full: InsertDemoFull,
    path: 'apps/site/demos/InsertDemo.tsx',
  },
  {
    id: 'layer-list',
    title: 'Layer list',
    category: 'Tools',
    description: 'LayerList from @weasel-js/ui wired to a scene. Click rows or rects to select. Drag rows to reorder. Drag a selected row to move the whole selection.',
    hint: 'Drag the rows up and down.',
    Component: LayerListDemo,
    full: LayerListDemoFull,
    path: 'apps/site/demos/LayerListDemo.tsx',
  },
  {
    id: 'selection-panel',
    title: 'Selection properties panel',
    category: 'Tools',
    description:
      'SelectionPanel from @weasel-js/ui wired to a scene with the kit\'s pre-baked property schemas (defaultNodeProperties). Click a shape to inspect and edit its kind-specific properties; shift-click several — including different kinds — to see the schema intersection and per-field Mixed state. Edits fan out to the whole selection as one undo step.',
    hint: 'Select shapes and edit X/Y/W/H, fill, stroke. Shift-click a rect and the ellipse for Mixed state.',
    Component: SelectionPanelDemo,
    full: SelectionPanelDemoFull,
    path: 'apps/site/demos/SelectionPanelDemo.tsx',
  },
  {
    id: 'text',
    title: 'Text',
    category: 'Tools',
    description: 'createTextLayer + useTextEdit + createSetTextOp, composed with useMove, useResize, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit at the clicked glyph (caretIndexAt resolves the click to a character offset and seeds the contenteditable caret); commits flow through createSetTextOp so they\'re undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette.',
    hint: 'Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels.',
    Component: TextDemo,
    full: TextDemoFull,
    path: 'apps/site/demos/TextDemo.tsx',
  },

  {
    id: 'point-snap',
    title: 'Point-snap resize',
    category: 'Tools',
    description: 'useResize with pointSnapBehaviors — drag the bottom-right corner of the rotated rectangle and watch the world-space dragged corner snap to a 20-unit grid intersection. The local-frame pose back-solves automatically.',
    hint: 'Drag the bottom-right corner.',
    Component: PointSnapDemo,
    full: PointSnapDemoFull,
    path: 'apps/site/demos/PointSnapDemo.tsx',
  },
  {
    id: 'image',
    title: 'Image (embedded)',
    category: 'Tools',
    description: 'Raster image nodes rendered by the built-in `kit:image` painter. Each node\'s `data.image.src` is an embedded `data:image/svg+xml,…` URI — the whole image is a string, so it lives on the node and round-trips through `scene.toJSON()` with no external asset or blob plumbing. The kit\'s `imageCache` decodes each `src` to an `ImageBitmap` once (keyed by the string), painting a faint placeholder until it resolves, and `<SceneCanvas>` repaints when it does. The Image tool in the palette drag-inserts another copy via the standard `insertAction` + insert dep.',
    hint: 'Pick the Image tool and drag on empty space to drop a copy; click/drag to select and move.',
    Component: ImageDemo,
    full: ImageDemoFull,
    path: 'apps/site/demos/ImageDemo.tsx',
  },
  {
    id: 'ingestion',
    title: 'Content ingestion',
    category: 'Tools',
    description: 'OS file drop, clipboard paste, and a file picker all landing through one content-handler registry. Raster images are handled by the kit\'s built-in `kit:image` handler; SVG files land through `kit:svg` as a single embedded node with the source bytes preserved (`ingestion={{ svg: { unpack: true } }}` would parse them into native scene nodes instead); plain text is intercepted by a consumer handler that echoes it in the readout — demonstrating the registered-handler path a real app extends with its own MIME types. The `weasel-dropover` class on the canvas provides drag-hover feedback. All three arrival paths call the same `runIngest` pipeline: each handler declares a MIME glob (`match`), and the dispatcher partitions items in priority order.',
    hint: 'Drop an image file onto the canvas; paste an image from the clipboard; or click "Insert image…" to use the file picker. Try pasting or dropping plain text too.',
    Component: IngestionDemo,
    full: IngestionDemoFull,
    path: 'apps/site/demos/IngestionDemo.tsx',
  },

  // ─── Selection & actions ──────────────────────────────────────────────────
  {
    id: 'multi-select',
    title: 'Multi-select',
    category: 'Selection & actions',
    description: 'selectionMode="multi" — shift-click to extend the selection. With more than one item selected, the overlay collapses to a single union AABB with corner handles, clicks inside the union drag the whole set, and the corner handles resize the union (each member is scaled via the same remapBounds path).',
    hint: 'Click a rect to select; shift-click another to add it; drag the body or grab a corner.',
    Component: MultiSelectDemo,
    full: MultiSelectDemoFull,
    path: 'apps/site/demos/MultiSelectDemo.tsx',
  },
  {
    id: 'lasso',
    title: 'Lasso',
    category: 'Selection & actions',
    description: 'useLassoTool — free-form polygon selection sibling to the rectangular marquee. Press L to switch from select to lasso, then drag to paint a closed polygon. The on-screen radio toggles the hit mode plumbed through `selectFromLasso({ mode })`: `centers` (rect center inside polygon — Photoshop-style snap), `intersect` (any overlap — Figma default), `enclosed` (rect fully inside — strict). Backed by `arrayAdapter`/`sceneToAdapter`\'s default `hitTestLasso`, which composes `polygonContainsRectCenter` / `polygonIntersectsRect` / `polygonContainsRect` from `@weasel-js/core`.',
    hint: 'Press L for lasso, drag to paint a polygon. Switch the radio to compare hit modes.',
    Component: LassoDemo,
    full: LassoDemoFull,
    path: 'apps/site/demos/LassoDemo.tsx',
  },
  // ─── Geometry ─────────────────────────────────────────────────────────────
  {
    id: 'path-pose',
    title: 'Path as pose',
    category: 'Geometry',
    description: 'A scene where the object\'s pose IS a Path — no rect→shape adapter step. Canvas\'s internal useResize is generalized over TPose via the optional `geometry` opt; passing `pathPoseDescriptor` lets it read bounds via boundsOfPath and remap every coord through an affine scale against the dragged AABB. Move uses the kit\'s `translatePath` as its translatePose, and snap-to-grid runs through `pathOriginProjection` so it snaps the path origin rather than every vertex. Body-drag to move; corner handles to resize.',
    hint: 'Drag the polygon body to move it; drag a corner to resize.',
    Component: PathPoseDemo,
    full: PathPoseDemoFull,
    path: 'apps/site/demos/PathPoseDemo.tsx',
  },
  {
    id: 'compound-paths',
    title: 'Compound paths',
    category: 'Geometry',
    description: 'Five non-rect shapes on one canvas, all editable end-to-end via Canvas + the `geometry={pathPoseDescriptor}` prop. Ghost (multi-contour PolygonPath with evenodd eye holes and Q-curve curls), rubber duck (composePath fuse of separate body/head/beak/eye PolygonPaths), Hamburglar silhouette (disjoint cape + hat subpaths under one pose — verifies the selection overlay draws one outer AABB around discontinuous shapes), goose (extreme aspect ratio long neck — stresses resize anchoring), octopus (eight open-polyline tentacles around a closed body subpath — exercises the open-subpath rendering path). Hit-testing uses pointInPath against the real silhouette; the adapter wires pathPoseDescriptor.intersectsRect for area-select.',
    hint: 'Click to select, drag to move, drag a corner to resize, shift-click to multi-select. Click "honk" above the goose.',
    Component: CompoundPathsDemo,
    full: CompoundPathsDemoFull,
    path: 'apps/site/demos/CompoundPathsDemo.tsx',
  },
  {
    id: 'bezier-edit',
    title: 'Bezier edit',
    category: 'Geometry',
    description: 'Control-point editing on a polygon path. Click to select (selection AABB shows), double-click the curve to enter anchor-edit mode (selection AABB hides; anchor + control-handle circles + tangent lines render), drag any anchor or control to mutate the curve, Esc to exit. v1 corner-only behavior: dragging an anchor moves only its on-curve coord — adjacent controls stay put in world space (Illustrator "Convert Anchor Point" semantics). Smoothing (Figma\'s default move-anchor-moves-controls) plugs in next iteration; insert/delete anchors and marquee-select are deferred.',
    hint: 'Click to select. Double-click to edit anchors. Drag anchors or control handles. Esc to exit edit mode.',
    Component: BezierEditDemo,
    full: BezierEditDemoFull,
    path: 'apps/site/demos/BezierEditDemo.tsx',
  },
  {
    id: 'curve-lab',
    title: 'Curve representations lab',
    category: 'Geometry',
    description: 'The same anchor set rendered as cubic Bezier, quadratic Bezier, NURBS, and Spiro (κ-curves v1) side by side. Toggle the curvature comb, inflection marks, and anchor / control chrome to see where the representations diverge. Five seeded presets; pen-tool authoring is v1.1.',
    hint: 'Switch presets to see the differences; toggle overlays for analysis.',
    Component: CurveLabDemo,
    full: CurveLabDemoFull,
    path: 'apps/site/demos/CurveLabDemo.tsx',
  },
  {
    id: 'boolean-ops',
    title: 'Boolean ops',
    category: 'Geometry',
    description: 'Five Pathfinder-style polygon-boolean operations on path geometry: union, intersect, subtract (back minus front, Illustrator "Minus Front" semantics), exclude (XOR), divide (fracture along intersections). Backed by `pathUnion` / `pathIntersect` / `pathSubtract` / `pathExclude` / `pathDivide` from the kit, which wrap a vendored `polygon-clipping` engine. The `useBooleans` hook composes these into one undoable selection action and auto-registers six `pathfinder.*` Actions with the ambient ActionsRegistry; the top "Interactive" region renders them via the kit\'s `<ActionBar group="pathfinder"/>` (from `@weasel-js/ui`), while the static rows below show each op applied to the same rect + circle inputs.',
    hint: 'In the Interactive region: click empty space to deselect, click both paths to re-enable. Click a Pathfinder button to commit the op; Reset restores the two source paths.',
    Component: BooleanOpsDemo,
    full: BooleanOpsDemoFull,
    path: 'apps/site/demos/BooleanOpsDemo.tsx',
  },
  {
    id: 'shape-tools',
    title: 'Shape tools',
    category: 'Geometry',
    description: 'Five new shape tools — ellipse, line, polygon, star, pencil — wired into a `<ToolPalette>`. Each tool produces a node via its `create` factory and commits through `ctx.applyOps + createInsertOp`. Switch tools via the palette on the left.',
    hint: 'Click a tool button. Drag in the canvas to create shapes. Pencil: freehand stroke; close-near-start to mark closed.',
    Component: ShapeToolsDemo,
    full: ShapeToolsDemoFull,
    path: 'apps/site/demos/ShapeToolsDemo.tsx',
  },

  {
    id: 'layout',
    title: 'Layout',
    category: 'Composition',
    description: 'Three containers side by side, one per layout strategy — freeform (absolute placement), tileGrid (2x2 cells), and snapPoint (corner snapping). All three share a single adapter and one useSelectTool. Dragging a child within its container exercises the in-container layout (cell swap, corner snap); dragging across containers reflows both sides via the layout-aware move pass.',
    hint: 'Drag a child rect within its container or into another to see layout-driven reflow.',
    Component: LayoutDemo,
    full: LayoutDemoFull,
    path: 'apps/site/demos/LayoutDemo.tsx',
    extras: [{ path: 'apps/site/demos/data/layout.scene.json', code: LayoutSceneJson, language: 'json' }],
  },

  // ─── Animation ────────────────────────────────────────────────────────────
  {
    id: 'animation',
    title: 'Animation',
    category: 'Animation',
    description: 'useAnimator + animateOnSetPose + animateLifecycle + momentum behavior. Programmatic setPose tweens (click "Tween A"/"Tween B"); inserts scale up from zero (click "Add card"); flicking a card releases with momentum decay.',
    hint: 'Click a Tween button, click Add card, or drag-and-flick a card.',
    Component: AnimationDemo,
    full: AnimationDemoFull,
    path: 'apps/site/demos/AnimationDemo.tsx',
  },
  {
    id: 'easings',
    title: 'Easings',
    category: 'Animation',
    description: 'Every named curve in the kit\'s easing library tweening a marker side-by-side. Each row is one easing from the `EASINGS` lookup (`linear` + quad/cubic/quart/quint + sine/expo/circ + back/elastic/bounce, with In/Out/InOut variants); click "play all" to fire one `animator.tween` per row simultaneously, sharing a duration slider. The dim line below each track plots the curve shape (clamped to [0,1] so back/elastic overshoot rows still fit their lane — the marker itself still travels past the endpoints when the curve does).',
    hint: 'Click "play all" to fire every easing at once; drag the slider to change duration.',
    Component: EasingsDemo,
    full: EasingsDemoFull,
    path: 'apps/site/demos/EasingsDemo.tsx',
  },

  // ─── Viewport ─────────────────────────────────────────────────────────────
  {
    id: 'pan-zoom',
    title: 'Pan & Zoom',
    category: 'Viewport',
    description: 'Viewport navigation in one place. Pan via the hand tool (H = sticky, hold space = momentary) and the wheel-pan tool; zoom via ctrl/⌘+wheel (about the cursor) and the keyboard (⌘+= / ⌘+- / ⌘+0). Selection-overlay handles, marquee, and insert overlays live in screen space, so chrome stays a fixed pixel size under zoom. The two center rects show the scene-stroke trade-off: the green rect divides its line width by meanScale(view.scale) (screen-pinned — constant at every zoom); the purple rect uses a plain world-px stroke (grows and shrinks with zoom). Two further rects sit well outside the viewport so panning has somewhere to go.',
    hint: 'H = hand · hold space = momentary · drag to pan · ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · Reset view to return home.',
    Component: PanZoomDemo,
    full: PanZoomDemoFull,
    path: 'apps/site/demos/PanZoomDemo.tsx',
  },
  {
    id: 'per-axis-zoom',
    title: 'Per-axis zoom',
    category: 'Viewport',
    description: 'View.scale is {x, y} — the sliders drive each axis independently. The mode dropdown toggles fitViewToBounds between contain (uniform min), fill (uniform max — bounds overflow one axis), and stretch (per-axis exact fit, non-uniform scale). Wheel still zooms uniformly via useWheelZoomTool default axis: both.',
    hint: 'Drag the scale.x / scale.y sliders · pick a mode and click Fit · Reset returns home.',
    Component: PerAxisZoomDemo,
    full: PerAxisZoomDemoFull,
    path: 'apps/site/demos/PerAxisZoomDemo.tsx',
  },
  {
    id: 'viewport',
    title: 'Viewport (inertia · pinch · animated zoom)',
    category: 'Viewport',
    description: 'SceneCanvas viewport prop wires inertia pan, pinch zoom, and animated keyboard zoom in one place. Inertia uses a friction-decayed velocity loop after drag release; boundary clamping can stop or bounce the pan at configurable limits. Pinch zoom attaches pointer-event listeners directly to the canvas element (works on touch screens and Mac trackpads). Animated keyboard zoom tweens Cmd+=/- with ease-out-cubic instead of jumping.',
    hint: 'Drag fast and release to coast · ⌘+= / ⌘+- / ⌘+0 to zoom with easing · toggle boundary to see stop vs bounce.',
    Component: ViewportDemo,
    full: ViewportDemoFull,
    path: 'apps/site/demos/ViewportDemo.tsx',
  },
  {
    id: 'viewport-layer',
    title: 'Viewport layer (PiP · minimap)',
    category: 'Viewport',
    description: 'Prototype: createViewportLayer renders one or more source RenderLayers through an inner View, then translates and clips the result into a screen-space rect on the outer canvas. The same source can be lensed through any number of viewports — minimap (scaled-down overview, top-right) and PiP (zoomed-in slice, bottom-left) both reuse the same source layer here. Hit-testing into viewports is not yet wired — pointer events still target the outer view.',
    hint: 'pan/zoom the outer canvas; the minimap and PiP redraw through their own static inner views',
    Component: ViewportLayerDemo,
    full: ViewportLayerDemoFull,
    path: 'apps/site/demos/ViewportLayerDemo.tsx',
  },
  {
    id: 'minimap',
    title: 'Minimap (detached)',
    category: 'Viewport',
    description: '<MinimapCanvas> mounts its own <canvas> in a sidebar (separate DOM location, own WebGL2 context) and renders the same scene the main canvas shows, through a derived fit view. A dashed indicator tracks the main canvas\'s visible window in world coords; click to recenter the main view on that world point, drag to pan continuously. Pointer-independent from the main canvas — the browser routes events by element under the cursor. No tool/action/dispatcher participation; the minimap is one hardcoded gesture pair with a fixed effect.',
    hint: 'H = hand on main · click minimap to recenter · drag minimap to pan',
    Component: MinimapDemo,
    full: MinimapDemoFull,
    path: 'apps/site/demos/MinimapDemo.tsx',
  },
  {
    id: 'parallax',
    title: 'Parallax',
    category: 'Viewport',
    description: 'createParallaxLayer wraps source RenderLayers so each plane translates and/or scales at its own rate under the camera view. v1 is cosmetic: pointer events still target the outer view. Drag to pan and watch the four planes (sky/hills/ground/foreground) move at different speeds.',
    hint: 'drag to pan · sky lags at 0.1× · hills 0.4× · ground 1:1 · foreground leads at 1.3×',
    Component: ParallaxDemo,
    full: ParallaxDemoFull,
    path: 'apps/site/demos/ParallaxDemo.tsx',
  },
  {
    id: 'force-graph',
    title: 'Force-directed graph',
    category: 'Viewport',
    description: '`useSimulation` runs a velocity-Verlet integrator with a d3-force-compatible force protocol. The kit owns the loop; the forces come from `d3-force` directly (`forceManyBody`, `forceLink`, `forceCollide`, `forceCenter`). Drag a node to pin it (sets `fx`/`fy` and reheats with `alphaTarget(0.3).restart()`); release to free it. Sim ticks call `scene.setPose` so SceneCanvas redraws on scene mutations — no React-state churn from a custom render-driver.',
    hint: 'drag to pin · ctrl/⌘+wheel zoom · wheel pan · H drag to pan · ⌘+0 reset',
    Component: ForceGraphDemo,
    full: ForceGraphDemoFull,
    path: 'apps/site/demos/ForceGraphDemo.tsx',
  },
  {
    id: 'd3-sortable',
    title: 'd3 plugin: sortable bars',
    category: 'Viewport',
    description: '`@weasel-js/d3` proof of concept. Twelve bars bound to a data array via `d3Bind(scene, data, { key, animator }).pose(fn).data(fn).join()`. Click sort buttons to reorder the data; the join diffs against the scene and emits one batched op group, then `.transition().duration(600).ease(easeInOutCubic).delay(i × 30)` animates each bar to its new x-position with a stagger. Phase 2 of the d3 plugin (transition chain over `useAnimator`).',
    hint: 'click sort buttons · per-item delay staggers the move',
    Component: D3SortableDemo,
    full: D3SortableDemoFull,
    path: 'apps/site/demos/D3SortableDemo.tsx',
  },

  // ─── Rendering & paint ────────────────────────────────────────────────────
  {
    id: 'gradient-playground',
    title: 'Gradient playground',
    category: 'Rendering & paint',
    description: 'Interactive editor for the three gradient paint variants — linear, radial, conic. Drag the on-canvas handles to set the gradient geometry (linear endpoints, radial center+radius, conic center+angle). Below the canvas, click the strip to add a stop, drag stops to reposition, click a swatch to recolor, right-click to delete. Showcases the `linear-gradient` / `radial-gradient` / `conic-gradient` FillStyle variants shipped with the WebGL backend.',
    hint: 'drag handles · click strip to add stops · drag stop to move · click swatch to recolor',
    Component: GradientPlaygroundDemo,
    full: GradientPlaygroundDemoFull,
    path: 'apps/site/demos/GradientPlaygroundDemo.tsx',
  },
  {
    id: 'vertex-colors',
    title: 'Per-vertex colors',
    category: 'Rendering & paint',
    description: 'A heptagon whose fill is driven by an RGBA-per-vertex array — no FillStyle object, just colors baked onto the geometry. Drag a vertex handle to move it; double-click to recolor. Colors interpolate smoothly across the triangulated interior. Demonstrates the `vertexColors` field on `PathDrawCommand`, emitted from a custom `RenderLayer` slotted into the Canvas layers map.',
    hint: 'drag vertex to move · double-click vertex to recolor',
    Component: VertexColorsDemo,
    full: VertexColorsDemoFull,
    path: 'apps/site/demos/VertexColorsDemo.tsx',
  },
  {
    id: 'vertex-widths',
    title: 'Per-vertex stroke widths',
    category: 'Rendering & paint',
    description: 'Two panels. Top: a five-anchor polyline whose center anchor\'s stroke width is driven by a slider — the tessellator emits trapezoidal segments and force-bevels the miters once the taper ratio exceeds `varyingWidthJoinThreshold` (default 1.5×). Bottom: a `usePencilTool` with `pressureToWidth` configured — Apple Pencil / Wacom strokes get real pressure-modulated tapering, mouse strokes get a flat 0.5-pressure width (per the Pointer Events spec). Demonstrates `Stroke.vertexWidths`, `createPathLayer({ getStrokeVertexWidths })`, and `pressureToWidth(p, opts)`.',
    hint: 'top: drag slider · bottom: draw strokes (Apple Pencil for real pressure)',
    Component: VertexWidthsDemo,
    full: VertexWidthsDemoFull,
    path: 'apps/site/demos/VertexWidthsDemo.tsx',
  },
  {
    id: 'color-matrix',
    title: 'Stacked color matrices',
    category: 'Rendering & paint',
    description: 'Three nested groups, each with its own preset color matrix (Identity / Grayscale / Sepia / Invert / Hue+90° / Brightness×1.5). The same base palette renders inside each group, so you can see the cumulative effect — inner-group leaves see all three matrices composed multiplicatively. Click a preset button under any group to swap that group\'s matrix and watch the entire subtree retint. Demonstrates `GroupDrawCommand.colorMatrix`.',
    hint: 'click presets to retint each group · matrices compose down the stack',
    Component: ColorMatrixDemo,
    full: ColorMatrixDemoFull,
    path: 'apps/site/demos/ColorMatrixDemo.tsx',
  },
  {
    id: 'custom-shader',
    title: 'Custom shaders',
    category: 'Rendering & paint',
    description: 'Three custom GLSL shader panels: plasma (animated sin/cos field that follows the cursor), ripple (click anywhere to spawn an expanding ring on a sampled image), and voronoi (drag the white seed points to reshape the cellular pattern). Each panel registers its program at module scope via `registerProgram()` and emits a `ShaderDrawCommand` over a panel-bound rect; the renderer compiles them via the new `shaders` prop on SceneCanvas. Custom shader API is `@experimental`.',
    hint: 'plasma follows cursor · click ripple panel · drag voronoi seeds',
    Component: CustomShaderDemo,
    full: CustomShaderDemoFull,
    path: 'apps/site/demos/CustomShaderDemo.tsx',
  },
  {
    id: 'render-to-pixels',
    title: 'Headless render-to-pixels',
    category: 'Rendering & paint',
    description: 'renderSceneToPixels() rasterizes a scene-space rect to raw RGBA at an explicit per-axis scale — no on-screen canvas, no ambient devicePixelRatio. The snapshot below is rendered at an anisotropic 2×1 px/unit onto a white background and blitted into a 2D canvas; the readout re-renders and byte-compares to demonstrate same-context determinism. This is the print/thumbnail/export primitive: physical units (dpi, mm) stay the caller\'s business.',
    hint: 'The top canvas is the live scene; the bottom image is the headless raster at 2×1 px/unit. The readout confirms two headless renders produced identical bytes.',
    Component: RenderToPixelsDemo,
    full: RenderToPixelsDemoFull,
    path: 'apps/site/demos/RenderToPixelsDemo.tsx',
  },

  // ─── Diagnostics ──────────────────────────────────────────────────────────
  {
    id: 'rotated-resize-math',
    title: 'Rotated resize math',
    category: 'Diagnostics',
    description: 'Math explainer for rotated resize: drag the bottom-right corner of each rect and watch the "fixed corner world" ledger. Green: full math (projection + anchor pinning + position correction) — ledger stays constant. Orange: no projection — distorts on rotation. Purple: no position correction — fixed corner drifts.',
    hint: 'Drag a corner handle to resize the rotated rect.',
    Component: RotatedResizeMathDemo,
    full: RotatedResizeMathDemoFull,
    path: 'apps/site/demos/RotatedResizeMathDemo.tsx',
  },
  {
    id: 'quadtree',
    title: 'Quadtree overlay',
    category: 'Diagnostics',
    description: 'A demo-local quadtree slotted into the Canvas layers map as a custom RenderLayer alongside weasel\'s stock layers (grid, scene, selection overlay). The tree rebuilds each frame from the committed rect AABBs and subdivides any cell that overlaps more than one rect (max depth 5). Demonstrates how to drop an analytical layer into the layer pipeline via `{ layer, after }`.',
    hint: 'Click to select, drag to move, drag a corner to resize. Watch the cyan cells subdivide live.',
    Component: QuadtreeDemo,
    full: QuadtreeDemoFull,
    path: 'apps/site/demos/QuadtreeDemo.tsx',
  },
  {
    id: 'debug-overlay',
    title: 'Debug overlay',
    category: 'Diagnostics',
    description: 'A dev-mode overlay layer that paints what the kit\'s interaction system "sees": object bounds (AABBs), pose origins, every hit-test shape, handle positions, snap candidates, and per-layer metadata. Pass a `DebugConfig` (or `true` / `"all"`) to `<Canvas debug={...}>` and the kit appends a screen-space overlay layer wired to a per-frame debug sink. Tree-shaken when `debug` is falsy/undefined; URL fallback `?debug=all` (or `?debug=bounds,handles`) reads from `location.search`. Each chip toggles a single feature so you can isolate visualization of, say, just hitboxes vs. just snap candidates.',
    hint: 'Toggle chips to layer the kit\'s view of the scene. Drag a box (snap chip lights up); drag a corner (handles + hitboxes light up).',
    Component: DebugOverlayDemo,
    full: DebugOverlayDemoFull,
    path: 'apps/site/demos/DebugOverlayDemo.tsx',
  },
  {
    id: 'tool-reflection',
    title: 'Tool reflection',
    category: 'Diagnostics',
    description: 'The three routing-reflection consumers operating on stub ToolDefs that mirror the gesture surface of useSelectTool + useHandTool. Action registry (left) flattens every routed slot — phase × gesture × target × modifier — into a single table. Conflict detector (middle) walks the same set looking for exact-tuple overlaps across tools; the stubs here register cleanly so it reports none. Canvas (right) runs the real tools so you can interact with the scene. Live ToolDebugOverlay coverage is gated on a SceneCanvas dispatcher hook — see Phase 4 follow-ups.',
    hint: 'Read the registry and conflict columns; click / drag rects to exercise the underlying tools.',
    Component: ToolReflectionDemo,
    full: ToolReflectionDemoFull,
    path: 'apps/site/demos/ToolReflectionDemo.tsx',
    extras: [{ path: 'apps/site/demos/ToolReflectionDemo.module.css', code: ToolReflectionDemoCss, language: 'css' }],
  },

  // ─── weasel-ui ────────────────────────────────────────────────────────────
  {
    id: 'perceptual-color-sliders',
    title: 'Perceptual color sliders',
    category: 'weasel-ui',
    description: 'Four representative slider variants from the perceptual-color experiment, all built on Slider: single-thumb hue, 2-thumb ordered L range with active-range hatching, 3-thumb chroma with per-thumb bounds, and a dynamic indices band with click-to-add, drag-off-vertical to remove, and shift-drag translate-all.',
    hint: 'Drag thumbs; on the indices band, click empty track to add, drag a thumb up/down to remove, hold Shift to translate all.',
    Component: PerceptualColorSlidersDemo,
    full: PerceptualColorSlidersDemoFull,
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
    Component: LayeredCurveDemo,
    full: LayeredCurveDemoFull,
    path: 'apps/site/demos/LayeredCurveDemo.tsx',
  },

  // ─── weasel-hud ───────────────────────────────────────────────────────────
  {
    id: 'hud',
    title: 'HUD widgets',
    category: 'weasel-hud',
    description: 'A button widget rendered by @weasel-js/hud in screen space over a WebGL canvas. useHud attaches a HUD layer to the canvas; hud.button() creates a click-counter button. Press events fire in the HUD dispatcher before the active tool sees the pointer down, so tool interactions are never disrupted by HUD clicks.',
    hint: 'Click the "Click me" button — the label updates with the click count.',
    Component: HudDemo,
    full: HudDemoFull,
    path: 'apps/site/demos/HudDemo.tsx',
  },
];

// Auto-derive `extras` from each demo's relative imports. Any demo file that
// imports from a `./xxx` or `../xxx` path picks up tabs for the matched
// files in the source pane — no manual extras entry required. Manual
// extras still take precedence (entry order + curated language).
const RAW_BY_GLOB_KEY = import.meta.glob([
  './demos/**/*.{tsx,ts,json,css}',
  '../draw/src/**/*.{tsx,ts,css}',
  '../../packages/**/src/**/*.{tsx,ts,css}',
], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

function extToLang(ext: string): DemoExtra['language'] {
  if (ext === 'json') return 'json';
  if (ext === 'ts') return 'ts';
  if (ext === 'css') return 'css';
  if (ext === 'md') return 'md';
  return 'tsx';
}

function resolvePath(fromPath: string, importPath: string): string {
  // fromPath: 'apps/site/demos/TransformDemo.tsx'; importPath: './data/transform.scene.json'
  // → 'apps/site/demos/data/transform.scene.json'
  const dir = fromPath.substring(0, fromPath.lastIndexOf('/'));
  const parts = (dir + '/' + importPath).split('/');
  const stack: string[] = [];
  for (const p of parts) {
    if (p === '..') stack.pop();
    else if (p && p !== '.') stack.push(p);
  }
  return stack.join('/');
}

/** Map a repo-relative path back to the import.meta.glob key. The glob is
 *  rooted at this file (`apps/site/registry.ts`), so the key for
 *  `apps/site/demos/X.tsx` is `./demos/X.tsx`, for `apps/draw/...` it's
 *  `../draw/...`, and for `packages/...` it's `../../packages/...`. */
function toGlobKey(repoPath: string): string {
  if (repoPath.startsWith('apps/site/')) return './' + repoPath.substring('apps/site/'.length);
  if (repoPath.startsWith('apps/')) return '../' + repoPath.substring('apps/'.length);
  return '../../' + repoPath;
}

function findRawFor(resolved: string): { path: string; code: string; ext: string } | null {
  const candidates = resolved.match(/\.[a-z]+$/)
    ? [resolved]
    : [`${resolved}.tsx`, `${resolved}.ts`, `${resolved}.json`, `${resolved}.css`,
       `${resolved}/index.tsx`, `${resolved}/index.ts`];
  for (const c of candidates) {
    const code = RAW_BY_GLOB_KEY[toGlobKey(c)];
    if (code != null) {
      const ext = c.match(/\.([a-z]+)$/)?.[1] ?? 'tsx';
      return { path: c, code, ext };
    }
  }
  return null;
}

const RELATIVE_IMPORT_RE = /from\s+['"]([./][^'"]+)['"]/g;

function autoExtras(demoFull: string, demoPath: string, manual: DemoExtra[] = []): DemoExtra[] {
  const out = [...manual];
  const seen = new Set(manual.map((e) => e.path));
  // Avoid re-tabbing the demo itself if it self-imports somehow.
  seen.add(demoPath);
  let m;
  while ((m = RELATIVE_IMPORT_RE.exec(demoFull))) {
    const resolved = resolvePath(demoPath, m[1]);
    if (seen.has(resolved)) continue;
    const found = findRawFor(resolved);
    if (!found) continue;
    if (seen.has(found.path)) continue;
    seen.add(found.path);
    out.push({ path: found.path, code: found.code, language: extToLang(found.ext) });
  }
  RELATIVE_IMPORT_RE.lastIndex = 0;
  return out;
}

for (const entry of DEMOS) {
  entry.extras = autoExtras(entry.full, entry.path, entry.extras);
}

// Merge git-derived timestamps into every entry. The vite plugin
// `scripts/vite-demo-timestamps.ts` produces this map at build time;
// entries whose path isn't in git yet (locally-staged new demos) are
// silently skipped, leaving `created` / `lastModified` undefined.
import TIMESTAMPS from 'virtual:demo-timestamps';
for (const entry of DEMOS) {
  const ts = TIMESTAMPS[entry.path];
  if (ts) {
    entry.created = ts.created;
    entry.lastModified = ts.lastModified;
  }
}

export const CATEGORIES = Array.from(new Set(DEMOS.map((d) => d.category)));

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
