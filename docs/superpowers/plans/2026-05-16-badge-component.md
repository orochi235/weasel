# Badge Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a reusable `Badge` component in `@orochi235/weasel-ui` with 13 SVG-drawn border shapes, three visual variants, six tones, interactive affordances (clickable, removable), and Storybook coverage; migrate the existing slot pill in `ToolkitBuilder` to use it.

**Architecture:** Single React component with prop-driven API plus children escape hatch. Each badge renders an absolutely-positioned `<svg>` (fill/stroke/focus paths) underneath an HTML flex content row (dot, icon, label, remove). Shape geometry lives in `shapes/<Name>.tsx` modules registered in `shapes/index.ts`. Tone and variant resolve to two CSS custom properties (`--badge-edge`, `--badge-fill`) on the wrapper.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest + @testing-library/react, Storybook (`@storybook/react-vite`). Existing weasel-theme tokens for color.

**Spec:** `docs/superpowers/specs/2026-05-16-badge-component-design.md`

---

## File Structure

**New files (all under `packages/weasel-ui/src/components/Badge/`):**
- `index.ts` — re-exports
- `Badge.tsx` — wrapper component
- `Badge.module.css` — layout, tone classes, variant rules
- `Badge.test.tsx` — unit tests
- `Badge.stories.tsx` — Storybook
- `types.ts` — shared TS types (`BadgeShape`, `BadgeTone`, `BadgeVariant`, `BadgeSize`, `ShapeModule`)
- `shapes/index.ts` — `SHAPES` registry
- `shapes/Pill.tsx`, `Square.tsx`, `Notched.tsx`, `Perforated.tsx`, `Diamond.tsx`, `Dot.tsx`, `Hexagon.tsx`, `Chevron.tsx`, `Banner.tsx`, `Starburst.tsx`, `Scalloped.tsx`, `Shield.tsx`, `Ribbon.tsx`

**Modified files:**
- `packages/weasel-ui/src/index.ts` — add Badge exports
- `apps/swillustrator/src/dev/ToolkitBuilder.tsx` — replace slot pill (line ~485) with `<Badge>`
- `apps/swillustrator/src/dev/ToolkitBuilder.module.css` — remove `.slot` rules (lines ~150-171)

---

## Task 1: Scaffold types + empty shape registry

**Files:**
- Create: `packages/weasel-ui/src/components/Badge/types.ts`
- Create: `packages/weasel-ui/src/components/Badge/shapes/index.ts`
- Create: `packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
- Create: `packages/weasel-ui/src/components/Badge/index.ts`

- [ ] **Step 1: Write the failing registry test**

```ts
// packages/weasel-ui/src/components/Badge/shapes/index.test.ts
import { describe, it, expect } from 'vitest';
import { SHAPES, ALL_SHAPES } from './index';

describe('shape registry', () => {
  it('lists every supported shape', () => {
    expect(ALL_SHAPES).toEqual([
      'pill', 'square', 'notched', 'perforated',
      'diamond', 'dot', 'hexagon', 'chevron', 'banner',
      'starburst', 'scalloped', 'shield', 'ribbon',
    ]);
  });

  it('each shape entry has Component + insets + stretches', () => {
    for (const name of ALL_SHAPES) {
      const m = SHAPES[name];
      expect(m.Component).toBeDefined();
      expect(m.insets).toMatchObject({ top: expect.any(Number), right: expect.any(Number), bottom: expect.any(Number), left: expect.any(Number) });
      expect(typeof m.stretches).toBe('boolean');
    }
  });
});
```

- [ ] **Step 2: Run the test and confirm it fails**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: FAIL with module not found.

- [ ] **Step 3: Create the types file**

```ts
// packages/weasel-ui/src/components/Badge/types.ts
import type { ReactNode } from 'react';

export type BadgeShape =
  | 'pill' | 'square' | 'notched' | 'perforated'
  | 'diamond' | 'dot' | 'hexagon' | 'chevron' | 'banner'
  | 'starburst' | 'scalloped' | 'shield' | 'ribbon';

export type BadgeTone =
  | 'accent' | 'info' | 'warn' | 'danger' | 'muted' | 'neutral';

export type BadgeVariant = 'outline' | 'solid' | 'subtle';
export type BadgeSize = 'sm' | 'md';

export interface ShapeRenderProps {
  variant: BadgeVariant;
  focused: boolean;
}

export interface ShapeModule {
  Component: (props: ShapeRenderProps) => ReactNode;
  insets: { top: number; right: number; bottom: number; left: number };
  stretches: boolean;
  defaultAspect?: number;
}
```

- [ ] **Step 4: Create the registry with stub entries**

Stub every shape with a trivial component that renders an empty `<g/>` for now; later tasks fill them in. This keeps the registry test green from the start.

```tsx
// packages/weasel-ui/src/components/Badge/shapes/index.ts
import type { BadgeShape, ShapeModule } from '../types';

const stub: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export const SHAPES: Record<BadgeShape, ShapeModule> = {
  pill: stub,
  square: stub,
  notched: stub,
  perforated: stub,
  diamond: stub,
  dot: stub,
  hexagon: stub,
  chevron: stub,
  banner: stub,
  starburst: stub,
  scalloped: stub,
  shield: stub,
  ribbon: stub,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'square', 'notched', 'perforated',
  'diamond', 'dot', 'hexagon', 'chevron', 'banner',
  'starburst', 'scalloped', 'shield', 'ribbon',
];
```

- [ ] **Step 5: Create the package index**

```ts
// packages/weasel-ui/src/components/Badge/index.ts
export { Badge } from './Badge';
export type { BadgeProps } from './Badge';
export type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';
```

Note: `Badge.tsx` doesn't exist yet — Task 2 creates it. The index file will fail to type-check until then. That's fine for now (we're not running tsc this step).

- [ ] **Step 6: Run the registry test, confirm pass**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/weasel-ui/src/components/Badge
git commit -m "feat(weasel-ui): scaffold Badge types + shape registry"
```

---

## Task 2: Badge wrapper with pill shape, tone, variant, size

**Files:**
- Create: `packages/weasel-ui/src/components/Badge/Badge.tsx`
- Create: `packages/weasel-ui/src/components/Badge/Badge.module.css`
- Create: `packages/weasel-ui/src/components/Badge/Badge.test.tsx`
- Modify: `packages/weasel-ui/src/components/Badge/shapes/Pill.tsx` (new file replaces stub)
- Modify: `packages/weasel-ui/src/components/Badge/shapes/index.ts`

- [ ] **Step 1: Write the failing Badge test**

```tsx
// packages/weasel-ui/src/components/Badge/Badge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders label as a span by default', () => {
    const { container, getByText } = render(<Badge>hello</Badge>);
    expect(getByText('hello')).toBeDefined();
    expect(container.firstElementChild?.tagName).toBe('SPAN');
  });

  it('applies tone via data-tone attribute', () => {
    const { container } = render(<Badge tone="accent">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-tone')).toBe('accent');
  });

  it('applies variant via data-variant attribute', () => {
    const { container } = render(<Badge variant="solid">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-variant')).toBe('solid');
  });

  it('applies size via data-size attribute', () => {
    const { container } = render(<Badge size="md">x</Badge>);
    expect(container.firstElementChild?.getAttribute('data-size')).toBe('md');
  });

  it('renders an svg decoration layer', () => {
    const { container } = render(<Badge shape="pill">x</Badge>);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, confirm it fails**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: FAIL (Badge module not found).

- [ ] **Step 3: Create Pill shape**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Pill.tsx
import type { ShapeModule } from '../types';

const Pill: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" rx="50" ry="50" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="1" y="1" width="98" height="98" rx="49" ry="49" />
      )}
      {focused && (
        <rect className="badge-focus" x="-3" y="-3" width="106" height="106" rx="53" ry="53" />
      )}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export default Pill;
```

Note: SVG uses `preserveAspectRatio="none"` (set on the parent `<svg>`) so the 100×100 coord box stretches to the badge's actual width/height. `rx`/`ry` therefore become elliptical in the stretched state — exactly what we want for a pill.

- [ ] **Step 4: Wire Pill into the registry**

```ts
// packages/weasel-ui/src/components/Badge/shapes/index.ts
import type { BadgeShape, ShapeModule } from '../types';
import Pill from './Pill';

const stub: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export const SHAPES: Record<BadgeShape, ShapeModule> = {
  pill: Pill,
  square: stub,
  notched: stub,
  perforated: stub,
  diamond: stub,
  dot: stub,
  hexagon: stub,
  chevron: stub,
  banner: stub,
  starburst: stub,
  scalloped: stub,
  shield: stub,
  ribbon: stub,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'square', 'notched', 'perforated',
  'diamond', 'dot', 'hexagon', 'chevron', 'banner',
  'starburst', 'scalloped', 'shield', 'ribbon',
];
```

- [ ] **Step 5: Create Badge.module.css**

```css
/* packages/weasel-ui/src/components/Badge/Badge.module.css */

.badge {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: var(--badge-gap, 4px);
  padding: var(--badge-pad-y, 1px) var(--badge-pad-x, 6px);
  font-size: var(--badge-font-size, 10px);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--badge-fg, var(--wzl-muted, #a59685));
  /* Edge/fill defaults come from tone class below */
  --badge-edge: var(--wzl-panel-border, #4a3c2e);
  --badge-fill: var(--wzl-bg, #1e1610);
  --badge-fg: var(--badge-edge);
  background: transparent;
  border: 0;
  font: inherit;
  font-family: inherit;
}

.badge[data-size='md'] {
  --badge-gap: 6px;
  --badge-pad-x: 10px;
  --badge-pad-y: 3px;
  --badge-font-size: 12px;
}

/* Decoration layer — absolutely positioned, fills wrapper */
.deco {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  overflow: visible;
}
.deco :global(.badge-fill)   { fill: var(--badge-fill); stroke: none; }
.deco :global(.badge-stroke) { fill: none; stroke: var(--badge-edge); stroke-width: 1; vector-effect: non-scaling-stroke; }
.deco :global(.badge-focus)  { fill: none; stroke: var(--badge-edge); stroke-width: 2; vector-effect: non-scaling-stroke; opacity: 0.6; }

/* Content layer sits above the SVG */
.content {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: inherit;
  z-index: 1;
}

/* Tones — set --badge-edge */
.badge[data-tone='accent']  { --badge-edge: var(--wzl-accent, #7fb069); }
.badge[data-tone='info']    { --badge-edge: #7ab8d4; }
.badge[data-tone='warn']    { --badge-edge: #d4a574; }
.badge[data-tone='danger']  { --badge-edge: #c43c3c; }
.badge[data-tone='muted']   { --badge-edge: var(--wzl-muted, #a59685); }
.badge[data-tone='neutral'] { --badge-edge: var(--wzl-panel-border, #4a3c2e); --badge-fg: var(--wzl-muted, #a59685); }

/* Variants */
.badge[data-variant='outline'] {
  --badge-fill: var(--wzl-bg, #1e1610);
  --badge-fg: var(--badge-edge);
}
.badge[data-variant='solid'] {
  --badge-fill: var(--badge-edge);
  --badge-fg: #fff;
  font-weight: 600;
}
.badge[data-variant='subtle'] {
  --badge-fill: color-mix(in oklab, var(--badge-edge) 14%, transparent);
  --badge-fg: var(--badge-edge);
}
```

- [ ] **Step 6: Create Badge.tsx**

```tsx
// packages/weasel-ui/src/components/Badge/Badge.tsx
import type { ReactNode } from 'react';
import s from './Badge.module.css';
import { SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

export interface BadgeProps {
  shape?: BadgeShape;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  children: ReactNode;
  className?: string;
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    children,
    className,
  } = props;

  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  return (
    <span
      className={cls}
      data-shape={shape}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
    >
      <svg
        className={s.deco}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ShapeBody variant={variant} focused={false} />
      </svg>
      <span className={s.content}>{children}</span>
    </span>
  );
}
```

- [ ] **Step 7: Run the test, confirm pass**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: PASS (5 tests).

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit -p packages/weasel-ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add packages/weasel-ui/src/components/Badge
git commit -m "feat(weasel-ui): Badge wrapper + pill shape + tone/variant/size"
```

---

## Task 3: CSS-tier shapes (square, notched, perforated, diamond, dot, hexagon, chevron, banner)

Each shape adds a file under `shapes/`, replaces the stub entry in the registry, and adds one assertion to the registry test that the shape renders at least one path/circle element.

**Files:**
- Create: `shapes/Square.tsx`, `Notched.tsx`, `Perforated.tsx`, `Diamond.tsx`, `Dot.tsx`, `Hexagon.tsx`, `Chevron.tsx`, `Banner.tsx`
- Modify: `shapes/index.ts`
- Modify: `shapes/index.test.ts`

- [ ] **Step 1: Write the failing rendering test**

Append to `shapes/index.test.ts`:

```tsx
import { render } from '@testing-library/react';
import { ALL_SHAPES, SHAPES } from './index';

describe('every shape renders at least one geometry element', () => {
  for (const name of ALL_SHAPES) {
    it(`${name} renders content for outline variant`, () => {
      const { Component } = SHAPES[name];
      const { container } = render(
        <svg viewBox="0 0 100 100">
          <Component variant="outline" focused={false} />
        </svg>,
      );
      const geom = container.querySelectorAll('rect, circle, path, polygon, ellipse, line');
      expect(geom.length).toBeGreaterThan(0);
    });
  }
});
```

- [ ] **Step 2: Run the test, confirm 12 failures (one per stubbed shape)**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: pill passes; the other 12 fail because the stub returns null.

- [ ] **Step 3: Implement Square**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Square.tsx
import type { ShapeModule } from '../types';

const Square: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" rx="8" ry="8" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="1" y="1" width="98" height="98" rx="7" ry="7" />
      )}
      {focused && (
        <rect className="badge-focus" x="-3" y="-3" width="106" height="106" rx="11" ry="11" />
      )}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export default Square;
```

- [ ] **Step 4: Implement Notched (concave quarter-circle corners)**

The shape is a square with quarter-circle cuts radially inward at each corner. Built as a single `<path>`. Coordinates in the 100×100 box: corner radius `r=14` (visual constant; tweak if needed).

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Notched.tsx
import type { ShapeModule } from '../types';

// Square with concave quarter-circle cutouts at each corner.
// Path walks: TL→TR→BR→BL, drawing inward arcs at corners.
function notchedPath(r = 14) {
  const W = 100, H = 100;
  return [
    `M ${r} 0`,
    `L ${W - r} 0`,
    `A ${r} ${r} 0 0 0 ${W} ${r}`,
    `L ${W} ${H - r}`,
    `A ${r} ${r} 0 0 0 ${W - r} ${H}`,
    `L ${r} ${H}`,
    `A ${r} ${r} 0 0 0 0 ${H - r}`,
    `L 0 ${r}`,
    `A ${r} ${r} 0 0 0 ${r} 0`,
    'Z',
  ].join(' ');
}

const d = notchedPath();

const Notched: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <path className="badge-fill" d={d} />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <path className="badge-stroke" d={d} />
      )}
      {focused && <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />}
    </>
  ),
  insets: { top: 0, right: 4, bottom: 0, left: 4 },
  stretches: true,
};

export default Notched;
```

- [ ] **Step 5: Implement Perforated (postage stamp)**

Renders the badge silhouette via SVG `<mask>` so the perforation notches actually cut out (rather than just being drawn). For simplicity at this scale, use a fixed 14-notches-per-side layout against the 100×100 coord box; `preserveAspectRatio="none"` stretches the ovals along x — which is OK because the notches are tiny and the visual still reads as perforated.

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Perforated.tsx
import type { ShapeModule } from '../types';

const COUNT = 14;
const R = 3; // notch radius in 100-unit coord box

function notchCircles() {
  const c: { cx: number; cy: number }[] = [];
  for (let i = 0; i < COUNT; i++) {
    const t = (i + 0.5) / COUNT;
    c.push({ cx: t * 100, cy: 0 });
    c.push({ cx: t * 100, cy: 100 });
  }
  for (let i = 0; i < COUNT; i++) {
    const t = (i + 0.5) / COUNT;
    c.push({ cx: 0, cy: t * 100 });
    c.push({ cx: 100, cy: t * 100 });
  }
  return c;
}

const NOTCHES = notchCircles();
const MASK_ID = 'badge-perforated-mask';

const Perforated: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      <defs>
        <mask id={MASK_ID} maskUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110">
          <rect x="0" y="0" width="100" height="100" fill="white" />
          {NOTCHES.map((n, i) => (
            <circle key={i} cx={n.cx} cy={n.cy} r={R} fill="black" />
          ))}
        </mask>
      </defs>
      {(variant === 'solid' || variant === 'subtle') && (
        <rect className="badge-fill" x="0" y="0" width="100" height="100" mask={`url(#${MASK_ID})`} />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <rect className="badge-stroke" x="0" y="0" width="100" height="100" mask={`url(#${MASK_ID})`} />
      )}
      {focused && (
        <rect className="badge-focus" x="-4" y="-4" width="108" height="108" mask={`url(#${MASK_ID})`} />
      )}
    </>
  ),
  insets: { top: 2, right: 4, bottom: 2, left: 4 },
  stretches: true,
};

export default Perforated;
```

(Multiple Badge instances on a page will share the mask id. That's fine — SVG `<defs>` are scoped per `<svg>` and Badge uses its own `<svg>` per instance.)

- [ ] **Step 6: Implement Diamond**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Diamond.tsx
import type { ShapeModule } from '../types';

const d = 'M 50 2 L 98 50 L 50 98 L 2 50 Z';

const Diamond: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M 50 -4 L 104 50 L 50 104 L -4 50 Z" />}
    </>
  ),
  insets: { top: 4, right: 12, bottom: 4, left: 12 },
  stretches: false,
  defaultAspect: 1,
};

export default Diamond;
```

- [ ] **Step 7: Implement Dot**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Dot.tsx
import type { ShapeModule } from '../types';

const Dot: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && (
        <circle className="badge-fill" cx="50" cy="50" r="50" />
      )}
      {(variant === 'outline' || variant === 'solid') && (
        <circle className="badge-stroke" cx="50" cy="50" r="49" />
      )}
      {focused && <circle className="badge-focus" cx="50" cy="50" r="54" />}
    </>
  ),
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: false,
  defaultAspect: 1,
};

export default Dot;
```

- [ ] **Step 8: Implement Hexagon (point-up)**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Hexagon.tsx
import type { ShapeModule } from '../types';

// Regular hex, point-up, inscribed in the 100×100 box.
const d = 'M 50 2 L 96 27 L 96 73 L 50 98 L 4 73 L 4 27 Z';

const Hexagon: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d="M 50 -3 L 101 24 L 101 76 L 50 103 L -1 76 L -1 24 Z" />
      )}
    </>
  ),
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: false,
  defaultAspect: 1.15,
};

export default Hexagon;
```

- [ ] **Step 9: Implement Chevron (right-pointing banner)**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Chevron.tsx
import type { ShapeModule } from '../types';

// Rectangle with a triangular point on the right.
const d = 'M 0 0 L 88 0 L 100 50 L 88 100 L 0 100 Z';

const Chevron: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M -3 -3 L 89 -3 L 104 50 L 89 103 L -3 103 Z" />}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 0 },
  stretches: true,
};

export default Chevron;
```

- [ ] **Step 10: Implement Banner (pointed both ends)**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Banner.tsx
import type { ShapeModule } from '../types';

const d = 'M 0 50 L 12 0 L 88 0 L 100 50 L 88 100 L 12 100 Z';

const Banner: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d="M -4 50 L 11 -3 L 89 -3 L 104 50 L 89 103 L 11 103 Z" />}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 10 },
  stretches: true,
};

export default Banner;
```

- [ ] **Step 11: Update the registry**

```ts
// packages/weasel-ui/src/components/Badge/shapes/index.ts
import type { BadgeShape, ShapeModule } from '../types';
import Pill from './Pill';
import Square from './Square';
import Notched from './Notched';
import Perforated from './Perforated';
import Diamond from './Diamond';
import Dot from './Dot';
import Hexagon from './Hexagon';
import Chevron from './Chevron';
import Banner from './Banner';

const stub: ShapeModule = {
  Component: () => null,
  insets: { top: 0, right: 0, bottom: 0, left: 0 },
  stretches: true,
};

export const SHAPES: Record<BadgeShape, ShapeModule> = {
  pill: Pill,
  square: Square,
  notched: Notched,
  perforated: Perforated,
  diamond: Diamond,
  dot: Dot,
  hexagon: Hexagon,
  chevron: Chevron,
  banner: Banner,
  starburst: stub,
  scalloped: stub,
  shield: stub,
  ribbon: stub,
};

export const ALL_SHAPES: BadgeShape[] = [
  'pill', 'square', 'notched', 'perforated',
  'diamond', 'dot', 'hexagon', 'chevron', 'banner',
  'starburst', 'scalloped', 'shield', 'ribbon',
];
```

- [ ] **Step 12: Run the registry tests, confirm pill+8 pass, 4 still fail**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: 9 shape-rendering tests pass; starburst/scalloped/shield/ribbon fail (still stubbed). The 2 baseline registry tests still pass.

- [ ] **Step 13: Commit**

```bash
git add packages/weasel-ui/src/components/Badge/shapes
git commit -m "feat(weasel-ui): Badge CSS-tier shapes (square, notched, perforated, diamond, dot, hexagon, chevron, banner)"
```

---

## Task 4: SVG-tier shapes (starburst, scalloped, shield, ribbon)

**Files:**
- Create: `shapes/Starburst.tsx`, `Scalloped.tsx`, `Shield.tsx`, `Ribbon.tsx`
- Modify: `shapes/index.ts`

- [ ] **Step 1: Run the registry tests, observe the four expected failures**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: starburst, scalloped, shield, ribbon tests fail (no geometry rendered).

- [ ] **Step 2: Implement Starburst**

A 12-point burst built by alternating long and short radii around a circle. Slight rotation makes it feel hand-drawn.

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Starburst.tsx
import type { ShapeModule } from '../types';

function starburstPath(points = 12, outerR = 48, innerR = 36, rotation = -7) {
  const cx = 50, cy = 50;
  const total = points * 2;
  const step = (Math.PI * 2) / total;
  const start = (rotation * Math.PI) / 180;
  let d = '';
  for (let i = 0; i < total; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const a = start + i * step;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    d += (i === 0 ? 'M ' : ' L ') + x.toFixed(2) + ' ' + y.toFixed(2);
  }
  return d + ' Z';
}

const d = starburstPath();
const dFocus = starburstPath(12, 52, 39, -7);

const Starburst: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && <path className="badge-focus" d={dFocus} />}
    </>
  ),
  insets: { top: 14, right: 14, bottom: 14, left: 14 },
  stretches: false,
  defaultAspect: 1,
};

export default Starburst;
```

- [ ] **Step 3: Implement Scalloped**

Border is a series of concave arcs. Sixteen scallops total (four per side) at 100×100.

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Scalloped.tsx
import type { ShapeModule } from '../types';

function scallopedPath(perSide = 4) {
  const W = 100, H = 100;
  const segW = W / perSide;
  const segH = H / perSide;
  const sweep = 0; // arcs bulge inward
  let d = `M 0 0`;
  for (let i = 0; i < perSide; i++) {
    const x = (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} 0`;
  }
  for (let i = 0; i < perSide; i++) {
    const y = (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} ${W} ${y}`;
  }
  for (let i = 0; i < perSide; i++) {
    const x = W - (i + 1) * segW;
    d += ` A ${segW / 2} ${segW / 2} 0 0 ${sweep} ${x} ${H}`;
  }
  for (let i = 0; i < perSide; i++) {
    const y = H - (i + 1) * segH;
    d += ` A ${segH / 2} ${segH / 2} 0 0 ${sweep} 0 ${y}`;
  }
  return d + ' Z';
}

const d = scallopedPath();

const Scalloped: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.06) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 4, right: 6, bottom: 4, left: 6 },
  stretches: true,
};

export default Scalloped;
```

- [ ] **Step 4: Implement Shield**

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Shield.tsx
import type { ShapeModule } from '../types';

// Top: flat shoulders rounded slightly. Bottom: curves down to a point.
const d = 'M 8 4 Q 8 0 12 0 L 88 0 Q 92 0 92 4 L 92 55 Q 92 86 50 100 Q 8 86 8 55 Z';

const Shield: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path className="badge-focus" d={d} transform="translate(50 50) scale(1.07) translate(-50 -50)" />
      )}
    </>
  ),
  insets: { top: 2, right: 8, bottom: 12, left: 8 },
  stretches: false,
  defaultAspect: 0.85,
};

export default Shield;
```

- [ ] **Step 5: Implement Ribbon (swallowtail)**

Rectangle with a triangular V cut from the right side.

```tsx
// packages/weasel-ui/src/components/Badge/shapes/Ribbon.tsx
import type { ShapeModule } from '../types';

const d = 'M 0 0 L 88 0 L 100 50 L 88 100 L 0 100 L 12 50 Z';

const Ribbon: ShapeModule = {
  Component: ({ variant, focused }) => (
    <>
      {(variant === 'solid' || variant === 'subtle') && <path className="badge-fill" d={d} />}
      {(variant === 'outline' || variant === 'solid') && <path className="badge-stroke" d={d} />}
      {focused && (
        <path
          className="badge-focus"
          d={d}
          transform="translate(50 50) scale(1.06) translate(-50 -50)"
        />
      )}
    </>
  ),
  insets: { top: 0, right: 10, bottom: 0, left: 12 },
  stretches: true,
};

export default Ribbon;
```

- [ ] **Step 6: Wire remaining shapes into the registry**

Replace the four `stub` entries in `shapes/index.ts`:

```ts
import Starburst from './Starburst';
import Scalloped from './Scalloped';
import Shield from './Shield';
import Ribbon from './Ribbon';
// ...
  starburst: Starburst,
  scalloped: Scalloped,
  shield: Shield,
  ribbon: Ribbon,
// (delete the now-unused `stub` definition)
```

- [ ] **Step 7: Run the registry tests, all green**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/shapes/index.test.ts`
Expected: 2 + 13 = 15 tests pass.

- [ ] **Step 8: Commit**

```bash
git add packages/weasel-ui/src/components/Badge/shapes
git commit -m "feat(weasel-ui): Badge SVG-tier shapes (starburst, scalloped, shield, ribbon)"
```

---

## Task 5: Per-shape insets, dot, leading icon

**Files:**
- Modify: `Badge.tsx`, `Badge.module.css`, `Badge.test.tsx`

- [ ] **Step 1: Write failing tests**

Append to `Badge.test.tsx`:

```tsx
import { Badge } from './Badge';

describe('Badge content slots', () => {
  it('renders a dot when dot prop set', () => {
    const { container } = render(<Badge dot>x</Badge>);
    expect(container.querySelector('[data-badge-dot]')).not.toBeNull();
  });

  it('renders leading icon node', () => {
    const { getByTestId } = render(
      <Badge leadingIcon={<span data-testid="icon">i</span>}>x</Badge>,
    );
    expect(getByTestId('icon')).toBeDefined();
  });

  it('applies shape insets as CSS custom properties', () => {
    const { container } = render(<Badge shape="banner">x</Badge>);
    const el = container.firstElementChild as HTMLElement;
    expect(el.style.getPropertyValue('--badge-inset-left')).toBe('10px');
    expect(el.style.getPropertyValue('--badge-inset-right')).toBe('10px');
  });
});
```

- [ ] **Step 2: Run, confirm 3 failures**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: 3 new tests fail.

- [ ] **Step 3: Extend `Badge.module.css`**

Append:

```css
.badge {
  padding:
    calc(var(--badge-pad-y, 1px) + var(--badge-inset-top, 0px))
    calc(var(--badge-pad-x, 6px) + var(--badge-inset-right, 0px))
    calc(var(--badge-pad-y, 1px) + var(--badge-inset-bottom, 0px))
    calc(var(--badge-pad-x, 6px) + var(--badge-inset-left, 0px));
}

.dot {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--badge-edge);
  flex-shrink: 0;
}

.icon {
  display: inline-flex;
  width: var(--badge-icon-size, 12px);
  height: var(--badge-icon-size, 12px);
  flex-shrink: 0;
  color: var(--badge-fg);
}
.badge[data-size='md'] { --badge-icon-size: 14px; }
```

(Remove the old standalone `.badge { padding: ... }` rule from the first paragraph by replacing it with the new computed one. The block above supersedes it.)

- [ ] **Step 4: Update `Badge.tsx`**

```tsx
import type { ReactNode } from 'react';
import s from './Badge.module.css';
import { SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

export interface BadgeProps {
  shape?: BadgeShape;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  leadingIcon?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    dot,
    leadingIcon,
    children,
    className,
  } = props;

  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  const style = {
    '--badge-inset-top': `${shapeModule.insets.top}px`,
    '--badge-inset-right': `${shapeModule.insets.right}px`,
    '--badge-inset-bottom': `${shapeModule.insets.bottom}px`,
    '--badge-inset-left': `${shapeModule.insets.left}px`,
  } as React.CSSProperties;

  return (
    <span
      className={cls}
      data-shape={shape}
      data-tone={tone}
      data-variant={variant}
      data-size={size}
      style={style}
    >
      <svg
        className={s.deco}
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <ShapeBody variant={variant} focused={false} />
      </svg>
      <span className={s.content}>
        {dot && <span className={s.dot} data-badge-dot />}
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <span>{children}</span>
      </span>
    </span>
  );
}
```

Inline-style note: project rule forbids inline `style` except when absolutely necessary. This file uses inline `style` only to plumb four numeric CSS custom properties out of the shape registry — these can't be expressed as classes because each shape has different values. Acceptable per the rule's "absolutely necessary" carve-out.

- [ ] **Step 5: Run tests, confirm pass**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: all pass (8 tests now).

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/components/Badge
git commit -m "feat(weasel-ui): Badge dot, leadingIcon, per-shape insets"
```

---

## Task 6: Interactive — clickable wrapper + focus ring

**Files:**
- Modify: `Badge.tsx`, `Badge.module.css`, `Badge.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
describe('Badge interactive', () => {
  it('renders as button when onClick given', () => {
    const { container } = render(<Badge onClick={() => {}}>x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
  });

  it('renders as anchor when href given', () => {
    const { container } = render(<Badge href="/x">x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('A');
  });

  it('honors explicit as override', () => {
    const { container } = render(<Badge as="button">x</Badge>);
    expect(container.firstElementChild?.tagName).toBe('BUTTON');
  });

  it('fires onClick when clicked', () => {
    const fn = vi.fn();
    const { container } = render(<Badge onClick={fn}>x</Badge>);
    (container.firstElementChild as HTMLButtonElement).click();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('renders focus path when focus-visible matches', () => {
    // jsdom does not implement :focus-visible matching; verify the focused
    // path renders when we force the `focused` prop on the shape.
    // We rely on Badge wiring `focused` based on the React focus event.
    const { container } = render(<Badge onClick={() => {}}>x</Badge>);
    const btn = container.firstElementChild as HTMLButtonElement;
    btn.focus();
    // After focus, the wrapper should have a data-focused attribute we can assert on.
    expect(btn.getAttribute('data-focused')).toBe('true');
  });
});
```

(`vi` is already imported in the existing test file header from Task 5.)

- [ ] **Step 2: Run, confirm failures**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: 5 new failures.

- [ ] **Step 3: Extend CSS for interactive states**

Append to `Badge.module.css`:

```css
button.badge,
a.badge {
  cursor: pointer;
  outline: 0;
}
button.badge:hover,
a.badge:hover {
  --badge-edge: color-mix(in oklab, var(--badge-edge) 88%, white);
}
@media (prefers-reduced-motion: reduce) {
  button.badge:hover,
  a.badge:hover { --badge-edge: var(--badge-edge); }
}
```

- [ ] **Step 4: Update `Badge.tsx`**

Add `onClick`, `href`, `as`, focus tracking via React state. Inline below — `Badge.tsx` should now be:

```tsx
import { useState, type ReactNode, type CSSProperties } from 'react';
import s from './Badge.module.css';
import { SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant, BadgeSize } from './types';

export interface BadgeProps {
  shape?: BadgeShape;
  tone?: BadgeTone;
  variant?: BadgeVariant;
  size?: BadgeSize;
  dot?: boolean;
  leadingIcon?: ReactNode;
  onClick?: () => void;
  href?: string;
  as?: 'span' | 'button' | 'a';
  children: ReactNode;
  className?: string;
  'aria-label'?: string;
}

function chooseElement(props: BadgeProps): 'span' | 'button' | 'a' {
  if (props.as) return props.as;
  if (props.href) return 'a';
  if (props.onClick) return 'button';
  return 'span';
}

export function Badge(props: BadgeProps) {
  const {
    shape = 'pill',
    tone = 'neutral',
    variant = 'outline',
    size = 'sm',
    dot,
    leadingIcon,
    onClick,
    href,
    children,
    className,
  } = props;
  const ariaLabel = props['aria-label'];
  const element = chooseElement(props);
  const [focused, setFocused] = useState(false);
  const shapeModule = SHAPES[shape];
  const ShapeBody = shapeModule.Component;
  const cls = [s.badge, className].filter(Boolean).join(' ');

  const style: CSSProperties = {
    ['--badge-inset-top' as never]: `${shapeModule.insets.top}px`,
    ['--badge-inset-right' as never]: `${shapeModule.insets.right}px`,
    ['--badge-inset-bottom' as never]: `${shapeModule.insets.bottom}px`,
    ['--badge-inset-left' as never]: `${shapeModule.insets.left}px`,
  };

  const commonProps = {
    className: cls,
    style,
    'data-shape': shape,
    'data-tone': tone,
    'data-variant': variant,
    'data-size': size,
    'data-focused': focused ? 'true' : undefined,
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    'aria-label': ariaLabel,
  };

  const inner = (
    <>
      <svg className={s.deco} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <ShapeBody variant={variant} focused={focused} />
      </svg>
      <span className={s.content}>
        {dot && <span className={s.dot} data-badge-dot />}
        {leadingIcon && <span className={s.icon} aria-hidden="true">{leadingIcon}</span>}
        <span>{children}</span>
      </span>
    </>
  );

  if (element === 'button') {
    return (
      <button type="button" {...commonProps} onClick={onClick}>
        {inner}
      </button>
    );
  }
  if (element === 'a') {
    return (
      <a href={href} {...commonProps} onClick={onClick}>
        {inner}
      </a>
    );
  }
  return <span {...commonProps}>{inner}</span>;
}
```

- [ ] **Step 5: Run tests, confirm all green**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: 13 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/components/Badge
git commit -m "feat(weasel-ui): Badge clickable variant + focus ring path"
```

---

## Task 7: Removable (trailing × button)

**Files:**
- Modify: `Badge.tsx`, `Badge.module.css`, `Badge.test.tsx`

- [ ] **Step 1: Write failing tests**

```tsx
describe('Badge removable', () => {
  it('renders remove button when onRemove provided', () => {
    const { getByRole } = render(<Badge onRemove={() => {}}>x</Badge>);
    expect(getByRole('button', { name: 'Remove' })).toBeDefined();
  });

  it('fires onRemove without firing wrapper onClick', () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    const { getByRole } = render(
      <Badge onClick={onClick} onRemove={onRemove}>x</Badge>,
    );
    (getByRole('button', { name: 'Remove' }) as HTMLButtonElement).click();
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('honors removeLabel override', () => {
    const { getByRole } = render(
      <Badge onRemove={() => {}} removeLabel="Dismiss">x</Badge>,
    );
    expect(getByRole('button', { name: 'Dismiss' })).toBeDefined();
  });
});
```

- [ ] **Step 2: Run, confirm 3 failures**

- [ ] **Step 3: Extend CSS**

Append to `Badge.module.css`:

```css
.remove {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 12px;
  height: 12px;
  margin-left: 2px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 50%;
  color: var(--badge-fg);
  cursor: pointer;
  font: inherit;
  line-height: 1;
}
.remove:hover { background: color-mix(in oklab, var(--badge-fg) 20%, transparent); }
.badge[data-size='md'] .remove { width: 14px; height: 14px; }
```

- [ ] **Step 4: Update Badge.tsx**

Add `onRemove` and `removeLabel` props to `BadgeProps`. Render a trailing `<button type="button">` inside `.content` when `onRemove` is set. The click handler calls `e.stopPropagation()` then `onRemove()`. Insert this rendered after the label span:

```tsx
// In BadgeProps:
onRemove?: () => void;
removeLabel?: string;

// In destructure:
const { /* ... */, onRemove, removeLabel } = props;

// Inside `.content`, after the label span:
{onRemove && (
  <button
    type="button"
    className={s.remove}
    aria-label={removeLabel ?? 'Remove'}
    onClick={(e) => {
      e.stopPropagation();
      onRemove();
    }}
  >
    ×
  </button>
)}
```

- [ ] **Step 5: Run tests, confirm all green**

Run: `npx vitest run packages/weasel-ui/src/components/Badge/Badge.test.tsx`
Expected: 16 tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/components/Badge
git commit -m "feat(weasel-ui): Badge removable variant with × button"
```

---

## Task 8: Storybook stories

**Files:**
- Create: `packages/weasel-ui/src/components/Badge/Badge.stories.tsx`

- [ ] **Step 1: Create the stories file**

```tsx
// packages/weasel-ui/src/components/Badge/Badge.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';
import { ALL_SHAPES } from './shapes';
import type { BadgeShape, BadgeTone, BadgeVariant } from './types';

const TONES: BadgeTone[] = ['accent', 'info', 'warn', 'danger', 'muted', 'neutral'];
const VARIANTS: BadgeVariant[] = ['outline', 'solid', 'subtle'];

const meta: Meta<typeof Badge> = {
  title: 'weasel-ui/Badge',
  component: Badge,
  args: {
    children: 'LABEL',
    shape: 'pill',
    tone: 'accent',
    variant: 'outline',
    size: 'sm',
  },
  argTypes: {
    shape: { control: 'select', options: ALL_SHAPES },
    tone: { control: 'select', options: TONES },
    variant: { control: 'select', options: VARIANTS },
    size: { control: 'inline-radio', options: ['sm', 'md'] },
  },
};
export default meta;

type Story = StoryObj<typeof Badge>;

export const Default: Story = {};

export const AllShapes: Story = {
  render: () => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 16, alignItems: 'center' }}>
      {ALL_SHAPES.map((shape) => (
        <div key={shape} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <Badge shape={shape as BadgeShape} tone="accent" variant="outline">LABEL</Badge>
          <code style={{ fontSize: 10, opacity: 0.7 }}>{shape}</code>
        </div>
      ))}
    </div>
  ),
};

export const ToneVariantMatrix: Story = {
  render: () => (
    <table style={{ borderCollapse: 'separate', borderSpacing: '12px 8px' }}>
      <thead>
        <tr>
          <th></th>
          {VARIANTS.map((v) => <th key={v} style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>{v}</th>)}
        </tr>
      </thead>
      <tbody>
        {TONES.map((tone) => (
          <tr key={tone}>
            <td style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.7 }}>{tone}</td>
            {VARIANTS.map((variant) => (
              <td key={variant}><Badge tone={tone} variant={variant}>LABEL</Badge></td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Badge size="sm" tone="accent">SMALL</Badge>
      <Badge size="md" tone="accent">MEDIUM</Badge>
    </div>
  ),
};

export const WithDot: Story = { args: { dot: true } };

export const WithLeadingIcon: Story = {
  args: {
    leadingIcon: (
      <svg viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <circle cx="6" cy="6" r="3" />
      </svg>
    ),
  },
};

export const Removable: Story = { args: { onRemove: () => {} } };

export const Clickable: Story = { args: { onClick: () => {} } };

export const EdgeCases: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      <Badge tone="info">A very long label that tests overflow</Badge>
      <Badge shape="dot" tone="warn" dot> </Badge>
      <Badge shape="starburst" tone="danger" variant="solid">NEW</Badge>
      <Badge shape="banner" tone="accent">BANNER</Badge>
      <Badge shape="perforated" tone="muted">STAMP</Badge>
    </div>
  ),
};

export const SlotPillReplica: Story = {
  name: 'Slot pill (migration parity)',
  render: () => (
    <div style={{ display: 'flex', gap: 8 }}>
      <Badge shape="pill" tone="accent" variant="outline">active</Badge>
      <Badge shape="pill" tone="warn" variant="outline">ambient</Badge>
      <Badge shape="pill" tone="info" variant="outline">hotkey</Badge>
      <Badge shape="pill" tone="danger" variant="solid">inactive</Badge>
    </div>
  ),
};
```

Inline-style note: Storybook layout helpers are demo-only, never shipped in product code. The project's no-inline-styles rule targets product UI; story files are exempted by convention (cross-reference `ToolButton.stories.tsx` for prior art).

- [ ] **Step 2: Run Storybook locally to verify visuals**

Run: `npm --workspace @orochi235/weasel-ui run storybook` (or the equivalent script — check `packages/weasel-ui/package.json` if unsure).
Open the listed URL, navigate to **weasel-ui/Badge**, check each story renders without console errors. In particular:
- AllShapes: all 13 shapes draw.
- SlotPillReplica: visually matches the live Toolkit Builder slot column.
- Removable + Clickable: hover + focus rings look correct.

If anything looks wrong, fix it before committing.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/src/components/Badge/Badge.stories.tsx
git commit -m "docs(weasel-ui): Badge storybook stories"
```

---

## Task 9: Export Badge from weasel-ui

**Files:**
- Modify: `packages/weasel-ui/src/index.ts`

- [ ] **Step 1: Edit the package index**

```ts
// packages/weasel-ui/src/index.ts
export * from './components/Badge';
// (keep existing exports)
```

Insert the line between `./components/DataGrid` and the rest, alphabetically positioned (so the file stays sorted). Final import order:

```ts
export * from './components/Badge';
export * from './components/DataGrid';
export * from './components/RangePicker';
export * from './components/Sidebar';
export * from './components/SidebarPanel';
export * from './components/ToolButton';
export * from './components/ToolGroup';
// ...rest unchanged
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit -p packages/weasel-ui/tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Run full test project**

Run: `npx vitest run --project=weasel-ui`
Expected: all weasel-ui tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/weasel-ui/src/index.ts
git commit -m "feat(weasel-ui): export Badge"
```

---

## Task 10: Migrate ToolkitBuilder slot pill to Badge

**Files:**
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.tsx`
- Modify: `apps/swillustrator/src/dev/ToolkitBuilder.module.css`

- [ ] **Step 1: Replace the inline slot pill renderer**

In `apps/swillustrator/src/dev/ToolkitBuilder.tsx`, locate the route columns definition (around line 479-490) and the `_slot` column. Replace its `render` function:

```tsx
import { Badge } from '@orochi235/weasel-ui';

// near other constants in the file:
const SLOT_TONE = {
  active: 'accent',
  ambient: 'warn',
  hotkey: 'info',
  inactive: 'danger',
} as const;

// inside routeColumns:
{
  id: '_slot',
  header: 'slot',
  accessor: (r) => slotFor(r.toolId),
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
},
```

- [ ] **Step 2: Delete the old `.slot` CSS**

In `apps/swillustrator/src/dev/ToolkitBuilder.module.css`, delete the block starting with the `/* Slot pill — colors hint at runtime precedence ... */` comment through the closing `}` of the `.slot[data-slot='inactive']` rule (lines ~150-171 in the current file).

- [ ] **Step 3: Run the swillustrator project tests**

Run: `npx vitest run --project=swillustrator`
Expected: all pass. (No tests directly inspect the slot pill DOM today; any failure means something else broke.)

- [ ] **Step 4: Visual check**

Start the dev server: `npm --workspace @orochi235/swillustrator run dev` (or whatever it's named — check `apps/swillustrator/package.json`). Open the Toolkit Builder dev view, look at the Tool Routes widget, confirm the slot column visually matches what it did before. Compare against the SlotPillReplica Storybook story.

- [ ] **Step 5: Commit**

```bash
git add apps/swillustrator/src/dev/ToolkitBuilder.tsx apps/swillustrator/src/dev/ToolkitBuilder.module.css
git commit -m "refactor(swillustrator): migrate ToolkitBuilder slot pill to Badge"
```

---

## Task 11: Full verification

- [ ] **Step 1: Run prepublish check**

Per the repo's release gate (see memory: "Run prepublishOnly before pushing main"), run the same commands CI runs:

```bash
npx tsc --noEmit
npx vitest run
npx tsup build
```

(Adjust to whatever `prepublishOnly` is currently wired to — check `package.json` if unsure.)

Expected: all clean.

- [ ] **Step 2: Quick interactive check in Storybook**

Run: `npm --workspace @orochi235/weasel-ui run storybook`
Click through all Badge stories one more time, especially:
- AllShapes (every shape draws)
- ToneVariantMatrix (legibility on every cell)
- Removable (× click doesn't trigger any parent handlers — verify console quiet)
- Clickable (focus ring visible on Tab)

- [ ] **Step 3: If anything is off, fix it (no new commits needed unless visual fixes required)**

If visual fixes ARE needed, commit them with `fix(weasel-ui): Badge <what>`.

---

## Self-review notes (filled in after writing)

- **Spec coverage:** Tasks 1-2 cover API, render model, tone × variant. Task 3-4 cover all 13 shapes. Task 5 covers dot, leading icon, insets. Task 6 covers element selection (`as`/`href`/`onClick`) + focus ring. Task 7 covers removable. Task 8 covers Storybook with all listed stories (Default, AllShapes, ToneVariantMatrix, Sizes, WithDot, WithLeadingIcon, Removable, Clickable, EdgeCases, SlotPillReplica). Task 9 wires up package export. Task 10 covers the migration. Task 11 covers verification. The `as='span'` explicit override is not tested directly (only `as='button'` is) — accepted gap; same code path.
- **Placeholders:** None.
- **Type consistency:** `BadgeShape` literal list identical across types.ts, ALL_SHAPES, registry, and stories. `BadgeProps` field names stable from Task 2 onward, additive only. `chooseElement` helper introduced in Task 6 referenced consistently. `SLOT_TONE` only appears in Task 10.
