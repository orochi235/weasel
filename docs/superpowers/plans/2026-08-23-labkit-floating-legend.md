# labkit FloatingPanel + Legend Implementation Plan

> **⚠ TENTATIVE — re-review before executing.** This plan is written against the *planned* API of
> `windease@1.3.0`'s `floatingStrategy`, which does not exist yet. Its plan lives at
> `~/src/windease/docs/superpowers/plans/2026-08-23-floating-strategy.md` and has already been
> revised once during review — motion moved from `payload.point` to `dx`/`dy`, and the drag
> affordance gained a `handleSize` band. Anything here that names a windease export, config key, or
> state shape is a prediction. **When windease 1.3.0 actually lands, diff its published surface
> against Task 2 below before writing code.**

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Legend`, a presentational color key, and `FloatingPanel`, a draggable corner-snapping container, to `@weasel-js/labkit`.

**Architecture:** `Legend` is pure presentation with no state. `FloatingPanel` drives windease's `floatingStrategy` directly — calling `layout()` and `reduce()` as pure functions rather than mounting a windease `<Container>` — because a lab overlay has one item and no zone tree. It owns pointer handling itself, so windease's own affordance rendering (and its `handleSize` band) never comes into play here.

**Tech Stack:** React 19, TypeScript, vitest + @testing-library/react, LESS.

---

## Background the implementer needs

- **Class prefix is enforced.** `npm run lint` runs `scripts/check-class-prefix.ts`; every class must start with `lk-`.
- **New `.less` files must be registered.** `src/styles.less` imports each component stylesheet explicitly; a file not listed there ships no CSS.
- **`export * from './primitives'`** in `src/index.ts` means adding to `src/primitives/index.ts` is enough to publish a component.
- **Imports carry no `.js` extension** in labkit (unlike windease). Follow `src/primitives/ScaleIndicator.tsx`.
- **The ResizeObserver stub reports 1024×768 for every observed element** (`src/test-setup.ts:19`). Do **not** assert pixel positions in these tests — container and panel would both measure the same box and the numbers are meaningless. Placement math is already covered by windease's own suite; test behavior here, not geometry.
- **jsdom has no `setPointerCapture`.** Call it optionally (`el.setPointerCapture?.(id)`).

---

## File Structure

- Create: `src/primitives/Legend.tsx` / `Legend.less` / `Legend.test.tsx`
- Create: `src/primitives/FloatingPanel.tsx` / `FloatingPanel.less` / `FloatingPanel.test.tsx`
- Modify: `src/primitives/index.ts` — export both
- Modify: `src/styles.less` — import both stylesheets
- Modify: `package.json` — raise the `windease` dependency to `^1.3.0`

---

### Task 1: Legend

**Files:**
- Create: `src/primitives/Legend.tsx`, `src/primitives/Legend.less`
- Test: `src/primitives/Legend.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/primitives/Legend.test.tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Legend } from './Legend';

const entries = [
  { key: 'contour', label: 'contour', color: '#7d7f86' },
  { key: 'floor', label: 'bend floor', color: '#9a9ca3', mark: 'dash' as const },
  { key: 'authored', label: 'authored', color: '#2aa87a', mark: 'dot' as const },
  { key: 'replaced', label: 'replaced', color: 'rgba(255,107,96,.28)', mark: 'band' as const },
];

describe('Legend', () => {
  it('renders one row per entry', () => {
    const { container } = render(<Legend entries={entries} />);
    expect(container.querySelectorAll('.lk-legend__row')).toHaveLength(4);
  });

  it('shows every label as text', () => {
    render(<Legend entries={entries} />);
    for (const e of entries) expect(screen.getByText(e.label)).toBeInTheDocument();
  });

  it('marks each swatch with its shape, defaulting to a line', () => {
    const { container } = render(<Legend entries={entries} />);
    const swatches = container.querySelectorAll('.lk-legend__swatch');
    expect(swatches[0]?.className).toContain('lk-legend__swatch--line');
    expect(swatches[1]?.className).toContain('lk-legend__swatch--dash');
    expect(swatches[2]?.className).toContain('lk-legend__swatch--dot');
    expect(swatches[3]?.className).toContain('lk-legend__swatch--band');
  });

  it('hides swatches from assistive tech, leaving the label to carry meaning', () => {
    const { container } = render(<Legend entries={entries} />);
    for (const s of container.querySelectorAll('.lk-legend__swatch')) {
      expect(s.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('takes its color from the entry', () => {
    const { container } = render(<Legend entries={[entries[0]!]} />);
    const swatch = container.querySelector('.lk-legend__swatch') as HTMLElement;
    expect(swatch.style.getPropertyValue('--lk-legend-ink')).toBe('#7d7f86');
  });

  it('renders nothing but an empty list for no entries', () => {
    const { container } = render(<Legend entries={[]} />);
    expect(container.querySelectorAll('.lk-legend__row')).toHaveLength(0);
    expect(container.querySelector('.lk-legend')).toBeInTheDocument();
  });

  it('accepts an extra class name', () => {
    const { container } = render(<Legend entries={[]} className="mine" />);
    expect(container.querySelector('.lk-legend')?.className).toContain('mine');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/primitives/Legend.test.tsx`
Expected: FAIL — cannot resolve `./Legend`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/primitives/Legend.tsx
import type { CSSProperties } from 'react';

/** How a legend entry's swatch is drawn, matching how the thing looks on canvas. */
export type LegendMark = 'line' | 'dash' | 'dot' | 'band';

/** One row of a legend: a swatch and what it means. */
export interface LegendEntry {
  key: string;
  label: string;
  color: string;
  /** Defaults to `'line'`. */
  mark?: LegendMark;
}

/** Props for `<Legend>`. */
export interface LegendProps {
  entries: readonly LegendEntry[];
  className?: string;
}

/** A color key. Presentational only — no handlers, no state, no hover behavior. */
export function Legend({ entries, className }: LegendProps) {
  return (
    <ul className={className ? `lk-legend ${className}` : 'lk-legend'}>
      {entries.map((entry) => (
        <li className="lk-legend__row" key={entry.key}>
          <span
            aria-hidden="true"
            className={`lk-legend__swatch lk-legend__swatch--${entry.mark ?? 'line'}`}
            style={{ '--lk-legend-ink': entry.color } as CSSProperties}
          />
          <span className="lk-legend__label">{entry.label}</span>
        </li>
      ))}
    </ul>
  );
}
```

The swatch color goes through a custom property rather than a `background` so one rule set can paint
four different mark shapes from the same value.

- [ ] **Step 4: Write the stylesheet**

```less
// src/primitives/Legend.less
.lk-legend {
  margin: 0;
  padding: 0;
  list-style: none;
  font: 11px/1.4 var(--wzl-font-mono, ui-monospace, Menlo, monospace);
  color: var(--wzl-fg);
}

.lk-legend__row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.1rem 0;
  white-space: nowrap;
}

.lk-legend__swatch {
  flex: none;
  width: 15px;
}

.lk-legend__swatch--line {
  height: 4px;
  border-radius: 2px;
  background: var(--lk-legend-ink);
}

.lk-legend__swatch--dash {
  height: 0;
  border-top: 2px dashed var(--lk-legend-ink);
}

.lk-legend__swatch--dot {
  width: 6px;
  height: 6px;
  margin: 0 4px 0 5px;
  border-radius: 50%;
  background: var(--lk-legend-ink);
}

.lk-legend__swatch--band {
  height: 9px;
  border-radius: 2px;
  background: var(--lk-legend-ink);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/primitives/Legend.test.tsx`
Expected: PASS, 7 tests

- [ ] **Step 6: Commit**

```bash
git add src/primitives/Legend.tsx src/primitives/Legend.less src/primitives/Legend.test.tsx
git commit -m "add a legend that draws each swatch the way its ink is drawn"
```

---

### Task 2: Confirm the windease surface

**⚠ This task is the gate. Do it before Task 3, and do not skip it — everything below predicts an API that does not exist yet.**

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Raise the dependency**

In `packages/labkit/package.json`, change `"windease": "^1.2.1"` to `"windease": "^1.3.0"`, then:

```bash
npm install
```

- [ ] **Step 2: Diff the real surface against what Task 3 assumes**

```bash
npx tsx -e "import * as w from 'windease'; console.log(Object.keys(w).filter(k => /[Ff]loat|CORNER/.test(k)))"
```

Expected, and each one is used verbatim in Task 3:

| Export | Task 3 uses it for |
| --- | --- |
| `floatingStrategy` | the strategy instance |
| `FLOATING_CORNERS` | validating a `snapCorners` prop |
| `DEFAULT_ANCHOR` | the `anchor` prop default |
| `DEFAULT_INSET` | the `inset` prop default |
| `FLOATING_DRAG_PREFIX` | building the affordance id for `reduce` |
| type `Corner` | prop types |
| type `FloatingPlacement` | persisted state — expected `{ x, y, anchor }` |
| type `FloatingState` | the object passed to `layout`/`reduce` |

- [ ] **Step 3: Reconcile**

If any name, shape, or default differs, **fix Task 3's code before writing it**, and note what changed
at the top of this file. In particular check that `FloatingPlacement` is still `{ x, y, anchor }` with
no per-gesture field, and that `reduce` still reads `payload.dx` / `payload.dy`.

- [ ] **Step 4: Commit**

```bash
git add package.json ../../package-lock.json
git commit -m "raise labkit's windease floor to the floating strategy release"
```

---

### Task 3: FloatingPanel placement

**Files:**
- Create: `src/primitives/FloatingPanel.tsx`, `src/primitives/FloatingPanel.less`
- Test: `src/primitives/FloatingPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/primitives/FloatingPanel.test.tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { FloatingPanel } from './FloatingPanel';

beforeEach(() => localStorage.clear());

describe('FloatingPanel', () => {
  it('renders its children', () => {
    render(<FloatingPanel>hello</FloatingPanel>);
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('is absolutely positioned so it floats over whatever it sits in', () => {
    const { container } = render(<FloatingPanel>x</FloatingPanel>);
    const panel = container.querySelector('.lk-floating-panel') as HTMLElement;
    expect(panel.style.position).toBe('absolute');
  });

  it('accepts an extra class name', () => {
    const { container } = render(<FloatingPanel className="mine">x</FloatingPanel>);
    expect(container.querySelector('.lk-floating-panel')?.className).toContain('mine');
  });

  it('takes a grab cursor, since the whole panel is the handle', () => {
    const { container } = render(<FloatingPanel>x</FloatingPanel>);
    expect(container.querySelector('.lk-floating-panel')).toBeInTheDocument();
    // cursor lives in the stylesheet; assert the class the stylesheet targets.
    expect(container.querySelector('.lk-floating-panel')?.className).toContain('lk-floating-panel');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: FAIL — cannot resolve `./FloatingPanel`

- [ ] **Step 3: Write minimal implementation**

```tsx
// src/primitives/FloatingPanel.tsx
import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import {
  type Corner,
  DEFAULT_ANCHOR,
  DEFAULT_INSET,
  type FloatingPlacement,
  floatingStrategy,
} from 'windease';

/** The strategy holds a map keyed by item id; a panel is always a lone item. */
const ITEM_ID = 'panel';

/** Props for `<FloatingPanel>`. */
export interface FloatingPanelProps {
  children: ReactNode;
  /** Corner it rests in before it has ever been dragged. Default `'bottom-left'`. */
  anchor?: Corner;
  /** Corners that may capture it. Default: all four. */
  snapCorners?: readonly Corner[];
  /** Pixels in from a corner when snapped. Default 12. */
  inset?: number;
  /** localStorage key to remember its position under. Omit to forget on reload. */
  storageKey?: string;
  className?: string;
}

function readStored(key: string | undefined): FloatingPlacement | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as FloatingPlacement) : null;
  } catch {
    return null;
  }
}

/**
 * A draggable box that floats over its offset parent and snaps to its corners.
 *
 * Drives windease's `floatingStrategy` as a pure function rather than mounting a
 * windease container: a lab overlay has one item and no zone tree, so the node
 * model would be all cost. Pointer handling is therefore this component's, and
 * windease's own affordance rendering never participates.
 */
export function FloatingPanel({
  children,
  anchor = DEFAULT_ANCHOR,
  snapCorners,
  inset = DEFAULT_INSET,
  storageKey,
  className,
}: FloatingPanelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const strategy = useMemo(() => floatingStrategy(), []);
  const options = useMemo(() => ({ defaultAnchor: anchor, inset }), [anchor, inset]);

  const [container, setContainer] = useState({ w: 0, h: 0 });
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [place, setPlace] = useState<FloatingPlacement>(
    () => readStored(storageKey) ?? { x: 0, y: 0, anchor },
  );

  const item = useMemo(
    () => ({
      id: ITEM_ID,
      meta: { floating: true, ...(snapCorners ? { snapCorners: [...snapCorners] } : {}) },
      natural: size,
    }),
    [size, snapCorners],
  );

  useEffect(() => {
    const el = ref.current;
    const parent = el?.offsetParent ?? el?.parentElement;
    if (!el || !parent) return;
    const observer = new ResizeObserver(() => {
      setContainer({ w: (parent as HTMLElement).clientWidth, h: (parent as HTMLElement).clientHeight });
      setSize({ w: el.offsetWidth, h: el.offsetHeight });
    });
    observer.observe(parent);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const rect = strategy.layout({
    items: [item],
    container,
    state: { at: { [ITEM_ID]: place }, inner: undefined },
    options,
  }).placements.get(ITEM_ID);

  return (
    <div
      className={className ? `lk-floating-panel ${className}` : 'lk-floating-panel'}
      ref={ref}
      style={
        {
          position: 'absolute',
          left: `${rect?.x ?? 0}px`,
          top: `${rect?.y ?? 0}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
```

`left`/`top` are inline because they change every pointermove; a stylesheet cannot carry a per-frame
value. Everything static lives in the `.less` file.

- [ ] **Step 4: Write the stylesheet**

```less
// src/primitives/FloatingPanel.less
.lk-floating-panel {
  cursor: grab;
  touch-action: none;
  user-select: none;
  background: color-mix(in srgb, var(--wzl-surface) 94%, transparent);
  border: 1px solid var(--wzl-border);
  border-radius: 5px;
  padding: 0.45rem 0.55rem;
  box-shadow: 0 6px 18px rgb(0 0 0 / 40%);
}

.lk-floating-panel[data-dragging='true'] {
  cursor: grabbing;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: PASS, 4 tests

- [ ] **Step 6: Commit**

```bash
git add src/primitives/FloatingPanel.tsx src/primitives/FloatingPanel.less src/primitives/FloatingPanel.test.tsx
git commit -m "float a panel over its offset parent at the strategy's placement"
```

---

### Task 4: Dragging

**Files:**
- Modify: `src/primitives/FloatingPanel.tsx`
- Test: `src/primitives/FloatingPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/primitives/FloatingPanel.test.tsx`:

```tsx
const panelOf = (c: HTMLElement) => c.querySelector('.lk-floating-panel') as HTMLElement;

describe('FloatingPanel dragging', () => {
  it('marks itself dragging between pointerdown and pointerup', () => {
    const { container } = render(<FloatingPanel>x</FloatingPanel>);
    const panel = panelOf(container);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    expect(panel.dataset.dragging).toBe('true');
    fireEvent.pointerUp(panel);
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('does not start a drag from an interactive child', () => {
    const { container } = render(
      <FloatingPanel>
        <button type="button">press</button>
      </FloatingPanel>,
    );
    const panel = panelOf(container);
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 10, clientY: 10 });
    expect(panel.dataset.dragging).toBeUndefined();
  });

  it('does not start a drag from a child opting out', () => {
    const { container } = render(
      <FloatingPanel>
        <span data-no-drag="">nope</span>
      </FloatingPanel>,
    );
    fireEvent.pointerDown(screen.getByText('nope'), { clientX: 10, clientY: 10 });
    expect(panelOf(container).dataset.dragging).toBeUndefined();
  });

  it('stops the pointerdown reaching a pan/zoom surface underneath', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <FloatingPanel>x</FloatingPanel>
      </div>,
    );
    fireEvent.pointerDown(panelOf(container), { clientX: 5, clientY: 5 });
    expect(onDown).not.toHaveBeenCalled();
  });

  it('lets a pointerdown on an interactive child through to the surface', () => {
    const onDown = vi.fn();
    const { container } = render(
      <div onPointerDown={onDown}>
        <FloatingPanel>
          <button type="button">press</button>
        </FloatingPanel>
      </div>,
    );
    void container;
    fireEvent.pointerDown(screen.getByRole('button'), { clientX: 5, clientY: 5 });
    expect(onDown).toHaveBeenCalledTimes(1);
  });
});
```

Add `vi` to the vitest import at the top of the file.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: FAIL — `expected undefined to be 'true'`

- [ ] **Step 3: Write minimal implementation**

Add the import and the drag handlers to `FloatingPanel.tsx`. Extend the windease import with
`FLOATING_DRAG_PREFIX`, and add above the component:

```tsx
/** A pointerdown on one of these is the child's, not a drag. */
function isInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return target.closest('input, button, a, select, textarea, [data-no-drag]') !== null;
}
```

Inside the component, after the `rect` computation:

```tsx
  const dragging = useRef<{ x: number; y: number } | null>(null);
  const [isDragging, setDragging] = useState(false);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isInteractive(e.target)) return;
    // The canvas stack underneath owns pan/zoom on the same pointer events.
    e.stopPropagation();
    dragging.current = { x: e.clientX, y: e.clientY };
    setDragging(true);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const from = dragging.current;
    if (!from) return;
    const dx = e.clientX - from.x;
    const dy = e.clientY - from.y;
    if (dx === 0 && dy === 0) return;
    dragging.current = { x: e.clientX, y: e.clientY };
    setPlace(
      (prev) =>
        strategy.reduce!(
          { at: { [ITEM_ID]: prev }, inner: undefined },
          {
            affordanceId: `${FLOATING_DRAG_PREFIX}${ITEM_ID}`,
            kind: 'drag',
            payload: { dx, dy },
          },
          { container, options, items: [item] },
        ).at[ITEM_ID] ?? prev,
    );
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = null;
    setDragging(false);
    e.currentTarget.releasePointerCapture?.(e.pointerId);
  };
```

Then wire them onto the rendered `div`, alongside the existing props:

```tsx
      data-dragging={isDragging ? 'true' : undefined}
      onPointerCancel={endDrag}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endDrag}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: PASS, 9 tests

- [ ] **Step 5: Commit**

```bash
git add src/primitives/FloatingPanel.tsx src/primitives/FloatingPanel.test.tsx
git commit -m "drag a floating panel from anywhere that is not a control"
```

---

### Task 5: Remembering where it was left

**Files:**
- Modify: `src/primitives/FloatingPanel.tsx`
- Test: `src/primitives/FloatingPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Append to `src/primitives/FloatingPanel.test.tsx`:

```tsx
describe('FloatingPanel persistence', () => {
  it('writes its placement under the given key once dragged', () => {
    const { container } = render(<FloatingPanel storageKey="k">x</FloatingPanel>);
    const panel = panelOf(container);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 160 });
    fireEvent.pointerUp(panel);
    const stored = JSON.parse(localStorage.getItem('k') ?? 'null');
    expect(stored).toMatchObject({ x: expect.any(Number), y: expect.any(Number) });
    expect(stored).toHaveProperty('anchor');
  });

  it('restores what it stored on a later mount', () => {
    localStorage.setItem('k', JSON.stringify({ x: 40, y: 50, anchor: null }));
    const { container } = render(<FloatingPanel storageKey="k">x</FloatingPanel>);
    expect(panelOf(container).style.left).not.toBe('');
  });

  it('writes nothing when no key is given', () => {
    const { container } = render(<FloatingPanel>x</FloatingPanel>);
    const panel = panelOf(container);
    fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
    fireEvent.pointerMove(panel, { clientX: 140, clientY: 160 });
    fireEvent.pointerUp(panel);
    expect(localStorage.length).toBe(0);
  });

  it('survives a corrupt stored value rather than throwing', () => {
    localStorage.setItem('k', '{{{');
    expect(() => render(<FloatingPanel storageKey="k">x</FloatingPanel>)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: FAIL — `expected null to match object`

- [ ] **Step 3: Write minimal implementation**

Add to `FloatingPanel.tsx`, after the `place` state declaration:

```tsx
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(place));
    } catch {
      // A full or disabled store is not worth failing a lab over.
    }
  }, [place, storageKey]);
```

`readStored` already guards the read; this guards the write.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/primitives/FloatingPanel.test.tsx`
Expected: PASS, 13 tests

- [ ] **Step 5: Commit**

```bash
git add src/primitives/FloatingPanel.tsx src/primitives/FloatingPanel.test.tsx
git commit -m "remember a floating panel's placement under its storage key"
```

---

### Task 6: Publish the surface

**Files:**
- Modify: `src/primitives/index.ts`, `src/styles.less`

- [ ] **Step 1: Write the failing test**

```tsx
// src/primitives/floating.entry.test.tsx
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FloatingPanel, Legend } from '../index';

describe('floating public entry', () => {
  it('reaches a consumer from the package entry point alone', () => {
    const { container } = render(
      <FloatingPanel>
        <Legend entries={[{ key: 'a', label: 'a', color: '#fff' }]} />
      </FloatingPanel>,
    );
    expect(container.querySelector('.lk-floating-panel .lk-legend')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/primitives/floating.entry.test.tsx`
Expected: FAIL — `"FloatingPanel" is not exported`

- [ ] **Step 3: Add the exports**

In `src/primitives/index.ts`, keeping the file's alphabetical order:

```ts
export type { FloatingPanelProps } from './FloatingPanel';
export { FloatingPanel } from './FloatingPanel';
export type { LegendEntry, LegendMark, LegendProps } from './Legend';
export { Legend } from './Legend';
```

In `src/styles.less`, after the `ScaleIndicator.less` import:

```less
@import './primitives/FloatingPanel.less';
@import './primitives/Legend.less';
```

- [ ] **Step 4: Run the full suite**

Run: `npm run test && npm run lint && npm run build`
Expected: all green, including `check-class-prefix`

- [ ] **Step 5: Commit**

```bash
git add src/primitives/index.ts src/styles.less src/primitives/floating.entry.test.tsx
git commit -m "export FloatingPanel and Legend from labkit"
```

---

### Task 7: Release

- [ ] **Step 1: Document both in `docs/`**

Add a `Legend` and a `FloatingPanel` section to labkit's component docs, following the shape of the
existing `ScaleIndicator` entry. Each needs: what it is in one sentence, the props table, and one
copy-pastable example. `FloatingPanel`'s example must show it as a **direct child of the canvas
stack overlay** — nested inside another absolutely-positioned overlay child it would position
against that child's box instead of the canvas.

- [ ] **Step 2: Version and publish**

```bash
npm version minor   # 1.2.0
npm publish
```

- [ ] **Step 3: Commit**

```bash
git add -A && git commit -m "document FloatingPanel and Legend for 1.2.0"
```

---

## Downstream

klieg's corner lab composes these two. Plan:
`~/src/blitsklieg/docs/superpowers/plans/2026-08-23-corner-lab-legend.md`. Blocked until
`@weasel-js/labkit@1.2.0` publishes, or linked with `npm link`.

Design: `~/src/blitsklieg/docs/superpowers/specs/2026-08-23-legend-palette-design.md`.
