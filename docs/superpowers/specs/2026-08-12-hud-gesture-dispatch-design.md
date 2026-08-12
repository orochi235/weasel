# Gesture dispatch over HUD elements

A design for `@weasel-js/hud` and the core dispatcher, for whoever implements
the P2 of the same name in `docs/TODO.md`. It answers: how does a HUD widget
receive a double-click, a right-click, a long-press or a wheel, and what
happens to the gestures it doesn't want?

## The problem

A widget can be pressed, dragged and hovered. Nothing else reaches it, and it
has no way to ask.

The gap is not in the HUD. `affordanceAt` runs on `pointerdown` and on hover,
and that is all. `click` and `longpress` work because they *replay* the
affordance recorded at press time; `doubleclick` has that same record in scope
and does not copy it; `contextmenu` never classifies its position, and neither
does `wheel`. So a HUD binding on those kinds has nothing to gate on — the
`{ kindOf: isHudHit }` target that the three working bindings use would never
match.

The same omission is why chrome leaks. The HUD's layer claims **exclusively**,
and `isExclusiveClaim` reads `e.affordance` — so a right-click or a
double-click on a HUD panel sails past the claim filter and acts on the scene
underneath.

## The claim is per gesture kind

`LayerHit.strength: 'exclusive'` today means *this pixel is mine*. Propagating
the affordance to `wheel` under that meaning would silently kill scroll-to-zoom
over every floating panel.

It becomes *these gestures are mine*. A widget declares what it consumes;
everything else falls through to the scene, so a static toolbar keeps letting
the wheel zoom while a scrollable panel can take it.

```ts
// affordances/types.ts
interface LayerHit<TScratch = unknown> extends AffordanceBinding<TScratch> {
  cursor?: string;
  strength?: 'exclusive' | 'shared';
  /** Gesture kinds this claim bars. Undefined bars all — today's meaning. */
  claimedKinds?: readonly GestureKind[];
}

// interactions/dispatcher/matcher.ts
function isExclusiveClaim(e: InputEvent): boolean {
  const c = claimOf(e);
  if (c?.strength !== 'exclusive') return false;
  return c.claimedKinds === undefined || c.claimedKinds.includes(specKindOf(e));
}
```

`claimedKinds` is spelled in the **spec** vocabulary (`'doubleClick'`), not the
`InputEvent` one (`'doubleclick'`), so a consumer writes the same word here as
in the binding it is protecting. `specKindOf` is the mapping; `match.ts`
already carries it implicitly in its switch.

## Four layers

### 1. The affordance reaches four more kinds

All in `useGestureDispatcher.tsx`.

| kind | change |
|---|---|
| `doubleclick` | copy `down.affordance` — the record is in scope where the event is built |
| `contextmenu`, real right-click | call `affordanceAt({ x: clientX, y: clientY })` as `onPointerDown` does. A right button returns early from `onPointerDown`, so there is no press to replay from |
| `contextmenu`, long-press fallback | replay `down.affordance` into `fireLongPress`'s re-dispatch |
| `wheel` | call `affordanceAt` and `classifyTarget` at the wheel position |

Both existing call sites pass client coordinates despite one being named
`worldPoint`; `<SceneCanvas>` converts internally. The new call sites match.

`longpress` already carries the affordance.

### 2. `wheel` gains a target

`WheelSpec` has no `target` field, so no wheel binding can gate on anything.

- `target?: TargetSpec` on `WheelSpec` (`gestures/src/ui/spec.ts`)
- the `matchTarget` call in `match.ts`'s `case 'wheel'`
- `hasTarget: true` in `grammar/gestures.ts`, so route strings can name it

### 3. The claim carries the kinds

`claimedKinds` flows `LayerHit` → `AffordanceHit` through `buildAffordanceAt`,
the path `strength` and `cursor` already take, and the matcher consults it as
above.

### 4. The widget protocol

```ts
// packages/hud/src/widget.ts
type HudGestureKind = 'pointer' | 'doubleClick' | 'contextMenu' | 'longPress' | 'wheel';

interface Widget {
  /** What this widget consumes. Default: every kind but 'wheel'. `[]` is
   *  decoration — the hit-test walk descends past it. */
  readonly claims?: readonly HudGestureKind[];
  onPointer(evt: HudPointerEvent): void;
  // …
}
```

`'pointer'` covers `pointerDown` / `click` / `drag` as one token. They are a
single down/move/up protocol, not three independent claims.

The default set is everything but `wheel`: chrome stops leaking right-clicks
and double-clicks to the scene, which is what chrome should do, while
scroll-to-zoom over a panel behaves exactly as it does today. Nothing existing
regresses.

`HudPointerEvent` gains four arms — `doubleclick`, `contextmenu` and
`longpress` carrying `x` / `y` / `native`, and `wheel` adding `deltaX` /
`deltaY`.

`attach.ts` carries the hit widget's set onto the claim. `tool.ts` gains an
action and a binding per kind, each gated on `isHudHit` **and** the claim set.
That second half is load-bearing: a widget that doesn't claim `wheel` leaves
the claim non-exclusive for it, which puts `viewport.zoom` and the HUD's own
wheel binding in contention at once.

Widget updates: `rect` / `text` / `image` take `claims: []`; `button`,
`window` and `label` take the default.

#### Two fields go

`claimsPointer` is deleted — `claims: []` says the same thing more precisely,
and one concept beats two.

`PointerClaim` and `onPointer`'s return type are deleted. The open question
recorded against it ("either make the return live or delete it") is settled
rather than coin-flipped: a dynamic decline **cannot** work, because the claim
filter runs at match time, before any widget is consulted. There is no later
moment at which returning `'pass'` could restore a binding the filter already
removed from the pool. `claims` is the mechanism, and it has to be a
declaration.

## Known limit

The layer's `hitTest` is position-only, so it cannot resolve the topmost widget
*per kind*. When two widgets overlap with disjoint claim sets, the upper one
wins the hit and a kind it doesn't claim falls through to the scene rather than
to the lower widget. Documented rather than solved; solving it means a
kind-aware `hitTest` signature across every registered layer.

## Testing

- `matcher.claims.test.ts` — the per-kind filter: a claim listing `pointer`
  does not bar a wheel binding; one listing nothing bars all, as today.
- `useGestureDispatcher.test.tsx` — the affordance reaches `doubleclick`,
  `contextmenu` (both routes) and `wheel`.
- the gestures matcher — a `wheel` spec with a target.
- `attach.test.ts` — the walk descends past `claims: []`.
- `tool.test.ts` — each new binding routes to its widget, and a widget that
  doesn't claim a kind never sees it.
- integration, the two user-visible claims: a right-click on chrome does not
  reach a scene binding, and a wheel over a non-claiming widget still zooms.

## Out of scope

Keyboard focus. It needs a focus model on `Hud` (focused widget, tab order,
focus ring) and a precedence rule against the canvas's window-level key
listeners — a different problem, and its own spec.
