# Pathfinder UI Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a `PathfinderPanel` styled component in `@weasel-js/ui` that surfaces the kit's five `useBooleans` actions as a row of icon buttons with built-in Pathfinder-convention SVG icons, adapter-derived disabled state, and overrides for icons / labels / orientation.

**Architecture:** Presentational React component in `packages/ui/src/components/PathfinderPanel/` following the established per-component directory convention (`PathfinderPanel.tsx` + `.module.css` + `.test.tsx` + `.stories.tsx` + internal `pathfinderIcons.tsx` + `index.ts` barrel). The component takes both `adapter` (subset of `BooleansAdapter` — just `getSelection` + `getWorldPath`) and `actions` (returned from `useBooleans(adapter)`); the consumer calls the hook once and shares the result with their own keybinding wiring. A uniform `<2 valid paths` predicate computed each render drives disabled state for all five buttons.

**Tech Stack:** TypeScript, React 18+, Vitest + `@testing-library/react`, CSS Modules, Storybook (CSF v3 via `@storybook/react-vite`). Tests run from repo root via `npm test`. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-05-11-pathfinder-ui-panel-design.md`.

---

### File layout (locked at start)

Files this plan creates or modifies:

**Created** under `packages/ui/src/components/PathfinderPanel/`:

- `pathfinderIcons.tsx` — five internal-only SVG components.
- `PathfinderPanel.tsx` — the component, exports + types.
- `PathfinderPanel.module.css` — visual styling.
- `PathfinderPanel.test.tsx` — Vitest + RTL tests.
- `PathfinderPanel.stories.tsx` — four CSF stories.
- `index.ts` — per-component barrel.

**Modified:**

- `packages/ui/src/index.ts` — re-export the new barrel.
- `demo/demos/BooleanOpsDemo.tsx` — add interactive panel region above the static grid.
- `demo/registry.ts` — update the `boolean-ops` entry description + hint to reflect the new interactive region.
- `docs/TODO.md` — mark "Pathfinder UI panel" entry as shipped under the Tier 3 follow-ups list.

---

## Task 1: Default icon module

**Files:**

- Create: `packages/ui/src/components/PathfinderPanel/pathfinderIcons.tsx`
- Create (test): `packages/ui/src/components/PathfinderPanel/pathfinderIcons.test.tsx`

**Visual recipe** (shared across all icons):

- 20×20 viewBox.
- Two circles, centers `(7, 10)` and `(13, 10)`, both `r=5`. They overlap; intersection points at `(10, 6)` and `(10, 14)`.
- Strokes: `1.5px`, `stroke="currentColor"`, `fill="none"` for outlines.
- Filled regions: `fill="currentColor"`, no stroke (or stroke also `currentColor` — pick whichever reads cleaner; default to fill-only for the filled regions, plus the two-circle outlines on top).
- Each icon component takes no props; renders an `<svg>` with `role="img"` and `aria-hidden="true"` (the parent button supplies the accessible name).

**Filled regions by op** (using arc commands; flag values explained inline):

- **`UnionIcon`** — both circles filled. Just two `<circle fill="currentColor">` elements; outline strokes drawn on top in `currentColor` so the overlap reads as one blob.
- **`IntersectIcon`** — only the lens filled, plus both circles outlined. Lens path: `M 10 6 A 5 5 0 0 1 10 14 A 5 5 0 0 1 10 6 Z` (two short arcs along the inner edges of each circle).
- **`SubtractIcon`** — left crescent (A − overlap) filled, plus both circles outlined. Crescent path: `M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z` — outer arc of A (large-arc=1, sweep=0 = CCW via leftmost point), inner arc of B (sweep=0 = short arc via the lens edge).
- **`ExcludeIcon`** — both outer crescents filled, plus both circles outlined. Two sub-paths concatenated:
  - left crescent: `M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z`
  - right crescent: `M 10 6 A 5 5 0 1 1 10 14 A 5 5 0 0 1 10 6 Z`
  Render as one `<path d="...">` with both sub-paths joined.
- **`DivideIcon`** — both circles outlined plus a vertical chord `(10, 6) → (10, 14)` to visualize the cut. No fill. Implemented as a `<line>` element on top of the outline circles.

**Implementer note:** the SVG arc d-strings above are computed from the geometry but may render slightly off-center depending on rasterization; tweak `r` between `4.8`–`5.2` or shift `cy` by 0.5 to balance perceived weight after eyeballing in Storybook. The spec calls this out as a "squint test" — small adjustments are fine.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/PathfinderPanel/pathfinderIcons.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
} from './pathfinderIcons';

describe('pathfinderIcons', () => {
  it('UnionIcon renders an svg with two circles', () => {
    const { container } = render(<UnionIcon />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.querySelectorAll('circle').length).toBeGreaterThanOrEqual(2);
  });

  it('IntersectIcon renders an svg with a path for the lens', () => {
    const { container } = render(<IntersectIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('SubtractIcon renders an svg with a crescent path', () => {
    const { container } = render(<SubtractIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('ExcludeIcon renders an svg with a path for both crescents', () => {
    const { container } = render(<ExcludeIcon />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });

  it('DivideIcon renders an svg with two circles and a divider line', () => {
    const { container } = render(<DivideIcon />);
    expect(container.querySelector('svg line')).toBeTruthy();
    expect(container.querySelectorAll('svg circle').length).toBeGreaterThanOrEqual(2);
  });

  it('icons are aria-hidden (button supplies the accessible name)', () => {
    const { container } = render(<UnionIcon />);
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/pathfinderIcons.test.tsx
```
Expected: FAIL — module `./pathfinderIcons` not found.

- [ ] **Step 3: Implement the icons**

```tsx
// packages/ui/src/components/PathfinderPanel/pathfinderIcons.tsx
const SVG_BASE = {
  viewBox: '0 0 20 20',
  width: 20,
  height: 20,
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  role: 'img' as const,
  'aria-hidden': true,
};

export function UnionIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" fill="currentColor" stroke="none" />
      <circle cx="13" cy="10" r="5" fill="currentColor" stroke="none" />
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
    </svg>
  );
}

export function IntersectIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 0 1 10 14 A 5 5 0 0 1 10 6 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function SubtractIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}

export function ExcludeIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <path
        d="M 10 6 A 5 5 0 1 0 10 14 A 5 5 0 0 0 10 6 Z M 10 6 A 5 5 0 1 1 10 14 A 5 5 0 0 1 10 6 Z"
        fill="currentColor"
        stroke="none"
        fillRule="evenodd"
      />
    </svg>
  );
}

export function DivideIcon() {
  return (
    <svg {...SVG_BASE}>
      <circle cx="7" cy="10" r="5" />
      <circle cx="13" cy="10" r="5" />
      <line x1="10" y1="6" x2="10" y2="14" />
    </svg>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/pathfinderIcons.test.tsx
```
Expected: PASS, all six assertions.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/pathfinderIcons.tsx \
        packages/ui/src/components/PathfinderPanel/pathfinderIcons.test.tsx
git commit -m "feat(weasel-ui): inline SVG icons for Pathfinder panel"
```

---

## Task 2: PathfinderPanel renders five buttons

**Files:**

- Create: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx`
- Create (test): `packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx`

**Op order** (left-to-right): `union`, `intersect`, `subtract`, `exclude`, `divide`.

**Default labels** (matches `LABEL` constant in `src/interactions/actions/booleans/booleans.ts`): `'Union'`, `'Intersect'`, `'Subtract'`, `'Exclude'`, `'Divide'`.

- [ ] **Step 1: Write the failing test**

```tsx
// packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PathfinderPanel } from './PathfinderPanel';
import type { BooleansAdapter, UseBooleansReturn } from '@weasel-js/core';
import { asNodeId } from '@weasel-js/core';

const noop = () => {};
const noopActions: UseBooleansReturn = {
  union: noop,
  intersect: noop,
  subtract: noop,
  exclude: noop,
  divide: noop,
};

function adapterWith(paths: number): Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> {
  const ids = Array.from({ length: paths }, (_, i) => asNodeId(`id-${i}`));
  return {
    getSelection: () => ids,
    getWorldPath: (id) => (
      ids.includes(id)
        ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
        : undefined
    ),
  };
}

describe('PathfinderPanel', () => {
  it('renders five buttons in op order', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.getAttribute('data-testid'))).toEqual([
      'pathfinder-op-union',
      'pathfinder-op-intersect',
      'pathfinder-op-subtract',
      'pathfinder-op-exclude',
      'pathfinder-op-divide',
    ]);
  });

  it('default aria-labels are the capitalized op names', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    expect(screen.getByLabelText('Union')).toBeTruthy();
    expect(screen.getByLabelText('Intersect')).toBeTruthy();
    expect(screen.getByLabelText('Subtract')).toBeTruthy();
    expect(screen.getByLabelText('Exclude')).toBeTruthy();
    expect(screen.getByLabelText('Divide')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: FAIL — module `./PathfinderPanel` not found.

- [ ] **Step 3: Implement the minimal component**

```tsx
// packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx
import type { ReactNode } from 'react';
import type { BooleansAdapter, UseBooleansReturn } from '@weasel-js/core';
import {
  UnionIcon,
  IntersectIcon,
  SubtractIcon,
  ExcludeIcon,
  DivideIcon,
} from './pathfinderIcons';
import s from './PathfinderPanel.module.css';

export type PathfinderOp =
  | 'union' | 'intersect' | 'subtract' | 'exclude' | 'divide';

export type PathfinderIcons = Partial<Record<PathfinderOp, ReactNode>>;

export interface PathfinderPanelProps {
  adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'>;
  actions: UseBooleansReturn;
  icons?: PathfinderIcons;
  orientation?: 'horizontal' | 'vertical';
  labels?: Partial<Record<PathfinderOp, string>>;
  className?: string;
}

const OPS: readonly PathfinderOp[] = [
  'union', 'intersect', 'subtract', 'exclude', 'divide',
] as const;

const DEFAULT_LABELS: Record<PathfinderOp, string> = {
  union: 'Union',
  intersect: 'Intersect',
  subtract: 'Subtract',
  exclude: 'Exclude',
  divide: 'Divide',
};

const DEFAULT_ICONS: Record<PathfinderOp, ReactNode> = {
  union: <UnionIcon />,
  intersect: <IntersectIcon />,
  subtract: <SubtractIcon />,
  exclude: <ExcludeIcon />,
  divide: <DivideIcon />,
};

export function PathfinderPanel(props: PathfinderPanelProps) {
  const { adapter, actions, icons, orientation = 'horizontal', labels, className } = props;
  const cls = [s.panel, orientation === 'vertical' && s.vertical, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Pathfinder operations">
      {OPS.map((op) => {
        const label = labels?.[op] ?? DEFAULT_LABELS[op];
        const icon = icons?.[op] ?? DEFAULT_ICONS[op];
        return (
          <button
            key={op}
            type="button"
            data-testid={`pathfinder-op-${op}`}
            aria-label={label}
            title={label}
            className={s.button}
            onClick={() => actions[op]()}
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}
```

Also create an empty CSS module so the import resolves:

```css
/* packages/ui/src/components/PathfinderPanel/PathfinderPanel.module.css */
.panel {}
.vertical {}
.button {}
```

(Full styling lands in Task 6.)

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: PASS, both tests.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx \
        packages/ui/src/components/PathfinderPanel/PathfinderPanel.module.css \
        packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
git commit -m "feat(weasel-ui): PathfinderPanel skeleton — five op buttons"
```

---

## Task 3: Disabled-state derivation + click dispatch

**Files:**

- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx`
- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx`

Disabled predicate: count `adapter.getSelection()` entries where `adapter.getWorldPath(id) != null`; if that count is `<2`, all five buttons are disabled.

- [ ] **Step 1: Write the failing tests**

Append to `PathfinderPanel.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';

describe('PathfinderPanel — disabled state', () => {
  it('all buttons disabled when fewer than 2 valid paths selected', () => {
    render(<PathfinderPanel adapter={adapterWith(1)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
      expect(btn.getAttribute('aria-disabled')).toBe('true');
    }
  });

  it('all buttons disabled on empty selection', () => {
    render(<PathfinderPanel adapter={adapterWith(0)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(true);
    }
  });

  it('all buttons enabled at exactly 2 valid paths', () => {
    render(<PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide']) {
      const btn = screen.getByTestId(`pathfinder-op-${op}`) as HTMLButtonElement;
      expect(btn.disabled).toBe(false);
    }
  });
});

describe('PathfinderPanel — click dispatch', () => {
  it('clicking an enabled button invokes the matching action exactly once', () => {
    const actions: UseBooleansReturn = {
      union: vi.fn(),
      intersect: vi.fn(),
      subtract: vi.fn(),
      exclude: vi.fn(),
      divide: vi.fn(),
    };
    render(<PathfinderPanel adapter={adapterWith(2)} actions={actions} />);
    for (const op of ['union', 'intersect', 'subtract', 'exclude', 'divide'] as const) {
      fireEvent.click(screen.getByTestId(`pathfinder-op-${op}`));
      expect(actions[op]).toHaveBeenCalledTimes(1);
    }
  });

  it('clicking a disabled button does not invoke the action', () => {
    const actions: UseBooleansReturn = {
      union: vi.fn(),
      intersect: vi.fn(),
      subtract: vi.fn(),
      exclude: vi.fn(),
      divide: vi.fn(),
    };
    render(<PathfinderPanel adapter={adapterWith(1)} actions={actions} />);
    fireEvent.click(screen.getByTestId('pathfinder-op-union'));
    expect(actions.union).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: the four new tests FAIL — `disabled` is `false` for all buttons regardless of selection size.

- [ ] **Step 3: Implement disabled-state derivation**

Update `PathfinderPanel.tsx` — inside `PathfinderPanel`, before the `return`:

```tsx
const validCount = adapter
  .getSelection()
  .filter((id) => adapter.getWorldPath(id) != null)
  .length;
const disabled = validCount < 2;
```

And in the button JSX:

```tsx
<button
  key={op}
  type="button"
  data-testid={`pathfinder-op-${op}`}
  aria-label={label}
  aria-disabled={disabled || undefined}
  disabled={disabled}
  title={label}
  className={s.button}
  onClick={() => actions[op]()}
>
  {icon}
</button>
```

(`disabled` on a native `<button>` already short-circuits the click event, so no additional handler guard is needed; the "click disabled does nothing" test passes for free.)

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: all PathfinderPanel tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx \
        packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
git commit -m "feat(weasel-ui): PathfinderPanel disabled-state derivation + click dispatch"
```

---

## Task 4: Override props — icons, labels, orientation

**Files:**

- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx`
- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx`

All three override surfaces (`icons`, `labels`, `orientation`) are already declared on `PathfinderPanelProps` and consumed in the JSX from Task 2. This task adds explicit test coverage and verifies the existing wiring behaves correctly — and adds the vertical-class assertion that proves the CSS-class toggle works.

- [ ] **Step 1: Write the failing tests**

Append to `PathfinderPanel.test.tsx`:

```tsx
describe('PathfinderPanel — overrides', () => {
  it('icons prop overrides the default icon for that op only', () => {
    const Custom = () => <span data-testid="custom-union-icon">★</span>;
    render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        icons={{ union: <Custom /> }}
      />,
    );
    expect(screen.getByTestId('custom-union-icon')).toBeTruthy();
    // intersect still renders its default svg
    expect(screen.getByTestId('pathfinder-op-intersect').querySelector('svg')).toBeTruthy();
  });

  it('labels prop overrides aria-label and title for that op only', () => {
    render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        labels={{ union: 'Combine', subtract: 'Minus Front' }}
      />,
    );
    const u = screen.getByTestId('pathfinder-op-union');
    expect(u.getAttribute('aria-label')).toBe('Combine');
    expect(u.getAttribute('title')).toBe('Combine');
    const s = screen.getByTestId('pathfinder-op-subtract');
    expect(s.getAttribute('aria-label')).toBe('Minus Front');
    // intersect keeps default
    expect(screen.getByTestId('pathfinder-op-intersect').getAttribute('aria-label'))
      .toBe('Intersect');
  });

  it('orientation="vertical" applies the vertical class', () => {
    const { container } = render(
      <PathfinderPanel
        adapter={adapterWith(2)}
        actions={noopActions}
        orientation="vertical"
      />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    // CSS-module class name is hashed; presence of any class containing
    // 'vertical' is the smoke check.
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(true);
  });

  it('orientation defaults to horizontal (no vertical class)', () => {
    const { container } = render(
      <PathfinderPanel adapter={adapterWith(2)} actions={noopActions} />,
    );
    const root = container.querySelector('[role="toolbar"]') as HTMLElement;
    expect(Array.from(root.classList).some((c) => c.includes('vertical'))).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: most pass already (since Task 2 wired up the props), but the vertical-class tests may fail if Vitest's CSS module shim returns `undefined` for `s.vertical`. If so, see Step 3.

- [ ] **Step 3: Confirm CSS-module shim returns a string**

Check `packages/ui/src/css-modules.d.ts` and the Vitest config — CSS modules in this repo are typed and resolve to string maps. If `s.vertical` is `undefined` under Vitest, replace the class-presence test with a `data-orientation="vertical"` attribute on the root:

```tsx
// in PathfinderPanel.tsx, on the root <div>:
data-orientation={orientation}
```

And change the test to assert `root.getAttribute('data-orientation') === 'vertical'`. Either approach is acceptable; pick whichever the test runner supports without ceremony. The visible CSS still uses the `vertical` class.

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: all overrides tests PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.tsx \
        packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
git commit -m "test(weasel-ui): PathfinderPanel override-prop coverage"
```

---

## Task 5: Mixed-selection filter predicate

**Files:**

- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx`

Verifies the disabled-state predicate filters non-path entries correctly: an adapter that returns 3 selected ids but where one returns `undefined` from `getWorldPath` should count as 2 valid paths and enable the buttons.

- [ ] **Step 1: Write the failing test**

Append to `PathfinderPanel.test.tsx`:

```tsx
import { asNodeId as nid } from '@weasel-js/core';

describe('PathfinderPanel — mixed selection', () => {
  it('non-path selection members are filtered out of the disabled predicate', () => {
    const ids = [nid('p0'), nid('p1'), nid('text-1')];
    const adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> = {
      getSelection: () => ids,
      getWorldPath: (id) => (
        id === 'text-1'
          ? undefined  // not a path
          : { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
      ),
    };
    render(<PathfinderPanel adapter={adapter} actions={noopActions} />);
    // 2 valid paths out of 3 selected → enabled
    expect((screen.getByTestId('pathfinder-op-union') as HTMLButtonElement).disabled).toBe(false);
  });

  it('one valid path among non-paths → disabled', () => {
    const ids = [nid('p0'), nid('text-1'), nid('image-1')];
    const adapter: Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> = {
      getSelection: () => ids,
      getWorldPath: (id) => (
        id === 'p0'
          ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
          : undefined
      ),
    };
    render(<PathfinderPanel adapter={adapter} actions={noopActions} />);
    expect((screen.getByTestId('pathfinder-op-union') as HTMLButtonElement).disabled).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
```
Expected: both new tests PASS (Task 3's implementation already handles this — the test verifies the predicate is correct, not that new code is needed).

If either fails, the predicate isn't filtering correctly; debug `PathfinderPanel.tsx`'s `validCount` line.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.test.tsx
git commit -m "test(weasel-ui): PathfinderPanel mixed-selection filter predicate"
```

---

## Task 6: CSS module — visual polish

**Files:**

- Modify: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.module.css`

Match the LayerList chrome convention: dark warm-brown background, 4px radius, 2px padding, 1px gap, 28×28 buttons. Vertical orientation flips `flex-direction`. Disabled drops opacity.

- [ ] **Step 1: Write the full CSS**

Replace the empty stub from Task 2:

```css
/* packages/ui/src/components/PathfinderPanel/PathfinderPanel.module.css */
.panel {
  display: flex;
  flex-direction: row;
  gap: 1px;
  background: #1a1612;
  border: 1px solid #2a2418;
  border-radius: 4px;
  padding: 2px;
  user-select: none;
}

.panel.vertical {
  flex-direction: column;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: 0;
  border-radius: 2px;
  color: #d8c8a8;
  cursor: default;
}

.button:hover:not([disabled]) {
  background: #221c12;
  color: #fff5d8;
}

.button:active:not([disabled]) {
  background: #2a2218;
}

.button[disabled] {
  opacity: 0.4;
  cursor: default;
}

.button > svg {
  display: block;
}
```

- [ ] **Step 2: Run tests to verify nothing regressed**

```bash
npm test -- packages/ui/src/components/PathfinderPanel/
```
Expected: all PathfinderPanel tests still PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.module.css
git commit -m "style(weasel-ui): PathfinderPanel chrome — LayerList-matched palette"
```

---

## Task 7: Per-component barrel + main weasel-ui export

**Files:**

- Create: `packages/ui/src/components/PathfinderPanel/index.ts`
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Create the per-component barrel**

```ts
// packages/ui/src/components/PathfinderPanel/index.ts
export { PathfinderPanel } from './PathfinderPanel';
export type {
  PathfinderPanelProps,
  PathfinderIcons,
  PathfinderOp,
} from './PathfinderPanel';
```

- [ ] **Step 2: Add the re-export to the main index**

Append to `packages/ui/src/index.ts`:

```ts
export * from './components/PathfinderPanel';
```

(Place it alongside the other `export * from './components/...'` lines at the top of the file.)

- [ ] **Step 3: Verify typecheck passes**

```bash
npm run typecheck
```
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/index.ts \
        packages/ui/src/index.ts
git commit -m "feat(weasel-ui): export PathfinderPanel from package barrel"
```

---

## Task 8: Storybook stories

**Files:**

- Create: `packages/ui/src/components/PathfinderPanel/PathfinderPanel.stories.tsx`

Four stories: `Default`, `Disabled`, `Vertical`, `CustomIcons`. Each wires a minimal in-memory adapter with one or more dummy `Path` records.

- [ ] **Step 1: Write the stories file**

```tsx
// packages/ui/src/components/PathfinderPanel/PathfinderPanel.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { PathfinderPanel } from './PathfinderPanel';
import type { BooleansAdapter, UseBooleansReturn } from '@weasel-js/core';
import { asNodeId } from '@weasel-js/core';

const meta: Meta<typeof PathfinderPanel> = {
  title: 'weasel-ui/PathfinderPanel',
  component: PathfinderPanel,
};
export default meta;

type Story = StoryObj<typeof PathfinderPanel>;

const noopActions: UseBooleansReturn = {
  union: () => console.log('union'),
  intersect: () => console.log('intersect'),
  subtract: () => console.log('subtract'),
  exclude: () => console.log('exclude'),
  divide: () => console.log('divide'),
};

function adapterWith(paths: number): Pick<BooleansAdapter, 'getSelection' | 'getWorldPath'> {
  const ids = Array.from({ length: paths }, (_, i) => asNodeId(`id-${i}`));
  return {
    getSelection: () => ids,
    getWorldPath: (id) => (
      ids.includes(id)
        ? { kind: 'polygon', commands: new Uint8Array(), coords: new Float32Array(), fillRule: 'nonzero' }
        : undefined
    ),
  };
}

export const Default: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
  },
};

export const Disabled: Story = {
  args: {
    adapter: adapterWith(0),
    actions: noopActions,
  },
};

export const Vertical: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
    orientation: 'vertical',
  },
};

export const CustomIcons: Story = {
  args: {
    adapter: adapterWith(2),
    actions: noopActions,
    icons: {
      union: <span style={{ fontSize: 14 }}>∪</span>,
      intersect: <span style={{ fontSize: 14 }}>∩</span>,
      exclude: <span style={{ fontSize: 14 }}>⊕</span>,
    },
  },
};
```

- [ ] **Step 2: Verify stories build (optional smoke)**

```bash
cd packages/ui && npm run build-storybook
```
Expected: stories file compiles without TS errors. (You can also visually inspect via `npm run storybook` if you want.)

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/PathfinderPanel/PathfinderPanel.stories.tsx
git commit -m "story(weasel-ui): PathfinderPanel — default, disabled, vertical, custom-icons"
```

---

## Task 9: Extend BooleanOpsDemo with interactive panel

**Files:**

- Modify: `demo/demos/BooleanOpsDemo.tsx`

Add a sixth interactive region above the static 5-panel grid. Reuses the rect + circle inputs from the existing demo, mounts a single `<SceneCanvas>` with selection enabled, renders a `<PathfinderPanel>` above it wired to `useBooleans(adapter)` over the demo's scene, and adds a "Reset" button that re-seeds the two source paths.

The kit's `arrayAdapter.commitPaste` is a known stub (see `docs/TODO.md`), but `useBooleans` doesn't use it — it goes through `adapter.applyBatch` directly. Verify the demo's `useScene`/`SceneCanvas` wiring exposes the `BooleansAdapter` methods (`getSelection`, `getWorldPath`, `compareZ`, `createPathNode`, `applyBatch`); if any are missing, synthesize them inline from the scene's `nodes`/`setNodes` and `pose` data the demo already has access to.

- [ ] **Step 1: Read the current demo end-to-end**

```bash
cat demo/demos/BooleanOpsDemo.tsx
```
Confirm understanding of `Panel`, `useScene`, and how the existing static rows work.

- [ ] **Step 2: Verify SceneCanvas + useScene + selection wiring patterns**

Read these three files so the demo wiring uses the real APIs:

```bash
sed -n '160,180p' src/canvas/SceneCanvas.tsx       # selection prop type
grep -n 'export' src/index.ts | grep -i selection  # SelectionApi, useSelection
cat demo/demos/ActionsDemo.tsx | head -60          # canonical useSelection + SceneCanvas wiring
```

Key facts:

- `SceneCanvas`'s selection prop is `selection?: SelectionApi`, *not* a controlled array + change callback. Mint one with `const selection = useSelection()` and pass it through.
- `SelectionApi` exposes `.current: NodeId[]` (read) and `.set(ids)` / `.add(ids)` / `.remove(ids)` etc. (write) — see `src/features/selection/` for the full surface.
- `useScene` returns a `Scene<TData, TLayer, TPose>` whose synthesized adapter is what `SceneCanvas` consumes internally; the boolean adapter wires through `Scene` directly via `scene.applyBatch` and `scene.recordOp` rather than through the synthesized internal adapter.

If after reading you find that `Scene` does *not* expose `applyBatch` / `recordOp` matching the shape `BooleansAdapter` expects (`applyBatch(ops: Op[], label?: string)`), then the demo's adapter wires `applyBatch` manually as a small in-memory dispatcher (see Step 3's "side-channel" approach).

- [ ] **Step 3: Add the interactive region**

Replace `BooleanOpsDemo` with a version that adds an `<InteractivePanel>` above the existing static grid. Full replacement of the file:

```tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  pathUnion,
  pathIntersect,
  pathSubtract,
  pathExclude,
  pathDivide,
  useBooleans,
  useSelection,
  useScene,
  PATH_M,
  PATH_L,
  PATH_Z,
  SceneCanvas,
  asNodeId,
} from '@weasel-js/core';
import type {
  BooleansAdapter,
  NodeId,
  PolygonPath,
  Op,
  Path,
} from '@weasel-js/core';
import { PathfinderPanel } from '@weasel-js/ui';
import type { DrawCommand } from '../../src/renderer';

const W = 240;
const H = 200;

function circle(cx: number, cy: number, r: number, n = 32): PolygonPath {
  const commands = new Uint8Array(n + 1);
  const coords = new Float32Array(n * 2);
  commands[0] = PATH_M;
  for (let i = 1; i < n; i++) commands[i] = PATH_L;
  commands[n] = PATH_Z;
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    coords[i * 2] = cx + Math.cos(t) * r;
    coords[i * 2 + 1] = cy + Math.sin(t) * r;
  }
  return { kind: 'polygon', commands, coords, fillRule: 'nonzero' };
}

const RECT_INPUT: PolygonPath = {
  kind: 'polygon',
  commands: new Uint8Array([PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z]),
  coords: new Float32Array([40, 50, 140, 50, 140, 140, 40, 140]),
  fillRule: 'nonzero',
};
const CIRCLE_INPUT = circle(120, 115, 55);

const RECT_COLOR = '#7fb069';
const CIRCLE_COLOR = '#d4a574';
const RESULT_COLOR = '#a48bd4';
const DIVIDE_COLORS = ['#7fb069', '#d4a574', '#a48bd4', '#7ab8d4', '#d47a7a'];

interface PanelItem {
  id: string;
  path: PolygonPath;
  color: string;
}

function Panel({ id, paths }: { id: string; paths: PanelItem[] }) {
  const scene = useScene<PanelItem>({ items: paths });
  return (
    <SceneCanvas
      width={W}
      height={H}
      className="ckd-canvas"
      scene={scene}
      layers={{
        scene: {
          drawOne: (node): DrawCommand[] => [{
            kind: 'path',
            path: node.data.path,
            fill: { color: node.data.color },
          }],
        },
      }}
      data-panel={id}
    />
  );
}

const INITIAL_ITEMS: PanelItem[] = [
  { id: 'rect',   path: RECT_INPUT,   color: RECT_COLOR },
  { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
];

function InteractivePanel() {
  const [items, setItems] = useState<PanelItem[]>(INITIAL_ITEMS);
  const selection = useSelection();
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const nextIdRef = useRef(0);

  // Side-channel: createPathNode returns only an id, but applyBatch's
  // insert op carries that same id. Stash the path here so the insert
  // branch can recover it.
  const pendingPathsRef = useRef<Map<string, Path>>(new Map());

  const scene = useScene<PanelItem>({ items });

  // Seed initial selection on first mount.
  const seededRef = useRef(false);
  if (!seededRef.current) {
    selection.set([asNodeId('rect'), asNodeId('circle')]);
    seededRef.current = true;
  }

  const adapter = useMemo<BooleansAdapter>(() => ({
    getSelection: () => selection.current,
    getWorldPath: (id) =>
      itemsRef.current.find((it) => it.id === (id as unknown as string))?.path,
    compareZ: (a, b) => {
      const ai = itemsRef.current.findIndex((it) => it.id === (a as unknown as string));
      const bi = itemsRef.current.findIndex((it) => it.id === (b as unknown as string));
      return ai - bi;
    },
    createPathNode: (path) => {
      const id = `result-${nextIdRef.current++}`;
      pendingPathsRef.current.set(id, path);
      return { id };
    },
    applyBatch: (ops: Op[]) => {
      setItems((prev) => {
        let next = [...prev];
        for (const op of ops) {
          // The exact discriminator/payload shape for delete/insert ops
          // lives in `src/core/ops/types.ts`. The branches below assume
          // `op.kind` plus an id or node payload; adjust the property
          // reads to match the real types once you've inspected them.
          if ((op as { kind: string }).kind === 'delete') {
            const id = (op as { node?: { id: string }; id?: string }).node?.id
                    ?? (op as { id?: string }).id;
            if (id) next = next.filter((it) => it.id !== id);
          } else if ((op as { kind: string }).kind === 'insert') {
            const node = (op as { node: { id: string } }).node;
            const path = pendingPathsRef.current.get(node.id);
            if (path && path.kind === 'polygon') {
              next.push({ id: node.id, path, color: RESULT_COLOR });
              pendingPathsRef.current.delete(node.id);
            }
          }
        }
        return next;
      });
      for (const op of ops) {
        if ((op as { kind: string }).kind === 'setSelection') {
          const to = (op as unknown as { to: NodeId[] }).to;
          selection.set(to);
        }
      }
    },
  }), [selection]);

  const actions = useBooleans(adapter);

  const reset = useCallback(() => {
    setItems(INITIAL_ITEMS);
    selection.set([asNodeId('rect'), asNodeId('circle')]);
    nextIdRef.current = 0;
    pendingPathsRef.current.clear();
  }, [selection]);

  return (
    <div className="ckd-boolops-panel">
      <h3 className="ckd-boolops-label">Interactive</h3>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
        <PathfinderPanel adapter={adapter} actions={actions} />
        <button type="button" onClick={reset} style={{ marginLeft: 'auto' }}>
          Reset
        </button>
      </div>
      <SceneCanvas
        width={W}
        height={H}
        className="ckd-canvas"
        scene={scene}
        selection={selection}
        layers={{
          scene: {
            drawOne: (node): DrawCommand[] => [{
              kind: 'path',
              path: node.data.path,
              fill: { color: node.data.color },
            }],
          },
        }}
        data-panel="interactive"
      />
    </div>
  );
}

export function BooleanOpsDemo() {
  const unionResult = useMemo(() => pathUnion(RECT_INPUT, CIRCLE_INPUT), []);
  const intersectResult = useMemo(() => pathIntersect(RECT_INPUT, CIRCLE_INPUT), []);
  const subtractResult = useMemo(() => pathSubtract(RECT_INPUT, CIRCLE_INPUT), []);
  const excludeResult = useMemo(() => pathExclude(RECT_INPUT, CIRCLE_INPUT), []);
  const divideResults = useMemo(() => pathDivide(RECT_INPUT, CIRCLE_INPUT), []);

  const dividePaths = useMemo(
    () => divideResults.map((p, i) => ({
      id: `d${i}`,
      path: p,
      color: DIVIDE_COLORS[i % DIVIDE_COLORS.length],
    })),
    [divideResults],
  );

  return (
    <div className="ckd-boolops-grid">
      <InteractivePanel />
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Inputs</h3>
        <Panel id="inputs" paths={[
          { id: 'rect', path: RECT_INPUT, color: RECT_COLOR },
          { id: 'circle', path: CIRCLE_INPUT, color: CIRCLE_COLOR },
        ]} />
      </div>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Union</h3>
        <Panel id="union" paths={[{ id: 'u', path: unionResult, color: RESULT_COLOR }]} />
      </div>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Intersect</h3>
        <Panel id="intersect" paths={[{ id: 'i', path: intersectResult, color: RESULT_COLOR }]} />
      </div>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Subtract</h3>
        <Panel id="subtract" paths={[{ id: 's', path: subtractResult, color: RESULT_COLOR }]} />
      </div>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Exclude</h3>
        <Panel id="exclude" paths={[{ id: 'x', path: excludeResult, color: RESULT_COLOR }]} />
      </div>
      <div className="ckd-boolops-panel">
        <h3 className="ckd-boolops-label">Divide</h3>
        <Panel id="divide" paths={dividePaths} />
      </div>
    </div>
  );
}
```

**Implementer note on the adapter wiring:** the `createPathNode` factory is supposed to return both the node id *and* enough info to render it. The kit's `BooleansAdapter` declares it as `(path) => { id: string }`, and the resulting `InsertOp` carries the new node id but the *path* itself is communicated to the adapter via `insertNode` or `applyBatch` depending on the wiring. Verify by tracing one boolean op end-to-end against the real demo:

```bash
npm run dev
# then visit http://localhost:5173/#boolean-ops in the browser,
# select both paths in the Interactive panel, and click Union.
```

If clicking Union does nothing visible (delete fires but insert doesn't surface a renderable item), the bridge from `applyBatch` ops to scene state needs the *path* threaded through the op payload — inspect the `InsertOp` shape in `src/core/ops/types.ts` and update the `applyBatch` handler in `InteractivePanel` to extract the path from `op.node.path`, or stash the path-by-id map in a ref keyed off `createPathNode` calls. The "side channel" approach: in `createPathNode`, push `{ id, path }` into a ref-held map; in `applyBatch`'s `insert` branch, look up the path by `op.node.id`.

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Visit `http://localhost:5173/#boolean-ops`. Verify:

1. The interactive panel appears at the top of the grid.
2. Both paths are selected by default; all five PathfinderPanel buttons are enabled.
3. Clicking Union → both paths replaced by their union; selection follows the result.
4. Clicking Reset → restores the original two paths and selection.
5. Clicking on empty canvas → both paths deselected → all five buttons become disabled.
6. Re-selecting both → buttons re-enable.

- [ ] **Step 5: Run the test suite**

```bash
npm test
```
Expected: no regressions. The existing `boolean-ops.spec.ts` Playwright visual baseline still targets the *static* panels at the same `data-panel` attributes, which are unchanged.

- [ ] **Step 6: Commit**

```bash
git add demo/demos/BooleanOpsDemo.tsx
git commit -m "demo(boolean-ops): interactive panel powered by PathfinderPanel"
```

---

## Task 10: Update demo registry description

**Files:**

- Modify: `demo/registry.ts` (the `boolean-ops` entry, around line 326).

- [ ] **Step 1: Update the description and hint**

Find the `boolean-ops` entry (`id: 'boolean-ops'`) and replace its `description` and `hint` fields:

```ts
{
  id: 'boolean-ops',
  title: 'Boolean ops',
  category: 'Geometry',
  description: 'Five Pathfinder-style polygon-boolean operations on path geometry: union, intersect, subtract (back minus front, Illustrator "Minus Front" semantics), exclude (XOR), divide (fracture along intersections). Backed by `pathUnion` / `pathIntersect` / `pathSubtract` / `pathExclude` / `pathDivide` from the kit, which wrap a vendored `polygon-clipping` engine. The `useBooleans` hook composes these into one undoable selection action; the top "Interactive" region is wired to the `@weasel-js/ui` `<PathfinderPanel>` component, while the static rows below show each op applied to the same rect + circle inputs.',
  hint: 'In the Interactive region: click empty space to deselect, click both paths to re-enable. Click a Pathfinder button to commit the op; Reset restores the two source paths.',
  Component: BooleanOpsDemo,
  full: BooleanOpsDemoFull,
  path: 'demo/demos/BooleanOpsDemo.tsx',
},
```

- [ ] **Step 2: Verify the dev server still serves**

```bash
npm run dev
```
Open `#boolean-ops`, confirm the new description/hint render in the chrome.

- [ ] **Step 3: Commit**

```bash
git add demo/registry.ts
git commit -m "demo(registry): boolean-ops description covers interactive region"
```

---

## Task 11: Mark TODO entry as shipped

**Files:**

- Modify: `docs/TODO.md`

In the Tier 3 "Pathfinder follow-ups (post-v1)" section, the third bullet is currently `- **Pathfinder UI panel.** Icon palette / menu surface (currently the hook is imperative-only).` Update it to record that it shipped.

- [ ] **Step 1: Update the entry**

Replace that bullet with:

```markdown
- [x] **Pathfinder UI panel.** *Shipped 2026-05-11.* `@weasel-js/ui` now ships `<PathfinderPanel>` — five icon buttons surfacing the `useBooleans` actions, with default Pathfinder-convention SVG icons, adapter-derived disabled state (uniform `<2 valid paths` predicate), and overrides for icons, labels, and orientation. Demo: interactive region atop `demo/demos/BooleanOpsDemo.tsx` (`#boolean-ops`). Spec: `docs/superpowers/specs/2026-05-11-pathfinder-ui-panel-design.md`. Plan: `docs/superpowers/plans/2026-05-11-pathfinder-ui-panel.md`.
```

- [ ] **Step 2: Run the production gate**

```bash
npm run typecheck && npm test
```
Expected: both green. (This matches the `prepublishOnly` gate from `feedback_run_prepublish_before_push` memory.)

- [ ] **Step 3: Commit**

```bash
git add docs/TODO.md
git commit -m "docs(TODO): mark Pathfinder UI panel shipped"
```

---

## Self-review notes (for the implementer)

- **Spec coverage:** every section of the spec maps to a task. File layout (Tasks 1–8), API surface and hook coupling (Tasks 2–4), disabled-state derivation (Tasks 3, 5), visual design (Tasks 1, 6), testing (Tasks 1–5), demo integration (Tasks 9–10), public exports (Task 7).
- **The `applyBatch` wiring in Task 9 has a real gap** the spec doesn't fully resolve: how the result path travels from `createPathNode` into the scene state. The task includes an inline "side-channel" workaround using a ref-held `id → path` map. If end-to-end smoke fails at Task 9 Step 3, switch to that fallback before fighting the adapter shape.
- **Don't skip Step 2 (failing test) in any task.** The point of TDD discipline here is to catch silent regressions in tests that pass by accident (e.g. if `disabled` had a typo bug, Task 3's tests would still pass if Task 5's filter test wasn't there to prove the predicate path is reached). Each Step 2 confirms the test actually drives the production code.
- **`asNodeId` is the public way to mint a `NodeId` from a string literal** (per the project memory — "Demos and tests use `asNodeId('a')` at literal boundaries"). Don't widen to `string` at the panel boundary; the adapter's `getSelection` returns `NodeId[]` and the panel passes those through unchanged.
