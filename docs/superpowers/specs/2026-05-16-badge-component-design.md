# Badge component — design

Status: spec
Date: 2026-05-16
Package: `@orochi235/weasel-ui`

## Motivation

`apps/swillustrator/src/dev/ToolkitBuilder.tsx` renders a one-off "slot pill" in the Tool Routes widget (see `ToolkitBuilder.tsx:485`, styled by `.slot` at `ToolkitBuilder.module.css:152`). The pattern — a small bordered label encoding a categorical value via color — recurs in dev tooling and will recur in the editor UI. Promote it to a reusable `Badge` component in `weasel-ui`, and broaden it well past a single pill shape: tones, variants, sizes, interactive affordances (clickable, removable), and a library of border shapes (pill, banner, starburst, ribbon, postage-stamp, etc.).

## Goals

- Single component covering the badge / chip / tag / pill design space.
- Library of border shapes drawn via SVG, including decorative shapes (starburst, scalloped, ribbon) and shapes that need precise geometry (perforated, notched corners).
- Tone × variant system that hooks into existing weasel-theme tokens (`--wzl-*`) with fallbacks.
- Interactive variants: clickable wrapper, removable trailing close button. Correct `:focus-visible` ring on every shape.
- First-class Storybook coverage (controls + gallery stories).
- Replaces the slot pill in `ToolkitBuilder.tsx` as the first consumer.

## Non-goals

- Visual-regression infrastructure (not currently set up in the repo; Storybook gallery is sufficient).
- Animation, count-incrementing animations, "new" indicator pulses.
- Group/multi-select chip widgets (out of scope; this is the atom).
- Dark/light theme switching beyond what weasel-theme already provides.

## Location

```
packages/weasel-ui/src/components/Badge/
  Badge.tsx
  Badge.module.css
  Badge.stories.tsx
  Badge.test.tsx
  shapes/
    index.ts         # registry mapping shape name → metadata
    Pill.tsx
    Square.tsx
    Notched.tsx
    Perforated.tsx
    Diamond.tsx
    Dot.tsx
    Hexagon.tsx
    Chevron.tsx
    Banner.tsx
    Starburst.tsx
    Scalloped.tsx
    Shield.tsx
    Ribbon.tsx
```

Re-exported from `packages/weasel-ui/src/index.ts`.

## API

```ts
type BadgeShape =
  | 'pill' | 'square' | 'notched' | 'perforated'
  | 'diamond' | 'dot' | 'hexagon' | 'chevron' | 'banner'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon';

type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral';

type BadgeVariant = 'outline' | 'solid' | 'subtle';

type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  shape?: BadgeShape;            // default 'pill'
  tone?: BadgeTone;              // default 'neutral'
  variant?: BadgeVariant;        // default 'outline'
  size?: BadgeSize;              // default 'sm'

  dot?: boolean;                 // leading status dot
  leadingIcon?: React.ReactNode; // 12×12 (sm) or 14×14 (md) slot
  onRemove?: () => void;         // renders trailing × button
  removeLabel?: string;          // a11y label for remove button, default 'Remove'
  onClick?: () => void;          // upgrades wrapper to <button>

  as?: 'span' | 'button' | 'a';  // overrides automatic element choice
  href?: string;                 // forces <a>
  children: React.ReactNode;     // label or escape-hatch content

  className?: string;
  'aria-label'?: string;
}
```

**Element selection rules**

- `as` provided → use it.
- Otherwise `href` → `<a>`; `onClick` → `<button>`; else `<span>`.
- `onRemove` always renders an inner `<button>` regardless of wrapper.

## Render model

Wrapper element (`position: relative`, inline-flex, padding tuned by shape via CSS vars) contains:

1. **Decoration layer**: `<svg>` absolutely positioned, `inset: 0`, `width: 100%`, `height: 100%`, `pointer-events: none`. Contains up to three `<path>` elements:
   - `fill` path — shown when variant uses fill (`solid`, `subtle`).
   - `stroke` path — shown when variant uses border (`outline`, `solid`).
   - `focus` path — same geometry, offset outward by ~2px, stroke-only, shown when wrapper matches `:focus-visible`.
2. **Content layer**: flex row, gap depends on size. Order: optional dot, optional leading icon, label (`children`), optional remove button.

The decoration layer is invisible to assistive tech (`aria-hidden="true"`).

## Tone × variant

Tones resolve through CSS vars:

```css
--badge-edge: var(--wzl-accent, #7fb069);  /* set per tone */
--badge-fill: var(--wzl-bg, #1e1610);
--badge-fg:   var(--badge-edge);
```

Per-tone mappings live in `Badge.module.css`:

| Tone    | `--badge-edge` source             |
|---------|------------------------------------|
| accent  | `--wzl-accent` (green default)    |
| info    | hard-coded blue with weasel feel  |
| warn    | hard-coded amber                  |
| danger  | hard-coded red (matches inactive) |
| muted   | `--wzl-muted`                     |
| neutral | `--wzl-panel-border`              |

(The hard-coded colors mirror the existing slot pill palette so the migration is exact.)

Variants change which paths render and how `--badge-fg` is derived:

| Variant | fill path                              | stroke path | text color                        |
|---------|----------------------------------------|-------------|-----------------------------------|
| outline | `var(--wzl-bg)`                        | `--badge-edge` | `--badge-edge`                |
| solid   | `--badge-edge`                         | `--badge-edge` | tone-foreground (usually white) |
| subtle  | `color-mix(in oklab, var(--badge-edge) 14%, transparent)` | none | `--badge-edge` |

`tone-foreground` falls back to `#fff` for all current tones (validated against contrast in Storybook).

## Shapes

Each shape file exports a default component plus metadata:

```ts
interface ShapeModule {
  Component: React.FC<ShapeRenderProps>;
  insets: { top: number; right: number; bottom: number; left: number };
  stretches: boolean;
  defaultAspect?: number; // only when !stretches
}

interface ShapeRenderProps {
  // Refs to the three path nodes the wrapper provides; the shape
  // component sets their `d` attributes (and any decorative children).
  variant: BadgeVariant;
}
```

`shapes/index.ts` exports `SHAPES: Record<BadgeShape, ShapeModule>`. Wrapper looks up the entry by `shape` prop, applies `insets` as CSS padding overrides, and renders the shape's `Component` inside the SVG.

**Stretchy shapes** (any content width):
- `pill` — fully rounded rect (`r = h/2`)
- `square` — rect with small corner radius
- `notched` — rect with quarter-circle concave cutouts at each corner (the inverse-radius square the user described)
- `perforated` — postage-stamp; perimeter notches generated procedurally so semicircle count adapts to width
- `banner` — `<===>`, pointed both ends
- `chevron` — single-pointed banner (right-pointing)
- `ribbon` — rectangle with swallowtail forked cut at the trailing end
- `scalloped` — repeating concave arcs around the entire perimeter

**Fixed-aspect shapes** (size from content + minimum aspect):
- `dot` — pure circle, content typically `dot`-only
- `diamond` — rotated square
- `hexagon` — regular hex, point-up
- `shield` — heraldic, 4:5 aspect
- `starburst` — 12-point burst with slight rotation jitter for the Beavis-and-Butthead read

For fixed-aspect shapes that contain text, the wrapper sizes the badge to the larger of the content's natural size and the shape's minimum bounding box. Long labels in fixed-aspect shapes wrap; that's documented as a known constraint with `pill` being the recommended shape for arbitrary text.

## Sizes

```
sm: padding 1px 6px,  font-size 10px,  icon 12px, gap 4px
md: padding 3px 10px, font-size 12px,  icon 14px, gap 6px
```

Per-shape `insets` add to padding (e.g. `banner` adds left/right inset so text clears the points).

## Interactive behavior

- **Clickable wrapper** (`onClick` or `as='button'`): renders `<button type="button">`, cursor pointer, `:focus-visible` activates the focus path. `:hover` lightens `--badge-edge` by ~10%.
- **Removable** (`onRemove`): trailing `<button type="button" aria-label="Remove">` with × glyph (or consumer-overridable via `removeLabel` prop). `onClick` stops propagation so wrapper click doesn't fire. Tab order: wrapper first, then remove.
- All interactive elements honor reduced motion (no hover transitions when `prefers-reduced-motion: reduce`).

## Storybook

`Badge.stories.tsx` exposes:

- **Default**: controls panel covering every prop.
- **AllShapes**: grid of every shape with identical content ("LABEL").
- **ToneVariantMatrix**: rows = tones, columns = variants.
- **Sizes**: `sm` and `md` side by side.
- **WithDot**, **WithLeadingIcon**, **Removable**, **Clickable**.
- **EdgeCases**: very long label (pill, banner, fixed-aspect contrast), dot-only, icon-only, empty children.
- **SlotPillReplica**: side-by-side comparison of the old `.slot` styling vs. the new `<Badge>` to verify migration parity.

## Testing

`Badge.test.tsx` covers:

- Renders correct element for `as` / `href` / `onClick` permutations.
- Shape registry lookup: each shape produces an SVG path of expected count (1, 2, or 3 paths depending on variant + focus state).
- Tone mapping sets the expected `--badge-edge` value (read via `getComputedStyle` or by asserting the data attribute the component writes).
- `onClick` fires for wrapper click but not for remove-button click; remove fires `onRemove` and stops propagation.
- `aria-label` falls through; default remove button has accessible name.
- Focus path appears only when wrapper has `:focus-visible` (jsdom limitation — assert the CSS rule existence rather than computed visibility).

No snapshot tests for shape geometry; Storybook gallery is the source of truth there.

## Migration

After Badge lands, edit `apps/swillustrator/src/dev/ToolkitBuilder.tsx:485`:

```tsx
const SLOT_TONE = {
  active: 'accent',
  ambient: 'warn',
  hotkey: 'info',
  inactive: 'danger',
} as const;

render: (r) => {
  const slot = slotFor(r.toolId);
  return (
    <Badge
      shape="pill"
      size="sm"
      tone={SLOT_TONE[slot]}
      variant={slot === 'inactive' ? 'solid' : 'outline'}
    >
      {slot}
    </Badge>
  );
},
```

Delete the `.slot` block at `ToolkitBuilder.module.css:150-171`. Verify the Toolkit Builder view in dev looks identical (SlotPillReplica story is the side-by-side check).

## Open questions

- Should the focus-ring path live in the SVG or as a separate sibling SVG (z-order considerations vs. fill/stroke when the ring needs to sit *above* the fill)? Plan: same SVG, ring path last in document order. Revisit if visual issues arise.
- Whether to ship a `count` prop variant (numeric badge) now or wait for a real consumer. **Defer** — current YAGNI, easy to add later.
