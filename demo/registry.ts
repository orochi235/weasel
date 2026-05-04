import type { ComponentType } from 'react';
import { MoveDemo, MOVE_DEMO_SOURCE } from './demos/MoveDemo';
import { ResizeDemo, RESIZE_DEMO_SOURCE } from './demos/ResizeDemo';
import { RotateDemo, ROTATE_DEMO_SOURCE } from './demos/RotateDemo';
import { MultiSelectDemo, MULTI_SELECT_DEMO_SOURCE } from './demos/MultiSelectDemo';
import { InsertDemo, INSERT_DEMO_SOURCE } from './demos/InsertDemo';
import { CloneDemo, CLONE_DEMO_SOURCE } from './demos/CloneDemo';
import { ComposeDemo, COMPOSE_DEMO_SOURCE } from './demos/ComposeDemo';
import { ActionsDemo, ACTIONS_DEMO_SOURCE } from './demos/ActionsDemo';
import { GroupsDemo, GROUPS_DEMO_SOURCE } from './demos/GroupsDemo';
import { NestedGroupsDemo, NESTED_GROUPS_DEMO_SOURCE } from './demos/NestedGroupsDemo';
import { TextDemo, TEXT_DEMO_SOURCE } from './demos/TextDemo';
import { PixelDensityDemo, PIXEL_DENSITY_DEMO_SOURCE } from './demos/PixelDensityDemo';
import { QuadtreeDemo, QUADTREE_DEMO_SOURCE } from './demos/QuadtreeDemo';
import { PathPoseDemo, PATH_POSE_DEMO_SOURCE } from './demos/PathPoseDemo';
import { CompoundPathsDemo, COMPOUND_PATHS_DEMO_SOURCE } from './demos/CompoundPathsDemo';
import { BezierEditDemo, BEZIER_EDIT_DEMO_SOURCE } from './demos/BezierEditDemo';
import { SceneDemo, SCENE_DEMO_SOURCE } from './demos/SceneDemo';
import { PanDemo, PAN_DEMO_SOURCE } from './demos/PanDemo';
import { ZoomDemo, ZOOM_DEMO_SOURCE } from './demos/ZoomDemo';
import { SwillustratorDemo, SWILLUSTRATOR_DEMO_SOURCE } from './demos/SwillustratorDemo';
import { AnimationDemo, ANIMATION_DEMO_SOURCE } from './demos/AnimationDemo';
import { LayoutDemo, LAYOUT_DEMO_SOURCE } from './demos/LayoutDemo';

import MoveDemoFull from './demos/MoveDemo.tsx?raw';
import ResizeDemoFull from './demos/ResizeDemo.tsx?raw';
import RotateDemoFull from './demos/RotateDemo.tsx?raw';
import MultiSelectDemoFull from './demos/MultiSelectDemo.tsx?raw';
import InsertDemoFull from './demos/InsertDemo.tsx?raw';
import CloneDemoFull from './demos/CloneDemo.tsx?raw';
import ComposeDemoFull from './demos/ComposeDemo.tsx?raw';
import ActionsDemoFull from './demos/ActionsDemo.tsx?raw';
import GroupsDemoFull from './demos/GroupsDemo.tsx?raw';
import NestedGroupsDemoFull from './demos/NestedGroupsDemo.tsx?raw';
import TextDemoFull from './demos/TextDemo.tsx?raw';
import PixelDensityDemoFull from './demos/PixelDensityDemo.tsx?raw';
import QuadtreeDemoFull from './demos/QuadtreeDemo.tsx?raw';
import PathPoseDemoFull from './demos/PathPoseDemo.tsx?raw';
import CompoundPathsDemoFull from './demos/CompoundPathsDemo.tsx?raw';
import BezierEditDemoFull from './demos/BezierEditDemo.tsx?raw';
import SceneDemoFull from './demos/SceneDemo.tsx?raw';
import PanDemoFull from './demos/PanDemo.tsx?raw';
import ZoomDemoFull from './demos/ZoomDemo.tsx?raw';
import SwillustratorDemoFull from './demos/SwillustratorDemo.tsx?raw';
import AnimationDemoFull from './demos/AnimationDemo.tsx?raw';
import LayoutDemoFull from './demos/LayoutDemo.tsx?raw';

export interface DemoEntry {
  id: string;
  title: string;
  category: string;
  description: string;
  hint?: string;
  Component: ComponentType;
  /** Curated highlight: the call sites that matter, hand-picked. */
  snippet: string;
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
    snippet: SCENE_DEMO_SOURCE,
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
    snippet: MOVE_DEMO_SOURCE,
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
    snippet: ANIMATION_DEMO_SOURCE,
    full: AnimationDemoFull,
    path: 'demo/demos/AnimationDemo.tsx',
  },
  {
    id: 'layout',
    title: 'Layout',
    category: 'Interactions',
    description: 'Three containers side by side, one per layout strategy — freeform (absolute placement), tileGrid (2x2 cells), and snapPoint (corner snapping). All three share a single adapter and one useSelectTool. Dragging a child within its container exercises the in-container layout (cell swap, corner snap); dragging across containers reflows both sides via the layout-aware move pass.',
    hint: 'Drag a child rect within its container or into another to see layout-driven reflow.',
    Component: LayoutDemo,
    snippet: LAYOUT_DEMO_SOURCE,
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
    snippet: RESIZE_DEMO_SOURCE,
    full: ResizeDemoFull,
    path: 'demo/demos/ResizeDemo.tsx',
  },
  {
    id: 'rotate',
    title: 'Rotate',
    category: 'Interactions',
    description: 'useRotate — drag the rotation handle (above the top-center of the bounding box) to rotate the object around its AABB center. Body-drag still moves; corner handles still resize. v1 limitation: corner-resize on a rotated object operates against the AABB, so the resize math feels off until released — fixing resize-in-rotated-frame is deferred.',
    hint: 'Click a rect to select; drag the small handle above it to rotate.',
    Component: RotateDemo,
    snippet: ROTATE_DEMO_SOURCE,
    full: RotateDemoFull,
    path: 'demo/demos/RotateDemo.tsx',
  },
  {
    id: 'insert',
    title: 'Insert',
    category: 'Interactions',
    description: 'useInsert — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
    hint: 'Drag on empty space to draw.',
    Component: InsertDemo,
    snippet: INSERT_DEMO_SOURCE,
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
    snippet: CLONE_DEMO_SOURCE,
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
    snippet: TEXT_DEMO_SOURCE,
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
    snippet: MULTI_SELECT_DEMO_SOURCE,
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
    snippet: ACTIONS_DEMO_SOURCE,
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
    snippet: GROUPS_DEMO_SOURCE,
    full: GroupsDemoFull,
    path: 'demo/demos/GroupsDemo.tsx',
  },
  {
    id: 'nested-groups',
    title: 'Nested groups',
    category: 'Groups',
    description: 'Real parent/child hierarchy via setParent. Poses are local to the direct parent; the kit composes world poses via worldPoseLookup for hit-testing and selection overlays. useNestedGroup (Mod+G) wraps the selection in a new parent node and rebases children\'s locals so their visual world position is preserved; useNestedUngroup (Mod+Shift+G) reparents children back to the grandparent. Dragging a parent auto-cascades its descendants in the live overlay so children visually follow during the drag (no extra ops — under local-pose semantics the post-commit scene is already correct). Mod+Z / Mod+Shift+Z undo and redo.',
    hint: 'Click a green rect to grab the whole group; drag and watch its children follow. Select two free rects and press Cmd+G to group them; Cmd+Shift+G to ungroup.',
    Component: NestedGroupsDemo,
    snippet: NESTED_GROUPS_DEMO_SOURCE,
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
    snippet: COMPOSE_DEMO_SOURCE,
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
    snippet: QUADTREE_DEMO_SOURCE,
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
    snippet: PATH_POSE_DEMO_SOURCE,
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
    snippet: COMPOUND_PATHS_DEMO_SOURCE,
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
    snippet: BEZIER_EDIT_DEMO_SOURCE,
    full: BezierEditDemoFull,
    path: 'demo/demos/BezierEditDemo.tsx',
  },
  {
    id: 'pixel-density',
    title: 'Pixel density',
    category: 'Rendering',
    description: 'Side-by-side: useFixedPixelRatio() pins the dpr to 1 so the backing store matches CSS pixels exactly. The default (window.devicePixelRatio) is the right pick for most demos — but for pixel art, putImageData/getImageData workflows, and hairline alignment, a fixed 1:1 ratio keeps every world pixel landing on one backing pixel.',
    Component: PixelDensityDemo,
    snippet: PIXEL_DENSITY_DEMO_SOURCE,
    full: PixelDensityDemoFull,
    path: 'demo/demos/PixelDensityDemo.tsx',
  },
  {
    id: 'zoom',
    title: 'Zoom (Phase 2c)',
    category: 'Viewport',
    description: 'Three opt-in always-on tools wired alongside select + hand: useWheelZoomTool (ctrl/meta+wheel zooms about the cursor), useWheelPanTool (plain wheel pans), useKeyboardZoomTool (Cmd+= / Cmd+- / Cmd+0). Selection-overlay handles, marquee, and insert overlays now live in screen space, so chrome stays at fixed pixel size under zoom. The two demo rects show the trade-off in scene strokes: the green rect divides lineWidth by view.scale (screen-pinned, looks the same at every zoom); the purple rect uses a plain world-px stroke (grows and shrinks with zoom).',
    hint: 'ctrl/⌘+wheel zoom · plain wheel pan · ⌘+= / ⌘+- / ⌘+0 · H drag · space drag.',
    Component: ZoomDemo,
    snippet: ZOOM_DEMO_SOURCE,
    full: ZoomDemoFull,
    path: 'demo/demos/ZoomDemo.tsx',
  },
  {
    id: 'swillustrator',
    title: 'Swillustrator',
    category: 'Tools',
    description: 'Forcing demo for the Tool primitive — four tools across every active-slot pattern: useSelectTool (default), useInsertTool (drag-to-create rect), useTextTool (click-to-create text), useHandTool (active via H, modifier-slot via space). Three always-on viewport tools (useWheelZoomTool, useWheelPanTool, useKeyboardZoomTool) round it out. The palette buttons read tools.modifierEngaged ?? tools.active to highlight the engaged tool — including the momentary hand-while-space state. Scene is a discriminated union { kind: "rect" | "text" }; rects render via the scene drawOne, text nodes via createTextLayer.',
    hint: 'V = select · R = rect · T = text (click) · H = hand · hold space = momentary hand · ⌘+wheel zoom · plain wheel pan',
    Component: SwillustratorDemo,
    snippet: SWILLUSTRATOR_DEMO_SOURCE,
    full: SwillustratorDemoFull,
    path: 'demo/demos/SwillustratorDemo.tsx',
  },
  {
    id: 'pan',
    title: 'Pan (Phase 2b)',
    category: 'Viewport',
    description: 'useHandTool wired with <Canvas view={...} onViewChange={...}>. Three rectangles spread across a coordinate range larger than the 400×300 viewport. H switches to the hand tool (sticky); space engages it momentarily. Drag to pan. The select tool remains available when neither hand activation is engaged.',
    hint: 'H = hand tool · hold space = momentary hand · drag to pan · Reset view to return home.',
    Component: PanDemo,
    snippet: PAN_DEMO_SOURCE,
    full: PanDemoFull,
    path: 'demo/demos/PanDemo.tsx',
  },
];

export const CATEGORIES = Array.from(new Set(DEMOS.map((d) => d.category)));

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
