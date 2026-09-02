---
"@weasel-js/labkit": patch
"@weasel-js/ui": patch
---

A loupe any lab can turn on

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
