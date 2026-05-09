# RangePicker — design spec

**Date:** 2026-05-09
**Package:** `@orochi235/weasel-ui`
**Status:** Design approved, awaiting implementation plan.

## Summary

Add `RangePicker`, a generic React component that edits an arbitrary-length list of values along a 1D axis. Covers single-thumb gradient sliders, fixed multi-thumb sliders with neighbor constraints, and dynamic-thumb bands (click-to-add, drag-to-remove, shift-drag to translate all).

The first consumer is the perceptual-color experiment in `~/src/experiments/perceptual-color`, which uses ~14 instances of three slider variants today. Future consumers (gradient stop editors, animation curves, generic categorical pickers) should fit without a second component.

## Why one component

The experiment's sliders look like several different controls but share one underlying pattern: an axis, one or more thumbs, optional track painting, optional add/remove. Splitting by surface variation (single-thumb vs multi-thumb vs dynamic) creates parallel implementations of the same drag/keyboard/ARIA logic. A single component parameterized by a per-thumb generic type covers all variants without that duplication.

## Non-goals

- **Vertical orientation.** Every current consumer is horizontal. Add later when needed.
- **Native `<input type=range>` fast-path for the single-thumb case.** Considered and rejected: the divergence between native and custom render paths is not worth the free a11y, given keyboard/ARIA can be re-implemented in a bounded way (~50 lines).
- **Drag-to-reorder swatches.** The categorical hue band's color-swatch reorder gesture is a different interaction (drag a swatch onto another to swap positions). Not folded in here. If needed, add a separate component or extend later.
- **Modifier-drag beyond shift-translate-all.** No `alt`, `cmd`, or `onModifierDrag` hook in v1. One opt-in flag (`allowShiftAll`).
- **Whole-model adapter API (`<TValue>` with `thumbsOf` / `setThumbs`).** Considered and rejected: every current and likely-near-future consumer's editable state is 1:1 with thumbs, so the per-thumb generic (`<T extends Thumb>`) carries the same expressiveness with no adapter ceremony. Consumers with non-thumb-shaped global config keep that config in their own state and pass thumbs alone to the picker.

## Architecture

One component, one generic, one helper:

```
RangePicker<T extends Thumb>           ← interaction, constraints, ARIA, default styling
paintGradientTrack(opts) → renderTrack ← pure helper; returns a renderTrack closure
```

`paintGradientTrack` is a separate pure function, not a wrapping component. It returns a `renderTrack` function that consumers pass to `RangePicker`. No `GradientRangePicker` component exists.

Consumers that need richer descriptors (e.g., `{ stops: T[]; interpolation: 'oklab' | 'srgb' }`) build them at the consumer level by combining the picker's `T[]` output with their own non-thumb config.

## API

### Types

```ts
type ThumbShape =
  | 'round'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;       // true while this thumb is being dragged or focused
};

type BoundsCtx = {
  thumbs: readonly Thumb[];   // in-flight thumb buffer at this drag tick / keystroke
  index: number;              // index of the thumb whose bounds we're computing
};

type Thumb = {
  value: number;
  label?: string;             // glyph/letter on the thumb (e.g. '↓', '↑', 'T', 'P', 'B')
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
  // Static tuple: a fixed allowed range, independent of constraint.
  // Callback: evaluated per drag tick with the picker's in-flight thumb buffer;
  // lets the thumb compute its own ceiling/floor from neighbors or external state
  // without waiting for a React re-render.
};

type TrackCtx = {
  trackWidth: number;
  valueToFraction: (v: number) => number;  // inverse of fractionToValue; clamped 0..1
};
```

### Component

```ts
function RangePicker<T extends Thumb = Thumb>(props: {
  // Model
  thumbs: readonly T[];
  onChange: (next: T[]) => void;          // continuous: every drag tick / keypress
  onCommit?: (next: T[]) => void;         // pointerup / blur — undo boundary

  // Range
  min: number;
  max: number;
  step?: number;                          // keyboard step + drag snap; default (max-min)/100

  // Constraints
  constraint?: 'free' | 'ordered';        // default: 'free'

  // Dynamic ops (each is opt-in by being defined)
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;

  // Modifier behaviors
  allowShiftAll?: boolean;

  // Track
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  trackHeight?: number;                   // default 24

  // Readouts
  renderReadout?: (thumb: T, index: number) => ReactNode;
  readoutPlacement?: 'none' | 'inline-after' | 'below-thumb';  // default 'none'

  // A11y / styling
  ariaLabel?: string;
  className?: string;
}): JSX.Element;
```

### Track helper

```ts
function paintGradientTrack(opts: {
  gradient: (t: number) => string;        // t ∈ [0..1] → CSS color
  samples?: number;                       // default 16
  activeRange?: [number, number];         // values outside this are hatched/dimmed
  hatch?: {
    angleDeg?: number;                    // default 135
    stripe?: number;                      // default 2
    gap?: number;                         // default 4
    dim?: number;                         // 0..100, percentage; default 75
  };
}): (ctx: TrackCtx) => ReactNode;
```

`paintGradientTrack` returns a function that renders an absolutely-positioned `<div>` filling the track area, with `background` set to a layered gradient string composed exactly as the experiment does today (sampled gradient stops + optional left/right `repeating-linear-gradient` hatched overlays).

## Behavior

### Drag

Pointerdown on a thumb begins a drag. While dragging:
- Without modifier: that thumb's value tracks the pointer's x position via `fractionToValue`, clamped to `[min, max]` and to the thumb's `bounds` if any (tuple or evaluated callback), then snapped to `step`.
- With shift held (and `allowShiftAll === true`): all thumbs translate by the same delta, with the delta reduced as needed so no thumb crosses `min` or `max`.

`constraint`:
- `'free'`: thumbs can pass each other.
- `'ordered'`: a moving thumb is clamped to `(thumbs[i-1].value, thumbs[i+1].value)` exclusive, with a hairline gap of `step` (or `(max-min)/1000` if `step` is undefined). Caps still apply.

`onChange` fires continuously during drag with the new thumbs array. `onCommit` fires once on pointerup. The picker does not internally hold thumbs state — fully controlled.

### Keyboard

Each thumb is focusable (`tabindex={0}`, `role="slider"`, with `aria-valuemin`, `aria-valuemax`, `aria-valuenow`, `aria-orientation="horizontal"`, and `aria-label` derived from `ariaLabel` plus the thumb's `label` if any).

Focused-thumb keys:
- `ArrowLeft` / `ArrowDown`: -1 step
- `ArrowRight` / `ArrowUp`: +1 step
- `Shift+Arrow`: ±10 steps
- `PageDown`: -10 steps
- `PageUp`: +10 steps
- `Home`: snap to `min` (or to lower neighbor +step under `'ordered'`, or thumb's `bounds[0]`)
- `End`: snap to `max` (or to upper neighbor -step under `'ordered'`, or thumb's `bounds[1]`)
- `Delete` / `Backspace`: invokes `onRemoveThumb(index)` if defined and it returns truthy

Each keystroke fires both `onChange` and `onCommit` (keyboard adjustments are per-keypress commit boundaries — matches how undo typically batches them).

### Add (click-on-track)

If `onAddThumb` is defined, a pointerdown on the track (not on a thumb) computes the value at the pointer's x and calls `onAddThumb(atValue)`. If it returns a `T`, the picker calls `onChange(next)` and `onCommit(next)` with the new thumb appended. If it returns `null`, no change.

### Remove

If `onRemoveThumb` is defined:
- **Drag-off-vertical:** during a thumb drag, if the pointer y exits the track band by more than `trackHeight` (i.e., the pointer is dragged out of the slider area vertically), the picker calls `onRemoveThumb(index)` on pointerup. If truthy, the thumb is removed via `onChange`.
- **Right-click on thumb:** `contextmenu` on a thumb invokes `onRemoveThumb(index)` and prevents the default menu.

### Track rendering

If `renderTrack` is provided, its return value is rendered inside an absolutely-positioned, `inset: 0` container behind the thumbs. The default (when omitted) is a plain background-colored rect using `--wui-track-bg` (a new CSS variable in `tokens.css`).

`paintGradientTrack(opts)(ctx)` returns a `<div>` with computed `background`. It computes:
1. The gradient stops by sampling `opts.gradient` at `samples + 1` points.
2. Optional hatched overlays for the regions of the track outside `activeRange`, using `repeating-linear-gradient` and a `color-mix` dim layer, exactly matching the experiment's `paintTrack()` output.

### Readouts

- `'none'`: no readout (default).
- `'inline-after'`: a single readout element after the picker, showing each thumb's formatted value joined (consumer-controlled via `renderReadout`). Mirrors the experiment's `<span class="val">` pattern.
- `'below-thumb'`: per-thumb readout absolutely positioned below each thumb, tracking the thumb's x. Mirrors the experiment's `mt-readout`.

If `renderReadout` is omitted, the picker renders `thumb.value.toFixed(3)`.

## Styling

Implementation uses CSS Modules (`RangePicker.module.css`) consistent with `weasel-ui`'s existing components.

New CSS variables added to `tokens.css`:

| Variable | Purpose |
|---|---|
| `--wui-track-bg` | Default track background when no `renderTrack` is supplied |
| `--wui-track-border` | Track border |
| `--wui-thumb-fill` | Default round-thumb fill |
| `--wui-thumb-border` | Default thumb border |

`shape: 'notched'` ships with the same SVG polygon used by the experiment, embedded inline as a CSS `--thumb-svg` data URI. Consumers can override per thumb by passing a custom `{ render }` shape.

## Consumer worked examples

### Single-thumb hue slider

```tsx
const [hue, setHue] = useState(200);

<RangePicker
  min={0} max={360} step={1}
  thumbs={[{ value: hue }]}
  onChange={ts => setHue(ts[0].value)}
  onCommit={ts => pushHistory()}
  renderTrack={paintGradientTrack({
    gradient: t => oklchToHex(midL, peakC, t * 360),
  })}
  ariaLabel="Hue"
/>
```

### 2-thumb L-range, hard-ordered, with active-range hatching

```tsx
type LThumb = Thumb & { key: 'lMin' | 'lMax' };

<RangePicker<LThumb>
  min={0} max={1} step={0.005}
  constraint="ordered"
  thumbs={[
    { value: lMin, label: '↓', key: 'lMin', shape: 'notched' },
    { value: lMax, label: '↑', key: 'lMax', shape: 'notched' },
  ]}
  onChange={ts => { setLMin(ts[0].value); setLMax(ts[1].value); }}
  onCommit={() => pushHistory()}
  readoutPlacement="below-thumb"
  renderTrack={paintGradientTrack({
    gradient: t => oklchToHex(t, 0, 0),
    activeRange: [boundedLMin, boundedLMax],
    hatch: { angleDeg: 135, stripe: 2, gap: 4, dim: 75 },
  })}
/>
```

### 3-thumb chroma, free-pass-through, per-thumb caps

```tsx
type CThumb = Thumb & { key: 'cTop' | 'cPeak' | 'cBot' };

<RangePicker<CThumb>
  min={0} max={maxCap} step={0.005}
  constraint="free"
  thumbs={[
    { value: cTop,  label: 'T', key: 'cTop',  bounds: [0, 0.06] },
    { value: cPeak, label: 'P', key: 'cPeak', bounds: [0, 0.22] },
    { value: cBot,  label: 'B', key: 'cBot',  bounds: [0, 0.10] },
  ]}
  onChange={ts => setChroma(Object.fromEntries(ts.map(t => [t.key, t.value])))}
  onCommit={() => pushHistory()}
  renderTrack={paintGradientTrack({
    gradient: t => oklchToHex(midL, t * maxCap, refHue),
    activeRange: [boundedMin, boundedMax],
    hatch: { angleDeg: 135 },
  })}
/>
```

### Dynamic indices band (0..1000, click-to-add, shift-translate)

```tsx
const [indices, setIndices] = useState<number[]>([25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);

<RangePicker
  min={0} max={1000} step={1}
  thumbs={indices.map(value => ({ value }))}
  onChange={ts => setIndices(ts.map(t => Math.round(t.value)).sort((a, b) => a - b))}
  onCommit={() => pushHistory()}
  onAddThumb={at => ({ value: Math.round(at) })}
  onRemoveThumb={() => true}
  allowShiftAll
  renderTrack={paintGradientTrack({ gradient: t => `rgb(${(1 - t) * 255}, ${(1 - t) * 255}, ${(1 - t) * 255})` })}
/>
```

## Testing

Unit tests (vitest + React Testing Library):
1. Single-thumb drag updates value and fires `onCommit` once on pointerup.
2. Keyboard arrow / shift-arrow / Home / End move the focused thumb correctly under `step` and `cap`.
3. `'ordered'` constraint prevents thumbs from crossing.
4. `'free'` constraint allows thumbs to pass each other.
5. `bounds` (tuple form) clamps a thumb regardless of constraint.
5a. `bounds` (callback form) is evaluated per drag tick with in-flight thumb state and clamps accordingly.
6. `onAddThumb` returning `T` appends; returning `null` is a no-op.
7. `onRemoveThumb` triggered by drag-off-vertical and by right-click.
8. `allowShiftAll` translates all thumbs and clamps so none cross `min`/`max`.
9. ARIA attributes present and correct on each thumb.
10. `paintGradientTrack` emits expected CSS background string for given gradient + activeRange + hatch.

Manual verification: rebuild the experiment's L-range, chroma, hue, and indices sliders inside a demo page (`apps/` or a minimal Vite playground) and confirm visual + behavioral parity.

## Package layout

New files in `packages/weasel-ui/src/`:
- `RangePicker.tsx` — component implementation.
- `RangePicker.module.css` — track / thumb / readout styles.
- `paintGradientTrack.ts` — pure helper.
- `RangePicker.test.tsx` — unit tests.

`index.ts` exports `RangePicker`, `paintGradientTrack`, and the public types `Thumb`, `ThumbShape`, `TrackCtx`, `RangePickerProps`.

`tokens.css` gains the `--wui-track-*` and `--wui-thumb-*` variables listed above.

## Open questions

None blocking. Variation cataloged: 1 single-thumb, 2 fixed multi-thumb (ordered + free), 1 dynamic-thumb. Shift-drag-translate-all is the only modifier behavior in scope.
