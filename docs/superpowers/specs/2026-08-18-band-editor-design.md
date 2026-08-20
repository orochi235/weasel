# BandEditor — design spec

**Date:** 2026-08-18
**Package:** `@weasel-js/ui`
**First consumer:** `wod` — authoring the widths at which a wheel wedge changes layout.

## What this is

`BandEditor` divides a numeric axis into contiguous **bands** and lets you drag
the seams between them. Each band carries a payload the consumer supplies and
renders; the control itself knows nothing about what a band means.

It answers one question for the reader: how do you edit a partition of an axis,
where every point belongs to exactly one part and the parts are named things
rather than numbers.

## The invariant

**The axis is always fully covered.** N bands, N−1 interior seams, no gaps and
no overlaps — none of which the control has to represent, validate, or repair.
Editing a partition is therefore editing a sorted list of seam positions, and
every gesture below is a way of moving, adding, or removing one seam.

This is what separates `BandEditor` from `Slider`, which edits a list of points
on an axis and has nothing to say about the regions between them. Under a
contiguous tiling the two coincide — seams *are* an ordered thumb list — and
reconciling them is tracked as a P3 in `docs/TODO.md`. They stay separate until
a second banding consumer exists.

## API

```ts
export interface Band<T> {
  /** Domain value where this band starts. The first band's is normalized to `min`. */
  from: number
  data: T
}

export interface BandScale {
  /** Domain → position in [0,1]. Must be monotonic increasing. */
  toUnit(value: number, min: number, max: number): number
  /** Inverse of `toUnit`. */
  fromUnit(unit: number, min: number, max: number): number
}

export interface BandEditorProps<T> {
  /** Ascending by `from`. `value[0].from` is normalized to `min` on read. */
  value: Band<T>[]
  /** Live during a drag — wire for preview, do not write to history. */
  onInput?: (next: Band<T>[]) => void
  /** Committed at gesture end: one call per gesture. */
  onChange: (next: Band<T>[]) => void
  min: number
  max: number
  /** Default `'log'`. */
  scale?: 'linear' | 'log' | BandScale
  ticks?: { at: number; label?: ReactNode }[]
  /** Snap a dragged seam to a tick within ~6px. Default true; `alt` defeats it per-drag. */
  snap?: boolean
  renderBand?: (band: Band<T>, index: number) => ReactNode
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  /** Payload for a band split off an existing one. Default duplicates `from`. */
  splitBand?: (at: number, from: T) => T
  label?: ReactNode
  className?: string
}
```

`onInput` / `onChange` follow `GradientHandles`, not `Slider` — `Slider` calls
its live callback `onChange` and its committed one `onCommit`, which is the
opposite sense and a known inconsistency in the package.

## Gestures

```
      1/45      1/30    1/24    1/18      1/12         1/6          1/3
  |----|---------|-------|-------|---------|------------|------------|
  +--------------------------------++-------------------------------+
  |            Radial              ||          Name plate           |
  +--------------------------------++-------------------------------+
                                   ^ seam
```

| Gesture | Effect |
|---|---|
| drag a seam | resize the two bands either side |
| drag a band body | move both its seams, preserving its span; neighbours absorb |
| click the track | split the band under the pointer |
| `x` / `Delete` | merge the selected band into its left neighbour |
| click a band | select it |
| `←` `→` on a focused seam | move it by one step; `shift` for ten |

Seams clamp at their neighbours rather than crossing. A drag can therefore never
destroy a band — removal is always an explicit gesture, which is what keeps an
undo stack legible.

The first band is the exception to two of these. Its left edge is `min` and does
not move, so dragging its body does nothing, and it has no left neighbour to
merge into, so it cannot be removed. A partition always has at least one part.
Merging band *i* keeps band *i−1*'s payload and drops band *i*'s.

## The scale

`'log'` is the default because the interesting part of a width axis is its
narrow end: on a linear axis the four narrowest stops of the first consumer's
ladder land inside the leftmost sixth of the track.

`logScale` requires `min > 0`. Given a non-positive `min` the component falls
back to `linearScale` and warns once in development, rather than positioning
every seam at `NaN`.

Nothing in weasel is reused here because nothing exists to reuse: `Plot2D`
carries its own linear `xRange`/`yRange`, `CurveEditor`'s `domain` is a
`'1d' | '2d'` dimensionality flag, and `scale` in `@weasel-js/core` means
viewport zoom. `BandScale` is deliberately narrow — two functions over an
explicit `[min, max]` — rather than a first attempt at a general scale type for
the package. Generalizing it is a job for the second consumer that needs one.

## Selection

A band is the unit a consumer's own editor operates on, so `BandEditor` owns
which band is current and publishes it: `selectedIndex` / `onSelect`, controlled
like `value`. Without this every consumer would rebuild the same click-to-focus
plumbing over `renderBand`.

Selection also decides a layout question for consumers — a panel shows the track
plus one editor for the selected band, not one stacked editor per band.

## First consumer: wod

wod's model is a fallback layout plus a list of `{ from, slice }` floors, where a
wedge narrower than every floor takes the fallback. That fallback region **is the
first band**, so N breakpoints draw as N+1 bands:

```
band[0]      → preset.slice          (fallback; `from` pinned to min)
band[1..N]   → preset.breakpoints    (band[i].from === breakpoint.from)
```

Dragging band[0]'s right seam moves the lowest floor; splitting band[0] creates
one. The conversion is a pair of pure functions in wod, tested by round trip —
the control never learns what a slice is.

## Testing

Colocated with the component, following the package's existing pattern:

- scale math — `toUnit`/`fromUnit` round-trip, monotonicity, the non-positive
  `min` fallback
- seam clamping — a seam dragged past a neighbour stops at it and never reorders
- split and merge — band count and payloads after each
- callbacks — `onInput` fires during a drag, `onChange` exactly once per gesture
- keyboard — arrow stepping, `Delete` merging, focus order
- a Storybook story per gesture, matching `Slider.stories.tsx`

## Non-goals

- **Vertical orientation.** Every consumer is horizontal. Add when one is not.
- **Gaps and overlaps.** A band list that does not tile the axis is the
  free-ranges model, which was considered and rejected: it needs two independent
  endpoints per band, and every invariant above exists because it does not.
- **A general scale type for weasel.** See "The scale".
- **Payload editing inside the control.** `renderBand` draws; the consumer's own
  panel edits.

## Sequencing

1. weasel: build, test, story, changeset, publish `@weasel-js/ui@1.1.0`.
2. wod: add `@weasel-js/ui@^1.1.0` and rebuild `BreakpointPanel` around it.

wod pins `@weasel-js/labkit@0.1.0` while the monorepo is at `1.0.1`. Adding `ui`
does not require moving `labkit`, and this work should not move it.
