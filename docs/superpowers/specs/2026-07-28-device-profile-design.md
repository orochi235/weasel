# DeviceProfile + long-press — design

Date: 2026-07-28
Status: design, ready to implement.

## Goal

Give the kit a single source of truth for the facts about the device it is
running on — pointer coarseness, hover capability, pixel density — and make
two things read it: the rule layer (so consumers can gate chrome on device)
and the sizing constants (so handles and hit zones are grabbable with a
finger). Add `longPress` as a real gesture kind so touch can reach the
context menu at all.

## Why now

An audit of the current state found:

- **Density is designed.** `useCanvasSize` snapshots `devicePixelRatio`,
  `Canvas` takes a `dpr` prop, `renderSceneToPixels` takes density as a
  parameter with regression tests asserting zero ambient reads. This axis is
  fine. Its one hole: DPR is re-read only when `ResizeObserver` fires, so
  moving a window to a different-density monitor without resizing it leaves
  the snapshot stale.
- **Input modality is partial.** `core/stylus/` is a genuine surface
  (`pointerType`, pressure, tilt, coalesced events, `stylusOnly`). Touch
  gestures exist: `touch-action: none` on drag, multi-pointer centroid/spread
  tracking, `multiTouch` / `multiTouchTap` binding kinds, a real (if
  `@experimental`) `viewport.pinchZoom`.
- **Pointer coarseness and hover capability are absent entirely.** No
  `pointer: coarse`, no `hover: none` anywhere in kit source. Every handle,
  rotation-handle distance, and anchor hit radius is a fixed pixel value
  tuned for a mouse.
- **Long-press does not exist.** `contextMenu` is a gesture kind fired only
  by the DOM `contextmenu` event, so touch can never reach it. `longPress`
  appears twice in the repo, both times as a comment about a hypothetical
  future gesture kind (`interactions/actions/invoker.ts:368`,
  `packages/gestures/src/ui/spec.ts:201`).

Orientation is deliberately *not* part of this. `ResizeObserver` on the host
container already makes a rotation reflow correctly, and "is this portrait"
is one derived boolean at the consumer. A form-factor / "phone mode" concept
is likewise out: that is a chrome-layout decision belonging to the app, not
the engine. The engine's job is to stop assuming a mouse.

## Vocabulary

- **DeviceProfile** — the resolved facts about the current device. One
  object, recomputed on media-query change, read by everything.
- **Target scale** — the multiplier applied to handle sizes and hit radii.
  Derived from `coarsePointer`, not measured.
- **Long-press** — press held past a time threshold without crossing the
  drag threshold. A *gesture* (form of input), per `docs/taxonomy.md` — it is
  not an action and must not be named after one.

## Surface

### `core/device/` (new)

New directory under `packages/core/src/core/`, sibling to `core/stylus/` and
`core/viewport/`. It belongs at that tier because it is an ambient
environment fact; `chrome-caps` is a *consumer* of it, not its owner.

```ts
export interface DeviceProfile {
  /** matchMedia('(pointer: coarse)') — primary pointer is imprecise. */
  readonly coarsePointer: boolean;
  /** matchMedia('(hover: hover)') — primary pointer can hover. */
  readonly canHover: boolean;
  /** Live device pixel ratio. Tracked via a re-armed
   *  matchMedia('(resolution: Xdppx)') listener, so it updates when the
   *  window moves between displays without being resized. */
  readonly dpr: number;
  /** Multiplier for handle sizes and hit radii. Derived:
   *  `coarsePointer ? COARSE_TARGET_SCALE : 1`. */
  readonly targetScale: number;
}

/** 1.75. 8px handle → 14px; 24px rotation distance → 42px. With the
 *  surrounding grab zone counted, that lands in the Apple HIG 44pt /
 *  Material 48dp minimum-touch-target band. Single constant so it is
 *  tunable in one place. */
export const COARSE_TARGET_SCALE = 1.75;

/** Assumed when `matchMedia` is unavailable (SSR, jsdom) and the
 *  absent-means value for `RuleCtx.device`. */
export const DEFAULT_DEVICE_PROFILE: DeviceProfile = {
  coarsePointer: false,
  canHover: true,
  dpr: 1,
  targetScale: 1,
};

export function useDeviceProfile(overrides?: Partial<DeviceProfile>): DeviceProfile;

export const DeviceProfileProvider: React.FC<{
  value?: Partial<DeviceProfile>;
  children: React.ReactNode;
}>;
```

`useDeviceProfile` reads the nearest provider when one exists and falls back
to detecting for itself when unprovided, so a standalone overlay or a labkit
panel outside a `SceneCanvas` still works.

Three listeners: `(pointer: coarse)`, `(hover: hover)`, and a resolution
query re-armed at the new DPR on each change (the resolution query has to be
rebuilt because `(resolution: 2dppx)` stops matching once DPR moves).

### Override seam

```tsx
<SceneCanvas device={{ coarsePointer: true }} />
```

A `Partial<DeviceProfile>` merged over detection, with `targetScale`
re-derived after the merge unless explicitly overridden. This is not a
convenience — it is required for three real cases: tests that need a coarse
profile without stubbing `matchMedia` at every call site, demos that want to
*show* touch chrome on a desktop, and consumers on hybrid devices who know
better than the media query does.

### DPR consolidation

`useCanvasSize` keeps its `CanvasSizeSnapshot` shape (`width`, `height`,
`dpr`) so no consumer changes. It stops reading `window.devicePixelRatio`
inside its `measure()` and takes `dpr` from the profile instead. That fixes
the stale-DPR hole in one place rather than adding a second listener.

### Rule layer

`RuleCtx` gains one optional field:

```ts
export interface RuleCtx {
  // …
  /** Device facts. Absent (legacy ctx builders) is treated as
   *  DEFAULT_DEVICE_PROFILE — fine pointer, can hover, density 1. */
  readonly device?: DeviceProfile;
}
```

Optional-with-a-documented-default matches exactly how `selectionResizable`
and `editingAnchors` were added to this file, and keeps every existing ctx
builder working untouched.

`Selector` gains two keys, plus fluent atoms in `conditions.ts`:

```ts
export interface Selector {
  // …
  /** Matches `ctx.device.coarsePointer`. Absent profile → false. */
  coarsePointer?: boolean;
  /** Matches `ctx.device.canHover`. Absent profile → true. */
  canHover?: boolean;
}
```

`describeRule` needs no change — it is generic over `Selector` keys and will
render `coarsePointer:true` correctly as-is.

**No rule in `defaults.ts` changes.** No shipped default rule uses `hovering` —
the rotation handle gates on `focused`, not hover — so there is nothing in
the kit's own table that should flip on device today. The selectors ship as a
surface for consumers. Adding a default rule here speculatively would be
inventing a requirement.

`SceneCanvas`'s `buildCurrentRuleCtx` attaches `device` alongside `mode` /
`allowedCapabilities` / `selectionResizable` / `editingAnchors`, from the
same profile it provides to context.

### Sizing

`8` is currently written five times as five independent constants, and `24`
once:

| Site | Constant |
| --- | --- |
| `canvas/SceneCanvas.tsx:150` | `DEFAULT_HANDLE_SIZE = 8` |
| `features/selection/overlay.ts:291` | `DEFAULT_HANDLE_SIZE = 8` (separate copy) |
| `affordances/cornerResize.ts:43` | `handleSize = 8` (parameter default) |
| `canvas/affordanceAt.ts:40` | `HANDLE_HIT_RADIUS = 8` |
| `canvas/affordanceAt.ts:44` | `ANCHOR_HIT_RADIUS = 8` |
| `interactions/actions/rotate/handle.ts:6` | `DEFAULT_ROTATION_HANDLE_DISTANCE = 24` |

All become derivations of a single base times `device.targetScale`.

This is the load-bearing part of the change, not incidental tidying. Paint
and hit-test **must** scale together. They currently live in different files
with duplicated literals, and `affordanceAt.ts`'s own comment already admits
its radius merely "mirrors" a constant it cannot see. Scaling one and missing
the other reproduces chrome you can see but cannot grab — the exact failure
`chrome-caps` exists to make impossible by construction.

The base constants move to one new module, `core/device/targets.ts`, holding
`HANDLE_BASE_PX = 8`, `ANCHOR_HIT_BASE_PX = 8`, and
`ROTATION_HANDLE_BASE_PX = 24`. Each site imports the base and applies the
scale at the point of use, since the profile is a runtime value and the
constants are not.

**Public-API constraint.** `DEFAULT_HANDLE_SIZE` is exported from the package
root (`src/index.ts:249`, re-exported from `SceneCanvas`) and
`DEFAULT_ROTATION_HANDLE_DISTANCE` likewise (`src/index.ts:773`). Both keep
their existing export paths and their unscaled values — they become
re-exports of the new bases rather than moving. A consumer importing
`DEFAULT_HANDLE_SIZE` today keeps getting `8`. Only the kit's internal use
sites gain the `targetScale` multiplication, so this is not a breaking
change and does not need a version bump beyond the additive one.

Note that `affordanceAt.ts`'s radii are in **world units** and its existing
comment already flags that they are only correct at `scale = 1`. This change
does not fix that; the scale multiplier composes with whatever view-scale
correction a caller already passes. Conflating the two would be a separate
change.

### Long-press

`packages/gestures/src/ui/spec.ts` gains a member of the `GestureSpec` union:

```ts
/** Press held past the long-press threshold without crossing the drag
 *  threshold. Synthesized by `useGestureDispatcher` from the pointer
 *  stream. Fires for touch and pen only — see the design doc for why
 *  mouse is excluded. */
export interface LongPressSpec {
  kind: 'longPress';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}
```

`packages/gestures/src/grammar/gestures.ts` gains `'longPress'` to
`GestureName` and `{ name: 'longPress', hasTarget: true }` to
`GESTURE_DESCRIPTORS`. `tools/routing/reflection/registry.ts` maps
`longPress: 'longPress'` in `SPEC_KIND_TO_GESTURE`, so the route inspector
reports long-press bindings rather than skipping them.

Dispatcher synthesis in `useGestureDispatcher.tsx`:

```
LONG_PRESS_MS = 500
```

- **Arm** a timer on `pointerdown`, when `e.pointerType` is `'touch'` or
  `'pen'`.
- **Cancel** on: movement past the existing `DRAG_THRESHOLD_PX` (4),
  `pointerup`, `pointercancel`, and a second pointer going down. The last one
  matters — a long-press must never fire mid-pinch.
- **Fire**: build an `InputEvent` of kind `'longpress'` using the same
  `classifyTargetRef.current?.(worldPoint)` call the `contextmenu` path uses,
  so `bodyTarget` / `bodyKind` classification is identical between the two.

**Mouse is excluded by default.** A mouse held still for 500ms is an ordinary
slow click, and conjuring a context menu from it would be a bug. Exposed as a
dispatcher option for anyone who disagrees.

**Fallback to contextmenu.** `dispatch()` already returns `'unhandled'` when
no binding matched. When the long-press dispatch comes back `'unhandled'`,
synthesize the `contextmenu` `InputEvent` at the same point. Every existing
`{ kind: 'contextMenu' }` binding then works under a finger with zero
consumer changes, while `longPress` remains independently bindable for
anything else (long-press an anchor to delete it, long-press a tool for
options).

## Testing

`matchMedia` stubbing has precedent at
`packages/ui/src/components/Toast/queue.test.ts:123`.

Unit coverage for the profile (each query, the SSR/jsdom fallback, override
merging, `targetScale` derivation, the re-armed resolution listener) and for
the two new selectors, including the absent-profile defaults.

The two tests that actually matter:

1. **Paint/hit agreement.** Under a coarse profile, assert the drawn handle
   size and the affordance hit radius derive from the same scaled base. This
   is the regression guard for the sizing consolidation and the reason that
   section exists.
2. **Long-press integration**, modeled on
   `interactions/dispatcher/pinchZoom.integration.test.tsx`: fires at 500ms;
   cancels on drag past threshold; cancels when a second finger lands; does
   not fire for `pointerType: 'mouse'`; falls through to `contextmenu` when
   no `longPress` binding matched; does *not* fall through when one did.

## Out of scope

- **Orientation detection.** `ResizeObserver` already handles rotation
  correctly. The only kit-side question a rotation raises is whether the view
  should auto-refit on aspect flip, which is a `fitViewToBounds` policy
  question and not a device-detection one.
- **Form-factor / "phone mode".** Chrome layout is the app's concern.
- **Two-finger pan.** `pinchZoom` currently zooms about the centroid without
  translating by centroid delta. Real gap, separate change.
- **Haptics and long-press visual feedback.**
- **`apps/draw`.** No consumer changes in this spec.

## Drive-by

`features/chrome-caps/defaults.ts:15-17` still describes the `path-edit.*`
rules as "genuinely mode-specific" — contradicted by lines 66-81 of the same
file and by the package README, both of which record that those rules were
moved off `mode:` onto the `editingAnchors` state selector. Stale comment,
corrected as part of this work.
