# Powerline — composed badge row design

## Goal

A composed badge row in the spirit of a [Powerline](https://github.com/powerline/powerline) shell prompt: a horizontal strip of segments where each segment ends in a shaped cap (chevron, slant, scallop, round, flat, …), and the next segment's left edge fits that cap exactly so the segments tessellate without gaps or overlaps.

The component lives in `@orochi235/weasel-ui` alongside `Badge` and reuses Badge's machinery (tones, variants, sizes, effects, perimeter sampler) by adding a new `BadgeBase` rather than reimplementing badge rendering.

## API

```tsx
import { Powerline } from '@orochi235/weasel-ui';

<Powerline
  startCap="flat"
  segments={[
    { text: 'main',   tone: 'success', endCap: 'chevron' },
    { text: '✓ 12',   tone: 'neutral', endCap: 'slant' },
    { text: '↑3 ↓1',  tone: 'warning', endCap: 'scallop' },
    { text: '~/proj', tone: 'info' },
  ]}
  size="sm"
  variant="solid"
/>
```

### Props

```ts
interface PowerlineProps {
  segments: PowerlineSegment[];
  startCap?: EdgeCap;        // left edge of the first segment; default 'flat'
  size?: BadgeSize;          // applied to every segment unless overridden per-segment
  variant?: BadgeVariant;    // ditto
  className?: string;
  'aria-label'?: string;
}

interface PowerlineSegment {
  text: ReactNode;
  endCap?: EdgeCap;          // cap on this segment's right edge; default 'flat'
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  onClick?: () => void;
  href?: string;
  'aria-label'?: string;
}

type EdgeCap = BuiltInEdgeName | EdgeProfile;
type BuiltInEdgeName = 'flat' | 'chevron' | 'slant' | 'slant-up' | 'round' | 'scallop' | 'concave-chevron';
type EdgeProfile = (t: number, depth: number) => number;
// t ∈ [0,1] (top→bottom); depth = base's protrusion budget in CSS px; returns x-offset in CSS px
```

The row renders one `<Badge base="powerline" ... />` per segment. Segment N's `endCap` is threaded as segment N+1's `leftEdge`; the first segment's `leftEdge` is `startCap`; the last segment's `rightEdge` is its own `endCap` (default `flat`).

### Tessellation contract

An **edge profile** is a pure function `t → xOffset` over the vertical range of the segment, in CSS pixels relative to the unprotruded edge. Positive values protrude rightward; negative values cut inward.

Two segments share an edge by passing the *same* profile to one's `rightEdge` and the other's `leftEdge`. Because the curve is identical, the edges meet exactly — no inversion math, no "complementary cap" registry. Asymmetric joins (intentional gap or overlap) are out of scope for v1.

## Implementation

### New `BadgeBase`: `powerline`

Lives at `packages/weasel-ui/src/components/Badge/bases/Powerline.tsx`. Implements the existing `BadgeBase` contract:

```ts
{
  defaults: { leftEdge: 'flat', rightEdge: 'flat', depth: 6 },
  build(params, w, h) {
    const left = resolveEdge(params.leftEdge);
    const right = resolveEdge(params.rightEdge);
    // sample top→right→bottom→left perimeter, with left/right edges driven by the profiles
    // return { perimeterAt, totalCss, bodyPath }
  },
  insets(params) {
    // expand horizontal padding by the protrusion depth of the inward-cutting parts
    // so text doesn't collide with chevron tips, etc.
  },
}
```

Because this base produces a valid closed-perimeter sampler, every existing Badge feature — `tone`, `variant`, `bevel`, `crawl`, perimeter effects, focus ring — continues to work on each segment with no extra code.

### Edge profile registry

`packages/weasel-ui/src/components/Badge/bases/edgeProfiles.ts`:

```ts
export const EDGE_PROFILES: Record<BuiltInEdgeName, EdgeProfile> = {
  flat:               (_t, _d) => 0,
  chevron:            (t, d)   => (1 - Math.abs(t - 0.5) * 2) * d,
  slant:              (t, d)   => t * d,
  'slant-up':         (t, d)   => (1 - t) * d,
  round:              (t, d)   => Math.sin(t * Math.PI) * d,
  scallop:            (t, d)   => Math.sin(t * Math.PI * 3) * 0.4 * d,
  'concave-chevron':  (t, d)   => -(1 - Math.abs(t - 0.5) * 2) * d,
};
```

The registry is open: users may pass a custom `EdgeProfile` function as an `endCap`. `resolveEdge(name | fn)` returns the function; `Powerline.tsx` invokes it as `profile(t, params.depth)` while building the perimeter.

### `Powerline` component

`packages/weasel-ui/src/components/Powerline/Powerline.tsx`:

```tsx
export function Powerline({ segments, startCap = 'flat', size, variant, ...rest }: PowerlineProps) {
  return (
    <span className={s.row} {...rest}>
      {segments.map((seg, i) => {
        const leftEdge = i === 0 ? startCap : segments[i - 1].endCap ?? 'flat';
        const rightEdge = seg.endCap ?? 'flat';
        return (
          <Badge
            key={i}
            base="powerline"
            baseParams={{ leftEdge, rightEdge }}
            tone={seg.tone}
            variant={seg.variant ?? variant}
            size={seg.size ?? size}
            onClick={seg.onClick}
            href={seg.href}
            aria-label={seg['aria-label']}
          >
            {seg.text}
          </Badge>
        );
      })}
    </span>
  );
}
```

The row container uses `display: inline-flex` and zero gap so segments butt up.

### CSS

`Powerline.module.css` — minimal:

```css
.row { display: inline-flex; align-items: stretch; gap: 0; }
```

No special rules for the segments themselves; Badge handles all of that.

## Files added

- `packages/weasel-ui/src/components/Badge/bases/Powerline.tsx`
- `packages/weasel-ui/src/components/Badge/bases/edgeProfiles.ts`
- `packages/weasel-ui/src/components/Badge/bases/index.ts` — register `powerline`
- `packages/weasel-ui/src/components/Badge/bases/types.ts` — add `BadgeBaseParams['powerline']`
- `packages/weasel-ui/src/components/Powerline/Powerline.tsx`
- `packages/weasel-ui/src/components/Powerline/Powerline.module.css`
- `packages/weasel-ui/src/components/Powerline/Powerline.stories.tsx`
- `packages/weasel-ui/src/components/Powerline/index.ts`
- `packages/weasel-ui/src/index.ts` — export `Powerline`, `EDGE_PROFILES`, types

## Files modified

- `packages/weasel-ui/src/components/Badge/bases/index.ts` — register the new base
- `packages/weasel-ui/src/components/Badge/bases/types.ts` — extend `BadgeBaseParams`

## Non-goals

- Row-level `effects` / `crawl` / shared decorations: deferred. Per-segment is sufficient for v1, and row-level is a thin sugar layer that can be added later without breaking changes.
- Asymmetric joins (intentional gap or overlap between two segments with different profiles): deferred. The shared-profile contract is the v1 invariant.
- Vertical/stacked orientation: out of scope.
- Interactive segment animations (hover-grow, expand-to-reveal): out of scope.

## Open name question

`Powerline` is the working name. `PowerStrip` is a candidate; the electrical-outlet reading is the strike against it. Decided: `Powerline`.

## Validation

- Storybook: a stories file that exercises every built-in cap, mixed-tone rows, and a custom `EdgeProfile` function.
- Visual check: at every standard Badge size (`xs`, `sm`, `md`, `lg`), segments should butt with no visible seam, no pixel gap, no overlap.
- Effects-compat check: apply `crawl`, `bevel`, and one perimeter effect to a powerline segment and confirm they render around the actual cap silhouette (this is the payoff of base-level integration).
