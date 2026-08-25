# Handoff — labkit theme selector and chrome density

**Branch:** `labkit-theme-selector`, worktree `.claude/worktrees/labkit-theme-selector`, based on `main` at `23af1930`. One commit: `53838c72`. Nothing pushed.

**Dev server:** `cd packages/labkit && npm run dev` (was on :5174; :5173 taken).

**Storybook:** labkit stories are wired into the *root* Storybook, not a labkit-local one — `.storybook/main.ts:25` globs `packages/labkit/src/**/*.stories.tsx`, titled `labkit/…`. Run `npm run dev:storybook` from the worktree root (port 6010). Existing: `Lab.stories.tsx`, `Trial.stories.tsx`, `LabShell.stories.tsx`, `Workspace.stories.tsx`, plus the `ui/properties/*` set.

## What this is

Four complaints about labkit chrome. Three are fixed; the icons are not started.

## Done (`53838c72`)

- **Mode toggle height.** It was 17px beside a 28px "Add trial" button. Cause was not styling — `LabHeader` passed `size="sm"` to `ToggleBar`, and `ToggleBar.module.css:154` hard-codes `.size_sm { height: 17px }` while the default is `var(--wzl-tb-height, 28px)`. Dropping the prop lands it on 28px, the same `--wzl-control-h` the button uses. Verified in-browser: both 28.
- **Workspace padding** 12px → 8px, via a new `--lk-workspace-pad` on `.lk-root` (`theme/base.less`), consumed by `.lk-shell-body`.
- **Trial content padding** removed. `Trial.less` `&__content` no longer sets `padding`; the `--flush` modifier that used to zero it now carries only `overflow: hidden`.
- **Lab title** 16px → 20px, via `--lk-title-size` (`a6a9308a`). The theme ships only body sizes (`--wzl-font-size: 13px`, `--wzl-font-size-sm: 11px`) and nothing for headings, so a title picks its own number either way; the token just gives it one named home. There is no heading scale to align to — don't go looking for one.

labkit tests green (52 files / 415 tests) after these.

## Not done — the icons

`MODES` in `LabHeader.tsx` is still three text labels (Auto / Light / Dark). The ask is icons for the three.

The icon system is real and has guard rails — do not hand-write paths:
- Source lives in `packages/ui/scripts/icons/*.mjs`; `paths.ts` is **generated** (`node packages/ui/scripts/gen-icons.mjs`).
- 20×20 viewBox, `fill: none`, `stroke: currentColor`, stroke-width 1.5, round caps.
- `base.mjs` computes terminus geometry and *throws* when an arrowhead notch would close up. Follow that: compute, don't eyeball.
- Repo rule: proof at 240–320px before committing, never at chrome size.

**The open design question** is the `auto` glyph. `light` (sun) and `dark` (crescent) are conventional and stroke-only. `auto`/system usually wants either a half-filled circle — which breaks a stroke-only register, since nothing else in the set fills — or a monitor outline, which reads as "display" more than "follow the OS". Get Mike's call, ideally from a sketch; iterating on prose descriptions of a glyph has burned rounds before.

## The thing worth fixing properly, deliberately not fixed here

`.lk-root :where(button)` (`theme/base.less:41`) sets `height: var(--wzl-control-h)` on **every** button inside a weasel-ui component, not just labkit's bare ones. `:where()` contributes no specificity, so the rule lands at `.lk-root`'s (0,1,0) — the same as a component's own class — and source order decides. That is why `LabShell.less` carries a `button { height: auto; }` override under `.lk-lab-header__mode`.

That override is still load-bearing: removing it makes the 28px segments fill the 28px track and clip against its 1px padding. It is scoped to the *header* class, so the bug returns if the control is drawn anywhere else.

Mike's steer (2026-08-25) was to fix this at the control rather than splitting lab and trial variants, so the override should move onto the control's own class when the control is extracted for the icon work — and the underlying leak wants its own TODO entry, since deciding how labkit element defaults coexist with weasel-ui components is bigger than this control.

## Context that isn't in the code

- **`main` is shared and moving.** Another session works `feat/labkit-arc3` and has been committing to `main` all day. arc3 touches `LabShell.less` (a `.lk-lab__body` block inserted ~10 lines above the header rules) — expect a small conflict there, not a hard one.
- labkit defines **zero** `--lk-*` tokens before this branch; it reaches straight for the raw scale (25× `--wzl-space-sm`, 9× `--wzl-space-xs`, 9× `--wzl-space-md`). `--lk-workspace-pad` is the first. Mike wants values like these named rather than picked off the t-shirt ramp, but a full retokenization was explicitly not attempted here.
- Trial chrome cannot be drawn at lab level (`TrialChrome` needs a `TrialRecord` + `Instrument`); lab chrome *can* be drawn inside a trial, and theme is a single provider at `Lab.tsx:190`, so nesting inherits it.
