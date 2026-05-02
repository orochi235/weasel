import type { ComponentType } from 'react';
import { MoveDemo, MOVE_DEMO_SOURCE } from './demos/MoveDemo';
import { ResizeDemo, RESIZE_DEMO_SOURCE } from './demos/ResizeDemo';
import { InsertDemo, INSERT_DEMO_SOURCE } from './demos/InsertDemo';
import { CloneDemo, CLONE_DEMO_SOURCE } from './demos/CloneDemo';
import { ComposeDemo, COMPOSE_DEMO_SOURCE } from './demos/ComposeDemo';
import { ActionsDemo, ACTIONS_DEMO_SOURCE } from './demos/ActionsDemo';
import { GroupsDemo, GROUPS_DEMO_SOURCE } from './demos/GroupsDemo';
import { NestedGroupsDemo, NESTED_GROUPS_DEMO_SOURCE } from './demos/NestedGroupsDemo';
import { TextDemo, TEXT_DEMO_SOURCE } from './demos/TextDemo';
import { PixelArtDemo, PIXEL_ART_DEMO_SOURCE } from './demos/PixelArtDemo';
import { QuadtreeDemo, QUADTREE_DEMO_SOURCE } from './demos/QuadtreeDemo';

import MoveDemoFull from './demos/MoveDemo.tsx?raw';
import ResizeDemoFull from './demos/ResizeDemo.tsx?raw';
import InsertDemoFull from './demos/InsertDemo.tsx?raw';
import CloneDemoFull from './demos/CloneDemo.tsx?raw';
import ComposeDemoFull from './demos/ComposeDemo.tsx?raw';
import ActionsDemoFull from './demos/ActionsDemo.tsx?raw';
import GroupsDemoFull from './demos/GroupsDemo.tsx?raw';
import NestedGroupsDemoFull from './demos/NestedGroupsDemo.tsx?raw';
import TextDemoFull from './demos/TextDemo.tsx?raw';
import PixelArtDemoFull from './demos/PixelArtDemo.tsx?raw';
import QuadtreeDemoFull from './demos/QuadtreeDemo.tsx?raw';

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
    id: 'move',
    title: 'Move',
    category: 'Interactions',
    description: 'useMoveInteraction with a grid-snap behavior — drag any rectangle and watch it snap to the 20-unit grid.',
    hint: 'Drag a rectangle.',
    Component: MoveDemo,
    snippet: MOVE_DEMO_SOURCE,
    full: MoveDemoFull,
    path: 'demo/demos/MoveDemo.tsx',
  },
  {
    id: 'resize',
    title: 'Resize',
    category: 'Interactions',
    description: 'useResizeInteraction — grab one of the four corner handles to resize the rectangle from the opposite anchor.',
    hint: 'Drag a corner handle.',
    Component: ResizeDemo,
    snippet: RESIZE_DEMO_SOURCE,
    full: ResizeDemoFull,
    path: 'demo/demos/ResizeDemo.tsx',
  },
  {
    id: 'insert',
    title: 'Insert',
    category: 'Interactions',
    description: 'useInsertInteraction — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter.',
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
    description: 'useCloneInteraction with the cloneByAltDrag behavior — hold Alt and drag a rectangle to duplicate it at the drop point.',
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
    description: 'createTextLayer + useTextEditInteraction + createSetTextOp, composed with useMoveInteraction, useResizeInteraction, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit at the clicked glyph (caretIndexAt resolves the click to a character offset and seeds the contenteditable caret); commits flow through createSetTextOp so they\'re undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette.',
    hint: 'Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels.',
    Component: TextDemo,
    snippet: TEXT_DEMO_SOURCE,
    full: TextDemoFull,
    path: 'demo/demos/TextDemo.tsx',
  },
  {
    id: 'actions',
    title: 'Actions',
    category: 'Selection & actions',
    description: 'Four selection-driven action hooks — useEscapeAction, useSelectAllAction, useDuplicateAction, useNudgeAction — wired with their default keybindings. Click the canvas to focus, then try the shortcuts.',
    hint: 'Click to select, then press Esc / Cmd-A / Cmd-D / arrows.',
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
    description: 'Real parent/child hierarchy via setParent. Poses are local to the direct parent; the kit composes world poses via worldPoseLookup for hit-testing and selection overlays. useNestedGroupAction (Mod+G) wraps the selection in a new parent node and rebases children\'s locals so their visual world position is preserved; useNestedUngroupAction (Mod+Shift+G) reparents children back to the grandparent. Dragging a parent auto-cascades its descendants in the live overlay so children visually follow during the drag (no extra ops — under local-pose semantics the post-commit scene is already correct). Mod+Z / Mod+Shift+Z undo and redo.',
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
    description: 'A demo-local quadtree slotted into runLayers as a custom RenderLayer alongside weasel\'s stock layers (grid, selection overlay). The tree subdivides where rect AABBs overlap a cell; during a drag or resize, the active overlay pose is folded back into the input rects so the tree recomputes against the in-flight scene rather than the committed one.',
    hint: 'Click to select, drag to move, drag a corner to resize. Watch the cyan cells subdivide live.',
    Component: QuadtreeDemo,
    snippet: QUADTREE_DEMO_SOURCE,
    full: QuadtreeDemoFull,
    path: 'demo/demos/QuadtreeDemo.tsx',
  },
  {
    id: 'pixel-art',
    title: 'Pixel art',
    category: 'Rendering',
    description: 'Side-by-side: useFixedPixelRatio() pins the dpr to 1 so the backing store matches CSS pixels exactly. The default (window.devicePixelRatio) is the right pick for most demos — but for pixel art, putImageData/getImageData workflows, and hairline alignment, a fixed 1:1 ratio keeps every world pixel landing on one backing pixel.',
    Component: PixelArtDemo,
    snippet: PIXEL_ART_DEMO_SOURCE,
    full: PixelArtDemoFull,
    path: 'demo/demos/PixelArtDemo.tsx',
  },
];

export const CATEGORIES = Array.from(new Set(DEMOS.map((d) => d.category)));

export const DEMOS_BY_ID = new Map(DEMOS.map((d) => [d.id, d]));
