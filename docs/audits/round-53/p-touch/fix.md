- autoLF on for a box that doesn't wrap (A): fixed e905c015ff
- RTL text under `direction: 'auto'` or `style.direction: 'rtl'` has start/end mapped as if LTR (A+B): fixed 7e51e1afb2
- A run's `fontFeatures` (smcp small caps) is dropped (A): fixed cf5704b7d3
- A polyline's join and miterLimit are ignored as a `draw:poly` (A): fixed 398d343df2 (strict call recorded in `docs/unruled.md`: P-touch is assumed to miter polyline corners, as it does rect corners)
- A rect with miterLimit below √2 is written with square corners (A+B): fixed 3d8833e554
- `cap: 'square'` and `cap: 'butt'` both map to the SQUARE arrow (A): fixed 5bf183a171 (strict call recorded: square caps are rasterized and SQUARE is taken to be a butt end; neither was checked against a printed label)
- `renderLabel` with `background: undefined` loses its white default (A): fixed 9eb41638ee
- RTL start/end alignment (B): duplicate of the RTL finding from A, fixed 7e51e1afb2
- `style.lineHeight` and `tabSize` dropped from text boxes (B): fixed 94869c886f (strict call recorded: a box with a non-default line height that has more than one line, or one with a tab and a non-default tab size, is rasterized instead of written with `lineSpace`, because bil-lbx doesn't say what unit `lineSpace` takes)
- A box whose `width` differs from its `maxWidth` wraps at the wrong width in the file (B): fixed 0652bea810
- A carrier under a mirrored rect clip is skipped (B): fixed 0760ad5288. This also fixes the related case B gave: carriers under a zero-scale transform are now dropped silently, as the canvas draws nothing there.
- A miterLimit below √2 on a rect (B): duplicate of the rect miter-limit finding from A, fixed 3d8833e554
- Raster cropped to the label's length while native objects past it are written whole (B): fixed c58c4d578e. Strict call recorded: under `autoLength`, an object reaching past either end of the label is rasterized. An `lbxObjectsCommand` past the end is still written whole, since it cannot be rasterized; whether it should be skipped instead is left open in `docs/unruled.md`.

Extra:
- A run whose `strutSize` differs from its `fontSize` is now rasterized, since it holds its line open at a size the text object can't state (sweep): fixed cf5704b7d3
- The property-test polylines now carry joins and miter limits, and enough of them stay writable that the read-back test still sees more than 20 lines (sweep, test only): e3fb952f70. a4332903fe records the strict calls in `docs/unruled.md`. f1… is not used; the follow-up commit that shortens the changeset titles and fixes a test type is the last commit on top.

Notes: `@weasel-js/text` moved from p-touch's devDependencies to its dependencies, for `paragraphDirection` and `DEFAULT_TEXT_STYLE`, and the lockfile entry was edited by hand to match. `lang` on runs is still not checked.

Checks:
- `npx vitest run --maxWorkers=1 packages/p-touch/src/lbx/shapes.test.ts`: pass (8)
- `packages/p-touch/src/lbx/writeLbx.test.ts`: pass (19)
- `packages/p-touch/src/render.test.ts`: pass (1)
- `packages/p-touch/src/lbx/writeLbx.pbt.test.ts`: pass (7)
- `packages/p-touch/src/lbx/writeLbx.edges.pbt.test.ts`: pass (4)
- `packages/p-touch/src/lbx/writeLbx.shrunk.test.ts`: pass (2)
- `packages/p-touch/src/print.test.ts`: pass (9)
- `npm run checks:gate`: pass ("checks:gate: all 32 passed")
- `npm run lint -w packages/p-touch`: not run, because the package has no lint script; `npx eslint` on every changed p-touch file passed (exit 0)
- `packages/p-touch/src/p-touch.browser.test.ts`: not touched, unrun

tally: 11 of 13 fixed, 1 extra fixed