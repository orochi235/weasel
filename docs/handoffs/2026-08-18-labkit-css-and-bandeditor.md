# The labkit stylesheet fix, and BandEditor

**For:** the next session working in `~/src/weasel`. Assumes no knowledge of wod
— a downstream app consuming `@weasel-js/labkit` — beyond what is here.

**Answers:** what is sitting unpushed on `main`, what has to happen for a
release to carry it, and what wod is doing until then.

## Repo state

`main`, working tree clean, **6 commits ahead of `origin/main` and nothing
pushed.** `feat/band-editor` merged at `2b7c4e05` and can be deleted.

- `08585a05` `fix(labkit): ship the stylesheet the passthrough components need`
- `cf8667ee` `docs: design BandEditor` — `docs/superpowers/specs/2026-08-18-band-editor-design.md`
- `7eb32b07` `docs: note the BandEditor/Slider reconciliation as P3` — `docs/TODO.md`
- `f322c78f` `changeset: labkit stylesheet fix` — patch, `.changeset/labkit-ships-ui-styles.md`

`a27232c8`, `3f11b0fc` and `d2a90495` were already unpushed before this work and
ride along.

The fix has a regression test: `npm run test:smoke:consumer` gained a third
check asserting every scoped class name in the bundle has its module's rules in
the shipped stylesheet. It fails on the commit immediately before `08585a05`.

## Releasing it

Push `main`. The release workflow triggers on `.changeset/*.md` and refreshes
PR #13 (`chore: version packages`, open since 2026-08-15); merging that PR
versions and publishes all thirteen workspaces in lockstep. Do not run
`changeset version` locally — see `docs/releasing.md`.

## BandEditor is designed, not built

The spec targets `@weasel-js/ui` and names wod as its first consumer. wod has
since shipped its own `BandTrack` on the existing `Slider`, so nothing is
blocked on this — what remains is the generalization. The `docs/TODO.md` P3
entry records why it was not folded into `Slider` outright.

## What wod is doing meanwhile

Linking against this checkout rather than waiting for a release. Three things
about that are worth knowing if it comes back as a bug report:

**The link is a major-version jump, not just the CSS fix.** wod depends on
published `@weasel-js/labkit@0.1.0`; latest published is `1.0.1`, and this
checkout carries `08585a05` on top of that. The jump was made and is clean: wod
typechecks, builds and passes its 1419 tests against this checkout. If that
changes, suspect the gap before suspecting `08585a05`.

**The link serves `dist`, not `src`.** labkit's export map points entirely at
`dist`, so `packages/labkit` has to be built for a linked consumer to see
anything — including the three-layer `dist/styles.css` the fix produces.

**The shim it replaced is already gone.** wod's `BandTrack.css` styled the
passthrough `Slider` by role and data attribute because published labkit ships
no weasel-ui CSS. Linked against this checkout, that block is deleted and the
control renders unchanged — so `08585a05` is confirmed working against a real
consumer, not just the smoke test.
