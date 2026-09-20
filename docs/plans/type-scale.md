# Sizing: derive the ramps, add a density axis, adopt the spacing scale

Scaffolding for the `type-scale` branch. Delete on merge.

## What's wrong now

`themes/weasel.json` declares every size under `pins` — six font sizes, four
spacing steps, `control-h`, `tb-height` — as unrelated px literals. Nothing
derives from anything, so there is no single number to turn.

`packages/ui/src` carries 674 hardcoded px declarations: 111 `gap`, 87
`padding`, 54 `height`, 42 `width`. The spacing tokens are well adopted
*outside* `packages/ui` (168 uses in labkit, forge, theme-editor) and ignored
*inside* it (10). The reason is coverage, not discipline: the real spacing
vocabulary in ui is 2/4/6/8/10/12/16, and `space-{xs,sm,md,lg}` only supplies
4/8/12/16. 6px is used 46 times and has no token.

Raising `--wzl-font-size` today grows glyphs while `--wzl-control-h` stays
24px, and `labkit/src/theme/base.less:47` pins control height inside a
`:where()` no component class can outrank. Text overflows; nothing scales.

## What we are not doing, and why

**Not `calc()` chains against a root var.** `packages/theme/src/tokenPx.ts` is
the kit's bridge from tokens to drawing — SVG geometry attributes, canvas,
WebGL — and it parses a plain px length, throwing on anything else rather than
guessing. Handle sizes and slider thumbs feed geometry through it. Emitting
`calc(var(--wzl-ui-base) * 1.23)` would break every drawing consumer, and
resolving it would cost a `getComputedStyle` per read that the current design
deliberately avoids.

**Not `rem`.** Same reason, plus: half-scaling is worse than none. Text in
`rem` inside boxes in px is precisely the overflow bug above.

Runtime scaling therefore has to be **pre-baked variants**, which is what the
theme engine's axis machinery already does for `mode`.

## The design

### 1. `factors` on `ScaleDef` (engine)

`scale()` supports linear (`step`) and geometric (`ratio`). Neither reproduces
the existing type ramp — 9/10/11/13/16/20 is compressed at the small end on
purpose, because chrome text stops being legible before a geometric ramp stops
shrinking. A geometric fit either moves the base font (13 -> 15) or guts the
bottom (9 -> 7).

So add a third rule: explicit per-step multipliers of the base.

```json
"font-size": {
  "steps": ["2xs", "xs", "sm", "md", "lg", "xl"],
  "base": "{seeds.ui-base}",
  "factors": [0.7, 0.77, 0.85, 1, 1.23, 1.54]
}
```

At `base: 13` that rounds to exactly 9/10/11/13/16/20 — today's values, now
hanging off one number. `factors` is general, composable, and sits beside the
two existing rules rather than replacing them.

### 2. A `density` axis

`compact` / `comfortable` / `roomy`, defaulting to `comfortable`.
`seeds.ui-base` varies on it (11 / 13 / 15), as do `control-h` (20 / 24 / 28)
and `tb-height` (24 / 28 / 32) — control heights are touch-target constrained,
not ramp-derived, so they vary directly as pins rather than deriving.

The engine already supports this end to end and nothing about it is new work:
`axes.ts` enumerates, `deps.ts` propagates axis dependence through refs,
`emit/css.ts` writes one block per axis subset, and `applyTheme` stamps
`data-wzl-density`. `tokenPx` keeps working because `resolveTheme` resolves at
a selection.

**Safety property:** the default selection's generated CSS must be unchanged.
Verified by diffing `tokens.css` at `mode=dark,density=comfortable` against
`origin/main`.

### 3. Fill in the spacing ladder

`space` becomes a linear scale, base 2 step 2, eight rungs `space-1` … `space-8`
= 2/4/6/8/10/12/14/16.

`space-xs/sm/md/lg` stay, as ref pins to rungs 2/4/6/8 — still exactly
4/8/12/16. The 168 existing call sites keep working and keep meaning the same
thing; a pin referencing a rung cannot drift out of sync. The odd rungs become
available, which is what the ui sweep needs.

### 4. Sweep `packages/ui/src`

674 px literals onto tokens: `gap`/`padding`/`margin` onto `--wzl-space-*`,
`height`/`min-height` on controls onto `--wzl-control-h`. Out of scope:
`border` widths, `outline`, `box-shadow` offsets and 1px hairlines — those are
not spacing and do not scale with density. `Foundations.module.css` is the
token showcase and keeps its literals.

### 5. `npm run check:sizing`

A script, not a paragraph: fail on a `gap`/`padding`/`margin` px literal in
`packages/ui/src` that has a token rung, so the sweep cannot silently undo
itself. Allowlist the exclusions above.

## Verification

- `tokens.css` default selection byte-identical to `origin/main`
- `npx vitest run --project=weasel-ui --project=core`
- `npx tsc --noEmit` from the repo root
- visual baselines
- screenshots of labkit at all three densities, to the wall
