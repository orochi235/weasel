import { Card } from './Card';
import { MoveDemo, MOVE_DEMO_SOURCE } from './demos/MoveDemo';
import { ResizeDemo, RESIZE_DEMO_SOURCE } from './demos/ResizeDemo';
import { InsertDemo, INSERT_DEMO_SOURCE } from './demos/InsertDemo';
import { CloneDemo, CLONE_DEMO_SOURCE } from './demos/CloneDemo';
import { ComposeDemo, COMPOSE_DEMO_SOURCE } from './demos/ComposeDemo';
import { ActionsDemo, ACTIONS_DEMO_SOURCE } from './demos/ActionsDemo';
import { GroupsDemo, GROUPS_DEMO_SOURCE } from './demos/GroupsDemo';
import { StructuralGroupsDemo, STRUCTURAL_GROUPS_DEMO_SOURCE } from './demos/StructuralGroupsDemo';
import { TextDemo, TEXT_DEMO_SOURCE } from './demos/TextDemo';
import { PixelArtDemo, PIXEL_ART_DEMO_SOURCE } from './demos/PixelArtDemo';

export function CanvasKitDemo() {
  return (
    <div className="ckd-root">
      <header className="ckd-header">
        <h1>canvas-kit demos</h1>
        <p>
          canvas-kit is a domain-agnostic toolkit of React hooks for building 2D
          drag-and-edit interactions on a canvas. Each card below shows one
          interaction hook driving a tiny in-memory adapter, with the source for
          that demo on the right.
        </p>
        <p>
          <a href="./api/">Browse the API reference →</a>
        </p>
      </header>

      <Card
        title="Move"
        description="useMoveInteraction with a grid-snap behavior — drag any rectangle and watch it snap to the 20-unit grid."
        hint="Drag a rectangle."
        canvas={<MoveDemo />}
        source={MOVE_DEMO_SOURCE}
      />

      <Card
        title="Resize"
        description="useResizeInteraction — grab one of the four corner handles to resize the rectangle from the opposite anchor."
        hint="Drag a corner handle."
        canvas={<ResizeDemo />}
        source={RESIZE_DEMO_SOURCE}
      />

      <Card
        title="Insert"
        description="useInsertInteraction — drag on empty space to draw a new rectangle. Each gesture commits an InsertOp through the adapter."
        hint="Drag on empty space to draw."
        canvas={<InsertDemo />}
        source={INSERT_DEMO_SOURCE}
      />

      <Card
        title="Clone"
        description="useCloneInteraction with the cloneByAltDrag behavior — hold Alt and drag a rectangle to duplicate it at the drop point."
        hint="Hold Alt and drag a rectangle."
        canvas={<CloneDemo />}
        source={CLONE_DEMO_SOURCE}
      />

      <Card
        title="Virtual groups"
        description="A virtual group around three rectangles — a side-record { id, members[] } with no scene-graph hierarchy. Clicking any member selects the whole group; dragging moves all members together; corner handles resize the group's union AABB and scale each member proportionally. Selection overlay uses the optional groupAdapter to draw a single rectangle around the group."
        hint="Click a green rect to select the group, then drag or grab a corner."
        canvas={<GroupsDemo />}
        source={GROUPS_DEMO_SOURCE}
      />

      <Card
        title="Structural groups"
        description="Real parent/child hierarchy via setParent. Poses are local to the direct parent; the kit composes world poses via worldPoseLookup for hit-testing and selection overlays. useStructuralGroupAction (Mod+G) wraps the selection in a new parent node and rebases children's locals so their visual world position is preserved; useStructuralUngroupAction (Mod+Shift+G) reparents children back to the grandparent. Dragging a parent auto-cascades its descendants in the live overlay so children visually follow during the drag (no extra ops — under local-pose semantics the post-commit scene is already correct). Mod+Z / Mod+Shift+Z undo and redo."
        hint="Click a green rect to grab the whole group; drag and watch its children follow. Select two free rects and press Cmd+G to group them; Cmd+Shift+G to ungroup."
        canvas={<StructuralGroupsDemo />}
        source={STRUCTURAL_GROUPS_DEMO_SOURCE}
      />

      <Card
        title="Text"
        description="createTextLayer + useTextEditInteraction + createSetTextOp, composed with useMoveInteraction, useResizeInteraction, and the selection overlay. Click to select, drag the body to move (snaps to a 10-unit grid), drag the bottom-right handle to resize (which re-wraps the text), double-click to edit; commits flow through createSetTextOp so they're undoable. The fourth node demonstrates themed editing — TextStyle.caretColor, selectionBackground, and selectionColor flow through to the contenteditable overlay so the in-place editor matches the canvas palette."
        hint="Click to select, drag to move, drag the bottom-right handle to resize, double-click to edit. Enter commits, Shift+Enter newline, Escape cancels."
        canvas={<TextDemo />}
        source={TEXT_DEMO_SOURCE}
      />

      <Card
        title="Pixel art (useFixedPixelRatio)"
        description="Side-by-side: useFixedPixelRatio() pins the dpr to 1 so the backing store matches CSS pixels exactly. The default (window.devicePixelRatio) is the right pick for most demos — but for pixel art, putImageData/getImageData workflows, and hairline alignment, a fixed 1:1 ratio keeps every world pixel landing on one backing pixel."
        canvas={<PixelArtDemo />}
        source={PIXEL_ART_DEMO_SOURCE}
      />

      <Card
        title="Actions"
        description="Four selection-driven action hooks — useEscapeAction, useSelectAllAction, useDuplicateAction, useNudgeAction — wired with their default keybindings. Click the canvas to focus, then try the shortcuts."
        hint="Click to select, then press Esc / Cmd-A / Cmd-D / arrows."
        canvas={<ActionsDemo />}
        source={ACTIONS_DEMO_SOURCE}
      />

      <Card
        title="Compose"
        description="Four interactions on one scene — move, resize, insert, area-select all share a single adapter and rect list. A pointer-down dispatcher picks which hook owns the gesture; selection is rendered as outlines and resize handles."
        hint="Click a rect to select; drag a handle to resize; drag empty space to marquee-select; switch to Insert mode to draw new rects."
        canvas={<ComposeDemo />}
        source={COMPOSE_DEMO_SOURCE}
      />
    </div>
  );
}
