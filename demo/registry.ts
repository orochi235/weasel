import type { ComponentType } from 'react';
import { MoveDemo } from './demos/MoveDemo';
import { ResizeDemo } from './demos/ResizeDemo';
import { RotateDemo } from './demos/RotateDemo';
import { RotatedResizeMathDemo } from './demos/RotatedResizeMathDemo';
import { MultiSelectDemo } from './demos/MultiSelectDemo';
import { InsertDemo } from './demos/InsertDemo';
import { CloneDemo } from './demos/CloneDemo';
import { ComposeDemo } from './demos/ComposeDemo';
import { ActionsDemo } from './demos/ActionsDemo';
import { GroupsDemo } from './demos/GroupsDemo';
import { NestedGroupsDemo } from './demos/NestedGroupsDemo';
import { TextDemo } from './demos/TextDemo';
import { QuadtreeDemo } from './demos/QuadtreeDemo';
import { PathPoseDemo } from './demos/PathPoseDemo';
import { CompoundPathsDemo } from './demos/CompoundPathsDemo';
import { BezierEditDemo } from './demos/BezierEditDemo';
import { SceneDemo } from './demos/SceneDemo';
import { PanDemo } from './demos/PanDemo';
import { ZoomDemo } from './demos/ZoomDemo';
import { AnimationDemo } from './demos/AnimationDemo';
import { LayoutDemo } from './demos/LayoutDemo';
import { DebugOverlayDemo } from './demos/DebugOverlayDemo';
import { EasingsDemo } from './demos/EasingsDemo';
import { ViewportDemo } from './demos/ViewportDemo';
import { PerceptualColorSlidersDemo } from './demos/PerceptualColorSlidersDemo';
import { GradientPlaygroundDemo } from './demos/GradientPlaygroundDemo';
import { VertexColorsDemo } from './demos/VertexColorsDemo';
import { ColorMatrixDemo } from './demos/ColorMatrixDemo';
import { CustomShaderDemo } from './demos/CustomShaderDemo';

import MoveDemoFull from './demos/MoveDemo.tsx?raw';
import ResizeDemoFull from './demos/ResizeDemo.tsx?raw';
import RotateDemoFull from './demos/RotateDemo.tsx?raw';
import RotatedResizeMathDemoFull from './demos/RotatedResizeMathDemo.tsx?raw';
import MultiSelectDemoFull from './demos/MultiSelectDemo.tsx?raw';
import InsertDemoFull from './demos/InsertDemo.tsx?raw';
import CloneDemoFull from './demos/CloneDemo.tsx?raw';
import ComposeDemoFull from './demos/ComposeDemo.tsx?raw';
import ActionsDemoFull from './demos/ActionsDemo.tsx?raw';
import GroupsDemoFull from './demos/GroupsDemo.tsx?raw';
import NestedGroupsDemoFull from './demos/NestedGroupsDemo.tsx?raw';
import TextDemoFull from './demos/TextDemo.tsx?raw';
import QuadtreeDemoFull from './demos/QuadtreeDemo.tsx?raw';
import PathPoseDemoFull from './demos/PathPoseDemo.tsx?raw';
import CompoundPathsDemoFull from './demos/CompoundPathsDemo.tsx?raw';
import BezierEditDemoFull from './demos/BezierEditDemo.tsx?raw';
import SceneDemoFull from './demos/SceneDemo.tsx?raw';
import PanDemoFull from './demos/PanDemo.tsx?raw';
import ZoomDemoFull from './demos/ZoomDemo.tsx?raw';
import AnimationDemoFull from './demos/AnimationDemo.tsx?raw';
import LayoutDemoFull from './demos/LayoutDemo.tsx?raw';
import DebugOverlayDemoFull from './demos/DebugOverlayDemo.tsx?raw';
import EasingsDemoFull from './demos/EasingsDemo.tsx?raw';
import ViewportDemoFull from './demos/ViewportDemo.tsx?raw';
import PerceptualColorSlidersDemoFull from './demos/PerceptualColorSlidersDemo.tsx?raw';
import GradientPlaygroundDemoFull from './demos/GradientPlaygroundDemo.tsx?raw';
import VertexColorsDemoFull from './demos/VertexColorsDemo.tsx?raw';
import ColorMatrixDemoFull from './demos/ColorMatrixDemo.tsx?raw';
import CustomShaderDemoFull from './demos/CustomShaderDemo.tsx?raw';

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
}

export const DEMOS: DemoEntry[] = [
  {
    id: 'scene',
    title: 'Scene primitive',
    category: 'Composed',
    description: 'useScene + SceneCanvas — a kit-owned scene graph with first-class layers, parenting, and undo/redo. Five system layers (garden / blueprint / structures / zones / plantings) demonstrate the eric-shape; a leaf on the plantings layer is parented under a container on the structures layer (cross-layer parenting). A registered consumer op (`setColor`) records onto the same undo stack as kit mutations like setPose. Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z are wired via useUndoRedo.',
    hint: 'Drag rectangles to move; click "Recolor selection" then undo with Cmd+Z.',
    Component: SceneDemo,
    full: SceneDemoFull,
    path: 'demo/demos/SceneDemo.tsx',
  },
  {
    id: 'move',
    title: 'Move',
    category: 'Interactions',
    description: 'useMove with a grid-snap behavior — drag any rectangle and watch it snap to the 20-unit grid.',
    hint: 'Drag a rectangle.',
    Component: MoveDemo,
    full: MoveDemoFull,
    path: 'demo/demos/MoveDemo.tsx',
  },
  {
    id: 'animation',
    title: 'Animation',
    category: 'Interactions',
    description: 'useAnimator + animateOnSetPose + animateLifecycle + momentum behavior. Programmatic setPose tweens (click "Tween A"/"Tween B"); inserts scale up from zero (click "Add card"); flicking a card releases with momentum decay.',
    hint: 'Click a Tween button, click Add card, or drag-and-flick a card.',
    Component: AnimationDemo,
    full: AnimationDemoFull,
    path: 'demo/demos/AnimationDemo.tsx',
  },
  {
    id: 'perceptual-color-sliders',
    title: 'Perceptual Color Sliders',
    category: 'Composed',
    description: 'Four representative slider variants from the perceptual-color experiment, all built on RangePicker: single-thumb hue, 2-thumb ordered L range with active-range hatching, 3-thumb chroma with per-thumb bounds, and a dynamic indices band with click-to-add, drag-off-vertical to remove, and shift-drag translate-all.',
    hint: 'Drag thumbs; on the indices band, click empty track to add, drag a thumb up/down to remove, hold Shift to translate all.',
    Component: PerceptualColorSlidersDemo,
    full: PerceptualColorSlidersDemoFull,
    path: 'demo/demos/PerceptualColorSlidersDemo.tsx',
  },
  {
    id: 'easings',
    title: 'Easings',
    category: 'Interactions',
    description: 'Every named curve in the kit\'s easing library tweening a marker side-by-side. Each row is one easing from the `EASINGS` lookup (`linear` + quad/cubic/quart/quint + sine/expo/circ + back/elastic/bounce, with In/Out/InOut variants); click "play all" to fire one `animator.tween` per row simultaneously, sharing a duration slider. The dim line below each track plots the curve shape (clamped to [0,1] so back/elastic overshoot rows still fit their lane — the marker itself still travels past the endpoints when the curve does).',
    hint: 'Click "play all" to fire every easing at once; drag the slider to change duration.',
    Component: EasingsDemo,
    full: EasingsDemoFull,
    path: 'demo/demos/EasingsDemo.tsx',
  },
  {
    id: 'layout',
    title: 'Layout',
    category: 'Interactions',
    description: 'Three containers side by side, one per layout strategy — freeform (absolute placement), tileGrid (2x2 cells), and snapPoint (corner snapping). All three share a single adapter and one useSelectTool. Dragging a child within its container exercises the in-container layout (cell swap, corner snap); dragging across containers reflows both sides via the layout-aware move pass.',
    hint: 'Drag a child rect within its container or into another to see layout-driven reflow.',
    Component: LayoutDemo,
    full: LayoutDemoFull,
    path: 'demo/demos/LayoutDemo.tsx',
  },
  {
    id: 'resize',
    title: 'Resize',
    category: 'Interactions',
    description: 'useResize — grab one of the four corner handles to resize the rectangle from the opposite anchor.',
    hint: 'Drag a corner handle.',
    Component: ResizeDemo,
    full: ResizeDemoFull,
    path: 'demo/demos/ResizeDemo.tsx',
  },
  {
    id: 'rotate',
    title: 'Rotate',
    category: 'Interactions',
    description: 'useRotate — drag the rotation handle (above the top-center of the bounding box) to rotate the object around its AABB center. Body-drag still moves; corner handles resize in the leaf\'s local frame (the diagonal corner stays pinned in world space).',
    hint: 'Click a rect to select; drag the small handle above it to rotate.',
    Component: RotateDemo,
    full: RotateDemoFull,
    path: 'demo/demos/RotateDemo.tsx',
  },
  {
    id: 'rotated-resize-math',
    title: 'Rotated resize math',
    category: 'Interactions',
    description: 'Math explainer for rotated resize: drag the bottom-right corner of each rect and watch the "fixed corner world" ledger. Green: full math (projection + anchor pinning + position correction) — ledger stays constant. Orange: no projection — distorts on rotation. Purple: no position correction — fixed corner drifts.',
    hint: 'Drag a corner handle to resize the rotated rect.',
    Component: RotatedResizeMathDemo,
    full: RotatedResizeMathDemoFull,
    path: 'demo/demos/RotatedResizeMathDemo.tsx',
  },
  {
    id: 'insert',
    title: 'Insert',
    category: 'Interactions',
    description: 'useInsert — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
    hint: 'Drag on empty space to draw.',
    Component: InsertDemo,
    full: InsertDemoFull,
    path: 'demo/demos/InsertDemo.tsx',
  },
  {
    id: 'clone',
    title: 'Clone',
    category: 'Interactions',
    description: 'useClone with the cloneByAltDrag behavior — hold Alt and drag a rectangle to duplicate it at the drop point.',
    hint: 'Hold Alt and drag a rectangle.',
    Component: CloneDemo,
    full: CloneDemoFull,
    path: 'demo/demos/CloneDemo.tsx',
  },
  {
    id: 'text',
    title: 'Text',
    category: 'Interactions',
    description: 'createTextLayer + useTextEdit + createSetTextOp, composed with useMove, useResize, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit at the clicked glyph (caretIndexAt resolves the click to a character offset and seeds the contenteditable caret); commits flow through createSetTextOp so they\'re undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette.',
    hint: 'Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels.',
    Component: TextDemo,
    full: TextDemoFull,
    path: 'demo/demos/TextDemo.tsx',
  },
  {
    id: 'multi-select',
    title: 'Multi-select',
    category: 'Selection & actions',
    description: 'selectionMode="multi" — shift-click to extend the selection. With more than one item selected, the overlay collapses to a single union AABB with corner handles, clicks inside the union drag the whole set, and the corner handles resize the union (each member is scaled via the same remapBounds path the groups demo uses).',
    hint: 'Click a rect to select; shift-click another to add it; drag the body or grab a corner.',
    Component: MultiSelectDemo,
    full: MultiSelectDemoFull,
    path: 'demo/demos/MultiSelectDemo.tsx',
  },
  {
    id: 'actions',
    title: 'Actions',
    category: 'Selection & actions',
    description: 'Five selection-driven action hooks — useEscape, useSelectAll, useDuplicate, useNudge, useReorder — wired with their default keybindings. Focus the demo (tabIndex container) to enable the shortcuts; arrows nudge by 2, shift+arrows by 20, Cmd-[/Cmd-] reorder z-order (shift sends to front/back).',
    hint: 'Click to focus, then press Esc / Cmd-A / Cmd-D / arrows / Cmd-[ / Cmd-].',
    Component: ActionsDemo,
    full: ActionsDemoFull,
    path: 'demo/demos/ActionsDemo.tsx',
  },
  {
    id: 'virtual-groups',
    title: 'Virtual groups',
    category: 'Groups',
    description: 'A virtual group around three rectangles — a side-record { id, members[] } with no scene-graph hierarchy. Clicking any member selects the whole group; dragging moves all members together; corner handles resize the group\'s union AABB and scale each member proportionally. Selection overlay uses the optional groupAdapter to draw a single rectangle around the group.',
    hint: 'Click a green rect to select the group, then drag or grab a corner.',
    Component: GroupsDemo,
    full: GroupsDemoFull,
    path: 'demo/demos/GroupsDemo.tsx',
  },
  {
    id: 'nested-groups',
    title: 'Nested groups',
    category: 'Groups',
    description: 'Real parent/child hierarchy via setParent — supports arbitrary nesting depth. The opening scene already shows three levels: g1 contains a free leaf and a sub-group g2; g2 in turn contains its own leaves. Poses are local to the direct parent; the kit composes world poses via worldPoseLookup for hit-testing and selection overlays. useNestedGroup (Mod+G) wraps the selection in a new parent node and rebases children\'s locals so their visual world position is preserved; useNestedUngroup (Mod+Shift+G) reparents children back to the grandparent. Default click resolves to the outermost ancestor; Alt-click drills one level deeper than the deepest currently-selected ancestor (so repeated Alt-clicks step group → subgroup → leaf), letting you select any node in the tree to group/ungroup at any depth. Dragging a parent auto-cascades its descendants in the live overlay so children visually follow during the drag (no extra ops — under local-pose semantics the post-commit scene is already correct). Mod+Z / Mod+Shift+Z undo and redo.',
    hint: 'Click a leaf to grab its outermost group. Alt-click to drill in (each Alt-click steps one level deeper). Cmd+G groups the selection at any depth; Cmd+Shift+G ungroups.',
    Component: NestedGroupsDemo,
    full: NestedGroupsDemoFull,
    path: 'demo/demos/NestedGroupsDemo.tsx',
  },
  {
    id: 'compose',
    title: 'Compose',
    category: 'Composed',
    description: 'Four interactions on one scene — move, resize, insert, area-select all share a single adapter and rect list. A pointer-down dispatcher picks which hook owns the gesture; selection is rendered as outlines and resize handles.',
    hint: 'Click a rect to select; drag a handle to resize; drag empty space to marquee-select; switch to Insert mode to draw new rects.',
    Component: ComposeDemo,
    full: ComposeDemoFull,
    path: 'demo/demos/ComposeDemo.tsx',
  },
  {
    id: 'quadtree',
    title: 'Quadtree overlay',
    category: 'Composed',
    description: 'A demo-local quadtree slotted into the Canvas layers map as a custom RenderLayer alongside weasel\'s stock layers (grid, scene, selection overlay). The tree rebuilds each frame from the committed rect AABBs and subdivides any cell that overlaps more than one rect (max depth 5). Demonstrates how to drop an analytical layer into the layer pipeline via `{ layer, after }`.',
    hint: 'Click to select, drag to move, drag a corner to resize. Watch the cyan cells subdivide live.',
    Component: QuadtreeDemo,
    full: QuadtreeDemoFull,
    path: 'demo/demos/QuadtreeDemo.tsx',
  },
  {
    id: 'path-pose',
    title: 'Path as pose',
    category: 'Composed',
    description: 'A scene where the object\'s pose IS a Path — no rect→shape adapter step. Canvas\'s internal useResize is generalized over TPose via the optional `geometry` opt; passing `pathPoseDescriptor` lets it read bounds via boundsOfPath and remap every coord through an affine scale against the dragged AABB. Move uses the kit\'s `translatePath` as its translatePose, and snap-to-grid runs through `pathOriginProjection` so it snaps the path origin rather than every vertex. Body-drag to move; corner handles to resize.',
    hint: 'Drag the polygon body to move it; drag a corner to resize.',
    Component: PathPoseDemo,
    full: PathPoseDemoFull,
    path: 'demo/demos/PathPoseDemo.tsx',
  },
  {
    id: 'compound-paths',
    title: 'Compound paths',
    category: 'Composed',
    description: 'Five non-rect shapes on one canvas, all editable end-to-end via Canvas + the `geometry={pathPoseDescriptor}` prop. Ghost (multi-contour PolygonPath with evenodd eye holes and Q-curve curls), rubber duck (composePath fuse of separate body/head/beak/eye PolygonPaths), Hamburglar silhouette (disjoint cape + hat subpaths under one pose — verifies the selection overlay draws one outer AABB around discontinuous shapes), goose (extreme aspect ratio long neck — stresses resize anchoring), octopus (eight open-polyline tentacles around a closed body subpath — exercises the open-subpath rendering path). Hit-testing uses pointInPath against the real silhouette; the adapter wires pathPoseDescriptor.intersectsRect for area-select.',
    hint: 'Click to select, drag to move, drag a corner to resize, shift-click to multi-select. Click "honk" above the goose.',
    Component: CompoundPathsDemo,
    full: CompoundPathsDemoFull,
    path: 'demo/demos/CompoundPathsDemo.tsx',
  },
  {
    id: 'bezier-edit',
    title: 'Bezier edit',
    category: 'Composed',
    description: 'Control-point editing on a polygon path. Click to select (selection AABB shows), double-click the curve to enter anchor-edit mode (selection AABB hides; anchor + control-handle circles + tangent lines render), drag any anchor or control to mutate the curve, Esc to exit. v1 corner-only behavior: dragging an anchor moves only its on-curve coord — adjacent controls stay put in world space (Illustrator "Convert Anchor Point" semantics). Smoothing (Figma\'s default move-anchor-moves-controls) plugs in next iteration; insert/delete anchors and marquee-select are deferred.',
    hint: 'Click to select. Double-click to edit anchors. Drag anchors or control handles. Esc to exit edit mode.',
    Component: BezierEditDemo,
    full: BezierEditDemoFull,
    path: 'demo/demos/BezierEditDemo.tsx',
  },
  {
    id: 'zoom',
    title: 'Zoom (Phase 2c)',
    category: 'Viewport',
    description: 'Three opt-in always-on tools wired alongside select + hand: useWheelZoomTool (ctrl/meta+wheel zooms about the cursor), useWheelPanTool (plain wheel pans), useKeyboardZoomTool (Cmd+= / Cmd+- / Cmd+0). Selection-overlay handles, marquee, and insert overlays now live in screen space, so chrome stays at fixed pixel size under zoom. The two demo rects show the trade-off in scene strokes: the green rect divides lineWidth by view.scale (screen-pinned, looks the same at every zoom); the purple rect uses a plain world-px stroke (grows and shrinks with zoom).',
    hint: 'ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · H drag · space drag.',
    Component: ZoomDemo,
    full: ZoomDemoFull,
    path: 'demo/demos/ZoomDemo.tsx',
  },
  {
    id: 'viewport',
    title: 'Viewport (inertia · pinch · animated zoom)',
    category: 'Viewport',
    description: 'SceneCanvas viewport prop wires inertia pan, pinch zoom, and animated keyboard zoom in one place. Inertia uses a friction-decayed velocity loop after drag release; boundary clamping can stop or bounce the pan at configurable limits. Pinch zoom attaches pointer-event listeners directly to the canvas element (works on touch screens and Mac trackpads). Animated keyboard zoom tweens Cmd+=/- with ease-out-cubic instead of jumping.',
    hint: 'Drag fast and release to coast · ⌘+= / ⌘+- / ⌘+0 to zoom with easing · toggle boundary to see stop vs bounce.',
    Component: ViewportDemo,
    full: ViewportDemoFull,
    path: 'demo/demos/ViewportDemo.tsx',
  },
  {
    id: 'debug-overlay',
    title: 'Debug overlay',
    category: 'Tools',
    description: 'A dev-mode overlay layer that paints what the kit\'s interaction system "sees": object bounds (AABBs), pose origins, every hit-test shape, handle positions, snap candidates, and per-layer metadata. Pass a `DebugConfig` (or `true` / `"all"`) to `<Canvas debug={...}>` and the kit appends a screen-space overlay layer wired to a per-frame debug sink. Tree-shaken when `debug` is falsy/undefined; URL fallback `?debug=all` (or `?debug=bounds,handles`) reads from `location.search`. Each chip toggles a single feature so you can isolate visualization of, say, just hitboxes vs. just snap candidates.',
    hint: 'Toggle chips to layer the kit\'s view of the scene. Drag a box (snap chip lights up); drag a corner (handles + hitboxes light up).',
    Component: DebugOverlayDemo,
    full: DebugOverlayDemoFull,
    path: 'demo/demos/DebugOverlayDemo.tsx',
  },
  {
    id: 'gradient-playground',
    title: 'Gradient playground',
    category: 'Paint & shading',
    description: 'Interactive editor for the three gradient paint variants — linear, radial, conic. Drag the on-canvas handles to set the gradient geometry (linear endpoints, radial center+radius, conic center+angle). Below the canvas, click the strip to add a stop, drag stops to reposition, click a swatch to recolor, right-click to delete. Showcases the `linear-gradient` / `radial-gradient` / `conic-gradient` Paint variants shipped with the WebGL backend.',
    hint: 'drag handles · click strip to add stops · drag stop to move · click swatch to recolor',
    Component: GradientPlaygroundDemo,
    full: GradientPlaygroundDemoFull,
    path: 'demo/demos/GradientPlaygroundDemo.tsx',
  },
  {
    id: 'vertex-colors',
    title: 'Per-vertex colors',
    category: 'Paint & shading',
    description: 'A heptagon whose fill is driven by an RGBA-per-vertex array — no Paint object, just colors baked onto the geometry. Drag a vertex handle to move it; double-click to recolor. Colors interpolate smoothly across the triangulated interior. Demonstrates the `vertexColors` field on `PathDrawCommand`, emitted from a custom `RenderLayer` slotted into the Canvas layers map.',
    hint: 'drag vertex to move · double-click vertex to recolor',
    Component: VertexColorsDemo,
    full: VertexColorsDemoFull,
    path: 'demo/demos/VertexColorsDemo.tsx',
  },
  {
    id: 'color-matrix',
    title: 'Stacked color matrices',
    category: 'Paint & shading',
    description: 'Three nested groups, each with its own preset color matrix (Identity / Grayscale / Sepia / Invert / Hue+90° / Brightness×1.5). The same base palette renders inside each group, so you can see the cumulative effect — inner-group leaves see all three matrices composed multiplicatively. Click a preset button under any group to swap that group\'s matrix and watch the entire subtree retint. Demonstrates `GroupDrawCommand.colorMatrix`.',
    hint: 'click presets to retint each group · matrices compose down the stack',
    Component: ColorMatrixDemo,
    full: ColorMatrixDemoFull,
    path: 'demo/demos/ColorMatrixDemo.tsx',
  },
  {
    id: 'custom-shader',
    title: 'Custom shaders',
    category: 'Paint & shading',
    description: 'Three custom GLSL shader panels: plasma (animated sin/cos field that follows the cursor), ripple (click anywhere to spawn an expanding ring on a sampled image), and voronoi (drag the white seed points to reshape the cellular pattern). Each panel registers its program at module scope via `registerProgram()` and emits a `ShaderDrawCommand` over a panel-bound rect; the renderer compiles them via the new `shaders` prop on SceneCanvas. Custom shader API is `@experimental`.',
    hint: 'plasma follows cursor · click ripple panel · drag voronoi seeds',
    Component: CustomShaderDemo,
    full: CustomShaderDemoFull,
    path: 'demo/demos/CustomShaderDemo.tsx',
  },
  {
    id: 'pan',
    title: 'Pan (Phase 2b)',
    category: 'Viewport',
    description: 'useHandTool wired with <Canvas view={...} onViewChange={...}>. Three rectangles spread across a coordinate range larger than the 400×300 viewport. H switches to the hand tool (sticky); space engages it momentarily. Drag to pan. The select tool remains available when neither hand activation is engaged.',
    hint: 'H = hand tool · hold space = momentary hand · drag to pan · Reset view to return home.',
    Component: PanDemo,
    full: PanDemoFull,
    path: 'demo/demos/PanDemo.tsx',
  },
];

export const CATEGORIES = Array.from(new Set(DEMOS.map((d) => d.category)));

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
