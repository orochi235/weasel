# @weasel-js/text-dom

## 1.19.1

### Patch Changes

- fa19170: On a Mac, a text edit styles on Cmd+B, Cmd+I and Cmd+U only. Ctrl+B and the rest do what a Mac text field does, so Ctrl+B moves back a character.
  
  <!-- entry: fix -->
- 2f6b0e9: The text edit overlay draws small caps from the face's own small capitals wherever the canvas does.
  
  <!-- entry: rank=0 fix visual -->
- 27eabf7: A text edit opening also waits out `fontHold` for the bold and italic faces its runs use in the node's own family, not only the node's face.
  
  <!-- entry: rank=-5 fix -->
- 1d5783f: A text edit takes focus back from a checkbox or slider in its chrome after styling, as from a button.
  
  Only a field the user types text into keeps focus and the selection.
  
  <!-- entry: fix behavior -->
- b08cf36: Undo and Redo inside a text edit take back a restyle, a paste, or anything typed, and put the selection back where it was.
  
  Mod+Z, Shift+Mod+Z and Mod+Y step a history the edit keeps itself; the edit's `commit` still writes the result as one change.
  
  <!-- entry: rank=10 fix -->
- 12a862d: Bold, italic, underline and strikethrough shortcuts in a text edit work on a non-Latin keyboard layout, read by the letter the key bears.
  
  <!-- entry: fix -->
- Updated dependencies [5159b4f]
- Updated dependencies [08dd689]
- Updated dependencies [58309aa]
- Updated dependencies [5159b4f]
- Updated dependencies [55b0f04]
- Updated dependencies [72e6d28]
- Updated dependencies [8cd600b]
- Updated dependencies [2f6b0e9]
- Updated dependencies [1691dec]
- Updated dependencies [b62d643]
- Updated dependencies [ce1f1a7]
- Updated dependencies [87bf0a8]
- Updated dependencies [8725f6c]
- Updated dependencies [d5593b2]
- Updated dependencies [1da0762]
- Updated dependencies [9f44d6d]
- Updated dependencies [d11f1df]
- Updated dependencies [bce70ba]
- Updated dependencies [d40d869]
- Updated dependencies [250c105]
- Updated dependencies [a09ed24]
- Updated dependencies [8562ebe]
- Updated dependencies [72e6d28]
- Updated dependencies [2c3416d]
  - @weasel-js/ui-input@1.19.1
  - @weasel-js/font@1.19.1
  - @weasel-js/gestures@1.19.1
  - @weasel-js/text@1.19.1
  - @weasel-js/paint@1.19.1
  - @weasel-js/react@1.19.1

## 1.19.0

### Patch Changes

- d13b757: Styling armed at a collapsed caret can take styling off: Cmd+B at the end of a bold word types the next character without bold.
  
  The same goes for Cmd+Shift+- at the end of a subscript or a panel clearing a size there, and `effectiveStyle` shows it off. `pendingStyle` may now hold a key as `false` or `undefined`, meaning the next character takes it off.
  
  <!-- entry: fix api -->
- b1309b2: An armed bold or weight lands as a direct write would.
  
  Bold armed after a light `fontWeight` run drops the weight, and a weight armed after bold drops the flag.
  
  <!-- entry: rank=-5 fix -->
- 356d4ec: Typing at the start of a line held by a hard break other than a line feed, such as U+2028 or a form feed, keeps that break as it was.
  
  <!-- entry: rank=-5 fix -->
- 45e74c7: A run's `fontScale` passes through the edit overlay unchanged, so `0.07` stays `0.07`.
  
  <!-- entry: rank=-5 fix -->
- e2f8e0e: The edit overlay's `text-align` holds under css-text-4, where `text-align` is a shorthand that resets `text-align-last`.
  
  <!-- entry: rank=-5 fix -->
- 2c2d663: Editing a text node keeps all the styling its runs held.
  
  The overlay keeps a run's `fontScale` beside an absolute `fontSize`, its `bold` beside its own `fontWeight`, and a solid fill's color exactly as written, even one the browser cannot parse. Each is held in an attribute on the run's span and read back as written.
  
  <!-- entry: fix -->
- a69a38c: A character typed in the edit overlay takes the styling `rangeStyle` reports at the caret, so a word typed after Cmd+B is bold throughout.
  
  Pressing the shortcut again ends it. A caret between two run spans types in the style of the run before it.
  
  <!-- entry: fix -->
- 0866208: A text node with `overflow: 'clip'`, such as a sticky note, scrolls its text inside its box while it is edited.
  
  The wheel scrolls it, and a caret moved out of view by the arrow keys, typing, a click or select-all brings it back. The box, and the paper the canvas paints there, stays put. The edit opens scrolled to where `verticalAlign` puts the text on the canvas, so a bottom-aligned note opens on its last line, and the scroll ends with the edit. `TextEditScreenPose.clip` asks for this, so any `useTextEdit` host gets it.
  
  <!-- entry: new api -->
- Updated dependencies [93ed93d]
- Updated dependencies [65ee9a0]
- Updated dependencies [3932826]
- Updated dependencies [2595ad3]
- Updated dependencies [a5c9cf0]
- Updated dependencies [0717d38]
- Updated dependencies [0dd9f6e]
- Updated dependencies [88147f8]
- Updated dependencies [e97950f]
- Updated dependencies [874d96f]
- Updated dependencies [1b65290]
- Updated dependencies [309adac]
- Updated dependencies [0a8d096]
- Updated dependencies [4355423]
- Updated dependencies [9ce04e0]
- Updated dependencies [5bd979f]
- Updated dependencies [ca98945]
- Updated dependencies [b0e09ef]
- Updated dependencies [9975edb]
- Updated dependencies [88b4697]
- Updated dependencies [433a5ad]
- Updated dependencies [c913ef0]
- Updated dependencies [337b676]
- Updated dependencies [c2465cd]
- Updated dependencies [458e1c2]
- Updated dependencies [dd13518]
- Updated dependencies [b62813d]
- Updated dependencies [f68d93b]
- Updated dependencies [6321d2a]
- Updated dependencies [b1309b2]
- Updated dependencies [20c4979]
- Updated dependencies [3bedaa8]
- Updated dependencies [c3dc307]
- Updated dependencies [44aa42f]
- Updated dependencies [a612a95]
- Updated dependencies [2a9727c]
- Updated dependencies [521bc15]
- Updated dependencies [997e4f3]
- Updated dependencies [4224853]
- Updated dependencies [4e6aad8]
- Updated dependencies [01b996e]
- Updated dependencies [10199c0]
- Updated dependencies [644c5c7]
- Updated dependencies [521cab5]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [8936d41]
- Updated dependencies [7b56e88]
- Updated dependencies [279a193]
- Updated dependencies [521cab5]
- Updated dependencies [76da952]
- Updated dependencies [228d835]
- Updated dependencies [521cab5]
- Updated dependencies [e198aad]
- Updated dependencies [7dd964d]
- Updated dependencies [6999cce]
- Updated dependencies [4d16c8a]
  - @weasel-js/ui-input@1.19.0
  - @weasel-js/text@1.19.0
  - @weasel-js/font@1.19.0
  - @weasel-js/paint@1.19.0
  - @weasel-js/react@1.19.0

## 1.18.2

### Patch Changes

- 348fb68: Fixes to pasted tables, hatch pattern tiles and the dither protect texture.
  
  - A paste of an HTML table drops the white space a cell opens with, as a browser collapses it, so pretty-printed markup (`<td>\n  b\n</td>`) pastes as `a⇥b` instead of `a⇥ b`.
  - A `hatch` tile runs its diagonals and corner stubs far enough past the tile to cover a line wider than about 2.8 units, so a thick hatch no longer shows notches where the tiles meet. The SVG export draws the same tiles.
  - `protectTexture` makes a texture for a grid of no dots instead of throwing from `ImageData`; `dither` reads it as no protect mask.
- fc38c90: Fixes to pattern tiles, text bounds, markdown layout and pasted tables, and the image cache closes the bitmaps it drops.
  
  - A `chunks` tile whose `chunkSize` is zero, negative or NaN, or whose `density` is infinite, scatters no chunks. Before, a zero size looped forever building the tile and hung the page, and a negative one threw from the canvas. A `dots` tile with a negative or NaN `radius` draws no dot rather than throwing.
  - A text command's painted bounds reach each glyph's pen step as well as its advance, so a retained group no longer cuts off the end of an underline, strikethrough or overline that letter spacing carries past the last letter.
  - `layoutMarkdown` measures its width without spreading every line into one call, which overflowed the stack on a text of a million lines or so.
  - A pasted table row keeps a tab for each empty cell before a cell with text, so `a`, an empty cell and `b` paste as `a\t\tb` rather than `a\tb`.
  - The image cache owns its bitmaps and closes each one it drops: evicted to fit its budget, released with `releaseImage`, replaced by a sharper SVG raster, or landing for a load already released. Before, it dropped them without closing them, leaving their memory until garbage collection. **A bitmap taken from the cache with `getImageBitmap` is valid only until the cache drops it**, so read it again each frame rather than keep it. A draw command still holding a closed bitmap draws nothing. Work that holds draw commands across an `await` can call the new `holdImageBitmaps()` (from `@weasel-js/renderer` and `@weasel-js/core`), which keeps what the cache drops open until the hold is released; `writePdf`, `exportPagesPdf` and `sceneToLbx` hold one themselves. A `bitmapSrc` bitmap is still its maker's and is never closed.
- Updated dependencies [1549044]
- Updated dependencies [fc38c90]
- Updated dependencies [91b9542]
- Updated dependencies [0e5661d]
- Updated dependencies [30dd2dc]
- Updated dependencies [be6244b]
- Updated dependencies [07205dd]
  - @weasel-js/ui-logic@1.18.2
  - @weasel-js/text@1.18.2
  - @weasel-js/react@1.18.2
  - @weasel-js/paint@1.18.2
  - @weasel-js/font@1.18.2

## 1.18.1

### Patch Changes

- Updated dependencies [c9fb4d6]
  - @weasel-js/font@1.18.1
  - @weasel-js/text@1.18.1
  - @weasel-js/paint@1.18.1
  - @weasel-js/react@1.18.1
  - @weasel-js/ui-logic@1.18.1

## 1.18.0

### Patch Changes

- c7e8680: Text fixes from an audit:
  
  - An outline face registered again while its first file was still loading no longer builds the DOM face from the old file's bytes.
  - Registering a bidi engine or shaper (`registerBidi`, `registerShaper`) after text was first drawn now lays that text out again in its picking silhouette, in `textClusters` and in retained layers; it used to keep the order and widths from before. New `textEngineGeneration()` counts those registrations.
  - `runsToMarkdown` writes markers only where a flag changes, so two adjacent italic (or bold) runs no longer come back from `markdownToRuns` as bold (or plain).
  - The text edit overlay keeps a run's screen-pixel `fontSize` and `letterSpacing` (`{ px }`): it showed the run at the node's size and dropped the override on commit.
- 082fa2f: Fix text editing and mixed-face line heights
  
  - A character typed under an armed style (Cmd+B at a collapsed caret) keeps the styling of the run it is typed into.
  - Text committed through an input method takes the armed style, and small-caps letters it typed are re-split once the composition ends.
  - A paste that ends the text with a line break keeps that break on commit.
  - A line holding two faces grows to clear the lower one's descent, as CSS does, so canvas lines no longer overlap or sit closer than the edit overlay's.
  - The scene edit overlay sizes `{ px }` font sizes and letter spacing as `kit:text` draws them, at any zoom. `TextEditScreenPose` takes a new `pxScale`.
- 5f9b5d0: Type fixes from an audit:
  
  - The text edit overlay waits for, and sets, a run's own family in the node's weight and style when the run names no weight or style of its own. It asked for 400 normal, so an edit in a bold node could show before its face had loaded.
  - `fontHold: 0` shows the edit overlay at once, as documented; it stayed transparent until a zero-length timer fired.
  - A numeric `startEdit` caret is placed by the same offset rules as every other selection in the overlay.
  - `unregisterCanvasFont` drops the family's glyphs still waiting to bake, so they no longer take atlas room.
  - Bidi reordering is linear in the number of tabs and separators on a line; it was quadratic.
- c675905: Type fixes from an audit:
  
  - The text edit overlay keeps a run's solid fill opacity. It wrote only the CSS color, so committing an edit dropped the opacity.
  - The overlay splits a small-caps run under `textTransform: 'capitalize'` the way the canvas draws it: a run that continues a word started in the run before it has no capital at its start.
  - A pasted weight reads as bold by `isBoldWeight`, the same line every other bold check draws.
  - `createMarkdownRenderer` underlines, strikes and overlines a small-caps word as one rule at its run's size, as the GL tier does. It drew one rule per piece, the small pieces' thinner and higher. `PositionedRun` gains `lineSize`, the size of the run a piece was cut from.
- Updated dependencies [fe6a382]
- Updated dependencies [c7e8680]
- Updated dependencies [b4163e6]
- Updated dependencies [082fa2f]
- Updated dependencies [b93c1dd]
- Updated dependencies [5f9b5d0]
- Updated dependencies [d83476e]
- Updated dependencies [56e54c0]
- Updated dependencies [c675905]
- Updated dependencies [1e0adbb]
- Updated dependencies [2455bb4]
- Updated dependencies [8c39a05]
- Updated dependencies [b470ff1]
- Updated dependencies [e3ce292]
- Updated dependencies [a287c54]
  - @weasel-js/paint@1.18.0
  - @weasel-js/font@1.18.0
  - @weasel-js/text@1.18.0
  - @weasel-js/react@1.18.0
  - @weasel-js/ui-logic@1.18.0

## 1.17.3

### Patch Changes

- @weasel-js/text@1.17.3
  - @weasel-js/ui-logic@1.17.3
  - @weasel-js/font@1.17.3
  - @weasel-js/paint@1.17.3
  - @weasel-js/react@1.17.3

## 1.17.2

### Patch Changes

- Updated dependencies [32e0dd5]
- Updated dependencies [c089c61]
- Updated dependencies [cc591ff]
- Updated dependencies [e6e7a72]
- Updated dependencies [d162fbb]
- Updated dependencies [d08837f]
- Updated dependencies [019b877]
- Updated dependencies [47679f8]
- Updated dependencies [fce3d09]
- Updated dependencies [05acca8]
- Updated dependencies [33c0cbd]
- Updated dependencies [d3654a1]
- Updated dependencies [df46c46]
- Updated dependencies [ffacbd8]
  - @weasel-js/paint@1.17.2
  - @weasel-js/text@1.17.2
  - @weasel-js/ui-logic@1.17.2
  - @weasel-js/react@1.17.2
  - @weasel-js/font@1.17.2

## 1.17.1

### Patch Changes

- @weasel-js/font@1.17.1
  - @weasel-js/paint@1.17.1
  - @weasel-js/react@1.17.1
  - @weasel-js/text@1.17.1
  - @weasel-js/ui-logic@1.17.1

## 1.17.0

### Patch Changes

- 0a85ea5: `domPositionToCharOffset` read a caret sitting in an empty text node, which a browser can leave behind after deleting a span's last character, as the end of the text, so the edit overlay's selection jumped there. It now counts only the text before that node.
- Updated dependencies [f7dc7c8]
- Updated dependencies [52fd33e]
- Updated dependencies [d90931a]
- Updated dependencies [df080bc]
  - @weasel-js/react@1.17.0
  - @weasel-js/paint@1.17.0
  - @weasel-js/font@1.17.0
  - @weasel-js/text@1.17.0
  - @weasel-js/ui-logic@1.17.0

## 1.16.2

### Patch Changes

- @weasel-js/text@1.16.2
  - @weasel-js/ui-logic@1.16.2
  - @weasel-js/font@1.16.2
  - @weasel-js/paint@1.16.2
  - @weasel-js/react@1.16.2

## 1.16.1

### Patch Changes

- Updated dependencies
  - @weasel-js/text@1.16.1
  - @weasel-js/ui-logic@1.16.1
  - @weasel-js/font@1.16.1
  - @weasel-js/react@1.16.1
  - @weasel-js/paint@1.16.1

## 1.16.0

### Patch Changes

- Updated dependencies [63056ee]
- Updated dependencies [f9cfd00]
  - @weasel-js/paint@1.16.0
  - @weasel-js/text@1.16.0
  - @weasel-js/ui-logic@1.16.0
  - @weasel-js/font@1.16.0
  - @weasel-js/react@1.16.0

## 1.15.2

### Patch Changes

- Updated dependencies [507f539]
- Updated dependencies [f1906a8]
- Updated dependencies [e804540]
- Updated dependencies [6544399]
  - @weasel-js/paint@1.15.2
  - @weasel-js/react@1.15.2
  - @weasel-js/text@1.15.2
  - @weasel-js/ui-logic@1.15.2
  - @weasel-js/font@1.15.2

## 1.15.1

### Patch Changes

- Updated dependencies [d2110bc]
- Updated dependencies [8b52282]
- Updated dependencies [937167e]
- Updated dependencies [13b0604]
  - @weasel-js/font@1.15.1
  - @weasel-js/text@1.15.1
  - @weasel-js/ui-logic@1.15.1
  - @weasel-js/paint@1.15.1
  - @weasel-js/react@1.15.1

## 1.15.0

### Patch Changes

- Updated dependencies [3f13a49]
- Updated dependencies [d40f593]
- Updated dependencies [e05ddd3]
- Updated dependencies [d25ad30]
  - @weasel-js/font@1.15.0
  - @weasel-js/text@1.15.0
  - @weasel-js/headless@1.15.0
  - @weasel-js/paint@1.15.0
  - @weasel-js/react@1.15.0

## 1.14.2

### Patch Changes

- Updated dependencies [56f9771]
- Updated dependencies [3c3e00b]
- Updated dependencies [9b0c6ee]
- Updated dependencies [c5cba19]
- Updated dependencies [dec74a9]
  - @weasel-js/font@1.14.2
  - @weasel-js/text@1.14.2
  - @weasel-js/react@1.14.2
  - @weasel-js/headless@1.14.2
  - @weasel-js/paint@1.14.2

## 1.14.1

### Patch Changes

- @weasel-js/font@1.14.1
  - @weasel-js/headless@1.14.1
  - @weasel-js/paint@1.14.1
  - @weasel-js/react@1.14.1
  - @weasel-js/text@1.14.1

## 1.14.0

### Patch Changes

- ba998f9: `@weasel-js/headless` adds `editEnd`, the one rule for how a text field's edit ends: Enter and blur commit, Escape cancels, with options for an Escape that commits and for a multiline field that leaves Shift+Enter alone. hud's menu text rows, ui's `MenuTextValue` and `RenameField`, and text-dom's `useTextEdit` now read it; none of them behaves differently. `@weasel-js/text-dom` now depends on `@weasel-js/headless`.
- 6cb0cf6: `@weasel-js/headless` adds `imeKey(e)`, whether a keydown belongs to an input method mid-composition: `isComposing`, or `keyCode` 229, which Safari sends for the Enter that ends a composition, or a `Process` or `Dead` key. This adds API. The hud's hidden text input, text-dom's `useTextEdit` and ui's `ComboBox` now use it in place of their own checks; `ComboBox` no longer commits typed text on Safari's composition-ending Enter, and `useTextEdit` also leaves `Process` and `Dead` keys alone.
  
  A context menu's text row and `PageTabs`' rename field leave Enter and Escape to an input method. Before, confirming a Japanese or Chinese candidate with Enter committed the half-typed text.
- 6c31588: The in-place text editor keeps a run's `stroke` and `rotate` through an edit. Before, its overlay had no place for either, so committing an edit dropped them from every run. The overlay does not draw them: a run's stroke and turn ride on its span as `data-stroke` and `data-rotate`. A `data-fill` or `data-stroke` that pasted markup carries and that is not JSON is now ignored rather than throwing.
- 1fb8193: A text's `lang` now reaches more than the shaper. `textTransform` and synthesized small caps map case in the run's language, so `i` uppercases to `İ` under `tr`; `transformRunTexts` takes the languages as an optional third argument, `smallCapsText` as a third and `isSmallCapsLetter` as a second, and a tag `Intl` rejects maps as no language. The edit overlay sets the `lang` attribute from the node's style, and each run span from its run, and reads a pasted span's `lang` back as the run's. SVG export writes `xml:lang` on `<text>` and `<tspan>`; import reads `xml:lang` or `lang`, inherited from any ancestor onto the node and a `<tspan>`'s own onto its run. This adds API.
- Updated dependencies [79357fc]
- Updated dependencies [38bb299]
- Updated dependencies [e1bbdcd]
- Updated dependencies [b142892]
- Updated dependencies [ec07e24]
- Updated dependencies [2f3d924]
- Updated dependencies [2692828]
- Updated dependencies [1c046e3]
- Updated dependencies [11e2b7d]
- Updated dependencies [3c3a219]
- Updated dependencies [767713e]
- Updated dependencies [b59380e]
- Updated dependencies [ba998f9]
- Updated dependencies [9a963cd]
- Updated dependencies [b0a55a6]
- Updated dependencies [6cb0cf6]
- Updated dependencies [e7fca17]
- Updated dependencies [64d4e97]
- Updated dependencies [d7d29f9]
- Updated dependencies [5af16a6]
- Updated dependencies [966c37f]
- Updated dependencies [34a364e]
- Updated dependencies [d68c4f8]
- Updated dependencies [230a206]
- Updated dependencies [4f68c3a]
- Updated dependencies [78213f7]
- Updated dependencies [058fcdf]
- Updated dependencies [880f2b0]
- Updated dependencies [4a8b5be]
- Updated dependencies [32889fc]
- Updated dependencies [1fb8193]
- Updated dependencies [ab41dea]
- Updated dependencies [f645651]
- Updated dependencies [5399b45]
- Updated dependencies [55375c0]
- Updated dependencies [486ff61]
- Updated dependencies [23dcddf]
- Updated dependencies [f2acefd]
- Updated dependencies [95eb9d3]
- Updated dependencies [ff3c2ad]
- Updated dependencies [b0d5f18]
- Updated dependencies [7507e13]
- Updated dependencies [d5c4ee6]
  - @weasel-js/font@1.14.0
  - @weasel-js/text@1.14.0
  - @weasel-js/paint@1.14.0
  - @weasel-js/headless@1.14.0
  - @weasel-js/react@1.14.0

## 1.13.0

### Patch Changes

- 352502d: `useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. A draft is sent only when what the overlay holds changed, so styling armed at a collapsed caret, or a restyle that changes nothing, sends none.
  
  `TextEditDraft` is now another name for `TextEditCommit`, since a draft is what a commit would write: its `runs` is a plain `StyledRun[]`.
- Updated dependencies [9a76fb5]
  - @weasel-js/text@1.13.0
  - @weasel-js/font@1.13.0
  - @weasel-js/paint@1.13.0
  - @weasel-js/react@1.13.0

## 1.13.0-rc.0

### Patch Changes

- 352502d: `useTextEdit`'s `onDraft` now fires when a restyle changes the overlay, as well as on each keystroke, so a style change mid-edit — Cmd-B over a selection, or a character panel's change — reaches a text-along curve at once instead of at the next keystroke. A draft carries `style` when the edit rewrote the node's own style, as a commit would. A draft is sent only when what the overlay holds changed, so styling armed at a collapsed caret, or a restyle that changes nothing, sends none.
  
  `TextEditDraft` is now another name for `TextEditCommit`, since a draft is what a commit would write: its `runs` is a plain `StyledRun[]`.
- @weasel-js/text@1.13.0-rc.0
  - @weasel-js/font@1.13.0-rc.0
  - @weasel-js/paint@1.13.0-rc.0
  - @weasel-js/react@1.13.0-rc.0

## 1.12.0

### Patch Changes

- 13e597d: Text can follow a path. `@weasel-js/geom` adds a `'path'` track shape (`pathShape`), a `side` override on `trackRun`,
  and `placeAlongRun`, which turns item lengths into places along a run, in `RunOrder` `'reading'` or `'track'`.
  `TrackShape` gains a required `closed` member, so a shape implemented outside geom has to add it.
  `runPlaces` and `runLength` moved there from `@weasel-js/ui`, which re-exports `runPlaces` by name, so its curved rows
  come from geom's placement. `measurePath` takes `keepCorners`. `@weasel-js/text` adds `textClusters`, a line's
  grapheme clusters as outlines with their advances. `@weasel-js/core` adds the `textAlong` path effect; every effect
  takes `hideSources`, effect sources can carry a list of items, curved text is derived again when a font loads, a
  hidden source is edited through its effect, and Delete, Cut and Expand now remove an effect's hidden sources with
  it. A committed in-place text edit is labeled "Edit text" in history.
  `@weasel-js/path-tools` adds Text Along Path (Alt+Shift+X), Release and Set Path. `useTextEdit` in
  `@weasel-js/text-dom` gains `onDraft`.
  
  <!-- bump-approved: minor: maintainer — 1.12.0 release requested 2026-10-22 -->
- Updated dependencies [b571ad6]
- Updated dependencies [13e597d]
- Updated dependencies [400b393]
- Updated dependencies [40d87f7]
- Updated dependencies [78f29de]
- Updated dependencies [2c52cc5]
- Updated dependencies [24f2495]
- Updated dependencies [3bf5edb]
- Updated dependencies [91a1d84]
  - @weasel-js/paint@1.12.0
  - @weasel-js/text@1.12.0
  - @weasel-js/react@1.12.0
  - @weasel-js/font@1.12.0

## 1.11.1

### Patch Changes

- Updated dependencies [e30f4df]
- Updated dependencies [c29ac84]
- Updated dependencies [71d4416]
- Updated dependencies [cee04b9]
- Updated dependencies [f148f50]
  - @weasel-js/react@1.11.1
  - @weasel-js/font@1.11.1
  - @weasel-js/text@1.11.1
  - @weasel-js/paint@1.11.1

## 1.11.0

### Patch Changes

- 3eb2abc: A text node can cut its text at its box: `data.overflow: 'clip'` draws the glyphs in a group clipped to the pose box, picks only the lines inside it, cuts the editing overlay to the same box (`TextEditScreenPose.clip`, read through `useSceneTextEdit`'s new `getOverflow`), and exports as an SVG group clipped to the box. Properties offers it as a Clip switch. A node can also carry a minimum size, `data.minSize` (`MinSize`, `minSizeOf`): a resize stops at it whatever the resize policy's constraints, a multi-selection stops where its first member reaches its own, and a scale replayed through transform-again holds to it. An insert or place binding's `minSize` param grows a smaller drag or click to it and is kept on the node. Sticky notes now clip their text and keep a 48 × 48 minimum, both set through `toolOptions.sticky` (`overflow`, `minSize`). An SVG import reads a clipped note back as a clipped group around its text, not as a text node that clips.
- Updated dependencies [63b310c]
- Updated dependencies [c6a0a52]
- Updated dependencies [ad0b069]
- Updated dependencies [d32cb70]
- Updated dependencies [66c7bde]
- Updated dependencies [974682d]
- Updated dependencies [36eca7a]
- Updated dependencies [1be2ea9]
- Updated dependencies [e562d4b]
- Updated dependencies [7a31f9d]
- Updated dependencies [d705830]
- Updated dependencies [398d71e]
  - @weasel-js/react@1.11.0
  - @weasel-js/text@1.11.0
  - @weasel-js/paint@1.11.0
  - @weasel-js/font@1.11.0

## 1.10.1

### Patch Changes

- 886380f: Each README's "API reference" link now opens the package's page on the site, `https://orochi235.github.io/weasel/#pkg/<name>`, where it used to open the TypeDoc site at `/weasel/api/`, which is no longer built. A file comment that sat on an `export { … }` list is now marked as the file's, so an entry's description no longer shows up as the summary of each function the entry re-exports. No code changed. `@weasel-js/labkit` drops `vitepress` from its devDependencies, which nothing used.
- 9e84e5d: Additive: `useTextEdit` and `useSceneTextEdit` take `onStart(id)` and `onEnd(id)`. `onStart` is called as an edit opens, whichever way it was started (`startEdit`, a double-click, the `textEdit` dep). `onEnd` is called as it closes, however it does: a commit, a cancel, Escape, a click away, or another edit opening over it, and after any commit has been written. Both are called from the call that changes the edit, not from an effect, so state that follows the edit is never a render behind it. Neither is called when the hook unmounts with an edit open.
- Updated dependencies [cbd5b4d]
- Updated dependencies [924edc4]
- Updated dependencies [b8bfb2d]
- Updated dependencies [35c4879]
- Updated dependencies [886380f]
- Updated dependencies [f5870a4]
- Updated dependencies [10c5d41]
  - @weasel-js/text@1.10.1
  - @weasel-js/react@1.10.1
  - @weasel-js/font@1.10.1
  - @weasel-js/paint@1.10.1

## 1.10.0

### Patch Changes

- b3dec78: Adds API: `CharacterOptions` in `@weasel-js/ui`, the strip of character controls for a text edit in progress. It draws the options the text tool declares (`useTextTool.options`) from a `RangeStyle`, shows a control's mixed state where the range disagrees, and reports each edit as a `RunStylePatch`. `isCharacterChrome` is the matching `isEditorChrome` for `useTextEdit`: it claims the strip and any kit popover one of its controls opens, so using the strip does not end the edit.
  
  Adds API: `useTextEdit` and `useSceneTextEdit` return `effectiveStyle`, what a styling control shows during an edit — the node's style and paint, the range's styling over it, and the styling armed for the next character last. It is `null` outside an edit. A strip is wired with `<CharacterOptions style={edit.effectiveStyle} onPatch={edit.applyStyleToSelection} />`.
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
- 3a92afc: Breaking: the paint model's serialized shape changed in three ways, and its type names in two. Nothing reads the old shapes.
  
  **A fill is a record holding a paint, as a stroke is.** Every `fill` slot now takes a `Fill`, `{ paint?: Paint }`, where it took a bare paint: node data, draw commands (`CommandFill`), text styles and runs, and the affordance and overlay paint options. `fill: { color: '#abc' }` becomes `fill: { paint: { color: '#abc' } }`, beside `stroke: { paint: { color: '#000' }, width: 2 }`. `fill: null` still means no fill, and a fill with no `paint` paints nothing. `commandFill(fill, box)` resolves a node's fill for a draw command the way `commandStroke` resolves its stroke; resolving a bare paint is `commandPaint`.
  
  **A paint names its variant under `kind`, not `fill`.** `{ fill: 'linear-gradient', … }` becomes `{ kind: 'linear-gradient', … }`, the word the paint-kind registry already used. A solid still omits it. `asPaint` takes `{ kind: string }`.
  
  **Each built-in tile is its own paint kind.** `{ fill: 'pattern', pattern: { tile: 'hatch', color, lineWidth }, units }` becomes `{ kind: 'hatch', color, lineWidth, units }`, and likewise `crosshatch`, `dots`, and `chunks`. A tile a consumer rasterized itself is `{ kind: 'texture', texture: handle }`. `TilePatternSpec` is now a union keyed on `kind`, so a tile's own fields are checked instead of being optional on every tile. An SVG exported before this change carries its tiles in the old shape and loses them on import, with a warning.
  
  Follows from the fill record: `DEFAULT_SHAPE_FILL` is a `Fill`, `createPathLayer`'s `getFill` returns a `CommandFill`, `setFill` and `setFillOpacity` write the record, and the default node properties describe `data.fill` as an object with one `paint` field, as `data.stroke` is. A node whose `fill` is a string or a bare paint now paints no fill. `SelectionPanel` built from those default properties no longer offers "None" for a fill, since it offers none for a paint nested in a record; clearing one goes through the `setFill` action.
  
  A tile paint has a `color`, so `'color' in paint` no longer means solid. `isSolidPaint(paint)` answers that.
  
  Renames: `FillStyle` is `Paint`, and `GradientUnits` is `PaintUnits`. The paint types named as fills are named as paints: `GradientPaint`, `MeshGradientPaint`, `CommandPaint`, `PosedPaint`, and `SolidPaint`, with `isGradientPaint` and `isMeshGradientPaint`. `isPatternSpec` is gone; `isTilePaint` and `isPatternPaint` replace it.
  
  Adds API: `Fill`, `CommandFill`, `commandFill`, `PatternPaint`, `TilePaint`, `TexturePaint`, `TileKind`, `PatternPlacement`, `TILE_KINDS`, `isTileKind`, `isTilePaint`, `isPatternPaint`, `isSolidPaint`, `tileSpecOf`, `patternPlacementOf`, and `seedTile`. A paint kind can name a `family` (`PaintKindFamily`); kinds sharing one are a single segment in `PaintInput`'s kind bar, and the built-in tiles and `texture` share `patternFamily`.
- 9fa373d: text-dom: a new package holding in-place text editing, moved out of core. `useTextEdit` mounts a contenteditable overlay over a box on screen and commits styled runs; `runsToDom`, `domToRuns`, `charOffsetToDomPosition`, and `domPositionToCharOffset` convert between runs and the overlay's DOM. The types `TextEditScreenPose`, `TextEditClipRect`, `TextEditCommit`, `TextEditSelection`, `StartEditOptions`, `UseTextEditOptions`, `UseTextEditReturn`, and `StyleToggle` come with it, as does `TEXT_EDIT_FONT_HOLD`. It depends on `@weasel-js/text`, `@weasel-js/font`, `@weasel-js/paint`, and `@weasel-js/react`, needs React, and has no scene.
  
  The `text-dom@1.9.4` seeded on npm exports `overlayTop` and `baselineDrop`, which are internal; this release takes them off the entry. `@weasel-js/core` still exports every name it did before, and `useSceneTextEdit` stays in core.
- ded9e52: Fixes: editing text that ends in a line break dropped that break. `useTextEdit` removes one trailing newline when it reads the overlay back, since a browser adds one to hold the caret on an empty last line, and it removed the node's own the same way: `"abc\n"` became `"xabc"` when an `x` was typed at its start, and a styling change alone did the same. Chromium adds no second newline to text that already ends in one, so a break the text opened with now stays until an edit removes it.
- 28f1f55: Changes: `useTextEdit` leaves a typed character to the browser. It used to cancel every `insertText` and insert the character itself, so no `input` event followed a keystroke, typing was not on the browser's undo stack (both measured in headless Chromium), and input naming a range of its own, such as the double-space period or a text replacement, would have landed at the caret instead. It now inserts by hand in two cases only: under an armed style, which has to open a run of its own, and at a caret between two run spans, where a browser would type into the run before it.
  
  Fixes: a center- or bottom-aligned overlay is re-placed in the same task as a keystroke that changes its line count, as it already was for a paste or a delete.
  
  Behavior change: a character typed with the caret past a trailing line break now goes where the browser draws that caret, at the end of the line before the break. The hand insertion put it after the break, on a line the caret was not shown on.
- b2a1c61: Changes: `useTextEdit` reads a paste or a drop into runs and writes it through them, where the browser used to insert the clipboard's markup into the overlay. Measured in headless Chromium, a paragraph, a list, and a table copied from a page landed as `<span>`, `<ul>`, and `<table>` elements carrying the page's face, size, and color, and the list and the table read back with no line breaks between their items. Now a block opens and closes a line, a table cell follows the one before it after a tab, white space collapses as the source drew it, and the overlay holds only run spans afterward. A paste with no markup goes in as its plain text, a CRLF as one line feed.
  
  Behavior change, made on an agent's judgment where the TODO entry left it open between plain text only and keeping the markup's styling: pasted text keeps its emphasis (bold, italic, underline, strikethrough, overline, super- and subscript) and takes face, size, color, and spacing from the run it lands in, with any armed style applied. A browser writes each copied element's computed face, size, and color into the clipboard, the source page's defaults included, so those cannot be told apart from styling someone chose. This also means copying a colored run out of the overlay and pasting it back keeps its emphasis and loses the color, which the browser's own insertion kept.
  
  An engine whose `beforeinput` carries no `dataTransfer` still inserts for itself. The paste rewrites the overlay's spans, as a styling change does, so the browser's own undo is not expected to step back over it; that was not measured.
- ad10f82: Fixes: editing a text node whose pose is turned or carries a `transform` put the edit overlay on the node's unturned, unskewed box, and a double-click opened the editor from that box where no text is drawn. `useSceneTextEdit` hands the overlay the frame the node is drawn in, and takes a double-click back through it before testing it against the text.
  
  Adds API: `TextEditScreenPose.frame`, the linear part `[a, b, c, d]` of the frame a text box is drawn in, applied about the box's center. `useTextEdit` writes it into the overlay's CSS transform with the `zoom`.
- Updated dependencies [a86d79f]
- Updated dependencies [99553f7]
- Updated dependencies [5149cce]
- Updated dependencies [b1f7521]
- Updated dependencies [d675fed]
- Updated dependencies [18547a3]
- Updated dependencies [d635e84]
- Updated dependencies [06003a5]
- Updated dependencies [3777548]
- Updated dependencies [de319ce]
- Updated dependencies [3a92afc]
- Updated dependencies [3bacb3e]
- Updated dependencies [a428b54]
- Updated dependencies [27b827e]
- Updated dependencies [bbb538e]
- Updated dependencies [b76089a]
- Updated dependencies [54242f0]
- Updated dependencies [6073365]
- Updated dependencies [1d34f51]
- Updated dependencies [80b29f6]
  - @weasel-js/text@1.10.0
  - @weasel-js/font@1.10.0
  - @weasel-js/paint@1.10.0
  - @weasel-js/react@1.10.0
