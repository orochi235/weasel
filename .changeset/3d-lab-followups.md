---
"@weasel-js/core": patch
"@weasel-js/diagram": patch
"@weasel-js/labkit": patch
---

Follow-ups a 3D lab turned up while driving core's dispatcher over a WebGL
viewport. Each one is a place the kit assumed its own 2D renderer.

**`classifyTarget` and `affordanceAt` now take the world point their types
promise.** Both were handed the raw client point at every dispatcher call site,
so `<SceneCanvas>` and `<CanvasView>` each wrapped their thunk in the same
`clientToWorld` they also passed the dispatcher, and a consumer hit-tested in
one space while reading `ctx.world` in another. The conversion happens once now,
where the event arrives. Behavior-identical for both kit consumers; a consumer
passing no `clientToWorld` sees identity. **If you pass either option to
`useGestureDispatcher` yourself and convert coordinates inside it, remove your
conversion.**

**`InvocationCtx.screen` carries a screen point, and is optional.** It was
filled from the same field as `ctx.world`, so it had never been screen-space.
It now comes from the event's client coordinates and is absent where the event
carries none — a keystroke, a UI-driven trigger, a synthetic probe. A
view-mutating drag still wants `drag.screenDelta`. A click's `ctx.world` is the
click's own position rather than the origin.

**`scene.history` publishes the `History` a `Scene` already owned.** The kit's
`undo`/`redo` actions resolve a `history` dep and a consumer had nothing to give
them, so `<SceneCanvas>` cast the Scene itself through `unknown`. It is a façade
rather than the private engine: mutating members route through the scene's own
wrappers, so an action-driven undo bumps the version and notifies subscribers.

**`resolveOverlays` is the overlay half of the in-flight gesture channel.**
`resolvePreviews` already answered for the ghosts a gesture displaces; this
answers for the chrome it draws that is no node at all — a marquee rect, a lasso
trail, an insert outline — in world geometry, with every degenerate case
dropped. `insertPreviewExtent` is exported alongside it.

**Every overlay variant is now geometry, and the layer owns the paint.**
`OngoingOverlay`'s `'commands'` variant — arbitrary `DrawCommand[]`, which only
core's own 2D renderer could execute — **is gone**, along with the `opaque` flag
on the resolved form and the `action.commands` chrome id. Its two producers
publish the new `'polyline'` variant instead: a run of world points plus a
one-word `OverlayRole` (`'cut'` for `slice`, `'connector'` for
`@weasel-js/diagram`'s `connect`) that a painter maps to a stroke, falling back
to plain chrome for a role it does not know. `useDispatcherOverlayLayer` draws
both exactly as they were drawn before, and
`DispatcherOverlayStyle.roles` is where a consumer restyles one.
**`ConnectActionOptions.stroke` is removed** — an action no longer names a
paint; use `roles: { connector: … }` on the layer's style.
**If you produced a `'commands'` overlay**, publish a `'polyline'` for a line,
or paint it from a render layer of your own.

**labkit stacks two surface buffers around the trial DOM.** The shared buffer
sat over the trials, which is right for a mark annotating an instrument and
wrong for an opaque renderer that buries its own pane. `useSurfaceCanvas('under')`
asks for the lower buffer; the default is unchanged. **`SurfaceCanvasContext`
now carries `{ over, under }` rather than one canvas** — a consumer providing it
directly must update the value.

**labkit labs get their own chrome regions.** Every region was per-trial, so a
lab-level control had nowhere to go and `LabPalette` existed by casting a
two-field object through `as unknown as TrialChromeContext`. `<Lab labChrome>`
takes contributions shaped exactly like a trial's, against a real lab context.

`docs/extending.md` now states the contract for mounting tools outside
`<SceneCanvas>`, including the half that was written down wrong: capability
eligibility resolves through `RuleCtx.allowedCapabilities` and `getRuleCtx`, not
the `activeTool` dep.
