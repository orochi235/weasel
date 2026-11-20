I couldn't write `.skulk/out/findings.md` because permission to write there wasn't granted, so the whole findings document is below.

# Audit round 53, area p-touch

## A text box aligned `start`/`end` is written LEFT/RIGHT whatever the resolved direction, so RTL text flips sides
- where: packages/p-touch/src/lbx/shapes.ts:112 and :127,136 (textObject)
- scenario: take a text command with `align: 'start'` holding Hebrew or Arabic text. Its `direction` is either unset or `'auto'`, which is the default (`DEFAULT_TEXT_STYLE.direction`, meaning each paragraph's first strong character decides). A second case is `cmd.direction` unset with `style.direction: 'rtl'`. The renderer resolves the direction as `cmd.direction ?? style.direction ?? default` (`renderer/src/textLayout.ts:34`), so `start` lands on the right edge. textObject only rejects an explicit `cmd.direction === 'rtl'`, and H_ALIGN always maps `start` to LEFT. The file therefore gets `horizontalAlignment: 'LEFT'`, and P-touch puts the text at the left of the box. It should either rasterize or resolve `start`/`end` against the direction the layout resolves.
- evidence: read
- severity: medium

## A text box's `style.lineHeight` is dropped: multi-line text is written with P-touch's default line spacing
- where: packages/p-touch/src/lbx/shapes.ts:128-139 (textObject)
- scenario: a two-line text command (a `\n` in its runs, or wrapping under `maxWidth`) with `style.lineHeight: 2`. The canvas puts the second line 2 × fontSize below the first (`renderer/src/textLayout.ts:32`). textObject reads nothing from `cmd.style` except `align`. It writes no `lineSpace`, though bil-lbx's TextObject has that field, and it doesn't rasterize either. P-touch then sets the lines at its own spacing, which no longer matches the canvas and can overflow the FIXEDFRAME box. `style.tabSize` is dropped the same way for text that holds a tab.
- evidence: read
- severity: medium

## A text command with both `width` and `maxWidth` wraps at a different width in the file than on the canvas
- where: packages/p-touch/src/lbx/shapes.ts:110,130,135 (textObject)
- scenario: `width: 200, maxWidth: 100`, an alignment box wider than the wrap width, which `TextDrawCommand` allows. The canvas breaks lines at 100. textObject writes a 200-wide box with `autoLF: true`, so P-touch breaks lines at 200 instead. The written box only states the wrap correctly when `width === maxWidth` or one of them is absent; in the other cases it should rasterize.
- evidence: read
- severity: low

## A carrier under a mirrored rect clip is skipped although the clip is an axis-aligned rect
- where: packages/p-touch/src/lbx/writeLbx.ts:96-97 (insideClips)
- scenario: a barcode's `lbxObjectsCommand` sits inside a group whose `clip` rect is drawn under a y-flip (`scale(1, -1)`), and a nested group places the carrier itself unflipped. In the page's frame the clip is still an axis-aligned rect. But `axisMap` refuses any scale that isn't positive, so insideClips returns false. The barcode is reported as skipped and left out of the file, even when it lies wholly inside the clip.
- A related case: a clip under a zero-scale transform. `placed` drops what it hides silently (`mat3.invert` returns null), while insideClips reports a skip for the same clip. That is two answers to one collapsed clip.
- evidence: read
- severity: low

## A stroked rect with `miterLimit` below √2 is written with sharp corners the canvas bevels
- where: packages/p-touch/src/lbx/shapes.ts:23 (rectObject); packages/p-touch/src/lbx/style.ts:52
- scenario: a rect path with a solid stroke, `join: 'miter', miterLimit: 1`. A 90° corner's miter ratio is √2, which is over 1, so the stroke bevels all four corners. `miterLimit` is in PLAIN_STROKE_KEYS, so it passes the check, and rectObject only checks `join === 'miter'`. The INSIDEFRAME pen in the file then draws square corners. A miter limit under √2 should be treated as a bevel join and rasterized.
- evidence: read (the renderer's miter-limit behavior is inferred from canvas semantics, not traced)
- severity: low

## Raster content is cropped to the label's length while native objects past it are written whole
- where: packages/p-touch/src/lbx/writeLbx.ts:190 (rasterObject) vs :149-155 (collect)
- scenario: under `autoLength: true`, a rect and a rotated rect each extend 50pt past `length`. The plain rect becomes a RECTANGLE object at its full size, and P-touch's auto length grows the label to fit it. The rotated rect is rasterized into `{0, 0, length, widthPt}`, so the part past `length` is lost. The same label treats content past its end two ways. Either both should be cut at the label's end, or the raster rect should reach as far as the objects do.
- evidence: read
- severity: low

## Files read
packages/p-touch/src/index.ts
packages/p-touch/src/lbx/carried.ts
packages/p-touch/src/lbx/sceneLbx.ts
packages/p-touch/src/lbx/shapes.ts
packages/p-touch/src/lbx/style.ts
packages/p-touch/src/lbx/writeLbx.ts
packages/p-touch/src/pbt.fixture.ts
packages/p-touch/src/print.ts
packages/p-touch/src/render.ts
packages/p-touch/src/tape.ts

<!-- done: 6 findings, files read: 10 -->