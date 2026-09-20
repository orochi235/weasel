---
'@weasel-js/theme': patch
'@weasel-js/ui': patch
---

Derive the type ramp from one number, and add a `density` axis that scales it.

Sizes were unrelated px pins, so there was nothing to turn: raising
`--wzl-font-size` grew glyphs while `--wzl-control-h` stayed 24px and every gap
stayed put. The type ramp now derives from `seeds.ui-base` through a new
`factors` rule on a scale (`base × factors[i]`, alongside the existing `step`
and `ratio`), and `density` — `compact` / `comfortable` / `roomy` — varies that
seed along with `control-h` and `tb-height`. Set it with
`applyTheme(el, theme, { density })`.

Sizes stay baked px rather than `calc()` against a root variable, because
`tokenPx()` feeds SVG, canvas and WebGL geometry and has to read a real number.

**Additive, with one behavior change.** Every existing token keeps its computed
value at the default selection; `--wzl-font-size` and `--wzl-space-{xs,sm,md,lg}`
are now aliases (`var(--wzl-font-size-md)`, `var(--wzl-space-2)` …) rather than
literals, which computes identically but is no longer a literal string if you
read the declaration rather than the computed value. New: `--wzl-font-size-md`
and the `--wzl-space-1` … `--wzl-space-8` ladder in 2px rungs.

`toDTCG` no longer refuses a theme with an axis besides `mode`; it exports that
axis's default branch and drops the others, since DTCG carries one variant
dimension. Round-tripping a theme through DTCG now flattens it to the default
selection of every non-mode axis.

Also adopts the ladder across `packages/ui`: 189 `gap`/`padding`/`margin` px
literals became rungs, and `npm run check:spacing` keeps them there.
