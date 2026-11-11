# @weasel-js/ui-logic

Component behavior with no substrate: what a DOM component and a canvas-drawn widget both run,
each drawing it its own way. Today that is a list's roving highlight and typeahead, a tree's
expand and collapse keys, a run's selection, grid tiling, keyboard focus as one contract, how a text field's edit ends, and the
measure/draw contract a button and a row list implement on both targets. No React, no DOM.

Part of [weasel](https://github.com/orochi235/weasel), a domain-agnostic 2D
scene-graph canvas kit for React. See the
[API reference](https://orochi235.github.io/weasel/#pkg/ui-logic).

## Install

```sh
npm install @weasel-js/ui-logic
```

## Usage

```ts
import { EMPTY_TYPEAHEAD, rovingKey, typeaheadStep } from '@weasel-js/ui-logic';

type Row = { name: string; heading?: boolean };
const shape = { canStop: (r: Row) => !r.heading, label: (r: Row) => r.name };

let at: number | null = null;
let typed = EMPTY_TYPEAHEAD;

function onKey(rows: readonly Row[], key: string): void {
  const r = rovingKey(rows, at, key, shape);      // arrows, Home, End
  if (r.handled) { at = r.at; return; }
  if (key.length === 1) {
    const t = typeaheadStep(rows, at, typed, key, Date.now(), shape);
    typed = t.buffer;
    if (t.hit !== null) at = t.hit;
  }
}
```

A list's shape says which items the highlight can land on (`canStop`), which arrows move it
(`orientation`, vertical by default, or `'both'` for all four), whether Left and Right swap for a
right-to-left layout (`dir`), and whether it wraps at the ends (`wrap`, on by default).
`@weasel-js/menu` runs every menu level on these.

## Trees and rows

`treeKey` is a tree's Right and Left, the WAI-ARIA way: Right opens a closed branch or steps to
its first child, Left closes an open branch or steps to the parent. Its `TreeShape` says which
items are branches, which are open, and which is whose child.

`rowKey` is every key a list of rows answers, in one place: Cmd/Ctrl+A, the arrows with Home and
End (Shift extends), a tree's Right and Left, Enter and Space, and typeahead. It returns what the
key asks for (`selectAll`, `move`, `toggle`, `activate`, `type`) and the caller carries it out.
`@weasel-js/ui`'s `useRowNavigation` runs on it.

## Focus

`FocusScope<T>` is keyboard focus over a set of targets, whatever draws them: which one is
focused, whether its ring shows, `focus`, `moveFocus` through a `tabOrder`, and
`subscribeFocus`. A `@weasel-js/hud` HUD is one over its widgets, and `@weasel-js/ui`'s
`domFocusScope(root)` is one over the elements under `root`, so code that moves focus is
written once for both. `tabSort` and `tabStep` are the order and the step both use.

Targets placed freely, with no row or grid to walk, take the arrows by where they sit. `nearestToward(from, targets,
heading)` is the index of the target focus moves to: the cheapest by `headingCost`, which adds the travel along the
heading to twice the drift across it, so a target straight ahead beats a nearer one off to the side. `headingOf(key)`
reads the heading off an arrow key.

## Selection and grids

`selection(spec, values)` is which of a run of items are on: one value or `null` (`mode: 'single'`, which may
`allowDeselect` and may not follow focus), or a list of them (`'multiple'`), either with `mixedValues`, where the
sources disagree. `selectionOfEach(items)` is the same over items that each own a boolean. The model says each
item's state (`'on'`, `'off'`, `'mixed'`), what a press does, and runs an `edit`, a run of changes from its own
copy that it can revert; `sweepFrom` is a sweep's, setting each item it reaches to the opposite of whether the
pressed one was on. `selectionKeys` says what the keyboard does with it.

`tileGrid(count, { columns, lastRow })` lays a run of same-size items out as a grid, a short last row at its start,
centered, at its end, or stretched across (`'fill'`): its tracks, each item's span, and which of the grid's outer
corners each item sits on. `rovingGridTarget` walks such a grid with the arrows, Up and Down landing on the item
drawn under this one, by `gridLayout`'s per-row offsets and widths; `tileKey` does the same for `count` items
tiled by a spec. `@weasel-js/ui`'s `ToggleBar`, `OptionsBar`,
`ButtonBar`, `SwatchGrid` and `ToolGroup` run on these.

## Steps and sliders

`arrowSteps`, `arrowMove` and `rangeKey` are what an arrow key asks for: one step, or `COARSE_STEPS`
(ten) with Shift or a Page key, and Home and End for a range's ends. `sliderKey` turns one key into
a thumb's next value, by step or by whole stops, across an endless end and inside its neighbors;
`@weasel-js/ui`'s `Slider` runs on it.

`sliderAt(f, shape)` is the pointer's half: the value picked at fraction `f` of the track, on the
step grid, inside `min` to `max`, and pulled onto a stop within `pull` unless `free`. The shape
carries a `TrackMap`, the two-way map between a value and its place along the track, so the rule
does not care what the track is. `spanMap(span)` lays a `Span` along it linearly, `evenMap(stops)`
gives every gap between stops the same length, and a caller with a scale of its own writes the two
functions itself. `attract` is the pull alone: the nearest stop within a tolerance, measured along
the track with a map or in the value's own units without one.

A track need not show its whole range. A `Span` is a stretch of values, and a track that shows
one span of a longer range is a windowed track: `spanPan` and `spanZoom` move the window inside
its bounds, `spanZoom` about a value that keeps its place, and `spanPlace` and `spanShare` put a
value and a length at their fractions of it. Values outside the window map to places off the
track's ends, so a thumb can sit out of view and a drag can carry one there.

```ts
const window = { from: 2000, to: 3000 };
const track = { min: 0, max: Infinity, ...spanMap(window) };
sliderAt(0.5, track);                                        // 2500
sliderAt(0.52, { ...track, stops: [2510], pull: 6 / 400 });  // 2510, within 6px on a 400px track
spanZoom(window, 2500, 0.5, { from: 0, to: 10_000 });        // { from: 2250, to: 2750 }
```

`@weasel-js/ui`'s `Timeline` runs its lanes and ruler on these: a lane is a track windowed onto the
timeline, its keys the thumbs and every other key's time a stop.

## Text fields

`editEnd(cause, shape)` says how a text field's edit ends: Enter and blur commit, Escape cancels.
A field's shape can make Escape commit too, and a `multiline` one leaves Shift+Enter to type a
line break. Caret movement stays with each field: a DOM field gets it from the browser.

## Reorder

Moving items within a list, whether it is drawn in the DOM or on a canvas. A destination is a gap counted before
anything is taken out: 0 before the first item, `length` after the last. `moveItems(items, at, to)` moves the items at
indices `at` into gap `to`; `isNoopDrop` says whether that leaves them where they are; `nudgeGap` is the gap a
one-place move takes them to, and `nudgeOf` reads the Alt+arrow chord that asks for one. A pointer finds its gap by
`gapByMidpoint`, for items side by side, each split at its middle, or by `nearestGap`, for gaps drawn at places of
their own. `dropBand(f, band)` says which part of one item the pointer is over: before it, after it, or, with a
`band` under a half, into it.

A drag near the edge of a scrolling box scrolls it. `edgePush(span, p, margin)` is how hard, from -1 to 1: nothing
until the pointer is within `margin` of an end, full strength at the end and past it. `edgeScroll(bounds, point)`
reads both axes of a box; multiply by a top speed.

## Measure and draw

`HeadlessComponent<S, L, T, O>` is the contract a control implements on every target: `measure(state,
constraints, env)` gives its box (width, height, first baseline) and where its parts sit, and `draw(state,
target)` renders it in the target's own output. `measure` is shared: it reads only the state and a
`MeasureEnv`, the target's tokens and text metrics, so a DOM component and a canvas widget in one theme
measure alike. `draw` is per target and does not take the measured box: a target that positions by
coordinates measures with `exactly(w, h)` itself, and the DOM lays out by CSS from the same tokens.

`measureButton` and `measureRowList` are the two so far, with `buttonParts` and `listMode` saying which
parts and roles a state shows; `pressStep` is a press's hover-and-hold state machine. `@weasel-js/ui`'s
`domButton` and `domItemList` and `@weasel-js/hud`'s `hudButton` and `hudList` implement them.

## Hold-to-repeat

`createStepRepeat(step, spent, opts)` is a held stepper: `start(key)` steps once, then after
`REPEAT_DELAY_MS` once every `REPEAT_EVERY_MS` until `stop()`, or until `spent(key)` says the value
has nowhere left to go. Time comes from a `Scheduler` (`now`, and `set` returning a cancel), by
default `timerScheduler`; pass your own to drive it from another clock or a test. `@weasel-js/ui`'s
number field steppers and `@weasel-js/hud`'s menu number chips both hold through it.

## License

MIT
