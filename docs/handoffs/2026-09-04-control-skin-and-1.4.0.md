# Control skin arc + the 1.4.0 release

**State at hand-off:** the arc is merged to `main` and pushed. 1.4.0 published for
17 of 18 packages. **`@weasel-js/labkit@1.4.0` did not publish** and needs finishing.

## The one thing that is broken

`@weasel-js/labkit` is still `1.3.0` on npm while every other package is `1.4.0`.

The release workflow **reported it as published and exited success**. It did not
publish. Verify with the registry, never the workflow log:

```
curl -s "https://registry.npmjs.org/@weasel-js%2Flabkit" \
  | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['dist-tags'],'1.4.0' in d['versions'])"
```

Run `33840685310` lists `@weasel-js/labkit@1.4.0` under "Successfully published:"
and `time` on the registry has no `1.4.0` entry at all. Ruled out: tarball size
(0.4 MB, 290 files), first-publish (labkit has 1.2.0, 1.3.0, and both 1.4.0-pre
tags), and `check:manifests` (passes). Not yet ruled out: whatever npm actually
returned — `NPM_CONFIG_LOGLEVEL: error` in `release.yml` suppresses it, and
changesets reports success when it cannot parse the publish result.

**To finish:** re-dispatch `gh workflow run release.yml --ref main`. `changeset
publish` skips versions already on the registry, so a re-run attempts labkit
alone. A retry was in flight at hand-off; check it before doing anything else.
If it keeps failing, the next move is removing `NPM_CONFIG_LOGLEVEL: error` from
`release.yml` so npm's actual error survives into the log.

The lockstep is broken until this lands: a consumer installing `labkit@1.3.0`
alongside `core@1.4.0` gets a mismatched pair.

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

**Its labkit symlink is repointed** at `.claude/worktrees/control-skin/packages/labkit`
so it resolved this branch. Put it back when the worktree goes:

```
ln -sfn ../../../../weasel/packages/labkit \
  ~/src/experiments/speech-balloons/node_modules/@weasel-js/labkit
```

## Loose ends

- `control-skin` worktree at `.claude/worktrees/control-skin` — merged, can be removed.
- speech-balloons has two unpushed commits and other unrelated dirty files.
- A Storybook dev server on :6010 and a speech-balloons Vite server on :5180 were
  left running.
- `main` was red before this arc (the same dts OOM) and CI has not been confirmed
  green since the heap fix — check `gh run list --workflow=ci.yml`.
