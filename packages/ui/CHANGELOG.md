# @weasel-js/ui

## 1.6.0

### Patch Changes

- bbf1de2: Text drawn in the accent color now reads `--wzl-accent-fg` instead of the accent fill tokens: Properties readouts and their editable input, `NumberField`'s ghost variant, Timeline's checked transport buttons, forge's current story and labkit's button hover. A surface that rebinds `--wzl-accent` to recolor its controls' fills can now set the text color separately. In dark mode the readouts get brighter, since `accent-fg` is the strong accent there. `npm run check:token-reads` now fails on `color:` reading an accent fill token.
- 16c0da2: Kit actions can now fill a whole editor toolbar from the registry.
  
  - `Action.variants` lists the separate things a parametric action does, each with its own label and params. `flip` declares Flip Horizontal and Flip Vertical; `reorder.forward` and `reorder.backward` declare their one-step and all-the-way forms. `actionItems(action)` expands an action into the entries a bar, menu or palette shows: one per variant, or the action itself. An action without an immediate invoker gets none, because `trigger` cannot start a drag.
  - `actionShortcuts(action, params)` returns only the shortcuts whose binding passes those params, so each variant shows its own key.
  - `ActionBar` renders one button per entry and triggers it with that entry's params. `icons` and `labels` are now keyed by entry key (`flip:y`, `reorder.forward:extreme`), which is still the action id for an action without variants. `enabled` is evaluated with the deps the action declares in `requires`, not a fixed set of six, and a tooltip without a `shortcut` override now shows the binding's key.
  - New groups: `history` (undo, redo), `clipboard` (cut, copy, paste), `edit` (duplicate, delete), `structure` (group, ungroup) and `flip`.
  - New `clipboard.paste` action, which calls the `clipboard` dep's `paste()`. It has no key binding, because Cmd/Ctrl+V already arrives as a paste event.
  - `enabled` now follows the current state: undo and redo follow the history stacks, `delete` and `group` need a selection, `ungroup` needs a selected container, and `clipboard.paste` needs a non-empty clipboard. `delete`, `group` and `ungroup` used to report enabled unconditionally.
  - Align actions now register left, center, right, top, middle, bottom.
  - `buildDepsFromRequires` is re-exported from `@weasel-js/core`.
- b8ebef6: The eight glyphs the align and distribute actions ship are now exported from `@weasel-js/core` and re-exported from `@weasel-js/ui`, beside the Pathfinder and edit-action icons: `AlignLeftIcon`, `AlignCenterXIcon`, `AlignRightIcon`, `AlignTopIcon`, `AlignCenterYIcon`, `AlignBottomIcon`, `DistributeHorizontalIcon` and `DistributeVerticalIcon`. They are the same components the actions draw, so a consumer can render one outside an `<ActionBar>` without authoring its own.
- dfbed19: An auto row's `AUTO` readout is no longer italic and draws at the extra-small size, a step below the row label. Its color reads `--wzl-secondary-fg`, falling back to `--wzl-fg-subtle` where a theme does not set one.
- 7216628: A `Badge` can now trigger a kit tooltip. `Badge` forwards its `ref` and any other DOM attributes to its root element, so it works as the child of `Focusable` under a `TooltipTrigger`, and `@weasel-js/ui` now exports `Focusable` so that pattern needs no direct react-aria-components import. For the common case, `tooltip` does the wrapping itself: a badge that is neither a button nor a link becomes focusable as `role="img"`, named by `aria-label` or else by its string content, because a tooltip trigger has to be reachable by keyboard and announce its description.
- a581611: `Badge` gains a `success` status, painted from `--wzl-success`, and an `xs` size for counts and markers inside a dense row. `xs` sets its type on the `--wzl-font-size-2xs` step with tighter padding, so a small badge no longer needs a hand-set font size and a `transform: scale()` on top of `sm`.
- 5f45cb4: `ToggleBarItem` and `ButtonBarItem` take `shortcut` and `tooltip`, so a segmented bar can show shortcut hints. `shortcut` puts a kit tooltip on the segment reading `Name (⌘B)`, named by `ariaLabel` or a string `label` — the same form `ToolButton` and `ActionBar` use. `tooltip` replaces that text with any content. Items with neither render exactly as before, and arrow-key navigation is unchanged.
- 928fa33: `Button` takes `status` (type `ButtonStatus`: `neutral`, `muted`, `accent`, `success`, `warn`, `danger` — the same set as `Code`'s statuses, from the same tokens) to recolor the `link` variant's text, so a link can read as destructive or as a quiet secondary reference. A link is still `accent` when no status is given. The boxed variants carry their weight in their fill and ignore `status`.
- d7577d2: `Button` gains a `link` variant: a real `<button>` that reads as a hyperlink, for in-page navigation where there is no URL to put in an `<a href>`. It drops the control box — no height, padding, fill or gloss — and takes its font from the surrounding text, so it sits inside a sentence or a table cell at that text's size. The text is painted with `--wzl-accent-fg`, the accent-as-text token.
- 64f4739: `Button` takes `shortcut` and `tooltip`, the same fields `ToggleBarItem` and `ButtonBarItem` have. `shortcut` puts a kit tooltip on the button reading `Name (⌘S)`, named by `ariaLabel` or string children, so a shortcut hint no longer needs a wrapping `title` span; `tooltip` replaces that text with any content. A button with neither renders exactly as before.
- 9689a2a: New `CheckIcon` (glyph name `check`) in the State family beside `info`, `warning` and `error`: an open check mark for a success, handled or confirmed state.
- 90a2d9b: The theme gains a transparency checker and a workspace pair. `--wzl-checker-a` and `--wzl-checker-b` are the checker's two squares (`border` and `surface`) and `--wzl-checker-size` is one repeat of it (8px); `PaintField` and `ColorField` now paint their empty and mixed chips from them instead of each restating the gradient's colors and size, so a theme can restyle every checker at once. `--wzl-workspace-surface` (`surface-sunken`) and `--wzl-workspace-line` (`line-subtle`) are the ground of a canvas app's workspace — the area around the document page — and the marks drawn over it. All five follow the color mode.
- a9a61f0: New `Code` component: an inline `<code>` span for literal text — identifiers, types, key paths — in the monospace face. `status` colors it (`neutral`, `muted`, `accent`, `success`, `warn`, `danger`; `success` and `danger` serve as a diff's added and removed sides), `variant` picks a tinted chip (`subtle`) or bare colored text (`plain`), and `size` pins the type to a theme step or, left unset, follows the surrounding text. The text keeps its case and wraps anywhere, with the chip repeating its padding on each line, so a long type signature breaks cleanly. `Badge` stays the label chip; it uppercases and was not built to quote.
- 04ff89b: A color-mode choice with a way back to Auto, as kit surface instead of something each app rebuilds.
  
  `@weasel-js/theme` exports the `ColorModePreference` type (`'auto' | 'light' | 'dark'`), `ColorMode` (`'light' | 'dark'`) and `isColorModePreference`. `@weasel-js/theme/react` adds `useResolvedColorMode(preference)`, which follows the OS setting live under `'auto'` and returns an explicit choice as given, and `useColorModePreference({ storageKey, storage, defaultPreference })`, which holds the choice, optionally remembers it in `localStorage` (or a store you pass), and returns `{ preference, setPreference, mode }`. `mode` is what goes in a `ThemeProvider`'s `selection`. Storage that is missing or throws leaves the choice unremembered rather than failing.
  
  `@weasel-js/ui` adds `ColorModeControl`, the Auto / Light / Dark radiogroup drawn with the mode glyphs, controlled by `value` and `onChange`.
  
  labkit's header now renders `ColorModeControl`, and `<Lab>` and `<LabRoot>` resolve their mode with `useResolvedColorMode`; `LabMode` is an alias of `ColorModePreference`. Switching a lab back to Auto now picks up an OS change made while it was pinned.
- c373af4: Color ramps can interpolate in OKLab, HSL, sRGB and linear sRGB as well as OKLCH. `@weasel-js/ui` adds `colorRamp(from, to, steps, options)` and `rampColor(from, to, t, options)`, whose `space` option picks the space (default `'oklch'`), `hue` picks the shorter or longer arc in the polar spaces, and `chroma` applies a `ChromaCurve` after interpolation in any space. Underneath, `@weasel-js/paint` (re-exported from core) adds `interpolateSrgb` with the `ColorInterpolationSpace` and `HueInterpolation` types, plus float-precision `srgbToLinear`, `linearToSrgb`, `linearSrgbToOklab`, `oklabToLinearSrgb`, `srgbToHsl` and `hslToSrgb`. The forge story `ui/Color/ColorRamp` shows the same endpoints ramped in each space.
- 22eba68: `formatCompact` shows three significant figures above a thousand — `40.0K`, `294K`, `2.00M` — instead of one fixed decimal, so a slider's compact readout holds one width whatever the value; `294.0K` no longer fits where `40.0K` did.
- 2af33a4: `DataGrid` rows can now carry state, be activated, and open a detail row.
  
  - `rowClassName(row)` adds a class to that row's `<tr>`.
  - `onRowClick(row)` makes each row focusable and calls back on a click or on Enter/Space. The row keeps its table-row role, and a click on a control inside a cell is left to that control.
  - `renderDetail(row)` adds a leading disclosure column and renders a full-width row under each expanded row. Expansion is uncontrolled (`defaultExpandedIds`) or controlled (`expandedIds` + `onExpandedChange`); `rowExpandable(row)` hides the disclosure on rows with nothing to show. Detail rows stay under their parent when the grid is sorted, and drag reordering ignores them.
  - `useReorderDragList` takes a `rowSelector` for a container whose children are not all rows.
- 9a25ac4: New `DetailList` and `DetailRow`: a read-only list of labelled values, rendered as a `<dl>` with one `<dt>`/`<dd>` pair per row. A value can be any run of elements — code chips, badges, keycaps, links — and wraps inside its column rather than widening the list. Labels take the params label recipe and rail: the label column is `--wzl-params-label-width` wide (its content width by default), and case, tracking and alignment follow the other three `--wzl-params-label-*` properties, so a detail list lines its labels up with a property panel's inline rows. `title` puts a heading above the list and names it by it; `layout="block"` stacks each label over its value for narrow columns.
- f4712fe: A row can now hold an editor too big for it. weasel-ui's `DialogRow` shows a one-line summary of the value on a button, and the button opens a modal around whatever body it is given; `ListEditor` edits a list of strings one field per entry. In labkit, `.dialog(body)` on any config leaf moves that leaf's control into such a dialog, and `inDialog(body)` builds the same row as a renderer for a panel's `renderers`. The new `f.list([...])` leaf is a list of strings drawn this way by default, and an `f.value` whose default is an array of strings now resolves to it.
- 07b106f: `Disclosure` draws a 13px dark violet rounded square holding a white `+` while its
  section is shut and a `−` while it is open, in place of the turning triangle.
  `--wzl-disclosure-fill` recolors it.
  `DisclosureMark` is the same mark on its own, for a row that is itself the
  control; `SidebarPanel` and `Timeline` lanes now use it. `Disclosure`'s
  `direction` prop and the `DisclosureDirection` type are gone, since the mark no
  longer points.
  
  `Badge` now honors its size: a `font: inherit` declared after its
  `font-size` had reset every badge to its parent's font size.
- f1c96ff: WeaselDraw's preferences dialog moves to the rail layout, with the filter field
  on. Its five groups used to wrap into columns the dialog was too narrow to
  hold.
  
  `Dialog`'s `min-height: 0` moves into the same `:where()` block as its padding
  and overflow. Left in a plain rule it beat `bodyClassName` on source order, so
  a body asked to hold a height did not, and the dialog resized itself around
  whichever pane was open.
- 0cf6a0d: The clipboard, duplicate, group, ungroup, reorder and flip actions now ship their own icons, so `<ActionBar group="clipboard" />` and its siblings draw glyphs with no `icons` map. Each reorder and flip variant carries its own glyph (Bring Forward / Bring to Front, Send Backward / Send to Back, Flip Horizontal / Flip Vertical). The twelve glyphs are exported from `@weasel-js/core` and `@weasel-js/ui` as `CutIcon`, `CopyIcon`, `PasteIcon`, `DuplicateIcon`, `GroupIcon`, `UngroupIcon`, `BringForwardIcon`, `BringToFrontIcon`, `SendBackwardIcon`, `SendToBackIcon`, `FlipXIcon` and `FlipYIcon`, in the same 20×20 `currentColor` register as the Pathfinder icons. An `icons` entry still overrides them.
- 12cab9f: `EffectCard` and `EffectCardList` are removed; a reorderable list of toned,
  collapsible sections is `LayerStack`, now built from kit parts.
  
  - `PropertyGroup` takes `leading` and `actions`, which share its title row, and
    a toned group draws its leading edge in its tone.
  - `PropertyList` forwards its ref, so its groups can reorder with
    `useReorderDragList`, whose row handler may now sit on a handle inside the row.
  - `LayerStack` renders each card as a `PropertyGroup` in a `PropertyList`, with
    the kit's `Select` for a hoisted primary value and a ghost during a drag. Its
    items take `tone` where they took `accent`, which is a breaking change for any
    caller passing `accent`.
  - `DragGhost` is the pointer-following copy on its own, which `ItemList` and
    `LayerStack` both use.
- 23c4282: `Select`, `Input` and `NumberField` with `orientation="row"` now lay their
  label and control out side by side. Each field's own `.field` rule declared
  `flex-direction: column` at the same specificity as `Field`'s shared row class
  and came later in the cascade, so the row class was applied and the label still
  stacked above the control. A `width="fit"` Select in a row also sizes its
  trigger to its options instead of wrapping it onto its own line.
- 7c98a5a: Two paint controls for drawing apps. `FillStrokeSwatch` shows the active fill and stroke as the overlapping pair: fill a solid square behind, stroke a frame in front that the fill shows through. Each chip is a native color picker that reports `onInput` while it is open and `onChange` once when it closes, and the chip that has focus is the one the None button acts on. Given the matching callbacks it also adds shift-click-for-none, a None button, Swap and Default. `SwatchGrid` is a palette that applies a color on click, or sends it to an alternate target on shift-click, right-click or Shift+Enter. It takes one tab stop, and the arrow keys move by one swatch across or by a row up and down. Both draw a translucent color over the `--wzl-checker-*` checker and mark "no paint" with the danger diagonal. Neither holds any paint state. The app routes each pick to its own state, and to the selection through `useOngoingAction`.
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
- b466aad: A pressed `ghost` `Button` keeps its pressed background under the pointer. The ghost hover rule outranked `.pressed`, so a toggle clicked on showed no change until the pointer left it.
- 7c53d1a: The undo, redo and delete actions now ship their own icons, so `<ActionBar group="history" />` and `<ActionBar group="edit" />` draw glyphs with no `icons` map. `UndoIcon`, `RedoIcon` and `DeleteIcon` move into `@weasel-js/core`, which the actions need them in; `@weasel-js/ui` re-exports them under the same names with the same props, and `<Icon name="undo" />` draws the same glyph. Core also exports `ACTION_GLYPHS`, the three glyphs' SVG markup, which `ICON_PATHS` now points at.
- 6ab0006: Keep an icon's drawn nodes across a re-render, so an icon button's click lands.
  
  `Icon` passed React a new `dangerouslySetInnerHTML` object on every render, and
  React 19 rewrites `innerHTML` whenever that object changes. A re-render during a
  press — labkit's lab toolbar re-renders on pointerdown — replaced the
  `<path>` the pointer went down on, and the browser synthesizes no `click` when
  that node is gone. The Export panel could not be opened with a mouse.
- 750124f: An inline property row's value readout now draws in the same type as a block row's. The inline layout puts the readout after the control, outside the label it used to inherit its font from, so it fell back to whatever the page's font was — the browser's default serif at 16px on a bare page.
- 9e77264: Slider readouts in inline rows take less width.
  
  - The readout's width is four digits (`calc(4.5ch + 2px)`) rather than `2.8em`, so it follows the digit width of the face, and every readout in a column is the same box: the sliders beside them end on one line. A range whose widest value needs more than four characters widens its own readout. `--wzl-property-readout-w` still overrides the width.
  - A word unit (`ms`, `px`, `%`) in an inline row hangs below the digits in capitals instead of sitting beside them, taken out of flow so a row with a unit is the same height and width as one without. Stacked rows, whose readout sits on the label line, keep the unit beside the value.
- 609d801: `Input` and `NumberField` take `orientation`, the same `'stacked' | 'row'` that `Field` and `Select` take. `'row'` sets the label beside the field at its own width, the field takes the rest of the row, and any description or error drops to a line of its own; a `NumberField` with `width="fit"` keeps its own width and centers on the label. The default, `'stacked'`, renders as before.
- 2da83b8: `ItemList` is now an accessible list rather than a column of plain divs. Its role follows what the list can do: a `list` when rows can be neither selected nor activated, a `listbox` of `option`s with `aria-selected` when `selection` is `'single'` or `'multi'`, and a `grid` when any row carries `trailing` controls (visibility, lock), since an option may not contain controls. One row sits in the tab order; Up/Down and Home/End move between rows, Enter/Space and click call the new `onActivate(id, index, mods)` with the modifiers held, and Alt+Up/Down call the new `onNudge(id, index, delta)`, which takes `useReorderDragList`'s `nudge` as-is. In a grid, Right steps into a row's controls and Left or Escape steps back; a control's own clicks and keys never activate its row. `PressModifiers` is now exported.
- 1bcbbf6: `ItemList` draws its own drop indicator: pass `dropIndex` (an insertion index, `0` above the first row, `rows.length` below the last — `useReorderDragList`'s `state.targetIndex` as-is) and the list marks the seam in the accent color. It is drawn from the row beside the seam, so it follows the rows' height at every density, needs no measuring, and adds no element to the list, so the drag hook needs no `rowSelector` to skip it. A row's new `dragging` flag dims it while it is being dragged.
- f0a74f8: `ItemList` takes `onSelectRange(ids)` for keyboard range selection. In a `selection="multi"` list, Shift+Up/Down and Shift+Home/End move focus and report every row from the anchor to the newly focused one, in list order. The anchor is the row last focused or activated by anything other than a range move, so a click or a plain arrow move starts a new range there. As with `onActivate`, what the range does to the selection stays with the consumer. A list without `onSelectRange` keeps treating Shift+Arrow as a plain move.
- 7215cd1: New `keySpecsFromShortcut(shortcut, { platform?, legend? })` turns a kit shortcut (`{ key, mod, shift, alt }`) into `KeySequence` keys, spelled for the platform the way `keySpecsFromMods` and `keySpecFromKey` spell them: `⌘ Z` on macOS, `Ctrl Z` on Windows. An optional shift renders as an optional key. It replaces `formatShortcutParts(s)?.map((label) => ({ label }))`, which always printed macOS glyphs and dropped an optional shift. The `ShortcutInput` type it takes is now exported, and labkit's `weasel-ui` passthrough carries the helper.
- 5382c7e: `KeySequence` now recognizes Windows and Linux modifier labels (`Ctrl`, `Alt`, `⊞`, `Win`, `Super`) and macOS text legends (`Cmd`, `Option`, `Control`, `Shift`) as modifiers, so they sort ahead of the key and get the `+` separator. Previously only the macOS glyphs did, and a Windows shortcut rendered in input order with no separator. Those labels also take the modifier chip width now.
- 61ba0a2: `LayerStackItem.accent` is replaced by `tone`, the same prop `EffectCard` takes: an index into the theme's tone list, which follows light and dark mode, or a color given directly. Breaking for anyone passing `accent`; a color string moves across unchanged as `tone`.
- 3ed8213: `MenuButton` and `Select` take `shortcut` and `tooltip`, the same fields `Button`, `ToggleBarItem` and `ButtonBarItem` carry. `shortcut` puts a kit tooltip on the trigger reading `Name (⌘N)`, named by `aria-label` or a string `label`; `tooltip` replaces that text with any content. A trigger with neither renders exactly as before, and opening the menu or list is unchanged.
- df69809: `LayerStack`, labkit's `LayerList` and WeaselDraw's `LayerList` are one
  component: `LayerList` in `@weasel-js/ui`. This is a breaking change for callers
  of either old component.
  
  - A layer is a one-line row, or a card when `renderBody` returns something for
    it, and either can hold `children`. Selection (`selectedIds`/`onSelect`,
    shift-click to add, drag a selected row to move its selected siblings),
    a visibility checkbox (`onVisibilityChange`), a remove button (`onRemove`)
    and an add palette (`addKinds`/`onAdd`) each turn on with their handler.
  - `onReorder` receives a `LayerMove` — `{ ids, parentId, index }` — instead of
    a list of ids or a new tree. `moveLayers(items, move)` applies one to a tree
    held as state.
  - Items take string ids, and `title` in place of `LayerStack`'s hoisted
    `primaryValue`/`primaryOptions`/`onPrimaryChange`; put the select in `title`.
    `defaultExpanded: false` is `defaultCollapsed: true`, and `alwaysOn` is
    `locked`.
  - Rows form a treegrid with one row in the tab order: Up/Down/Home/End move
    between visible rows, Right/Left open and close a layer or step in and out,
    Enter/Space select, Shift+arrows select a range, and Alt+Up/Down move a row —
    or, on a card's handle, the card — as a drag would.
  - `useSceneLayerList` puts a scene in the list: a container's children nest
    under it, and a drag dispatches a `MoveToIndexOp` under the right parent.
  - `useReorderDragList`'s item type is `ReorderItem`, without `swatch`.
  - labkit drops the `./ui/layers` entry point; `./layers` re-exports the ui
    component. A trial's layer list now shows the order its canvas draws in,
    where it used to snap back after a drag.
- f3d9d92: Surfaces can say what kind of content they hold and which of their peers they are. `PropertyPanel`, `PropertyGroup`, `Subpanel`, `Callout`, `Dialog`, labkit's `ControlPanel` and its sidebar sections take `stance` (`scope`, `aside`, `advanced`, `debug`, `danger`, `notice`, `important`, `preview`) and `tone` (an index into the theme's tone list, or a color). The theme draws each stance from `--wzl-panel-*` and `--wzl-stance-*` slots, and a surface given a tone recolors the controls inside it. `ControlPanel` wraps its rows in a titled `PropertyPanel` when given any of `title`, `stance` or `tone`.
  
  `@weasel-js/theme` adds `ColorList` — literals, the categorical generator, a theme ramp, or a function — read with `colorAt`, `colorCssAt` and `colorCount`; `tones` on theme definitions; `<ThemeProvider tones>` and `useTones()`; and `STANCES` / `STANCE_SLOTS`. labkit's `nebula` takes a `ColorList`.
  
  Breaking: `EffectCard`'s `accent` is now `tone`, and `--wzl-effect-card-accent` is gone. `Callout`'s `tone` (`info` / `warning` / `danger`) is now `stance` (`notice`, the default / `important` / `danger`), and `CalloutTone` is removed. A subpanel's rule now reads `--wzl-line-subtle` rather than a fixed translucent white, so it shows in light mode.
- 6a6d9f6: Text fields, textareas, focused slider readouts, number inputs and dialog triggers in a `PrefsForm` group panel now draw a visible field. The panel and its subpanels are painted `--wzl-surface-sunken`, which is also every field's default surface, so a field there had the same color as the panel behind it. The panels now set `--wzl-input-surface` the way the rail already did, and those controls read it.
- 5ad1478: `PrefsForm` grows a second layout. `layout="rail"` puts a two-level navigation
  rail beside one group's settings at a time: top-level groups open a pane,
  nested groups scroll it and light up as they pass, and anything deeper renders
  as an indented section in the pane rather than growing the rail. `filterable`
  adds a field that narrows the form to matching leaves in either layout, with
  per-group match counts in the rail.
  
  The default `layout="columns"` is untouched.
  
  Also new, and useful on their own: `useScrollSpy` (which section of a scrolling
  container is in view, with its decision exposed as the pure `pickActiveSection`),
  `Dialog`'s `bodyClassName` for content that scrolls itself, `PrefsDialog`'s
  `footer` passthrough, and two theme hooks — `--wzl-prefs-rail-width` and
  `--wzl-input-surface`, the latter for a text field on a container whose own
  background is the default sunken surface, where it was previously the same
  color as what sat behind it.
- 83c4a3e: `PropertyField` is the one settings row, its control chosen by `kind` (and
  `control`): `<PropertyField kind="number" control="slider" label="Blur" …>`.
  `CheckboxRow`, `SwitchRow`, `TextRow`, `SelectRow`, `SliderRow`, `NumberRow`,
  `ColorRow` and `ToggleRow`, with their `*RowProps` types, are removed, from
  `@weasel-js/ui` and from labkit's re-exports. This is a breaking change for
  anyone calling them: each is `PropertyField` with a `kind`, and its props carry
  over unchanged.
  
  | Removed | Now |
  | --- | --- |
  | `CheckboxRow` | `kind="boolean"` |
  | `SwitchRow` | `kind="boolean" control="switch"` |
  | `TextRow` | `kind="string"` |
  | `NumberRow` | `kind="number"` |
  | `SliderRow` | `kind="number" control="slider"` |
  | `SelectRow` | `kind="enum"` |
  | `ToggleRow` | `kind="enum" control="toggle"` |
  | `ColorRow` | `kind="color"` |
  
  - `PropertyControl` draws the same control with no row around it, for a cell
    that shares a row. `kind` also takes `paint` and `font-family`.
  - Every field takes `mixed` (the sources disagree) and `unset` (they agree on
    holding nothing), and shows no value for either.
  - `chrome="framed"` draws the kit's field components in place of the row's
    native inputs — `UnitField` for a number with `accepts`, `Checkbox`,
    `Input`, a boxed `Select`, `RadioGroup` and `ToggleBar`, `ColorField`.
    `PropertyRow` takes the same `chrome`, and leaves a framed field's inputs to
    its own stylesheet.
  - A text field given `onInput` drafts, reporting each keystroke to `onInput`
    and the settled text to `onChange` on blur or Enter.
  - `color`'s `alpha` may be `true`, keeping the alpha in a `#rrggbbaa` value.
  - A bare `enum` with `control="radio"` is segments with radio semantics; with
    `control="toggle"` it stays pressable segments.
  - `prefFieldProps(leaf, state)` turns a schema leaf into `PropertyControl`
    props: a number in its display unit and its bounds, an enum through its
    encoding, an icon as a glyph. `ControlPanel`, `PrefsForm`, `SelectionPanel`
    and `ToolOptionsBar` all draw their built-in kinds through it.
  - `PrefsForm` rows are `PropertyRow`s, so a preference's label and help take
    the params label look the other settings surfaces use. A leaf's slider is a
    track with an editable readout, and a `radio` enum in `SelectionPanel` is a
    radio group rather than a dropdown.
  - `InlineRange` forwards its ref to the input.
- ce53e3c: `PropertyPanel` takes `actions` and `selectable`. `actions` puts controls on the trailing edge of the title row, outside the heading, so a switch or a clear button no longer has to be packed inside the `title` node, where it took the title's type and joined its accessible name. `selectable` lets text in the panel be selected and copied, reaching past the `user-select: none` every member of the family sets; a `debug` panel is selectable unless given `selectable={false}`, since the ids and traces it shows are there to be copied. Other panels behave as before.
- edf7878: The property-panel family (`PropertyPanel`, `PropertyList`, rows, groups, subpanels and effect cards) is no longer text-selectable, so a drag that misses a slider does not paint a selection over the labels. Readouts, text fields and editable content stay selectable.
- cf69850: `PropertyRenderContext` carries `selectionKey`: the ids of the nodes a
  `SelectionPanel` read its values from, joined. A custom renderer holding
  scratch that belongs to one selection — a paint control's per-kind memory —
  can key on it and be remounted when the selection changes, as the built-in
  paint leaf already is. Fields of an object leaf receive it too. It is absent
  where values come from no selection, as in `ToolOptionsBar`.
- a4d9250: An inline row's hanging readout unit takes its case and tracking from
  `--wzl-params-label-case` and `--wzl-params-label-tracking`, like every other
  cased label on a params surface, instead of hard-coding uppercase with no
  letter-spacing.
- 5fb5bab: Rename `ActionsBar` to `ButtonBar`, along with its `ButtonBarItem`, `ButtonBarProps`, `ButtonBarSize` and `ButtonBarVariant` types. The old name read as a variant of `ActionBar`, which renders actions from the kit's actions registry; this one is a plain strip of callback buttons, the momentary sibling of `ToggleBar` and `OptionsBar`. Breaking: the old names have no alias.
- d286c84: A drag from `useReorderDragList` now has a ghost. The hook's state carries
  `ghost` — the dragged ids and a client-space box that keeps the grabbed point
  under the pointer — and `ItemList`'s `ghost` prop draws those rows there,
  portaled to the list's nearest themed host so no panel clips them.
- 2efeb82: `useReorderDragList` gains `nudge(id, index, delta)`, the keyboard half of the reorder: it moves one row, or the selection that row belongs to, one place up or down under the same rules as a drag — never across a locked row, and not at all when the move would change nothing. A press that starts on a control inside a row (a visibility toggle) is now left to that control instead of opening a drag and capturing the pointer away from it. When `onPress` is given, the DOM click that follows the same press is dropped, so a row that also handles `click` no longer counts one press twice.
- 6ce2bcb: The weasel theme has a secondary accent: a honey amber opposite the violet accent, as a `secondary-soft`/`-base`/`-strong` ramp, a `--wzl-secondary` fill, and `--wzl-secondary-fg` for text. `--wzl-secondary-fg` is picked from the ramp to clear 4.5:1 on every surface, so it is the base step in dark mode and the deep step in light. An auto row's `AUTO` readout draws in it.
- 106139a: `Select` takes an `orientation` prop, with `Field`'s values: `'stacked'` (the default) keeps the label above the trigger, and `'row'` sets it beside the trigger at its own width, the trigger taking the rest of the row, or sitting at its fitted width with `width='fit'`. A description or error drops to a line of its own. A side-by-side label no longer needs an outer `<label htmlFor>` wired to `triggerId`.
- 6857b4d: A `Select` whose list opens over its trigger no longer runs past the window edge. Near the top of the window, with a late option chosen, the list stops 12px inside the edge rather than lining its selected row up with the trigger.
- 9789097: An inline property row holding a select lines its value up with its label under `align="center"` too. Text rows already aligned on the baseline, but `center` overrode that, and centering a 9px label against an 11px value left the value about 1px low. For those rows `center` now means `baseline`; `start` and `end` still apply as given.
- da3b958: `Select` can group its rows into titled sections. In the children form, wrap `SelectItem` rows in the new `SelectSection` with a `title`; in the `options` form, an entry with `title` and its own `options` is a section (type `SelectOptionGroup`) and can sit beside plain options. Sections render as React Aria list-box sections, so each is a group named by its title for screen readers, and neighboring sections divide on a rule. A `width="fit"` trigger measures the options inside sections too.
- 4074270: `ShapeKindIcon` draws the glyph for a shape kind — the one its insertion tool shows — and falls back to `UnknownIcon` for a kind the kit does not ship. The icon set gains `page` (`PageIcon`), a document page with a folded corner. Core now exports the `ShapeKind` type.
- 731573b: A `SidebarPanel` whose title is static (no `onToggleCollapse`) now insets that title the way a collapsible one is inset. Since the panel's horizontal padding moved onto the title row's controls, a static title sat flush against the panel edge with no vertical padding either; both kinds of title now share one box, so they line up and a panel's header row is the same height whether or not it collapses.
- f9ff231: `tone` now means one thing everywhere: which of its peers a surface is. Breaking: `Badge`'s and `PowerlineSegment`'s status prop is renamed from `tone` to `status`, and `BadgeTone` to `BadgeStatus` (labkit's passthrough re-export follows). The rendered attribute is `data-status` rather than `data-tone`. There is no alias; a status string passed as `tone` is now read as a color.
  
  `Badge`, `Code`, `Button` and `PowerlineSegment` also take `stance` and a peer `tone` — an index into the theme's tone list, or a color — as panels do. The tone, or a stance's `accent`, paints over the status color, and a toned primary button takes the tone as its accent.
- 74cc4df: New `Tree`: a hierarchy of expandable rows with WAI-ARIA tree semantics (`tree` / `treeitem` / `group`, `aria-level`, `aria-expanded`, `aria-selected`) and the tree keyboard — Up/Down over visible rows, Right to open or step in, Left to close or step out, Home/End, Enter/Space to activate, and type-ahead. Expansion and selection are each controlled or uncontrolled (`expandedIds` / `defaultExpandedIds` / `onExpandedChange`, `selectedIds` / `defaultSelectedIds` / `onSelectionChange`), with `selectionMode` `'single'` or `'multiple'` (Cmd/Ctrl toggles, Shift extends). Each node takes `leading` and `trailing` decoration, `muted` and `disabled`. Rows are `--wzl-control-h` tall, so they follow density. `filterTree` and `treeBranchIds` cover the usual filter: narrow the nodes, then open every branch that still holds a match.
  
  `DisclosureMark` is the drawn twisty `Disclosure` wears, now exported on its own for a row that is itself the control and so cannot nest a button.
- 62d8d7c: `useOngoingAction(actionId)` lets a UI control — a color picker, a slider, a swatch — drive an ongoing action the way a drag does: `input(params)` opens the action on the first call and moves it on the rest (the live preview), `commit(params?)` ends it as one undo entry, and `cancel()` drops it. A commit with nothing open is a whole edit on its own, which is what a click on a swatch is. An edit still open when the control unmounts or its action id changes is committed. It wraps `ActionsRegistry.begin`, whose begin-or-update-then-end bookkeeping every such control used to hand-roll around a ref; `SceneGradientHandles` now uses it.
- Updated dependencies [16c0da2]
- Updated dependencies [b8ebef6]
- Updated dependencies [90a2d9b]
- Updated dependencies [04ff89b]
- Updated dependencies [c373af4]
- Updated dependencies [bfe6a4f]
- Updated dependencies [1589afd]
- Updated dependencies [6857b4d]
- Updated dependencies [bbaefca]
- Updated dependencies [07b106f]
- Updated dependencies [f04faf6]
- Updated dependencies [0cf6a0d]
- Updated dependencies [a564aea]
- Updated dependencies [811abcd]
- Updated dependencies [7c53d1a]
- Updated dependencies [b1c30bc]
- Updated dependencies [5345efb]
- Updated dependencies [9e77264]
- Updated dependencies [497727a]
- Updated dependencies [5c6072f]
- Updated dependencies [87fd8a8]
- Updated dependencies [c7e9e4c]
- Updated dependencies [f3d9d92]
- Updated dependencies [c24d2c7]
- Updated dependencies [6f14f6f]
- Updated dependencies [c1f82e2]
- Updated dependencies [5ad1478]
- Updated dependencies [08b80b8]
- Updated dependencies
- Updated dependencies [97561f1]
- Updated dependencies [89926b5]
- Updated dependencies [6ce2bcb]
- Updated dependencies [959e5e5]
- Updated dependencies [9f86dec]
- Updated dependencies [4074270]
- Updated dependencies [debfd5d]
- Updated dependencies [3225eb8]
- Updated dependencies [d975afa]
- Updated dependencies [96a5302]
- Updated dependencies [62d8d7c]
  - @weasel-js/core@1.6.0
  - @weasel-js/theme@1.6.0
  - @weasel-js/svg@1.6.0
  - @weasel-js/modes@1.6.0
  - @weasel-js/font@1.6.0

## 1.5.2

### Patch Changes

- 11d949e: Clicking a property row's **label** now toggles whether the row is auto. That
  replaces the hover-revealed pin dot — `PinDot` is removed — and labkit's
  shift-click gesture, and with them `<PropertyRow data-auto-path>`, which
  existed only to route that gesture.
  
  An auto row now hides its control rather than ghosting it, keeping the box so
  the row does not resize on the toggle, and reads out the bare word `auto`;
  labkit's `auto · 18` form is gone. A hidden control is out of reach of the
  pointer and the tab ring, which is also what takes it out of the
  accessibility tree — a test reading an auto row's value has to read the
  element, not the role.
- 4e02f88: `ToolOptionsBar` draws a tool's options from a schema.
  
  Pass `schema` (a `ToolPrefGroup`), `values` keyed by dotted path, and
  `onChange(path, value)`, and the bar draws each visible leaf on one line; a run
  of paired toggles collapses into one segmented bar, and `mixed` marks paths
  whose sources disagree. `renderers` overrides a control by path or by kind, and
  `children` still render beside the schema for tenants that are not a tool's
  options.
  
  The leaf → control mapping moved out of `SelectionPanel` into a shared module
  that both call, so a leaf kind gets its control decided once. `SelectionPanel`'s
  public surface is unchanged.
- bbfdacd: Draw the close X at the size of the glyphs around it.
  
  Its arms spanned 5–15 of the 20×20 box while every neighbor spans about 3–17,
  so at the same `size` it read as a smaller icon. The arms now reach 3.4–16.6 at
  a 1.9 stroke, and labkit's title-bar region draws its glyphs at 16 like the
  toolbar and palette regions rather than 14.
- 24a2dae: Close the places where two tiers spelled one concept differently.
  
  **A fixed pan bug.** `viewport.dragPan` fell back from `drag.screenDelta` to
  the world `drag.delta` and then divided by the zoom anyway, panning at
  1/scale² for any event source that supplies no `clientX`/`clientY` — which is
  every synthesized `InputEvent`, since those fields are optional. It now
  reconstructs the client delta exactly, by undoing each end of the world delta
  against the view that produced it.
  
  **Breaking, renames.** `ClickEvent`, `DoubleClickEvent` and `ContextMenuEvent`
  carry their world point as `x`/`y`, matching every other kind in `InputEvent`;
  `worldX`/`worldY` are gone, and a consumer who set `x`/`y` no longer silently
  lands at the origin. All three now also carry `clientX`/`clientY`, so a
  context-menu action can finally read `ctx.screen` — the case that surface was
  added for. The renderer's `Mat3` is `GlMat3`, freeing `Mat3` to mean geom's
  affine in a file that imports from both. `translatePolygonInPlace` is
  gone: it was the one sanctioned writer into a committed path's coord buffer,
  documented as overlay-only, and nothing called it. `@weasel-js/font` exports `FontStyle`
  in place of `OutlineFontStyle`. `@weasel-js/labkit` no longer exports
  `useOrbit`, `OrbitView`, `Vec3` or their helpers: `@weasel-js/kernel3d` owns
  the orbit camera and `@weasel-js/geom/3d` owns `Vec3`. `ToolCtx.screenPoint`
  was declared and never written by anything; it is gone.
  
  **Breaking, types narrowed.** geom's `Mat3` and `Box` are readonly tuples,
  matching the reason `geom/3d` already gives for its own. `History.entries()`
  returns `readonly` arrays, which is what its docstring always asked callers to
  assume.
  
  **One type where there were two.** `@weasel-js/svg`'s `Matrix` is geom's
  `Mat3`, and its duplicate `multiply` is geom's; `SvgStroke.width` is
  `ScreenLength` rather than that union written out again. `kernel3d`'s
  `ViewportRect` is `ScreenBox` — one rectangle spelling instead of `w`/`h`
  beside `width`/`height` eight lines apart. The renderer's `View` is routing's.
  Core's `Vec2` is routing's `Point2`, and `Pt` is gone from the barrel.
  
  **Additions.** `oklchDegToHex` / `hexToOklchDeg` / `OklchDeg` in
  `@weasel-js/paint` — the degrees-and-hex form `@weasel-js/ui` and
  `@weasel-js/theme` had each built for themselves. `srgbFloatToOklab`, for
  callers holding 0..1 floats; feeding those to `srgbU8ToOklab` truncated where
  paint's own internal conversion rounds. `mat3.toAffine` / `mat3.fromAffine`
  name the repack between the GL layout and geom's.
  
  **Corrections.** `RECT_POSE_DESCRIPTOR` implements `getRotation`, so a pose it
  rotated no longer reports itself unrotated to `useResize` and to diagram's port
  placement. `ToolDef.capabilities` is documented as reaching
  `Tool.eligibility.capabilities`, which is where it actually goes — following
  the old text gave `undefined`, and `eligibleForMode` turns that into a tool
  that vanishes from every mode. `MultitouchEvent.centroid` is documented as
  canvas-local, which is what the dispatcher hands over. `drag.points` is a
  snapshot on `onEnd` rather than the dispatcher's live accumulator.
  
  `tsconfig.json` now typechecks `packages/routing`, `cursor`, `bidi` and
  `loupe`, which it had never included.
- 665ff53: A group's description now draws in every panel that renders one.
  
  `<PropertyGroup description>` puts the text under the heading and above the
  rows, through a new `<PropertyNote>` — a muted paragraph that spans both
  columns, which is the group-level counterpart to `<PropertyRow description>`.
  labkit's `ControlPanel` passes it, so a config group's `.describe()` reads the
  same there as it already did in `PrefsForm`.
- 2e52d31: Panel labels inherit their case, tracking, alignment and width.
  
  `PropertyPanel`, `Prefs` and labkit's `ControlPanel` read four custom
  properties — `--wzl-params-label-case`, `-tracking`, `-align` and `-width` —
  so one declaration on any ancestor restyles every label beneath it. No rule
  declares them; each label carries its default as a `var()` fallback, so an
  override never has to outrank anything. `docs/conventions.md` ("Panel labels")
  has the defaults and which labels each property reaches.
  
  Visible changes at the defaults:
  
  - An inline slider row's label sits on the leading edge. A rule meant to
    bottom-align a stacked row's track outranked the inline layout and packed the
    label against its slider.
  - Every label is uppercase, including `Prefs` row labels, the `Prefs` subpanel
    heading and labkit pair-cell captions, which were sentence case.
  - Tracking comes from the theme's tracking tokens: row labels move from
    `0.04em`–`0.06em` to `--wzl-tracking-wide`, `Prefs` group titles to
    `--wzl-tracking-wider`, matching `PropertyPanel`'s.
  - A `Prefs` row label no longer grows to fill its row. The control stays on the
    trailing edge.
- 564deb4: Take typed units past linear factors.
  
  A unit table entry is now `number | { factor, offset }`, so a scale that
  disagrees with the base about where zero sits — degC against K — is
  expressible; a bare number stays the shorthand for a pure factor, so every
  existing table reads as it did. `unitScale(system, unit)` is the one reader
  that widens the shorthand and defaults the offset, and `resolveUnit` /
  `formatUnit` both go through it.
  
  `parseNumber` reads a compound value: `5ft 3in` is 63in, a leading sign carries
  across every term, and a term with no unit (or a unit the field does not
  accept) leaves the value unreadable rather than half-read. Offsets have no
  meaning in a sum, so a compound value takes pure scales only.
  
  `prefUnit` converts through offsets in both directions and now returns a
  `format`, which is what the SelectionPanel slider readout draws — `formatUnit`
  had no callers before this.
- ae2a424: Every property row stands on the same floor.
  
  A row was as tall as whatever it held — 16px around a switch, 20 around a
  field, 24 around a `<Select>` — so a column of mixed rows set its own line
  spacing row by row and read as ragged. `.row` now carries a `min-height` of
  `--wzl-prop-row-h`, which defaults to the panel's own field height and so
  follows `density`. Taller content still grows its row; this only stops a short
  one from collapsing beside the field it sits next to.
  
  Three field-family controls were reading a standalone control's height token
  rather than the panel's, and overshot or undershot the rows around them:
  
  - A kit `<Select>` in a row took `--wzl-control-h` (24px at the default
    density, against a 20px field). Its trigger now reads `--wzl-select-h`, a new
    hook defaulting to `--wzl-control-h`, which the property list points at the
    field height.
  - A segmented `ToggleRow`'s buttons were a hard-coded 26px, and did not move
    with `density` at all.
  - A slider row's readout was pinned to `--wzl-control-h-sm`, so a `tight` panel
    kept comfortable-sized readouts.
- dbdd803: A click opens a `<Select>`'s list and leaves it open. With the list over its
  trigger, the release that ended the opening click landed on a row, and a row
  selects on release — so the list shut again before it had been seen, and
  opening it took a press and hold. A release within 500ms and 4px of the press
  that opened the list now belongs to the trigger; every release after it picks
  a row, so press-hold-drag-release still chooses.
  
  A select showing its placeholder hangs its list below the trigger instead of
  over it: nothing is chosen, so no row belongs over the trigger, and putting an
  arbitrary one under the pointer armed it.
- 728ad7c: `<Select>` takes an `indicator`: `'chevron'`, `'underline'` or `'none'`. A
  boxed select still draws the caret; a `variant='bare'` one — the shape a
  property row and a labkit control panel use — now underlines its value
  instead, dotted at rest and solid under the pointer. In a row that gives the
  value 60px, the caret was spending a sixth of it to say what the underline
  says in the value's own space. Pass `indicator` to override either default.
  
  A select's list now opens **over** its trigger, with the selected row on the
  value: same line, same text column, and the same edge the trigger sets its
  value against, so choosing what is already chosen moves nothing.
  `popup='below'` keeps the old dropdown, which takes the trigger's width. The
  alignment is handed back as the popover's own offsets, so React Aria still
  holds the list inside the viewport.
- 36dd1a4: Stop a Select trigger clipping its own text. The value needs `overflow: hidden`
  for its ellipsis, which makes the line box a clip — and it inherited
  `line-height: 1` from the trigger, so a 13px box held 16px of glyph and sliced
  the ascenders and descenders off every label. It now sets `line-height: normal`,
  the font's own leading, which fits inside the control at all three densities.
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
- 37e8105: Eight character-styling glyphs, and a text tool that declares its own options.
  
  `bold`, `italic`, `underline`, `strikethrough`, `overline`, `superscript`,
  `subscript` and `code` join the icon set. The five flags are letterforms
  wearing the treatment they apply, because that is what the controls they label
  replaced.
  
  `useTextTool.options` declares the character half of text styling as a
  `ToolPrefGroup`, keyed by `StyledRun` field, so a host reads a `RangeStyle`
  into it and writes a `RunStylePatch` back with no name mapping. `short` moves
  from `ToolPrefBoolean` to every leaf: it is the label any surface too narrow
  for `name` shows, and `name` stays the accessible name.
  
  `ToolOptionsBar` labels a bare value box — a number or a string — and leaves
  every other control to say what it is, and it sizes fields and opacity tracks
  for one line rather than for a panel column.
- 8081a6b: Derive the type ramp from one number, and add a `density` axis that scales it.
  
  Sizes were unrelated px pins, so there was nothing to turn: raising
  `--wzl-font-size` grew glyphs while `--wzl-control-h` stayed 24px and every gap
  stayed put. The type ramp now derives from `seeds.ui-base` through a new
  `factors` rule on a scale (`base × factors[i]`, alongside the existing `step`
  and `ratio`), and `density` — `compact` / `comfortable` / `roomy` — varies that
  seed along with `control-h` and `tb-height`. Set it with
  `applyTheme(el, theme, { density })`.
  
  Sizes stay baked px rather than `calc()` against a root variable, because
  `tokenPx()` feeds SVG, canvas and WebGL geometry and has to read a real number.
  
  **Additive, with one behavior change.** Every existing token keeps its computed
  value at the default selection; `--wzl-font-size` and `--wzl-space-{xs,sm,md,lg}`
  are now aliases (`var(--wzl-font-size-md)`, `var(--wzl-space-2)` …) rather than
  literals, which computes identically but is no longer a literal string if you
  read the declaration rather than the computed value. New: `--wzl-font-size-md`
  and the `--wzl-space-1` … `--wzl-space-8` ladder in 2px rungs.
  
  `toDTCG` no longer refuses a theme with an axis besides `mode`; it exports that
  axis's default branch and drops the others, since DTCG carries one variant
  dimension. Round-tripping a theme through DTCG now flattens it to the default
  selection of every non-mode axis.
  
  Control heights follow density too, through three new ranks — `control-h-xs`
  (18px), `control-h-sm` (20px) and `icon-button-size` (22px), each landing on a
  value already in wide use so nothing moves at the default density. Without them
  `Button` sat at 24px in every density while its label grew.
  
  Also adopts the ladder across `packages/ui`: 189 `gap`/`padding`/`margin` px
  literals became rungs and the frozen control boxes became ranks.
  `npm run check:spacing` and `npm run check:controls` keep them there; a
  rank-sized box that is really artwork opts out with a `not-a-control` comment.
  
  `check:design-tokens` now reads the scale from `:root` alone. Each density block
  restates the whole scale, so reading the stylesheet straight through left
  `roomy` standing and vetted every authored fallback against a value no unset
  document shows.
- Updated dependencies [1c695cb]
- Updated dependencies [24a2dae]
- Updated dependencies [564deb4]
- Updated dependencies [8ffd746]
- Updated dependencies [ae2a424]
- Updated dependencies [3978e84]
- Updated dependencies [37e8105]
- Updated dependencies [6d79849]
- Updated dependencies [8081a6b]
  - @weasel-js/core@1.5.2
  - @weasel-js/svg@1.5.2
  - @weasel-js/font@1.5.2
  - @weasel-js/theme@1.5.2
  - @weasel-js/modes@1.5.2

## 1.5.1

### Patch Changes

- 7ebfd0f: Controls can be set to auto. Shift-click a row in a labkit control panel — or
  click the pin dot beside its label — and the field stops holding a pinned
  value: the instrument decides instead, and the control draws ghosted at what it
  decided.
  
  `auto` is a value you write anywhere a config value goes, so `setConfig('gap',
  auto)` and a trial's seed config both work. A schema starts a field unpinned
  with `.initial(auto)`, attaches a resolver with `.auto(fn)`, and opts a field
  out entirely with `.manual()` — for a value the instrument cannot receive as
  `undefined`. The sentinel is normalized into a per-trial set of unpinned paths
  at every boundary, so nothing stores or serializes it, and the last pinned
  value stays where it is: un-pinning is lossless, and Reset returns a trial to
  the auto paths it opened on.
  
  A panel is uncontrolled unless it is handed the set: `<ControlPanel>` without
  an `auto` prop keeps the unpinned paths itself, so the dots work in a harness
  that only stores values and the sentinel never reaches its `setConfig`.
  
  This adds API. Property rows in `@weasel-js/ui` take `auto` and `onAutoChange`;
  a `Select`'s trigger and an alpha range read new color and border hooks that
  default to what they already rendered; a control renderer's argument gains two
  fields.
  
  One thing to know before upgrading: a control panel row now contains a second
  button, the pin dot, named `Pin <label>`. A test querying a row's own control
  loosely — `getByRole('button', { name: /Gap/ })` — will start matching both.
  Match the control's exact accessible name, or exclude a name beginning `Pin `.
- 9893d53: forge honors Storybook's conditional controls: an argType's `if` naming another arg
  — truthy by default, or with `truthy: false`, `exists`, `eq` or `neq` — shows that
  control only while the condition holds, through labkit's `showIf`. A condition on a
  global is ignored, since a story's config does not carry the lab's globals.
  
  weasel-ui's CurveEditor story shows its grid divisions control only while Show grid
  is on.
- 626bace: A gradient now names the space its stops blend through. `interpolate` on any of
  the three gradient kinds takes `'rgb'` (the default, and what every other vector
  format means by a gradient), `'oklab'`, or `'oklch'` — which travels around the
  hue wheel, so red to blue stays saturated instead of passing through a muddy
  purple. Alpha is linear in every space.
  
  The blend is paid for once, in the 256-texel ramp the shader samples, so a
  perceptual gradient costs a batched frame nothing over an sRGB one. The space is
  part of the ramp atlas key: the same stops under two spaces take two rows.
  
  `sampleGradientStops` and `sampleResolvedStops` take the space as a third
  argument, `bindRamp` as an optional third, and `GradientEditor` grows an
  sRGB / OKLab / OKLCh switch (`spaceSwitch={false}` hides it). `@weasel-js/svg`
  writes `wzl:interpolate` on the gradient's own element and reads it back; a
  renderer that ignores it still paints the gradient, in sRGB.
- 58ba9de: New `--wzl-handle-size`, `--wzl-handle-size-sm` and `--wzl-handle-size-lg` size every draggable handle the kit draws on a plot or a timeline: the default rank, the inert one a locked or pinned point wears, and the emphasized one a curve's endpoint wears. Timeline's dope-sheet keys and event marks, CurveEditor's endpoint and locked diamonds and `createKeyframeLayer`'s keys were three independent literals; they are now one number each, written in the theme definition.
  
  CSS reads the tokens directly. Code that draws rather than styles — SVG geometry attributes, canvas, WebGL — reads them through `tokenPx(name, resolved?)` from `@weasel-js/theme`, or `handleSize` / `handleHalf` from `@weasel-js/ui`, which return the number without a `getComputedStyle`. Pass a `ResolvedTheme` (from `useTheme().resolved`) where a live theme override has to reach the drawing; without one the built-in theme's value is used.
  
  The locked anchor in `createFunctionLayer` was 7.1px and is now 7px.
  
  `@weasel-js/ui` now depends on `@weasel-js/theme`.
- 776e8b9: Add five Platonic-solid glyphs, `d4`, `d6`, `d8`, `d12` and `d20`, named for
  the die each solid makes. They are drawn with a finer outline than the rest of
  the set, and finer inner edges still.
  
  Export `ICON_GROUPS`, which files every glyph in `ICON_PATHS` under the family
  it was drawn in, so an icon picker can section itself instead of listing ~200
  names flat. The old "state and instrument" family is split into playback,
  state and instrument, and `filter` now sits with the actions.
  
  `curvePulseTrain` is now one line that steps up and down along its baseline.
  It used to draw a full-width baseline under three separate pulses, closing
  each one into a rectangle.
- 2adcc06: An inline property row's select now fills the space beside its label and sets its
  value against the chevron. Sized to its longest option, each select started at a
  different point, so a column of them scattered their values.
- b7f3f90: Add `<Jog>`, a transport for something counted rather than timed — beat 3 of 24 rather than
  4.20s of 12.00s. Previous, play/pause, next, an optional scrubber and an `n/m` readout padded
  so the row cannot shift as it plays. `<Transport>` remains the continuous-time one.
  
  New `stepBack` glyph, and `step` is now `stepForward`: with two of them, `step` alone no longer
  names a direction. `StepIcon` stays as a deprecated alias of `StepForwardIcon`, but the
  `IconName` union no longer includes `'step'`.
  
  labkit re-exports `Jog`, `Icon` and the playback glyphs, so chrome built on labkit still needs
  no direct `@weasel-js/ui` dependency.
- e99c441: Center a `KeySequence` separator (the `+` in `⌘ + K`) vertically on the keys.
  It used to sit on the row's bottom edge, below the middle of the keys beside it.
- 4aa184b: Turn labkit's React lint rules back on. Biome enables its `react` domain — `useExhaustiveDependencies` among them — by detecting react in `dependencies`, and labkit declares it as a `peerDependency`, which that detection does not read. The rules had gone quiet, and the four `biome-ignore` comments written against them had decayed into `suppressions/unused` errors, which is how the silence surfaced. The domain is now named explicitly in `biome.jsonc`; no hook-dependency defects were hiding behind it.
  
  With the gate running again: `currentPage` trims a query and fragment with one regex instead of two non-null-asserted `split` results, `<Lab>`'s fallback returns without a wrapping fragment, and two tests drop non-null assertions. A `PaintField` swatch takes its inner radius from `--wzl-border-w` rather than a bare `1px`, and the icon gallery's group heading takes `--wzl-font-weight-bold` rather than `600`, a weight this theme's scale — 200 through 400 — does not contain.
- 86be3eb: A sixth paint kind: `mesh-gradient`, PDF's shading types 6 and 7. A mesh is a
  set of curved quadrilateral patches, each carrying a color at every corner, so
  its color field bends where the three gradients can only run straight. Twelve
  control points make a Coons patch and sixteen a tensor patch, which is the only
  difference between them.
  
  It is registered through `registerPaintKind` rather than built into the
  renderer, so every slot it uses is one a consumer's own kind can use. The paint
  is rasterized once into a 256-texel bake the shader samples — forward, the way
  every renderer that draws these works, because a paint has to answer "what color
  is this fragment" and inverting a bicubic per fragment does not. Corner colors
  blend through `interpolate`, as a gradient's stops do.
  
  `@weasel-js/svg` writes it as `<wzl:meshGradient>` with every patch's points in
  full — not SVG's abandoned `<meshgradient>`, whose implicit edge sharing gives a
  reader a way to be quietly wrong — and reads it back. A renderer that skips the
  def paints the fallback color beside the reference.
  
  `MeshEditor` in `@weasel-js/ui` edits the corner colors and the blend space, and
  `PaintInput` renders it: before this, a mesh in that control fell through to the
  color field, which wrote a solid back over it.
- 075f88a: `PaintField` edits a whole `FillStyle` from one control slot: a swatch naming
  the kind it holds, and a popover holding `PaintInput`. `PaintInput`'s kind bar
  and stop editor do not fit a property row's control column, which is why a
  `paint` leaf in `PrefsForm` used to render a `ColorField` — reading a gradient's
  first stop and writing a solid back, so touching the control lost the paint.
  That leaf now renders `PaintField`, and a gradient survives being edited.
  
  `paintPreviewCss` turns any paint into a CSS `background`, for swatches and
  chips. Gradients are sampled through their own blend space rather than handed
  over as stops, so an OKLCh gradient previews as itself instead of as the sRGB
  blend of its ends.
- a5ff296: `PaintInput` no longer flattens a registered paint kind that has no `Editor` into a solid color. It shows the kind's label with "no editor" and leaves the paint alone; before, touching the color field in its place replaced the paint with `{ fill: 'solid' }`. Register an `Editor` on the kind to make it editable.
- b1bf884: The property readout's default width is `2.8em` instead of `calc(5em - 24px)`, so it scales with the readout's font size rather than subtracting a fixed 24px. At the kit's own size the two are within a fraction of a pixel. `--wzl-property-readout-w` still overrides it.
- a7519a1: Remove the `pointer` dep. **Breaking:** `DepSchema` no longer has a `pointer`
  entry, `useStandardActions` no longer takes a `pointer` option, and the fixed
  deps bag handed to an action that declares no `requires` no longer carries it.
  
  Nothing in the kit declared or read it, and `<SceneCanvas>` never supplied a
  value, so an action reading `deps.pointer` was already getting `undefined`. An
  action that wants the pointer reads it from its invocation context
  (`ctx.world`), and code outside an action can still use `usePointerContext()`,
  which is unchanged.
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
- `Select` gains `triggerId`, which puts an id on the trigger button. React Aria
  puts a plain `id` on the wrapper element, which is not labelable, so an outer
  `<label for>` had nothing to point at: the label fell through to whatever
  labelable element came first inside the row. `SelectRow` passes it, so a
  property row's `<label>` owns its select again rather than the ⓘ help button
  beside it.
- b5e7a17: `BandEditor`, `Timeline` and the curve editor's keyframe layer now snap through one shared `snapToNearest` and one 6px radius. No behavior change; `snapToNearest` and `snapTime` are exported from the same places as before.
- 9dcf9de: Give `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix` their manifest
  defaults (18% and 70%) where `range.module.css` and `Slider.module.css` read
  them. Inside a `color-mix()` an unset custom property invalidates the whole
  `background`, so a consumer without `tokens.css` loaded got an unpainted thumb
  — while `--wzl-slider-track-h` and `--wzl-slider-thumb-size` on those same
  rules already degraded to a usable size.
- 7ff81e2: `Slider` takes two new stop props. `snap: 'strict'` makes the stops detents: a drag or track press always lands on the nearest one. `spacing: 'even'` places the stops at equal intervals and runs the track from the first to the last, mapping values linearly within each gap — with the default magnetic snapping, a 0.25/0.5/1/2/4 rate track gets evenly spaced, labeled stops and can still rest at 1.3. Stops now attract by distance along the track rather than by value. `DetentSlider` is a strict `Slider` underneath, and stays as the way to put text values (Off/Low/High) on a slider. Stop labels now hang from the track, so an inline readout no longer shifts them off their stops.
- a37cea1: `Slider` stops can now carry labels: pass `{ value, label }` in `stops` alongside bare numbers, and the label is drawn under the stop. `stopLabels: 'ends'` shows only the first and last, `'none'` hides the row. `DetentSlider` now draws its detent labels through this row instead of its own, so the `data-detent-label` and `data-detent-labels` hooks are now `data-slider-stop-label` and `data-slider-stop-labels`.
- d798e73: `<SwitchRow>` joins `@weasel-js/ui`'s property rows: the same row as
  `<CheckboxRow>`, drawn as an on/off switch.
  
  labkit's `<ControlPanel>` now reads the annotation `f.boolean(…).toggle()`
  writes and draws one, in a row of its own and in a paired cell. It drew a
  checkbox for both before, so a schema asking for a switch got one in
  `<PrefsForm>` and not in a lab.
- b49c1e7: Stop a click near a `ToggleRow`'s pin dot from selecting the row's first option.
  
  The row was a `<label>`, and a label passes a click on its text to its first
  control — for a segmented toggle, the first segment. A near-miss on the 7px
  dot, or any click on the row's name, pinned the row to that option instead of
  toggling auto, so an unpinned toggle could look impossible to return to auto.
  `PropertyRow` now takes `group`, which renders the row as a `<div>` for a
  control made of several elements, and `ToggleRow` sets it. The pin dot also
  takes clicks within 5px of its edge.
- 272ab0d: `TokenPanel` gains `density`. `tight` puts a token on one line — name, control,
  Reset — with the names on a fixed rail so the values read down the panel as a
  column, and caps the field instead of letting it span the panel. A stacked row
  spends 41px and a 595px-wide field on a six-character value, which a set of
  ninety tokens cannot afford. `normal` stays the default, so nothing already
  using the panel moves.
  
  The theme editor's Seeds, Components and Pins layers ask for `tight`.
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
- 70e9fad: Every `--wzl-*` custom property the components read is now one a theme declares,
  or a documented override hook. A read of a name nothing declared resolved to
  nothing, which silently dropped the whole declaration it sat in.
  
  What changes on screen, in labkit's lab switcher: its menu items take the body
  font size instead of inheriting the title's, the trigger turns the accent color
  on hover, and the menu's shadow, like the floating workspace panel's, now takes
  its color from `--wzl-shadow` so it follows the theme and mode. The menu stacks
  at `--wzl-z-overlay`. In `@weasel-js/ui`, the disclosure chevron eases with
  `--wzl-ease-out-cubic` and a property card's remove button reads `--wzl-danger`
  directly; both render as before.
- b40b4ee: Move `<Transport>`'s time readout to the end of the strip
  
  The playhead readout sat second, before the loop toggle and the rate slider, so
  every frame's rewrite reflowed both of them and the controls visibly vibrated
  during playback. It now comes last, with `margin-inline-start: auto` and
  `text-align: end` so it grows leftward into the slack rather than pushing the
  mode toggle that `<Timeline>` renders beside it. `tabular-nums` alone could not
  fix this: it equalizes digit width, not digit count, so crossing 10s still
  reflowed.
  
  Also adds a `Live` Storybook story binding `<AnimatedTimeline>` to a running
  handle — the existing Timeline stories render the transport with inert
  defaults, so its buttons did nothing there.
- c7545c4: Clicking a property row's label reaches its control again when the row has a `description`. `PropertyRow`'s `<label>` had no `for`, so it belonged to the first labelable element inside it, the ⓘ help button; `CheckboxRow`, `TextRow`, `NumberRow`, `SelectRow` and `ColorRow` now point it at their control. `ColorRow`'s opacity slider is named `<label> opacity`. A direct `PropertyRow` with a `description` should pass `htmlFor` for the same reason.
- 15b5eca: `ToggleBar`, `ActionsBar` and `OptionsBar` segments now take their height from the bar. Inside a labkit page, labkit's default button height used to win instead, so a `size="sm"` bar drew 24px segments in a 17px track and clipped their labels.
- 0c46089: Every property row's control is named after the row's label: `SliderRow`'s slider and readout, and the fields in `NumberRow`, `TextRow`, `SelectRow`, `ColorRow` and `CheckboxRow`. `ToggleRow`'s segments are named after their options, inside a group named after the row. `PropertyRow`'s `<label>` labels only the first input inside it. On a slider row that is the numeric readout, on any row with a `description` it is the ⓘ help button, and on a toggle row it is the first segment. So the range input had no name, a described row's control lost its name, and a toggle's first segment took the row's name.
- Updated dependencies [5769e02]
- Updated dependencies [f644eac]
- Updated dependencies [894a52c]
- Updated dependencies [9becb93]
- Updated dependencies [b984947]
- Updated dependencies [7e9a230]
- Updated dependencies [72fde09]
- Updated dependencies [e9051ac]
- Updated dependencies [626bace]
- Updated dependencies [58ba9de]
- Updated dependencies [f4049be]
- Updated dependencies [432b143]
- Updated dependencies [4f9fd3b]
- Updated dependencies [91973a7]
- Updated dependencies [86be3eb]
- Updated dependencies [51372f1]
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
- Updated dependencies [0662a2d]
- Updated dependencies [c0fa540]
- Updated dependencies [d2b8390]
- Updated dependencies [0923159]
- Updated dependencies [20bd67b]
- Updated dependencies [5fbec37]
- Updated dependencies [cba02cc]
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
- Updated dependencies [e0799cb]
- Updated dependencies [29f6ed0]
- Updated dependencies [fb6d8e5]
- Updated dependencies [ca7c737]
  - @weasel-js/core@1.5.1
  - @weasel-js/svg@1.5.1
  - @weasel-js/theme@1.5.1
  - @weasel-js/font@1.5.1
  - @weasel-js/modes@1.5.1

## 1.5.0

### Minor Changes

- b25b09b: <!-- bump-approved: minor: maintainer — asked for 1.5.0 in the session that added the async ComboBox surface -->
  
  `ComboBox` can take its options from a server, and a new `useAsyncOptions` hook
  does the fetching.
  
  **`useAsyncOptions({ load, debounceMs, minLength })`** returns `{ options,
  isLoading, loadError, inputValue, onInputChange }`, shaped to spread into a
  `ComboBox`. It debounces the query, aborts a request superseded by a later
  keystroke, and reports a rejected load separately from an empty result. Its
  race guard is a sequence number rather than a liveness flag: two requests from
  adjacent keystrokes are both live, so a flag cleared by effect cleanup does not
  stop a slower first response from overwriting a newer one. `options` holds the
  last *resolved* list and is never emptied to mean "working", so the previous
  rows stay on screen and stay arrowable while the next request is out.
  
  **`ComboBox` gains four props.** `filter` is `'contains'` (the default, and
  today's behavior), `'none'`, or a predicate. `'none'` shows every option given —
  what a list a server already ranked needs, since React Aria's own substring pass
  would drop rows that do not contain the query and reorder whatever survived. It
  also implies `allowsEmptyCollection`, because a list the kit does not filter can
  arrive empty mid-query and the popover would otherwise close before `emptyLabel`
  could be seen. `isLoading` marks the field pending with `aria-busy` and a
  spinner. `loadError` shows the new `errorLabel` in place of `emptyLabel`.
  `onCommit` fires on Enter and on click with `{ source: 'option', key }` or
  `{ source: 'text', text }`, so a consumer that accepts custom values no longer
  has to reassemble "the user committed something" from two callbacks and a key
  press.
  
  `ComboBox` also has keyboard tests for the first time — real key presses
  asserting that the arrows move the active option and that Enter commits it.

### Patch Changes

- 7256ac8: **`MenuButton`** is a button that opens a list and acts on the row chosen,
  holding no value of its own. It sizes to its label, not its widest row.
  
  labkit's "Add trial…" (with more than one instrument) and "Load…" snapshot
  controls are now `MenuButton`s rather than `Select`s held at no selection. A
  screen reader announces them as menus, and the fixed 160px and 88px widths are
  gone.
- 794b4ff: A number pref can name how its value is shown. `ToolPrefNumber.format` is
  `'plain'` or `'compact'`, and labkit sets it with
  `f.number(0).range(0, 2_000_000).format('compact')`. A compact readout keeps a
  value's precision below a thousand and abbreviates above it at one decimal:
  `950`, `40.0K`, `2.0M`.
  
  `SliderRow` takes the same choice as `notation`, and its readout reads typed text
  through the new `parseNumber`: thousands commas and a `k`/`m`/`b`/`t` suffix are
  accepted, so `2.5m` commits 2,500,000. An emptied readout now reverts instead of
  committing zero. `formatCompact` and `parseNumber` are exported beside
  `formatNumber`.
  
  **A slider readout is no longer narrower than its own values.** The box was a
  fixed width, so a six-digit value lost a digit and read as a smaller number. It
  now widens to fit the longer of its formatted `min` and `max`, and rows whose
  values already fit keep their width. `--wzl-property-readout-w` still sets the
  floor.
  
  `NumberRow` and `PrefsForm` ignore the format: one edits through a native number
  input that cannot display `2.0M`, and the other's sliders show no value.
- 59bdabb: `<Timeline>`'s graph mode now runs on `LayeredCurveEditor` instead of its own
  sampled polyline, DOM handles and drag code, so the kit has one editable-curve
  substrate rather than two.
  
  **`createKeyframeLayer` is a new built-in layer.** It edits a list of
  `Keyframe<number>`: model x is time, model y is value, and each segment is
  drawn through the easing on the key it runs into. You can drag keys, with the
  committed key held in place and a ghost at the target. A dragged key snaps to
  `snapX` (hold alt to skip it) and stays inside `xClamp`/`yClamp`. Clicking the
  curve selects a segment, and a selected cubic-bezier segment shows two
  draggable handles. Every key, segment and handle can take focus and has an
  accessible name. The arrow keys move whichever one has focus, and Enter or
  Space selects it. `keyframeLayerState` and `applyKeyframeDrag` are exported
  alongside it.
  `createFunctionLayer` still interpolates a spline through its anchors; the two
  layers solve different problems and do not share curve maths.
  
  **Keyboard edits reach the layer contract.** `CurveLayer.onKeyDown` now gets a
  fourth argument, `{ commit }`, so a key press can publish an edit that goes
  through `onLayerCommit` and undo like a drag does. Existing three-argument
  implementations are unaffected. `LayeredCurveEditor` now checks the native
  event's `defaultPrevented` to stop the key reaching lower layers. Before, it
  read a synthetic flag that a layer's `preventDefault` never set, so every key
  reached every layer.
  
  **`createFunctionLayer` anchors are focusable and named.** Each movable
  anchor has `tabIndex={0}`, `role="button"` and an accessible name built from
  the new `label` option (default `'Point'`). The arrow keys move a focused
  anchor by 1% of the range, or 10% with shift, under the same constraints as a
  drag. This applies to `CurveEditor` too.
  
  **`Plot2D` takes `role` and `aria-label`.** The default role stays `'img'`.
  `LayeredCurveEditor` renders its plot as `role="group"`, because an image's
  children are hidden from assistive technology and its marks are now
  interactive. It also accepts `aria-label`.
  
  `snapToNearest` is exported; `Timeline`'s snapping uses it.
  
  In graph mode, a key's value is no longer clamped to the lane's current value
  range while you drag it, so a drag can raise the maximum or lower the minimum.
  Graph lanes draw vertical grid lines at the ruler's ticks.
- 441304e: `Plot2D` draws ticks. `xTicks` and `yTicks` take a line at each tick and a label
  naming it, placed inside the plot or hanging past its edge. Left to themselves the
  ticks land on round 1, 2 or 5 steps, as many as `minSpacing` allows at the plot's
  current size; `values` gives them explicitly. Every label in a column shares its
  decimal places, and `format` replaces the text. `LayeredCurveEditor`,
  `CurveEditor` and `PointPlotter` pass both props through. `niceTicks`, `niceStep`
  and `formatTick` are exported for anything drawing its own axis.
  
  A timeline lane in graph mode now labels its value axis in the gutter beside the
  track, and its time grid is drawn through the same ticks.
- 50d2881: A number pref with a display unit now reads a unit typed into it: `0.25turn` or
  `30°` in the rotation field stores π/2 or π/6, and `12mm` in a field showing
  centimeters stores what 1.2cm is.
  
  **`prefUnit(system, displayUnit, { precision?, suffix? })`** builds a
  `ToolPrefNumberUnit` from a `UnitSystem`, so a leaf no longer hand-writes its
  conversion. `ToolPrefNumberUnit` gains `accepts`, the units a person may type
  and the factor each scales by. `ANGLE_RADIANS` joins the unit tables, and
  `rotationDegreesUnit` is built from it.
  
  **`parseNumber(text, units?)`** reads a trailing unit, longest name first, and
  a unit beats a magnitude suffix: with meters accepted, `2m` is two meters.
  
  **`UnitField`** is a text field for a number that can carry a unit. Both
  `SelectionPanel` and `PrefsForm` edit a unit leaf through it; a leaf with no
  unit keeps `NumberField`.
- 28d5111: A `SelectRow` whose value is absent or not one of its options now shows a placeholder instead of the first option ("Choose option…" unless its new `placeholder` prop names one), and `CheckboxRow`, `TextRow` and `NumberRow` stay controlled when given no value.
- Updated dependencies [9190fc9]
- Updated dependencies [a2feeb0]
- Updated dependencies [3ecc1be]
- Updated dependencies [dd48085]
- Updated dependencies [efaf707]
- Updated dependencies [7586835]
- Updated dependencies [6385c68]
- Updated dependencies [2f1ddd0]
- Updated dependencies [ea285a2]
- Updated dependencies [c758b4d]
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
- Updated dependencies [2adc840]
- Updated dependencies [0f374d8]
- Updated dependencies [d25a09d]
- Updated dependencies [deb9e79]
- Updated dependencies [830cf7e]
- Updated dependencies [50d2881]
- Updated dependencies [a5f738a]
- Updated dependencies [ab90aa7]
  - @weasel-js/core@1.5.0
  - @weasel-js/svg@1.5.0
  - @weasel-js/font@1.5.0
  - @weasel-js/modes@1.5.0

## 1.4.4

### Patch Changes

- d80a7eb: **`tokens.css` no longer sets a document font.** It was the one rule in the
  file that was not an inert custom property, and it re-typed the whole document
  — so an app with its own typography could not import the stylesheet at all and
  hand-wrote the `--wzl-*` bridge instead, which falls silently behind whenever a
  component starts reading a token the list does not carry. The rule moved to
  `fonts.css`, beside the `@font-face` declarations, which is the file that
  already meant "give me the kit's typography". A surface that wants both now
  imports both.
  
  **`--wzl-slider-track-tint` and `--wzl-slider-thumb-tint` are renamed to
  `--wzl-slider-track-mix` and `--wzl-slider-thumb-mix`.** They are the second
  argument of a `color-mix`, so they must be percentages; the old names read as
  colors, and setting one to a color invalidated the declaration and left the
  thumb unpainted with no error anywhere.
  
  **Slider size tokens carry their own defaults.** `--wzl-slider-track-h` and
  `--wzl-slider-thumb-size` were used bare, so unset the track had no height and
  the control was present, focusable, operable and invisible. An incomplete
  bridge now degrades to the wrong size instead of to nothing.
  
  **`ColorRow` and `NumberRow` take `onInput`.** `Slider` and `SliderRow` split
  the live value from the committed one; these rows had a single callback with
  nothing saying which semantics it had, so a consumer with an undo stack got one
  entry per tick. `ColorRow` also takes `onAlphaInput`. A row given one callback
  still fires continuously, as before.
  
  **`RangeSlider`'s track has no `min-width` floor.** The root is a column flex
  container, so `align-items` on it governs the horizontal axis and collapses the
  track — and the 80px floor turned that into a small slider that looked
  deliberate rather than a broken one that would have been found in seconds.
  
  **The property readout's width takes `--wzl-property-readout-w`,** rather than
  leaving a consumer to match the hashed class name.
  
  **labkit mints ids through a helper that checks for `crypto.randomUUID`.** It
  exists only in a secure context, and a LAN address is not one — so a lab opened
  on a phone or a tablet by IP threw on its first render and showed a blank page
  with nothing in reach to say why.
- Updated dependencies [9ce6f00]
- Updated dependencies [6f876a7]
- Updated dependencies [ed400a3]
- Updated dependencies [fc00dae]
- Updated dependencies [730da55]
- Updated dependencies [60ba9d9]
- Updated dependencies [5732951]
- Updated dependencies [2ff4824]
- Updated dependencies [3d89141]
- Updated dependencies [4a128c4]
- Updated dependencies [aee9d92]
- Updated dependencies [c067221]
- Updated dependencies [26d40bf]
- Updated dependencies [b8d2940]
- Updated dependencies [acaa71d]
- Updated dependencies [b5e2cd9]
- Updated dependencies [89276ee]
- Updated dependencies [36950d8]
- Updated dependencies [4f8c6b2]
- Updated dependencies [4d48493]
- Updated dependencies [1240956]
  - @weasel-js/core@1.4.4
  - @weasel-js/svg@1.4.4
  - @weasel-js/font@1.4.4
  - @weasel-js/modes@1.4.4

## 1.4.3

### Patch Changes

- 24896fb: `ComboBox` takes `width='fit'`, and labkit's zoom field stops pinning pixels.
  
  `Select` and `NumberField` already had it; `ComboBox`'s text input did not, so
  the only way to keep one out of a toolbar's slack was a pixel width from the
  consumer's own stylesheet. At `fit` the input measures a hidden stack of every
  option label — the same mechanism `Select` uses — so the field is wide enough
  for whichever option is chosen and takes no more of the row than that.
  
  labkit's `ZoomControl` states `--wzl-number-field-width: 6ch` instead of pinning
  its field at 62px. Measured in a browser: "800%" is 33px against the 35px a 5ch
  box gives, which is no margin at all in another UI font, and 6ch also holds the
  "1600%" a consumer raising `max` can reach.
- 8b7ee84: Overlays portal into the nearest themed ancestor instead of `document.body`.
  
  Every overlay this package portals — `Select`'s and `ComboBox`'s popovers,
  `Dialog`, `Callout`, `Tooltip` — used to mount on `document.body`. That is
  outside the element `applyTheme` / `<ThemeProvider>` stamps, so every `--wzl-*`
  the overlay read resolved to the empty string and the panel fell back to browser
  defaults: a light box with unreadable text in a dark app.
  
  Each of them now mounts inside the nearest ancestor of its own position
  carrying `data-wzl-theme` / `data-wzl-mode`, so it resolves the same tokens as
  the control it belongs to. **This is a behavior change**: an overlay's DOM
  position moves from the body into the app's tree. Anything reading the document
  for overlay content by walking down from `document.body` will find it one place
  deeper; anything using the `data-weasel-overlay` marker is unaffected.
  
  Two ways to override it. `portalContainer` on any of the five components names
  an element for that overlay alone, and `null` sends it back to
  `document.body`. `<OverlayPortalProvider container={…}>` sets it for a whole
  subtree. A styling root below the themed element can claim the overlays instead
  by carrying `data-wzl-portal-host` — which is how labkit's `.lk-root`, whose
  element defaults the themed wrapper above it does not have, now gets them. The
  per-call-site container the labkit export panel was passing is gone.
- 591ef38: `PrefsForm` honors a number leaf's display unit, and renders `font-family` as a
  real control.
  
  A leaf declaring `unit` — `pose.rotation` stores radians and shows degrees —
  was rendered raw: the field showed radians against a degree suffix that was not
  drawn, and typing a number wrote it straight through. Both the input and the
  slider now convert the value with `toDisplay`, convert back with `fromDisplay`
  on every write, convert the leaf's declared `min` / `max` / `step`, and draw the
  suffix beside the field. A leaf with no `unit` takes the untouched path.
  
  `prefDisplayBounds` is the bounds conversion, exported from the Prefs schema
  module. `SelectionPanel` held a private copy and now imports this one.
  
  A `font-family` leaf drew "no renderer" text. It now renders a
  `FontFamilySelect` over the live font registry, keeping an unregistered family
  visible and labeled with what actually paints. A consumer-supplied
  `renderers['font-family']` still wins.
- af6234c: A Slider's below-thumb readout row takes the readout text's height, not the
  default thumb's.
  
  `.readoutsBelow` held `height: 14px` — what the thumb measured before
  `density="slim"` existed. The row contains absolutely-positioned labels, which
  are 10px tall, so every slider drawing its values below the thumb carried 4px of
  dead space under them, and a slim slider's 8px thumb made the mismatch a third
  of the control.
- 4f45bd0: A number leaf that declares a display unit converts its bounds too.
  
  `SelectionPanel` converted the value through `toDisplay` and passed `min`, `max`
  and `step` straight through, so a leaf storing radians and showing degrees
  clamped typed degrees against a radian range: 90 came back as 6.283 — 2π, the
  max — and the field silently stored 0.11 rad.
  
  Only declared bounds convert. An omitted one has no stored counterpart to put
  through the conversion, and its fallback (0..100 for a slider's track, a step of
  1) is a display-space number already. `min` and `max` are points, so they
  convert the way the value does; `step` is a distance, so it converts as a span —
  a unit with an offset maps zero somewhere else.
- Updated dependencies [2de5a37]
- Updated dependencies [10e1ab6]
- Updated dependencies [eb0d6ce]
- Updated dependencies [75969f6]
- Updated dependencies [0d40f94]
- Updated dependencies [713f98a]
- Updated dependencies [85f4a21]
- Updated dependencies [4bb0341]
- Updated dependencies [e0d5580]
- Updated dependencies [edf99d5]
- Updated dependencies [2723cc7]
- Updated dependencies [0ca0aca]
- Updated dependencies [3583ca3]
- Updated dependencies [fc16cac]
- Updated dependencies [6d4bbeb]
- Updated dependencies [995fde2]
- Updated dependencies [6e4fb4d]
- Updated dependencies [b0fba6a]
  - @weasel-js/core@1.4.3
  - @weasel-js/svg@1.4.3
  - @weasel-js/font@1.4.3
  - @weasel-js/modes@1.4.3

## 1.4.2

### Patch Changes

- 8819237: Add `<Disclosure>`, and sit the lab header's controls on the title's baseline.
  
  **`Disclosure`** is the twisty on a collapsible section: a triangle that turns
  as it opens. It holds no state and renders no children — the consumer owns both,
  and `aria-expanded` ties the control to them. `DisclosureRow` puts one beside a
  row of content.
  
  It settles three things every hand-rolled twisty gets wrong. The mark is drawn
  rather than typed, because `--wzl-font-ui` carries no ▸/▾ and a text glyph falls
  back to whatever the system offers at whatever size that font renders it —
  around 6px against 13px body text. The hit target is at least 20px and grows
  with the mark, rather than being the mark's size. And it sits outside the row's
  label rather than inside it, so clicking to expand does not actuate the label's
  own control.
  
  Like `DragHandleGlyph`, it stays out of the icon register: that register is
  outline strokes at a fixed weight, and `icons/base.mjs` rejects a solid triangle
  in it by name.
  
  **The lab header** aligned its controls to the center of the row, so every
  control label sat off the title's baseline — 5px, for the `Add trial` button.
  The header and its actions row now align on the baseline. The button needed one
  more thing: a flex container reports its *first* item's baseline, and the
  leading `<svg>` icon has none, so the button handed the header a baseline
  synthesized from the icon's bottom edge. It aligns on the baseline internally
  now, with the icon keeping its own centering through `align-self`.
- bfb0595: Run the last four drags in the kit on `openPointerSession`. Capture, pointer identity, teardown and recovery from a release that never arrives are now decided in one place for every pointerdown-to-pointerup lifecycle in the kit.
  
  Fix a drag that silently dropped its commit. `openPointerSession` treated `lostpointercapture` as the end of the gesture, and Chrome releases capture implicitly a beat *before* it delivers `pointerup` — so a release already on its way arrived after the session had torn down its listeners, and the gesture ended as a cancel instead of a commit. Roughly three drags in four were lost this way in one measured consumer. Losing capture now ends a session only once the origin has left the document, which is the case the rule was written for: the session listens on the document, so capture is what retargets events, not what delivers them.
  
  The gesture dispatcher opens a session per held pointer instead of tracking pointers itself. Two behavior changes come with that: a drag released outside the canvas now ends, where before only pointer capture made that work; and a fresh press on a pointer still believed held cancels the stale gesture rather than committing it at the new press's coordinates, since where it actually ended is unknown.
  
  Two small breaking changes. `ThresholdDragOptions.onCancel` now fires only when a gesture ends without a release — a release below the threshold calls the new `onClick`. And in labkit, `useDragDrop`'s `startDrag` and `Palette`'s `onDragStart` take the React pointerdown event in place of a `Point`; a cancelled palette drag now drops nothing, where before it had no cancel path at all.
  
  `startThresholdDrag` also takes an `origin` element, for a list whose grabbed row unmounts mid-drag and drops capture with it. `useReorderDragList` uses it and no longer carries its own copy of the threshold logic.
- 68556f5: `Select` and `NumberField` take `width='fit'`, sizing to their content instead
  of to the row they sit in.
  
  Both are form fields and both drew at `width: 100%`, which is right in a form
  column and wrong everywhere else: in a shrink-to-fit row — a toolbar, a header —
  the field absorbs all the slack and pushes the row's other content to
  min-content. The only fix available to a consumer was to pin a pixel width from
  its own stylesheet, which is a number nobody can maintain against a font or a
  label change.
  
  `width` defaults to `'fill'`, which is the behavior every existing caller has.
  `'fit'` sizes the control to its content:
  
  - A `Select` measures its widest option, not its selected one. The trigger
    becomes a grid, and a hidden stack of every option label (the placeholder
    included) shares a cell with the value. So the control fits the longest thing
    it can ever show and does not change width as the selection moves. The
    children form is measured the same way, off each `SelectItem`'s label. Each
    measured row carries the check mark too, because a selected row's mark
    travels into the trigger alongside its label.
  - A `NumberField` states a character count, `--wzl-number-field-width`,
    defaulting to `9ch` — the width the property rows already use for a number.
    A stated width is what this needs: left to size itself an `<input>` asks for
    its 20-character intrinsic width, which is wider than most rows it sits in.
  
  This is the same affordance the property rows got through
  `--wzl-prop-number-width` / `--wzl-prop-text-width`, offered as a prop because
  these two are placed by consumers rather than by a panel.
- 68556f5: Let a `LayerStack` have no palette, and let a `LayerList` nest.
  
  **`LayerStack`** required `kind` on every item plus `paletteKinds` and `onAdd`
  on the stack, so a list whose items have no kind and nowhere to add from had to
  pass three stubs to get a drag-reorderable set of expandable cards. All three
  are optional now, as are `onRemove` and `onPrimaryChange`:
  
  - An item names itself with `label` when it has no `kind`.
  - The head row renders only when there is a title or a palette to put in it.
    Without `onAdd` there is no palette, whatever `paletteKinds` says.
  - No `onRemove`, no ✕. No `onPrimaryChange`, no select — a `primaryValue` with
    no handler would have been a control the user could not change.
  - The empty state stops pointing at a palette that is not there, and
    `emptyLabel` overrides it.
  
  **`LayerList`** took a flat array, so a nested set of layers had to be
  rebuilt as a recursive component outside the kit. `layers` is now
  `LayerTreeNode[]` — a `LayerDescriptor` with optional `children` — and a node
  with children renders an expandable subtree behind `<Disclosure>`. A plain
  `LayerDescriptor[]` still type-checks and renders exactly as before, twisty
  column included: it appears only once some node in the tree has children.
  
  Reordering is scoped to siblings. A drag moves a row within its own parent's
  child list and never reparents it; `onReorder` still hands back the whole tree,
  with only that group's order changed. Collapse is uncontrolled by default,
  seeded from each node's `defaultCollapsed`; pass `collapsedIds` to own it, and
  `onCollapsedChange` fires either way.
- b1cddc6: Property panels take `density` and `align`, and `layout` reaches every row kind.
  
  Three things a consumer could not do from outside `Properties.module.css`.
  
  **Spacing was four hard-coded numbers** — the list's row gap, the group's
  padding, the group title's margin, the panel's padding — none of which read a
  custom property. Every metric in the family now does: `--wzl-prop-row-gap`,
  `--wzl-prop-column-gap`, `--wzl-prop-panel-pad`, `--wzl-prop-panel-title-gap`,
  `--wzl-prop-group-pad`, `--wzl-prop-group-title-gap`,
  `--wzl-prop-subpanel-row-gap`, `--wzl-prop-field-h`, `--wzl-prop-field-pad-x`.
  A `density` of `'tight' | 'normal' | 'roomy'` on `PropertyPanel`,
  `PropertyList`, `PropertyGroup`, `Subpanel` or `PropertyRow` sets them as a
  bundle. Both props inherit, so the nearest container that states one wins and an
  inner group can differ from the panel around it.
  
  **A color row centered its label and swatch and could not be told otherwise**,
  so a palette panel — a column of swatches read as a group — had no way to line
  them up. `align` takes `'start' | 'center' | 'end' | 'baseline'`; `baseline`
  sits each swatch on its label's first-line baseline, which holds when labels
  wrap to different heights. Left unset, a color row keeps sinking its content to
  the row's bottom edge, so an alpha track stays level with the taller row beside
  it.
  
  **`ColorRow` and `CheckboxRow` took no `layout`.** `PropertyRow` gated the
  inline class on the default variant, so a panel asking for one orientation got
  another for two row kinds out of six. `layout` is now unset by default and each
  variant supplies its own — `block` for the default variant, `inline` for color
  and checkbox — so passing it through a whole panel is safe, and `block` on a
  color or checkbox row stacks it. `ControlPanel` forwards `layout` to those two
  rows, and takes `density` and `align` of its own.
  
  `PropertyList` and `PropertyGroup` also take `pack="one-up"`, which gives every
  row the full width, color rows included. `'auto-color'` pairs them two per row
  and there was no way to opt out — which is the packing a palette needs.
  
  Nothing changes for a consumer that passes none of these.
- 352f938: A property-row number field drops the browser's spin buttons.
  
  Chrome reserves the spin-button gutter at a number input's right edge whether or
  not it paints the arrows. The field right-aligns its value, so the digits stopped
  about 20px short of their own border and the row read as if something belonged in
  that space — a unit, most obviously, which is exactly where a unit does not go:
  `NumberRow` renders `unit` as a sibling of the input, outside its border.
  
  The panel drives numbers by typing and by dragging the paired slider, never by
  the steppers, and the slider's own inline readout has always dropped them. The
  typed field beside it now does too.
- 68556f5: `SliderRow` gets a live/commit pair, and a `PropertyGroup` can fold away.
  
  **`SliderRow` now takes `onInput` alongside `onChange`** — the pair `<Slider>`
  already spells. `onInput` fires through the drag, `onChange` once it ends, so a
  control whose write is expensive (a re-simulation, a refetch) can say "on
  release". The commit half is the platform's own: a range input fires `input`
  continuously and `change` when the value settles. A typed readout reports to
  both. A row given only `onChange` is unchanged — that one callback stays the
  live write and there is no separate commit.
  
  **`PropertyGroup` collapses.** `collapsible` puts a `<Disclosure>` twisty
  beside the title; `defaultCollapsed` starts it folded and leaves the state with
  the group; `collapsed` + `onCollapsedChange` hand that state to the consumer.
  Folded rows stay mounted and hidden, so a control's local state survives being
  put away.
  
  `ControlPanel` passes it through to a schema's sections. `collapse="closed"`
  folds them all; `collapsed` — a map keyed by section label — plus `onCollapse`
  put the open/closed state somewhere a lab can keep it. A panel that sets
  neither renders exactly as before.
- Updated dependencies [bfb0595]
- Updated dependencies [3b07b13]
- Updated dependencies [8e9eb1d]
  - @weasel-js/core@1.4.2
  - @weasel-js/svg@1.4.2
  - @weasel-js/font@1.4.2
  - @weasel-js/modes@1.4.2

## 1.4.1

### Patch Changes

- 73039aa: Collapse four duplicated helpers and drop three dead modules.
  
  `Badge`'s shape-control table lived twice — once in `shapeControls.ts`, which nothing imported, and once re-declared inside the stories, which is the copy that rendered. The stories now import the module, so the badge shape defaults have one definition again. `Badge`, `Shield` and `Perforated` shared eleven identical lines of ResizeObserver measurement for the same viewBox-unit conversion; that is now `useSvgBox`.
  
  `composeSelectionPose` and `makeContainerAwareBoundsResolver` each carried their own copy of the leaf walk, including the rule that keeps an empty container from contributing bounds — one function now, so the rule can be fixed in one place.
- 0b0f13f: Put every drag in the kit on one pointer lifecycle, and recover the releases the DOM does not deliver.
  
  Fourteen pointerdown-to-pointerup lifecycles each answered capture, pointer identity, teardown and lost-pointer recovery for themselves. They now run on `openPointerSession`: `Slider`, `BandEditor`, `Timeline`'s `Lane` and `Ruler`, `LayeredCurveEditor`, `ResizeHandle`, `useReorderDragList`, `MinimapCanvas`, labkit's `LayerList`, `usePanZoom`, `useOrbit` and `FloatingPanel`. A drag released over another window, or whose element unmounts mid-gesture, now ends instead of hanging in flight.
  
  A third recovery rule joins the two that shipped with the primitive: a fresh press on a pointer still believed held reports `'superseded'`, because the release landed somewhere that never told us and the pointer never came back for the missed-release rule to see. Without it a stale session steers the next press. `useGestureDispatcher` applies the same rule to its own multi-pointer lifecycle.
  
  Breaking: hooks that drove their drag through returned React props no longer return them, because the session owns the gesture from the press.
  
  - `useReorderDragList`'s `containerProps` is `{ ref }` only; `onPointerMove` / `onPointerUp` / `onPointerCancel` are gone. It gains `onPress(id, mods)` — a press released without engaging a drag, fired for locked rows too, with the modifiers held at press. That is the click-vs-drag decision consumers previously had to reconstruct by sampling drag state before forwarding the pointerup, which no longer works now that the session ends first.
  - labkit's `PanZoomHandlers` and `OrbitHandlers` lose `onPointerMove` / `onPointerUp`. `usePanZoom` gains `onTap` for the same reason.
  
  The five `@weasel-js/ui` drag surfaces pass `capture: false` deliberately and now assert it: capture retargets `pointerup` to the capture element and kills the click on consumer-rendered content inside a slider thumb, a band body, or curve-editor chrome.
- 00af9ac: Add `openPointerSession`, and put the kit's drag lifecycles on it.
  
  `useHandleDrag`, `startThresholdDrag` and `useDragHandle` each owned a pointerdown-to-pointerup lifecycle and each answered the same four questions differently. Capture: two took it untry'd, one never took it. Listeners: one on the element, two on `document`. Pointer identity: none of the three filtered by `pointerId`, so a second finger drove and could end a drag in progress. Teardown on unmount: one had none, one had it for half its lifecycle.
  
  None of them — nor the dispatcher — handled `lostpointercapture`, and none read a `pointermove` with no button held as the release it missed. So a drag whose pointer left the element, or whose capturing element was removed mid-gesture, hung in flight with no end and no cancel.
  
  `openPointerSession(origin, downEvent, callbacks)` now decides all of it once: capture on the origin, listeners on the document so a removed element cannot strand the gesture, every event filtered to its own pointer, `lostpointercapture` and the missed release both closing the session, and one `cancel()` for unmount, Escape or blur. The missed-release rule disarms itself when the press reports no button state, so synthesized events do not read as instant releases.
  
  `useGestureDispatcher` keeps its own multi-pointer lifecycle — one canvas listener set keyed by `pointerId` is the right shape for multitouch — but takes both recovery rules from the same module, so there is one implementation of each rather than two that drift.
  
  Breaking, in `useHandleDrag`: `onEnd` now fires only on a real release and receives `{ point, moved, event }` instead of a bare event; a cancelled gesture reports through the new `onCancel(reason)`. The old signature made every commit-on-end consumer sniff `e.type === 'pointercancel'` to tell an edit from an abandoned drag, and hold its own ref to recover the end position — `GradientEditor` does neither now.
- Updated dependencies [dcef92c]
- Updated dependencies [73039aa]
- Updated dependencies [b91a8dd]
- Updated dependencies [caad52f]
- Updated dependencies [0b0f13f]
- Updated dependencies [00af9ac]
- Updated dependencies [9b9224c]
  - @weasel-js/core@1.4.1
  - @weasel-js/svg@1.4.1
  - @weasel-js/font@1.4.1
  - @weasel-js/modes@1.4.1

## 1.4.0

### Patch Changes

- 72b30cc: One skin for the kit's sliders and fields.
  
  `@weasel-js/ui` carried six slider treatments, three of which rendered the same
  bare `<input type="range">` with independently hand-authored pseudo-element rules.
  A new shared `range.module.css` is now the single source for that chrome, imported
  by `InlineRange` and by the property rows; a bare range inside a labkit `.lk-root`
  wears it too. New tokens carry the geometry: `--wzl-slider-track-h`,
  `--wzl-slider-thumb-size`, `--wzl-slider-track-tint`, `--wzl-slider-thumb-tint`.
  
  `Slider` — the multi-thumb canvas widget — keeps its own 24px chrome, since a
  gradient track needs a grabbable thumb, but gains `density="slim"` which drives its
  track and thumb from those tokens. `ZoomControl` uses it, so a lab's zoom no longer
  looks like a different design system from the panel beside it.
  
  `NumberField` gains `ghost`: transparent until focused, the readout treatment the
  property rows already had. `hideSteppers` alone still painted the full sunken box,
  which is why `ZoomControl`'s readout could not match a property row.
  
  Boxed fields size from `var(--wzl-field-h, var(--wzl-control-h))` and pad from
  `--wzl-field-pad-x`. Set `--wzl-field-h` on a container to change a whole panel's
  density; `PropertyList` sets its own, so property rows keep their 20px. The
  fallback form is deliberate — it resolves per element, so a toolbar's redeclared
  `--wzl-control-h` still reaches its fields. `--wzl-prop-field-height` is retired;
  nothing ever set it.
  
  `NumberRow` gains a `unit` suffix, matching `SliderRow`, and right-aligns its value
  so a column of numbers shares a decimal position.
  
  Behaviour changes worth knowing:
  
  - `InlineRange`'s thumb is 8px and translucent rather than 12px and solid.
  - Every boxed field focuses with the 1px ring the React Aria fields already used,
    replacing the property rows' bare outline; the colour chip gains a focus ring it
    never had, and the property-row select moves from `--wzl-accent` to
    `--wzl-focus-ring`.
  - A `PropertyRow` rendered outside a `PropertyList` no longer picks up the dense
    20px — density belongs to the container now. Every panel composes the list, so
    this shows only in isolated stories.
  - labkit's mark-title field renders with `Input` instead of a bare `<input>`, so it
    no longer shows user-agent chrome. Its `onChange` now receives the string value.
  
  Removes `--wzl-track-bg`, `--wzl-track-border`, `--wzl-thumb-fill`,
  `--wzl-thumb-border` and `--wzl-thumb-text`, which nothing read.
  
  A number leaf declares its display suffix with `.suffix('px')`, which `ControlPanel`
  passes to the row. `unit` on a leaf keeps its existing meaning — the
  `{ toDisplay, fromDisplay, suffix }` conversion descriptor `SelectionPanel` reads —
  and `ControlPanel` does not interpret it.
- 762f947: Re-export the icon set through `@weasel-js/labkit/weasel-ui`, and give the
  three workspace-layout glyphs named components.
  
  A lab that depends only on `@weasel-js/labkit` could not draw a kit icon at
  all: the passthrough carried every other primitive but not `Icon`,
  `ICON_PATHS` or their types, so the only way in was a direct `@weasel-js/ui`
  dependency — the thing the passthrough exists to avoid.
  
  `LayoutRowsIcon`, `LayoutColumnsIcon` and `LayoutGridIcon` join the named
  glyph components in `@weasel-js/ui`.
- 7aa92a8: Draw the lab's color mode as icons instead of words.
  
  `@weasel-js/ui` gains three glyphs — `modeLight` (a rayed sun), `modeDark` (a
  crescent) and `modeAuto` (a four-pointed sparkle) — with `ModeLightIcon`,
  `ModeDarkIcon` and `ModeAutoIcon` beside the other named components.
  
  labkit's header bar becomes `size="sm" variant="flat"`, the same treatment the
  stroke cap / join / align rows use, with each segment holding a 14px glyph.
  The words move to `ariaLabel`, so the control is still a radiogroup announcing
  Auto / Light / Dark and its keyboard behaviour is unchanged.
- fea3092: Add `layoutRows`, `layoutColumns` and `layoutGrid` — one square field cut three
  ways, for choosing how a workspace tiles.
  
  They are drawn in ink rather than outline because `grid` is already an outlined
  3x3 on the same field: at 16px an outlined layout grid and the grid you snap to
  are the same picture.
  
  `gen-icons.mjs` now throws when two glyphs claim one name with different
  drawings. It used to skip the second in silence, so a new glyph could vanish
  into an existing key with the generator still reporting success — which is how
  `layoutGrid` got its name.
- c64f152: Move seven stray literals in `ItemList`, `Slider` and `Timeline` onto the token
  scale, which unblocks `npm run lint -w @weasel-js/labkit` — its design-token
  check has been failing on them, and that step runs in CI.
  
  Radii of 2px, 3px and 4px all become `--wzl-radius-sm` (3px) and `font-size:
  12px` becomes `--wzl-font-size-sm` (11px), matching how the same values were
  mapped when the scale was introduced. The slider tick's radius was keyed to its
  own width and is now `--wzl-radius-pill`; both forms clamp to half the tick's
  width at any width, so it renders as before.
- 5c3e571: Add `ChevronIcon`, and use it for the disclosure in `SidebarPanel` and
  `<Timeline>`'s lane labels.
  
  Both were rendering a literal `▾` character at 10px. A text glyph is not
  centred in its em box — `▾` sits low and narrow inside a box that is not even
  square — so `rotate(-90deg)` swung the visible triangle through an arc instead
  of spinning it in place, moving it 4.0px across and 3.6px down. The new glyph's
  ink centroid is placed at the centre of the 20×20 viewBox (the stroked region's
  first moment, not the path's bounding box: two round caps outweigh the single
  join at the vertex, so the mass sits above the bbox centre), and the icon's
  box is square, so the rotation is concentric to within 0.005px.
  
  16px in `SidebarPanel` and 14px in a timeline lane are the smallest sizes at
  which both arms and the vertex land solid ink on the 1× device grid.
- e1838ff: Add `DetentSlider`, and make `Slider`'s stops visible.
  
  A numeric option with a small set of allowed values along a line is a slider
  with detents, not a dropdown. `DetentSlider` takes `items`/`value`/`onChange`
  the way `ToggleBar` does — it is that same "pick one of an ordered set", wearing
  a slider's affordance — and the transport's playback rate now uses it.
  
  The track addresses the *index* of `items`, not the value. Rate steps are
  geometric, so a linear value track puts 1× at a fifth of the way along and
  crowds four of five detents into that fifth, making the most-used value the
  hardest to hit. A log scale would rescue that particular list by coincidence
  and not a 1-2-5 one. Index-addressing is also the honest model: a small allowed
  set is an ordinal choice with nothing between the detents to represent. The
  value is published as `aria-valuetext`, since `aria-valuenow` is then a
  position rather than a quantity.
  
  Three changes to `Slider` fall out and are generally useful: `stops` now draw
  (an invisible attractor that changes drag and keyboard behaviour is
  indistinguishable from a bug — `showStops: false` opts out); `Thumb.valueText`
  fills `aria-valuetext` for any non-linear scale; and `trackClick:
  'move-nearest'` makes a press on bare track move the nearest thumb, off by
  default so a stray click cannot yank a stop on a multi-thumb gradient.
- 1b42b19: Add `ItemList`, the row chrome behind a sidebar list.
  
  WeaselDraw's Layers and History panels each carried a private copy of the same
  container / row / empty-state CSS, and they had drifted: rows were 28px against
  24px, and Layers was pulled 8px wider on both sides by a negative-margin class,
  so two lists stacked in one sidebar did not line up. Both now render through
  `ItemList` and agree by construction.
  
  It owns the container, the row box and the empty state, and nothing else. What
  a row means stays with the consumer, reached through `className` and
  `rowProps` — history dims its redo entries and rules a line under the current
  one; the layer list drags to reorder, leads each row with a swatch, and hangs
  its drop indicator off `overlay`.
- 4dc5cad: A loupe any lab can turn on
  
  `loupe` joins `canvas`, `layers`, `dragDrop` and `undo` as an instrument
  capability, so declaring one is what gives a trial the magnifier and its
  toolbar switch — suppressible by id like every other built-in.
  
  Two painters, chosen by what the instrument's content is. `loupe: true` on an
  instrument that draws gets the canvas painter: the lens re-runs that
  instrument's own layers through a camera zoomed about the aimed point, so a
  hairline is still a hairline at 30×, and `mode: 'pixel'` enlarges the pixels
  the stack presented instead. `loupe: { render }` gets the DOM painter, for an
  instrument whose content is markup: handed a camera, it draws itself again
  inside a circular clip. Either way the lens takes no pointer events, so the
  pan, the wheel and anything underneath keep working while it is up. A function
  form — `loupe: (config) => …` — is re-read as the config changes, so a setting
  can drive the lens.
  
  The lens follows the pointer while it is on, appears for as long as `Alt` is
  held while it is off, and takes the wheel from pan/zoom to resize its
  magnification. Those are plain listeners for now; `docs/TODO.md` records why,
  and what replaces them.
  
  Supporting surface: `zoomAt` and `centerOn` are exported from
  `@weasel-js/labkit` — the fixed-point zoom `usePanZoom` already ran, and the
  camera that centres a world point in a viewport — so nothing composing a camera
  has to re-derive one. `CanvasStackContext` now also carries the stack's
  `surface`: its element, measured box, layers and presented canvases, which is
  what an overlay needs to re-draw or read back what the stack painted.
  `ToolbarItem` takes `pressed`, rendering `aria-pressed` and a held-down state,
  and `@weasel-js/ui` gains a `loupe` glyph.
- a6faf75: Pack property rows two-up, and size their fields to their content
  
  A property panel spent a full row on every leaf and stretched each field to
  whatever width the row had, so a 38-flag lab sidebar scrolled for two screens
  to show four dozen digits. The grid was already there — `PropertyList` and
  `PropertyGroup` have taken `pack="pairs"` since they were written — but only
  `PropertyRow` could opt out of it, so nothing that rendered a schema could use
  it: `ControlPanel` hardcoded `pack="auto-color"`, which spans everything but a
  colour.
  
  `ControlPanel` now takes `pack` and `layout`. It defaults to `pack="pairs"`
  (two controls per row), with `'auto'` for the middle ground — text, sliders and
  segmented toggles keep the full width, everything else pairs — and `'one-up'`
  for what it used to do. A custom `controls` renderer places itself like any
  built-in row and opts out the same way, with `<PropertyRow span>`.
  
  `span` is now on every typed row (`NumberRow`, `TextRow`, `SelectRow`,
  `ToggleRow`, `CheckboxRow`, `ColorRow`, `SliderRow`), not just on the
  `PropertyRow` they are built from.
  
  Fields size to their content rather than to their cell: a number gets 9ch and a
  string 16ch, both capped at the column so a narrow sidebar still fills. Fields
  also state a height (`--wzl-prop-field-height`, 20px) rather than padding to
  one — the display face's line box is half again its font size, so a padded field
  stood 27px tall around 13px of text and trimming the padding could not fix it.
  The row and group gutters came in to match.
  
  Widths, heights and gutters are all overridable:
  `--wzl-prop-number-width`, `--wzl-prop-text-width`, `--wzl-prop-field-height`.
  
  A lab's trial sidebar states its width (`--lk-trial-sidebar-w`, 20rem) instead
  of deriving it from content: an auto-width sidebar is as wide as its widest
  label, so one verbose config key was setting the width of the lab. An inline row
  puts its label on the left edge and its field on the right, so fields of
  different widths still read as one rail down the column, and it keeps its one
  line in a column narrower than it wants: the field yields width to the label
  down to a four-character floor, and the label — which may be a single
  unbreakable name — never yields.
  
  Every property panel is visibly denser for this — WeaselDraw's inspector as
  much as a lab's controls.
- 016851c: Stop a stroke with no paint from blanking the whole document.
  
  `SelectionPanel`'s object leaf started from `{}` when the node held no value
  yet, so editing any non-paint field of `data.stroke` on an unstroked node
  committed that field alone — a `Stroke` with no `paint`, which the type
  forbids. The leaf's declared `default` was dead for writes; it now seeds from
  it, so writing one field materializes a complete value.
  
  Such a stroke threw out of `fillInPoseFrame`, and the throw escaped the painter
  and took the frame with it: the document page and every other node vanished,
  and the canvas stayed stale until something unrelated requested a redraw — so
  WeaselDraw opened on an empty workspace and only drew once the pointer moved.
  `resolveNodeStroke` now reads a paintless stroke as no stroke, and the text
  painter routes through it like every other painter. The frame loop no longer
  loses its dirty flag when a paint throws, so one bad frame is retried rather
  than stranding the surface.
- c9dd37f: Render text decorations as a toggle row, and ship a builtin font-family control
  
  `SelectionPanel` rendered every boolean leaf as a `Switch`, ignoring the leaf's
  `control` entirely — so the three text decorations arrived as three switch rows
  where every text editor puts one row of U / S / O. `ToolPrefBooleanControl` now
  accepts `'toggle'`, `ToolPrefBoolean` carries a `short` label for it (the pair
  takes the row's name, leaving the leaf only a glyph's worth of room), and the
  panel honors both. Core's text schema asks for it: `underline`,
  `strikethrough` and `overline` share a `Decoration` pair.
  
  A run of adjacent leaves sharing a `pair` renders as one `ToggleBar`, not one
  bar per leaf — the same segmented control the `Align` row beside it already
  draws. Each segment still writes only its own leaf, so flipping one decoration
  never invents values for the other two. An unset toggle is left unselected
  rather than dimmed: unselected is what a toggle button's off state means, and
  the dimming the `Switch` path uses for the same case reads as disabled on one.
  A leaf a consumer claims with its own `renderers` entry drops out of the run.
  
  `FontFamilySelect` moves from WeaselDraw into `@weasel-js/ui`, and
  `SelectionPanel` reaches for it on a `font-family` leaf. Core's own default
  text schema declares that kind, so a consumer passing no `renderers` — the
  Storybook story, any app taking the defaults — got the literal
  `(font-family: no renderer)` placeholder where the font picker belongs. The
  control offers both tiers that can actually paint and probes substitution at
  the node's own weight and style, so its label names the variant that will
  render. `@weasel-js/ui` now depends on `@weasel-js/font`.
- 6e5f821: Add `<Timeline>`, a keyframe editor for the timeline primitive.
  
  `<Timeline>` is controlled and pure: it takes tracks, a duration and a playhead,
  and emits `onInput` during a gesture and `onChange` at its end.
  `<AnimatedTimeline handle={h}>` binds it to a live `TimelineHandle`.
  
  A dope sheet edits time and easing for every track kind. A graph mode adds a
  value axis, and only for sampled tracks whose values are numbers — a `Pose` has
  no honest vertical position, so those rows stay dope rows. `renderKeyEditor`
  hands the selected key to the consumer, which supplies a control that knows its
  own value type.
  
  A `KeySelection` addresses a track by its index path (`{ trackPath: [2, 0] }`),
  so keys inside an expanded nested timeline drag, delete and re-ease like any
  other. Times reported to the editor are the addressed track's own; the component
  crosses into ruler time to snap and back out to commit.
  
  Dragging a key draws a dashed ghost at where it would land, with the committed
  key dimmed in place — the editor previews its own gesture rather than waiting
  for a consumer to wire `onInput` and feed the moved track back.
  
  Dragging a bezier handle previews the curve through `cubicBezierEasing`
  directly rather than `resolveEasing`, since a drag writes a fresh set of
  control points on every pointermove and `resolveEasing`'s cache is keyed by
  them — routing the preview through it would fill core's memo cache with
  hundreds of throwaway entries per gesture.
- Updated dependencies [eb16573]
- Updated dependencies [6650d67]
- Updated dependencies [04ea2e8]
- Updated dependencies [b656ebf]
- Updated dependencies [1214ff5]
- Updated dependencies [5295c34]
- Updated dependencies [2fbf611]
- Updated dependencies [36b6ee7]
- Updated dependencies [7a0c568]
- Updated dependencies [a7fa697]
- Updated dependencies [2272682]
- Updated dependencies [503b56d]
- Updated dependencies [ac2deea]
- Updated dependencies [23ffb2f]
- Updated dependencies [016851c]
- Updated dependencies [1b9575f]
- Updated dependencies [c9dd37f]
- Updated dependencies [9a000ea]
- Updated dependencies [016851c]
- Updated dependencies [8ddec11]
- Updated dependencies [28894b9]
- Updated dependencies [c4ccd0a]
  - @weasel-js/core@1.4.0
  - @weasel-js/svg@1.4.0
  - @weasel-js/font@1.4.0
  - @weasel-js/modes@1.4.0

## 1.3.0

### Patch Changes

- c1e567f: Move `LayerStack` from `@weasel-js/labkit` to `@weasel-js/ui`. It is a generic
  drag-reorderable stack of expandable cards — it reads nothing from labkit's
  instrument, config, state, trial or lab layers — and a consumer who wanted it
  had to take labkit and the lab frame it assumes.
  
  It can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**, from both the package root and
  `@weasel-js/labkit/ui/layers`: labkit re-exports it, and it bundles weasel-ui
  into its own dist, so this is a re-export rather than a new dependency.
  
  `DragHandleGlyph`, the grip both `LayerStack` and labkit's `LayerList` draw,
  moves with it and is now public from `@weasel-js/ui`.
  
  `LayerStack` also takes a `className` now, appended to its root — the
  supported way to reach it from a consumer stylesheet, since its own class
  names are hashed.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to a CSS module, matching the package it joined, so
  `lk-layer-stack`, `lk-layer-card` and their neighbours no longer exist as
  targetable selectors, and `--lk-layer-card-accent` is now
  `--wzl-layer-stack-accent`, set for you by the `accent` prop on an item. The
  card's `data-testid` drops the `lk-` prefix: `layer-card-<id>`.
  
  Two of the old rules were prefixed with `.lk-root` to outrank labkit's bare
  `button` defaults. Those defaults now sit at zero specificity, so the module's
  own class wins on its own; the stack no longer depends on a labkit ancestor,
  and it restates the border-box reset and the button font and height that
  `.lk-root` used to supply.
- 555f84c: Move the property-panel components from `@weasel-js/labkit` to
  `@weasel-js/ui`. `PropertyPanel`, `PropertyList`, `PropertyRow`, `SliderRow`,
  `NumberRow`, `TextRow`, `SelectRow`, `ToggleRow`, `CheckboxRow`, `ColorRow`,
  `Subpanel`, `PropertyGroup`, `CurveField` and `EffectCard` imported nothing
  from labkit's instrument, config, state, trial or lab layers — they are
  generic form UI, and a consumer who wanted them had to take labkit and its
  lab frame to get them.
  
  They can now be imported from `@weasel-js/ui` directly. **Existing
  `@weasel-js/labkit` imports keep working**: labkit re-exports the whole set,
  and it bundles weasel-ui into its own dist, so this is a re-export rather
  than a new dependency.
  
  The class names are no longer public. The stylesheet moved from global
  `lk-`-prefixed Less to CSS modules, matching the package it joined, so
  `lk-property-panel`, `lk-property-list__span` and their neighbours no longer
  exist as targetable selectors. Code reaching them from its own stylesheet
  should pass `className` instead — `PropertyPanel`, `PropertyList` and
  `PropertyRow` all accept one. For full grid width, a row takes `PropertyRow`'s
  `span` prop, and anything that is not a row goes in `<PropertySpan>`.
  
  `formatNumber` and its helpers consolidated onto weasel-ui's existing
  `format/number`; labkit's duplicate is gone.
- 52c7b2a: Depend on `font` and `core` as exact peers
  
  `@weasel-js/font` and `@weasel-js/core` keep registries that consumer code
  writes into — registered faces and glyph-ready subscribers in one, content
  handlers and paint kinds and shape painters in the other. Two physical copies
  in a tree are two registries, so a face registered into one while layout
  resolves against the other lays out nothing and the canvas is blank.
  
  Exact sibling pins are what produced the duplicate: a consumer mixing two
  weasel releases left npm no choice but to nest a second copy, silently. As
  peers, the same mix is an `ERESOLVE` at install time. `font` is now a peer of
  `core`, `hud` and `text`; `core` is now a peer of `svg`, joining `d3`, `hud`
  and `ui`, whose `>=` ranges tighten to exact so no version mix resolves by
  accident.
  
  **This can break an install that currently succeeds.** Anyone resolving a
  mixed set of weasel versions by luck now gets an install error instead of a
  blank canvas. That is the point, but it is a break.
  
  `labkit` deliberately keeps `core` as an ordinary dependency: its build aliases
  every core entry point to core's built files and inlines them, so it never
  resolves core at the consumer and has nothing to peer. The flip side is that
  labkit ships its own copy of core's registries, so a consumer using both still
  has two — this change does not address that.
- ce82f4a: An enum leaf can ask for a segmented control, and `pair` works inside an object
  
  `ToolPrefEnumControl` gains `'toggle'`: a three-option enum shows all three at
  once instead of hiding two behind a select. Options carry an optional `short`
  label — a capital or two — for the width a property row has; the full `label`
  stays the accessible name, so the abbreviation never becomes the only thing
  naming the option. A mixed selection selects no segment rather than picking a
  winner.
  
  `pair` now merges fields inside an object leaf, as it already did for section
  rows — a hint shouldn't mean something different for being a field of a value
  rather than a sibling of one. It merges *adjacent* leaves in both places, so
  the schema orders family, size, weight: size and weight pair, and family (which
  sat between them) moves ahead of the pair rather than splitting it.
  
  A stroke's cap, join and align share one row; property rows wrap rather than
  overflow when the controls in them don't fit.
- ccd51cc: Add a 43-glyph monochrome icon set to `@weasel-js/ui`.
  
  One register: a 20x20 viewBox drawn in `currentColor` at stroke-width 1.5 with
  round caps and joins, hairline weight reserved for structure, and filled
  regions only where an action has a subject. Covers transport, history, view,
  trial lifecycle, collection, state, instrument and status vocabulary. Import a
  named component (`CloneIcon`), or `Icon` when the glyph is chosen at runtime.
  
  `@weasel-js/ui` also re-exports the tool glyphs that live in `@weasel-js/core`,
  so consumers have one import site for the whole set. `ImageIcon` was reachable
  from core's icons folder but missing from its public barrel; it is exported
  now.
  
  Glyph geometry is generated (`npm run gen:icons`) from `packages/ui/scripts/icons/`
  rather than hand-placed, because arrowheads and joins that miss their terminus
  are invisible at chrome size.
- 1f67cad: Draw labkit's chrome and the ui components from one type, weight and shape
  scale. Sizes fold onto six ranks, so a 12px label now renders at 11 and a 14px
  one at 13; corners fold onto four radii. `Button`'s `sm` and `md` text sizes
  converge as part of that fold — the two still differ in height and padding.
  
  Three components that were exported but rendered nowhere now appear in the
  default chrome: `FpsMeter` and `ScaleIndicator` in the status bar,
  `ZoomControl` in the viewport controls, replacing the plain zoom readout.
  `StatusBar.Section` takes `end` to push a readout to the far side, mirroring
  `Toolbar.Group`.
  
  The trial's box-shadow no longer derives from the foreground color, so
  elevation reads as elevation rather than as a halo on dark themes, and its
  border clears 3:1 against the workspace in both modes.
  
  `<Toolbar>` claims `role="toolbar"` and implements the APG keyboard contract:
  one button in the tab order, arrows moving focus within, Home and End jumping
  to the ends. It takes an `aria-label`.
  
  Two colors were wrong rather than merely untokenized. The selected toggle in
  `PropertyPanel` drew near-black text on an accent fill at 1.49:1 in dark mode;
  it now uses `--wzl-fg-on-accent`. `LayerList`'s checkbox had no `accent-color`
  and rendered in the OS blue.
- c534ff5: Give every control one height, and stop labkit styling weasel-ui by load order
  
  `--wzl-control-h` described itself as the height of a button, input or select
  and claimed 28px, while `Select`, `Input`, `NumberField` and `ComboBox` each
  hard-coded 24px. Nothing enforced the token, so the two numbers had drifted
  apart unnoticed. The four controls read the token now and the token is 24px,
  which is what they already rendered. `ToggleBar` moves off `--wzl-tb-height`
  onto `--wzl-control-h` — a segmented control is a control, not the strip a row
  of them sits in — and its `height` prop writes a private variable so setting it
  cannot cascade into children. `--wzl-tb-height` stays 28px: it sizes a strip
  that *contains* controls, and 24px there would clip the focus ring of a 24px
  control inside it.
  
  In labkit, a class handed to a weasel-ui component through `className` landed
  beside that component's CSS-module class at equal specificity, so whichever
  stylesheet was injected last won. Labkit's element defaults now score (0,0,0)
  so a component always paints its own controls, and deliberate overrides carry a
  `.lk-root` prefix that wins on purpose. That fixes a zoom readout whose field
  had stretched over its own buttons, hiding the leading "10" of "100%".
  
  Also in labkit: `<Lab>`'s nebula backdrop was covered by an opaque shell and had
  never been visible; a trial's config panel was crushed to 60px of a 270px panel
  by its sidebar extras; and the lab header wrapped to three lines because a
  `Select` swallowed the row's slack while the mode toggle compressed past its own
  labels.
  
  `LabProps` gains `footer`, which had no route short of building `LabShell`
  yourself. `LayerCapability.ids` accepts a full `LayerDescriptor` as well as a
  bare string, so a layer can carry a label distinct from its canvas id and be
  marked `alwaysOn` — both already honoured by the layer list, neither
  expressible. Existing `string[]` declarations still typecheck. `Instrument`
  gains a third type parameter for a job's item type, which had been pinned to
  `never`; TypeScript infers all three or none, so a `defineInstrument` call that
  names state and config must name the item type too.
- 69ca8c6: `LayerList` and `LayerStack` now draw the same grip. `DragHandleGlyph` moves to
  `primitives/` and is used by both, replacing the `⋮⋮` text `LayerList` carried.
  It stays out of `@weasel-js/ui`'s icon register on purpose: that register is
  outline strokes at a fixed weight, and a grip is filled dots.
  
  The grip's grab target is padded and the padding cancelled by an equal negative
  margin, so it is comfortable to hit without drawing anything larger than the
  dots or widening the row.
  
  A small `Button`'s label drops to `--wzl-font-size-sm`. It had converged with
  medium's at 13px, which sat top-heavy against a small button's 12px icon and
  20px box.
- d9f110e: Stop every frame loop while nothing can see it
  
  New public hook `useVisibleRaf` in `@weasel-js/core` owns the question of
  whether a frame may run: nothing runs while `document.hidden`, and a loop that
  names an element also stops while that element is outside the viewport. A
  request made while suspended is held rather than dropped and re-armed on
  resume, so a loop never polls visibility or needs restarting by hand.
  
  Ten loops now run behind it — `useFrameLoop`, `useAnimator`, `useSimulation`,
  `useDecayLoop`, `useTextEdit`'s overlay follow, `CursorCoordsHud`'s FPS
  counter, `Badge`'s crawl, and labkit's `FpsMeter`, `useTiledSurface` and
  `useLayerScheduler`. Only `useFrameLoop` consulted `document.hidden` before;
  the rest ran on any page left open. `useLayerScheduler` looked safe and wasn't:
  it paints only dirty layers, but a hidden tab still commits React updates and
  its view/size effect marks every layer dirty.
  
  Loops measuring elapsed time rebase their clock through the new `onResume`
  option, so an hour spent hidden does not arrive as one hour-long frame — an FPS
  meter reporting a rate nobody achieved, a tween jumping to its end value on
  return. `dangerouslyRunWhenHidden` opts a loop out for offscreen recording or
  export; nothing in the tree sets it.
  
  `npm run check:frame-loops` fails the build on a bare `requestAnimationFrame`
  in kit source, and runs in CI.
- 1a0bea3: `useNodeOverlayFrame`: the coordinate frame a DOM overlay pinned to a node needs
  
  Nothing in the kit exported one, so consumers hand-rolled it — their own
  `ResizeObserver` next to the existing `useCanvasSize`, and a translate-and-scale
  inverse built by projecting two points. That inverse silently drops
  `pose.rotation`, which is why on-canvas gradient handles on a rotated node sat
  beside the paint instead of on it.
  
  ```ts
  useNodeOverlayFrame(scene, containerRef, nodeId, { view })
  // → { box, toScreen, toLocal, width, height } | null
  ```
  
  `box` is the node's composed world box, unrotated — the frame `toScreen` maps
  from, and the box to hand `fillInPoseFrame` / `fillToBoundsFrame`. Rotation
  lives in the pose→world leg, where it belongs: a node's stored geometry and its
  bounds-frame paint are pre-rotation by definition, so neither of those two
  changes.
  
  `@weasel-js/ui` gains `SceneGradientHandles`, the scene-aware half of
  `GradientHandles`: it reads the gradient out of a node's `fill` **or** its
  `stroke` — `slot` is a prop — and commits each drag through `setFill` or
  `setStroke` as one undo entry. `GradientHandles` itself stays frame-agnostic.
  
  Also: `isGradientFill` narrows a `FillStyle` to its three gradient members, and
  `useCanvasSize` accepts any `HTMLElement` rather than only a `div`.
- 5f6c28e: An object leaf's fields can be organised into groups
  
  `ToolPrefObject.children` takes a `ToolPrefGroup` as well as a leaf. A group
  heads its fields under a label and contributes nothing to the path — the same
  rule group keys follow at the top level of a schema, so a field inside one is
  still addressed as a field of the object.
  
  Without it, a value with many fields renders as one undifferentiated list. A
  `TextStyle` is the case that needs it: its character and paragraph fields are
  one value but read as two lists.
- 3cd1ee8: A schema leaf can hold an object, with its fields hanging off it
  
  A compound value — a stroke, a shadow, a pattern spec — could be described as
  sibling leaves addressing into it (`data.stroke.width`, `data.stroke.cap`).
  It shouldn't be: each control then writes one field of a value it can only
  half see, and writing a field into something that isn't an object yet corrupts
  it outright.
  
  `ToolPrefObject` describes the value instead. Its `children` are ordinary
  leaves whose paths are relative to the object, and every child edit commits
  the parent object whole. A field that is itself a union declares the kind that
  edits that union — a stroke's `paint` is a `paint` leaf. `fromScalar` lifts a
  value still held in a scalar form before a child edit lands on it, which is
  how a stroke stored as a bare colour string gains a width.
  
  `defaultNodeProperties` describes `data.stroke` this way, so the panel shows
  Color, Width, Cap, Join and Align under one Stroke block, and the separate
  `data.strokeWidth` leaf is gone. `SelectionPanel` now honours `block`, which
  `PrefsForm` already did. The one-off `stroke` pref kind added days ago is
  replaced by this general one.
  
  `dash` has no leaf: it is a `number[]` and no kind edits one. It survives
  import, export and rendering untouched.
- 68d2651: Pref leaf kinds are declared once, and every renderer is exhaustive
  
  `@weasel-js/ui` carried its own copy of the pref-leaf union under a comment
  saying to keep it in sync with core's field-for-field. It had drifted: ui's enum
  leaf had neither `encoding` nor `options[].disabled`, so a dash-array
  preference did not merely fail to select — choosing an option wrote the option
  string over the stored dash array. labkit's two renderers were missing the
  `paint` and `object` kinds outright.
  
  ui's schema is now a rename re-export of core's declaration. The public `Pref*`
  names are unchanged, and there is nothing left to keep in sync.
  
  More importantly, all four renderer switches ended in `default:`, so adding a
  built-in kind produced no error at any site and simply rendered nothing —
  verified by adding one and typechecking. `ToolPrefLeaf` widens `kind` to
  `string` so app-defined prefs can ride the same tree, which means a `never`
  guard cannot sit on it directly. New from core: `TOOL_PREF_KINDS`, a
  `Record<ToolPrefKind, true>` that a new kind fails to compile against first, and
  `isBuiltinToolPref(leaf)`, which narrows to the closed union so each renderer
  can discriminate and end in a `never`. App-defined kinds take the placeholder
  path as before.
  
  Dash-array preferences now select and commit correctly in `PrefsForm`: the enum
  arm threads sibling values, routes through `encoding.read` / `encoding.write`,
  and honors `option.disabled`. `SelectionPanel` already did all of this — it was
  only the forked copy that could not express it.
- 0114abf: Add `PaintInput`, a control that edits a whole `FillStyle`.
  
  A kind bar over a per-kind body, driven by the paint-kind registry rather than
  a fixed list, so a consumer's registered kind appears in the bar and renders
  that entry's `Editor`. `SelectionPanel`'s `paint` leaf renders it in place of
  the chip that showed a gradient as indeterminate and wrote a solid over it on
  first touch — so the checkerboard now means a mixed selection and nothing else,
  and a gradient stroke is editable rather than merely paintable.
  
  Switching kinds keeps a per-kind memory for the control's lifetime, so
  linear -> solid -> linear comes back with its stops instead of the ramp
  `withGradientKind` cannot carry.
  
  `PatternPicker` moves from WeaselDraw into `@weasel-js/ui`, which now depends
  on `@weasel-js/svg` for its tile previews.
  
  The bar offers **None**: "what kind of paint is this?" takes no-paint as an
  answer. `setFill` and `setStroke` accept `paint: null` to write it — a fill
  becomes `null`, and a stroke goes away entirely rather than keeping a width
  that draws no ink. `PaintKindEntry` gains an optional `icon`, and the five
  built-in kinds carry glyphs so six segments fit a property row.
  
  `FILL` and `STROKE` are now peer sections: the `appearance` group goes headless
  and `data.fill` becomes a block leaf. The stroke's paint is no longer paired
  with its width — a whole paint editor cannot share a row with a slider.
- 6a06f6d: Node paint is an object: `data.fill` is a `FillStyle`, `data.stroke` a `Stroke`
  
  Each concept now has exactly one shape. `data.fill` holds a `FillStyle`,
  `data.stroke` a whole `Stroke`, and `null` on either is an explicit "no paint"
  where `undefined` takes the painter's fallback. Two new authoring helpers keep
  hand-written node data short:
  
  ```ts
  data: { path, fill: solid('#7fb069'), stroke: strokeOf('#1c1c1c', 2) }
  ```
  
  **Breaking, with no compatibility path.** A document written against the old
  shapes renders wrong rather than failing, which is accepted:
  
  - `NodeFill = string | FillStyle` and `NodeStroke = string | Stroke` are gone,
    and so are the string branches of `resolveNodeFill` / `resolveNodeStroke`.
    A node holding `fill: '#f00'` now paints the default grey.
  - `data.strokeWidth` is deleted. A stroke's width is `Stroke.width`.
  - `data.color` — the legacy alias `kit:path` and the rect fallback read — is
    deleted. The fallback painter reads `data.fill` like everything else.
  - `fill: 'none'` is now `fill: null`; `stroke: 'none'` is `stroke: null`.
  - `NodeInkResult` is gone: a painter's `ink` returns `NodeInk` and nothing
    else. A painter returning `{ filled, strokeWidth }` no longer type-checks
    and its reach is read as zero.
  - `@weasel-js/ui` drops `isStrokeObject`, which existed only to discriminate
    the union; `strokeColorOf` and `strokeWithColor` lose their string branches.
  - `@weasel-js/svg`'s `strokeDataFromSvg` returns `Stroke | undefined` instead
    of a `{ stroke, strokeWidth }` pair, and stops flattening a plain solid
    stroke into a color. SVG's `fill="none"` imports as `fill: null`.
  
  **A paint's alpha lives in `opacity`, one slot for every paint kind.** That is
  the only slot a gradient or a pattern has, so it is the slot all of them use,
  and the renderer multiplies a hex alpha by it — the two would fight if both
  carried the value. `solid()` therefore moves an alpha channel out of the hex:
  `solid('#ff000080')` is `{ color: '#ff0000', opacity: 0.502 }`.
  
  The four setter actions follow: `setFillOpacity` / `setStrokeOpacity` write
  `opacity` rather than splicing hex, so they now work on a gradient fill, which
  they used to leave untouched. `setFill` / `setStroke` given a `color` recolor
  the node's existing paint through the new `paintWithColor`, keeping its opacity
  unless the picked color states an alpha of its own — and `setStroke` keeps the
  stroke's width, cap, join and dash instead of replacing the whole value.
  
  New exports: `solid`, `strokeOf`, `paintAlpha`, `paintWithAlpha`,
  `paintWithColor`, `DEFAULT_SHAPE_FILL`.
  
  `defaultNodeProperties` moves `data.fill` from a `color` leaf to a `paint` one
  — a color control pointed at a `FillStyle` reads `undefined` off a gradient and
  writes a bare string over it — and the `data.stroke` object leaf drops its
  `fromScalar`, which had nothing left to lift.
- a37ee0b: Separate a text node's content from its typography, and draw depth only where a label marks it
  
  The text schema put `data.text` in a group named Text, so the section read
  TEXT and the row inside it read Text — one word nested in itself — and the
  style groups below it read as fields of the content string rather than as its
  siblings. Content is its own section now, with the field full-width because
  the section already names it.
  
  A group with an empty `name` renders no heading. That already worked for
  sections and is now documented on `ToolPrefGroup`, since it is how a schema
  says "this group organises, it doesn't name": `Character` and `Paragraph`
  carry the labels, and a `Typography` heading over them named nothing new.
  It stays opt-in rather than a rule that rolls up any all-group parent —
  a `Border` over `Top` / `Right` / `Bottom` needs its name.
  
  Rows under a suppressed heading no longer indent. Depth drawn without a
  visible parent put `Character` a level deeper than `Content` while being its
  peer, which is the panel's own tree discipline broken by its own hand.
- f918a87: A property renderer can read the rest of the node, not just its own leaf
  
  `PropertyRenderContext` carried one leaf's aggregated value, so a control whose
  subject spans several fields had no way to see the others. `valueAt(path)`
  returns the same `{ value, mixed }` aggregation for any node path across the
  same selection: a value when every selected node agrees, `mixed` when they
  don't, and an undefined value when nothing carries the path.
  
  WeaselDraw's font picker is the case that asked for it. Its substitution label
  names the variant a family will actually paint in, and it was probing at a
  nominal 400/normal because the node's own `fontWeight` and `fontStyle` were out
  of reach; it now probes at the node's real ones.
- 7a746df: A stroke's dash is edited as a style, not as an array
  
  `Stroke.dash` already rendered, imported and exported; it had no control,
  because a `number[]` has no leaf kind. It doesn't need one — the thing a person
  chooses is a style, and the array is how it is stored. The stroke block gains a
  Solid / Dashed / Dotted / Custom bar under cap, join and align.
  
  `ToolPrefEnum` gains `encoding`: `read`/`write` between the stored value and
  the option string, the counterpart of the `unit` a number leaf already has for
  a value stored in a canonical unit. Both directions are handed the object the
  leaf is a field of, because a dash pattern is meaningless without the width it
  scales by — SVG dash lengths are absolute, so a fixed `[6, 3]` is dots on a
  hairline and a railroad on a 20px stroke. `dashForStrokeStyle` /
  `strokeDashStyleOf` are the mapping, exported: **dashed is 3× the width on and
  2× off, dotted 1× on and 2× off**. An array matching neither reads as `custom`,
  a new `disabled` option — one a control reports but refuses to author, since
  there is no array behind it. `solid` is stored as no dash at all, and an object
  leaf's field written as `undefined` is now removed rather than left holding it.
- 4f19274: Cap, join and align are chosen by glyph, and the stroke block drops its labels
  
  Nine option glyphs and four category glyphs join the icon set. The option
  glyphs are filled silhouettes — the glyph is the ink, so a choice reads as a
  shape rather than as a diagram of one. `align` is a circle zoomed until the
  ink band's far edge leaves the box: `inner` closes into a disc, `outer` into
  the box's complement of it, and `center` is the annulus straddling the path,
  so the three are one band at three offsets. The categories are the bare path
  each row treats, drawn in the outlined register.
  
  A schema carries a glyph *id*, not a component: `ToolPrefEnum`'s options gain
  `icon`, and every leaf gains one for rows whose own label is spent on a
  `pair`. Core ships no icon set and cannot depend on one, so the field is a
  plain string; weasel-ui resolves it against `ICON_PATHS` and falls back to
  `short` where it names no glyph.
  
  `SelectionPanel` now honours `block` inside an object leaf, not only at the
  section level. A row whose fields are all `block` drops the 64px label column
  and spans the block. The default stroke schema uses both: paint and width
  share one label-less row, and cap/join/align share the next.
  
  `align`'s options run inner, center, outer — the order the ink moves outward.
- 07fd2de: `setStroke` takes a whole paint, so a gradient or pattern stroke is writable.
  
  It accepted `{ color }` only, and merged through `paintWithColor`, which
  supersedes a non-solid paint with a solid one — a gradient stroke was
  unreachable even though `setStrokeOpacity` could already reach its alpha.
  `paint` now wins over `color`, a color arriving later in the gesture supersedes
  an earlier paint, and the stroke's width, cap, join, dash and align survive
  either. New `strokeWith(paint, width?)` is `strokeOf`'s sibling for a paint
  that has no color to pass.
  
  Two fixes alongside it: `setFill` started with no `color` and no `paint` seeded
  from `DEFAULT_STROKE_COLOR`, painting the selection black where
  `setFillOpacity` seeds the same slot from `DEFAULT_FILL_COLOR`; and
  `gradientForBounds`'s doc comment claimed a corner-to-corner linear gradient
  where the body builds a left-edge-to-right-edge one.
  
  `@weasel-js/ui` no longer exports `strokeWithColor`. It shared a name with
  core's and disagreed with it — core's keeps the paint's opacity, ui's dropped
  it — and nothing imported it.
- 81213fc: Edit a node's stroke as the union it is
  
  `data.stroke` holds `string | Stroke`, and the schema described it with a
  `color` leaf — which reads `undefined` off the object form, shows its own
  default, and writes a bare hex back over the stroke's width, cap, join and
  dash on the first edit. The same trap `ToolPrefPaint` was introduced to avoid
  for `FillStyle`.
  
  A `stroke` pref kind now describes it, and `defaultNodeProperties` uses it.
  Its control shows whichever color the value has — the string itself, or a
  solid paint's color — gives a gradient stroke the indeterminate chip rather
  than claiming a color it doesn't have, and preserves the form on write.
  
  `PrefsForm` gained the `stroke` case and the `paint` case it never had; a
  `paint` leaf used to render as the literal text `(paint: no renderer)`.
  `solidColorOf`, `strokeColorOf`, `strokeWithColor` and `isStrokeObject` are
  exported from `@weasel-js/ui` for consumers writing their own property
  renderers against either union.
  
  Cap, join and dash are not editable from a panel yet, and `data.strokeWidth`
  remains its own leaf — see `docs/proposals/2026-08-26-node-stroke-union.md`
  for why that waits on the SVG mapping.
- 2b86e00: A text node's style is one value, not ten sibling paths
  
  `data.style.fontSize`, `.fontWeight`, `.align` and the rest addressed into one
  `TextStyle` from ten independent leaves, each control writing a field of a
  value it could only half see. `data.style` is an object leaf now, with
  Character and Paragraph as groups inside it — groups head their fields and
  contribute nothing to the path, so a field is still a field of the style and
  one commit writes the whole thing.
  
  An object leaf whose fields are entirely grouped no longer prints its own
  heading, which would stack straight onto the first group's, and a group's
  fields sit under a rule so the nesting reads. WeaselDraw's inspector descends
  into an object leaf when listing what a kind exposes — the fields are the
  editable surface; the leaf is the container.
  
  `SelectionPanel` has a story now, which is how the two layout defects above
  were found.
- Updated dependencies [52c7b2a]
- Updated dependencies [3386d64]
- Updated dependencies [ffafb7d]
- Updated dependencies [ba8b139]
- Updated dependencies [3fb3a46]
- Updated dependencies [67bcb05]
- Updated dependencies [47cbb08]
- Updated dependencies [f43e9c2]
- Updated dependencies [bb27e83]
- Updated dependencies [6a33c3f]
- Updated dependencies [c24e7de]
- Updated dependencies [ce82f4a]
- Updated dependencies [be697dc]
- Updated dependencies [e909a3b]
- Updated dependencies [26bbdcf]
- Updated dependencies [546f67d]
- Updated dependencies [3fb3a46]
- Updated dependencies [ccd51cc]
- Updated dependencies [3fb3a46]
- Updated dependencies [d9f110e]
- Updated dependencies [0dd35a1]
- Updated dependencies [1a0bea3]
- Updated dependencies [9d95836]
- Updated dependencies [62a3c46]
- Updated dependencies [5f6c28e]
- Updated dependencies [3cd1ee8]
- Updated dependencies [2ea772f]
- Updated dependencies [f77bd95]
- Updated dependencies [2ea772f]
- Updated dependencies [aba8d91]
- Updated dependencies [2ea772f]
- Updated dependencies [3386d64]
- Updated dependencies [68d2651]
- Updated dependencies [3386d64]
- Updated dependencies [c6c499d]
- Updated dependencies [4f1ef0b]
- Updated dependencies [0114abf]
- Updated dependencies [50bc909]
- Updated dependencies [6a06f6d]
- Updated dependencies [a37ee0b]
- Updated dependencies [611b30e]
- Updated dependencies [9ad8cb2]
- Updated dependencies [c1b8511]
- Updated dependencies [d793d3c]
- Updated dependencies [3386d64]
- Updated dependencies [ce2b5c7]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
- Updated dependencies [20097e6]
- Updated dependencies [84db1f6]
- Updated dependencies [3386d64]
- Updated dependencies [7a746df]
- Updated dependencies [4f19274]
- Updated dependencies [94f2446]
- Updated dependencies [07fd2de]
- Updated dependencies [81213fc]
- Updated dependencies [2f225d7]
- Updated dependencies [2b2d971]
- Updated dependencies [00c5203]
- Updated dependencies [68069dc]
- Updated dependencies [5d0ff9c]
- Updated dependencies [c1b8511]
- Updated dependencies [546f67d]
- Updated dependencies [c2ffa49]
- Updated dependencies [4c097ef]
- Updated dependencies [2b86e00]
- Updated dependencies [d933a89]
- Updated dependencies [bca99e3]
- Updated dependencies [5923c8b]
- Updated dependencies [2ea772f]
- Updated dependencies [2ea772f]
- Updated dependencies [3fb3a46]
  - @weasel-js/core@1.3.0
  - @weasel-js/svg@1.3.0
  - @weasel-js/modes@1.3.0

## 1.2.0

### Patch Changes

- 2627cde: Fix a hook-order defect in the Badge effects and several stale-closure bugs,
  found by turning on a correctness lint baseline.

  Six Badge effects (`Aqua`, `Bevel`, `Bevel2`, `Metal`, `Sheen`, `Woodgrain`)
  called `useId` after an early return keyed on `variant`. Changing a `<Badge>`'s
  variant to one those effects don't render, and back, remounted the component
  and issued fresh ids — so the `<clipPath>` and gradient ids their `url(#…)`
  references point at changed identity mid-life.

  Also fixed: `Canvas.tsx`'s paint effect read a stale `helpersForLayers` through
  its closure rather than the ref the file maintains, and `useDeviceProfile`
  ignored a `targetScale` supplied by a provider.

  `composeOrderedLayers` is now generic over the `LayersMap` it receives instead
  of taking `any`; inference at existing call sites is unchanged.

  - @weasel-js/modes@1.2.0

## 1.1.0

### Patch Changes

- a19cf56: `Slider` gains `stops`: detents a drag catches on.

  `stops?: number[]` are attractors, not quantization. A drag that comes within
  8 track pixels of a stop lands on it; the arrow keys move stop to stop
  (shift-arrow and Page jump ten), and a thumb added by clicking the track snaps
  the same way. `step` is unchanged and still quantizes the values between
  stops, so the two compose. Home and End keep going to the bounds, and per-thumb
  `bounds` still clamps a snapped value.

  Stops outside `[min, max]` are ignored rather than clamped inward — a stop that
  cannot be reached is a mistake worth leaving visible in the value, not one to
  paper over at an endpoint.

  - @weasel-js/modes@1.1.0

## 1.0.4

### Patch Changes

- 27b8e69: Correctness and keyboard fixes across `@weasel-js/ui` and `@weasel-js/hud`

  `Select` and `ComboBox` converted a controlled `selectedKey={null}` to
  `undefined`, which is React Aria's signal for _uncontrolled_. Clearing a
  selection therefore left the old value on screen and logged a
  controlled-to-uncontrolled warning. `SelectionPanel` hits this on every mixed
  enum property. Both now pass `null` through.

  `DataGrid`'s reorder hook measured rows against the wrapper `<div>`, whose only
  child is the `<table>`, so every drop reported the same index. The ref moves to
  `<tbody>`. Sortable headers become real buttons carrying `aria-sort`, and the
  drop indicator is a class on the target row rather than a hard-coded 28px
  offset.

  `useReorderDragList` treated the first locked row as a ceiling for the whole
  list, so a row _below_ a locked one could be dropped above it. A drop is now
  clamped to the run between the nearest locked rows either side of the grabbed
  row, and a multi-selection drops the members that sit past the wall.

  `Slider` ignored `constraint: 'ordered'` on the keyboard path — End sent a
  thumb straight past its neighbor. It also left its `document` listeners
  attached after `pointercancel` and after unmounting mid-drag, so a thumb kept
  tracking a released pointer, and a press did not focus the thumb the arrow keys
  are bound to.

  `BandEditor` had the same drag-teardown gap. Its `x` / `Delete` merge fired
  from anything inside a band — including typing `x` in a consumer's input and
  pressing Cmd+X — and its seams ignored Home/End.

  `GradientHandles` committed the mount-time handle position when a handle was
  clicked without moving, and committed the abandoned position on
  `pointercancel`. A press that never moves now writes nothing, a cancel restores
  the live preview, and the handles respond to the arrow keys. Their `role`
  drops from `slider`, which requires an `aria-valuenow` a 2-D position does not
  have, to `button`.

  `CurveEditor`'s `endpoints="pinned-both"` snapped an endpoint to the range
  corner on the first drag instead of holding it still.

  Every overlay the package renders into a portal — `ComboBox`, `Callout`,
  `Tooltip`, `Dialog`, alongside the `Select` popover that already did — carries
  `data-weasel-overlay`, the marker consumers use to ask whether focus left their
  component.

  In `@weasel-js/hud`: detaching left the hovered widget believing the pointer
  was still over it, and `hovermove` fired only on entry, so its `x`/`y` froze
  for the rest of the hover. The six widget factories ignored the detached-HUD
  guard `add()` enforces. `Widget` gains an optional `disposed` flag, which lets
  a loupe whose window is removed through the HUD stop reading pixels back and
  release its listener; `aimAt` after `dispose` is now a no-op.

  - @weasel-js/modes@1.0.4

## 1.0.3

### Patch Changes

- 3641641: New component: `BandEditor` divides a numeric axis into contiguous bands and
  lets you drag the seams between them. Each band carries a payload the consumer
  supplies and renders through `renderBand`, so the control never learns what a
  band means.

  The axis is always fully covered — N bands, N−1 interior seams, no gaps and no
  overlaps — which makes editing a partition the same thing as editing a sorted
  seam list. Seams clamp at their neighbours instead of crossing, so no drag can
  destroy a band: removal is only ever the explicit merge (`x` / `Delete`, into
  the left neighbour, whose payload survives). The first band's left edge is
  `min` and does not move, and it has no left neighbour to merge into, so a
  partition always keeps at least one part.

  `scale` takes `'linear'`, `'log'` or a `BandScale` of your own, and defaults to
  `'log'` because the interesting part of a width axis is usually its narrow end.
  A log scale needs `min > 0`; given anything else the component falls back to
  linear and warns once in development rather than positioning every seam at
  `NaN`.

  `onInput` fires live during a drag and `onChange` once per committed gesture,
  following `GradientHandles`. `Slider` uses the opposite sense (`onChange` live,
  `onCommit` committed) — a known inconsistency in this package that this change
  deliberately leaves alone.

  Nothing existing changed. The added exports are `BandEditor`, `BandEditorProps`,
  `Band`, `BandScale`, `linearScale` and `logScale`.

- 51aae33: Document every public export of `@weasel-js/ui` with a JSDoc string at its
  definition site, so editor hover and the generated API reference say what each
  component, prop bag and helper is for.

  No behavior, names or exports changed. Where a component's live-versus-committed
  callback pair is spelled differently from its neighbors' — `Slider`'s
  `onChange`/`onCommit` against `GradientEditor`'s `onInput`/`onChange` — the
  docstring records which sense that component uses rather than smoothing it over.

- 917359a: `@weasel-js/ui` now spells the live/committed callback pair one way, on every
  control that has both: **`onInput` fires continuously through a gesture, and
  `onChange` fires once when it commits.**

  Four components move to it. `ColorField`, `GradientEditor` and
  `GradientHandles` already used this sense and are unchanged.

  | Component      | was (live / committed)        | now                    |
  | -------------- | ----------------------------- | ---------------------- |
  | `Slider`       | `onChange` / `onCommit`       | `onInput` / `onChange` |
  | `ResizeHandle` | `onChange` / `onChangeEnd`    | `onInput` / `onChange` |
  | `CurveEditor`  | `onChange` / `onChangeCommit` | `onInput` / `onChange` |
  | `PointPlotter` | `onChange` / `onChangeCommit` | `onInput` / `onChange` |

  Four spellings had grown up, and two of them disagreed about what `onChange`
  meant — so a reader who learned `Slider` guessed `ColorField` backwards. The
  surviving pair is the DOM's own: `input` fires while you type or drag, `change`
  when the edit is done. It also means a single-callback control like `ToggleBar`
  keeps `onChange` with commit semantics intact.

  **Migrating is a rename, but `onChange` still compiles while meaning something
  new, so read this before running a codemod.** On the four components above,
  `onChange` used to be the live callback and is now the committed one. Passing a
  live handler to `onChange` type-checks and then only fires on release. The
  committed names (`onCommit`, `onChangeEnd`, `onChangeCommit`) are gone, so those
  fail loudly; the live rename is the one to do by hand.

  Behavior is unchanged, including which callback is required: these four are
  fully controlled, so `onInput` is required (without it the control freezes
  mid-drag) and `onChange` is optional. `ColorField` and `GradientEditor` buffer
  internally and keep the opposite. Required-ness follows the control's state
  model, not the naming.

  `CurveEditor`'s layer-gesture `onCommit(state, ctx)` is a different protocol and
  is untouched.

- Updated dependencies [514c34a]
  - @weasel-js/modes@1.0.3

## 1.0.2

### Patch Changes

- 9639d92: `ActionsBar` and `OptionsBar` now share one stylesheet,
  `components/segmentedControl.module.css`, instead of keeping byte-identical
  188-line copies each. The two look the same and differ only in what a segment
  does, so the styles had two places to stay in sync and no mechanism keeping
  them there.

  No visual or API change: same rules, same class names, same generated output.
  The merged stylesheet is the same size either way — identical content already
  collapsed to a single scoped hash — so this buys maintainability, not payload.

  `ToggleBar` keeps its own copy. It carries the same base plus a `segmentMixed`
  third state and a deliberately different `variant_minimal`, and folding those
  together needs a decision about whether the three bars are one component.

- 5fea43d: Five unrelated small fixes.

  A tapered stroke with `align: 'inner'` or `'outer'` on a polygon path painted
  at half its requested widths. That alignment renders by tessellating at twice
  the width and stencilling half away, and the doubling reached `stroke.width`
  but not `vertexWidths`. The doubled array is memoized per source array, since
  the ribbon cache compares it by reference.

  An image insert previews the decoded bitmap inside the drag bounds instead of
  committing on release with no preview at all. It falls back to the bare
  outline until the image decodes, and `useImageTool({ preview: 'outline' })`
  opts out of the bitmap entirely.

  A HUD widget that claims the pointer reports a `'pointer'` cursor without
  implementing anything — hovering one while a drawing tool was active used to
  keep showing that tool's cursor. The rule is keyed on the `claims` every
  widget already declares, so it covers consumer-authored widgets too;
  decoration claims nothing and the hit walk descends past it. A widget's own
  `cursorAt` still wins, and `button` takes a `cursor` option that feeds it.

  `composeAffordanceLayer`'s `hitTest` returns a `LayerHit`, carrying the hit
  region's declared cursor and claim instead of dropping them. `AffordanceRegion`
  gains optional `strength` / `claimedKinds` to declare that claim.

  `ToolPalette` uses the shared `useRovingTabIndex` rather than its own container
  handler, so arrow keys skip tools that are ineligible in the current mode and
  the tab stop no longer sits on one. `ToolButton` takes an `onKeyDown`.

  - @weasel-js/modes@1.0.2

## 1.0.1

### Patch Changes

- 75e15ca: `useRovingTabIndex` — the arrow-key focus behavior `ActionsBar`, `OptionsBar`,
  and `ToggleBar` each implemented separately, now one hook they share (and one
  `@weasel-js/ui` exports, re-exported through `@weasel-js/labkit/weasel-ui`).
  It handles the tab stop, arrow/Home/End navigation with disabled items skipped
  and wrap-around at both ends, and optional selection-follows-focus for
  radiogroup-style bars. Its docs say when a bar should _not_ use it: a
  container of arbitrary compound controls has to leave the arrow keys to those
  controls, which is why `ToolOptionsBar` still doesn't have one.

  No keyboard behavior changed in any of the three bars.

  - @weasel-js/modes@1.0.1

## 1.0.0

### Minor Changes

- 9ed1139: Gradient fills that stay attached to their shape, and an editor for them.

  Gradient geometry was interpreted in screen space: `draw.ts` set the shader's
  `u_worldInv` to the identity matrix, with a comment saying a later step would
  wire the real view inverse. Nothing did. Every gradient therefore slid across
  its own geometry under pan and zoom, which is why the gradient demo shipped
  with pan and zoom disabled. Fine for a viewport-fixed wash, useless for a
  paint on a shape.

  Gradient paints now carry `units`, mirroring SVG's `gradientUnits`:

  - `'bounds'` — fractions of the painted node's box, `0..1` per axis (SVG
    `objectBoundingBox`). Resolved by the node painter, so the paint follows the
    node through moves, resizes and rotation.
  - `'local'` — the frame the geometry was handed to the renderer in.
  - `'world'` — scene coordinates; the paint holds still while geometry moves
    through it (SVG `userSpaceOnUse`).
  - `'screen'` — surface pixels, and the default, so every existing gradient
    keeps the behavior it had. WeaselDraw's workspace tint wants exactly this.

  `WeaselRenderer.render` takes an optional view matrix for `'world'`, and falls
  back to screen space without one. `fillInPoseFrame` resolves `'bounds'` against
  a box and `fillToBoundsFrame` inverts it; `mat3.invert` is new alongside them.
  Supporting helpers: `sampleGradientStops`, `withGradientKind`,
  `gradientGeometry`, `gradientForBounds`.

  `setFill` takes a whole `paint` as well as a `color`, so a gradient edit is one
  undo entry like any color edit. A `color` no longer tries to inherit alpha from
  a fill that is a gradient.

  New in `@weasel-js/ui`: `<GradientEditor>` (kind switch, stop strip, per-stop
  color) and `<GradientHandles>` (on-canvas endpoint / center / radius / angle
  handles, positioned through consumer-supplied `toScreen` / `toLocal` so it
  needs no view or scene of its own). Both split live `onInput` from committed
  `onChange`.

  Converting between kinds is lossy in ways the data makes unavoidable: a radial
  gradient stores no angle, so a round trip through one leaves the segment
  horizontal, and a conic stores no radius, so a round trip through one resets
  the segment's length.

  `'bounds'` is not a frame you can do polar math in: `x` and `y` are fractions
  of two different lengths, so a circle in it is an ellipse on screen.
  `<GradientHandles>` therefore takes a gradient already resolved by
  `fillInPoseFrame`, and consumers convert edits back with `fillToBoundsFrame`.

### Patch Changes

- 6855465: Themes are values you can define, extend, and apply.

  `defineTheme` / `resolveTheme` / `applyTheme` / `loadDTCG`, plus a React
  binding at `@weasel-js/theme/react`. A theme extends the built-in one by
  default, so a partial theme can't be incomplete; overriding a primitive
  rebases every alias that references it. `applyTheme` stamps data attributes
  and adopts a rule block rather than writing inline properties, so the cascade
  still does the work and per-subtree overrides are just a different theme name.

  The WebGL HUD no longer reads CSS custom properties through
  `getComputedStyle`. It receives the same resolved record the stylesheet was
  built from, which also makes headless rendering themeable for the first time.
  `readTokens` and `ResolvedTokens` are gone from `@weasel-js/hud`; use
  `ResolvedTheme` and pass a theme to `attach`.

  The sixteen deprecated `--wzl-*` aliases are removed (264 call sites migrated).
  Three were never aliases and became real semantics: `--wzl-fg-inverse`,
  `--wzl-surface-hover`, `--wzl-surface-pressed`.

- Updated dependencies [43482ce]
  - @weasel-js/modes@1.0.0

## 0.8.0

### Patch Changes

- @weasel-js/modes@0.8.0

## 0.7.2

### Patch Changes

- 8bc719a: Every package now declares `engines.node: ">=22"`, up from `">=20"`. Node 20
  reached end of life on 2026-04-30, so the old floor advertised support for a
  runtime that no longer receives security patches — a claim in each published
  tarball that had quietly stopped being true. `@weasel-js/labkit` had no `engines`
  field at all and now matches its siblings.

  Nothing in the kit required a Node 20 feature, so this changes what is promised
  rather than what runs. CI tests both ends of the range: the 22 floor and the 24
  Active LTS the release and docs workflows build on.

- Updated dependencies [8bc719a]
  - @weasel-js/modes@0.7.2

## 0.7.1

### Patch Changes

- d22624c: `Select` rows now carry a `textValue`, derived from a string label or the
  new per-option `textValue` for labels built from elements. Every row draws a
  check mark beside its label, so React Aria could never read a string off the
  children — it warned once per row on every open, and type-to-select did
  nothing.
- 6af4806: `@weasel-js/font` gains `listCanvasFonts()`, the enumeration companion to
  `isCanvasFont`. Families served by the dynamic canvas-SDF tier could only be
  queried one at a time, so a font picker had no way to offer them without
  hard-coding a list beside the `registerCanvasFont` calls. Reports service
  rather than membership, matching `isCanvasFont`: an auto-enrolled family
  appears only while the `'canvas'` fallback policy is in force.

  `@weasel-js/ui`'s `Select` marks its portalled popover with
  `data-weasel-overlay`. A consumer asking "did focus leave my component?" via
  `closest()` gets the wrong answer for portalled DOM — a text editor whose
  font menu is a `Select` ended its edit session the moment the menu was
  clicked, discarding the style patch that click was making.

- 6df0f1e: Add `StatusBar` (with `StatusBarItem` / `StatusBarSpacer`) and `ResizeHandle`
  — the two pieces of editor shell that every app was otherwise rebuilding.
  `ResizeHandle` is the window-splitter pattern: pointer drag or arrow keys,
  `role="separator"` with a live value range, snapping to a `step` grid so
  fractional pointer coordinates don't leak into persisted layouts. Both are
  layout-agnostic; the consumer still owns the shell.
  - @weasel-js/modes@0.7.1

## 0.7.0

### Minor Changes

- e7d71c9: Text properties: node-level typography through the schema-driven panel, and
  caret-range styling through a new tool options bar.

  `TextStyle` and `StyledRun` gain `letterSpacing`, `underline`, and
  `strikethrough`, with GL rendering, DOM-overlay, and SVG round-trips for all
  three. `styleAtRange` / `applyStyleToRange` expose the run algebra publicly,
  and `useTextEdit` gains `selection`, `rangeStyle`, and
  `applyStyleToSelection`. Text nodes get Character and Paragraph schema
  groups. New `ToolOptionsBar` component; `ToggleBar` renders indeterminate
  segments via `mixedValues`.

  Behavior changes worth knowing about:

  - **`SelectionPanel` reads and writes node paths of any depth** (two or more
    segments). It previously split at the first dot and read exactly one level,
    so `data.style.fontSize` resolved to `data['style.fontSize']`.
  - **The default `kit:text` painter paints a node's `runs`** when it has them,
    instead of re-flattening `data.text`. Run styling was previously invisible
    to anything drawn by the default scene layer.
  - **`useTextEdit` no longer commits when focus moves into editing chrome**
    (`isEditorChrome`), and commits on a pointerdown outside both the overlay
    and that chrome. Its published `selection` survives focus leaving the
    overlay — it clears on `startEdit` and when the edit ends. Without this a
    character bar could not exist: clicking its controls ended the edit they
    were there to change.
  - **The edit overlay can scale with the view** (`TextEditScreenPose.zoom`),
    keeping every metric on it — including run-level `fontSize` and
    `letterSpacing` — in world units. Omitting `zoom` keeps the old
    screen-pixel contract.
  - **The canvas-2D measurement path counts tracking**, as the GL path already
    did, so wrap points, `caretIndexAt`, and `fitTextPose` agree on tracked
    text. This moves wrap points on any text with a non-zero `letterSpacing`.
  - **The text tool enters edit on the box it inserts.**

  Breaking-ish, in packages that have not been published with these paths:

  - `splitNodePath` is removed from `@weasel-js/ui`'s public API — it was dead
    and encoded the superseded one-level path model. `nodeValueAt` and
    `setAtPath` are exported in its place.
  - A text node's color leaf is now `data.style.fill` of the new `paint` kind
    rather than `data.style.fill.color` of the `color` kind. `TextStyle.fill`
    is a tagged union, so the old leaf read `undefined` off a gradient and
    wrote a hybrid the renderer painted flat solid.

### Patch Changes

- @weasel-js/modes@0.7.0

## 0.6.0

### Minor Changes

- Add `./components/*` subpath exports, so a consumer can import one component
  instead of the whole barrel:

  ```ts
  import { ToolPalette } from "@weasel-js/ui/components/ToolPalette";
  import { ToastRegion, toast } from "@weasel-js/ui/components/Toast";
  ```

  This needed a build change, not just an `exports` entry: the package built as a
  single `dist/index.js`, so there was nothing for a subpath to point at. The Vite
  build now emits one entry per component directory, keyed to mirror the source
  tree — which is also where `tsc --emitDeclarationOnly` already put the matching
  `index.d.ts`, so a single `*` wildcard lines up the JS and the types, and a
  component added later is reachable with no further change.

  Code shared between entries is hoisted into `dist/chunks/` rather than copied
  into each, so module-level state stays single: importing the barrel and a
  subpath in the same app yields one `defaultToastQueue`, not two.

### Patch Changes

- @weasel-js/modes@0.6.0

## 0.5.1

### Patch Changes

- 5a741be: Ship the TypeScript declarations that `ui` and `hud` already advertised.

  `@weasel-js/ui@0.5.0` and `@weasel-js/hud@0.5.0` were published with no `.d.ts`
  files at all, while their `exports` maps pointed `types` at `./dist/index.d.ts`.
  Consumers got an implicitly-`any` module.

  Both packages build as `vite build && tsc -p tsconfig.build.json`. Vite's
  `emptyOutDir` deletes the declarations the previous run emitted, but tsc's
  `--incremental` state (inherited from the repo root) still recorded them as
  emitted, and plain `--incremental` compares input signatures without checking
  whether the outputs are still on disk. So every build after the first emitted
  nothing and exited 0. A cold CI checkout only ever builds once, which is why
  this never went red. Their declaration builds are no longer incremental.

  Two gates now cover the class rather than the instance: `npm run check:manifests`
  refuses to publish a package whose `exports`/`types` map names a file that
  `npm pack` would not include, and the consumer smoke test type-imports both
  packages so a missing declaration surfaces as TS7016.

  - @weasel-js/modes@0.5.1

## 0.5.0

### Patch Changes

- @weasel-js/modes@0.5.0
