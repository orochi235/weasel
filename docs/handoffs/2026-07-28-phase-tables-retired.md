# The phase-table grammar is retired — one dispatch pipeline

Closes the last structural finding of the 2026-07-27 layer audit (§3.1 / §3.4 /
§3.6) and the P1 entry it became in `docs/TODO.md`, which is now deleted.

Branch `retire-phase-tables`, seven commits off `main`. Gates: `tsc --noEmit`
clean, `vitest run` 5262 passing / 4 skipped across 601 files, `npm run build`
exit 0. **Nothing is pushed.**

Design spec: `docs/superpowers/specs/2026-07-27-retire-phase-tables-design.md`.

| Commit | Subject |
| --- | --- |
| `93eb2d53` | `docs(spec)` — design |
| `12197862` | `feat(gestures)` — `PointerDownSpec` + press coords on clicks |
| `4f26fa0f` | `refactor(eyedropper)` — one click binding |
| `b044944c` | `refactor(select)` — classifier onto bindings |
| `b1861a5c` | `refactor(pen)` — create mode onto tool-owned actions |
| `bc8195e6` | `feat(actions)` — `Action.activeCursor` |
| `adc17bec` | `refactor(tools)!` — delete the grammar and its pipeline |

Net for the demolition commit alone: 88 files, +1,255 / −4,501.

---

## 1. The blocker on file was stale

`docs/TODO.md` recorded this as blocked on the pen port's scratch-selector
decision. Two things had landed since that removed the block, and neither was
noticed because the TODO entry was written before them:

1. **`ToolDef.actions`** lets a tool hook declare Actions that register from
   inside `<ActionsProvider>`. They are built in the hook, so they close over
   the hook's own refs — pen's create-mode actions read the existing
   `scratchRef` directly and the state never leaves the hook.
2. **The dispatcher already buffers the pointerdown** and flushes it at
   threshold crossing, so a drag action's `start()` receives press coordinates.
   Pen's `_pendingDown` existed only because the old pipeline lost them.

Worth generalizing: a recorded blocker is a claim about the code at the time it
was written. Re-derive it before planning around it.

## 2. What the ports exposed

Same pattern the audit follow-up found — each removal uncovered something.

| Removed | What it was hiding |
| --- | --- |
| Eyedropper's `pointerDown` claim gate | The dispatcher synthesized a click from *any* press+release with no drag handle, whatever the distance. `ClickSpec` documents itself as "without movement past the threshold"; a tool binding `click` and not `drag` saw a full-canvas drag arrive as a click |
| Select's scratch-driven cursor | The classifier port left the ref set on press and never cleared, so the cursor would have stuck at `move` after the first click on a shape |
| Pen's private 300ms double-click check | A **fourth** double-click detector, in a codebase that had just collapsed three into one (audit §3.3) |
| Pen's ⌘-click route | The retired matcher accepted meta OR ctrl on every platform, so ⌘-click's route also fired on Ctrl-click on mac — where that is the context menu |
| `AffordanceBinding.drag` | Every kit implementation was a no-op stub that claimed. The one real implementation was `@weasel-js/hud`'s — see §4 |

## 3. Chrome hits decline in the spec, not the action body

The single most load-bearing decision in the demolition.

The old pipeline gave two properties by construction, because affordance hits
bypassed the active tool entirely: a press on chrome was never a body pick,
and it reached whatever owned that chrome. Neither survives automatically when
tools are just bindings — select's press binding matches everything.

Both come back by putting the decline in the **spec**:

```ts
{ spec: { kind: 'pointerDown', target: { kindOf: (hit) => hit == null }, … },
  actionId: 'select.pick' }
```

An early return inside `select.pick` would have got the first property and not
the second: the dispatcher counts a matched binding as handled, so the gesture
would have been consumed and the HUD would never have seen its own press. That
cost an hour to find and is the reason the HUD port looked broken when it
wasn't.

`matchTarget` for `click` now receives the *affordance* rather than the DOM
target, so one predicate describes a piece of chrome for both click and drag,
and `hit == null` reliably means "not chrome". A click carries the affordance
its press landed on, the same way it already carried `bodyTarget`.

## 4. `@weasel-js/hud` had to be ported, and nobody had inventoried it

Neither the audit nor the design spec listed it. `attachHud`'s layer `hitTest`
returned a real `DragChannel`, and the tool-routing dispatcher drove it via a
synthesized `__affordance__` pseudo-tool. The HudDemo button was live on the
pipeline being deleted.

The port, which is also the general mechanism for any registered layer that
owns input:

- `CanvasExtensionApi.hitTestExtras(worldX, worldY)` walks registered layers
  topmost-first (last-registered wins).
- `<SceneCanvas>` folds it into `affordanceAt` **ahead of** its own selection
  chrome, since registered layers draw on top. A hit becomes an
  `AffordanceHit` of kind `layer:<id>` carrying the binding's `initialScratch`
  as `payload`.
- The layer's owner claims it with bindings gated on that kind.
  `createHudTool()` / `useHudTool()` returns a `Tool` with three: `pointerDown`
  → widget `down`, `click` → `up`, `drag` → `move`/`up`. Pass it as **ambient**.

Two holes closed on the way:

- **Ambient tools' bindings were assembled nowhere.** The walk covered hotkey
  and active tools plus actions' `defaultBinding`; an ambient tool is in
  neither set, so its `bindings` were silently inert.
  `DispatcherContext.ambientToolIds` fixes it.
- **`useToolActions` skipped ambient tools**, which is the same silent failure
  the hook exists to prevent — a binding pointing at an unregistered id.

## 5. New public surface

- **`PointerDownSpec`** — matches at press time, before click/drag
  classification. One physical press dispatches twice: an eager copy tagged
  `stage: 'press'` for `pointerDown` specs, and the buffered copy for `drag`
  specs. Disjoint by construction. An ongoing invoker bound to `pointerDown` is
  refused with an error rather than quietly occupying the drag's gesture id.
- **`ClickEvent.pressX` / `pressY` / `affordance`** — press point and press
  affordance, carried onto the synthesized click.
- **`Action.activeCursor`** — the cursor while that action's handle is in
  flight, applied by the hover pump. `Action.cursor` stays a prediction. This
  is where `hand`'s `engaged: { cursor: 'grabbing' }` and select's
  scratch-driven `move`/`crosshair` went, and it works for any consumer that
  binds those actions rather than only for the tool that declared them.
- **`AffordanceHit.payload`** — free-form, for hits the kit doesn't know the
  shape of.
- **`CanvasExtensionApi.hitTestExtras`** — see §4.
- **`buildRouteRegistry`** (was `buildActionRegistry`) — reads `Tool.bindings`.
  The old name suggested a relationship to the Actions Registry that never
  existed, and walking phase tables left it blind to the grammar that
  survived: it reported 6 routes for select, which declares 14.

## 6. Behavior changes worth knowing

1. **A click requires sub-threshold movement.** Previously only "no drag handle
   opened."
2. **Pen: a single click right after a drag-placed anchor no longer finishes
   the path.** The old code faked a click timestamp on drag release; a drag
   isn't a click. Finishing takes a double-click, Enter, or ⌘-click, as
   everywhere else.
3. **A press on chrome no longer re-selects underneath it** — resize handles,
   rotate rings, path anchors, registered layers' widgets.
4. **Clicking a HUD widget over empty canvas no longer clears the selection.**
5. **`actions={null}` still registers the mounted tools' own actions.** A tool
   you passed has to bring the actions its bindings reference, or it is inert.

## 7. Consumer impact — removed exports

Source-breaking. Everything here was either phase-table machinery or surface
with no meaning in the surviving pipeline.

- `ToolDef.initial` / `.engaged` / `.claimsAll` / `.hitOverride`, `PhaseDef`,
  `RouteTable`, `RouteEntry`, `ModifierRoute`, `ActionFn`, `ViewportPhaseDef`
- `Tool.pointer` / `.drag` / `.keyboard` / `.wheel` / `.claimsAll` /
  `.hitOverride`; `PointerChannel`, `DragChannel`, `KeyboardChannel`,
  `WheelChannel`, `Decision`
- `apply`, `begin`, `hold`, `commit`, `cancel`, `claim`, `none`, `Result`,
  `BeginSpec`
- `createToolsDispatcher`, `ToolsDispatcher`, `ToolsDispatcherOptions`
- `resolveRoute`, `RouteMatch`, `HitResult`, `ToolHit`, `EmptyHit`, `NodeHit`,
  `NodeRef`, `NodeRefHit`, `AffordanceHit` (the routing one — the invoker's is
  unrelated and stays)
- `mods`, `ModifierCombo`, `canonicalModifiers` (still exported, now from the
  route grammar rather than through the deleted bridge)
- `forwardActionTo`, `buildActionRegistry` (→ `buildRouteRegistry`),
  `RouteResolvedInfo` / `RoutePhase` / `RouteGesture`
- `ToolsApi.dispatcher` / `.gestureTick`; `UseToolsOptions.fallback` /
  `.getCtx` / `.getNodeAtPoint`
- `<SceneCanvas clickFallback>`, `<Canvas onBackgroundClick>`,
  `<Canvas getNodeAtPoint>`
- `AffordanceBinding.drag`
- `ToolCtx` keeps only what a cursor resolver reads (`target`, `__reportRoute`
  and the channel plumbing are gone)

## 8. Left open

- **`docs/hooks.md` still documents deleted gesture hooks** (`useAreaSelect`,
  `useClone`, `useMove`, …). Untouched by this work; still the P3 entry it was.
- **apps/draw's inspector lost its Phases section.** There are no phases to
  inspect, and its gesture catalog collapsed from two vocabularies to one. The
  per-tool row now reports a `surface` (bound gesture kinds + declared
  outputs). Nothing was added to replace the phase pages — if the inspector
  wants a binding-centric view richer than the existing route list, that is a
  fresh design question, not a port.
- **`@weasel-js/hud`'s widget protocol takes synthetic `native` events.**
  Actions receive normalized input, not the originating `PointerEvent`, so
  `HudPointerEvent.native` is now a stub `Event`. Widgets that read the real
  event would need the dispatcher to carry it.
