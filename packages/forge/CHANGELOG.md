# @weasel-js/forge

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
- Updated dependencies [f644eac]
- Updated dependencies [b984947]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [d16e0bd]
- Updated dependencies [eb4c4c4]
- Updated dependencies [006cafb]
- Updated dependencies [ff10b99]
- Updated dependencies [bd41197]
- Updated dependencies [626bace]
- Updated dependencies [f4049be]
- Updated dependencies [39b0cd4]
- Updated dependencies [97f3252]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
- Updated dependencies [2a63f31]
- Updated dependencies [66e0e10]
- Updated dependencies [8b79c20]
- Updated dependencies [f663199]
- Updated dependencies [a7519a1]
- Updated dependencies [187593e]
- Updated dependencies [08a3aec]
- Updated dependencies [f9feecc]
- Updated dependencies [1b2c417]
- Updated dependencies [cb5c172]
- Updated dependencies [c6f21e5]
- Updated dependencies [313fe15]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
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
