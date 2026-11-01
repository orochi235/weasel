# @weasel-js/forge

## 1.15.1

### Patch Changes

- Updated dependencies [424ba52]
- Updated dependencies [9515681]
- Updated dependencies [5e66a10]
- Updated dependencies [2992b55]
- Updated dependencies [ae5ed82]
- Updated dependencies [8ad43af]
- Updated dependencies [7692a02]
- Updated dependencies [8b52282]
- Updated dependencies [87595a8]
- Updated dependencies [999fba9]
- Updated dependencies [8c13aee]
- Updated dependencies [120420a]
- Updated dependencies [b6a97f4]
- Updated dependencies [e982d8a]
- Updated dependencies [156bcd0]
- Updated dependencies [89e647e]
- Updated dependencies [fa1c9a7]
- Updated dependencies [ec16ac7]
- Updated dependencies [6f496e1]
- Updated dependencies [4b2a4e3]
- Updated dependencies [cb3b4a7]
  - @weasel-js/core@1.15.1
  - @weasel-js/ui@1.15.1
  - @weasel-js/clock@1.15.1
  - @weasel-js/labkit@1.15.1
  - @weasel-js/prefs@1.15.1
  - @weasel-js/theme@1.15.1
  - @weasel-js/svg@1.15.1
  - @weasel-js/icons@1.15.1
  - @weasel-js/react@1.15.1
  - @weasel-js/registry@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [c08f919]
- Updated dependencies [8461e7b]
- Updated dependencies [41dbc7b]
- Updated dependencies [332b8e5]
- Updated dependencies [70a64a3]
- Updated dependencies [f77e789]
- Updated dependencies [3ae7cda]
- Updated dependencies [d40f593]
- Updated dependencies [41a5648]
- Updated dependencies [0e60598]
- Updated dependencies [0a20b06]
- Updated dependencies [48b6c4c]
- Updated dependencies [e838373]
- Updated dependencies [a1cb281]
- Updated dependencies [8a3f058]
- Updated dependencies [2e2f76c]
- Updated dependencies [c41c917]
- Updated dependencies [fada838]
- Updated dependencies [d25ad30]
- Updated dependencies [1de1aab]
- Updated dependencies [fce0494]
- Updated dependencies [23ca95b]
- Updated dependencies [f2e728e]
- Updated dependencies [746fab0]
  - @weasel-js/ui@1.15.0
  - @weasel-js/core@1.15.0
  - @weasel-js/labkit@1.15.0
  - @weasel-js/theme@1.15.0
  - @weasel-js/svg@1.15.0
  - @weasel-js/clock@1.15.0
  - @weasel-js/icons@1.15.0
  - @weasel-js/prefs@1.15.0
  - @weasel-js/react@1.15.0
  - @weasel-js/registry@1.15.0

## 1.14.2

### Patch Changes

- 92d1993: Additive: a forge dev server now serves an edit the OS file watcher never reported. Each module is stamped with
  its file's modification time when vite reads it; a request for a module whose file has changed since, and a check
  of every served file once the watcher has been quiet for two seconds, sends the change through as if the event had
  arrived, and logs `[watch] <file> changed with no file event`. `watchRecovery()` from `@weasel-js/forge/vite` gives
  any other vite dev server the same, and the `[watch]` warning about missing file events says when a server has it.
- Updated dependencies [012cae5]
- Updated dependencies [ae38d2e]
- Updated dependencies [dc5a786]
- Updated dependencies [4bba14d]
- Updated dependencies [d05de93]
- Updated dependencies [875b5aa]
  - @weasel-js/core@1.14.2
  - @weasel-js/prefs@1.14.2
  - @weasel-js/ui@1.14.2
  - @weasel-js/labkit@1.14.2
  - @weasel-js/registry@1.14.2
  - @weasel-js/svg@1.14.2
  - @weasel-js/theme@1.14.2
  - @weasel-js/clock@1.14.2
  - @weasel-js/icons@1.14.2
  - @weasel-js/react@1.14.2

## 1.14.1

### Patch Changes

- Updated dependencies [a23117a]
  - @weasel-js/ui@1.14.1
  - @weasel-js/labkit@1.14.1
  - @weasel-js/clock@1.14.1
  - @weasel-js/core@1.14.1
  - @weasel-js/icons@1.14.1
  - @weasel-js/prefs@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/registry@1.14.1
  - @weasel-js/svg@1.14.1
  - @weasel-js/theme@1.14.1

## 1.14.0

### Patch Changes

- 9912c13: Loading a snapshot of a clock with a finite loop count (`loop: n`) brings it back in the pass it was saved in, with its `ended` and time left, where it used to land in the first pass at the saved time within the pass. A trial clock reopened at a position its first run cannot reach yet waits in that pass too. `holdElapsed(handle, position)` in `@weasel-js/clock` holds a clock at a recorded `HeldPosition` across the whole run the way `holdAt` holds a time within a pass, re-placing it as the span changes; a position recorded under another `duration` or `origin` keeps its pass and the time it showed within it. This adds API.
  
  A snapshot whose config turns a trial's clock back on opens the new clock at the snapshot's position. A lab lets go of a trial's snapshot hold when the trial closes.
  
  A trial's clock is made in a layout effect rather than during render, so under StrictMode a `ClockSpec.mix` factory runs once per clock. The clock is there by the first paint, but not in the trial's first render; in that render the trial's clock resolves to none, never to the focused trial's or the lab's.
  
  `useClockLoop` reads the registry's clocks and targets when the registry changes, not on every frame.
  
  `useTrialClock`, `useTrialClockHandle`, `useTrialMix`, `useClockFrame` and `useTransportControl` take a `trialId` of `null`, which resolves no clock and subscribes to none. forge's `useTimeline` uses it so a story with a clock of its own, such as one on an index page inside a lab, no longer re-renders on every frame of the focused trial.
- 3d36f5e: New package `@weasel-js/clock`: labkit's trial clock, moved out so it has no React and no DOM. `createClock`, `clockPosition`, `ClockSpec`, `Clock`, `ClockHandle`, `ClockPosition`, `ClockedMix`, `CLOCK_RATES`, and `createClockRegistry`, whose `lab` field is now `shared`; the frame loop `useClockLoop` is in `@weasel-js/clock/react`. labkit keeps `ClockCapability`, `TrialClock`, `ClockPosition` and `ClockedMix` as aliases, and `TRANSPORT_RATES` in ui is `CLOCK_RATES`.
  
  `ClockSpec` takes `origin`, the time `elapsed` 0 is shown as (display only), and `speed`, the unsigned speed a transport plays a paused clock at. `Clock` reads both back. `ClockHandle.declare(spec)` takes up a new `duration`, `origin` and `speed`, and `loop` only when the declared `loop` changed, keeping the pass and the time shown within it, clamped to the new run. Writing `Clock.loop` so the run ends before `elapsed` keeps the time within the pass. `shownInPass` reads a looping clock's time within its pass. This adds API.
  
  `holdAt(handle, shown)` returns a `PlayheadHold`: it pauses the clock at a time shown within a pass and keeps it there as the span moves, waiting at the pass's end for a time the span cannot reach yet. `createClockRegistry`'s `register(id, handle, target)` takes a `ClockTarget` resolving the element showing a clock, and `targets(handle)` lists them; the frame loop stops advancing a clock, other than the shared one, while every target of it is out of the viewport, and rebases it when one comes back.
  
  The ui `Transport` takes `start`, where its scrub bar begins, so it can show a playhead before zero. labkit exports `useTransportControl` and `TransportControl`; `TransportControl` gains `start`, `touched` and `touch`, its `playhead` and `seek` work in shown time, and the keyboard Home and End and `labkit:seek` follow.
  
  labkit exports `useTrialClockHandle`, the resolver behind `useTrialClock`. A snapshot records where the trial's clock stands when it is saved, playing or never moved included, and loading it holds the clock at that time.
  
  `ClockHandle.override(span)` replaces the declared `duration` and `origin` until called with `null`, and a later `declare` leaves it in place. `ClockPosition` records `origin` when it differs from the declared one, `createClock` reopens at it, and a reopened trial clock comes back at the time it showed. `holdAt`, `declare` and `override` place a time on a pass boundary at the end of the pass before.
  
  forge's story timelines run on the shared clock. A story's `timeline` declares its trial's labkit clock, so the trial's transport is labkit's `TrialTransport` (its scrub bar is named "Position"), it shows a lead-in below zero, and the paused playhead is kept in the trial's record rather than in a `$playhead` config key. A config saved with `$playhead` still opens, without the key reaching the story. `usePlayhead`, `useTimeline` and the `TimelineSpec`, `TimelineSpan` and `SpanOverride` types keep their shape. The URL's `t` and a capture's playhead are the time shown within the pass. Changes in behavior: a span set at runtime keeps the playhead's shown time rather than following the span's start, and a story left playing reopens playing, where it used to reopen paused. A timeline with a duration or rate that is not a positive number runs as 1 ms or at speed 1 instead of throwing.
- 34a12a2: The Accessibility panel no longer asks for a review of every story's text contrast. axe judged contrast against the whole workshop page, so it gave up on text under labkit's overlay canvas (light mode) or over the lab's starfield backdrop (dark mode); forge now judges those elements itself with the workshop left out, using axe's own stack, color parsing, and thresholds, and reports them as passes or violations. Text the story itself makes undecidable, such as a button's gloss, stays under "Needs review", and every review item now says why in plain words. `A11yNode` gains an optional `reason` carrying axe's message key and sentence.
- a4e858e: The accessibility panel's automatic check on opening a story waits for the story's first render, so it reports what the story holds rather than an empty host ("0 violations · 0 to review").
- e707130: An index page's examples no longer sit in a bordered frame: each story renders straight onto the page, on the same surface fill as before.
- fc94e24: The workshop's Issues panel is connected under the dev server. It lists the focused component's open issues labeled `forge:<component>` in the repository the checkout's `origin` names, through `gh issue list` and the machine's own `gh` login, so no token reaches the browser; with `gh` missing or not logged in, the panel says so in place of the list. Report opens GitHub's new-issue page with the title, the `forge:<component>` label, and a body carrying the description, the story, a link reopening it with the trial's args and globals, and the branch and commit; a screenshot is pasted there. A built workshop has no dev server, and its panel still says it is not connected.
  
  A workshop URL can pin a trial's globals: a param named by the pin's config path (`$globals.mode=dark`) pins that global on the trial the story opens in, and is dropped from the URL once read. `mountWorkshop` and `Workshop` take `issuesBase`, the dev server base the panel asks.
- f3e9cdb: The workshop's right sidebar gains an Issues panel for the focused story's component: a list of its open issues and a form for reporting one. No tracker is connected yet, so the list says so and Report stays disabled.
- 785682b: A story that names no layout is now `padded` in both story formats; native stories defaulted to `centered` and CSF stories to `padded`. A prop typed `ReactNode`, or any union of a string with an object, no longer gets a text control from the prop reader, which put an empty text row on many stories; a union of a string with other scalars still does.
- 9114edc: A mark export of a story that was never near the viewport now captures the story. Its host renders nothing while
  out of view, so the export used to draw the marks over an empty background; the export now renders the story for
  the capture, waits for it to paint, and lets it unmount again after.
- 6d3da89: A mark export of a story captured before its first paint no longer comes out transparent: the capture's copy of
  the story host drops the pending state that hides the host until its fonts have painted.
- 69edb4c: Marks are back in the workshop, behind View → Marks, which starts off. A story or index page rendered in the
  workshop document takes marks over its host, and an export draws them over a capture of the host. Isolated
  stories, rendered in a frame, take none.
- c9caa50: `TreeNode` takes an `href`, which draws the row as a link: a plain or Shift click activates it as before, while a Cmd, Ctrl, Alt or middle click is left to the browser, so a row can open in a new tab. It also takes `current`, which sets `aria-current` and colors the row with `--wzl-tree-current`. A link row shows the pointer cursor, and `--wzl-tree-row-h` sets every row's height, falling back to `--wzl-control-h` as before.
  
  forge's story sidebar is now built on `Tree`, so it gains the tree's type-ahead and row styling. Its rows keep their links, Shift-click still opens another trial, and the fold marks and the Lab and package badges stay where they were. A component's row is now a link to its index page too.
- ab10a1d: A `<CanvasStack>` in a same-origin frame that the embedding page shows enlarged backs its canvases at the scale it is shown at, as it already did under a scaled ancestor in its own document, and measures again on its window's `resize`. A Live lens's copy of an isolated story is drawn sharp at its factor rather than enlarged, and forge sends the copy's frame a `resize` when the lens changes factor.
- 47abfc3: Marks on a forge story now belong to its scrolled content: they move with it as the story scrolls, and an export
  pictures the whole content rather than the top of it.
  
  Adds API to labkit: an annotation target can declare `shown`, the part of its content box its element shows (for a
  scroller, its scroll offset and its own size), and `fitView` takes it as an optional third argument. A target is
  asked for again whenever anything inside its element scrolls.
  
  Fixes `toWeaselView` and `fromWeaselView`, which copied labkit's pan (a screen translation) into weasel's `x`/`y`
  (the world point at the corner) unchanged. A target whose camera pans, and a target cut off by a clipping ancestor,
  drew and stored its marks in the wrong place.
  
  Marks a forge story already had were placed against the story's box; on a story taller than its trial they now land
  against the content instead.
- 4f68c3a: `@weasel-js/react` exports `useNearViewport(ref, margin, initial?)`, which says whether an element lies within a CSS margin of the viewport, and keeps following it as it scrolls away and back. It goes by where the element is, so content an `overflow` ancestor clips away still counts as near. forge's story frames use it from here; forge now depends on `@weasel-js/react`.
- 1632abe: `runStory` gives a story with no `viewport` the page's height, as the workshop's stage fills its preview. Under an
  auto height a story that fills its host was laid out 0 tall, and a lab there looped its ResizeObservers.
- Updated dependencies [d8fbd3d]
- Updated dependencies [b4cc0d7]
- Updated dependencies [575e470]
- Updated dependencies [b108984]
- Updated dependencies [e379713]
- Updated dependencies [dc6d8ec]
- Updated dependencies [0c13006]
- Updated dependencies [eb7b1f2]
- Updated dependencies [956e980]
- Updated dependencies [db3320e]
- Updated dependencies [8b758f4]
- Updated dependencies [d2215f3]
- Updated dependencies [ccac61a]
- Updated dependencies [e060cc9]
- Updated dependencies [47656e3]
- Updated dependencies [ad58b32]
- Updated dependencies [f045da7]
- Updated dependencies [ac7aa31]
- Updated dependencies [34563f9]
- Updated dependencies [9de8a22]
- Updated dependencies [0c6c086]
- Updated dependencies [99fc88d]
- Updated dependencies [a1b06d8]
- Updated dependencies [9912c13]
- Updated dependencies [3d36f5e]
- Updated dependencies [fe65ac0]
- Updated dependencies [9725598]
- Updated dependencies [592b6e5]
- Updated dependencies [41a013b]
- Updated dependencies [965e698]
- Updated dependencies [fda48f1]
- Updated dependencies [070f3d0]
- Updated dependencies [f2188ba]
- Updated dependencies [78d1904]
- Updated dependencies [59df8ac]
- Updated dependencies [0dc2a78]
- Updated dependencies [66beda1]
- Updated dependencies [1127bb2]
- Updated dependencies [8b14236]
- Updated dependencies [418b51f]
- Updated dependencies [8cf9a8f]
- Updated dependencies [e06efe0]
- Updated dependencies [61e07e5]
- Updated dependencies [88573be]
- Updated dependencies [b142892]
- Updated dependencies [c9caa50]
- Updated dependencies [ab10a1d]
- Updated dependencies [14f8583]
- Updated dependencies [e7f4305]
- Updated dependencies [2f3d924]
- Updated dependencies [c01c5f0]
- Updated dependencies [23bb196]
- Updated dependencies [783756a]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [6a69c27]
- Updated dependencies [3f8797e]
- Updated dependencies [b0a55a6]
- Updated dependencies [5c8636b]
- Updated dependencies [6cb0cf6]
- Updated dependencies [5b7d0ac]
- Updated dependencies [930f2fa]
- Updated dependencies [edc7324]
- Updated dependencies [a370edb]
- Updated dependencies [e7fca17]
- Updated dependencies [1d39cf6]
- Updated dependencies [e5ea7e8]
- Updated dependencies [6e9dd04]
- Updated dependencies [bb43cea]
- Updated dependencies [4be6d8d]
- Updated dependencies [fc87bab]
- Updated dependencies [317759a]
- Updated dependencies [6307eb2]
- Updated dependencies [22472a1]
- Updated dependencies [ec6d7d3]
- Updated dependencies [8661e5c]
- Updated dependencies [edccd1d]
- Updated dependencies [e1c5f2a]
- Updated dependencies [e45fc59]
- Updated dependencies [80789ff]
- Updated dependencies [f695cff]
- Updated dependencies [b1b16ce]
- Updated dependencies [47abfc3]
- Updated dependencies [0f80b76]
- Updated dependencies [9cf8984]
- Updated dependencies [b15704a]
- Updated dependencies [4aa138a]
- Updated dependencies [81d08f7]
- Updated dependencies [74456b1]
- Updated dependencies [46e9fa7]
- Updated dependencies [a29d2df]
- Updated dependencies [4aa9b8b]
- Updated dependencies [39cb8ed]
- Updated dependencies [a58fb4f]
- Updated dependencies [8e6ed97]
- Updated dependencies [18c96c3]
- Updated dependencies [f30c624]
- Updated dependencies [b06e2b9]
- Updated dependencies [fbe234c]
- Updated dependencies [9a3626f]
- Updated dependencies [533ffb4]
- Updated dependencies [28f476b]
- Updated dependencies [ffdbbcf]
- Updated dependencies [ee97c81]
- Updated dependencies [024b698]
- Updated dependencies [af0ee83]
- Updated dependencies [43454f5]
- Updated dependencies [4b22185]
- Updated dependencies [34a364e]
- Updated dependencies [4c0141f]
- Updated dependencies [f9282f7]
- Updated dependencies [01b103e]
- Updated dependencies [230a206]
- Updated dependencies [089609a]
- Updated dependencies [8a8faaa]
- Updated dependencies [2e4943e]
- Updated dependencies [19e4c11]
- Updated dependencies [a80f8be]
- Updated dependencies [6940f43]
- Updated dependencies [8ddaf05]
- Updated dependencies [234cac7]
- Updated dependencies [8e2c8c8]
- Updated dependencies [4f68c3a]
- Updated dependencies [0af338b]
- Updated dependencies [ebe1f55]
- Updated dependencies [5b7f963]
- Updated dependencies [a10f0f2]
- Updated dependencies [b444374]
- Updated dependencies [dacf535]
- Updated dependencies [8a60d40]
- Updated dependencies [3401898]
- Updated dependencies [134ed96]
- Updated dependencies [7e4c7c4]
- Updated dependencies [5967c5c]
- Updated dependencies [0dd5658]
- Updated dependencies [2bdc135]
- Updated dependencies [a4b6c5b]
- Updated dependencies [16f7828]
- Updated dependencies [0ac4e47]
- Updated dependencies [8c7fb03]
- Updated dependencies [3b25c35]
- Updated dependencies [058fcdf]
- Updated dependencies [1a64358]
- Updated dependencies [99a8383]
- Updated dependencies [96a8314]
- Updated dependencies [412732d]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [871a56b]
- Updated dependencies [1fb8193]
- Updated dependencies [f645651]
- Updated dependencies [eb43052]
- Updated dependencies [348a400]
- Updated dependencies [76bdca3]
- Updated dependencies [dd03e4b]
- Updated dependencies [1968706]
- Updated dependencies [1e54d33]
- Updated dependencies [bcb58bc]
- Updated dependencies [d061f4d]
- Updated dependencies [a533742]
- Updated dependencies [97d889f]
- Updated dependencies [9adc0cd]
- Updated dependencies [38c9f3c]
- Updated dependencies [ca31c35]
- Updated dependencies [4558f6f]
- Updated dependencies [775b724]
- Updated dependencies [c9cbbf0]
- Updated dependencies [44f3536]
- Updated dependencies [01a320d]
- Updated dependencies [8cdd272]
- Updated dependencies [670f22a]
- Updated dependencies [69d6ede]
- Updated dependencies [7a6f462]
- Updated dependencies [de97d4d]
- Updated dependencies [9abd787]
- Updated dependencies [ed23ccb]
- Updated dependencies [461b6e1]
- Updated dependencies [09442dc]
- Updated dependencies [fceb8c5]
  - @weasel-js/core@1.14.0
  - @weasel-js/ui@1.14.0
  - @weasel-js/labkit@1.14.0
  - @weasel-js/clock@1.14.0
  - @weasel-js/svg@1.14.0
  - @weasel-js/prefs@1.14.0
  - @weasel-js/react@1.14.0
  - @weasel-js/theme@1.14.0
  - @weasel-js/icons@1.14.0
  - @weasel-js/registry@1.14.0

## 1.13.0

### Patch Changes

- e8552a9: A Live lens backs its copy of a story in the compared mode, so a transparent story under an opposite-mode lens no
  longer shows the lab through it. The workshop applies an isolated story's copy's globals to the copy's host through
  the frame config's `applyGlobals`, as it already did for an in-document story's host, and the copy's host and the
  lens's "Nothing under the reticle" message paint `--wzl-surface`: they named `--wzl-bg`, which no theme defines, and
  so painted nothing.
- 15d0020: An index page's variant rows pass axe's `heading-order` and `landmark-unique` checks. Each row is headed `h3` under its story's `h2`, where it was an `h4`, and its region is named for the story and the row (`Primary: Size`) rather than the row alone, which every story's rows shared.
- b0ee823: A lens over a scrolled isolated story shows the patch under its reticle. The story's frame reports where its document stands with a new `scroll` message, and the shell scrolls each Live copy's frame to match (a `scroll` message to the frame) and sends that position with a Pixels capture, which used to be taken at the top.
- e293de1: A Live lens comparing nothing now updates its Token and Contrast readouts when the story under it changes. Those readouts read the main story, but the source only told them of changes to the lens's own copy, so a hover, a focus, or a menu opened in the story left them on their old reading until the lens next rendered.
- b30a139: A Live lens tells its readouts about a change to the story under it once per visible frame, rather than once per DOM
  mutation, so an animating story no longer keeps Token and Contrast recomputing styles on every mutation.
- 1cd810b: Two Follow lenses in the workshop each keep their own reticle: moving the focus from one to the other no longer snaps the first back to its pinned pose. A lens's held pose is let go when it closes or leaves Follow, by an action or by an undo or redo.
  
  `LensActionApi.unfollow` now takes the lens id, so a host lets go of that lens's hold alone. This is a breaking change for a host implementing its own `LensActionApi`.
- 5747300: A Pixels or Difference lens over a component's index page shows a capture of the page, where it used to say "this trial shows no story to capture". The capture page renders an index id as the workshop does, with the shell config's libraries and the component graph's dependencies and history. `mountCapture` takes `libraries` and `dependencies` for this.
- 6bb74c2: **Breaking.** Four props now decide how a component looks, and each is a hint the component draws from as it sees fit: `stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact color). They replace a prop that meant two things and four spellings of severity. Color resolves as tint, then grade, then stance; emphasis sets how loudly it shows. Stance and emphasis pass to everything inside a surface; grade and tint do not, so a `danger` dialog's Cancel button stays plain.
  
  | Was | Now |
  |---|---|
  | `status="accent"` / `"muted"` / `"neutral"` | `emphasis="high"` / `"low"` / nothing |
  | `status="success"`, `"warn"`, `"danger"`, `"info"` | `grade="…"` |
  | Badge `status="custom"` with `--badge-edge` | `tint={…}` |
  | `tone={…}` (palette index or color), KeyDiagram's per-key `tone` | `tint={…}` |
  | `stance="scope"` | `stance="clarify"` |
  | `stance="danger"` / `"notice"` / `"important"` | `grade="danger"` / `grade="warn"` / `emphasis="high"` |
  | Button `variant="primary"` / `"secondary"` | `stance="confirm"` / the default `variant="solid"` |
  | Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
  | labkit Toolbar `variant="danger"` | `grade="danger"` |
  
  New stances are `confirm` and `cancel`. `useStance`, `StanceProps` and the `@weasel-js/ui/stance` subpath are gone; use `useAppearance`, `AppearanceProps` and `@weasel-js/ui/appearance`. `BadgeStatus`, `CodeStatus`, `ButtonStatus`, `DetailRowStatus` and `ToastTone` are deleted; `Grade`, `Emphasis` and `Stance` are exported in their place, and `DetailRow`, labkit `Readout` and Toast take `grade`. `BADGE_STATUS_ICONS` is now `GRADE_ICONS` and `EMPHASIS_ICONS`, exported from `@weasel-js/ui` and `@weasel-js/ui/appearance`, and the status glyphs are `gradeSuccess`, `emphasisHigh` and `emphasisLow`.
  
  In `@weasel-js/theme`: `GRADES`, `GRADE_TOKENS`, `EMPHASES`, `EMPHASIS_FG`, `EMPHASIS_SLOTS` and `GRADE_SLOTS` join `STANCES`. `TONE_REF` is `TINT_REF` (`{ ref: 'tint' }`), the theme's tone list is its tint list (`ThemeProvider tints`, `useTints`, a theme's `"tints"`), and hud's `tones` option is `tints`. Stance tokens are renamed: `--wzl-stance-scope-*` → `--wzl-stance-clarify-*`, `--wzl-stance-<s>-tone(-mix)` → `-tint(-mix)`, `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`, `--wzl-button-primary-*` → `--wzl-button-confirm-*`; the danger, notice and important stance tokens are removed. A new `--wzl-info` token colors the info grade, so info badges and toasts take it, where info toasts used the accent before. Badge's `warn` now uses `--wzl-warning` rather than its own amber.
  
  <!-- bump-approved: minor: maintainer — 1.13.0-rc release requested 2026-10-24 -->
- be41abc: A component whose only story restates its name — a file titled `…/Heading control` exporting `HeadingControl` — now lists once in the story tree and the Components list, as that story under the component's name, instead of as a folder holding a same-named story. Its breadcrumb drops the repeated name the same way.
- 2fa9733: An index page's story entries drop their Open button: the story's title is now the link that opens it, and its live example sits to the right of the title and description, wrapping beneath them when the frame is too narrow.
- 2d21c25: A story file tagged `lab` is a whole screen for exercising a component rather than a specimen of it: its index page entries link to it without embedding an example or a variant grid, and it carries a Lab badge there and in the sidebar. `LAB_TAG` is exported beside `GALLERY_TAG`.
- 1757c3c: Story and component descriptions on index pages and in the info dialog now draw their inline markdown (code spans, emphasis, links) and break into paragraphs at blank lines, where they used to print as plain text.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- 19eea3d: Several story files can share one title. The file named for the title's last segment (`Bar.stories.tsx` for `ui/Bar`) speaks for the component: its stories list first in the tree, the Components list and the index page, and its meta's description is the component's. Each file's own meta still applies to its own stories.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- Updated dependencies [42d4c13]
- Updated dependencies [b1c691a]
- Updated dependencies [16464c5]
- Updated dependencies [30a8aaf]
- Updated dependencies [7c1134c]
- Updated dependencies [cf08540]
- Updated dependencies [4e648f5]
- Updated dependencies [7163e00]
- Updated dependencies [627ba8d]
- Updated dependencies [1cd810b]
- Updated dependencies [6a71a83]
- Updated dependencies [05a4fa5]
- Updated dependencies [f1c1528]
- Updated dependencies [9a76fb5]
- Updated dependencies [6bb74c2]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c5ed0d0]
- Updated dependencies [5d58e92]
- Updated dependencies [81a2c50]
- Updated dependencies [8f2edfe]
- Updated dependencies [25e0d6f]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [ee9e277]
- Updated dependencies [0d97246]
- Updated dependencies [4b6e14d]
- Updated dependencies [3f45450]
- Updated dependencies [5f28e9c]
- Updated dependencies [2d1b1f0]
- Updated dependencies [79ca5bc]
- Updated dependencies [ee4cb7c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [a243bd9]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [b992f80]
- Updated dependencies [5eb75a1]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [7191306]
- Updated dependencies [06c809d]
- Updated dependencies [4f4f148]
- Updated dependencies [1322310]
- Updated dependencies [ad82e2b]
- Updated dependencies [4f42d9c]
- Updated dependencies [4be32cf]
- Updated dependencies [7e3463d]
- Updated dependencies [fb5bb67]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [683b998]
- Updated dependencies [bbee4df]
- Updated dependencies [a1b479a]
- Updated dependencies [dee201c]
- Updated dependencies [5eaf191]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/ui@1.13.0
  - @weasel-js/theme@1.13.0
  - @weasel-js/core@1.13.0
  - @weasel-js/prefs@1.13.0
  - @weasel-js/labkit@1.13.0
  - @weasel-js/svg@1.13.0
  - @weasel-js/icons@1.13.0
  - @weasel-js/registry@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 6bb74c2: **Breaking.** Four props now decide how a component looks, and each is a hint the component draws from as it sees fit: `stance` (the angle it comes from), `grade` (how serious), `emphasis` (how loud), and `tint` (an exact color). They replace a prop that meant two things and four spellings of severity. Color resolves as tint, then grade, then stance; emphasis sets how loudly it shows. Stance and emphasis pass to everything inside a surface; grade and tint do not, so a `danger` dialog's Cancel button stays plain.
  
  | Was | Now |
  |---|---|
  | `status="accent"` / `"muted"` / `"neutral"` | `emphasis="high"` / `"low"` / nothing |
  | `status="success"`, `"warn"`, `"danger"`, `"info"` | `grade="…"` |
  | Badge `status="custom"` with `--badge-edge` | `tint={…}` |
  | `tone={…}` (palette index or color), KeyDiagram's per-key `tone` | `tint={…}` |
  | `stance="scope"` | `stance="clarify"` |
  | `stance="danger"` / `"notice"` / `"important"` | `grade="danger"` / `grade="warn"` / `emphasis="high"` |
  | Button `variant="primary"` / `"secondary"` | `stance="confirm"` / the default `variant="solid"` |
  | Toast `tone: 'warning' \| 'error'`, `toast.warning`, `toast.error` | `grade: 'warn' \| 'danger'`, `toast.warn`, `toast.danger` |
  | labkit Toolbar `variant="danger"` | `grade="danger"` |
  
  New stances are `confirm` and `cancel`. `useStance`, `StanceProps` and the `@weasel-js/ui/stance` subpath are gone; use `useAppearance`, `AppearanceProps` and `@weasel-js/ui/appearance`. `BadgeStatus`, `CodeStatus`, `ButtonStatus`, `DetailRowStatus` and `ToastTone` are deleted; `Grade`, `Emphasis` and `Stance` are exported in their place, and `DetailRow`, labkit `Readout` and Toast take `grade`. `BADGE_STATUS_ICONS` is now `GRADE_ICONS` and `EMPHASIS_ICONS`, exported from `@weasel-js/ui` and `@weasel-js/ui/appearance`, and the status glyphs are `gradeSuccess`, `emphasisHigh` and `emphasisLow`.
  
  In `@weasel-js/theme`: `GRADES`, `GRADE_TOKENS`, `EMPHASES`, `EMPHASIS_FG`, `EMPHASIS_SLOTS` and `GRADE_SLOTS` join `STANCES`. `TONE_REF` is `TINT_REF` (`{ ref: 'tint' }`), the theme's tone list is its tint list (`ThemeProvider tints`, `useTints`, a theme's `"tints"`), and hud's `tones` option is `tints`. Stance tokens are renamed: `--wzl-stance-scope-*` → `--wzl-stance-clarify-*`, `--wzl-stance-<s>-tone(-mix)` → `-tint(-mix)`, `--wzl-panel-tone-mix` → `--wzl-panel-tint-mix`, `--wzl-button-primary-*` → `--wzl-button-confirm-*`; the danger, notice and important stance tokens are removed. A new `--wzl-info` token colors the info grade, so info badges and toasts take it, where info toasts used the accent before. Badge's `warn` now uses `--wzl-warning` rather than its own amber.
  
  <!-- bump-approved: minor: maintainer — 1.13.0-rc release requested 2026-10-24 -->
- be41abc: A component whose only story restates its name — a file titled `…/Heading control` exporting `HeadingControl` — now lists once in the story tree and the Components list, as that story under the component's name, instead of as a folder holding a same-named story. Its breadcrumb drops the repeated name the same way.
- 2fa9733: An index page's story entries drop their Open button: the story's title is now the link that opens it, and its live example sits to the right of the title and description, wrapping beneath them when the frame is too narrow.
- 2d21c25: A story file tagged `lab` is a whole screen for exercising a component rather than a specimen of it: its index page entries link to it without embedding an example or a variant grid, and it carries a Lab badge there and in the sidebar. `LAB_TAG` is exported beside `GALLERY_TAG`.
- 1757c3c: Story and component descriptions on index pages and in the info dialog now draw their inline markdown (code spans, emphasis, links) and break into paragraphs at blank lines, where they used to print as plain text.
- 79ca5bc: forge builds a control for far more of a component's props. A prop typed as an array, a tuple, an object or a union of objects gets a control built from its parts: a list edited entry by entry, an object edited field by field, and a union of objects that each pin one field to a string edited as a choice of that string with the chosen object's own fields under it. A union a string may stand in, such as a `ReactNode`, gets a text field, and a union mixing string literals with types no control edits offers the literals. An argType may give a value's shape itself through `type`, Storybook's `SBType`, now exported as `ArgShape`. An object type declared in a dependency, or open to any key, gets no control.
  
  `BandEditor`'s stories pass every arg through, so its panel now edits the display (fraction, decimal or percent, with each one's options), the ticks, the label, the range limits and the selected band, beside the range, scale and snapping it already had.
- 19eea3d: Several story files can share one title. The file named for the title's last segment (`Bar.stories.tsx` for `ui/Bar`) speaks for the component: its stories list first in the tree, the Components list and the index page, and its meta's description is the component's. Each file's own meta still applies to its own stories.
- 773f9c8: Several writers can now override one node at once. Each entry set on `scene.overrides` is a ply over the ones set before it: for each field the most recently claimed ply that gives it wins, `alpha` multiplies through every ply, and `data` runs each ply's function on what the plies under it show. Releasing a ply shows what lies under it. A ply's `path` is drawn in the box of the `pose` it gives beside it, so a pose laid over it by another writer, such as a move over a skinned node, carries the path along; a path given with no pose is drawn where it is. So a gesture's published preview no longer gives way where another writer holds the node: the data a move previews for a transform follower shows while the move holds the follower's pose, and an edge whose live route is eased shows the drag's reroute beside the route, so what derives from either follows every frame.
  
  `has` and `clear` take an optional `entry`, to check or release one writer's ply: `has(id, entry)`, `clear(id, entry)`. `clear(id)` still drops every ply of the node; each keeps its place, so a writer that sets its entry again goes back where it stood. `get(id)` answers the top ply. A hand-written `PoseOverrides` must honor `entry` on both: a writer releasing its own ply must not clear another's. This is a behavior change for a writer that set an entry over another's to replace it, or that checked `get(id) === entry` to know its own was still installed: the earlier entry now stays and shows again when the later one goes, and `get` answers only the top one. A hold's `show` no longer leaves an id another writer holds to that writer; it lays its frame over it. `PoseHold.others()` answers each node's topmost pose that is not the hold's own, where it answered the pose of whichever single entry the node held.
  
  `PoseTransitionScene.overrides` now needs `read` where it needed `has`: the undo glide skips only a node something else poses, not one showing a data draft. A container's descendants likewise ride along with its pose animation unless another writer poses them. Rigs and pose targets put their override back when the table drops it, and a pose target retargeted mid-run keeps running when its own write reflows a layout. Labkit's `LensActionApi` gains `unfollow`, which Pinned and Close call to let go of the follow hold alone.
- 4be32cf: **Breaking.** Slider's `density` is gone, and with it the slim face (an accent-tinted thumb with no border or blur). Size a slider with numbers instead: `trackHeight` and the new `thumbSize` each take px or a CSS length, such as `var(--wzl-slider-track-h)`. `thumbShape` sets the shape of every thumb that names none of its own, and `ThumbShape` gains `dot`, a circle centered on the track, beside `notched`. The default rounded-rect thumb, which was `'round'`, is now `'tab'`. A former `density="slim"` is `thumbShape="dot" trackHeight="var(--wzl-slider-track-h)" thumbSize="var(--wzl-slider-thumb-size)"`, and the thumb wears the default face.
- Updated dependencies [6bb74c2]
- Updated dependencies [7e5f9e3]
- Updated dependencies [c5ed0d0]
- Updated dependencies [5d58e92]
- Updated dependencies [81a2c50]
- Updated dependencies [8f2edfe]
- Updated dependencies [25e0d6f]
- Updated dependencies [38d5ad1]
- Updated dependencies [7edd3be]
- Updated dependencies [cbb16ca]
- Updated dependencies [ee9e277]
- Updated dependencies [0d97246]
- Updated dependencies [4b6e14d]
- Updated dependencies [3f45450]
- Updated dependencies [5f28e9c]
- Updated dependencies [2d1b1f0]
- Updated dependencies [79ca5bc]
- Updated dependencies [ee4cb7c]
- Updated dependencies [e70d2cd]
- Updated dependencies [ed89d42]
- Updated dependencies [04b862d]
- Updated dependencies [7e7549c]
- Updated dependencies [d5a9a80]
- Updated dependencies [3519c96]
- Updated dependencies [c7516cd]
- Updated dependencies [a243bd9]
- Updated dependencies [773f9c8]
- Updated dependencies [39c72a4]
- Updated dependencies [1f2a0b3]
- Updated dependencies [b992f80]
- Updated dependencies [5eb75a1]
- Updated dependencies [8c39126]
- Updated dependencies [3eaceb1]
- Updated dependencies [7191306]
- Updated dependencies [06c809d]
- Updated dependencies [4f4f148]
- Updated dependencies [1322310]
- Updated dependencies [ad82e2b]
- Updated dependencies [4f42d9c]
- Updated dependencies [4be32cf]
- Updated dependencies [7e3463d]
- Updated dependencies [fb5bb67]
- Updated dependencies [a0bc69f]
- Updated dependencies [ceae749]
- Updated dependencies [769eef8]
- Updated dependencies [683b998]
- Updated dependencies [bbee4df]
- Updated dependencies [a1b479a]
- Updated dependencies [dee201c]
- Updated dependencies [5eaf191]
- Updated dependencies [aba2016]
- Updated dependencies [4c113da]
  - @weasel-js/theme@1.13.0-rc.0
  - @weasel-js/ui@1.13.0-rc.0
  - @weasel-js/labkit@1.13.0-rc.0
  - @weasel-js/core@1.13.0-rc.0
  - @weasel-js/svg@1.13.0-rc.0
  - @weasel-js/prefs@1.13.0-rc.0
  - @weasel-js/icons@1.13.0-rc.0
  - @weasel-js/registry@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 78f29de: Lenses in weaselforge. Alt+L opens the Loupe keymap, and `l` adds a lens: a bubble showing the patch
  of a story under its reticle, magnified, or rendered with a comparison such as the opposite mode, an
  arg or a DPR, as Swap, Split or Difference. A lens shows a Live second render or, from the dev
  server, Pixels captured in headless Chromium; Playwright is a new optional peer of
  `@weasel-js/forge`, and without it a lens offers Live only. Token, Contrast and pixel-grid readouts
  sit in the lens chrome, and Alt+Slash opens a panel listing every key binding the workshop
  registers.
  
  Everything below is additive.
  
  forge: the shell config takes `capture.allowOrigins`, naming what a capture page may load besides
  the dev server, and `loupe.modeGlobal`, the global an opposite-mode comparison flips. A global
  declaration may give `opposite(value, globals)`, the value that comparison flips it to.
  `<TrialHost>` takes a `copy` prop, which makes the host a second copy of a trial's story, under
  globals of its own. `@weasel-js/forge/shell` exports `followEdits`, and `@weasel-js/forge/frame`
  exports `mountCapture`, which mounts a capture page.
  
  labkit: the loupe entry gains `<LensOverlay>` (whose `renderReadouts` is handed `LensReadoutProps`),
  `<LensActions>`, the lens scene and its ops, the `LensSource` contract, `createLoupeKeymap`,
  `probeUnderLens` and `LENS_REST_MS`. A lab has an `overlay` chrome region, rendered over the trials
  inside the lab surface, and `useLabEntries` reads the ambient entries installed on the lab, its
  keymaps among them. Each lab surface gains a `'top'` canvas layer for one tenant above `'over'`,
  made only while a tenant asks for it; a surface owner offers it by publishing `top` and `claimTop`
  in its `SurfaceCanvases`. `surface.scope()` takes a list of elements as well as one
  (`SurfaceScope`).
  
  Elsewhere: `@weasel-js/core/json` exports `stableStringify` for Node; paint exports `contrastRatio`
  and `wcagLevels`; svg exports `specificity`, `compareSpecificity` and `splitTopLevel`; an action's
  `enabled` may return a reason as text (`ActionUnavailable` in routing, re-exported by core), which
  the command palette shows as written.
- 2c52cc5: `parseColor` reads `color(srgb …)`, `color(srgb-linear …)`, `oklab()` and `oklch()`, clamping the OK spaces into sRGB. A browser computes every `color-mix()` to `color(srgb …)`, so the workshop's Token readout no longer reports such a color as unreadable.
  
  A workshop lens shows the new story after a switch to another one, where it showed "Nothing under the reticle" until something else changed, and a Live lens shows a component's index page. A Pixels lens captures a story whose config holds unset (undefined) args, which it refused as unsendable.
  
  A lens body takes resize handles at its corners only. A round body resized into an ellipse clips its view to that ellipse, inside its rim, where the view covered all but two slivers of the rim.
- 51f79a2: A lens's reticle marks the patch the lens shows: the body's box divided by the factor, in the body's shape, where it was a fixed 16 px circle. It resizes with a new factor and, in the same undo step, with its body. It takes no resize handles. `RETICLE_SIZE` is removed, which breaks any import of it; `reticleAt` places a Follow reticle at its current size.
  
  A lens's chrome strip hangs below the reach of its body's handles, so the bottom handles of a selected body take presses again.
  
  `<CanvasStack>` sizes its canvases from its layout box and puts any ancestor transform's scale into their backing density. Under a magnifying lens it draws sharp, where it used to enlarge a canvas sized from its scaled client rect. The density is capped at 4096² backing pixels a layer.
- dcc03c4: A story taller than its trial makes forge's scroller a tab stop, a region named for the trial, so a
  keyboard can scroll it and the Accessibility panel no longer reports `scrollable-region-focusable`
  against the workshop. A story that fits leaves the scroller out of the tab order. labkit now exports
  `useTrialTitle` and `TrialTitleContext`, the enclosing trial's title as its title bar shows it.
- Updated dependencies [dbd6711]
- Updated dependencies [c482e73]
- Updated dependencies [94ed4c2]
- Updated dependencies [9ffd9ca]
- Updated dependencies [0996ce6]
- Updated dependencies [69d135f]
- Updated dependencies [3716e73]
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [c9a3b7d]
- Updated dependencies [1cc3d07]
- Updated dependencies [78f29de]
- Updated dependencies [92a0f2d]
- Updated dependencies [c697535]
- Updated dependencies [c2fb65c]
- Updated dependencies [15561be]
- Updated dependencies [2c52cc5]
- Updated dependencies [51f79a2]
- Updated dependencies [94ebd35]
- Updated dependencies [cef877b]
- Updated dependencies [24f2495]
- Updated dependencies [d9fd036]
- Updated dependencies [f461572]
- Updated dependencies [2e45ddb]
- Updated dependencies [0276e6e]
- Updated dependencies [6e29d46]
- Updated dependencies [3bf5edb]
- Updated dependencies [e9304f4]
- Updated dependencies [08162a9]
- Updated dependencies [dcc03c4]
- Updated dependencies [92b8df8]
- Updated dependencies [91a1d84]
- Updated dependencies [1a72259]
- Updated dependencies [eec50d7]
  - @weasel-js/ui@1.12.0
  - @weasel-js/core@1.12.0
  - @weasel-js/svg@1.12.0
  - @weasel-js/labkit@1.12.0
  - @weasel-js/theme@1.12.0
  - @weasel-js/prefs@1.12.0
  - @weasel-js/icons@1.12.0
  - @weasel-js/registry@1.12.0

## 1.11.1

### Patch Changes

- 4573b46: `OverlayPortalProvider` takes `contained`: its container stands in for the viewport. A `Dialog` below it covers the
  container rather than the window, traps focus, and makes inert only what the container holds, leaving the rest of
  the page usable and its scrolling alone. React Aria's modal hides the whole document and locks its scroll with no
  way to scope either, so a contained `Dialog` is built from React Aria's public pieces instead.
  
  forge's in-page trials are contained, so a story's modal dims its own trial and the workshop stays usable around
  it. A story now scrolls inside its trial host rather than the host scrolling, so an overlay it portals stays over
  the trial however far the story has scrolled.
- aaead9a: The workshop's Accessibility panel outlines the elements a finding names while the pointer or keyboard focus is on
  it: a whole rule outlines every element it failed, one selector outlines just that element. The frame protocol
  gains an `a11y.highlight` message carrying the targets to outline; an empty list clears them. An isolated story
  with the `fullscreen` layout now gets a frame as tall as the viewport, so a child at `height: 100%` fills it.
- 9f6d0e0: The sidebar's Components view nests a component whose title extends another's in the same library inside that
  component, ahead of its stories, as the Tree view does: `Primitives/Prefs/Split values` sits under `Prefs` rather
  than as a top-level `Split values`. A filter that drops the parent leaves the child on its own row.
- 33cef5b: forge's CSS Vars panel is hidden by default, behind a new toggle in the lab header beside Info. The lab remembers
  whether it was left on. `cssVars: false` still leaves out the panel, and now the toggle with it.
- 6336a60: An index page's history now reads `Created <date> (<version>)` and `Modified <date> (<version>)`: the release that shipped the component's first commit joins its created date in place of the separate Since row, and the modified date carries the first release holding the last change, or `unreleased` while none does.
- 1302429: A story test gives a story's `viewport` to the box the story renders in, as the workshop's stage does, instead of resizing the browser page. The resize was a round trip through Playwright that took 7 to 13 s on a loaded machine, so a story with a viewport, and the story after it, could time out. `RunStoryOptions` loses its `viewport` callback, and the tests forge generates no longer import `vitest/browser`.
- 11ef039: A story in the workshop document now sees its trial as a size container, so `100cqb` and `100cqi` are the
  trial's height and width the way `100vh` and `100vw` were a frame's. `LabShell` sizes to the nearest size
  container before the viewport, so a lab story fills its trial instead of running a window's height past it.
  Outside any size container a shell is `100cqb`, which falls back to the small viewport height: on a phone,
  the height with the browser's toolbars shown rather than `100dvh`'s current height.
- 9267f75: Five new `@weasel-js/ui` entry points reach exports that were only on the root barrel: `@weasel-js/ui/stance` (`useStance` and its types), `@weasel-js/ui/portal-host` (`OverlayPortalProvider`, `useOverlayPortal` and the rest of the overlay portal helpers), `@weasel-js/ui/color` (`oklchToHex`, `chromaAt`, `rampColor`, `colorRamp`), `@weasel-js/ui/paint-gradient-track` (`paintGradientTrack`) and `@weasel-js/ui/kit-settings` (`uiKitSettingsSchema`). The root barrel still exports what it did. forge and labkit now import ui only by subpath, outside labkit's `weasel-ui` passthrough.
- 2fc887a: labkit and forge import `@weasel-js/ui` through its component subpaths (`@weasel-js/ui/components/<Name>`) instead of the root barrel, wherever a subpath publishes the name. Nothing changes for a consumer: labkit re-exports the same names, and its `weasel-ui` subpath still re-exports the barrel.
- Updated dependencies [70b12d1]
- Updated dependencies [162d3a8]
- Updated dependencies [5b5135c]
- Updated dependencies [02037a7]
- Updated dependencies [e6f374a]
- Updated dependencies [6d94b67]
- Updated dependencies [3b5750f]
- Updated dependencies [768be71]
- Updated dependencies [9390be4]
- Updated dependencies [1dd65f5]
- Updated dependencies [411b629]
- Updated dependencies [267d5e4]
- Updated dependencies [922cddf]
- Updated dependencies [d5a4102]
- Updated dependencies [9cd12f7]
- Updated dependencies [e5ba382]
- Updated dependencies [8e317f5]
- Updated dependencies [abf41a7]
- Updated dependencies [312eb35]
- Updated dependencies [7ffc196]
- Updated dependencies [25a112b]
- Updated dependencies [4d99526]
- Updated dependencies [4573b46]
- Updated dependencies [853ce69]
- Updated dependencies [8c1861a]
- Updated dependencies [6440997]
- Updated dependencies [44cf2c5]
- Updated dependencies [8ff750f]
- Updated dependencies [161c9c4]
- Updated dependencies [33fa471]
- Updated dependencies [2eb0370]
- Updated dependencies [c726003]
- Updated dependencies [e30f4df]
- Updated dependencies [8c2a9a9]
- Updated dependencies [1156d63]
- Updated dependencies [adadf5e]
- Updated dependencies [b3aa7cb]
- Updated dependencies [c89153d]
- Updated dependencies [f0172e2]
- Updated dependencies [ee2f0fc]
- Updated dependencies [716561f]
- Updated dependencies [ee4cf85]
- Updated dependencies [d892435]
- Updated dependencies [1a1bb83]
- Updated dependencies [c497405]
- Updated dependencies [7865ca5]
- Updated dependencies [00bfbc7]
- Updated dependencies [0e24110]
- Updated dependencies [c2dfd4e]
- Updated dependencies [66def8d]
- Updated dependencies [4bf5dec]
- Updated dependencies [fe2a8c5]
- Updated dependencies [d8dc50f]
- Updated dependencies [8cd81e7]
- Updated dependencies [23dbaff]
- Updated dependencies [b7e6edc]
- Updated dependencies [2c53843]
- Updated dependencies [87cded1]
- Updated dependencies [24267d3]
- Updated dependencies [683dea0]
- Updated dependencies [26fdff3]
- Updated dependencies [7411f6e]
- Updated dependencies [61e7b0c]
- Updated dependencies [f819e61]
- Updated dependencies [6be0cfa]
- Updated dependencies [5053f5b]
- Updated dependencies [2b267d5]
- Updated dependencies [bf359a2]
- Updated dependencies [ac892f8]
- Updated dependencies [71d4416]
- Updated dependencies [566e321]
- Updated dependencies [1bb4752]
- Updated dependencies [e9404d0]
- Updated dependencies [11ef039]
- Updated dependencies [849f9e4]
- Updated dependencies [9267f75]
- Updated dependencies [2fc887a]
- Updated dependencies [433540d]
  - @weasel-js/core@1.11.1
  - @weasel-js/ui@1.11.1
  - @weasel-js/labkit@1.11.1
  - @weasel-js/theme@1.11.1
  - @weasel-js/prefs@1.11.1
  - @weasel-js/icons@1.11.1
  - @weasel-js/registry@1.11.1

## 1.11.0

### Patch Changes

- 6d766b0: The CSS Vars panel's Story tab lists only the variables the story uses: those read by a rule that matches an element in it or by its inline styles, and every variable those read in turn through a definition that reaches it. Before, it listed every `var()` in every stylesheet the document had loaded, the whole of weasel-ui's included. A checkbox, "Show variables the story doesn't use", brings the rest back. Each `CssVarReport` carries the answer as `used`.
- d7e093e: The workshop's globals are also a Globals menu on the lab's menu bar; the header toolbar keeps its selects.
- 9aeddfc: Get Info's ⌘I is the Info command's own key rather than a window listener. Ctrl+I on a Mac no longer opens Info: Mod is Meta there, as for every other lab key.
- 63b310c: Icons are named, not drawn, by the code that uses them. This is breaking.
  
  `@weasel-js/icons` is new. An icon is a qualified name, `namespace:name` (`core:undo`, `ui:close`, `path-tools:reversePath`), held as an `IconRef`. Each package's `icon()` makes one and qualifies its own bare names: in core, `icon('undo')` is `core:undo`. A registry supplies the glyphs: mount `<IconRegistryProvider icons variants>` from `@weasel-js/core` at the app root, or give `<WeaselProvider>` its new `icons` and `iconVariants` props. Core, ui and path-tools each publish their table at `./icons` (`import { icons } from '@weasel-js/ui/icons'`). A name no registered table holds draws a placeholder and warns in development, and draws nothing in production.
  
  `@weasel-js/icons-plugin` is new too. Its build plugin, `weaselIcons`, ships only the glyphs a build names. In an app's vite, rollup or rolldown build, `weaselIcons.vite({ mode: 'app' })` serves `virtual:weasel-icons`, holding the glyphs named by the app and by the weasel packages it imports, and fails the build on a name no table holds. `virtual:weasel-icons/all`, `/<namespace>` and custom variants each load as their own chunk, asked for with `useIconVariant(name)`. Types for the virtual modules are at `@weasel-js/icons-plugin/virtual`. The plugin is its own package so that installing `@weasel-js/icons` does not install a native parser. Core's and ui's `dist` is no longer minified, so the `@icon` annotations the plugin reads survive; a consumer's bundler minifies.
  
  What breaks:
  
  - routing: `Action.icon`, `ActionVariant.icon`, `ActionItem.icon` and `ToolPresentation.icon` take an `IconRef` from `icon()`, not a React node. So does `useCommand`'s `icon` option, which no longer takes a function read each time the command shows.
  - prefs: `PrefBase.icon` and an enum option's `icon` take an `IconRef`, not a free string. A schema saved with bare names, such as `"icon": "close"`, now draws nothing for them and warns in development; write `"ui:close"`.
  - core, ui and path-tools: the `…Icon` components are removed; draw `<Icon name={icon('core:rect')} />` instead. `NudgeAnchorsIcon` and its `dir` prop become four glyphs, `core:nudgeAnchors` (pointing right), `core:nudgeAnchorsUp`, `core:nudgeAnchorsDown` and `core:nudgeAnchorsLeft`. Core's `PaintKindEntry.icon` and `PaintKindFamily.icon` take an `IconRef`. Core's `ACTION_GLYPHS`, `IconProps` and `ActionGlyphProps` are gone, and so are ui's `ICON_PATHS`, `ICON_FILLS`, `ICON_GROUPS`, `MARK_ICONS`, `IconName`, `MarkIconName`, `FillableIconName` and `ActionIconSource`.
  - ui: `<Icon name>` and `mark`, `actionIcon` and `ActionBar`'s `icons` take `IconRef`s, and `isFillable` takes a glyph. `resolveIcon` draws a ref, or a qualified string read from data. `iconFromData(value)` reads a name from data as a ref, warning once in development about a bare one.
  - labkit: `CommandItem`, `ToolItem`, `ViewportControl` and `TrialTool` take an `IconRef` as `icon`, and so does `ConfigOption.icon`. `IconComponent`, the nine ui icon components labkit re-exported, and its `ICON_PATHS` and `IconName` are gone.
  - forge: `GlobalDeclaration.icon` takes an `IconRef`. `FrameSetup.icons` registers an app's own tables in every frame. A story's `control.icons` argTypes option takes qualified names (`'ui:statusSuccess'`); a bare `'statusSuccess'` now draws nothing.
  
  `@weasel-js/registry` exports `isDev()`, which `@weasel-js/react` re-exports. It reads `process.env.NODE_ENV`, which a production bundle folds to `false`, and the development diagnostics in core, routing, ui, labkit, renderer and animator all read it.
- ce8b295: `@weasel-js/ui/kit-icons` exports `kitIcons`, core's and ui's icon tables in one list, for a registry that should hold every kit glyph without the build plugin. Forge's workshop and story frames register it in place of their own copy of the list. Additive.
- Updated dependencies [304f53a]
- Updated dependencies [3ffe020]
- Updated dependencies [652e692]
- Updated dependencies [0d6fc26]
- Updated dependencies [b882b2e]
- Updated dependencies [60d8e39]
- Updated dependencies [2573527]
- Updated dependencies [ed0e096]
- Updated dependencies [465ccd9]
- Updated dependencies [65be8d3]
- Updated dependencies [10b67bb]
- Updated dependencies [b064816]
- Updated dependencies [d8c0d51]
- Updated dependencies [2bf7339]
- Updated dependencies [6f839dd]
- Updated dependencies [327fb63]
- Updated dependencies [5338358]
- Updated dependencies [97a672c]
- Updated dependencies [7116c36]
- Updated dependencies [1c76897]
- Updated dependencies [1e3e770]
- Updated dependencies [4447e67]
- Updated dependencies [84dd318]
- Updated dependencies [e0608bf]
- Updated dependencies [b0f392c]
- Updated dependencies [cf7b009]
- Updated dependencies [53ba41a]
- Updated dependencies [1322a03]
- Updated dependencies [4da5998]
- Updated dependencies [7162a7a]
- Updated dependencies [765cd31]
- Updated dependencies [89271a6]
- Updated dependencies [72a0ea2]
- Updated dependencies [14b7551]
- Updated dependencies [eec8a5b]
- Updated dependencies [1774dc4]
- Updated dependencies [8ff3b4b]
- Updated dependencies [02cbe1d]
- Updated dependencies [d2749ce]
- Updated dependencies [75d52be]
- Updated dependencies
- Updated dependencies [5b20cca]
- Updated dependencies [516914b]
- Updated dependencies [0fc9447]
- Updated dependencies [c2b951b]
- Updated dependencies [6525caa]
- Updated dependencies [f4dd2ff]
- Updated dependencies [5adbb76]
- Updated dependencies [681c3f9]
- Updated dependencies [0382007]
- Updated dependencies [4a44657]
- Updated dependencies [a41d50f]
- Updated dependencies [d0daf94]
- Updated dependencies [63b310c]
- Updated dependencies [b36ceac]
- Updated dependencies [34f8b09]
- Updated dependencies [5e7ee7b]
- Updated dependencies [5a48607]
- Updated dependencies [aa27fa7]
- Updated dependencies [620d2db]
- Updated dependencies [1c9459d]
- Updated dependencies [cabeeab]
- Updated dependencies [ce8b295]
- Updated dependencies [c6a0a52]
- Updated dependencies [e74bb61]
- Updated dependencies [628c62d]
- Updated dependencies [d32cb70]
- Updated dependencies [7ffb8c1]
- Updated dependencies [4057097]
- Updated dependencies [50396d5]
- Updated dependencies [9aeddfc]
- Updated dependencies [10308d2]
- Updated dependencies [80fcaa1]
- Updated dependencies [98870f1]
- Updated dependencies [d86f89e]
- Updated dependencies [2d6bd43]
- Updated dependencies [6812344]
- Updated dependencies [fb75358]
- Updated dependencies [ef6b6ae]
- Updated dependencies [09e5589]
- Updated dependencies [1e47009]
- Updated dependencies [e4642bb]
- Updated dependencies [90851d1]
- Updated dependencies [797bf34]
- Updated dependencies [0f5bd40]
- Updated dependencies [e901a2b]
- Updated dependencies [ce41b60]
- Updated dependencies [fb44d45]
- Updated dependencies [57725cc]
- Updated dependencies [2f51085]
- Updated dependencies [c6d61e0]
- Updated dependencies [3f89d6b]
- Updated dependencies [86725ed]
- Updated dependencies [f34b290]
- Updated dependencies [679138c]
- Updated dependencies [a2dcbfb]
- Updated dependencies [8ad0483]
- Updated dependencies [e34bfb5]
- Updated dependencies [8775065]
- Updated dependencies [76f7ecb]
- Updated dependencies [d4d28ad]
- Updated dependencies [ad8f48a]
- Updated dependencies [5274f79]
- Updated dependencies [c4840ed]
- Updated dependencies [616a4b2]
- Updated dependencies [0677769]
- Updated dependencies [974682d]
- Updated dependencies [66e3696]
- Updated dependencies [5973184]
- Updated dependencies [7afe8cd]
- Updated dependencies [3378ade]
- Updated dependencies [c0d59c6]
- Updated dependencies [f426089]
- Updated dependencies [ddbb431]
- Updated dependencies [dcca70c]
- Updated dependencies [420e4b2]
- Updated dependencies [bfb566c]
- Updated dependencies [d019f44]
- Updated dependencies [79b65f5]
- Updated dependencies [cc54285]
- Updated dependencies [67fb8e7]
- Updated dependencies [e021579]
- Updated dependencies [36eca7a]
- Updated dependencies [cc11671]
- Updated dependencies [c1680fd]
- Updated dependencies [0430dcc]
- Updated dependencies [1be2ea9]
- Updated dependencies [0156ca5]
- Updated dependencies [39f86d1]
- Updated dependencies [f3398d4]
- Updated dependencies [17029b0]
- Updated dependencies [9a85264]
- Updated dependencies [ae77c1c]
- Updated dependencies [804e3cf]
- Updated dependencies [86a5ec7]
- Updated dependencies [c2048de]
- Updated dependencies [7947fdf]
- Updated dependencies [6533d2d]
- Updated dependencies [9073669]
- Updated dependencies [798e9b0]
- Updated dependencies [f082c83]
- Updated dependencies [db8c16e]
- Updated dependencies [e287da2]
- Updated dependencies
- Updated dependencies [59b5936]
- Updated dependencies [3eb2abc]
- Updated dependencies [e554ae5]
- Updated dependencies [70fe7cc]
- Updated dependencies [c4e499e]
- Updated dependencies [5ebf7e7]
- Updated dependencies [b91a818]
- Updated dependencies [ecdf4d0]
- Updated dependencies [1efa251]
- Updated dependencies [146c859]
- Updated dependencies [1faab2d]
- Updated dependencies [15fbffb]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
- Updated dependencies [ebc9858]
- Updated dependencies [06d23a3]
- Updated dependencies [d8160be]
  - @weasel-js/registry@1.11.0
  - @weasel-js/prefs@1.11.0
  - @weasel-js/core@1.11.0
  - @weasel-js/ui@1.11.0
  - @weasel-js/labkit@1.11.0
  - @weasel-js/theme@1.11.0
  - @weasel-js/icons@1.11.0

## 1.10.1

### Patch Changes

- fb213d2: The CSS Vars panel's Theme tab opens on the values the theme gives each token under the trial's globals. It used to show the manifest's defaults, which are dark mode's, until the story first reported, so a light story's palettes changed color a moment after load.
- f42b2d5: The CSS Vars panel saves a token that differs by mode while the trial's mode is Auto. The save writes the branch for the OS color scheme, the one the story is showing; it used to offer no save for such a token until the mode was set to Light or Dark.
- 64e5dff: The workshop's story tree scrolls under its own head. The view switch, the package filter, and the search field stay where they are, and only the list of stories moves.
- d238e07: An isolated story whose viewport the index cannot read, a computed size or a CSF story's `parameters.viewport`, no longer reloads its frame when first opened. The viewport arrives with the frame's `ready` and puts the story in a stage; the loaded frame now moves into it. A browser without `Element.moveBefore` still reloads the frame once.
- 6144e72: Additive: `watchProbe()` from `@weasel-js/forge/vite` is a plugin that gives any vite dev server the warning forge's own prints when the OS reports no file changes, so a server that is serving stale modules says why. The warning's prefix is now `[watch]`.
- Updated dependencies [b6e04e2]
- Updated dependencies [2445052]
- Updated dependencies [113c088]
- Updated dependencies [cbd5b4d]
- Updated dependencies [d3b73b9]
- Updated dependencies [aaa2b4f]
- Updated dependencies [1fe1c2b]
- Updated dependencies [3d15a20]
- Updated dependencies [c7b7ed5]
- Updated dependencies [faf8ff3]
- Updated dependencies [8bee821]
- Updated dependencies [a7bd356]
- Updated dependencies [88b8840]
- Updated dependencies [6e99dbd]
- Updated dependencies [19da739]
- Updated dependencies [d8c9a75]
- Updated dependencies [67a7de8]
- Updated dependencies [a713caa]
- Updated dependencies [f6e3e90]
- Updated dependencies [74ba77e]
- Updated dependencies [a8e8048]
- Updated dependencies [63fff44]
- Updated dependencies [755b7ff]
- Updated dependencies [1d3ca5c]
- Updated dependencies [fa20203]
- Updated dependencies [566f15e]
- Updated dependencies [ee59ccd]
- Updated dependencies [e88b291]
- Updated dependencies [a05096a]
- Updated dependencies [f22f5ce]
- Updated dependencies [7810d7c]
- Updated dependencies [88322e8]
- Updated dependencies [e41f61f]
- Updated dependencies [ddfa72f]
- Updated dependencies [f7827d4]
- Updated dependencies [09b0bf2]
- Updated dependencies [947ced3]
- Updated dependencies [92e6291]
- Updated dependencies [ff35a6d]
- Updated dependencies [b3b5ccd]
- Updated dependencies [2216d1b]
- Updated dependencies [784e255]
- Updated dependencies [40cbb3b]
- Updated dependencies [a7144f4]
- Updated dependencies [35c4879]
- Updated dependencies [886380f]
- Updated dependencies [e771f58]
- Updated dependencies [f8faa63]
- Updated dependencies [5b890ad]
- Updated dependencies [3bc85c9]
- Updated dependencies [d0c3896]
- Updated dependencies [3448831]
- Updated dependencies [d30823f]
- Updated dependencies [815a447]
- Updated dependencies [42db2c4]
- Updated dependencies [0be7a53]
- Updated dependencies [f51ecce]
- Updated dependencies [27fe0fb]
- Updated dependencies [8bbf878]
- Updated dependencies [b5267f9]
- Updated dependencies [85d4035]
- Updated dependencies [b8fbcc5]
- Updated dependencies [62e766c]
- Updated dependencies [5485d35]
- Updated dependencies [690ea72]
- Updated dependencies [7a9d331]
- Updated dependencies [22f129f]
- Updated dependencies [e962494]
- Updated dependencies [bad37cf]
- Updated dependencies [9e84e5d]
- Updated dependencies [c56fc4a]
- Updated dependencies [1e6d23f]
- Updated dependencies [ef29364]
- Updated dependencies [2f48645]
- Updated dependencies [1f32358]
- Updated dependencies [52f488f]
- Updated dependencies [15dede7]
- Updated dependencies [14f6571]
- Updated dependencies [0c4a384]
- Updated dependencies [92c2e8e]
- Updated dependencies [711ae46]
- Updated dependencies [365eae0]
- Updated dependencies [fd4520a]
- Updated dependencies [781a15e]
- Updated dependencies [a092978]
  - @weasel-js/ui@1.10.1
  - @weasel-js/labkit@1.10.1
  - @weasel-js/core@1.10.1
  - @weasel-js/theme@1.10.1
  - @weasel-js/registry@1.10.1

## 1.10.0

### Patch Changes

- 18547a3: Adds API: `cssColorLiteral(css)` in `@weasel-js/paint` reads any color string `parseColor` reads as an `srgb` `ColorLiteral`, and throws as it does on one it cannot. `colorLiteralToCss(literal)` writes a literal as a CSS color: hex where `colorLiteralToHex` has one, else `color(<space> …)`.
  
  Adds API: `@weasel-js/theme` resolves a paint `ColorSource` under a theme. `colorSourceCss(source, ctx?)` writes one as a CSS color and `colorSourceLiteral(source, ctx?)` resolves one to a literal for a surface with no cascade; `useColorCss()` in `@weasel-js/theme/react` is the first against the provider in force. A `ColorRef` names, in order: an entry of the palette on the context; `tone` (`TONE_REF`) with an index into the tone list, wrapping; a theme token by its name without the `--wzl-` prefix (`{ ref: 'accent' }`); a ramp by name with the index of a step (`{ ref: 'swatch', index: 3 }`); or a custom property spelled out (`{ ref: '--my-color' }`), which need not be the theme's. A ref the theme answers is written to CSS as its custom property, so it follows a mode change without a re-render; a palette entry or a function is written as the literal it resolves to in the provider's selection.
  
  Adds API: `<ThemeProvider palette>` takes a paint `Palette` whose names a `ColorRef` in that subtree resolves before the theme's own, and `ThemeContextValue` carries it as `palette`. These rules for what a ref names were chosen on an agent's judgment.
  
  Breaking: a `tone` is `number | ColorSource`, no longer `number | string`. That is `StanceProps.tone` in `@weasel-js/ui`, so every stanced surface (`Badge`, `Button`, `Callout`, `Code`, `Dialog`, `LayerList` items, `MotifFrame`, `Powerline` segments, `PropertyGroup`, `PropertyPanel`, `Subpanel`), labkit's `ControlPanel`, `ControlMatrix`, and sidebar sections, and forge's `Library.tone`. An index is unchanged. A CSS string no longer typechecks: write a color as `cssColorLiteral('#2b6cb0')`, a theme token as `{ ref: 'accent' }`, and anything only CSS can say as a custom property of your own, `{ ref: '--my-tone' }`. A tone nothing answers now draws as no tone. `@weasel-js/ui` now depends on `@weasel-js/paint`.
  
  Breaking: the other colors `@weasel-js/ui` takes are `ColorSource` too, each written through `useColorCss`: `Plot2D`'s `grid.color` and `axes.color`, `CurveField`'s mark `color`, the `color` of a curve `fill` (`FillSettings`, on `CurveEditor` and `createFunctionLayer`), and the Badge effects' `outline.color`, `sunbeams.color`, `metal.accent`, and `aqua.accent`. Each one's default draws as before.
  
  Breaking: `@weasel-js/hud` names colors the same way. A window's `tone` (`WindowOptions.tone`, `setTone`) is `number | ColorSource`, and the draw contexts (`HudDrawCtx`, `HudContentCtx`) carry `color(source)`, a source resolved to a hex, in place of `toneAt(i)`; a widget that called `ctx.toneAt(2)` calls `ctx.color({ ref: 'tone', index: 2 })`. `AttachHudOptions.tones` is a `ColorSourceContext`, so its tone list is optional and it may carry a palette.
- b3f1e4a: history: `swapOp` builds an op that swaps one whole value for another and carries both as `args`, so a serialized history can rebuild the step. `@weasel-js/core` re-exports it with `SwapArgs` and `SwapOpOptions`. `PrefSchemaEditor`'s own swap is now a call to it.
  
  forge: the CSS Vars panel keeps an undo history of a trial's edits. Undo and Redo sit beside the filter, and Mod+Z / Shift+Mod+Z step from anywhere in the panel except the filter's text. Typing a value is one step, and so is a scale edit with every token it regenerates. The steps are kept with the trial, so they outlive a reload, held to the last 100. Saving scales into the theme forgets them. A trial's scale edits are kept with the trial now (`fg-css-vars-scales` was lab-wide), so a scale edited in one trial no longer shows in another.
- 69accee: A subscriber that throws no longer stops the subscribers after it, or throws into whatever caused the notify, in forge's stores: a channel's `on`, the story clock, the trial clocks and trial frames, the answer book, the story changes, and the tree reveal. Each now notifies through `createEmitter`, so the error goes to `console.error` as `weasel: a subscriber threw`. A subscriber added during a notify now waits for the next one. `@weasel-js/forge` now depends on `@weasel-js/registry`.
- de319ce: Types a public signature names are exported now, so a consumer can write them down and the API reference links to them. All additions; nothing is renamed or removed.
  
  - core: `ViewLike`, `TargetTransform`, `WeightEnv`.
  - diagram: `DiagramRouter`, `DiagramTextStyle`, `DiagramDerivePose`, `Forest`.
  - font: `DynamicFace`.
  - forge: `ArgCondition`, `ComponentHistory`, `StoryGlobals`, `StoryLayout`, `StoryViewport`, `TimelineSpan`; from `/frame`, `Channel`, `ToFrame`, `FromFrame`, `ConfigAnswers`, `FaultPhase`; from `/shell`, `StoryRegistryOptions`, `StoryChanges`, `IndexEntry`, `CssVarReport`, `TrialFrameCalls`, `Libraries`, `SchemaDescription`, `DescribedShape`, `DescribedEntry`, `SectionDescription`.
  - guides: `SnapToGuidesInsertArgs`, `SnapToGuidesMoveArgs`, and `SnapToGuidesResizeArgs`, each from its own subpath.
  - hud: `AttachHudOptions`, `SourceRect`, `LoupeBaseOptions`.
  - labkit: `MarkPose`, `AnnotationStorage`, `PaintedMark`, `ControlPanelProps`, `ControlPack`, `LoupeBindings`; from `/state`, `InstrumentHooks`; from `/config`, `Branching`, `Fields`, `FieldValues`, `Variants`, `VariantValues`.
  - paint: `InCommandUnits`, `WithPatternHandle`.
  - quantity: `FractionOptions`.
  - renderer: `ShaderStage`, `UniformArray`.
  - routing: `ToolScopes`.
  - svg: `SvgDraftPose`.
  - text-dom: `OverlayRunBase`.
  - theme: `DtcgDocument`; from `/engine`, `SemanticCommon`, `DtcgGroup`, `DtcgAxesExtension`, `DtcgLayer`.
  - ui: `ButtonBase`, `ButtonRegular`, `ButtonIconOnly`, `ToggleBarCommonProps`, `ToastFn`, `Fold`, `DistributiveOmit`, `WalkCtx`, `OverlayPoint`, `DocumentCodec`, `OpenedDocument`, `SchemaRoot`, `AnyNode`, `CurveSamplePoint`.
  
  The names for types that had none of their own to export under (`StoryGlobals`, `TimelineSpan`, `CurveSamplePoint`, the `Diagram*` three, `ShaderStage`, `DtcgGroup`, `ToggleBarCommonProps`) were chosen by an agent.
- 9c165dc: forge reads a `showIf` written as data where it read only the function form. A control or a group hidden at the defaults by a condition gets no row of variants on a story's index page, and `answerSchema` lists it among the hidden paths. The condition itself still crosses to the workshop in the node's annotations, where the controls panel evaluates it.
  
  Adds API: `isEntryShown(entry, config)` in `@weasel-js/labkit`, which answers a node of a schema that has not been resolved by its own `showIf`, as a condition or a function.
- e5262d5: A component's index page says which release the component first shipped in and when its source file was created and last changed. All three are read from git: the dates are the file's first and latest commits, followed back through renames, and the release is the nearest tag after the first. A file in no tagged release yet reads `Unreleased`, and one git has never committed shows nothing. A custom index page gets the part as `History` on its `IndexContext`, and the component graph carries the same facts as `history` on each entry.
- 77c69d4: forge: Info is a button in the workshop's header, after the globals, and the tool rail it was alone on is gone. ⌘I still opens it.
- 28f0e21: forge: a CSF story gets a control for each prop of its meta's `component`, read from the component's TypeScript types. A boolean, string, or number prop gets its control, and a union of string literals gets a select; a prop's doc comment becomes the control's description. Props that React's own types or TypeScript's libraries declare are left out, and so is every prop on a story whose `render` takes no args. The story's own `args` and `argTypes` still apply over what was read. This needs `typescript` installed, now an optional peer dependency; `propControls: false` on the `forge` vite plugin turns it off, and `propControls: { skip }` leaves out the props declared in the files `skip` names.
- 71c558e: The CSS Vars panel saves a token edited by hand into the theme's definition file, where it saved scale edits only. A token saves when the definition writes its value out: a pin, a component or a literal semantic, and only the branch the trial's globals read, so an edit made in dark mode leaves the light value alone. A token the theme derives, from another token, a ramp, a rule or an alpha, stays a per-trial override as before, and so does a scale step. The button reads "Save to theme", where it read "Save scales to theme".
  
  Which tokens save, and that a derived one is left alone and not flattened to the edited value, was decided on an agent's judgment.
- 37effbf: A control read from a string-union prop lists its options in the order the type is written in, where it listed them in the order the compiler held them: `Button`'s `variant` read link, ghost, primary, secondary. The order is followed through a plain type alias. A union the type computes, through `Exclude` or a generic, keeps the compiler's order.
- a0f395b: forge: the dev server warns when the OS is not reporting file changes. At startup it writes a file in a temp directory of its own and, when no event for it arrives in 5 seconds, logs that edits will not reach the page and names `server.watch: { usePolling: true }` as the way to serve them meanwhile. A server that polls, or that has `server.watch: null`, is not checked. Additive.
- 49c8377: labkit: `.section(label, { className })` puts a class on that section's frame in a `ControlPanel`, for a look one section alone takes.
  
  forge: the Globals section of a trial's Settings draws its text at `--wzl-font-size-2xs`, the size of the CSS Vars rows, where it was `--wzl-font-size-sm`.
- f54a074: labkit: a sidebar section can set `fill`, which gives it the pane's spare height and holds its body to that height, so the body can scroll one part of itself under the rest. This adds to `SidebarSection`.
  
  forge: the CSS Vars section fills the aside. Its tabs and filter sit above the token list, which scrolls on its own; before, they were sticky inside the scrolling aside and the scrollbar ran past them.
- c9b9598: labkit's stylesheets, core's debug HUDs, and forge's shell and story frame take every `gap`, `padding`, and `margin` that has a rung from the `--wzl-space-*` ladder, where each held the same px as a literal. Core, which draws on a page that may load no theme, keeps that px as the `var()` fallback, so nothing moves there.
- Updated dependencies [ad11b4a]
- Updated dependencies [dfc0dda]
- Updated dependencies [a695295]
- Updated dependencies [122a09c]
- Updated dependencies [bc7cd74]
- Updated dependencies [7d16908]
- Updated dependencies [cd8cbbd]
- Updated dependencies [1f7548d]
- Updated dependencies [a86d79f]
- Updated dependencies [ad15c29]
- Updated dependencies [90eae1c]
- Updated dependencies [96a63de]
- Updated dependencies [9b7c182]
- Updated dependencies [b2a7e3b]
- Updated dependencies [cb97ce2]
- Updated dependencies [3678b72]
- Updated dependencies [7140b5a]
- Updated dependencies [7c9ee89]
- Updated dependencies [2d6d670]
- Updated dependencies [261c4b5]
- Updated dependencies [cff989c]
- Updated dependencies [b027078]
- Updated dependencies [7a6189a]
- Updated dependencies [d2930aa]
- Updated dependencies [4270664]
- Updated dependencies [f012f43]
- Updated dependencies [409590e]
- Updated dependencies [3b1dd4a]
- Updated dependencies [8e00180]
- Updated dependencies [fc267f3]
- Updated dependencies [4244046]
- Updated dependencies [f148c2b]
- Updated dependencies [88e3c8e]
- Updated dependencies [9f5cdb2]
- Updated dependencies [b9fb732]
- Updated dependencies [67f4d79]
- Updated dependencies [d137eaf]
- Updated dependencies [b6edc8f]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [2c6246d]
- Updated dependencies [de60e10]
- Updated dependencies [2892438]
- Updated dependencies [b310df0]
- Updated dependencies [2a5d8ef]
- Updated dependencies [b3dec78]
- Updated dependencies [3994be7]
- Updated dependencies [e80de55]
- Updated dependencies [b3ba3d9]
- Updated dependencies [9296fb4]
- Updated dependencies [0e46e02]
- Updated dependencies [dee0a3b]
- Updated dependencies [b1f7521]
- Updated dependencies [e77f185]
- Updated dependencies [497ddce]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [d1da605]
- Updated dependencies [43edc97]
- Updated dependencies [1f2cc09]
- Updated dependencies [d9620a2]
- Updated dependencies [bc9f367]
- Updated dependencies [a15b3f8]
- Updated dependencies [95c01e4]
- Updated dependencies [dc1f09c]
- Updated dependencies [13dacf3]
- Updated dependencies [fb3aa02]
- Updated dependencies [e22db54]
- Updated dependencies [2ed751e]
- Updated dependencies [b3f1e4a]
- Updated dependencies [329f658]
- Updated dependencies [c20b6ab]
- Updated dependencies [97f0282]
- Updated dependencies [0449330]
- Updated dependencies [4878967]
- Updated dependencies [b3d45d9]
- Updated dependencies [6c703be]
- Updated dependencies [2a141ac]
- Updated dependencies [7063584]
- Updated dependencies [4daaae4]
- Updated dependencies [a606e4f]
- Updated dependencies [d7ba0dd]
- Updated dependencies [da0335e]
- Updated dependencies [fb715f4]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [87dd1ad]
- Updated dependencies [9c165dc]
- Updated dependencies [3bacb3e]
- Updated dependencies [25b22ee]
- Updated dependencies [54c36f9]
- Updated dependencies [6620695]
- Updated dependencies [6b03b7e]
- Updated dependencies [6fe8b55]
- Updated dependencies [b260415]
- Updated dependencies [c6bf78b]
- Updated dependencies [27f415e]
- Updated dependencies [d27b4b9]
- Updated dependencies [66d5455]
- Updated dependencies [a03f0ce]
- Updated dependencies [011a241]
- Updated dependencies [eb7f534]
- Updated dependencies [7548e82]
- Updated dependencies [eb3114f]
- Updated dependencies [0a37db1]
- Updated dependencies [a275f78]
- Updated dependencies [605ace8]
- Updated dependencies [0db7e81]
- Updated dependencies [6bb8035]
- Updated dependencies [5d82ef9]
- Updated dependencies [bc15034]
- Updated dependencies [6273d6c]
- Updated dependencies [38866bc]
- Updated dependencies [d1c8cae]
- Updated dependencies [479c3b2]
- Updated dependencies [1ce19c9]
- Updated dependencies [7d94bbb]
- Updated dependencies [bd54ca0]
- Updated dependencies [1a5bf11]
- Updated dependencies [13069f4]
- Updated dependencies [b4f56fe]
- Updated dependencies [8041fa9]
- Updated dependencies [ed5b11c]
- Updated dependencies [7ae37a2]
- Updated dependencies [53c86af]
- Updated dependencies [9201fd5]
- Updated dependencies [f5d0a02]
- Updated dependencies [8f86cc0]
- Updated dependencies [92146b0]
- Updated dependencies [1c9bc4e]
- Updated dependencies [c71a532]
- Updated dependencies [525800f]
- Updated dependencies [72e250b]
- Updated dependencies [dcf0554]
- Updated dependencies [5c7d50f]
- Updated dependencies [7f8ab55]
- Updated dependencies [dbf7133]
- Updated dependencies [bb3e633]
- Updated dependencies [5464500]
- Updated dependencies [be611ae]
- Updated dependencies [ca09ae2]
- Updated dependencies [33c90ed]
- Updated dependencies [8d0498c]
- Updated dependencies [b3d4383]
- Updated dependencies [2d47e7c]
- Updated dependencies [95980c4]
- Updated dependencies [a6dff38]
- Updated dependencies [27c1c86]
- Updated dependencies [54b013c]
- Updated dependencies [a8ef308]
- Updated dependencies [5996856]
- Updated dependencies [0d1c052]
- Updated dependencies [afe503b]
- Updated dependencies [71512af]
- Updated dependencies [54174b6]
- Updated dependencies [4edad85]
- Updated dependencies [e678d75]
- Updated dependencies [bb53d86]
- Updated dependencies [18920a4]
- Updated dependencies [94f353d]
- Updated dependencies [9b8bd89]
- Updated dependencies [efc1205]
- Updated dependencies [b4227bc]
- Updated dependencies [56da358]
- Updated dependencies [cb7fa49]
- Updated dependencies [6139898]
- Updated dependencies [3aa3745]
- Updated dependencies [dd58f1a]
- Updated dependencies [335f192]
- Updated dependencies [f3b977a]
- Updated dependencies [df159bc]
- Updated dependencies [485bb80]
- Updated dependencies [21b6db7]
- Updated dependencies [970f489]
- Updated dependencies [5ef28a0]
- Updated dependencies [af48ee3]
- Updated dependencies [bd93216]
- Updated dependencies [1c8c3fc]
- Updated dependencies [4d4d81c]
- Updated dependencies [ea54a64]
- Updated dependencies [8524e05]
- Updated dependencies [8ac6236]
- Updated dependencies [eafd001]
- Updated dependencies [d5270d7]
- Updated dependencies [a071085]
- Updated dependencies [8390ab1]
- Updated dependencies [452af5e]
- Updated dependencies [7ede999]
- Updated dependencies [d7af897]
- Updated dependencies [003fb7c]
- Updated dependencies [517f414]
- Updated dependencies [1956417]
- Updated dependencies [0a70de6]
- Updated dependencies [955defa]
- Updated dependencies [0601e7b]
- Updated dependencies [f91ae11]
- Updated dependencies [a97cc84]
- Updated dependencies [b0fa3d3]
- Updated dependencies [c18d8cf]
- Updated dependencies [27b827e]
- Updated dependencies [ee08fa5]
- Updated dependencies [74f364f]
- Updated dependencies [01d6e4e]
- Updated dependencies [32b3cc9]
- Updated dependencies [70413dd]
- Updated dependencies [fcf44fa]
- Updated dependencies [a91e5cd]
- Updated dependencies [91a479a]
- Updated dependencies [7afbc13]
- Updated dependencies [8f38287]
- Updated dependencies [936679d]
- Updated dependencies [813aea2]
- Updated dependencies [cba4e4a]
- Updated dependencies [42f24c8]
- Updated dependencies [499af9b]
- Updated dependencies [8cc746f]
- Updated dependencies [a21947b]
- Updated dependencies [de07db0]
- Updated dependencies [4d3ff3f]
- Updated dependencies [85cb886]
- Updated dependencies [aed6320]
- Updated dependencies [7c1916b]
- Updated dependencies [5f31735]
- Updated dependencies [33acbca]
- Updated dependencies [4afd125]
- Updated dependencies [76935ca]
- Updated dependencies [bf79e00]
- Updated dependencies [a8a49df]
- Updated dependencies [1cc3786]
- Updated dependencies [b919648]
- Updated dependencies [e540165]
- Updated dependencies [addb115]
- Updated dependencies [49c8377]
- Updated dependencies [01bcb52]
- Updated dependencies [9d11828]
- Updated dependencies [37463b5]
- Updated dependencies [748384f]
- Updated dependencies [629eafa]
- Updated dependencies [a27de11]
- Updated dependencies [9e5dfd3]
- Updated dependencies [1289cde]
- Updated dependencies [3558fbb]
- Updated dependencies [bffba0a]
- Updated dependencies [5b97be1]
- Updated dependencies [33f4eb3]
- Updated dependencies [a03ad7e]
- Updated dependencies [f54a074]
- Updated dependencies [efc5cea]
- Updated dependencies [32e243f]
- Updated dependencies [233f856]
- Updated dependencies [0d675cf]
- Updated dependencies [c9b9598]
- Updated dependencies [27e786b]
- Updated dependencies [2705878]
- Updated dependencies [f59e769]
- Updated dependencies [e69e97f]
- Updated dependencies [9c19d5e]
- Updated dependencies [e75f00e]
- Updated dependencies [0e1f269]
- Updated dependencies [538e243]
- Updated dependencies [5b1a788]
- Updated dependencies [d3b9057]
- Updated dependencies [4fe6756]
- Updated dependencies [9fa373d]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [ad10f82]
- Updated dependencies [3b81e93]
- Updated dependencies [6f84f8d]
- Updated dependencies [4042637]
- Updated dependencies [c9aaa07]
- Updated dependencies [f54802b]
- Updated dependencies [e7066ff]
- Updated dependencies [172b2cc]
- Updated dependencies [215f133]
- Updated dependencies [0719af9]
- Updated dependencies [3d7acf1]
- Updated dependencies [90f8ec4]
- Updated dependencies [a297730]
- Updated dependencies [38fd203]
- Updated dependencies [9ad34e0]
- Updated dependencies [54862e9]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
- Updated dependencies [6941e0c]
- Updated dependencies [98ec291]
- Updated dependencies [ef3d83c]
- Updated dependencies [0d1c052]
  - @weasel-js/ui@1.10.0
  - @weasel-js/core@1.10.0
  - @weasel-js/labkit@1.10.0
  - @weasel-js/theme@1.10.0
  - @weasel-js/registry@1.10.0

## 1.9.4

### Patch Changes

- a3137f5: `forge` (the vite plugin) and `Workshop`: a story file created while the dev server runs can be opened from the tree. It listed and then showed `No importer for <file>` until the page was reloaded, because the open page was never handed an importer for the new file. The same held for a story file that gained its first story after startup.
- e12583a: `runAxe` and the workshop's Accessibility panel: an audit started while another was still running failed with "axe could not run: Axe is already running", which happened whenever the focus moved to a second story, or a story reloaded, before the first audit finished. Audits in one document now run one after another, and Re-check stays disabled until every audit the panel started has answered.
- 2200ecf: `forge` (the vite plugin): editing a module a story file imports, such as a fixture or a helper, now reloads the open story in the workshop. The workshop kept showing the code from before the edit until the page was reloaded, because only an edit to the story file itself named the story to load again.
- 99e37a0: `forge` and `forgeTest`: a `stories` glob written with a leading `./`, such as `./src/**/*.stories.tsx`, now matches everywhere. The workshop indexed such files at startup but never indexed one added later, and `forgeTest` matched no file at all, so its story project ran zero tests and passed.
- 88f3cad: The workshop does not run a story's `play`, and the frame protocol no longer carries the messages for it: `play` and `played` are gone, with `capture.run` / `capture`, the `size` report, and the `play` fault phase. `TrialFrame` loses `capture` and `size`, and `TrialFrames` loses `reportSize` and `hostRef`; nothing read any of them. This is breaking for code that called those, and an open story no longer keeps a `ResizeObserver` alive. A play still runs under `forgeTest`.
- 685c38d: `defineFrameConfig` and the `forge` plugin's `frameConfig` option: the docs said only frame documents import the frame config, so its CSS stays out of the workshop. The workshop page imports it too, to set up the stories it renders in its own document, so a page-level rule in CSS the frame config imports styles the workshop as well. The docs now say so.
- 1c23fa2: `Workshop`: the pool of warm frames for isolated stories no longer leaks a window listener for each frame that never loads. A frame that failed to load, as while the dev server restarts, also counted as loading for good, so the pool ran one short from then on; it is now dropped after 30 seconds and replaced.
- 563cff5: The `forge` vite plugin takes `frameStyles`, a list of stylesheets that only the frame document loads. A frame config's own CSS imports still reach the workshop page as well, so a rule on `html, body` meant for frames belongs in `frameStyles`.
- ddba9cd: The story index and the loaders now agree on what a story is and what it is titled. A CSF story takes the title its index entry has, as a native one already did, so a meta `title` the index cannot read (an imported constant, a template with an expression) no longer gives the loaded story a second id; the index does now read a title held in a `const` of the same file or written as a plain template. In a native file, an exported call is listed only when it calls `story`, directly or through a function of that file that returns the call, so `export const rows = makeRows()` is no longer a story that faults when opened. `forgeTest` resolves a `meta` or `story` that reaches forge through a project helper, as the workshop does. `loadCsfModule` and `runStory` take the index title where they took an auto title, which is breaking for a caller that relied on the meta's own title winning.
- 00d4498: An index page in the workshop mounts a cell a viewport before it scrolls into view. The page sits in a scrolling pane, which clipped the cell and so defeated the margin; cells now use the same position check a trial's story does, and still start unmounted.
- d291d7f: The index of a native story file follows what the file imports. An import or a re-export is listed only when its declaration is a story, an export that calls an imported function is listed when that function returns one, and a conditional or a spread copy is read by what it picks or copies from. A constant re-exported from another module is no longer a story that faults when opened, and a story built by a factory in another module is no longer missing from the tree.
- 9f26ee1: A native story file that exports a written-out value beside its stories, such as `export const rows = [...]` or a helper function, no longer lists it in the story tree as a story that faults when opened.
- 3504df2: `ShellConfig.libraries` names a project's libraries: each entry is a stretch of file path, the label its stories carry in the tree's package filter, on index pages, and in Get Info, and an optional badge tone. forge no longer carries a table of this repo's own packages, so a story under no listed library takes its title's first segment, as does an index page shown in a frame document.
- 5aae825: A URL naming a story that does not exist now says so in the stage: the trial the story would have opened in shows `No story <id>` under that title, where it used to go on showing the page that was open before, or the first story on a fresh load.
- 8b1410b: A story waiting on its first paint is held at `opacity: 0` with pointer events off, where it was also `visibility: hidden`. Hidden that way, nothing in it could take focus, so react-aria logged "`<Focusable>` child must be focusable" once for every `Focusable` a story mounted, such as the ⓘ of a `PropertyRow` with help.
- 42fb26a: `Workshop`: picking a story in the tree when the focused trial already shows it no longer resets that trial's knobs. It did whenever the URL named another story or none, such as a workshop opened at its bare address with a restored trial: the route was written with no knobs, and the trial was then set to match it. The route now starts with the knobs the trial holds.
- 4a581be: The pages the `forge` plugin serves and builds carry the shell config's `title` in their `<title>`, read from the config module's source, so a tab, a crawler, or a link preview no longer reads `weaselforge` until the workshop has loaded. A title the source does not spell out, such as one a function computes, still applies only once the workshop runs.
- 6493d6c: `Workshop`: a story whose box left the viewport before its fonts had loaded, and then came back, stayed invisible until its trial was remounted. It now shows as soon as it is back in view and its fonts are ready.
- 4c4f910: Clicking a story's row in the tree before that story's module has loaded no longer resets the knobs of the restored trial showing it.
- 4d559ca: `isPlainObject` lives in `@weasel-js/registry` (core still exports it), and `@weasel-js/geom` exports a scalar `clamp(v, lo, hi)`. theme, prefs, labkit, and forge read plain objects through the one realm-safe test, so a `Date` or a `Map` no longer passes where they accept a record; ui's Slider and ResizeHandle, hud's loupe, and labkit's ZoomControl use geom's clamp. When its bounds cross, ResizeHandle now holds to `min` where it held to `max`. theme and prefs gain a dependency on registry, and ui's on geom moves from dev to runtime.
- 1bbf0cb: A command on a tool rail is its own type. `ToolItem` is now only a tool: it has no `onActivate` and no type parameter. A button that runs once when pressed is a `CommandItem`, which `ToolbarItem` now extends, and a `palette` contribution takes a `RailItem`, which is either one.
  
  This is breaking for code that names the type. `ToolItem<TCtx>` becomes `ToolItem` for a tool, `CommandItem<TCtx>` for an item carrying `onActivate`, and `RailItem<TCtx>` where either may arrive. A contribution written as an object literal needs no change. forge's Info button is declared as a `CommandItem`.
- Updated dependencies [6e2447b]
- Updated dependencies [9dfd8a5]
- Updated dependencies [53c1c1d]
- Updated dependencies [4c4aa40]
- Updated dependencies [6b0163c]
- Updated dependencies [73011b3]
- Updated dependencies [f17d213]
- Updated dependencies [7420a37]
- Updated dependencies [f7efb73]
- Updated dependencies [5569371]
- Updated dependencies [7b1da16]
- Updated dependencies [41a4b4e]
- Updated dependencies [50b294e]
- Updated dependencies [f7872a9]
- Updated dependencies [2e11673]
- Updated dependencies [1bde2a4]
- Updated dependencies [2d1960e]
- Updated dependencies [5c5ba76]
- Updated dependencies [18d45e8]
- Updated dependencies [c834f3b]
- Updated dependencies [b30da28]
- Updated dependencies [32002e9]
- Updated dependencies [a777cea]
- Updated dependencies [07d96b0]
- Updated dependencies [5c560ab]
- Updated dependencies [799e489]
- Updated dependencies [b73b3aa]
- Updated dependencies [34feefc]
- Updated dependencies [9d54d0a]
- Updated dependencies [0a2eba9]
- Updated dependencies [def780e]
- Updated dependencies [f337f1d]
- Updated dependencies [3df6f75]
- Updated dependencies [719b2eb]
- Updated dependencies [095c055]
- Updated dependencies [4b0688a]
- Updated dependencies [103f988]
- Updated dependencies [c567961]
- Updated dependencies [6ba9cad]
- Updated dependencies [3f18dbe]
- Updated dependencies [8d25bd4]
- Updated dependencies [bb078c0]
- Updated dependencies [663248a]
- Updated dependencies [c2a2a5d]
- Updated dependencies [92c8af4]
- Updated dependencies [9b4fc5c]
- Updated dependencies [e023a51]
- Updated dependencies [184be75]
- Updated dependencies [8ee81fd]
- Updated dependencies [8469066]
- Updated dependencies [59f518a]
- Updated dependencies [9ad839d]
- Updated dependencies [fb505bb]
- Updated dependencies [0aaeebc]
- Updated dependencies [e589003]
- Updated dependencies [ec79c3f]
- Updated dependencies [1c401e3]
- Updated dependencies [158e471]
- Updated dependencies [e1255f1]
- Updated dependencies [001aaae]
- Updated dependencies [7d49da3]
- Updated dependencies [66373ac]
- Updated dependencies [98101a3]
- Updated dependencies [f9bf6ae]
- Updated dependencies [18eb752]
- Updated dependencies [2a87c05]
- Updated dependencies [50c2cfe]
- Updated dependencies [0afd65c]
- Updated dependencies [2fda51b]
- Updated dependencies [a07e769]
- Updated dependencies [557c01d]
- Updated dependencies [b370885]
- Updated dependencies [8a21a87]
- Updated dependencies [86fd792]
- Updated dependencies [2c7459d]
- Updated dependencies [8f23c57]
- Updated dependencies [b9d5513]
- Updated dependencies [c289df7]
- Updated dependencies [eb123ad]
- Updated dependencies [f06caab]
- Updated dependencies [2b3b637]
- Updated dependencies [55fd8a6]
- Updated dependencies [fc8068c]
- Updated dependencies [efcb538]
- Updated dependencies [4f8f94e]
- Updated dependencies [1268f79]
- Updated dependencies [452fffc]
- Updated dependencies [01f9a06]
- Updated dependencies [1128311]
- Updated dependencies [bafbccc]
- Updated dependencies [3b6d55f]
- Updated dependencies [41bddcc]
- Updated dependencies [94abaef]
- Updated dependencies [89b4ee6]
- Updated dependencies [d617bf4]
- Updated dependencies [20c2d26]
- Updated dependencies [f5d50b0]
- Updated dependencies [f3702c9]
- Updated dependencies [b374c88]
- Updated dependencies [1a09433]
- Updated dependencies [4f63476]
- Updated dependencies [b39b0f3]
- Updated dependencies [6ee9a4e]
- Updated dependencies [eefcc9a]
- Updated dependencies [87ea5af]
- Updated dependencies [2213ee8]
- Updated dependencies [ef9e985]
- Updated dependencies [f12ac6a]
- Updated dependencies [8fca412]
- Updated dependencies [a2e0462]
- Updated dependencies [7366d0c]
- Updated dependencies [8763790]
- Updated dependencies [234f718]
- Updated dependencies [5e1cbe4]
- Updated dependencies [8fa3cbc]
- Updated dependencies [ed78985]
- Updated dependencies [fb297fb]
- Updated dependencies [657872c]
- Updated dependencies [110142d]
- Updated dependencies [8101299]
- Updated dependencies [39b26f9]
- Updated dependencies [3a4fa8e]
- Updated dependencies [d3020c4]
- Updated dependencies [71f5742]
- Updated dependencies [e39b73c]
- Updated dependencies [cf3d535]
- Updated dependencies [3df8a5a]
- Updated dependencies [bd2a870]
- Updated dependencies [7c2e054]
- Updated dependencies [243984f]
- Updated dependencies [0b77641]
- Updated dependencies [28dd134]
- Updated dependencies [c527f50]
- Updated dependencies [b8a988c]
- Updated dependencies [f948b1d]
- Updated dependencies [a9b48e9]
- Updated dependencies [cce05ca]
- Updated dependencies [a89cbcf]
- Updated dependencies [9f8e55a]
- Updated dependencies [e48143a]
- Updated dependencies [ceca1ea]
- Updated dependencies [b6e7dc8]
- Updated dependencies [104fa68]
- Updated dependencies [1f2cdb0]
- Updated dependencies [2e72827]
- Updated dependencies [eaf3f09]
- Updated dependencies [74248c9]
- Updated dependencies [3424f82]
- Updated dependencies [b226598]
- Updated dependencies [bf4f085]
- Updated dependencies [86c3b42]
- Updated dependencies [16ca7a2]
- Updated dependencies [715494b]
- Updated dependencies [c6bb42d]
- Updated dependencies [2360522]
- Updated dependencies [e748d97]
- Updated dependencies [ba87325]
- Updated dependencies [047efee]
- Updated dependencies [ab164dd]
- Updated dependencies [2e69cc0]
- Updated dependencies [68dcc32]
- Updated dependencies [bca6c26]
- Updated dependencies [01c024e]
- Updated dependencies [216d9ae]
- Updated dependencies [3e0b75e]
- Updated dependencies [1dc28cb]
- Updated dependencies [20617cc]
- Updated dependencies [71f5742]
- Updated dependencies [e3797b1]
- Updated dependencies [74c30e6]
- Updated dependencies [67e23db]
- Updated dependencies [5794fc1]
- Updated dependencies [07d7cfe]
- Updated dependencies [d490ebc]
- Updated dependencies [fc4676d]
- Updated dependencies [c4a7c2a]
- Updated dependencies [d52829c]
- Updated dependencies [9d9eb3b]
- Updated dependencies [ef90738]
- Updated dependencies [08516b6]
- Updated dependencies [cc57bc6]
- Updated dependencies [420ba9c]
- Updated dependencies [abe11f9]
- Updated dependencies [316ecd0]
- Updated dependencies [fae67cb]
- Updated dependencies [5a92802]
- Updated dependencies [b4f06f1]
- Updated dependencies [427ea6c]
- Updated dependencies [dcc041e]
- Updated dependencies [0a17152]
- Updated dependencies [f356bd0]
- Updated dependencies [9472e9a]
- Updated dependencies [928cafc]
- Updated dependencies [ac01954]
- Updated dependencies [0f8ab4e]
- Updated dependencies [95e64cd]
- Updated dependencies [d01459d]
- Updated dependencies [391b2fe]
- Updated dependencies [b1ecc88]
- Updated dependencies [dcd14b3]
- Updated dependencies [eb26807]
- Updated dependencies [1eee4df]
- Updated dependencies [cca79cf]
- Updated dependencies [5cd52f3]
- Updated dependencies [cad8bd9]
- Updated dependencies [da9951d]
- Updated dependencies [190622a]
- Updated dependencies [36c6ca0]
- Updated dependencies [0bc3435]
- Updated dependencies [6983df3]
- Updated dependencies [399033f]
- Updated dependencies [1687f69]
- Updated dependencies [2d1c6af]
- Updated dependencies [54205a2]
- Updated dependencies [945c663]
- Updated dependencies [e31a360]
- Updated dependencies [33e0710]
- Updated dependencies [72a85f7]
- Updated dependencies [a8e964e]
- Updated dependencies [b444e46]
- Updated dependencies [e4d444f]
- Updated dependencies [bdf0a97]
- Updated dependencies [0641010]
- Updated dependencies [667ca34]
- Updated dependencies [e06409e]
- Updated dependencies [1268f79]
- Updated dependencies [4d559ca]
- Updated dependencies [60ac0a5]
- Updated dependencies [93780f6]
- Updated dependencies [188604d]
- Updated dependencies [036d768]
- Updated dependencies [151a441]
- Updated dependencies [a14e734]
- Updated dependencies [f6ea86c]
- Updated dependencies [5d6a06a]
- Updated dependencies [9f70b3c]
- Updated dependencies [047dcf3]
- Updated dependencies [3080040]
- Updated dependencies [a9b291e]
- Updated dependencies [dfc2c87]
- Updated dependencies [148d4b1]
- Updated dependencies [3baab83]
- Updated dependencies [a14e734]
- Updated dependencies [0c1edcb]
- Updated dependencies [27818ca]
- Updated dependencies [31a3581]
- Updated dependencies [65c36be]
- Updated dependencies [bbd6798]
- Updated dependencies [2807789]
- Updated dependencies [1085b46]
- Updated dependencies [812118e]
- Updated dependencies [c9d41f2]
- Updated dependencies [0a7db23]
- Updated dependencies [1bbf0cb]
- Updated dependencies [963c91f]
- Updated dependencies [a17a522]
- Updated dependencies [95bf24f]
- Updated dependencies [9967309]
- Updated dependencies [4bbffa2]
- Updated dependencies [e640378]
- Updated dependencies [ec5e31d]
- Updated dependencies [2db1963]
- Updated dependencies [9de4985]
- Updated dependencies [20cb4c6]
- Updated dependencies [0a83dfb]
- Updated dependencies [b413e19]
- Updated dependencies [d8b791e]
- Updated dependencies [dc856b3]
- Updated dependencies [0b93821]
- Updated dependencies [8b405d0]
- Updated dependencies [6fd724f]
- Updated dependencies [a145539]
- Updated dependencies [23ae360]
- Updated dependencies [279d88f]
- Updated dependencies [60edb93]
- Updated dependencies [66f7465]
- Updated dependencies [9c10943]
- Updated dependencies [5c96216]
- Updated dependencies [e98e95b]
- Updated dependencies [8261c9c]
- Updated dependencies [4787e75]
- Updated dependencies [c2ec0c3]
- Updated dependencies [16559ef]
- Updated dependencies [ba7cc48]
- Updated dependencies [569a013]
- Updated dependencies [ac8491b]
- Updated dependencies [5601761]
- Updated dependencies [7123087]
- Updated dependencies [1ca2395]
- Updated dependencies [47d868f]
- Updated dependencies [77fe781]
- Updated dependencies [d18b041]
- Updated dependencies [97bcbef]
- Updated dependencies [a53f3da]
- Updated dependencies [cd5ff3e]
- Updated dependencies [19bd1c3]
- Updated dependencies [9574e9c]
- Updated dependencies [ba55ae0]
- Updated dependencies [a91f79c]
- Updated dependencies [6589491]
- Updated dependencies [264404a]
- Updated dependencies [b84302e]
- Updated dependencies [f16fdad]
- Updated dependencies [dab8fbb]
- Updated dependencies [a60613a]
- Updated dependencies [f60bfe1]
- Updated dependencies [ca19703]
- Updated dependencies [2070f0a]
- Updated dependencies [a14e734]
- Updated dependencies [8c83067]
- Updated dependencies [d2f3be8]
- Updated dependencies [4539f92]
- Updated dependencies [8025cd7]
- Updated dependencies [cd9a828]
- Updated dependencies [37268aa]
- Updated dependencies [f65f952]
- Updated dependencies [bb0c0f7]
- Updated dependencies [5ee0a1f]
- Updated dependencies [318a188]
- Updated dependencies [73705ce]
- Updated dependencies [f32c96b]
- Updated dependencies [aa59c5b]
- Updated dependencies [5e00c96]
- Updated dependencies [ceb2e11]
- Updated dependencies [d4c51f5]
- Updated dependencies [8bef869]
- Updated dependencies [40e1b8a]
- Updated dependencies [6a35bef]
- Updated dependencies [2b6962a]
- Updated dependencies [2b366ec]
- Updated dependencies [12a1b0f]
- Updated dependencies [c99957a]
- Updated dependencies [ce3c1c8]
- Updated dependencies [4f5b466]
- Updated dependencies [ec3c147]
- Updated dependencies [9dfc01a]
- Updated dependencies [3357235]
- Updated dependencies [45eec5b]
- Updated dependencies [ec596b9]
- Updated dependencies [24bdb50]
- Updated dependencies [5d1ffd6]
- Updated dependencies [4592880]
- Updated dependencies [51dfb20]
- Updated dependencies [ff039f6]
- Updated dependencies [2329b3e]
- Updated dependencies [6c91c5b]
- Updated dependencies [14f86d8]
- Updated dependencies [6b42996]
- Updated dependencies [6122f67]
- Updated dependencies [50cb70e]
- Updated dependencies [e9a28a0]
- Updated dependencies [ea6842f]
- Updated dependencies [54faddb]
- Updated dependencies [0cf2bf4]
- Updated dependencies [9420f68]
- Updated dependencies [c5389a8]
- Updated dependencies [a1ea9ff]
- Updated dependencies [6366dde]
- Updated dependencies [7505ef5]
- Updated dependencies [fc0e2a3]
- Updated dependencies [8d56051]
- Updated dependencies [d16306d]
- Updated dependencies [b931128]
- Updated dependencies [a200c36]
- Updated dependencies [2bbcc5a]
- Updated dependencies [d3635ee]
- Updated dependencies [2098025]
- Updated dependencies [6a4a8ad]
- Updated dependencies [5b8578a]
- Updated dependencies [d8e003d]
- Updated dependencies [b3b209e]
- Updated dependencies [72002f8]
- Updated dependencies [26c11b8]
- Updated dependencies [e30e47c]
- Updated dependencies [12a42f0]
- Updated dependencies [732f5c3]
- Updated dependencies [44e1258]
- Updated dependencies [40533db]
- Updated dependencies [d71fc46]
- Updated dependencies [89b5ac6]
- Updated dependencies [4334f6d]
- Updated dependencies [819b4ef]
- Updated dependencies [db1a07b]
- Updated dependencies [c253018]
- Updated dependencies [bb28e63]
- Updated dependencies [70f3f31]
- Updated dependencies [1eb3bd1]
- Updated dependencies [37039d5]
- Updated dependencies [0cc8b79]
- Updated dependencies [0981447]
- Updated dependencies [dc9c665]
- Updated dependencies [51aff41]
- Updated dependencies [3dff419]
- Updated dependencies [6e0f62e]
- Updated dependencies [8411fa2]
- Updated dependencies [9494688]
- Updated dependencies [d4871bd]
- Updated dependencies [fcfb0a8]
- Updated dependencies [199b0e2]
- Updated dependencies [2105123]
- Updated dependencies [12c29b7]
- Updated dependencies [74bccab]
- Updated dependencies [f264c83]
- Updated dependencies [80a86e1]
- Updated dependencies [ceadadd]
- Updated dependencies [aaaead2]
- Updated dependencies [ba4684e]
- Updated dependencies [0d82f92]
- Updated dependencies [f86967a]
- Updated dependencies [6befeae]
- Updated dependencies [7c45605]
  - @weasel-js/ui@1.9.4
  - @weasel-js/core@1.9.4
  - @weasel-js/theme@1.9.4
  - @weasel-js/labkit@1.9.4

## 1.9.3

### Patch Changes

- Updated dependencies [1d04be1]
- Updated dependencies [bc984b8]
- Updated dependencies [6a1afa1]
- Updated dependencies [c28a3cb]
- Updated dependencies [ad00333]
- Updated dependencies [42691ed]
- Updated dependencies [7cb27b7]
- Updated dependencies [bd21190]
- Updated dependencies [e05c820]
- Updated dependencies [f43d0dd]
- Updated dependencies [8cf0db6]
- Updated dependencies [009b54b]
- Updated dependencies [5be8e39]
- Updated dependencies [7b6978f]
  - @weasel-js/ui@1.9.3
  - @weasel-js/core@1.9.3
  - @weasel-js/labkit@1.9.3
  - @weasel-js/theme@1.9.3

## 1.9.2

### Patch Changes

- e32ef39: `TokenPanel` has one compact layout: a token to a line, names on a rail, values at the small text size. The `density` prop is gone (this breaks any caller passing it). `namePrefix` leaves a shared prefix such as `--wzl-` off every name, with the full name kept in the tooltip. Rows that share a group show the group's name once down the rail. Empty values read `unset`, and a reset is an icon in its own column. Scale steps span the panel's width, with their labels lined up over the digits.
  
  The small `ToggleBar`, `ButtonBar` and `OptionsBar` take their height from their font size, so descenders no longer clip. In light mode, the secondary `Button` drops its dark text shadow and the primary one lightens it.
  
  New icons: `drop`, `type`, `typeface` and `more`.
  
  labkit: a `SidebarSection` can carry `actions`, drawn in its title bar (docked or torn out) and hidden while it is folded. Section title bars stay pinned while their bodies scroll, and expose their height as `--lk-section-bar-h`. An `Instrument` can supply `renderTitle` to draw its trial's title as more than text.
  
  forge: the CSS Vars header has a bar of section icons that jumps to a section and highlights the one in view. Each folder in a trial's breadcrumb links to that folder in the story tree, opening the Tree or Gallery view if the current view doesn't have it. A global can name the `icon` on its popover button; Font now uses `typeface`. Package badges in the story tree now sit centered on their checkboxes.
- 9db7d5f: The sidebar's story tree, its filter and its Tree / Components / Gallery switch take the small chrome type size, matching the sidebar's heading and package legend instead of the larger body size.
- Updated dependencies [83c724a]
- Updated dependencies [215418a]
- Updated dependencies [e32ef39]
- Updated dependencies [3ba97df]
- Updated dependencies [1b7af8d]
- Updated dependencies [a0aa0b7]
- Updated dependencies [f2cd0b7]
- Updated dependencies [34ffe05]
- Updated dependencies [a82540f]
- Updated dependencies [32009c0]
- Updated dependencies [daab5be]
- Updated dependencies [6e302e9]
- Updated dependencies [586cf05]
- Updated dependencies [fca8591]
- Updated dependencies [97c215a]
  - @weasel-js/ui@1.9.2
  - @weasel-js/labkit@1.9.2
  - @weasel-js/core@1.9.2
  - @weasel-js/theme@1.9.2

## 1.9.1

### Patch Changes

- Updated dependencies [c63f934]
  - @weasel-js/core@1.9.1
  - @weasel-js/labkit@1.9.1
  - @weasel-js/ui@1.9.1
  - @weasel-js/theme@1.9.1

## 1.9.0

### Patch Changes

- 0fa52ba: A trial whose story an `overflow` ancestor clips away entirely now unmounts that story once a scroll carries it far from the viewport, and mounts it again on return. Before, the clipped story stayed mounted until something unclipped it, because the browser reports no further movement for an element of which nothing shows.
- f7701b8: Opening another trial no longer reloads an isolated story's frame, or remounts a workshop story, in a trial that stays on screen. A trial unmounts its story when it is far from the viewport, and that was decided by whether any of the story showed; while the tiling changes a narrow tile clips its content away entirely for a moment, which read as out of view. It is now decided by where the story is relative to the viewport, whatever clips it.
- 5dd2f9d: An index page no longer collapses a story that sizes itself from its container — a slider, a tiled workspace — to a 10px sliver. A padded story's cell now takes the column's width, as a page would give it, and a centered cell keeps a minimum width of `min(100%, 20rem)` while still hugging anything wider.
- b176142: A workshop whose story index loses a story now forgets that story's ready description, loaded module and load fault in the same render that drops it, rather than in a second commit after it.
- c069584: A native story now always runs under its index entry's title. When the plugin could not tell that a meta was forge's — its import, or `@weasel-js/forge` itself, resolved to nothing from the story file — the index titled the story by its path while the loaded module used the meta's `title`, so a link written from one named no story in the other. `loadStories` and `loadNativeModule` treat their title argument as the index entry's, and a native meta's own `title` no longer overrides it; a CSF meta's still does. `forgeTest` passes the indexed title to `runStory` likewise.
  
  The plugin also re-reads a story file when a module it imports from first appears, so a helper that re-exports forge's `meta` and is created after the story file now retitles that story without an edit to the story file.
- 239d436: An isolated story with a `viewport` no longer loads its frame twice when first opened. Its trial's stage came only from the frame's `ready`, so the trial moved the frame into a stage once the story reported and the iframe reloaded. The index now reads a native story's `viewport` when both sides are number literals (`IndexEntry.viewport`), and the trial starts with that stage; a viewport the index cannot read still costs one reload.
- Updated dependencies [c06cc26]
- Updated dependencies [718769e]
- Updated dependencies [dc5bcfc]
- Updated dependencies [ee165ac]
- Updated dependencies [0b8d6f8]
- Updated dependencies [0004749]
- Updated dependencies [1b22863]
- Updated dependencies [a6b21fb]
- Updated dependencies [d270868]
- Updated dependencies [b83b452]
- Updated dependencies [ad0da6c]
- Updated dependencies [2b03077]
- Updated dependencies [718769e]
- Updated dependencies [3088756]
- Updated dependencies [63d0bf8]
- Updated dependencies [4146713]
- Updated dependencies [24b2eaf]
- Updated dependencies [7b24dba]
- Updated dependencies [5df9a88]
  - @weasel-js/core@1.9.0
  - @weasel-js/labkit@1.9.0
  - @weasel-js/ui@1.9.0
  - @weasel-js/theme@1.9.0

## 1.8.1

### Patch Changes

- 7e71950: The workshop keeps a story's knobs in its URL: `#/<story id>?label=Save&look.px=8`. Opening such a URL shows the story at those values, a knob inside a group is named by its dotted path, and each value is read as its control's type, with one that does not parse ignored. Changing a control rewrites the URL in place, values at their default are left out, and moving to another story drops the previous one's knobs. `t` is reserved and never a knob. `parseRoute`, `formatRoute`, `paramsToKnobs`, `knobsToParams` and `storyHref` are exported for a host building links to a story at a given state.
- 377ad0e: A native story file that imports `meta` and `story` from its own module rather than from `@weasel-js/forge`, such as a project helper that re-exports them, is now indexed under its meta's `title`. Before, the index fell back to the path-derived title while the story ran under the meta's, so a link written from the title named no story. The plugin follows the import to where it is declared and checks that it is forge's own; a same-named function of the project's own is still treated as not forge's.
- 4adec3c: A padded story's cell on a component's index page now hugs the story instead of holding the 96px minimum meant for centered ones, which left empty room under any padded story shorter than that — ToolGroup's horizontal one, for instance.
- 6d22b02: A story that sets its timeline span at runtime now opens at the time a URL's `t` or the trial's persisted playhead asks for, even when that time lies past the span declared before `setSpan` ran. The asked-for time is placed afresh in every new span until play, a seek, a scrub or a new `t` moves the playhead, and until a span can hold it, neither `t` nor the persisted playhead is rewritten. Before, the time was clamped to the placeholder span and the clamped value was written back.
- 90ed7f5: A story can declare a timeline — `timeline: { duration, start?, loop?, rate? }` on a native story or meta, `parameters.forge.timeline` in CSF, or a function of the config or args — and forge then owns its clock. The trial gets a scrub bar and `@weasel-js/ui`'s `Transport` in its status bar, and the story reads the playhead with `usePlayhead()`, or the whole clock with `useTimeline()`, which can also play, pause, seek and replace the span at runtime. Times are in ms. The paused time is kept with the trial, so a reload or a labkit snapshot restores it. While paused, the playhead is also held in the URL as `t` in seconds (`#/<story>?t=1.5`), by the one trial that owns the URL (the focused trial showing the routed story, else the first); opening such a URL, or a hash change bringing a new `t`, puts that trial paused there. Playing clears `t` once instead of rewriting the URL every frame.
- 2f5ec92: `defineShellConfig` takes `title`, which names the workshop in its header and as the document title in place of `weaselforge`, and `cssVars: false`, which leaves out the CSS Vars panel. Both default to what the workshop showed before.
- bf522cf: labkit: a lab can present one trial and nothing else — no lab chrome, no trial chrome, a transparent ground — for embedding it as a figure. `<Lab present>` or `?present` in the URL starts it that way, opened on `seed={{ instrument, config, state, view }}`; a stored lab then keeps its own records under `storageKey` + `':present'`, and a changed seed reopens the trial for returning visitors. `usePresentation()` gives `{ active, enter, exit }` inside any lab: `enter` presents the focused trial, Escape returns, and nothing remounts either way. While presenting, the page's root `color-scheme` is reset so an iframe embed stays transparent.
  
  core: `stableStringify`, JSON with object keys sorted, moves here from forge, which re-exports it.
- Updated dependencies [75dd38d]
- Updated dependencies [e07c4ca]
- Updated dependencies [934f195]
- Updated dependencies [b459d73]
- Updated dependencies [5f76528]
- Updated dependencies [2d97065]
- Updated dependencies [bf522cf]
- Updated dependencies [f8b3cb4]
- Updated dependencies [934f195]
- Updated dependencies [261c35f]
- Updated dependencies [f9ebc47]
- Updated dependencies [18a4994]
- Updated dependencies [c93a52c]
- Updated dependencies [fbe9bc3]
- Updated dependencies [06e5299]
- Updated dependencies [2fed994]
- Updated dependencies [9003c69]
- Updated dependencies [bbf8715]
- Updated dependencies [4cb1e04]
- Updated dependencies [c49c9e0]
- Updated dependencies [f78b82d]
- Updated dependencies [6e60eb1]
- Updated dependencies [2123049]
  - @weasel-js/theme@1.8.1
  - @weasel-js/ui@1.8.1
  - @weasel-js/core@1.8.1
  - @weasel-js/labkit@1.8.1

## 1.8.0

### Patch Changes

- Updated dependencies [d24f51f]
- Updated dependencies [8a57e2b]
- Updated dependencies [f1aaf3e]
- Updated dependencies [4db0f2e]
- Updated dependencies [c1aa1f6]
- Updated dependencies [2432ce3]
- Updated dependencies [9b1ff50]
- Updated dependencies [b68a0e7]
- Updated dependencies [8041802]
  - @weasel-js/core@1.8.0
  - @weasel-js/ui@1.8.0
  - @weasel-js/labkit@1.8.0
  - @weasel-js/theme@1.8.0

## 1.7.3

### Patch Changes

- 4f7725c: The sidebar's Gallery button is grayed out in a project with no gallery stories, and Components and Tree are grayed out in a project with nothing but galleries. A stored choice of a grayed-out view shows Components (or Gallery) instead, and comes back once the project has something to list there.
- Updated dependencies [b258798]
- Updated dependencies [3ce52fe]
  - @weasel-js/theme@1.7.3
  - @weasel-js/ui@1.7.3
  - @weasel-js/labkit@1.7.3
  - @weasel-js/core@1.7.3

## 1.7.2

### Patch Changes

- a6d6ebc: Numeric text now has one definition: `.numeric` in the new `@weasel-js/theme/numeric.module.css` export, which sets `--wzl-font-numeric` and `tabular-nums` together. CSS modules take it with `composes: numeric from '@weasel-js/theme/numeric.module.css'`, Less with `.numeric();`, and markup by putting its class on the element. `npm run check:numeric` fails on `tabular-nums` or a read of `--wzl-font-numeric` anywhere else, and on a `font`, `font-family` or `font-variant-numeric` declaration beside the helper, which would replace it.
  
  What that changes on screen:
  
  - `NumberField` and `UnitField` set their value in equal-width digits, so every number input does; it was in the UI face with proportional ones.
  - Property rows' slider readouts and their editable inputs, `OpacityRange`'s percentage, `Timeline` ruler ticks, `BandEditor` tick labels, `Slider` readouts, `FallthroughDiagram`'s number columns, `StatusBar`, and labkit's status bar, scale indicator, FPS meter and specimen pane width move to the numeric face. Several were in the mono face, which had been standing in for tabular figures. Code and hex values stay mono.
  - `TokenPanel`'s number fields render in the numeric face. They had been forced to mono, which also kept the numeric rules beneath them from ever applying.
  - `DataGrid` columns take `numeric: true`, which sets the header and cells in the numeric face and ends them.
  - `DetailRow` reads its list's `values` itself, so a figures row's value gets its class directly rather than through a descendant selector.
  - forge's font switcher sets `--wzl-font-numeric` to the chosen UI face when that face is not Oswald, instead of leaving Oswald's digits among another face's letters.
- Updated dependencies [06ee1e6]
- Updated dependencies [88e298e]
- Updated dependencies [c443639]
- Updated dependencies [0756a82]
- Updated dependencies [a6d6ebc]
- Updated dependencies [b18ef4a]
- Updated dependencies [9e188af]
- Updated dependencies [9362f82]
- Updated dependencies [68a373f]
- Updated dependencies [bbf4d3d]
- Updated dependencies [2cefe97]
- Updated dependencies [7671813]
- Updated dependencies [3299539]
- Updated dependencies [81654ed]
  - @weasel-js/core@1.7.2
  - @weasel-js/labkit@1.7.2
  - @weasel-js/theme@1.7.2
  - @weasel-js/ui@1.7.2

## 1.7.1

### Patch Changes

- 011dd4d: A story in the workshop no longer loses its state on the first press. That press focuses the trial, which re-renders the lab, and forge called the story's `render` again each time; a story declaring a component inside `render` got a new component type and remounted, so the Dialog story's "Open dialog" opened nothing and the first edit in a story was dropped. `render` now runs again only when the story's config, state or globals change, as in Storybook.
- 58a2eac: `forgeTest` now points vite's dependency scan at the story files, the frame config and forge's own test runtime, as the workshop plugin already did. The imports it appends to each story file are invisible to the scan, so on a cold cache vite discovered `react-dom/client` mid-run, re-optimized and reloaded the test page, and every story in the first file failed with "Invalid hook call".
- e775a12: Add `--wzl-font-numeric` and the `Oswald Tabular` face behind it. Oswald has no tabular figures, so `font-variant-numeric: tabular-nums` aligned nothing in the UI face. `Oswald Tabular` is Oswald's ten digits alone, each centered in the widest digit's width at every weight from 200 to 700, plus a figure space (U+2007) of that width; the token puts it in front of `--wzl-font-ui`, so an element set in `--wzl-font-numeric` gets equal-width digits and every other character from the UI face unchanged. `faces.css` declares the new face, and labkit's `dist/fonts` picks up the file.
  
  The readouts, counts and tick labels in Slider, RangeSlider, Jog, Timeline, Plot2D, Prefs and TokenPanel, labkit's zoom readout and job count, and forge's a11y and info panels now use it. `DetailList`'s figures mode moves from `--wzl-font-mono` to it, keeping the list in the UI face.
- 3755e17: Refs that event handlers, timers and message listeners read no longer hold
  what an abandoned concurrent render computed. The gesture dispatcher,
  `useDepSource`, `useOngoingAction`, `ActionsProvider`, `useTools`,
  `useContributions`, the ui components with drag or dismissal handlers
  (`Callout`, `CurveEditor`, `LayerList`, `ResizeHandle`, `Timeline`'s graph
  lane), `useAsyncOptions`, `useReorderDragList`, forge's trial shell and
  `useLiveLayout` now publish their latest props on commit only.
  
  `ContributionsApi` is now rebuilt from each render's entries instead of reading
  them through a ref, so its `entries`, `overlays()` and `scopedBindings()` answer
  correctly when read during render. Its identity is kept while the entry list
  holds the same entries, and changes when an entry is added, removed or
  replaced — a consumer building its entry objects inline every render now gets a
  new API object each render.
  
  Because a dep source now publishes on commit, `ActionBar` re-checks each
  action's `enabled` after it commits and re-renders if a dep changed in the same
  render.
- 21c21dc: `ToastRegion` takes a `portalContainer`, and follows an `OverlayPortalProvider`,
  like the other overlays. Given a container, the stack renders inside it,
  absolutely positioned in the container's corner, so a toast raised in a forge
  trial stays in that trial; the container must be a containing block. With
  neither, the region is fixed to the viewport corner exactly as before — it does
  not follow the nearest themed ancestor, since that is usually a page-tall app
  root. A contained region is not an F6 landmark; its toasts announce, dismiss,
  pause on hover and focus, and return focus the same way. Additive.
  
  forge's Toast story no longer renders in its own frame, and
  `check:forge-isolate` now allows one isolated story.
- Updated dependencies [6f59206]
- Updated dependencies [716ea36]
- Updated dependencies [2d7003a]
- Updated dependencies [e17fe2c]
- Updated dependencies [3cfb09a]
- Updated dependencies [f457e7c]
- Updated dependencies [8635031]
- Updated dependencies [276bad1]
- Updated dependencies [efc5727]
- Updated dependencies [108551d]
- Updated dependencies [a5bc201]
- Updated dependencies [4e18c9f]
- Updated dependencies [112c781]
- Updated dependencies [ac2e76e]
- Updated dependencies [9c164e2]
- Updated dependencies [85d62a7]
- Updated dependencies [dfd926f]
- Updated dependencies [3d80c9f]
- Updated dependencies [a1ecaac]
- Updated dependencies [886fefd]
- Updated dependencies [04b0b96]
- Updated dependencies [e54ff4f]
- Updated dependencies [1291788]
- Updated dependencies [27bcf57]
- Updated dependencies [db79658]
- Updated dependencies [a7f2103]
- Updated dependencies [b2fd89a]
- Updated dependencies [4212d2d]
- Updated dependencies [12263bc]
- Updated dependencies [b5cc59f]
- Updated dependencies [e2f1968]
- Updated dependencies [1524403]
- Updated dependencies [bfc4b21]
- Updated dependencies [f046160]
- Updated dependencies [9404457]
- Updated dependencies [dcba7ff]
- Updated dependencies [3af4a23]
- Updated dependencies [1ffa044]
- Updated dependencies [65d6278]
- Updated dependencies [27350a1]
- Updated dependencies [9f83b33]
- Updated dependencies [3c1def2]
- Updated dependencies [ae6e8ac]
- Updated dependencies [4b570e5]
- Updated dependencies [251fb64]
- Updated dependencies [9bfdda9]
- Updated dependencies [e775a12]
- Updated dependencies [b554ee0]
- Updated dependencies [702829d]
- Updated dependencies [9cad63b]
- Updated dependencies [b228015]
- Updated dependencies [53cdd41]
- Updated dependencies [33b7ac2]
- Updated dependencies [30b7fd3]
- Updated dependencies [fa67cbf]
- Updated dependencies [8f68fa8]
- Updated dependencies [25448ee]
- Updated dependencies [88c1ae3]
- Updated dependencies [dcc9834]
- Updated dependencies [365c762]
- Updated dependencies [d30a675]
- Updated dependencies [0a9b769]
- Updated dependencies [941e941]
- Updated dependencies [b20df31]
- Updated dependencies [55ef61f]
- Updated dependencies [3755e17]
- Updated dependencies [712de19]
- Updated dependencies [67d95c8]
- Updated dependencies [8a68b6c]
- Updated dependencies [7b7ca3c]
- Updated dependencies [16a0476]
- Updated dependencies [6f03bf7]
- Updated dependencies [72379f6]
- Updated dependencies [7f7d153]
- Updated dependencies [d9cdff1]
- Updated dependencies [63d0ece]
- Updated dependencies [56d1ffb]
- Updated dependencies [c2935fa]
- Updated dependencies [f8bde12]
- Updated dependencies [685a086]
- Updated dependencies [ee93ce5]
- Updated dependencies [6010b5a]
- Updated dependencies [ad143ec]
- Updated dependencies [90a4686]
- Updated dependencies [7e08265]
- Updated dependencies [d60a422]
- Updated dependencies [dde2315]
- Updated dependencies [4cb55b7]
- Updated dependencies [fb21799]
- Updated dependencies [fe9a91e]
- Updated dependencies [897fb47]
- Updated dependencies [3a68365]
- Updated dependencies [43ad590]
- Updated dependencies [21c21dc]
- Updated dependencies [4cef954]
- Updated dependencies [c4cc60f]
- Updated dependencies [6df279e]
- Updated dependencies [70a058f]
- Updated dependencies [09ff2c1]
- Updated dependencies [637945e]
- Updated dependencies [5308126]
  - @weasel-js/core@1.7.1
  - @weasel-js/labkit@1.7.1
  - @weasel-js/theme@1.7.1
  - @weasel-js/ui@1.7.1

## 1.7.0

### Patch Changes

- fa22963: Text reads its family from the font tokens in more places.
  
  - forge's index pages set their chrome and every story in `--wzl-font-ui`, and only the descriptions in `--wzl-font-body`. The whole page used to be set in the body face, so any story text that inherits its font — most of `SelectionPanel`, `Prefs`, `Tree`, `ItemList` — showed in Inter on the index page and in Oswald on the story's own page.
  - `Slider`'s thumb labels and readouts, `ToolButton`'s shortcut, and the `Foundations` specimens read `--wzl-font-ui` / `--wzl-font-mono` instead of hard-coded font stacks.
  - `NumberField`'s steppers, the property help button, `Timeline`'s transport buttons and `CurveField`'s actions take `font: inherit`. They are buttons, which don't inherit a font by default, so outside a host that resets form controls they rendered in the browser's own control font.
  - labkit sets `code`, `kbd`, `samp` and `pre` inside `.lk-root` in `--wzl-font-mono`, at zero specificity. The browser's default `monospace` reaches no token.
  
  `Keycaps` still sets its own sans stack: its stylesheet documents that as a deliberate exception.
- 7c6b81a: forge's story indexer parses with `@babel/parser` 8. That parser needs Node `^22.18.0 || >=24.11.0`, so forge's `engines` now says so, where it said `>=22` before.
- edbe3f3: A component's index page lists the listed components it uses and the ones that use it, each linking to that
  component's page. The vite plugin derives them from source, following the meta's `component` through imports and
  re-exports to the file declaring it, and serves them as `virtual:forge/deps.js`; `mountWorkshop` takes them through
  `setDependencies`. A story file tagged `gallery` in its meta's `tags` (or a single story tagged so) is marked in the
  sidebar and on its index page, and a component made only of galleries is left out of the lists. `Meta`, `StoryObj`,
  `MetaSpec` and `StorySpec` accept `tags`; `IndexContext` adds `Dependencies` and `gallery`.
- de70b29: The sidebar folds a folder that holds nothing but a gallery into that gallery. `ui/Cursors/Gallery` now lists as a `Cursors` row with its stories directly beneath it. The gallery keeps its title, so story ids and `#/` routes are unchanged.
- 69a7fff: The sidebar has a Gallery view beside Tree and Components. Every story tagged `gallery` lists there, grouped the way Components groups, and no longer lists in the other two views; the sidebar's gallery mark is gone, since the view now says it. The fold mark sits 8px from its label instead of 4px. The `ui` package badge is amber and `forge`'s is blue.
  
  labkit's `Lab/FullChrome` stories are tagged `gallery` as a file rather than only `AllChrome`, so all of them list in the Gallery view.
- e35e49d: Index page cells size to their story instead of filling the page, and a row of variants wraps rather than stretching each cell to a grid column. A fullscreen story still gets the full width.
- 046a8ec: Index page cells pad their story by 4px instead of 2px.
- f617d2e: An index page heads its path with its package as a badge, toned as the sidebar tags that package, in place of a first
  title segment naming it.
- e4d03e6: Index pages keep their styles in the workshop document. `IndexPage` now imports
  its own stylesheet; before, only the iframe entry did, so an index page rendered
  in the document had no padding, width limit or cell styling.
- cfc1a99: The sidebar's package badges hold at least 5:1 contrast in light mode, where labkit's measured 3.9:1 and forge's 4.4:1;
  each tone now mixes further toward the foreground in light mode only.
- d6ec7cd: The workshop takes no marks for now: story and index trials no longer declare an
  annotation target, so the Marks section and the annotation tools are gone from
  every trial. The globals toolbar puts its "More … settings" buttons after every
  select, at the toolbar's end.
- e7097f4: The workshop's tool rail carries only Interact and Info; the drawing tools are
  off for now. Index pages pad evenly on every side and show their breadcrumb at
  the large text size.
- 71d9622: A global can follow the lab's own chrome. A declaration with `follows` offers
  `App` first on the lab's toolbar, and while the lab's value is `App` the global
  takes what `follows` reads from the chrome (`LabChrome`, which carries the lab
  header's mode switch). Picking any other value overrides the chrome for the
  trials; a trial's pin still follows the lab or names a value. `FOLLOW_APP` and
  `LabChrome` are exported.
  
  The repo's workshop uses it for Mode, whose default is now `App`: the header's
  Auto/Light/Dark switch reaches every story and index page until a Mode is picked,
  where before it styled only the workshop's chrome. A new Theme global picks the
  theme trials are rendered in, from weasel and interstellar, lab-wide or pinned
  per trial in Settings → Globals.
- 4657a9d: forge accepts vitest 5 as well as 4 for `forgeTest`, and a story's `play` asserts through `@vitest/expect` 5. Nothing in forge's API changed.
- f8f0160: A plain object made in another realm (an iframe, a VM context, or `structuredClone` under jsdom) is now treated as a plain object. labkit's config defaults used to overwrite a stored config that came from another realm instead of filling it, and forge's story-arg handling treated one as opaque. `@weasel-js/core` exports the check as `isPlainObject`.
- d665712: Sidebar section titles are bold and take a `title-weight` stance slot, and
  sidebar sections and forge's story tree have wider side gutters. labkit's
  `h1`–`h3` defaults now sit in `:where()`, so a heading's own class sets its
  font instead of losing to them.
- d17c0a5: Status glyphs and icon options in segmented controls. `@weasel-js/ui` adds `statusAccent`, `statusNeutral`, `statusMuted` and `statusSuccess` to the icon set, and `BADGE_STATUS_ICONS` maps every `BadgeStatus` but `custom` to a glyph (info, warn and danger reuse `info`, `warning` and `error`). A `PropertyField` enum segment that draws a glyph now shows its label as a tooltip. labkit's `ConfigOption` takes an `icon`, and a forge argType takes `control: { type, icons: { option: iconName } }` to put one on each option.
- Updated dependencies [05da5a4]
- Updated dependencies [357831c]
- Updated dependencies [b1142a7]
- Updated dependencies [fc21474]
- Updated dependencies [96adc78]
- Updated dependencies [be5bccd]
- Updated dependencies [240138b]
- Updated dependencies [21ee45b]
- Updated dependencies [32bb3be]
- Updated dependencies [a2bb168]
- Updated dependencies [2e34d59]
- Updated dependencies [32c5fb4]
- Updated dependencies [0047d33]
- Updated dependencies [fa22963]
- Updated dependencies [69a7fff]
- Updated dependencies [ad0378f]
- Updated dependencies [c755d1e]
- Updated dependencies [b4227b8]
- Updated dependencies [5faffa6]
- Updated dependencies [0cecdcf]
- Updated dependencies [7c3cc5d]
- Updated dependencies [722b267]
- Updated dependencies [1eac15b]
- Updated dependencies [b8ff2c7]
- Updated dependencies [50bf819]
- Updated dependencies [52078c5]
- Updated dependencies [f400d11]
- Updated dependencies [843a477]
- Updated dependencies [a251594]
- Updated dependencies [49460d0]
- Updated dependencies [f478bd7]
- Updated dependencies [4aee366]
- Updated dependencies [5ef8167]
- Updated dependencies [9ce0b96]
- Updated dependencies [8922a1f]
- Updated dependencies [197fdf7]
- Updated dependencies [5acf166]
- Updated dependencies [7f7b04f]
- Updated dependencies [4080df8]
- Updated dependencies [56e85e2]
- Updated dependencies [fc3de06]
- Updated dependencies [b8f2007]
- Updated dependencies [fd178be]
- Updated dependencies [5201b8e]
- Updated dependencies [bc2a7ef]
- Updated dependencies [6819653]
- Updated dependencies [793987a]
- Updated dependencies [ca2f45f]
- Updated dependencies [082c63f]
- Updated dependencies [242e9f7]
- Updated dependencies [7607fea]
- Updated dependencies [f8f0160]
- Updated dependencies [f72459c]
- Updated dependencies [5c20713]
- Updated dependencies [89dcbe2]
- Updated dependencies [455e4bc]
- Updated dependencies [779b3cc]
- Updated dependencies [a028cc3]
- Updated dependencies
- Updated dependencies [ef9396c]
- Updated dependencies [667f14f]
- Updated dependencies [e442bcb]
- Updated dependencies [aad77d3]
- Updated dependencies [8999210]
- Updated dependencies [94cf4cd]
- Updated dependencies [d647c9b]
- Updated dependencies [d7aaeb1]
- Updated dependencies [38f524c]
- Updated dependencies [38480ce]
- Updated dependencies [d665712]
- Updated dependencies [2336d9c]
- Updated dependencies [ffacd5e]
- Updated dependencies [71d54e4]
- Updated dependencies [03e9385]
- Updated dependencies [d17c0a5]
- Updated dependencies [fab839f]
- Updated dependencies [1052a77]
- Updated dependencies [8c1cd8d]
- Updated dependencies [d5a9fbf]
- Updated dependencies [865184c]
- Updated dependencies [e49f76f]
- Updated dependencies [5bb86f5]
- Updated dependencies [c526214]
- Updated dependencies [ea9a314]
- Updated dependencies [3a20620]
- Updated dependencies [d985954]
  - @weasel-js/theme@1.7.0
  - @weasel-js/labkit@1.7.0
  - @weasel-js/core@1.7.0
  - @weasel-js/ui@1.7.0

## 1.6.1

### Patch Changes

- 0c3c092: A global declaration can take `shows(value, globals)`, and the workshop toolbar then lists only the options it returns true for at the lab's other values. A lab value that stops showing moves to the nearest option that does, in declaration order. The workshop's Weight, Width and Italic selects now use it to offer only what the chosen font ships, where before they listed every value and silently rendered `normal` for the ones the font lacked.
- Updated dependencies [b209a8e]
- Updated dependencies [f497731]
- Updated dependencies [62329f7]
- Updated dependencies [7683659]
- Updated dependencies [f497731]
- Updated dependencies [a7a54a0]
- Updated dependencies [4763610]
- Updated dependencies [800b03c]
  - @weasel-js/core@1.6.1
  - @weasel-js/ui@1.6.1
  - @weasel-js/labkit@1.6.1
  - @weasel-js/theme@1.6.1

## 1.6.0

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 1589afd: forge's CSS Vars panel can save its scale edits into the theme's definition file. "Save scales to theme" writes each edited scale back through its references: a font base read from `{seeds.ui-base}` changes that seed for the trial's density only, so the other densities keep theirs, and a param that differs by axis changes only the branch the trial shows. A save that would have to flatten a reference, or guess an axis value (a `mode` of Auto), is refused with a message. The write goes to the dev server's `__theme/<name>` endpoint with the file's hash, so a file changed on disk is reported rather than overwritten; once saved, the trial's overrides for those scales are dropped, since the theme now carries them.
  
  `@weasel-js/theme/engine` now exports the theme store's protocol — `StoredTheme`, `PutResult`, `IssueReport`, `serializeDefinition` — and `httpThemeApi`, its client, which the theme editor and forge both use.
- 06aa549: Browser Back and Forward now move a trial between the stories it showed.
  
  Opening a story from the tree swaps it into the focused trial, but Back then
  found no trial of the previous story and opened a new one beside it. A history
  step across such a swap now swaps the trial back. A hash typed or linked to
  still opens a trial of its own.
- 8c778ec: The Components list no longer prefixes a component's name with part of its title (`weasel-ui/Sidebar`, `Primitives/StatusBar`) just because another library ships a component of the same name. The library tag already tells those apart; names are widened only where two components in the same library collide, such as the three `Gallery` stories.
- 4db48a8: Declare `@weasel-js/ui` as a dependency.
  
  The workshop shell imports it, and forge's build leaves every `@weasel-js`
  package external, so the published shell asked for a package forge never
  declared. It only resolved when something else — labkit — happened to install it.
- 6857b4d: Trial titles separate their segments with `>` rather than `/`, and leave out an `index` segment.
- a564aea: Stories render in the workshop page instead of in an iframe each.
  
  A story is now a labkit instrument directly: its schema is the trial's, its
  render runs in the page inside a host that applies the globals to itself,
  portals weasel overlays into itself and contains fixed-position descendants.
  A story that needs its own document sets `isolate: '<why>'` (CSF:
  `parameters.forge.isolate`) and keeps the frame path unchanged;
  `check:forge-isolate` lists those and refuses an increase. A `viewport` story
  renders as a fixed-size box the trial pans and zooms, so `vw`, `vh` and media
  queries inside it read the page.
  
  `applyGlobals` in the frame config now receives a target, `{ root, scope,
  style }`, instead of a bare root: `style(css)` writes a rule that reaches that
  story alone. Editing a story file reloads it in place, with each trial's
  config and state kept. `runStory` renders through the same host, with no
  message channel.
  
  `@weasel-js/ui`'s Toast story is the one isolated story: React Aria's toast
  region portals to `document.body` with no container option.
  
  `@weasel-js/labkit` gains `LabBoundary`, which renders its children as though
  no lab, trial or theme were above them, and `@weasel-js/theme/react` exports
  `ThemeContext` so such a boundary can hide an outer theme. A story host in the
  workshop, which is itself a lab, wraps every story in one.
  
  A story reached by its URL, typed, linked or pasted, now shows in the focused
  trial the way a click in the tree does, instead of opening another trial
  beside it. Only a lab with no trial gets a new one; Shift-click is what opens
  another.
- 668d929: Every component in forge now has an index page, and stories open faster.
  
  Clicking a component's row in the sidebar opens its index page, which shows all
  of the component's stories in one frame, each at its defaults and then once per
  value of each boolean and enum control. A component supplies its own page with
  a native meta's `index`, or `parameters.forge.index` in a CSF file; either is
  handed the stories and the generated page's parts (`IndexContext`). The sidebar
  opens on the Components view, badges each component with its package (`ui` for
  `@weasel-js/ui`), and sets stories lighter than the components holding them.
  
  The workshop keeps two frame documents loaded ahead of need and moves one into
  a trial with `moveBefore`, so opening a story loads only the story's own
  modules. Frames now ask for their port with a hello message, and the handoff
  names what to show. `FrameSetup.prepare` is awaited before a story first
  renders, for imports only some stories need. `@weasel-js/labkit/config` no
  longer loads `@weasel-js/ui` at runtime.
- f9f338e: `<Lab theme>` sets the theme the lab's chrome resolves against, defaulting to
  `interstellarTheme`. forge's shell config takes `labTheme(globals)`, the theme
  the workshop's own chrome takes at the lab's current globals, so a global can
  restyle the workshop as well as the stories. A global declared `under` another
  shows in a popover beside that one's select rather than in the toolbar itself.
- 96a5302: `--wzl-tree-indent` is now a declared override hook: it appears in the token manifest, and setting it on a container sets the indent of each `Tree` level. Unset, the indent is one twisty plus one gap, as before. forge's package tags in the story tree now color themselves with `Badge`'s peer `tone`, replacing the per-package `--badge-edge` rules and the `fg-lib--*` classes.
- Updated dependencies [bbf1de2]
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [dfbed19]
- Updated dependencies [7216628]
- Updated dependencies [a581611]
- Updated dependencies [5f45cb4]
- Updated dependencies [928fa33]
- Updated dependencies [d7577d2]
- Updated dependencies [64f4739]
- Updated dependencies [9689a2a]
- Updated dependencies [90a2d9b]
- Updated dependencies [a9a61f0]
- Updated dependencies [04ff89b]
- Updated dependencies [c373af4]
- Updated dependencies [22eba68]
- Updated dependencies [bfe6a4f]
- Updated dependencies [1589afd]
- Updated dependencies [2af33a4]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [9a25ac4]
- Updated dependencies [f4712fe]
- Updated dependencies [07b106f]
- Updated dependencies [f1c96ff]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [12cab9f]
- Updated dependencies [23c4282]
- Updated dependencies [7c98a5a]
- Updated dependencies [a564aea]
- Updated dependencies [668d929]
- Updated dependencies [b466aad]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [6ab0006]
- Updated dependencies [5345efb]
- Updated dependencies [750124f]
- Updated dependencies [9e77264]
- Updated dependencies [609d801]
- Updated dependencies [497727a]
- Updated dependencies [2da83b8]
- Updated dependencies [1bcbbf6]
- Updated dependencies [f0a74f8]
- Updated dependencies [7215cd1]
- Updated dependencies [5382c7e]
- Updated dependencies [601d72c]
- Updated dependencies [f9f338e]
- Updated dependencies [5c6072f]
- Updated dependencies [941bd9e]
- Updated dependencies [c0c6971]
- Updated dependencies [0ac85d7]
- Updated dependencies [e9bfe55]
- Updated dependencies [d7d99ee]
- Updated dependencies [61ba0a2]
- Updated dependencies [87fd8a8]
- Updated dependencies [3ed8213]
- Updated dependencies [df69809]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [6a6d9f6]
- Updated dependencies [5ad1478]
- Updated dependencies [83c4a3e]
- Updated dependencies [ce53e3c]
- Updated dependencies [edf7878]
- Updated dependencies [cf69850]
- Updated dependencies [08b80b8]
- Updated dependencies [a4d9250]
- Updated dependencies
- Updated dependencies [bd1877e]
- Updated dependencies [5fb5bab]
- Updated dependencies [d286c84]
- Updated dependencies [2efeb82]
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [106139a]
- Updated dependencies [6857b4d]
- Updated dependencies [9789097]
- Updated dependencies [da3b958]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [731573b]
- Updated dependencies [f9ff231]
- Updated dependencies [debfd5d]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [74cc4df]
- Updated dependencies [62d8d7c]
  - @weasel-js/ui@1.6.0
  - @weasel-js/labkit@1.6.0
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0

## 1.5.2

### Patch Changes

- 785cde0: Add Get Info to weaselforge, and let the tool palette hold commands.
  
  `ToolItem` takes an optional `onActivate`. An item carrying one is a command
  rather than a mode: it presses instead of latching, never writes the tool slot,
  and never reports itself as the current tool. Both contribution unions take the
  context generic, with a default that leaves existing call sites alone.
  
  forge contributes **Info** to that palette (⌘I). It opens a dialog holding a
  fixed dossier for the focused trial's story: where it comes from — title,
  export, id, library and file path — the JSDoc written above its export and
  above its meta, and a row per arg with its kind, current value, default and
  description. `indexFile` harvests the two comments and the meta's `component`
  identifier from the AST it was already parsing, so the dossier reads correctly
  for a story nobody has opened.
  
  `useStoryRegistry` gains `isReady(id)`. An instrument exists with an empty
  schema before its frame reports one, so without it a story that has not loaded
  is indistinguishable from a story that takes no args.
- f9712f0: A lab says how much room its chrome takes.
  
  `<Lab density>` picks the theme's density axis for the lab's own shell —
  `'compact'`, `'comfortable'` (the default, unchanged) or `'roomy'`. The trials
  and their instruments are unaffected: this sizes the header, the sidebar, the
  tool rail and the palette around them.
  
  A lab that is the whole window rather than a panel beside one reads better at
  `'roomy'`, so weaselforge takes it: its chrome goes from 13px body text and
  24px controls to 15px and 28px. A story's frame keeps its own density, which
  is still the workshop's `Density` global.
  
  Get Info was a 40rem box in a full-width window, narrow enough to wrap a story's
  file path onto a second line. It is 52rem now.
- 41e2223: Draw a group of sizes as one grid of steps, generated from a base.
  
  Three or more numbers, dimensions or durations sharing a group now draw the way
  a color family does: one compact grid, each cell labeled with what its name adds
  to the shared prefix (`2xs`, `1`, `track-h`). A group whose steps all carry one
  unit says it once beside the group name; `slider` and `tracking`, whose units
  differ, keep a unit per cell.
  
  `TokenPanel` takes `scales` and `onScaleChange` for a group that is generated
  rather than authored step by step. Such a group edits its base and its rule —
  one multiplier per step, a constant ratio, or a constant step — with the
  multipliers sitting under the steps they scale, and `refitScale` fits the new
  rule to the steps as they stand when the rule changes. The panel reports the
  parameters; regenerating the values stays with the consumer.
  
  forge's CSS Vars panel wires that to the theme's own scales: the rule comes from
  the definition, the base is read back from the values the frame reports, and the
  steps are regenerated with the engine's `scale` so rounding matches the build.
  A swatch also names its variable in a tooltip the moment it is hovered, in place
  of the browser's delayed `title`.
- Updated dependencies [11d949e]
- Updated dependencies [bbfdacd]
- Updated dependencies [1c695cb]
- Updated dependencies [785cde0]
- Updated dependencies [55ace67]
- Updated dependencies [24a2dae]
- Updated dependencies [f9712f0]
- Updated dependencies [665ff53]
- Updated dependencies [2e52d31]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [41e2223]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [8081a6b]
  - @weasel-js/labkit@1.5.2
  - @weasel-js/core@1.5.2
  - @weasel-js/theme@1.5.2

## 1.5.1

### Patch Changes

- c86cb42: A story file whose meta names no `title` is now titled the way Storybook titles
  it: by its path under the directory of the first `stories` glob that matches it,
  with `Button/Button.stories.tsx` collapsed to `Button` and a trailing `index` or
  `stories` file name dropped. Such a story's id and link now match Storybook's.
  
  Breaking for anyone calling the frame or test entry points directly:
  `mountFrame` no longer takes `root`, and each index entry passed to it carries
  its `title`; `mountFrame`'s `load` option and `runStory` take the title for a
  file whose meta names none in place of the vite root. The `forge()` and
  `forgeTest()` plugins pass these for you.
- b9d1145: Drop the `./` from the `weaselforge` bin path, so publishing stops warning.
  
  npm normalizes `./dist/cli.js` to `dist/cli.js` and reports it as
  `"bin[weaselforge]" script name dist/cli.js was invalid and removed`. Nothing
  was removed — the published manifest has always carried a working bin — but the
  wording reads as a broken CLI, which is worth not printing on every release.
- 9893d53: forge honors Storybook's conditional controls: an argType's `if` naming another arg
  — truthy by default, or with `truthy: false`, `exists`, `eq` or `neq` — shows that
  control only while the condition holds, through labkit's `showIf`. A condition on a
  global is ignored, since a story's config does not carry the lab's globals.
  
  weasel-ui's CurveEditor story shows its grid divisions control only while Show grid
  is on.
- 5238ae8: forge types its own CSF. `Meta`, `StoryObj`, `ArgsOf`, `CsfDecorator`,
  `CsfStoryContext`, `CsfPlayContext`, `CsfStep` and `ArgType` are exported from
  the package root, describing the annotations forge's loader actually reads — so
  a CSF file is typed by the tool that renders it and needs no Storybook install.
  They are deliberately narrower than Storybook's: a field forge ignores is not
  in them.
  
  New `@weasel-js/forge/play` carries what a `play` function asserts with:
  `expect` (chai with `@vitest/expect`'s jest-style matchers), and testing-library's
  `within`, `screen`, `waitFor` and `userEvent`. A play runs inside the story's
  frame, which cannot import `vitest` — that entry only exists inside a test
  worker. No jest-dom matchers: they install through `expect.extend`, which wants
  matcher state no frame has; assert on the DOM directly instead.
  
  The Storybook shim plugin now answers for `storybook/test` as well as
  `storybook/preview-api`, so third-party CSF written against either keeps
  resolving.
- d16e0bd: A lab has a second pane region, `aside`, which holds sidebar sections on the far
  side of the workspace from the sidebar, with its own resizable seam, width and
  fold state. `LabAsideRegion` mounts it under a bare `LabShell`. `Split` takes
  `side: 'end'` to put its sidebar after the content.
  
  forge's CSS Vars panel moves out of each trial and into the lab's aside, where
  it shows the focused trial and names it.
- eb4c4c4: labkit re-exports weasel-ui's `Input` and `InputProps` from its main entry.
  
  forge's CSS Vars panel shows each variable as one row: its name as written, in
  monospace, over a single field holding the value, with the color swatch inside
  the field for a color and a Reset button beside it once overridden. The
  Theme/Story tabs are flat and full height, and they stay at the top with the
  filter while the list scrolls. The list is no longer capped at 60% of the
  viewport; it fills the aside.
- 006cafb: A config node's `validate` now receives the instrument's whole config as its
  second argument, so its errors can depend on the value being validated. This is
  additive: a validator that takes only the leaf keeps working.
  
  forge keeps each config's validation errors apart. Two trials of one story used
  to share a single errors map, replaced by whichever frame answered last; each
  trial now reads the errors its own config produced.
- ff10b99: A lab now tracks a focused trial: `focusedTrialId` on the lab context names the
  trial last pointed at or focused, counting focus that moved into a frame inside
  it, and a trial that `addTrial` or `cloneTrial` opens takes it. `focusTrial`
  sets it. With more than one trial open, the focused one draws its border in the
  accent color. `swapTrial(id, instrumentName, options)` puts a fresh trial of
  another instrument in a trial's place, keeping its tile size and sidebar width.
  
  forge's story tree uses both: clicking a story runs it in the focused trial, and
  Shift-click or Shift+Enter opens another trial. Cmd- and Ctrl-click are left to
  the browser. The tree's text is a step larger.
- fd99e7e: A story frame now tells the workshop when its first render has committed, with a new
  `rendered` message, and the workshop keeps a freshly loaded frame hidden until then — or
  until the frame faults, so a fault still shows. A new or swapped trial no longer flashes
  the frame's blank white document before the story appears; the story fades in instead.
- 19ba5b3: A CSF arg that is an object or array holding a function, a React element or a class
  instance now gets an object control instead of none. The control edits the fields
  that can cross to the frame; the frame puts the rest back from the story's own arg
  before rendering, so JobProgress's `job`, Lab's `instruments` and Powerline's
  `segments` are editable in forge the way they are in Storybook. Additive.
- bd41197: labkit re-exports weasel-ui's `Select` and `SelectProps`, beside the other ui
  controls it passes through. forge's header globals (Mode, Font, Weight, Width,
  Italic) now use it in place of native selects, each sized to its widest option.
- 1e61744: The workshop no longer rebuilds a story's instrument when its frame answers for
  a config no open trial is showing, such as a late answer for a value the trial
  has already moved past. The answer is still kept, and a trial that returns to
  that config reads it.
- f1c53ce: A forge shell config can list the project's other labs: `pages` puts them in the
  workshop's title menu, and `path` says which of them the workshop is when its URL
  cannot, as when each lab's dev server runs on its own port. The repo's forge and
  palette lab now link to each other through that menu.
- c18db86: Check every story's accessibility again. axe runs inside the story's own frame, over the story's subtree rather than the whole frame document, and answers the workshop over the frame's message channel; the workshop shows what it found per story in an Accessibility aside, and holds the last answer against the trial.
  
  New: the `a11y.run` / `a11y` protocol pair, `A11yReport` / `A11yFinding` / `A11yNode` from `@weasel-js/forge`, and `useTrialFrame`, `TrialFrame.audit`, `TrialFrame.a11y` and `A11yPanel` from `@weasel-js/forge/shell`. An audit is held until the frame says it has rendered, so it never judges an empty story. `axe-core` is a new dependency of the package and loads only when a frame is first audited.
  
  `TrialFrames.connect` now takes `{ send, audit }` in place of a bare `send`.
- 9c72667: Mark up a forge story and export the picture with the marks on it. A story instrument now declares an annotation target for the story itself: the frame serializes its own subtree into an SVG `<foreignObject>` and sends it back over the frame's message channel as the target's `base()`, and the target's content box is the size the frame already measures.
  
  labkit's annotation rail gains an `Interact` tool, which is what a lab with an annotating instrument now starts in. The overlay's input box passes pointer events through while the rail holds a tool that makes no marks, so an instrument under it — a forge story, say — stays clickable. Before this, the rail's default `Select` sat over every picture and took every click.
  
  New in `@weasel-js/forge/shell`: `TrialFrame.capture`, `TrialFrame.size` and `TrialFrames.hostRef`. `TrialFrames.connect` takes `capture` alongside `send` and `audit`.
- 4e79b2e: forge unmounts a story's frame while its trial is well out of view and reloads
  it when the trial comes back, so many canvas-heavy trials open at once no longer
  hold every WebGL context the browser allows. The trial keeps the story's config
  and state, and the reloaded frame starts from them. A browser without
  `IntersectionObserver` keeps every frame mounted, as before.
- 1e58dda: forge's CSS Vars panel follows a change to any attribute in the frame, not only
  `style` and `class`. A theme switched by an attribute such as `data-wzl-mode` —
  say, by following the OS color scheme with no globals change behind it — now
  shows the new mode's values.
- 1b2c417: A config section can lay out its own rows: `.section(label, { layout, pack })` puts
  every row under that heading in the given label layout and grid packing, over the
  panel's `layout` and `pack`. Say it on any one node in the section; the resolved
  `SectionSpec` carries both. Other sections keep the panel's.
  
  forge's Globals section in a trial's Settings now uses `{ layout: 'inline', pack:
  'pairs' }`: two globals to a row, each with its label beside its dropdown.
- cb5c172: `SelectRow` renders weasel-ui's `Select` rather than a native `<select>`, so a
  property row's dropdown opens the same listbox as every other weasel select. Its
  props are unchanged: an unchosen or unknown value still shows the placeholder. Code
  that drove the row as a native select — `selectOption`, or a `change` event on it —
  now opens the trigger and picks an option instead.
  
  `Select` gains `variant: 'bare'`, which drops the box for a select set in other
  chrome, and reads its value alignment from `--wzl-select-align`. An inline property
  row sets that to `right`, keeping its values against the chevron.
  
  labkit's config panels and forge's trial Settings pick up the change through
  `SelectRow`.
- 5e79d5b: weasel-ui gains `TokenPanel`, which edits a set of design tokens by type. It files
  tokens into collapsible sections (Color, Type, Size, Motion, Depth, Other), draws a
  color group of three or more as one row of swatches sized to fit — picking a swatch
  opens that token's editor — and gives each type its control: a number that keeps its
  unit for dimensions, durations and numbers, the nine weights for a font weight, a
  curve beside a `cubic-bezier()`, a swatch beside a color, and text for the rest. An
  overridden token offers Reset. `tokenCategory` and `inferTokenType`, which reads a
  DTCG type off a value, are exported beside it. labkit re-exports all of them.
  
  forge's CSS Vars panel is now a `TokenPanel`. The Theme tab takes each token's type
  and group from the theme's manifest; the Story tab uses the manifest for a token it
  knows and infers the rest, and which sections are collapsed persists with the lab.
- Updated dependencies [7ebfd0f]
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [2c596ec]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [d16e0bd]
- Updated dependencies [eb4c4c4]
- Updated dependencies [006cafb]
- Updated dependencies [ff10b99]
- Updated dependencies [bd41197]
- Updated dependencies [9c72667]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
- Updated dependencies [b7f3f90]
- Updated dependencies [f4049be]
- Updated dependencies [39b0cd4]
- Updated dependencies [8a7d258]
- Updated dependencies [4aa184b]
- Updated dependencies [97f3252]
- Updated dependencies [545c753]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [23b1c66]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [b6a5eed]
- Updated dependencies [98ad39c]
- Updated dependencies [67f3867]
- Updated dependencies [f663199]
- Updated dependencies [a80e8db]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [d963d14]
- Updated dependencies [edb825a]
- Updated dependencies [229a16a]
- Updated dependencies [f9feecc]
- Updated dependencies [b981856]
- Updated dependencies [1b2c417]
- Updated dependencies [cb5c172]
- Updated dependencies [c6f21e5]
- Updated dependencies [0662a2d]
- Updated dependencies [313fe15]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
- Updated dependencies [d798e73]
- Updated dependencies [21ce23e]
- Updated dependencies [dda4172]
- Updated dependencies [a39a885]
- Updated dependencies [55b5524]
- Updated dependencies [045998f]
- Updated dependencies [56cad3a]
- Updated dependencies [f9f41e2]
- Updated dependencies [fa56d1e]
- Updated dependencies [272ab0d]
- Updated dependencies [ff17dd7]
- Updated dependencies [f2b8d57]
- Updated dependencies [0d169d0]
- Updated dependencies [e0799cb]
- Updated dependencies [5e79d5b]
- Updated dependencies [70e9fad]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/labkit@1.5.1
  - @weasel-js/core@1.5.1
  - @weasel-js/theme@1.5.1

## 1.5.0

### Patch Changes

- 615577b: `@weasel-js/forge` is a new package: a component workshop built on labkit. Each story renders in its own frame document, and its controls, state, undo and snapshots live in a lab trial beside it. It takes labkit and core as peers.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [bc78766]
- Updated dependencies [b25b09b]
- Updated dependencies [dd48085]
- Updated dependencies [35e36b1]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [cf85a67]
- Updated dependencies [2f1ddd0]
- Updated dependencies [42400c9]
- Updated dependencies [83d7aa0]
- Updated dependencies [ffe18ef]
- Updated dependencies [f233e30]
- Updated dependencies [39ace84]
- Updated dependencies [95588b7]
- Updated dependencies [32ed674]
- Updated dependencies [37ebba6]
- Updated dependencies [ed849b7]
- Updated dependencies [4502f91]
- Updated dependencies [2f6480d]
- Updated dependencies [ffffe49]
- Updated dependencies [294944f]
- Updated dependencies [2ca8bf5]
- Updated dependencies [70a88b6]
- Updated dependencies [f28e29d]
- Updated dependencies [6203e60]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
- Updated dependencies [7256ac8]
- Updated dependencies [a41a83a]
- Updated dependencies [794b4ff]
- Updated dependencies [b65f4df]
- Updated dependencies [90f0bd8]
- Updated dependencies [b5b8b69]
- Updated dependencies [b2f2d45]
- Updated dependencies [6f5ff46]
- Updated dependencies [edd5b39]
- Updated dependencies [2e2041b]
- Updated dependencies [65806bc]
- Updated dependencies [a614be4]
- Updated dependencies [ef60ff6]
- Updated dependencies [269d432]
- Updated dependencies [486f631]
- Updated dependencies [eaf38e2]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [6beda78]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/labkit@1.5.0
  - @weasel-js/theme@1.5.0
