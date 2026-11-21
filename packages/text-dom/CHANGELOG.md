# @weasel-js/text-dom

## 2.0.0

### Major Changes

- 6153ae7: `useTextEdit` and `useSceneTextEdit` return `commitEdit` where they returned `commit`.
  
  It sits beside `startEdit` and `cancelEdit`. The `commit` option, which receives the edit, keeps its name.
  
  ```ts
  // before
  edit.commit();
  // after
  edit.commitEdit();
  ```
  
  <!-- entry: breaking -->
- 6db4410: `useTextEdit`'s `commit` and `onDraft` options are `onChange` and `onInput`: the finished edit, and the live value while typing.
  
  ```ts
  // before
  useTextEdit({ ...opts, commit: (id, edit) => write(id, edit), onDraft: (id, draft) => follow(id, draft) });
  // after
  useTextEdit({ ...opts, onChange: (id, edit) => write(id, edit), onInput: (id, draft) => follow(id, draft) });
  ```
  
  <!-- entry: breaking api -->

### Minor Changes

- f8d3623: `replaceRunRange` and `runStyleAt` are exported, to splice text into styled runs and read the style typed text joins.
  
  <!-- entry: api -->
- 6a06f54: `startEdit` takes `caret: 'end'`, which opens an edit with the caret after the last character of the text the editor shows.
  
  <!-- entry: api -->

### Patch Changes

- 46447ca: A lone carriage return in plain text pasted into a text edit breaks the line, as it does when pasted as HTML.
  
  <!-- entry: fix -->
- a82e65b: A run with `italic: false` is drawn upright inside italic text, and keeps that through the edit overlay.
  
  A run without `italic` still takes the node's style.
  
  <!-- entry: behavior fix -->
- 10a0453: The edit overlay ignores a `selectionBackground` or `selectionColor` that is not a CSS color, with a warning.
  
  A stored value can no longer restyle the rest of the page through the overlay's `::selection` rule.
  
  <!-- entry: fix -->
- f83fa78: A line break typed as a `<br>` inside small-caps text in the edit overlay is kept, and the caret stays where it was.
  
  <!-- entry: fix -->
- 112ebc0: `startEdit` with a negative `caret` opens the edit with the caret at the start of the text instead of throwing.
  
  <!-- entry: fix -->
- 56c48ed: Arming a fill at the caret that the next character already takes arms nothing.
  
  <!-- entry: fix -->
- f4cc120: A style armed at the caret keeps a key named `__proto__` as data, where it used to replace the style object's prototype.
  
  <!-- entry: fix -->
- 7dcad9e: The text edit overlay records no undo step for a change that leaves its runs as they were.
  
  <!-- entry: fix -->
- bfed2a6: Pasted markup whose `data-fill` or `data-stroke` holds JSON that is not a fill or a stroke is ignored.
  
  <!-- entry: fix -->
- e30213e: Applying a style from editor chrome no longer scrolls a clipped text node's edit back to its first line, or scrolls the page.
  
  <!-- entry: fix -->
- f882cb5: While an edited node that clips its text is off screen or gone, presses where its box was reach the canvas and end the edit.
  
  <!-- entry: fix -->
- d4e48a0: `useTextEdit` keeps the overlay hidden for the whole of a `fontHold` past 2³¹ − 1 ms, and an infinite one waits for the face.
  
  <!-- entry: fix -->
- 337905d: A canceled text edit stays canceled, and a committed one is written once, when the app's `onEnd` moves focus.
  
  <!-- entry: fix -->
- f2a95e3: After a styling change rewrites the edited node's own style, the edit overlay stays at the size and baseline of the style it now shows.
  
  <!-- entry: fix visual -->
- 008dce5: Undo and redo in the text edit overlay do nothing while its current state cannot be read, rather than lose it.
  
  <!-- entry: fix -->
- Updated dependencies [5f856dc]
- Updated dependencies [e6b28fe]
- Updated dependencies [0dc7968]
- Updated dependencies [15072f4]
- Updated dependencies [edcd3a6]
- Updated dependencies [b5d4882]
- Updated dependencies [97f1f86]
- Updated dependencies [6fb8869]
- Updated dependencies [174d6ef]
- Updated dependencies [4f264d0]
- Updated dependencies [84028cb]
- Updated dependencies [6cef61c]
- Updated dependencies [fcc5602]
- Updated dependencies [269320b]
- Updated dependencies [c3da788]
- Updated dependencies [a2df698]
- Updated dependencies [bfc26b4]
- Updated dependencies [f6ee3ea]
- Updated dependencies [583bd6d]
- Updated dependencies [d353c85]
- Updated dependencies [b6863aa]
- Updated dependencies [4674f07]
- Updated dependencies [27eb7f9]
- Updated dependencies [754e0c6]
- Updated dependencies [aedb49f]
- Updated dependencies [824eca6]
- Updated dependencies [ac8e807]
- Updated dependencies [fb47e9b]
- Updated dependencies [d916cae]
- Updated dependencies [98df398]
- Updated dependencies [77670c1]
- Updated dependencies [c131bff]
- Updated dependencies [c117e62]
- Updated dependencies [89f4197]
- Updated dependencies [95a1a63]
- Updated dependencies [a343f1b]
- Updated dependencies [221fe20]
- Updated dependencies [cc5b0c3]
- Updated dependencies [9455fc1]
- Updated dependencies [6606d90]
- Updated dependencies [5879169]
- Updated dependencies [959af37]
- Updated dependencies [890ce71]
- Updated dependencies [5e44587]
- Updated dependencies [da15963]
- Updated dependencies [e95a396]
- Updated dependencies [8e5f1cf]
- Updated dependencies [57df97b]
- Updated dependencies [4daf896]
- Updated dependencies [dbf591e]
- Updated dependencies [d4a593d]
- Updated dependencies [662f94f]
- Updated dependencies [956a71a]
- Updated dependencies [7001f43]
- Updated dependencies [558f742]
- Updated dependencies [39422f9]
- Updated dependencies [b1cfa76]
- Updated dependencies [bb7be0b]
- Updated dependencies [1cee200]
- Updated dependencies [9339b45]
- Updated dependencies [4be1a3f]
- Updated dependencies [787c496]
- Updated dependencies [37514fc]
- Updated dependencies [bebd64f]
- Updated dependencies [4baee32]
- Updated dependencies [8745b50]
- Updated dependencies [df2ae04]
- Updated dependencies [7dbeddb]
- Updated dependencies [dbf591e]
- Updated dependencies [839a4b2]
- Updated dependencies [1810479]
- Updated dependencies [d598b83]
- Updated dependencies [65e8ece]
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
- Updated dependencies [8c63002]
- Updated dependencies [38e795b]
- Updated dependencies [e6871f1]
- Updated dependencies [56784d5]
- Updated dependencies [b54ab5f]
- Updated dependencies [ea36901]
- Updated dependencies [65ac904]
- Updated dependencies [0ecff6a]
- Updated dependencies [a23ebea]
- Updated dependencies [00a0e96]
- Updated dependencies [85f85ba]
- Updated dependencies [9204311]
- Updated dependencies [0bb9ac6]
- Updated dependencies [7b298cb]
- Updated dependencies [4bda721]
- Updated dependencies [b98bad7]
- Updated dependencies [0d377ec]
- Updated dependencies [435c248]
- Updated dependencies [e1e7241]
- Updated dependencies [977164c]
- Updated dependencies [9aed377]
- Updated dependencies [c491f93]
- Updated dependencies [aadb086]
- Updated dependencies [09f0c86]
- Updated dependencies [d11dc30]
- Updated dependencies [5ad7bc0]
- Updated dependencies [481218b]
- Updated dependencies [f8172cf]
- Updated dependencies [e5395a6]
- Updated dependencies [cd7ffdb]
- Updated dependencies [8ced7e2]
- Updated dependencies [5ed6215]
- Updated dependencies [9cacd4b]
- Updated dependencies [f95e342]
- Updated dependencies [d6ba47e]
- Updated dependencies [fcc5602]
- Updated dependencies [fcc5602]
- Updated dependencies [880cbbf]
- Updated dependencies [2932eb2]
- Updated dependencies [c1a3072]
- Updated dependencies [968362b]
- Updated dependencies [f4bfab5]
- Updated dependencies [e6c888e]
- Updated dependencies [fcc5602]
- Updated dependencies [3cf6a17]
- Updated dependencies [56089ae]
- Updated dependencies [f544aeb]
- Updated dependencies [dd3fdb0]
- Updated dependencies [7645aaa]
- Updated dependencies [24bca7a]
- Updated dependencies [d868c48]
- Updated dependencies [4d31cf0]
- Updated dependencies [af132bc]
- Updated dependencies [2d57c94]
- Updated dependencies [f004638]
- Updated dependencies [3c27e36]
- Updated dependencies [3c27e36]
- Updated dependencies [ce5d609]
- Updated dependencies [73f549e]
- Updated dependencies [73f549e]
- Updated dependencies [a13982c]
- Updated dependencies [52ee422]
- Updated dependencies [73f549e]
- Updated dependencies [4bcea5f]
- Updated dependencies [59e80c0]
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
- Updated dependencies [f3a1232]
- Updated dependencies [bd25e62]
- Updated dependencies [431aa8e]
- Updated dependencies [1ac16c5]
- Updated dependencies [a82e65b]
- Updated dependencies [6222db5]
- Updated dependencies [dc5efa8]
- Updated dependencies [510347b]
- Updated dependencies [8f28726]
- Updated dependencies [ff8c1f9]
- Updated dependencies [a6e8651]
- Updated dependencies [26cdc89]
- Updated dependencies [ad94222]
- Updated dependencies [2b0def2]
- Updated dependencies [80b8f57]
- Updated dependencies [de2d442]
- Updated dependencies [3a28bbb]
- Updated dependencies [a0d5f84]
- Updated dependencies [30e2485]
- Updated dependencies [95083bc]
- Updated dependencies [cbaa22a]
- Updated dependencies [bb03b55]
- Updated dependencies [1377fab]
- Updated dependencies [9199cb5]
- Updated dependencies [8ac8a64]
- Updated dependencies [de1e1c0]
- Updated dependencies [c356829]
- Updated dependencies [fcc5602]
- Updated dependencies [cbf500e]
- Updated dependencies [c5a7102]
- Updated dependencies [3871e2f]
- Updated dependencies [c3f3d9a]
- Updated dependencies [5548d73]
- Updated dependencies [e824816]
- Updated dependencies [4377fe2]
- Updated dependencies [45559fc]
- Updated dependencies [685bc3d]
- Updated dependencies [6111c56]
- Updated dependencies [accc590]
- Updated dependencies [4b0b9df]
- Updated dependencies [f9ed89f]
- Updated dependencies [a23ebea]
- Updated dependencies [8d3c536]
- Updated dependencies [9d1f28d]
- Updated dependencies [f4115e7]
- Updated dependencies [1fe6cab]
- Updated dependencies [0481f49]
- Updated dependencies [b8bb2d4]
- Updated dependencies [6276cc6]
- Updated dependencies [6276cc6]
- Updated dependencies [677a841]
- Updated dependencies [b8bb2d4]
- Updated dependencies [cafdd8c]
- Updated dependencies [969aab0]
- Updated dependencies [61c9926]
- Updated dependencies [09dcf56]
- Updated dependencies [5024537]
- Updated dependencies [7489853]
- Updated dependencies [5dd240d]
- Updated dependencies [8b01b26]
- Updated dependencies [2c0f2fe]
- Updated dependencies [793ac72]
- Updated dependencies [6803209]
- Updated dependencies [f857c86]
- Updated dependencies [5202a9f]
  - @weasel-js/ui-input@2.0.0
  - @weasel-js/gestures@2.0.0
  - @weasel-js/text@2.0.0
  - @weasel-js/font@2.0.0
  - @weasel-js/registry@2.0.0
  - @weasel-js/paint@2.0.0
  - @weasel-js/react@2.0.0

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
