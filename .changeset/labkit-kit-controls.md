---
'@weasel-js/ui': patch
'@weasel-js/labkit': patch
---

`@weasel-js/ui` gains `Toolbar`, with `Toolbar.Group` and `Toolbar.Spacer`: a `role="toolbar"` run of controls whose groups rule themselves off from their neighbors, with arrow-key focus movement that `roving={false}` turns off and a `wrap` option. A ghost `Button` with a `grade` now shows that grade on hover.

labkit's `Toolbar` is now that component at the compact control height, and `Toolbar.Button` is a ghost `Button`: its `title` shows as a kit tooltip rather than a native one, its pressed state takes `Button`'s pressed look, and it takes an `icon` for a glyph ahead of a text label.

The loupe lens strip draws its Source and View choices as single-choice `ToggleBar`s (radios, with arrow keys moving the choice) and its readouts as a multiple-choice one.

`useDebouncedText` moves from labkit's controls into `@weasel-js/ui/components/Prefs`, beside `PARAMS_TEXT_WAIT_MS`, which sets the wait it is called with.
