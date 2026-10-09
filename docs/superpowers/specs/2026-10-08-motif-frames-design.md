# Motif frames

**Status: designed 2026-10-08, not built.** Delete this file when the work merges.

For whoever builds `MotifFrame`. It says what a motif is, which motifs ship first, and how
`PropertyGroup` moves onto the frame.

## Motif

A **motif** is how a titled frame draws its title and its edge. It's a visual idiom borrowed from
a real-world source. It is not a stance (what a surface holds) and not a theme (token values). Every
motif colors itself from the same `stance` and `tone`, so a theme that recolors one recolors all
of them.

## Contract

`packages/ui/src/components/MotifFrame/`:

```ts
interface HeadingParts {
  title: ReactNode;
  titleId: string;
  twisty?: ReactNode;   // PropertyGroup's fold control
  leading?: ReactNode;  // a drag handle, an ordinal
  actions?: ReactNode;  // a summary, a remove button
}
interface FrameParts {
  heading: HeadingParts;
  body: ReactNode;
  rootProps: RootProps; // className, stance data attributes and tone style, role="group", aria-labelledby={titleId}
}
interface Motif<P> {
  id: string;                                  // written as data-motif on the root
  params: P;
  render(frame: FrameParts, params: P): ReactNode;
}
interface MotifFrameProps<P> extends StanceProps {
  title: ReactNode;
  motif?: Motif<P>;                            // default: rule()
  children: ReactNode;
  className?: string;
  hidden?: boolean;
}
```

`MotifFrame` resolves stance and tone (`useStance`), mints the ids, builds `rootProps`, and calls
`motif.render`. The motif owns the root element and the structure inside it, because the notch
motif must be a `<fieldset>` (below). Each motif is its own module with its own CSS module beside it.
The heading-part names are `PropertyGroup`'s, so a frame can grow toward that interface without
renames.

**Exports.** The root barrel exports `MotifFrame`, the types, and `export * as motifs from
'./components/MotifFrame/motifs'`. The bare factory names (`rule`, `stereo`, `notch`, `tab`,
`plaque`) are exported only from the `@weasel-js/ui/components/MotifFrame` subpath, so generic
words stay out of the root barrel. `motifs.stereo` and `stereo` are the same function.

## Motifs

| Motif | Params | Draws | `leading` / `actions` |
|---|---|---|---|
| `rule` | none | Today's `PropertyGroup` look: the title centered between two rules on a sunken fill, with a 4px left edge in the tone when a tone is set | Flanking the title, as now |
| `stereo` | `side: 'top' \| 'right' \| 'bottom' \| 'left'`, `labelAlign: 'start' \| 'center' \| 'end'` (default `center`) | A bar along one whole edge, filled with the tone, carrying the title; the border is the same color as the bar | In the bar after the title, oriented with it |
| `notch` | `align: 'center' \| 'start'` (default `center`) | transom's `Panel`: a `<fieldset>` whose `<legend>` cuts the title into the top border | `actions` held at the far end of the title line, with the displaced run of border drawn between them |
| `tab` | `align: 'start' \| 'center' \| 'end'` (default `start`) | A folder tab rising from the top edge, holding the title | Inside the tab, after the title |
| `plaque` | `mix?: number`, the percentage of the tone in the fill (default 100) | The tone fills the whole frame; the title and contents sit on it | In the title row |

**stereo's text.** Two rules, in this order: the title is never upside-down, and then it faces
the content. So top and bottom bars are horizontal; a left bar reads bottom to top and a right bar
top to bottom. `labelAlign`'s `start` and `end` follow the reading direction, so `start` is the
bottom of a left bar and the top of a right bar.

**notch's fieldset.** A `<legend>` cuts the border, while an element painted over the border only
covers it. That cut is why it can sit on a translucent ground with no seam. Don't swap the fieldset
for a positioned title.

**plaque's mix.** How fully the frame takes the tone is the plaque's own param, not the stance's
`tone-mix` slot. That slot is tuned for a tinted panel (22% on `scope`), and astv overrides it to
100% from outside to get this look. `mix` is written on the root as `--wzl-plaque-mix` and replaces
`--_s-tone-mix` inside the plaque.

**plaque's ink.** Text and controls on an arbitrary tone need their own colors: black or white,
whichever the fill's lightness calls for, computed in CSS from the mixed fill:

```css
--_ink: oklch(from var(--_s-fill) clamp(0, (0.62 - l) * 1000, 1) 0 0);
```

A plaque sets `--wzl-fg`, `--wzl-fg-muted`, and `--wzl-fg-subtle` from the ink mixed toward the
tone, and sets its controls' accent to the ink at low opacity. (astv hand-tunes the same accent as
`rgb(255 255 255 / 0.15)` in `packages/engine/settings/KnobPanel.css`.) `npm run check:on-accent`
has to cover the plaque's redirects the way it covers on-accent text. The 0.62 threshold gets
tested against the theme tone lists for 4.5:1 contrast before it's trusted.

## Color

`MotifFrame` is a single stanced surface in `STANCE_SURFACES` (`stanceSurfaces.ts`).
`npm run gen:stances` writes its region into `MotifFrame.module.css`, and every motif reads those
`--_s-*` slots. The tone colors `rule`'s left edge, `stereo`'s bar and border, `notch`'s border,
`tab`'s tab, and `plaque`'s whole fill.

## PropertyGroup

`PropertyGroup` keeps what is about properties: body packing (`pack`, `span`), density and
alignment metrics, folding, and `description`. It renders through `MotifFrame`, passing its twisty,
`leading`, and `actions` as heading parts, and gains a `motif` prop (default `rule()`). The `.group*`
rules and the generated `group` stance region move out of `Properties.module.css` into the frame
and the `rule` motif. `rule` has to reproduce today's group pixel for pixel.

## Tests

- Per motif, a browser test (`*.browser.test.tsx`) of the geometry jsdom can't see: `stereo` on all
  four sides (orientation, facing, `labelAlign`), `notch` cutting the border, and `tab` sitting
  outside the frame's box.
- Every motif's root is a `group` named by its title, whatever its rotation (jsdom is enough).
- The `plaque` ink threshold against each shipped theme's tone list: at least 4.5:1.
- The existing `PropertyGroup` unit, browser, and visual tests pass unchanged. That is the proof
  that `rule` matches.
- A `MotifFrame` stories file showing every motif, every `stereo` side, and several tones.
