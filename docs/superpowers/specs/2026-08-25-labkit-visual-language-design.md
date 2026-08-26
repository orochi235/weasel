# labkit visual language — design

**What this is:** arc 4 of the labkit presentation pass — the density, spacing and type-scale
work that makes labkit's chrome read as one system. Arcs 1–3 (icon set, default chrome, chrome
regions) are merged; see `2026-08-24-labkit-presentation-design.md` for the four-arc shape.

**Who it's for:** whoever implements it. Assumes familiarity with labkit's trial/instrument
runtime, the arc-3 region mechanism, and `@weasel-js/ui`.

**What it decides:** the type, weight and shape scales; where three orphaned readouts live; and
the lint that keeps the scales from re-eroding.

**Font families are out of scope.** Nothing here changes `--wzl-font-ui`, `--wzl-font-display`,
or any `font-family` declaration — except the 18 sites that spell a monospace stack by hand
instead of using `--wzl-font-mono`.

---

## Why the chrome doesn't cohere

Not the typeface. Three measurable causes:

**The scales don't exist.** Two font-size tokens (13px, 11px) against 141 declarations using 15
distinct sizes; 87% hardcoded. Three radius tokens against 11 distinct corner radii. Zero
line-height tokens against 41 declarations; zero letter-spacing tokens against 24.

**`packages/ui` is untokenized for type.** Zero `font-size: var(--wzl-font-size*)` and zero
`font-weight: var(--wzl-font-weight-*)` across its 42 CSS modules. Every tokenized type site in
the repo is in labkit — the token system is absent from the component library labkit builds on.

**One token name means two things.** Weight tokens resolve to 200/300/350/400 under base weasel
and 300/500/700 under interstellar, so `var(--wzl-font-weight-medium)` is 350 or 500 depending
on theme. 21 of 24 hardcoded weights sit outside the base range entirely, so they cannot be
swapped — the scale has to be decided first.

The visible symptom is rank collapse: with body weight at 300 and section heads at the same
11px, a row label (`RADIUS`) reads louder than the section heading above it (`SETTINGS`).

## Type

| token | px | absorbs |
|---|---|---|
| `--wzl-font-size-2xs` | 9 | 9px (2 sites) |
| `--wzl-font-size-xs` | 10 | 10px (9) |
| `--wzl-font-size-sm` | 11 | 11px (32) + 12px (17) |
| `--wzl-font-size` | 13 | 13px (14) + 14px (7) |
| `--wzl-font-size-lg` | 16 | 16px (4) |
| `--wzl-font-size-xl` | 20 | 18px (1); replaces `--lk-title-size` |

The 12px→11 and 14px→13 folds change 24 sites' rendered size. That is the consolidation, not a
side effect of it.

**Weights are 300 / 500 / 700 in both themes.** Base weasel widens to interstellar's scale rather
than the reverse: the hardcoded 500/600/700 usage is the real design, and under the narrow scale
those 21 sites have no token to swap to. `--wzl-font-weight-light` (200) is dropped; its 6 users
want `normal`.

**`--wzl-line-height-*` and `--wzl-letter-spacing-*` are new.** They have no tokens today.

**Units unify on px.** `packages/ui` sizes type in px (76 sites), `labkit/src/ui/properties` in
rem/em (16). These are chrome dimensions, not reading text.

## Shape

11 distinct radii collapse onto the 3 existing tokens plus a new `--wzl-radius-pill`:

- `2px` (12 sites) and `4px` (7) → `sm` (3px)
- `8px` → `md`
- `999px` (5) and `9999px` (1) → `pill`
- `1px` (`LayerStack.less:49`) is a bug

`--wzl-radius-lg` (14px) has three users, two of them a story file. It survives only if
`PropertyPanel` keeps it.

## Density, and where the orphans go

An empty trial spends **~78px of vertical chrome before any content**: title bar 25, toolbar 28,
status bar 25.4.

**Every seam draws two borders.** The wrapper (`.lk-trial__toolbar`, `.lk-trial__status`) and the
component inside it (`.lk-toolbar`, `.lk-status-bar`) each declare one. The component keeps its
border and the wrapper drops it — `Toolbar` and `StatusBar` are used outside a trial, the
wrappers are not.

Three components are exported, styled, and rendered nowhere — `FpsMeter`, `ScaleIndicator` and
`ZoomControl` have zero production call sites. Giving them homes is what makes the bars earn
their height, so it is the same problem as the density:

- **`FpsMeter` and `ScaleIndicator` contribute to `status`.** Both are view-scoped readouts;
  their `.less` files are byte-identical for their first seven lines (mono, 11px, `fg-muted`,
  `gap-xs`) and identical to the zoom readout already in that region.
- **`ZoomControl` contributes to `viewport`, group `zoom`**, replacing the three icon buttons
  rather than joining them. It is the editable field arc 2 built and arc 3 dropped.
- **The title bar keeps its role and loses its slack.** Carrying name plus drag grip, its
  `min-height: 24px` becomes the height its 15.4px of text needs.

Note `ZoomControl` inherits `--wzl-control-h: 22px` only inside `.lk-toolbar`; in
`.lk-viewport-controls` it gets the 24px base.

## Defects

Fixed as part of the pass, because each is an instance of the same drift:

- **Elevation points the wrong way.** `box-shadow: … color-mix(in srgb, var(--wzl-fg) 10%, …)` —
  `--wzl-fg` is the text color, so on interstellar dark the trial casts a near-white shadow on a
  near-black field. A shadow must not derive from foreground: new `--wzl-shadow-*`.
- **Trial border sits at 1.53:1** against the workspace, on both themes. It is the only line
  separating a trial from the field behind it, so it wants 3:1 — the non-text contrast minimum.
  Raising `--wzl-border` moves every bordered surface, so the trial takes its own token.
- **`#0a0a14` at `PropertyPanel.less:394,399`** is a copy of interstellar's `surface` value used
  as a foreground. `--wzl-fg-inverse` exists for exactly this and flips with the mode; the
  hardcode is illegible in light.
- **Five danger reds for one role:** `--wzl-danger-base` `#d94a3f`, `#ff5b5b` (baked as the
  fallback into 6 ui components), `#c43c3c`, `#f04438`, `#ffb3a8`.
- **Fallbacks that contradict their own token:** `var(--wzl-font-size-sm, 0.75rem)` (12 vs 11),
  `var(--wzl-font-weight-medium, 500)` (vs 350). Both silently win whenever the token is absent.
- **`LayerList`'s checkbox** is the one control with no `accent-color`, so it renders OS blue
  against a warm accent.
- **92 `rgba()` literals** where `--wzl-surface-hover`, `--wzl-surface-pressed` and
  `--wzl-line-subtle` are already defined as that exact `color-mix`. `Button.module.css` holds 23
  of them — a hex-only audit finds none, which is why the count in `docs/TODO.md` reads 17.

## Toolbar role

`<Toolbar>` renders a bare `<div>`, so `Toolbar.Group`'s `role="group"` sits inside nothing.
It gains `role="toolbar"` with the roving tabindex and arrow-key navigation the APG pattern
obliges — claiming the role without them tells a screen-reader user to press keys that do
nothing. The biome `useSemanticElements` suppression comes out with it.

## Keeping the scales

A `check-design-tokens` script, run in `lint` — the precedent is labkit's existing
`check-class-prefix.ts`. It fails on a raw `font-size`, `font-weight`, `border-radius` or color
literal in `packages/{ui,labkit}/src` outside the token files.

Two allowances, both in the script rather than as scattered suppressions: the 21 hex values in
`theme/base.less`'s starfield gradient, which that file already documents as structure rather
than color; and `var(--token, <literal>)` fallbacks, which the script checks for *agreement*
with the token instead of banning — that check is what would have caught the 0.75rem and 500
above.

Without this the 5618 lines across 69 stylesheets re-accumulate, since nothing today prevents
the next hardcoded size.

## Sequence

Four commits, each independently reviewable:

1. **Tokens.** Add the size/weight/line-height/letter-spacing/radius/shadow tokens; widen base
   weasel's weight scale. No consumers change, so nothing renders differently.
2. **`packages/ui`.** 76 px sizes, 24 weights, 61 radii, the rgba literals, the contradicting
   fallbacks, the danger reds.
3. **`packages/labkit`.** The rem/em→px conversion, `PropertyPanel.less` (592 lines, 30% of
   labkit's LESS and the densest concentration of every defect above), the `#0a0a14` and red
   fixes, the `LayerList` checkbox.
4. **Structure.** Border de-duplication, title-bar height, the three region contributions, the
   toolbar role, and the lint script.

## Verification

**Screenshot anything that changes a container's box.** Arc 3's layout collapse — a `flex: 1`
row inside a block container resolving to zero height — passed all 7903 tests while rendering an
empty page. `labkit/Chrome/Regions` renders all five regions; the `EveryRegion` story is the
diff surface for every step here.

Both themes, both modes: three of the defects above (`#0a0a14`, the elevation direction, the
starfield) are mode-specific and a dark-only check misses them.
