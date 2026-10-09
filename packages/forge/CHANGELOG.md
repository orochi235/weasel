# @weasel-js/forge

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
