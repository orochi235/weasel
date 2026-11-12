# @weasel-js/ui-input

## 1.19.0

### Patch Changes

- 93ed93d: `frames` throws a `RangeError` for a `loop` count that is NaN or negative.
  
  <!-- entry: rank=-5 fix -->
- 3932826: `stepsOf` throws a `RangeError` for a cap that is not a whole number 0 or more, where a sweep or `Sequence` over it would have walked forever.
  
  <!-- entry: rank=-5 fix -->
- c913ef0: A tiling's `columns` is held to at most 2^24, so `tileRows`, `tileKey` and `tileGrid` work for an `Infinity` or huge column count.
  
  <!-- entry: rank=-5 fix -->
- 20c4979: An ordered slider's thumb stays inside its bounds and between its neighbors when dragged or set by a track click.
  
  `clampOrdered` holds it there even when a neighbor sits too close for the step it keeps.
  
  <!-- entry: fix -->
- 44aa42f: A `frames` sweep of a run that ends always shows the run's end as its last frame, even where float drift rounds the last frame's time past it.
  
  <!-- entry: rank=-5 fix -->
- a612a95: A `range` sweep walks its ends exactly and keeps a value's digits past the twelfth.
  
  Float drift, such as `0.1 * 3` reading `0.30000000000000004`, is still dropped, and labels still show twelve digits.
  
  <!-- entry: fix -->
- 10199c0: `typeaheadMatch` moves to the next match when a letter whose lowercase takes two code points, such as `İ`, is typed again.
  
  <!-- entry: rank=-5 fix -->
- 644c5c7: `@weasel-js/ui-input` is a new package: what a key or a pointer does to a control, as pure functions.
  
  It holds the rules `@weasel-js/ui-logic` exported until now: arrow steps and `sliderKey`, `sliderAt` and `Span`, list and grid roving, typeahead, `treeKey` and `rowKey`, `selection`, the reorder and drop-gap rules, `edgePush`, `nearestToward`, `tabSort` and `tabStep`, `editEnd`, sweeps and `createStepRepeat`. It depends only on `@weasel-js/quantity`, and exports `Box` for the rules that read one.
  
  <!-- entry: new api -->
- 521cab5: `attract` in `@weasel-js/ui-input` works without a `toFraction`.
  
  The distance to a stop and the tolerance are then both in the value's own units.
  
  <!-- entry: api -->
- 8936d41: `@weasel-js/ui-input` exports `dropBand`, which part of an item a dragged pointer is over: before it, after it, or into it.
  
  `dropBand(f, band)` reads the fraction `f` along the item. The leading and trailing `band` drop beside it and the middle drops into it; the default of a half leaves no middle.
  
  <!-- entry: new api -->
- 8936d41: `@weasel-js/ui-input` exports `edgePush` and `edgeScroll`, how hard a drag near a scrolling box's edge pushes it to scroll.
  
  `edgePush(span, p, margin)` is -1 to 1 along one axis: 0 until the pointer is within `margin` of an end, full strength at the end and past it. `edgeScroll(bounds, point, margin)` reads both axes of a box. Multiply by a top speed for how far to scroll.
  
  <!-- entry: new api -->
- 8936d41: `@weasel-js/ui-input` exports `nearestToward`, the target an arrow key moves focus to among freely placed boxes.
  
  `nearestToward(from, targets, heading)` returns the index of the cheapest target by `headingCost`: the travel along the heading plus twice the drift across it, so a target straight ahead beats a nearer one off to the side. `headingOf(key)` reads a `Heading` off an arrow key.
  
  <!-- entry: new api -->
- 7b56e88: `moveItems` ignores an index that is not a whole number, as it ignores one outside the list. `movedIndex`, `isNoopDrop` and `nudgeGap` read indices the same way.
  
  <!-- entry: rank=-5 fix -->
- 279a193: `selection` treats `NaN` as one value, so a `NaN` item can be shown on and turned off.
  
  <!-- entry: rank=-5 fix -->
- 521cab5: `@weasel-js/ui-input` exports `sliderAt`, the value a pointer picks along a slider's track.
  
  `sliderAt(f, shape)` reads the track at fraction `f`, lands on the step grid inside `min` to `max`, and is pulled onto a stop within `pull` unless `free`.
  
  The shape carries a `TrackMap` (`toFraction` and `toValue`), so the same rule reads a linear track, a scaled one, or a window onto a longer range. `evenMap(stops)` is the map for a track its stops divide evenly.
  
  ```ts
  sliderAt(0.42, { min: 0, max: 100, stops: [40, 80], pull: 0.03, ...spanMap({ from: 0, to: 100 }) }); // 40
  ```
  
  <!-- entry: new api -->
- 76da952: A key pressed back from an endless end's stop lands on the step grid, or on the range's other end when it would cross the whole range.
  
  <!-- entry: rank=-5 fix -->
- 228d835: A slider with an endless low end steps on a grid from its range's start, not from the end stop drawn before it.
  
  `useScale`'s new `stepOrigin` option says where the grid starts; `SliderBody` passes its range's start.
  
  <!-- entry: fix api -->
- 521cab5: `@weasel-js/ui-input` exports `Span`, a stretch of values a track shows, with `spanPan` and `spanZoom` to move one inside its bounds.
  
  `spanZoom(span, at, factor, bounds, minLength)` scales about `at`, which keeps its place along the track. `spanPlace`, `spanValue` and `spanShare` convert between a value or a length and its fraction of the span, `spanHold` moves a span back inside bounds, and `spanMap(span)` is the span as a `TrackMap`.
  
  <!-- entry: new api -->
- e198aad: The arrows, Home, End and typeahead treat a highlight that names no item, such as one left past the end of a shrunken list, as no highlight.
  
  `stepStop` and `typeaheadMatch` no longer hand `canStop` or `label` an `undefined` item.
  
  <!-- entry: fix -->
- 7dd964d: Typeahead matches a label however its accents are encoded, so typing `á` finds `a` plus a combining acute, and typing `a` does not.
  
  <!-- entry: rank=-5 fix -->
- Updated dependencies [0e15698]
- Updated dependencies [041dbf7]
- Updated dependencies [4ff3e3e]
- Updated dependencies [785627a]
- Updated dependencies [3e4a895]
- Updated dependencies [302c660]
- Updated dependencies [0cff741]
- Updated dependencies [b1309b2]
- Updated dependencies [30c0e8e]
- Updated dependencies [592f6ec]
  - @weasel-js/quantity@1.19.0
