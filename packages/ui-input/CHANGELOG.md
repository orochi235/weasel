# @weasel-js/ui-input

## 2.0.0

### Major Changes

- 5f856dc: `arrowMove` moved from `@weasel-js/ui-input` to `@weasel-js/quantity`, beside `COARSE_STEPS`; it is unchanged.
  
  ```ts
  // before
  import { arrowMove } from '@weasel-js/ui-input';
  // after
  import { arrowMove } from '@weasel-js/quantity';
  ```
  
  <!-- entry: breaking api -->
- 174d6ef: `chordKey`, `codeLetter`, `CHORD_MODIFIERS` and `ChordSource` moved from `@weasel-js/ui-input` to `@weasel-js/gestures`; they are unchanged.
  
  `@weasel-js/gestures` already exported `CHORD_MODIFIERS`; it now also exports `chordKey`, `codeLetter` and the `ChordSource` type.
  
  ```ts
  // before
  import { chordKey, codeLetter, type ChordSource } from '@weasel-js/ui-input';
  // after
  import { chordKey, codeLetter, type ChordSource } from '@weasel-js/gestures';
  ```
  
  <!-- entry: breaking api -->
- 174d6ef: `isOneChar` moved from `@weasel-js/ui-input` to `@weasel-js/registry`, beside `codePointFloor`; it is unchanged.
  
  ```ts
  // before
  import { isOneChar } from '@weasel-js/ui-input';
  // after
  import { isOneChar } from '@weasel-js/registry';
  ```
  
  <!-- entry: breaking api -->
- 00a0e96: `movedIndex` and `isNoopDrop` take the list's length, and read a gap past either end and an index outside the list as `moveItems` does.
  
  Both throw a `RangeError` for a length that is not a whole number, 0 or more.
  
  ```ts
  // before
  movedIndex([from], target);
  isNoopDrop(at, target);
  // after
  movedIndex([from], target, items.length);
  isNoopDrop(at, target, items.length);
  ```
  
  <!-- entry: breaking api fix -->
- 80b8f57: The sweep builders are `rangeSweep`, `valuesSweep`, `framesSweep` and `sweepUntil`.
  
  They were `range`, `values`, `frames` and `until`, from `@weasel-js/ui-input` and from ui's `Sequence` entry.
  
  ```tsx
  // before
  <Sequence aria-label="Digits" sweep={range({ from: 0, to: 9, step: 1 })}>{(n) => n}</Sequence>
  // after
  <Sequence aria-label="Digits" sweep={rangeSweep({ from: 0, to: 9, step: 1 })}>{(n) => n}</Sequence>
  ```
  
  <!-- entry: breaking api -->
- 1fe6cab: `@weasel-js/ui-input` no longer exports `Box`; `edgeScroll`, `headingCost` and `nearestToward` take geom's `Rect`, which has the same fields.
  
  ```ts
  // before
  import type { Box } from '@weasel-js/ui-input';
  // after
  import type { Rect } from '@weasel-js/geom';
  ```
  
  <!-- entry: breaking api -->
- 0481f49: `selection` is `createSelectionModel`, and `selectionOfEach` is `createEachSelectionModel`.
  
  The selection model factories are named for what they build.
  
  ```ts
  // before
  const model = selection({ value, onChange }, values);
  // after
  const model = createSelectionModel({ value, onChange }, values);
  ```
  
  <!-- entry: breaking api -->
- b8bb2d4: `dropSide` is imported from `@weasel-js/ui-input`, beside `dropBand` and `nearestGap`, instead of `@weasel-js/ui-logic`.
  
  Its behavior is unchanged; ui-logic no longer exports it.
  
  ```ts
  // before
  import { dropSide } from '@weasel-js/ui-logic';
  // after
  import { dropSide } from '@weasel-js/ui-input';
  ```
  
  <!-- entry: breaking api -->
- b8bb2d4: `pressStep`, `isPressKey`, and `IDLE_PRESS` move from `@weasel-js/ui-logic` to `@weasel-js/ui-input`.
  
  The `PressState` and `PressInput` types move with them.
  
  Their behavior is unchanged; ui-logic no longer exports them.
  
  ```ts
  // before
  import { IDLE_PRESS, pressStep } from '@weasel-js/ui-logic';
  // after
  import { IDLE_PRESS, pressStep } from '@weasel-js/ui-input';
  ```
  
  <!-- entry: breaking api -->
- 969aab0: `spanHold` is `spanClamp`: it moves a span inside bounds, keeping its length, or shortens it to them.
  
  ```ts
  // before
  const shown = spanHold(view, { from: 0, to: duration });
  // after
  const shown = spanClamp(view, { from: 0, to: duration });
  ```
  
  <!-- entry: breaking api -->
- 09dcf56: `spanPlace` is `spanFraction`, matching the `toFraction` of the map `spanMap` builds; it returns a value's fraction along a span.
  
  ```ts
  // before
  const f = spanPlace(view, t);
  // after
  const f = spanFraction(view, t);
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- a6e8651: `soloChanges` works out what an Alt-click on one switch in a list changes.
  
  The kept switches go on and the rest off, or, when that already holds, every switch goes back on.
  
  <!-- entry: new api -->
- 6276cc6: `SelectionModel.edit(from)` continues an edit of an earlier model of the same selection, reverting to where that one started.
  
  `createLiveSelectionModel`'s second argument is no longer read and can be left off.
  
  <!-- entry: api -->
- 677a841: `createLiveSelectionModel(current, count)`: a selection model that reads the model `current` returns at each call.
  
  An edit begun at a press then reports through the latest handler.
  
  Hand it to `sweepFrom` or `soloSweepFrom` where the run outlives the render that started it.
  
  <!-- entry: api -->
- cafdd8c: `soloFrom` and `soloSweepFrom` solo items of a selection model, and a `SelectionEdit` can `apply` several changes as one.
  
  `soloFrom(model, index, count, enabled?)` is what an Alt-press does, by `soloChanges`; `soloSweepFrom` is an Alt-sweep's run, worked out from the states at the press. `selectionKeys`' `activate` takes `{ alt }` and solos with it.
  
  <!-- entry: api -->
- 5024537: `wheelPixels` reads a wheel event's deltas in CSS px whatever its `deltaMode`: 16 px a line (`WHEEL_LINE_PX`), and the page you name a page.
  
  <!-- entry: api -->
- 7489853: `wholeColumns` is exported: the column count a tiled grid lays out for a given `columns`, its whole part, at least 1.
  
  <!-- entry: api -->

### Patch Changes

- 4f264d0: Values held between two bounds go through geom's `clamp` and `clamp01` rather than local copies.
  
  A loupe whose `minFactor` is above its `maxFactor` now settles on the low bound, as `clamp` does, where it settled on the high one.
  
  <!-- entry: rank=-5 behavior -->
- f6ee3ea: `edgePush` and `edgeScroll` answer no push for a pointer at `NaN`, and a full push past an end under an infinite margin, instead of `NaN`.
  
  <!-- entry: fix -->
- 65e8ece: `framesSweep` counts a `loop` below 1 as one whole pass, as the clock plays it.
  
  A `loop` of 0, 0.5 or a negative number now walks the frames the clock shows.
  
  <!-- entry: fix -->
- d868c48: `rangeSweep` walks and reads a range whose finite ends are too far apart to subtract, rather than treating it as endless.
  
  <!-- entry: fix -->
- dc5efa8: `sliderAt` picks a value on the step grid for a track whose `min` is infinite, starting the grid at `max`, or at 0 when both ends are infinite.
  
  <!-- entry: fix -->
- 510347b: An ordered slider with stops keeps a keyed thumb on a stop when the next stop is its neighbor's.
  
  <!-- entry: fix -->
- 8f28726: `sliderAt` with `strict` and no stops picks a value on the step grid and inside `min` to `max`, as it does without `strict`.
  
  <!-- entry: fix -->
- ff8c1f9: An Alt-click solo in `LayerList` or `EffectList` switches a row whose id is `__proto__` like any other.
  
  <!-- entry: fix -->
- 26cdc89: `soloFrom` and `soloSweepFrom` leave an item `enabled` refuses alone in a single selection too, as they already did in a multiple one.
  
  <!-- entry: fix -->
- ad94222: `timerScheduler` waits out a delay past 2³¹ − 1 ms and never runs on an infinite one, so a held stepper no longer repeats at once.
  
  <!-- entry: fix -->
- 2b0def2: A sweep's `at` throws a `RangeError` when read at `NaN`, rather than answering `NaN` or `undefined`.
  
  <!-- entry: fix -->
- 6276cc6: A `createLiveSelectionModel` sweep's revert puts back the value it started from, `null` or a value off the list included.
  
  <!-- entry: fix -->
- 61c9926: `spanValue` gives `span.to` itself at fraction 1.
  
  <!-- entry: fix -->
- Updated dependencies [e973dcd]
- Updated dependencies [851a4d3]
- Updated dependencies [d764d06]
- Updated dependencies [a98ad34]
- Updated dependencies [5f856dc]
- Updated dependencies [2c2ab71]
- Updated dependencies [e6b28fe]
- Updated dependencies [4fb8cbf]
- Updated dependencies [9249b26]
- Updated dependencies [97f1f86]
- Updated dependencies [ec44e4c]
- Updated dependencies [174d6ef]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [29d293c]
- Updated dependencies [269320b]
- Updated dependencies [c3da788]
- Updated dependencies [ece64a6]
- Updated dependencies [fcc5602]
- Updated dependencies [bfc26b4]
- Updated dependencies [935346c]
- Updated dependencies [0046729]
- Updated dependencies [fcc5602]
- Updated dependencies [ece64a6]
- Updated dependencies [ece64a6]
- Updated dependencies [36dac61]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [daba59f]
- Updated dependencies [7a053e0]
- Updated dependencies [acb38fe]
- Updated dependencies [644baad]
- Updated dependencies [cbd9a26]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [8257aa7]
- Updated dependencies [8c2d558]
- Updated dependencies [af85c85]
- Updated dependencies [6a9cd12]
- Updated dependencies [af85c85]
- Updated dependencies [5d79d0e]
- Updated dependencies [43e65cf]
- Updated dependencies [e280844]
- Updated dependencies [f889447]
- Updated dependencies [b9a8c62]
- Updated dependencies [a3caa9d]
- Updated dependencies [1dc92ce]
- Updated dependencies [ced5841]
- Updated dependencies [4949266]
- Updated dependencies [9f6da2d]
- Updated dependencies [15a78d8]
- Updated dependencies [f54c013]
- Updated dependencies [2acda2a]
- Updated dependencies [1cc8fea]
- Updated dependencies [3588b89]
- Updated dependencies [9a45d4a]
- Updated dependencies [4f2ce5c]
- Updated dependencies [4e54b4e]
- Updated dependencies [2b26641]
- Updated dependencies [eec8a23]
- Updated dependencies [353033f]
- Updated dependencies [27f0928]
- Updated dependencies [a3f0833]
- Updated dependencies [0157b15]
- Updated dependencies [4f35254]
- Updated dependencies [0118cd0]
- Updated dependencies [70213a5]
- Updated dependencies [4f9848f]
- Updated dependencies [4c0bb1b]
- Updated dependencies [4dff167]
- Updated dependencies [514f6ad]
- Updated dependencies [d455bd2]
- Updated dependencies [11c9e5f]
- Updated dependencies [241446a]
- Updated dependencies [81cc3f8]
- Updated dependencies [e0a11e4]
- Updated dependencies [e280844]
- Updated dependencies [a7fd87a]
- Updated dependencies [0f0c7e5]
- Updated dependencies [ce89e1f]
- Updated dependencies [c4d419b]
- Updated dependencies [da7dd2e]
- Updated dependencies [8cbcaf4]
- Updated dependencies [2d649c0]
- Updated dependencies [5b84935]
- Updated dependencies [02900a7]
- Updated dependencies [308226e]
- Updated dependencies [b2ecf6d]
- Updated dependencies [8af195e]
- Updated dependencies [7459739]
- Updated dependencies [5d43ec9]
- Updated dependencies [57af464]
- Updated dependencies [a947127]
- Updated dependencies [95bd84c]
- Updated dependencies [b7e560b]
- Updated dependencies [174d6ef]
- Updated dependencies [cfbecdb]
- Updated dependencies [9c2b3d6]
- Updated dependencies [03f84f2]
- Updated dependencies [8457029]
- Updated dependencies [22eec46]
- Updated dependencies [8fd3d6d]
- Updated dependencies [5b84825]
- Updated dependencies [516bc59]
- Updated dependencies [2338cee]
- Updated dependencies [57a59be]
- Updated dependencies [67968c3]
- Updated dependencies [8882b53]
- Updated dependencies [174d6ef]
- Updated dependencies [a20fc8c]
- Updated dependencies [a2fbf00]
- Updated dependencies [38e795b]
- Updated dependencies [e6871f1]
- Updated dependencies [1ad4f25]
- Updated dependencies [1eb7552]
- Updated dependencies [7863d23]
- Updated dependencies [de8f61d]
- Updated dependencies [56784d5]
- Updated dependencies [b54ab5f]
- Updated dependencies [ec23b4e]
- Updated dependencies [0ecff6a]
- Updated dependencies [de8f61d]
- Updated dependencies [28b5165]
- Updated dependencies [ff70ebe]
- Updated dependencies [0f43324]
- Updated dependencies [f4b9a4a]
- Updated dependencies [adb1290]
- Updated dependencies [4bda721]
- Updated dependencies [4f2d1e0]
- Updated dependencies [ece64a6]
- Updated dependencies [9c507b5]
- Updated dependencies [9c507b5]
- Updated dependencies [ff4504e]
- Updated dependencies [58f9d2e]
- Updated dependencies [c67bcfa]
- Updated dependencies [f04bbbc]
- Updated dependencies [0f60e3d]
- Updated dependencies [5124d5a]
- Updated dependencies [7645aaa]
- Updated dependencies [24bca7a]
- Updated dependencies [0f60e3d]
- Updated dependencies [3207a40]
- Updated dependencies [e49aa18]
- Updated dependencies [70076bc]
- Updated dependencies [6a9a3dc]
- Updated dependencies [e06225e]
- Updated dependencies [e0f4c91]
- Updated dependencies [38095a2]
- Updated dependencies [d30164d]
- Updated dependencies [04d5af6]
- Updated dependencies [04d5af6]
- Updated dependencies [c98a300]
- Updated dependencies [04d5af6]
- Updated dependencies [e7d580b]
- Updated dependencies [cdbafb8]
- Updated dependencies [3005391]
- Updated dependencies [3311dde]
- Updated dependencies [5b11625]
- Updated dependencies [afbe8c3]
- Updated dependencies [8bf1866]
- Updated dependencies [c4bcb94]
- Updated dependencies [7785bd5]
- Updated dependencies [e59f1ae]
- Updated dependencies [a8ff1e9]
- Updated dependencies [25e8f76]
- Updated dependencies [3a07b60]
- Updated dependencies [b73c8ef]
- Updated dependencies [6274bad]
- Updated dependencies [758459f]
- Updated dependencies [70213a5]
- Updated dependencies [b72cf48]
- Updated dependencies [b34f11e]
- Updated dependencies [04d5af6]
- Updated dependencies [5603bef]
- Updated dependencies [126d17f]
- Updated dependencies [d17a134]
- Updated dependencies [4e68cf0]
- Updated dependencies [ff5f066]
- Updated dependencies [f164d0e]
- Updated dependencies [586ca31]
- Updated dependencies [ba8d3a0]
- Updated dependencies [857e1fc]
- Updated dependencies [3f553ff]
- Updated dependencies [5d75785]
- Updated dependencies [dd5a540]
- Updated dependencies [4a4d7c9]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [6fcc7aa]
- Updated dependencies [eb8fe62]
- Updated dependencies [e9613f8]
- Updated dependencies [f004638]
- Updated dependencies [52d9d64]
- Updated dependencies [e3c67e9]
- Updated dependencies [34090f0]
- Updated dependencies [03b9392]
- Updated dependencies [15e923d]
- Updated dependencies [5962dc2]
- Updated dependencies [5dae54d]
- Updated dependencies [0208a3b]
- Updated dependencies [bb7bb11]
- Updated dependencies [ee1de44]
- Updated dependencies [56fda8d]
- Updated dependencies [f88d616]
- Updated dependencies [1c2c1ac]
- Updated dependencies [1d8e163]
- Updated dependencies [e08d172]
- Updated dependencies [429e80c]
- Updated dependencies [bd25e62]
- Updated dependencies [002ff57]
- Updated dependencies [7a7ea82]
- Updated dependencies [9521334]
- Updated dependencies [12cfcfc]
- Updated dependencies [415e5b8]
- Updated dependencies [e68cb62]
- Updated dependencies [0ee2887]
- Updated dependencies [767af8a]
- Updated dependencies [fb702eb]
- Updated dependencies [c11f37e]
- Updated dependencies [e39dbc5]
- Updated dependencies [98d2f9a]
- Updated dependencies [cf2ad81]
- Updated dependencies [60c082d]
- Updated dependencies [1e58c0d]
- Updated dependencies [d3b462a]
- Updated dependencies [49f1f5b]
- Updated dependencies [1f05956]
- Updated dependencies [a8efdf5]
- Updated dependencies [774e9cc]
- Updated dependencies [e841e68]
- Updated dependencies [18f7289]
- Updated dependencies [a5caeed]
- Updated dependencies [34b8a3f]
- Updated dependencies [e3148d0]
- Updated dependencies [8fb09ad]
- Updated dependencies [ba7e062]
- Updated dependencies [0d977b8]
- Updated dependencies [12816b7]
- Updated dependencies [aec0cec]
- Updated dependencies [5202a9f]
- Updated dependencies [174070d]
  - @weasel-js/geom@2.0.0
  - @weasel-js/quantity@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/registry@2.0.0

## 1.19.1

### Minor Changes

- 5159b4f: `chordKey(e)` and `codeLetter(code)` are exported: the key a shortcut reads a keystroke as, on any layout. A chord that typed no Latin character reads as the letter its key bears, so Ctrl+я is Ctrl+Z.
  
  <!-- entry: api -->
- a09ed24: `typeaheadSearching(buffer, now, resetMs?)` says whether a typeahead search is under way, the test a list uses to read a space as typed.
  
  <!-- entry: api -->

### Patch Changes

- 5159b4f: Mod+A selects every row of a list on a non-Latin keyboard layout. `rowKey` reads a `code` on the key it is given.
  
  <!-- entry: fix -->
- 250c105: Typeahead starts a new search on the first key after the system clock is set back, rather than adding it to the last search.
  
  <!-- entry: fix -->
- 8562ebe: Typeahead lands `ασ` on a label spelled `ΑΣ`, folding text the way `matchQuery` does.
  
  <!-- entry: fix -->
- Updated dependencies [c9adfef]
- Updated dependencies [97be45c]
- Updated dependencies [039b7ad]
- Updated dependencies [d254251]
- Updated dependencies [8562ebe]
  - @weasel-js/quantity@1.19.1
  - @weasel-js/registry@1.19.1

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
