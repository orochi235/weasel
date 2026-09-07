# Overnight pass through docs/TODO.md

**State at hand-off:** a run of commits on `main`, **unpushed**, working tree
clean. Mike has not seen any of it and has not approved a push. `git log
--oneline @{u}..HEAD` lists what is waiting.

Every commit closes or corrects one `docs/TODO.md` entry, retires that entry in
the same commit, and carries a `patch` changeset where it touches a published
package.

## Verified after the last of them

The whole `prepublishOnly` gate, run on the tree as it stands: `tsc --noEmit`,
`npm run lint`, `npm run lint -w @weasel-js/labkit`, `npm test` (865 files, 0
failed), `npm run test:stories` (337 passed), `npm run build` + `build -w
@weasel-js/labkit`, `check:manifests`, `check:bumps`, `check:frame-loops`,
`check:test-projects`, `test:smoke:consumer`. All green.

**Of the visual suite, only `parallax` was run** — it passes against its
committed baseline, which is the one that could have moved. The rest were not:
every baseline in `tests/visual/baselines/` is a `<canvas>` capture, and the
other visual changes are DOM (the Slider's readout row, the ComboBox's `fit`
width, labkit's zoom field). Two canvas changes were checked by capturing the
canvas before and after instead — the HUD drawing from the host's font, and
WeaselDraw's loupe taking its page layer unwrapped. Both byte-identical.

## Decisions made here that are not in the code

**`test:kit` became `test:core`, and the vitest project with it.** The rename is
the smaller half; `npm run check:test-projects` is the durable one — it asks
vitest which files the projects named in `npm test` collect and fails on a
tracked test file nobody collects. It prints the directory-to-project mapping on
success, which is the question the old name answered wrongly.

**A throwing layer is not evicted.** `drawOneLayer` catches, drops that layer's
commands *and its cache entry*, reports through `onLayerError` (console.error by
default), and paints the rest. The TODO asked three open questions: no persistent
eviction, no new sink channel (the console names the layer), and the headless
`renderSceneToPixels` path never reaches `drawLayers` at all, so it is unaffected.

**Two labkit width pins stay.** The TODO said `width="fit"` retires all three.
It is wrong for two of them: `LabHeader`'s "Add trial…" and the toolbar's
"Load…" hold `selectedKey={null}` permanently, so they only ever display their
placeholder, while `fit` measures every option — which would size the header to
the longest instrument name and the toolbar to the longest snapshot name a user
has typed. Neither is a select of a value; both are a button that opens a list
and acts. The entry now says the fix is a menu-button component
`@weasel-js/ui` does not have.

**`--wzl-accent-fg` does not fix the illegible readouts.** Measured in
`weasel-ui-properties-gallery--all` at `data-wzl-mode="dark"`: the readout's
`--wzl-accent` is 1.13:1 on the dark surface, and `--wzl-accent-fg` — which the
entry named as the fix — is 2.04:1, against AA's 4.5. It is the same problem as
the light accent's 3.85:1 from the other end: **the accent ramp has no member
that passes AA as text, in either mode.** Left undone deliberately — it is a
theme decision, and it changes what external consumers who override
`--wzl-accent` (speech-balloons, `apps/draw`) get. The entry carries the numbers
now.

**A parallax plane's sources go through `drawOneLayer`.** They were drawn with
a bare `layer.draw`, so a `space: 'world'` source came out unprojected and the
only way to see anything was to pre-project by hand while declaring a space you
did not draw in — which all four ParallaxDemo layers did. The demo now emits
world coordinates and its `project` helper is gone. `apps/draw`'s loupe shim had
the same shape; fixing it let the page layer go into the lens as itself rather
than hand-wrapped in `viewToMat3`.

**A unit leaf converts only its *declared* bounds.** An omitted bound has no
stored counterpart to convert, and its fallback (0..100 for a slider's track, a
step of 1) is a display-space number already. Converting an undeclared step
turned the rotation field's 1° into 57.3° and broke the existing round-trip
test — that is what the rule is protecting against.

**The text-edit overlay was left alone on purpose.** The entry said the fix is
to pass the canvas handle's `getView`. That does scale the overlay — measured,
its `transform` goes from `none` to the live matrix — and then the overlay
paints across the page around the demo, because a text node at 2x is already
twice the container's width. Neither `overflow: hidden` nor `contain: paint` on
the container clips it, though it is a `position: absolute` child of that
container and the canvas beside it clips fine. Reverted rather than shipped
half-fixed; the entry carries the measurement and the kit question under it.

## What to do next

Nothing is half-finished; the tree is clean and every entry touched is either
retired or rewritten. Pick the next item from `docs/TODO.md`.

Two that are now sharper than they were, and both need Mike rather than code: the
accent ramp above, and `weasel-js` being unpublishable under that name (pick a
different unscoped name, or delete the alias).

Before touching `docs/TODO.md`, note that its "High-priority index" at the top is
a hand-maintained copy of claims made further down. Fix both or fix neither.
