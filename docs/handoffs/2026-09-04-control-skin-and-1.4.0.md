# Control skin arc + the 1.4.0 release

**State at hand-off:** the arc is merged to `main` and pushed, and 1.4.0 is
published for all 18 packages and verified by a real install.

## The release needed two attempts — know this before the next one

The first publish run left `@weasel-js/labkit` on 1.3.0 while the other 17 went to
1.4.0, and **reported success anyway**: run `33840685310` lists
`@weasel-js/labkit@1.4.0` under "Successfully published:" while the registry had no
`1.4.0` entry for it at all. A plain re-dispatch fixed it — `changeset publish`
skips versions already on the registry, so the retry attempted labkit alone.

Nothing explains *why* it failed. Ruled out: tarball size (0.4 MB, 290 files),
first-publish, `check:manifests`. Not ruled out: whatever npm actually returned,
because `NPM_CONFIG_LOGLEVEL: error` in `release.yml` suppresses it and changesets
reports success when it cannot parse the publish result. **If a future release
silently drops a package, remove that env var first** — the error is being thrown
away, not absent.

The standing lesson, which this is the second instance of: verify a publish against
`https://registry.npmjs.org/<pkg>` and a real install. Never the workflow log.

## What landed

Fifteen tasks unifying the kit's slider and field chrome. Design spec:
`docs/superpowers/specs/2026-09-03-control-skin-unification-design.md`. The plan is
deleted (its work merged); `git log main` from `9f64c4b4` to `9fe4b04e` is the arc.

The shape of it: `packages/ui/src/components/range.module.css` is now the one skin
for a native `<input type="range">`, imported by `InlineRange` and the property
rows, and mirrored as labkit's bare-element default. `Slider` keeps its 24px canvas
chrome but gained `density="slim"`; `ZoomControl` uses it. Boxed fields size from
`var(--wzl-field-h, var(--wzl-control-h))`. `NumberField` gained `ghost`.
`NumberRow` gained a `unit` suffix and right-alignment. A config leaf declares its
display string with `.suffix('px')`.

Verified: typecheck clean, `weasel-ui` 231/2759, `labkit` 88/738, `kit` 497/5284,
`check:bumps` and `check:manifests` green — on the rebased branch immediately before
merge. Visual pass done in both modes: property rows correct, numbers right-align,
`Slider`/`GradientEditor` unchanged, speech-balloons' zoom bar and font field now
match its panels.

## Decisions made in conversation that are not in the code

**`unit` on a config leaf means the conversion descriptor, not a display string.**
`ToolPrefNumber.unit` is `{ toDisplay, fromDisplay, suffix }` and `SelectionPanel`
consumes it. An earlier task wired a leaf's `unit` through as a plain string, which
would have handed that object to React as a child. The display string is `suffix`
now, with `NumberNode.suffix()` to set it, and `ControlPanel` does not read `unit`
at all. The *row* props in `@weasel-js/ui` are still `unit` — that is correct
presentation vocabulary and was deliberately not renamed.

**A `PropertyRow` outside a `PropertyList` no longer gets the dense 20px.** Density
belongs to the container. Every real panel composes the list, so this shows only in
isolated per-row stories. Accepted rather than adding a second density mechanism.

**The dark-mode readout contrast was found and deliberately not fixed.** Filed in
`docs/TODO.md`. `.readout` uses `--wzl-accent`, mode-invariant `#2e1f7a`, so values
are near-illegible on dark. `--wzl-accent-fg` is the right token, but consumer apps
theme panels by overriding `--wzl-accent`, so the swap would break their theming.
Needs a call on whether `--wzl-accent-fg` should derive from `--wzl-accent`.

## Also touched, outside the kit

`~/src/experiments/speech-balloons` — two commits, **not pushed**. `f6889d9`
migrates it off the `workspace`→`trial` rename it predated (it could not boot
against a current labkit at all). `b4867d1` puts its zoom bar on `ZoomControl` and
its font field on `SelectRow`, deleting ~49 lines of local CSS. That second commit
also swept in three pre-existing uncommitted hunks that were already in the working
tree (`BalloonView` interface + cast, `mode="dark"` on `LabShell`) — not mine, not
lost, but they rode along.

Its labkit symlink was repointed at the `control-skin` worktree during the work and
has been put back to `../../../../weasel/packages/labkit`. Nothing to do.

## Loose ends

- speech-balloons has two unpushed commits (`f6889d9`, `b4867d1`) and other unrelated
  dirty files that were already there.
- `main` was red before this arc — the same dts OOM broke CI as well as Release. The
  heap fix is pushed, but CI has not been confirmed green since:
  `gh run list --workflow=ci.yml`.
