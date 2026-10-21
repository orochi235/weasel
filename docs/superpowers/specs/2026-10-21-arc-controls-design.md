# Controls along an arc

**Status: designed 2026-10-21, nothing built.** Delete this doc once it lands, keeping anything durable in
`@weasel-js/ui`'s component docs.

**For** whoever plans and builds it. **Answers:** how any one-line control in `@weasel-js/ui` — a row of
items or a slider — is laid out along a curve instead of a straight line, starting with a circular arc.

## Why

A round loupe lens wants its zoom control hugging its rim, and its chrome strip could follow the rim too.
Nothing in ui can do that today: every row is a flex line, and every slider positions with `left: %` and
measures pointers as `(clientX - rect.left) / rect.width`. The motivating case is the lens (being
redesigned in `2026-10-21-lens-views-design.md`), but this is ui surface for any control, not lens code.

## Terms

| Term | Meaning |
|---|---|
| **track shape** | A curve a control is laid out along. Maps a 0..1 position to a point and a direction; maps a client point back to a 0..1 position and its distance from the curve; has a length. |
| **run** | The items of one row, or the stretch of track one control occupies, laid along a shape. |
| **tip** | Rotating an item, whole, to the shape's direction where it sits. |
| **flip** | Turning a whole run 180° and reversing its order, so it reads left to right below the curve's center. |

## Decisions (2026-10-21)

- Items **tip** to follow the curve, each rotated whole, like text around a circular badge. Glyphs inside
  an item are not bent (designer's call).
- A run **flips** to stay readable when it passes under the shape's center. The whole run flips together,
  decided by where its midpoint falls, so a row never turns over halfway along (designer's call). After a
  flip, values and items still run left to right: a zoom slider along a lens's bottom rim has its minimum
  on the left.
- Readable placement is always forced. An item's up points away from the shape's center unless that would
  turn it upside down on screen, which is when its run flips; values and items read left to right either
  way. An arc's `direction` matters only to code calling the shape's `at` and `nearest` directly
  (designer's call).
- One primitive, the track shape, serves both kinds of control. A straight line is a shape, and today's
  behavior is that shape. For `Slider`, the line shape is how a straight slider positions and measures.
  A straight `Bar` keeps its flex layout — the browser's line layout is the line shape's implementation
  for rows, and rewriting it as absolute positioning would put every straight bar at risk for nothing —
  and only a curved bar is placed through a shape (designer's call).
- Two controls on one circle are two wrappers over the same box with different angle ranges: a `Bar`
  along the top, a `Slider` along the bottom. The wrapper's box takes no pointer input; only items, thumbs
  and a track band along the shape do, so a press in the middle reaches whatever is beneath — the lens
  image, on a loupe (designer's call).
- A run shorter than its arc sits centered on it unless the wrapper says `align: 'start' | 'end'`; the
  More button sits at the run's reading end, after any flip. Popovers and menus an item opens go out
  from the shape, on the side its up points to, never toward the center (designer's call).
- First pass: the shape primitive, a wrapper that hands a shape to what is inside it, the `Slider` family,
  and `Bar`. Other rows follow on the same primitive.

## The track shape

A small interface in ui (or in `@weasel-js/geom` if the builder finds it needs nothing from React or the
DOM — likely):

- `at(f)` → point and unit direction at fraction `f` of the length;
- `nearest(point)` → the fraction of the closest point and the distance to it;
- `length`.

Shapes:

- **line** — today's behavior, and the default everywhere.
- **arc** — center, radius, start angle, end angle, direction. Sized from the box it is laid out in unless
  given explicitly, so a control in a lens-sized box gets an arc of that size with no numbers repeated.
  `nearest` projects by angle and, past either end, answers the nearer end, never the far one.
- **path** — any path through geom's `nearestOnPath`. Not in the first pass, but the interface must not
  need to change for it.

All of a control's geometry goes through its shape: nothing in a control that supports shapes may read
`clientX`, `rect.width` or `left: %` directly.

## The wrapper

A component (name left to the builder) that takes a shape, or an arc's parameters, and provides it by
context. A control that supports shapes lays itself out along the provided shape; a control that does not
renders as it does today. A control may also take the shape as a prop, which wins over context.

## Rows of items: `Bar` first

`Bar` (`packages/ui/src/components/Bar`) already has `orientation: 'horizontal' | 'vertical'`; following
a shape is its third way of running.

- Each item is placed by distance along the shape, centered on its spot, tipped to the direction there;
  the gaps between items are measured along the shape.
- The run flips as decided above.
- Both overflow modes work on a shape, as on a straight bar (decided 2026-10-21). `useBarOverflow` measures
  items along the shape's length rather than a box's width.
  - `'menu'`: what does not fit along the shape's length opens from the More button, at the run's end.
  - `'scroll'`: a native scroll container cannot scroll along a curve, so the bar keeps its own offset
    along the shape. Items sit at their place minus the offset, and the run is clipped at the shape's
    ends. The wheel and trackpad move the offset; so does a drag along the run, told apart from a press on
    an item. Focus reaching an item past either end scrolls it into view, so Tab and the arrow keys reach
    every item. With no native scrollbar, the clipped ends show that more lies past them (the form is left
    to the builder). This scroller is checked in a browser, focus-into-view included.
- Leaves that are not compact — fields, inline sliders — open from a button, as they do on a vertical bar
  (designer's call, revisit once rows of sliders along an arc are wanted).

`ButtonBar`, `ToggleBar`, segmented controls, `SwatchStrip`, `Tabs`/`PageTabs` and `RadioGroup` follow
after the first pass, on the same placement code.

## Continuous controls: `Slider` and what is built on it

`DetentSlider` and `Jog` are built on `Slider`, so they follow it. Every place `Slider` assumes a line
(mapped 2026-10-21 against `packages/ui/src/components/Slider/`):

| Behavior | Today | On a shape |
|---|---|---|
| thumb, tick and stop-label position | `left: f*100%`; labels `translateX(-50%)` | the shape's point at `f`, tipped, the run flipped as decided |
| `thumbFit: 'inside'` | `.rail` inset by half a thumb | the value span starts and ends half a thumb along the shape from its ends |
| track press, thumb drag | `(clientX - rect.left) / rect.width` against the rail | `nearest(point)` |
| shift-drag of every thumb | horizontal distance moved | the difference of the two projected fractions |
| drag off the track to remove | leaving the rail's box vertically by more than its height | distance from the shape beyond a threshold |
| stop snapping | `STOP_SNAP_PX` over `trackWidth` | over the shape's length |
| track hit area | the track's box plus slop | a band along the shape; the empty middle of an arc's circle is not track |
| readouts below thumbs | staggered by comparing left/right edges | placed off the shape's normal, staggered along it |
| the track and its filled part | CSS boxes | SVG strokes along the shape, styled by the existing slider tokens |
| `renderTrack`'s `TrackCtx` | `trackWidth`, `fractionToPosition` (a horizontal `calc()`) | gains the shape; a custom painter on a curve draws through it (a public type change; say so in the changeset). `paintGradientTrack` builds a CSS linear gradient and stays line-only in the first pass, saying so in its docs; a curved gradient painter is later work (designer's call) |
| keyboard, ARIA | arrows step; `role="slider"`; `aria-orientation="horizontal"` | unchanged, except `aria-orientation` is left off on a non-line shape (designer's call) |

`SliderBody`'s render is near the 120-line function limit; moving position and measurement behind the
shape will need it split along those responsibilities.

## Not covered

`RangeSlider` measures pointers through React Aria's own slider, and `InlineRange` is a native
`<input type="range">`; neither can follow a curve without being rewritten on `Slider`. They stay
straight, and their docs say to use `Slider` for a curve (designer's call).

## Goals and anti-goals

- **Goal:** a zoom slider along the bottom rim of a lens-sized circle, readable, with stops at 2/4/8/16
  and their labels on the arc, draggable along the rim, as a story.
- **Goal:** a `Bar` of actions along the top of the same circle, as a story.
- **Anti-goal:** a second geometry path inside a slider — one for lines, one for shapes. The line is a
  shape, and a slider positions and measures through its shape whether or not it is curved. (A straight
  `Bar` keeps flex layout; see Decisions.)
- **Anti-goal:** any change to how a straight control looks or behaves. Every existing test passes as is.

## Constraints

- No inline styles beyond custom properties a stylesheet reads; no `!important`.
- `npm run check:size` holds.
- Layout and pointer geometry are checked in `*.browser.test.tsx` files: jsdom lays nothing out, and the
  existing drag tests run against a stubbed rect (`Slider/testing/stubRect.ts`).
- One `patch` changeset for `@weasel-js/ui` (and `@weasel-js/geom` if the shape lands there), saying in
  its prose that `TrackCtx` changed.

## Left to the builder

- Whether the shape lives in ui or geom; its exact type names.
- The wrapper's name and whether it also takes arc parameters directly.
- How the arc is sized from its box (inscribed circle, given radius, or both), within "no repeated
  numbers".
- The flip rule's exact behavior where an item's up is horizontal (a run centered at 3 or 9 o'clock).
- How the More button, readouts and the scroll ends' "more past here" are styled on a curve.
