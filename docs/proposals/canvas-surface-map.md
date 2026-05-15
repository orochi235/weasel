# `<Canvas>` surface map

Status: notes / pre-design. Goal is to enumerate the current `<Canvas>` prop
surface, group it into natural categories, and see whether the resulting
shape suggests organizing principles for *future* surface — particularly the
Tools-as-primitive work and the interaction-channels substrate underneath
it.

This is a working doc. Not a redesign proposal.

## Method

Read every prop on `CanvasProps<TNode, TPose>` (Canvas.tsx:231), bin it
by the question it answers from the consumer's POV, look for patterns.
Where a prop straddles two bins, note it — those are the seams worth
investigating.

## The surface, grouped

### 1. Sizing / DOM

The canvas-as-an-element knobs.

- `width`, `height` — CSS-pixel dimensions.
- `background` — fill color.
- `className`, `style` — DOM passthrough.
- `tabIndex` — keyboard focusability.
- `autoFocusOnPointerDown` — convenience for keyboard-driven canvases.

### 2. Scene — what's on the canvas

Two mutually exclusive paths into "what objects exist."

- **Explicit adapter:** `adapter` (Move + Resize + Rotate + partial
  Insert + partial AreaSelect).
- **Inline items shorthand:** `items`, `setItems`, `toPose`, `fromPose`,
  `createDefault`, `poseBounds`, `intersectsRect`. Synthesized into an
  `arrayAdapter` internally when `adapter` is omitted.

### 3. Geometry — how to interpret a pose

Domain-agnostic functions over `TPose`.

- `geometry: PoseDescriptor<TPose>` — bounds / translate / remap-on-resize
  / intersectsRect. Drives default `hitBody`, `boundsOf`, and the
  selection-overlay bounds source.

Note: `poseBounds` and `intersectsRect` *also* appear on the items branch
(§2). That's the first seam — geometry-shaped functions live in two
places depending on which scene path you took.

### 4. Rendering

- `layers: LayersMap` — slot-based layer composition (scene slot,
  selection-overlay slot, custom layers, etc.).

### 5. Selection

- `selectionMode` — `'single' | 'multi'`.
- `selection` — externally-controlled `SelectionApi` (escape hatch from
  the internal `useSelection`).
- `selectionOptions` — config for the internal `useSelection`.

### 6. Interaction — empty-space tool

- `tool: 'select' | 'insert' | 'none'` — what an empty-space drag means.
  Default `'none'`. This is the primitive the Tools-as-first-class TODO
  is unblocking.

### 7. Interaction — gesture controllers + their configs

Per-gesture controllers (replace the internal hook entirely) plus options
(configure the internal hook).

- `move` / `moveOptions`
- `resize` / `resizeOptions`
- `rotate` / `rotateOptions`
- `insert` / `insertOptions`
- `areaSelect` / `areaSelectOptions`
- `editAnchors` (boolean | options) + `editAnchorsController`

### 8. Interaction — gesture wiring overrides

Plug-in points one layer below "swap the whole controller." These are
where the gesture pipeline asks the consumer "given this id / this point,
what?" — they let domain code answer without rewriting a hook.

- `hitBody` — pointer → id (or ids).
- `resizeTarget` / `rotateTarget` — selection → resize/rotate target.
- `boundsOf` — id → bounds.
- `rotationHandleDistance` — handle placement.
- `onBodyHit`, `onTapEmpty` — synchronous taps before gesture dispatch.
- `clientToWorld` — coordinate transform (would also be the zoom integration
  seam — see TODO).
- `handleHitRadius` — selection-handle hit radius.

### 9. Interaction — keyboard actions

The opt-in keyboard-driven actions.

- `gestures: { delete, nudge, duplicate, undoRedo }` — each entry is
  `boolean | { ...config }` (except `duplicate`, which always needs a
  `cloneNode`, and `undoRedo`, which always needs an `adapter`).

### 10. Interaction — per-event escape hatches

Replace the auto-built handler entirely.

- `onPointerDown`, `onPointerMove`, `onPointerUp`, `onPointerCancel`.

### 11. Observability

- `helpersRef` — overlay-aware `getEffectivePose` / `getEffectiveBounds`
  for custom layers that need to react to in-flight gestures.

## What the grouping reveals

**Real categories.** The surface naturally clusters into five top-level
concerns, not eleven:

```
Canvas
├── element       — sizing + DOM passthrough (§1)
├── scene         — what objects exist + how to interpret their poses (§2 + §3)
├── render        — layers + visuals already-on-element (§4)
├── interaction   — pointer/keyboard/tool dispatch (§6, §7, §8, §9, §10)
└── observability — read-only access to internal overlay state (§11)

selection sits awkwardly: it's both *interaction* (hooks read it) and
*scene* (consumers read it back). Today it's a peer of everything; it
probably wants to be a sub-concern of scene, with `selectionMode` as
an interaction-side knob.
```

**The interaction sub-tree is where almost all the surface lives** — six
of the eleven groups, and the most expansion pressure (Tools-as-primitive
will add to it). It also has the most overlap: `tool` (§6), gesture
controllers (§7), gesture overrides (§8), keyboard actions (§9), and raw
event handlers (§10) are five different ways to influence "what happens
when the user does X." That overlap is exactly what the
"interaction channels" substrate is meant to clean up — see TODO under
"Tools as a first-class primitive."

**Seams worth naming.**

1. **Geometry duplication** — `poseBounds` / `intersectsRect` on the
   items branch (§2) duplicate the `PoseDescriptor` interface (§3). The
   items shorthand could just take `geometry?: PoseDescriptor<TPose>`
   instead of unbundling two of its methods. *Cheap fix; orthogonal to
   the Tools work.*
2. **Override granularity ladder** — for each gesture, the consumer can
   override at three levels:
   - Configure the built-in (`moveOptions`, `gestures.delete`)
   - Replace the controller (`move`, `editAnchorsController`)
   - Replace the raw event handler (`onPointerDown`)
   No prop names communicate this ladder; consumers discover it by
   reading the type. *Documentation-shaped problem, not a surface bug —
   but it's the kind of thing a unified interaction model could make
   self-evident.*
3. **`clientToWorld` is one prop carrying two unrelated jobs** — today
   it's a coord transform escape hatch; under view-transform integration
   (TODO) it becomes the zoom seam. Worth flagging; not worth fixing
   pre-emptively.

## Use as input to Tools-as-primitive

The interaction sub-tree's overlap (§6 + §7 + §8 + §9 + §10) is the
strongest argument for the substrate. If we factor "interaction channels"
(pointer / drag / keyboard / wheel) out as the primitive, the current
surface re-expresses as:

- A channel registry (kit-owned dispatch).
- A `Tool` registers handlers per channel; the kit picks the active tool.
- Today's `tool` enum becomes a built-in tool registry.
- Today's gesture controllers (`move`, `resize`, `rotate`, `insert`,
  `areaSelect`, `editAnchors`) are tools that bundle pointer + drag +
  keyboard handlers.
- Today's `gestures.{delete, nudge, duplicate, undoRedo}` are
  selection-scoped keyboard tools.
- Today's `onPointerDown` / etc. become the "raw channel" escape hatch
  with the rest of dispatch turned off.

That's a unifying story, not a sketch yet. The next step (when we pick
this up) is to draft the channel interface against two concrete tools —
e.g. `select` and a hypothetical `pen` — and see whether the
abstraction holds without strain.

## Prospective type — categories as option bags

Sketch only. This is what `CanvasProps` would look like if the five
categories above were promoted from "groups in a docstring" to actual
nested option bags. Names and shapes are deliberately conservative —
the goal is to show the *organization*, not redesign individual props.

The current flat surface stays as a sugar layer on top (or as a
deprecated alias) so the migration is mechanical.

```ts
export interface CanvasProps<TNode extends { id: string } = { id: string }, TPose = unknown> {
  // -----------------------------------------------------------------
  // 1. element — sizing + DOM passthrough
  // -----------------------------------------------------------------
  element: {
    width: number;
    height: number;
    background?: string;
    className?: string;
    style?: React.CSSProperties;
    tabIndex?: number;
    autoFocusOnPointerDown?: boolean;
  };

  // -----------------------------------------------------------------
  // 2. scene — what objects exist + how their poses are interpreted
  // -----------------------------------------------------------------
  scene: SceneSource<TNode, TPose> & {
    /** PoseDescriptor — bounds / translate / remap-on-resize / intersectsRect.
     *  Subsumes the existing `poseBounds` + `intersectsRect` on the items
     *  shorthand (seam #1). */
    geometry?: PoseDescriptor<TPose>;

    /** Selection state lives with scene because consumers read it back —
     *  but the *mode* (single/multi, marquee semantics) is interaction
     *  config (see below). */
    selection?: {
      api?: SelectionApi;                // external control
      options?: UseSelectionOptions;     // configure internal useSelection
    };
  };

  // -----------------------------------------------------------------
  // 3. render — layers + visuals that aren't on the element
  // -----------------------------------------------------------------
  render: {
    layers: LayersMap<TNode, TPose>;
  };

  // -----------------------------------------------------------------
  // 4. interaction — pointer/keyboard/tool dispatch
  // -----------------------------------------------------------------
  //
  // Today this is five overlapping fields (`tool`, gesture controllers,
  // gesture overrides, keyboard actions, raw handlers). Grouped here by
  // *what the consumer is overriding*, not by which hook serves it.
  // Tools-as-primitive will eventually fold most of `gestures` and `tool`
  // into a `tools` registry — this shape leaves room for that without
  // pre-committing.
  interaction?: {
    /** Empty-space tool. `'none'` (default), `'select'`, `'insert'`. */
    tool?: 'select' | 'insert' | 'none';

    /** Selection semantics. */
    selectionMode?: CanvasSelectionMode;

    /** Per-gesture controllers + their config. Each entry is either:
     *    - omitted (use the kit default)
     *    - `{ options }` (configure the default hook)
     *    - `{ controller }` (replace the hook entirely)
     *    - `{ controller, options }` (replace + configure) */
    move?: GestureSlot<MoveController<TNode, TPose>, UseMoveOptions<TPose>>;
    resize?: GestureSlot<ResizeController<TNode, TPose>, UseResizeOptions<TPose>>;
    rotate?: GestureSlot<RotateController<TNode, TPose>, UseRotateOptions<TPose>>;
    insert?: GestureSlot<InsertController<TNode, TPose>, UseInsertOptions<TPose>>;
    areaSelect?: GestureSlot<AreaSelectController, UseAreaSelectOptions>;
    editAnchors?: GestureSlot<EditAnchorsController<TNode>, UseEditAnchorsOptions>
      | boolean;

    /** Pipeline-level wiring — answers the kit asks of the domain mid-gesture.
     *  Lives one level below "swap the controller." */
    wiring?: {
      hitBody?: (worldX: number, worldY: number) => string | string[] | null;
      resizeTarget?: () => { id: string; bounds: Bounds } | null;
      rotateTarget?: () => { id: string; bounds: Bounds; rotation?: number } | null;
      boundsOf?: (id: string) => Bounds | null;
      onBodyHit?: (ids: string[], ctx: PointerGestureCallbackCtx) => void;
      onTapEmpty?: (ctx: PointerGestureCallbackCtx) => void;
      clientToWorld?: (canvas: HTMLCanvasElement, cx: number, cy: number) => [number, number];
      handleHitRadius?: number;
      rotationHandleDistance?: number;
    };

    /** Keyboard-driven actions wired against effective selection. */
    keyboard?: {
      delete?: boolean | DeleteGestureConfig;
      nudge?: boolean | NudgeGestureConfig<TPose>;
      duplicate?: DuplicateGestureConfig;
      undoRedo?: UndoRedoGestureConfig;
    };

    /** Raw-event escape hatches — replace the auto-built handler entirely. */
    rawEvents?: {
      onPointerDown?: React.PointerEventHandler<HTMLCanvasElement>;
      onPointerMove?: React.PointerEventHandler<HTMLCanvasElement>;
      onPointerUp?: React.PointerEventHandler<HTMLCanvasElement>;
      onPointerCancel?: React.PointerEventHandler<HTMLCanvasElement>;
    };
  };

  // -----------------------------------------------------------------
  // 5. observability — read-only access to internal state
  // -----------------------------------------------------------------
  observability?: {
    /** Mutable ref the Canvas writes overlay-aware lookups into each render. */
    helpersRef?: React.MutableRefObject<CanvasHelpers<TPose> | null>;
  };
}

/** Either an explicit adapter or the inline-items shorthand. */
export type SceneSource<TNode extends { id: string }, TPose> =
  | {
      adapter: MoveAdapter<TNode, TPose>
        & ResizeAdapter<TNode, TPose>
        & RotateAdapter<TNode, TPose>
        & Partial<InsertAdapter<TNode>>
        & Partial<AreaSelectAdapter>;
      items?: never;
    }
  | {
      adapter?: never;
      items: TNode[];
      setItems: UseArrayAdapterOptions<TNode, TPose>['setItems'];
      toPose: UseArrayAdapterOptions<TNode, TPose>['toPose'];
      fromPose?: UseArrayAdapterOptions<TNode, TPose>['fromPose'];
      createDefault?: UseArrayAdapterOptions<TNode, TPose>['createDefault'];
      // poseBounds + intersectsRect dropped — supplied via scene.geometry instead.
    };

/** The three-level override ladder, made syntactically obvious. */
export interface GestureSlot<TController, TOptions> {
  controller?: TController;  // replace the hook entirely
  options?: TOptions;        // configure the default hook
}
```

### What this organization makes obvious

- **The override ladder** (seam #2) is now visible at the type level —
  `GestureSlot<C, O>` makes "swap controller vs configure default vs do
  both" a single readable shape instead of two parallel props per
  gesture.
- **Geometry duplication** (seam #1) goes away — `scene.geometry` is the
  single home for `PoseDescriptor`-shaped functions.
- **Selection's split nature** is named: `scene.selection` for the *what*
  (state, external control), `interaction.selectionMode` for the *how*
  (single vs multi behavior).
- **Future Tools-as-primitive surface has an obvious home** —
  `interaction.tools?: ToolRegistry` slots in alongside the existing
  fields without forcing a flat-prop renaming churn.

### What it punts on

- Doesn't redesign individual gesture controller/options shapes — just
  re-buckets them.
- Doesn't address the `clientToWorld` dual-job (seam #3) — that needs the
  view-transform integration to land first.
- Doesn't propose deprecation paths for the current flat props. If we
  pick this up, the practical move is probably "ship the nested shape
  alongside the flat one, mark flat as deprecated, swap demos, delete
  flat."

## Opt-in behavior is the unifying principle

Pulling on the substrate work above: almost every kit feature beyond
"draw the scene" is a *behavior* the consumer should explicitly turn
on. Today this is partly true (the `useFoo` hooks are opt-in by
construction) but inconsistently expressed — some live as hook calls,
some as Canvas props, some as defaults that *only* turn off via a
non-obvious flag.

Below is the full list of kit-shipped behaviors organized by what
event/lifecycle they bind to. Each entry is opt-in today via *some*
mechanism; the design question is whether they should all migrate to
one uniform surface.

**Selection-scoped keyboard behaviors** (today: hook calls + the new
`gestures.{delete,nudge,duplicate,undoRedo}`):

- `delete` — Delete/Backspace removes selection.
- `nudge` — arrow keys translate selection (shift = larger step).
- `duplicate` — Mod+D clones selection.
- `undoRedo` — Mod+Z / Mod+Shift+Z.
- `escape` — Esc clears selection. (`useEscape`)
- `selectAll` — Mod+A. (`useSelectAll`)
- `clipboard` — Mod+X / Mod+C / Mod+V. (`useClipboard`)
- `reorder` — Mod+] / Mod+\[ / Mod+Shift+] / Mod+Shift+\[. (`useReorder`)
- `group` — Mod+G groups selection. (`useGroup` / `useNest`)
- `ungroup` — Mod+Shift+G ungroups selection. (`useUngroup` /
  `useUnnest`)

**Pointer/drag behaviors** (today: a mix of `tool=` defaults, controller
props, and gesture hooks):

- `move` — drag body to translate.
- `resize` — drag handle to remap pose bounds.
- `rotate` — drag rotation handle.
- `marquee` — empty-space drag to area-select (today: `tool='select'`).
- `insert` — empty-space drag to create new object (today:
  `tool='insert'`).
- `editAnchors` — double-click polygon to enter anchor-edit mode.
- `textEdit` — double-click text to enter contenteditable overlay.
  (today: hook call)

**Hover behaviors:**

- `gridCellHover` — pointer-tracked grid cell highlight. (today: hook
  call)

**Currently-defaulted behaviors that probably shouldn't be:**

- **Multi-select union-AABB** is implicit when `selectionMode='multi'`
  and a single resize handle is dragged. The "treat selection as one
  unit for transforms" behavior should be explicit (e.g.
  `interaction.move.cascadeSelection?: boolean` or a dedicated
  `selectionAsGroup` behavior toggle).
- **Rotation handle** appears any time `rotate` is wired. It's already
  toggleable (`selectionOverlay.rotationHandle`) but the default isn't
  obvious.
- **Selection handles** appear by default whenever `resize` is wired.
  Same shape — toggleable but defaulted-on.

### Implication for the prospective type

The `interaction.keyboard` bag in the prospective `CanvasProps` should
be a complete enumeration of selection-scoped keyboard behaviors, not
just the four we've migrated so far. Expanding it:

```ts
interaction?: {
  // ...as before...
  keyboard?: {
    delete?:     boolean | DeleteBehaviorConfig;
    nudge?:      boolean | NudgeBehaviorConfig<TPose>;
    duplicate?:  DuplicateBehaviorConfig;       // requires cloneNode
    undoRedo?:   UndoRedoBehaviorConfig;        // requires adapter
    escape?:     boolean | EscapeBehaviorConfig;
    selectAll?:  boolean | SelectAllBehaviorConfig;
    clipboard?:  ClipboardBehaviorConfig;       // requires (de)serialize
    reorder?:    boolean | ReorderBehaviorConfig;
    group?:      GroupBehaviorConfig;           // requires groupFactory
    ungroup?:    boolean | UngroupBehaviorConfig;
  };
};
```

Pattern: behaviors with no zero-config sensible default (clipboard
needs serialize/deserialize, group needs a factory) take a config object
only; behaviors that work with defaults (delete, nudge, escape) accept
`true | config`. This is the same split the four migrated behaviors
already use.

The pointer/drag behaviors collapse cleaner under the channels
substrate — see `interaction-channels.md`. Each becomes a tool (or part
of `selectTool`), registered through the same `tools` prop a consumer
uses for custom tools. That eliminates the second-class status today's
"built-in tools" have relative to "consumer hooks."

**Net effect:** every kit-shipped behavior becomes a typed,
explicitly-opted-in entry under `interaction.{keyboard, tools, …}`.
No more hook-call vs Canvas-prop split; no more invisible defaults. The
canvas with no `interaction` prop draws the scene and does nothing
else.

## Not addressed here

- The `useScene`-on-Canvas prop (`<SceneCanvas scene={...} />`) — that's
  a wrapper, not a Canvas prop, so it doesn't widen the surface.
- The `tools={[...]}` registry and `activeTool` selector imagined in the
  TODO — those are *future* surface, not current.
