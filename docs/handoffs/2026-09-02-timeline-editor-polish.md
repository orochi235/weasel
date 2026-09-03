# Timeline editor: polish landed, curve consolidation open

For whoever picks up the timeline editor. Seven asks landed and are committed; one architectural
decision is open and is the reason this file exists. The changesets say what shipped — this
carries the branch state, the survey that isn't in the tree, and the traps.

## Where the work is

Branch **`ui/timeline-editor`** in the primary checkout, 10 commits ahead of the last report and
**~47 ahead of `origin/main`**. Everything is committed; **nothing is pushed** — that needs Mike's
explicit OK. Full suite green: 815 files, 8751 tests.

Storybook may still be running on port 6010. The stories to look at are
`weasel-ui/Timeline` → `Nested`, and `weasel-ui/DetentSlider`.

## The open decision: one editable curve

Mike: *"we should have exactly one implementation of an editable curve with fancy options for
adding control points and stuff. it's a disaster to rewrite that."* Timeline's graph mode
currently reimplements curve editing that `packages/ui` already has. The direction is settled;
the scope is not.

**`CurveEditor.tsx` is a back-compat shim** — it says so at its own line 1, and is a single
`createFunctionLayer` mounted on a `LayeredCurveEditor`. The real substrate is three layers:

- **`Plot2D`** (`Plot2D/Plot2D.tsx:84`) — SVG surface, grid, axes, model↔plot mapping.
  `Plot2DHandle.clientToModel` (`:126`) is what lets a drag tracked on `window` map back in.
- **`LayeredCurveEditor`** (`LayeredCurveEditor.tsx:99`) — pointer gesture routing, coordinate
  context, undo. Layer state is held by the *consumer* (`:34`), which is what lets one layer's
  drag update another's state mid-gesture (`:89`).
- **`CurveLayer<S>`** (`layerTypes.ts:76`) — `render`/`hitTest`/`onPointerDown`/`onKeyDown`,
  generic over `S`.

**So "use the existing one" means a new keyframe layer on that substrate, not a swap.**
`createFunctionLayer` cannot be reused directly: it has **no tangent-handle concept anywhere**
(tangents are derived from neighbours; `constrain: 'function'` only forces monotone
interpolation), so it cannot express per-segment cubic-bezier easing; and its
`ControlPoint {x, y}` cannot hold a `Keyframe<T>` with non-numeric values.

What Timeline should adopt:

- `Plot2D` as the graph-mode surface — graph mode today is a bare percent-space SVG
  (`Lane.tsx:269`) with no grid, no axes, no value labels.
- `LayeredCurveEditor`'s gesture routing, which has `pointerId` filtering and a cancel path that
  restores the pre-gesture snapshot. Adopting it would have prevented both bezier-drag defects
  fixed this session.
- `hitTest.ts:41` `hitTestCurve` — click the curve between two keys to select that segment, with a
  real hit radius, replacing the full-lane-height invisible `.segment` divs (`Lane.tsx:251`) that
  currently swallow clicks across the whole lane.

What must **not** be shared, and why:

- **The dope sheet stays DOM.** Its keys and segments are focusable and aria-labelled
  (`Lane.tsx:273`); CurveEditor's SVG anchors have no `tabIndex` and no ARIA at all. Moving it
  onto the plot would lose accessibility Timeline has and CurveEditor lacks.
- The x axis is a pannable/zoomable window with tick generation and a playhead; `Plot2D`'s
  `xRange` is a fixed prop with no analogue.
- Per-lane y domains derived from that row's own data (`Lane.tsx:95`). A stack of lanes is N
  plots, not one plot — this is the part that needs design, not just porting.
- Easing interpolation is genuinely different maths and should stay separate: CurveEditor
  *interpolates* (Catmull-Rom, Fritsch-Carlson monotone, passing through every anchor), Timeline
  *approximates* (CSS cubic-bezier with explicit handles, Newton solve).

**The question for Mike** was whether to do the full port or only adopt the gesture routing. He
has not answered.

## Still duplicated, not yet touched

`keys.ts` `snapTime` is byte-for-byte `BandEditor.tsx:134` `snapped` — same algorithm, same
`SNAP_PX = 6`, same alt-to-defeat convention. `BandEditor/scale.ts:1` declines to generalize on
the grounds that "generalizing is a job for a second consumer that needs one", which is reasoning
this repo's `CLAUDE.md` explicitly bans. There is also no `--wzl-handle-*` token: Timeline's
`.key` (9px) and CurveEditor's endpoint (10px) are both 45°-rotated squares that arrived there
independently.

## Traps

**jsdom builds `requestAnimationFrame` on `setInterval`** (`jsdom/lib/jsdom/browser/Window.js`).
So faking intervals while still awaiting a real frame hangs forever — which is why the recorded
fix for the `SceneScrollerDemo` flake ("fake both timers") only works if the frame loop is driven
off the same fake clock. `SceneScrollerDemo.test.tsx` is the worked example.

**`<Timeline>` previewed nothing during a key drag unless the consumer wired `onInput`** and fed
the moved track back. The preview is now the component's own state (`Lane.tsx`, the `drag` hook),
and `onInput` is a notification for consumers driving something else. Don't reintroduce the
dependency by deriving the ghost from the `tracks` prop.

**`aria-valuenow` on `DetentSlider` is an index, not the value.** The value lives in
`aria-valuetext`. Any test asserting the rate must read `aria-valuetext`, and must drive the
keyboard rather than a pointer — jsdom has no layout, so a click at an x offset asserts the
emulation.

## Loose ends

Nothing is unpushed-and-undurable except the branch itself. Screenshots and icon proofs from this
session are in the session scratchpad and will be swept; they are reproducible from Storybook.
