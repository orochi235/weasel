# Handoff — labkit theme selector and chrome density

**Branch:** `labkit-theme-selector`, worktree `.claude/worktrees/labkit-theme-selector`, based on `main` at `23af1930`. Nothing pushed. Commits: `53838c72` (toggle height + padding), `a6a9308a` (title size), `66068ca8` (the full-chrome story), plus handoff edits.

**Dev server:** `cd packages/labkit && npm run dev` (was on :5174; :5173 taken).

**Storybook:** labkit stories are wired into the *root* Storybook, not a labkit-local one — `.storybook/main.ts:25` globs `packages/labkit/src/**/*.stories.tsx`, titled `labkit/…`. Run `npm run dev:storybook` from the worktree root (port 6010). Existing: `Lab.stories.tsx`, `Trial.stories.tsx`, `LabShell.stories.tsx`, `Workspace.stories.tsx`, plus the `ui/properties/*` set.

## What this is

A pass over labkit chrome density. Four sizing complaints are fixed; a story added to see all the chrome at once then exposed five more bugs, which are the next job. The mode icons are not started.

**Start with the nebula (item 1 below).** It is the one that changes how every lab looks, so it wants Mike's eyes before anything else is built on top.

## Done (`53838c72`)

- **Mode toggle height.** It was 17px beside a 28px "Add trial" button. Cause was not styling — `LabHeader` passed `size="sm"` to `ToggleBar`, and `ToggleBar.module.css:154` hard-codes `.size_sm { height: 17px }` while the default is `var(--wzl-tb-height, 28px)`. Dropping the prop lands it on 28px, the same `--wzl-control-h` the button uses. Verified in-browser: both 28.
- **Workspace padding** 12px → 8px, via a new `--lk-workspace-pad` on `.lk-root` (`theme/base.less`), consumed by `.lk-shell-body`.
- **Trial content padding** removed. `Trial.less` `&__content` no longer sets `padding`; the `--flush` modifier that used to zero it now carries only `overflow: hidden`.
- **Lab title** 16px → 20px, via `--lk-title-size` (`a6a9308a`). The theme ships only body sizes (`--wzl-font-size: 13px`, `--wzl-font-size-sm: 11px`) and nothing for headings, so a title picks its own number either way; the token just gives it one named home. There is no heading scale to align to — don't go looking for one.

labkit tests green (52 files / 415 tests) after these.

## Next up: five bugs the new story exposed

`packages/labkit/src/lab/LabFullChrome.stories.tsx` (`66068ca8`, title `labkit/Lab/FullChrome`, exports `AllChrome` and `SingleInstrument`) puts every reachable chrome surface on screen at once. It found these on its first run. Mike's instruction (2026-08-25) was **fix them, don't file them**. Work in this order.

### 1. The nebula backdrop is invisible in every Lab — start here

`theme/base.less:74-82` gives `.lk-lab` a `--wzl-backdrop` image and `:83` adds a ~40-stop radial-gradient starfield on `::before`. Both are then covered: `LabShell.less:6` gives the child `.lk-shell` `background: var(--wzl-surface)`, opaque `#0a0a14` in dark. Confirmed by setting the shell background to `transparent` in the live page — nebula and stars appear immediately.

So the entire interstellar treatment has never been visible inside `<Lab>`. Fixing it changes how every lab looks, which is why it goes first and wants Mike's eyes before anything is built on top of it.

The care needed: `.lk-shell` is also used *standalone* by `<LabShell>` with no `.lk-lab` ancestor, where it does need an opaque background. So it is not a matter of deleting the line — the fix is to drop the surface only when nested (a `.lk-lab .lk-shell` rule, or moving the opaque fill onto the standalone case). Check `LabShell.stories.tsx` for the standalone rendering.

### 2. The toolbar zoom readout overlaps its buttons and reads "0%"

`.lk-zoom__field { width: 62px }` ties on specificity (0,1,0) with weasel-ui's CSS-module `._field_… { width: 100% }`, and the module is injected later, so it wins. The field computes to 244.5px inside the 245px `.lk-zoom`, slides under the zoom-in / actual-size buttons, and they cover the leading "10" of "100%". The slider is squeezed to its 64px `min-width` at the same time.

The input's `value` is correctly `"100%"` — this is purely visual, which makes it a **silent wrong readout**, not a cosmetic nit.

### 3. This is one bug, not three — labkit cannot reliably style a weasel-ui component

Bug 2 is the third sighting of the same defect. A labkit rule and a weasel-ui CSS-module class land on the same specificity and injection order decides the winner:

- `.lk-root :where(button)` (`theme/base.less:41`) sets `height: var(--wzl-control-h)` on **every** button inside a weasel-ui component, not just labkit's bare ones. This is why `LabShell.less` carries a `button { height: auto; }` override under `.lk-lab-header__mode`. That override is **still load-bearing** — remove it and the 28px segments fill the 28px track and clip against its 1px padding. It is scoped to the *header* class, so the bug returns wherever else the control is drawn.
- `.lk-zoom__field` vs `._field_…` (bug 2).

Fix the mechanism once rather than patching each site. Two candidates: raise labkit's override specificity deliberately (`.lk-root` prefix or doubled class) as a convention, or put both sides in explicit `@layer`s so order stops being an accident. The layer route is the real fix but needs weasel-ui's CSS modules to participate. Mike's steer was to fix at the control so behavior travels into a trial, which argues against per-call-site patches.

### 4. The sidebar is crushed when `sidebarExtras` are present

With palette + layer list, `.lk-sidebar` gets 115px while `.lk-sidebar-body` holds 269px of content — about 1.5 of 6 config rows, cut mid-row. It does scroll, so nothing is unreachable; the default split just gives the extras all the room.

### 5. Chrome that cannot be reached from inside a `<Lab>` at all

Found while writing the story; each is an API gap, not a style bug:
- `ToolbarSlot` / `SidebarSlot` / `StatusBarSlot` — `<Trial>` takes only `{ id }` and never forwards slots, so the slot system `TrialChrome` advertises is reachable only by constructing `TrialChrome` yourself.
- `LabShell`'s `footer` — no `LabProps` field, so unreachable from `<Lab>`.
- Sidebar collapse toggle / `--collapsed` — `DefaultSidebar` never passes `onToggle`.
- `LayerList` labels are raw canvas layer ids (`Trial.tsx`, `ids.map(lid => ({ id: lid, label: lid }))`) and `alwaysOn` cannot be set from an instrument. The story works around it by naming the canvas layers `Grid`/`Trace`/`Marks`.
- `Instrument.job` is typed `JobCapability<TS, TC, never>`, so an instrument emitting items needs `item: x as never` / `item as number` to typecheck. labkit's own `Trial.job.test.tsx` does exactly this.

## Not done — the icons

`MODES` in `LabHeader.tsx` is still three text labels (Auto / Light / Dark). The ask is icons for the three.

The icon system is real and has guard rails — do not hand-write paths:
- Source lives in `packages/ui/scripts/icons/*.mjs`; `paths.ts` is **generated** (`node packages/ui/scripts/gen-icons.mjs`).
- 20×20 viewBox, `fill: none`, `stroke: currentColor`, stroke-width 1.5, round caps.
- `base.mjs` computes terminus geometry and *throws* when an arrowhead notch would close up. Follow that: compute, don't eyeball.
- Repo rule: proof at 240–320px before committing, never at chrome size.

**The open design question** is the `auto` glyph. `light` (sun) and `dark` (crescent) are conventional and stroke-only. `auto`/system usually wants either a half-filled circle — which breaks a stroke-only register, since nothing else in the set fills — or a monitor outline, which reads as "display" more than "follow the OS". Get Mike's call, ideally from a sketch; iterating on prose descriptions of a glyph has burned rounds before.

## Context that isn't in the code

- **`main` is shared and moving.** Another session works `feat/labkit-arc3` and has been committing to `main` all day. arc3 touches `LabShell.less` (a `.lk-lab__body` block inserted ~10 lines above the header rules) — expect a small conflict there, not a hard one.
- labkit defines **zero** `--lk-*` tokens before this branch; it reaches straight for the raw scale (25× `--wzl-space-sm`, 9× `--wzl-space-xs`, 9× `--wzl-space-md`). `--lk-workspace-pad` is the first. Mike wants values like these named rather than picked off the t-shirt ramp, but a full retokenization was explicitly not attempted here.
- Trial chrome cannot be drawn at lab level (`TrialChrome` needs a `TrialRecord` + `Instrument`); lab chrome *can* be drawn inside a trial, and theme is a single provider at `Lab.tsx:190`, so nesting inherits it.
