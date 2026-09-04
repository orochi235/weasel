# One skin for sliders and fields

**What this is.** A design for collapsing weasel-ui's six slider treatments and four
field treatments onto one skin — the one the property rows already wear — and giving
labkit and its consumers a way to get it without re-authoring CSS.

**Who it's for.** Whoever implements it. Assumes the property-row family, the theme
token pipeline, and labkit's `.lk-root` element defaults.

**The question it answers.** Where does control chrome live, so that adding a slider
anywhere in the kit doesn't mean inventing its track and thumb again.

## Current state

`SliderRow`'s track and thumb are the reference: a 4px track at 18% accent, an 8px
thumb at 70% accent, and a click-to-edit readout that reads as a text label until
focused. That is what the rest of the kit should look like.

Nothing else reads it. The catalog:

**Six slider treatments** across four thumb sizes (14px rect, 14px circle, 12px
circle, 8px circle), four track heights (24 / 8 / 6 / 4px), two track radii (3px vs
999px) and three unrelated thumb fills. Three of those treatments — `InlineRange`,
`.row input[type='range']`, `.rowColor .alpha` — render *literally the same DOM*, a
bare `<input type="range">`, with three independently hand-authored sets of
pseudo-element rules.

**No sharing mechanism exists.** No Less mixin, no `composes:`, no shared partial.
`DetentSlider`, `GradientEditor` and `ZoomControl` share `Slider`'s chrome only by
rendering `Slider`, through its private `--rp-*` var namespace.

**A slider token set exists and is dead.** `--wzl-track-bg`, `--wzl-track-border`,
`--wzl-thumb-fill`, `--wzl-thumb-border`, `--wzl-thumb-text` are defined in
`apps/site/canvas-kit-demo.css` and listed under "Deprecated aliases" in
`Foundations.stories.tsx`. Zero readers repo-wide, and absent from the theme
manifest. The comment at `Slider.module.css:59` still tells consumers to re-skin
through them; it is false.

**Four field treatments and four focus rules.** 24px RAC frame
(`Input`/`NumberField`/`ComboBox`), 20px property row, ghost readout, 20×28 color
chip — focusing respectively with `border-color` + `box-shadow`, a bare `outline`, a
background swap, and nothing at all. labkit sets no bare text-input default, so
`MarkList`'s title input renders raw UA chrome.

## Design

### 1. Tokens carry geometry and tint, never a composed color

Add to `packages/theme/tokens/weasel/`:

```
--wzl-slider-track-h: 4px
--wzl-slider-thumb-size: 8px
--wzl-slider-track-tint: 18%
--wzl-slider-thumb-tint: 70%
--wzl-field-pad-x: 8px
```

Delete the five dead aliases and fix the `Slider.module.css` comment that cites them.

**Do not** write `--wzl-slider-track-bg: color-mix(in srgb, var(--wzl-accent) 18%,
transparent)`. A `var()` inside a custom property is substituted where the property
is *declared*, so a `:root` declaration bakes in the default mode's accent and
inherits that frozen value into every other mode's block. `--wzl-line` in the
generated tokens has this defect today. Consumers write the `color-mix()` in a real
property, where it resolves per element:

```css
background: color-mix(in srgb, var(--wzl-accent) var(--wzl-slider-track-tint), transparent);
```

`--wzl-field-h` (§4) is deliberately **not** in this list. It is an override a
container sets, never a token with a `:root` default — declaring it as
`var(--wzl-control-h)` there would freeze out `.lk-toolbar`'s 22px. Components read
it as `var(--wzl-field-h, var(--wzl-control-h))`, where the fallback resolves per
element.

### 2. One shared CSS module owns the native-range skin

`packages/ui/src/components/range.module.css`, following the
`segmentedControl.module.css` precedent already in the tree — a shared module at
`components/` root, imported today by `OptionsBar` and `ActionsBar`.

It exports `.range` (the full `appearance: none` + track + thumb skin, both `-webkit-`
and `-moz-` pseudo-elements, reading the §1 tokens) and `.rangeAlpha`, a modifier
dropping the track to 10% for the color row.

`InlineRange`, `SliderRow` and `ColorRow` import it and delete their own track and
thumb rules. `InlineRange` keeps `--slider-fill` and its gradient — the filled-to-N%
portion is behavior, not skin, and no other surface has it.

### 3. `Slider` gets a slim density; `ZoomControl` uses it

`Slider` keeps its 24px track and 14px notched thumb. A gradient track needs a
grabbable thumb, and `GradientEditor` depends on both.

`ZoomControl` passes no `trackHeight`, so it inherits that 24px default and looks
nothing like a property row. `Slider` gains a `density` prop — `'default'` (today's
chrome) or `'slim'`, which drives its track and thumb from `--wzl-slider-track-h` and
`--wzl-slider-thumb-size`. Thumb size needs a var of its own (`--rp-thumb-size`)
because Slider hard-codes 14px today. `ZoomControl` passes `density="slim"`.

This is what makes the speech-balloons zoom-bar swap in §6 actually match.

### 4. Fields collapse to two treatments and one focus rule

**Boxed field** — `Input`, `NumberField`, `ComboBox`, property-row text/number, and
the color chip. Height comes from `var(--wzl-field-h, var(--wzl-control-h))` and
horizontal padding from `--wzl-field-pad-x`. The fallback form is load-bearing: it
resolves per element, so `.lk-toolbar`'s 22px still reaches its fields.

Property panels keep today's density by setting `--wzl-field-h: 20px;
--wzl-field-pad-x: 6px` on the `PropertyList` root — one rule on a container instead
of a hard-coded height in the row stylesheet. `--wzl-prop-field-height` is retired
(nothing ever set it; the 20px fallback always won). `--wzl-prop-number-width` and
`--wzl-prop-text-width` stay — they are widths, and useful.

**Ghost readout** — `.readoutInput`. Keeps its transparent-until-focused behavior and
its background fill on focus, sourcing the ring color from `--wzl-focus-ring`.
`NumberField` gains this as a `ghost` variant. It has none today: `hideSteppers`
removes the stepper column but leaves the sunken box fully painted, which is why
`ZoomControl`'s readout cannot match a property row's.

**One focus rule** for the boxed family: `border-color: var(--wzl-focus-ring)` plus
`box-shadow: 0 0 0 1px var(--wzl-focus-ring)`. Property rows and the color chip adopt
it, replacing a bare `outline` and nothing respectively. It is the treatment that
already handles the invalid state and doesn't disturb layout.

### 5. labkit element defaults

`theme/base.less` replaces its `accent-color`-only range rule with the full skin, so
a bare `<input type="range">` in any `.lk-root` matches. Safe at zero specificity:
every range surface in the kit sets `appearance: none` and its own pseudo-elements
above it.

**No bare `input[type=text]` default is added.** `Input`, `NumberField` and `ComboBox`
put their height on a `.frame` div and zero the inner input's box; a zero-specificity
bare `height` would fight all three — the same class of bug as the `:where(button)`
rule that crushed a 16px glyph to 2px. `MarkList` migrates to `<Input>` instead.

### 6. speech-balloons

`sb-zoom-bar` → `<ZoomControl>`. `.sb-field` → `TextRow` / `SelectRow`. Its global
`input[type=range]` override and the `.sb-field` / `.sb-zoom-bar` blocks are deleted.

Blocked on a prerequisite: the app predates `11efb431` (`workspace` → `trial`) and
does not run against current labkit. Four mechanical renames — `useExperimentState`
→ `useTrialState`, `updateWorkspaceView` / `updateWorkspaceUndoStack` →
`updateTrial*`, `store.workspaces` → `store.trials` — are applied in
`src/Lab.tsx`. `src/main.tsx` still writes the pre-v2 `lk:<key>:workspaces` storage
key; labkit's document migration handles it, and this design does not touch it.

## Out of scope

`RangeSlider` (dual-range, vertical) and the `BandEditor` seam stay as they are —
genuinely different widgets, not the single-thumb range in a different skin.
`GradientHandles` is deliberately un-themed, sitting over unknown artwork.
`apps/site` demo ranges and `apps/draw`'s `.alphaRange` inherit §5 for free; neither
is migrated deliberately.

## Verification

Storybook is the surface where a skin regression shows. Both `--wzl-slider-*` and
`--wzl-field-h` changes need a mode check driven by the lab header's Light/Dark
buttons, not by `&globals=theme:dark` — that sets `data-theme`, which nothing reads,
and would verify one mode twice.

The `var()`-in-custom-property trap is invisible to a light-mode-only pass: the
frozen value is the light one, so the defect only appears in dark. Check both.
