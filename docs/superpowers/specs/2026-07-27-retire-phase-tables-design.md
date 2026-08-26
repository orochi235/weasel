# Retiring the phase-table route grammar

Closes the last structural finding of the 2026-07-27 layer audit and the P1
entry it became in `docs/TODO.md`.

## The problem

Two complete input pipelines are attached to the same `<canvas>`:

- **Tool routing (older).** `<Canvas>` wires React pointer handlers, a native
  `wheel` listener, and document `keydown`/`keyup` into `tools.dispatcher`
  (`tools/dispatcher.ts`). Routes are authored as `ToolDef.initial` / `.engaged`
  phase tables keyed by hit-kind strings, resolved by `routing/lookup.ts`.
- **Bindings → Action (newer).** `useGestureDispatcher` wires native listeners on
  the same element into the interactions `Dispatcher`. Routes are `GestureSpec`
  objects, resolved by `dispatcher/matcher.ts` + `@weasel-js/gestures`.

Every pointer, wheel, and key event is processed twice by two independent state
machines with independently-defined thresholds and synthesis rules, and there is
no arbitration between them. Only the older pipeline lacks eligibility
filtering, so which rules apply to a gesture is decided by which pipeline its
route happens to live in.

Most of what the tool pipeline used to serve was removed in the audit follow-up.
Three tools still declare route tables:

| Tool | Surviving routes |
| --- | --- |
| `usePenTool` | create mode — `pointerDown` / `click` / `drag` / `keyDown` |
| `useSelectTool` | a `pointerDown` classifier + a `click` sub-table |
| `useEyedropperTool` | a `pointerDown` gate + a small `click` table |

`useHandTool` declares `engaged: { cursor: 'grabbing' }` — a cursor, not a route.

## The recorded blocker is stale

`docs/TODO.md` records this as blocked on the pen port's scratch-selector
decision (the 2026-07-27 inspector handoff §4b). Two things have landed since
that remove the block:

1. **`ToolDef.actions`.** A tool hook can declare Actions that are registered
   from inside `<ActionsProvider>` by `useToolActions`. Those Actions are
   constructed in the hook, so they close over the hook's own refs. Pen's
   create-mode actions can read the existing `scratchRef` directly. No
   `Selector` exposing tool scratch to `RuleCtx` is required.
2. **The dispatcher buffers the pointerdown** and flushes it at threshold
   crossing (`useGestureDispatcher.tsx:608-616`), so a drag action's `start()`
   already receives pointerdown world coordinates. Pen's `_pendingDown` exists
   only because the old pipeline lost them; it is redundant, not something to
   port.

## New grammar surface

Both additions are additive — no existing binding changes behavior.

### `PointerDownSpec`

```ts
interface PointerDownSpec {
  kind: 'pointerDown';
  target?: TargetSpec;
  mods?: ModSpec;
  phase?: PhaseSpec;
}
```

Select applies the selection at **pointerdown**, so press-and-hold on an
unselected node highlights immediately and a drag starts from an already-correct
selection. Redistributing that into `moveAction.start()` plus a `click` binding
would delay the highlight to release — a feel regression against every peer app.

`useGestureDispatcher` gains an eager dispatch at pointerdown time, tagging the
`InputEvent` `stage: 'press'`. The existing buffered flush is untagged, and
`match.ts`'s `case 'drag'` is gated on `stage !== 'press'`, so drags still open
from the buffered event and nothing double-fires. The hover pump's `resolveOnly`
probe is untagged too, so drag prediction is unaffected.

This is one more spec kind in the existing grammar, matched by the existing
engine, and therefore eligibility-filtered like everything else — which is
precisely what audit §3.4 asks for.

### Press coordinates on the synthesized click

The synthesized `click` `InputEvent` gains `pressX` / `pressY` (the pointerdown
world position) alongside its existing `worldX` / `worldY` (the release
position). Pen places anchors at the press point today via `_pendingDown`;
click currently reports release coords. Adding a field rather than redefining
`worldX`/`worldY` keeps existing click actions byte-identical.

## Cursors

`Tool.cursor(ctx)` reads `ctx.scratch`, supplied by
`tools.dispatcher.getActiveScratch()` — which this work deletes.

The hover pump in `useGestureDispatcher` already resolves `Action.cursor` for the
*predicted* action while idle, and clears its override mid-gesture so the
React-managed `Tool.cursor` shows through. The pump is extended to apply the
**in-flight** action's `Action.cursor` mid-gesture instead of clearing.

- `hand`'s `engaged: { cursor: 'grabbing' }` → `Action.cursor` on `viewport.dragPan`
- select's `'move'` / `'crosshair'` → `Action.cursor` on `move` / `areaSelect`
- pen's close-hint `'pointer'` → closure over `scratchRef` (already in scope,
  already has a re-render trigger)

`Tool.cursor`'s function form loses `ctx.scratch`; a tool needing private state
closes over its own ref.

## Phases

Each phase commits separately and holds `tsc --noEmit` + `vitest run` green.

### A — eyedropper

One `{ kind: 'click' }` binding to a tool-owned `eyedropper.pick` action.
`claimAtDown` is deleted: it exists only to pre-empt the *other* pipeline's
select tool, and hotkey-scope priority in the surviving dispatcher already does
that job.

### B — select

- `select.pick` on `pointerDown` with body targets — the `pickBest`/`pickEvery`
  classification, `selection.applyClick`, and the deferred-collapse bookkeeping.
- `select.collapseDeferred` on `click` with `selected-body`.
- `selectionAllowed` (the audit's interim per-route patch) becomes
  `eligible: { capability: 'creates-selection' }`, matching what the
  `clearSelection` binding already declares.
- `extendClickLocked` becomes `enabled` on `select.pick`.
- The three empty-target modifier no-op routes are deleted. They exist to
  swallow Shift/Cmd-click on empty so it does not clear the selection; strict
  `ModSpec` matching means `clearSelection`'s `mods: {}` already fails to match a
  modified click, so the swallow is unnecessary.
- `SelectScratch` becomes a tool-owned ref — it is bookkeeping between
  pointerdown and the following click, not dispatcher state.

### C — pen

Tool-owned actions declared via `ToolDef.actions`, closing over `scratchRef`:

| Action | Binding |
| --- | --- |
| `pen.placeAnchor` | `{ kind: 'click' }` — uses `pressX`/`pressY` |
| `pen.dragHandle` | `{ kind: 'drag' }` — ongoing (start / move / release / cancel) |
| `pen.finish` | `{ kind: 'key', key: 'Enter' }` |
| `pen.cancel` | `{ kind: 'key', key: 'Escape' }` — joins the existing first-match Escape ladder |

`_pendingDown` is deleted.

### D — demolition

- `tools/dispatcher.ts` and its tests; `routing/lookup.ts`; the
  `begin` / `claim` / `none` / `commit` route-return protocol.
- `ToolDef.initial`, `.engaged`, `claimsAll`, `PhaseDef`, `RoutePhase`,
  `RouteTable`, `ModifierRoute`, `ViewportPhaseDef`.
- `<Canvas>`'s React pointer handlers, its document pointer backstop, its native
  `wheel` listener, its document key listeners, and the three `__setGetCtx` /
  `__setHitTestContext` / `__setGetNodeAtPoint` monkey-patches.
- `useTools` stops constructing a dispatcher; it takes `hasActiveGesture` and
  `cancelGesture` callbacks sourced from the interactions dispatcher.
- `routing/reflection`: `buildActionRegistry` → `buildRouteRegistry`, reading
  `Tool.bindings` instead of walking `ToolDef` phases (it has nothing to do with
  the Actions Registry, and it is currently blind to the grammar that survives).
  The `modifierComboToParsed` bridge — which exists purely to translate between
  the two modifier vocabularies — is deleted with the second engine.

## Testing

The ported behaviors keep their existing test files; the tests move from driving
`tools.dispatcher` to driving the interactions dispatcher. Three cases get new
coverage because they are where a silent regression would hide:

- Press-and-hold on an unselected node selects it before any movement
  (the reason `PointerDownSpec` exists).
- A pointerdown does not fire both a `pointerDown` binding and a `drag` binding
  from the same physical press.
- In `path-edit` mode, clicking a shape body does not re-select it — the audit
  §3.4 bug, now enforced by `Action.eligible` rather than by hand.

## Consumer impact

Source-breaking, and the removed surface was already no-op in the older
pipeline for everything except the three ported tools. The full removed-export
list is recorded in the handoff at the end of the work, in the same form as the
2026-07-28 layer-audit follow-up.
