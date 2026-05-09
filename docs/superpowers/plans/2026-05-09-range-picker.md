# RangePicker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `RangePicker` (a generic React component for editing arbitrary-length thumb lists on a 1D axis) and `paintGradientTrack` (a pure track-painter helper) in `packages/weasel-ui`, then port the perceptual-color experiment's sliders to a new demo for parity verification.

**Architecture:** One controlled React component, generic over a `Thumb` extension type, with a single render path (no native `<input type=range>`). Track painting is handled by a separate pure helper that returns a `renderTrack` closure. Per-thumb `bounds` may be a static tuple or a callback evaluated against the picker's in-flight thumb buffer per drag tick.

**Tech Stack:** React 19, TypeScript (strict, `verbatimModuleSyntax`, `noUnusedLocals`), CSS Modules, Vitest + jsdom + React Testing Library, Vite for the demo harness.

**Spec:** `docs/specs/2026-05-09-range-picker-design.md`

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/weasel-ui/src/RangePicker.tsx` | Component implementation. Drag, keyboard, ARIA, constraints, in-flight buffer, dynamic add/remove, shift-translate-all, thumb shape rendering, readouts. |
| `packages/weasel-ui/src/RangePicker.module.css` | Track / thumb / readout / hatched-region styles. References `--wui-track-*` and `--wui-thumb-*`. |
| `packages/weasel-ui/src/paintGradientTrack.tsx` | Pure helper: closure that renders a `<div>` with computed gradient + hatched-overlay background. |
| `packages/weasel-ui/src/RangePicker.test.tsx` | Component tests. |
| `packages/weasel-ui/src/paintGradientTrack.test.tsx` | Helper tests. |
| `packages/weasel-ui/src/tokens.css` | New CSS variables for default track + thumb appearance. **Modify.** |
| `packages/weasel-ui/src/index.ts` | Public exports. **Modify.** |
| `demo/demos/PerceptualColorSlidersDemo.tsx` | Demo porting the four representative slider variants from the experiment for visual + behavioral parity. |
| `demo/registry.ts` | Register the new demo. **Modify.** |

## Conventions

- All tests are colocated next to their source (matches the repo's `vitest.config.ts` glob `packages/**/*.test.{ts,tsx}`).
- Commit messages use the repo's conventional style (`feat(weasel-ui): …`, `test(weasel-ui): …`, `refactor(weasel-ui): …`).
- Each task ends with a commit that includes both source and test changes.
- TypeScript: strict + `verbatimModuleSyntax` means `import type` for type-only imports.
- CSS Modules: component-private class names.

## Test environment notes

- jsdom does not implement `Element.setPointerCapture` / `releasePointerCapture`. The component MUST NOT call these — use document-level pointer listeners during a drag (matches the perceptual-color experiment's pattern).
- jsdom's `getBoundingClientRect()` returns all zeros. Tests that rely on pointer-x → fraction conversion must stub the track element's `getBoundingClientRect`. Helper used in multiple tests:

  ```ts
  function stubRect(el: Element, rect: Partial<DOMRect>) {
    const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}), ...rect };
    (el as HTMLElement).getBoundingClientRect = () => full;
  }
  ```

  Define this once at the top of each test file that needs it; do not extract a shared helper file (each task should be self-contained).

---

## Task 1: Scaffold package files, tokens, and exports

**Files:**
- Create: `packages/weasel-ui/src/RangePicker.tsx`
- Create: `packages/weasel-ui/src/RangePicker.module.css`
- Create: `packages/weasel-ui/src/paintGradientTrack.tsx`
- Modify: `packages/weasel-ui/src/tokens.css`
- Modify: `packages/weasel-ui/src/index.ts`

- [ ] **Step 1: Add CSS variables to `tokens.css`**

Append to `packages/weasel-ui/src/tokens.css`, inside the `:root` block, before the closing `}`:

```css
  --wui-track-bg: #e3e3e3;
  --wui-track-border: #c2c2c2;
  --wui-thumb-fill: #ffffff;
  --wui-thumb-border: #6a6a6a;
```

- [ ] **Step 2: Create `RangePicker.module.css` with placeholder styles**

```css
.root {
  position: relative;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.track {
  position: relative;
  width: 100%;
  height: var(--rp-track-height, 24px);
  background: var(--wui-track-bg);
  border: 1px solid var(--wui-track-border);
  border-radius: 3px;
  overflow: hidden;
  cursor: crosshair;
}

.trackInner {
  position: absolute;
  inset: 0;
}

.thumb {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 14px;
  margin-left: -7px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wui-thumb-fill);
  border: 1px solid var(--wui-thumb-border);
  border-radius: 3px;
  cursor: ew-resize;
  font: 500 0.65rem/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--wui-text);
}

.thumb:focus-visible {
  outline: 2px solid var(--wui-accent);
  outline-offset: 1px;
}

.thumbActive {
  /* Visual marker for the dragging/focused thumb; subclass-overridable. */
  z-index: 1;
}

.readoutsBelow {
  position: relative;
  height: 14px;
  margin-top: 4px;
}

.readoutBelow {
  position: absolute;
  transform: translateX(-50%);
  font: 500 0.65rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--wui-text-muted);
  white-space: nowrap;
}

.readoutInline {
  display: inline-block;
  margin-left: 8px;
  font: 500 0.7rem/1 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  color: var(--wui-text-muted);
  vertical-align: middle;
}
```

- [ ] **Step 3: Create `RangePicker.tsx` with type definitions and an empty component**

```tsx
import type { ReactNode } from 'react';
import s from './RangePicker.module.css';

export type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;
};

export type ThumbShape =
  | 'round'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

export type Thumb = {
  value: number;
  label?: string;
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
};

export type BoundsCtx = {
  thumbs: readonly Thumb[];
  index: number;
};

export type TrackCtx = {
  trackWidth: number;
  valueToFraction: (v: number) => number;
};

export type RangePickerProps<T extends Thumb = Thumb> = {
  thumbs: readonly T[];
  onChange: (next: T[]) => void;
  onCommit?: (next: T[]) => void;
  min: number;
  max: number;
  step?: number;
  constraint?: 'free' | 'ordered';
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;
  allowShiftAll?: boolean;
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  trackHeight?: number;
  renderReadout?: (thumb: T, index: number) => ReactNode;
  readoutPlacement?: 'none' | 'inline-after' | 'below-thumb';
  ariaLabel?: string;
  className?: string;
};

export function RangePicker<T extends Thumb = Thumb>(_props: RangePickerProps<T>): JSX.Element {
  return <div className={s.root} />;
}
```

- [ ] **Step 4: Create `paintGradientTrack.tsx` with stub helper**

```tsx
import type { ReactNode } from 'react';
import type { TrackCtx } from './RangePicker';

export type GradientTrackOpts = {
  gradient: (t: number) => string;
  samples?: number;
  activeRange?: [number, number];
  hatch?: {
    angleDeg?: number;
    stripe?: number;
    gap?: number;
    dim?: number;
  };
};

export function paintGradientTrack(_opts: GradientTrackOpts): (ctx: TrackCtx) => ReactNode {
  return () => null;
}
```

- [ ] **Step 5: Export from `index.ts`**

Replace the contents of `packages/weasel-ui/src/index.ts`:

```ts
export {
  PropertiesPanel,
  PropertyRow,
  PropertyMiniLabel,
  PropertyReadOnly,
  PropertyTextInput,
  PropertyNumberInput,
  PropertyAxisInput,
  PropertyColorInput,
  PropertySelect,
  PropertySwatchGrid,
  PropertyButton,
} from './PropertiesPanel';
export { CommandPalette, useCommandPaletteShortcut } from './CommandPalette';
export type { CommandPaletteProps } from './CommandPalette';
export { RangePicker } from './RangePicker';
export type {
  RangePickerProps,
  Thumb,
  ThumbShape,
  ThumbRenderCtx,
  BoundsCtx,
  TrackCtx,
} from './RangePicker';
export { paintGradientTrack } from './paintGradientTrack';
export type { GradientTrackOpts } from './paintGradientTrack';
```

- [ ] **Step 6: Verify typecheck passes**

Run: `npm run typecheck`
Expected: PASS (no errors).

- [ ] **Step 7: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx \
        packages/weasel-ui/src/RangePicker.module.css \
        packages/weasel-ui/src/paintGradientTrack.tsx \
        packages/weasel-ui/src/tokens.css \
        packages/weasel-ui/src/index.ts
git commit -m "feat(weasel-ui): scaffold RangePicker and paintGradientTrack types"
```

---

## Task 2: Render thumbs at value-mapped positions

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Create: `packages/weasel-ui/src/RangePicker.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `packages/weasel-ui/src/RangePicker.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RangePicker } from './RangePicker';

describe('RangePicker rendering', () => {
  it('renders one thumb per item with left% mapped from value', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0 }, { value: 0.5 }, { value: 1 }]}
        onChange={() => {}}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    expect(thumbs).toHaveLength(3);
    expect(thumbs[0].style.left).toBe('0%');
    expect(thumbs[1].style.left).toBe('50%');
    expect(thumbs[2].style.left).toBe('100%');
  });
});
```

- [ ] **Step 2: Run test, verify it fails**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — no thumbs rendered.

- [ ] **Step 3: Implement static thumb rendering**

Replace the `RangePicker` body in `packages/weasel-ui/src/RangePicker.tsx`:

```tsx
export function RangePicker<T extends Thumb = Thumb>(props: RangePickerProps<T>): JSX.Element {
  const { thumbs, min, max, trackHeight, ariaLabel, className } = props;

  const valueToFraction = (v: number): number => {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (v - min) / (max - min)));
  };

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as React.CSSProperties) : undefined}
    >
      <div className={s.track}>
        {thumbs.map((thumb, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={thumb.value}
            aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
            className={s.thumb}
            style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
          >
            {thumb.label ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Add the React import at the top of the file:

```tsx
import type { CSSProperties, ReactNode } from 'react';
```

(Replace the existing `import type { ReactNode } from 'react';`.)

Replace the inline `React.CSSProperties` cast with `CSSProperties`:

```tsx
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
```

- [ ] **Step 4: Run test, verify it passes**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker renders thumbs at value-mapped positions"
```

---

## Task 3: Single-thumb pointer drag with min/max clamp and step snap

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

The picker holds an in-flight thumb buffer in a ref during a drag, fires `onChange` with the buffer's contents on each pointermove, and fires `onCommit` once on pointerup. Document-level pointer listeners avoid `setPointerCapture`.

- [ ] **Step 1: Write the failing test**

Append to `packages/weasel-ui/src/RangePicker.test.tsx`:

```tsx
import { fireEvent } from '@testing-library/react';

function stubRect(el: Element, rect: Partial<DOMRect> = {}) {
  const full: DOMRect = { x: 0, y: 0, width: 200, height: 24, top: 0, left: 0, right: 200, bottom: 24, toJSON: () => ({}), ...rect };
  (el as HTMLElement).getBoundingClientRect = () => full;
}

describe('RangePicker single-thumb drag', () => {
  it('drags a thumb and emits onChange continuously and onCommit on pointerup', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onCommit={onCommit}
      />,
    );
    const track = container.querySelector(`.${'track' /* placeholder */}`);
    // We don't have a stable class for the track in tests; query by role instead:
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    const trackEl = thumb.parentElement!;
    stubRect(trackEl, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onChange).toHaveBeenCalled();
    const lastCallArgs = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(lastCallArgs[0].value).toBeCloseTo(0.75, 2);
    expect(onCommit).not.toHaveBeenCalled();

    fireEvent.pointerUp(document, { clientX: 150, clientY: 12, pointerId: 1 });
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0][0].value).toBeCloseTo(0.75, 2);
  });

  it('clamps drag to min/max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={1} step={0.01} thumbs={[{ value: 0.5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: -50, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0);

    fireEvent.pointerMove(document, { clientX: 9999, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(1);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('snaps drag to step', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });

    fireEvent.pointerDown(thumb, { clientX: 100, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 137, clientY: 12, pointerId: 1 }); // ~6.85 → snap to 7
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(7);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
```

Add the `vi` import at the top with the other vitest imports:

```tsx
import { describe, it, expect, vi } from 'vitest';
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — no drag logic, onChange never called.

- [ ] **Step 3: Implement drag logic**

Replace `packages/weasel-ui/src/RangePicker.tsx` with:

```tsx
import { useCallback, useRef, type CSSProperties, type ReactNode } from 'react';
import s from './RangePicker.module.css';

export type ThumbRenderCtx = {
  width: number;
  height: number;
  isActive: boolean;
};

export type ThumbShape =
  | 'round'
  | 'notched'
  | { render: (ctx: ThumbRenderCtx) => ReactNode };

export type Thumb = {
  value: number;
  label?: string;
  shape?: ThumbShape;
  bounds?: [number, number] | ((ctx: BoundsCtx) => [number, number]);
};

export type BoundsCtx = {
  thumbs: readonly Thumb[];
  index: number;
};

export type TrackCtx = {
  trackWidth: number;
  valueToFraction: (v: number) => number;
};

export type RangePickerProps<T extends Thumb = Thumb> = {
  thumbs: readonly T[];
  onChange: (next: T[]) => void;
  onCommit?: (next: T[]) => void;
  min: number;
  max: number;
  step?: number;
  constraint?: 'free' | 'ordered';
  onAddThumb?: (atValue: number) => T | null;
  onRemoveThumb?: (index: number) => boolean;
  allowShiftAll?: boolean;
  renderTrack?: (ctx: TrackCtx) => ReactNode;
  trackHeight?: number;
  renderReadout?: (thumb: T, index: number) => ReactNode;
  readoutPlacement?: 'none' | 'inline-after' | 'below-thumb';
  ariaLabel?: string;
  className?: string;
};

function snap(v: number, step: number | undefined, min: number): number {
  if (step === undefined || step <= 0) return v;
  return Math.round((v - min) / step) * step + min;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export function RangePicker<T extends Thumb = Thumb>(props: RangePickerProps<T>): JSX.Element {
  const { thumbs, onChange, onCommit, min, max, step, trackHeight, ariaLabel, className } = props;

  const trackRef = useRef<HTMLDivElement | null>(null);
  // In-flight thumb buffer during a drag; null when not dragging.
  const dragBufferRef = useRef<T[] | null>(null);

  const valueToFraction = useCallback(
    (v: number): number => (max === min ? 0 : clamp((v - min) / (max - min), 0, 1)),
    [min, max],
  );

  const fractionToValue = useCallback(
    (f: number): number => min + clamp(f, 0, 1) * (max - min),
    [min, max],
  );

  const beginThumbDrag = useCallback(
    (index: number) => {
      const buf: T[] = thumbs.map(t => ({ ...t }));
      dragBufferRef.current = buf;

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const f = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        let v = fractionToValue(f);
        v = snap(v, step, min);
        v = clamp(v, min, max);
        buffer[index] = { ...buffer[index], value: v };
        onChange(buffer.map(t => ({ ...t })));
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (buffer && onCommit) onCommit(buffer.map(t => ({ ...t })));
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [thumbs, onChange, onCommit, fractionToValue, min, max, step],
  );

  const onThumbPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    beginThumbDrag(index);
  };

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
    >
      <div className={s.track} ref={trackRef}>
        {thumbs.map((thumb, i) => (
          <div
            key={i}
            role="slider"
            tabIndex={0}
            aria-orientation="horizontal"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={thumb.value}
            aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
            className={s.thumb}
            style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
            onPointerDown={onThumbPointerDown(i)}
          >
            {thumb.label ?? ''}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): single-thumb drag with min/max clamp and step snap"
```

---

## Task 4: Keyboard navigation and ARIA

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Keyboard:
- ArrowLeft / ArrowDown: −1 step
- ArrowRight / ArrowUp: +1 step
- Shift+Arrow: ±10 steps
- PageDown / PageUp: ±10 steps
- Home: snap to `min` (or thumb's `bounds[0]`)
- End: snap to `max` (or thumb's `bounds[1]`)
- Each keystroke fires `onChange` and `onCommit`.

- [ ] **Step 1: Write the failing test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker keyboard', () => {
  it('arrow right increments by step and fires onChange + onCommit', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} onCommit={onCommit} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight' });
    expect(onChange.mock.calls[0][0][0].value).toBe(6);
    expect(onCommit.mock.calls[0][0][0].value).toBe(6);
  });

  it('shift+arrow moves by 10 steps; PageUp/Down do the same', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={100} step={1} thumbs={[{ value: 50 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'ArrowRight', shiftKey: true });
    expect(onChange.mock.calls[0][0][0].value).toBe(60);
    fireEvent.keyDown(thumb, { key: 'PageDown' });
    expect(onChange.mock.calls[1][0][0].value).toBe(50);
  });

  it('Home snaps to min, End snaps to max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker min={0} max={10} step={1} thumbs={[{ value: 5 }]} onChange={onChange} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange.mock.calls[0][0][0].value).toBe(0);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onChange.mock.calls[1][0][0].value).toBe(10);
  });

  it('exposes ARIA attributes on each thumb', () => {
    const { container } = render(
      <RangePicker min={0} max={1} thumbs={[{ value: 0.25 }]} ariaLabel="Hue" onChange={() => {}} />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.getAttribute('aria-orientation')).toBe('horizontal');
    expect(thumb.getAttribute('aria-valuemin')).toBe('0');
    expect(thumb.getAttribute('aria-valuemax')).toBe('1');
    expect(thumb.getAttribute('aria-valuenow')).toBe('0.25');
    expect(thumb.getAttribute('aria-label')).toBe('Hue');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — no key handlers.

- [ ] **Step 3: Add keyboard handler**

In `RangePicker.tsx`, add a `defaultStep` helper just below the `clamp` helper:

```ts
function defaultStep(step: number | undefined, min: number, max: number): number {
  if (step !== undefined && step > 0) return step;
  return (max - min) / 100;
}
```

Inside the `RangePicker` component, after the `onThumbPointerDown` definition, add:

```tsx
  const onThumbKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const stepSize = defaultStep(step, min, max);
    let delta = 0;
    let absoluteValue: number | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = e.shiftKey ? stepSize * 10 : stepSize;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = e.shiftKey ? -stepSize * 10 : -stepSize;
        break;
      case 'PageUp':
        delta = stepSize * 10;
        break;
      case 'PageDown':
        delta = -stepSize * 10;
        break;
      case 'Home':
        absoluteValue = min;
        break;
      case 'End':
        absoluteValue = max;
        break;
      default:
        return;
    }

    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const current = next[index].value;
    let v = absoluteValue ?? current + delta;
    v = snap(v, step, min);
    v = clamp(v, min, max);
    next[index] = { ...next[index], value: v };
    onChange(next);
    onCommit?.(next);
  };
```

Wire it onto the thumb element by adding `onKeyDown={onThumbKeyDown(i)}` next to `onPointerDown` in the JSX.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS (8 tests cumulative).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): keyboard navigation + ARIA on RangePicker thumbs"
```

---

## Task 5: Multi-thumb 'free' constraint (default)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

The default `constraint` is `'free'` — thumbs can pass each other. Task 3's drag already supports this (no neighbor logic). We add a regression test that verifies the picker preserves order in `onChange` (i.e., the array is indexed positionally, not sorted).

- [ ] **Step 1: Write the test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker free constraint', () => {
  it('thumbs may pass each other; onChange preserves index order', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });

    // Drag thumb 0 (start at 0.3 → x=60) past thumb 1 (at 0.7 → x=140) to x=180 (~0.9).
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.9, 2);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
```

- [ ] **Step 2: Run, verify it passes (default behavior already)**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS — the test confirms the default 'free' behavior already works.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "test(weasel-ui): RangePicker 'free' constraint preserves index order"
```

---

## Task 6: 'ordered' constraint with hairline gap

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Drag, constraint `'ordered'`: a moving thumb is clamped to `(thumbs[i-1].value, thumbs[i+1].value)` exclusive, with a hairline gap of `step` (or `(max-min)/1000` if `step` undefined). Caps still apply.

- [ ] **Step 1: Write the failing test**

Append to `RangePicker.test.tsx`:

```tsx
describe("RangePicker 'ordered' constraint", () => {
  it('clamps lower thumb to (lower-neighbor, upper-neighbor − step)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 180, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    // thumb 0 must stay strictly below 0.7 with at least 0.01 gap.
    expect(last[0].value).toBeLessThanOrEqual(0.69);
    expect(last[1].value).toBeCloseTo(0.7, 2);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('clamps upper thumb to (lower-neighbor + step, max)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        constraint="ordered"
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[1], { clientX: 140, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[1].value).toBeGreaterThanOrEqual(0.31);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — no constraint logic yet; thumbs cross each other.

- [ ] **Step 3: Apply constraint inside the drag move handler**

In `RangePicker.tsx`, replace the `onMove` body inside `beginThumbDrag` with:

```ts
      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const f = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        let v = fractionToValue(f);
        v = snap(v, step, min);
        v = clamp(v, min, max);

        if (constraint === 'ordered') {
          const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
          const lower = index > 0 ? buffer[index - 1].value + gap : min;
          const upper = index < buffer.length - 1 ? buffer[index + 1].value - gap : max;
          v = clamp(v, lower, upper);
        }

        buffer[index] = { ...buffer[index], value: v };
        onChange(buffer.map(t => ({ ...t })));
      };
```

Add `constraint` to the destructured props at the top of the component:

```ts
  const { thumbs, onChange, onCommit, min, max, step, constraint, trackHeight, ariaLabel, className } = props;
```

Add `constraint` to the dependency array of `beginThumbDrag`'s `useCallback`:

```ts
    [thumbs, onChange, onCommit, fractionToValue, min, max, step, constraint],
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker 'ordered' constraint with hairline gap"
```

---

## Task 7: Per-thumb `bounds` (tuple form)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

A thumb's `bounds` (when a tuple) clamps it independent of the picker's overall `min`/`max` and independent of `constraint`. Applies in drag, keyboard, and Home/End.

- [ ] **Step 1: Write the failing tests**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker per-thumb bounds (tuple form)', () => {
  it('clamps drag to bounds', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onChange={onChange}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    stubRect(thumb.parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumb, { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 0, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0.1);
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    expect(onChange.mock.calls[onChange.mock.calls.length - 1][0][0].value).toBe(0.5);
    fireEvent.pointerUp(document, { pointerId: 1 });
  });

  it('Home snaps to bounds[0]; End snaps to bounds[1]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.3, bounds: [0.1, 0.5] }]}
        onChange={onChange}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.keyDown(thumb, { key: 'Home' });
    expect(onChange.mock.calls[0][0][0].value).toBe(0.1);
    fireEvent.keyDown(thumb, { key: 'End' });
    expect(onChange.mock.calls[1][0][0].value).toBe(0.5);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add a bounds-resolver helper and apply it**

In `RangePicker.tsx`, just below the `defaultStep` helper, add:

```ts
function resolveBounds(thumb: Thumb, ctx: BoundsCtx, fallbackMin: number, fallbackMax: number): [number, number] {
  if (!thumb.bounds) return [fallbackMin, fallbackMax];
  const tuple = typeof thumb.bounds === 'function' ? thumb.bounds(ctx) : thumb.bounds;
  return [tuple[0], tuple[1]];
}
```

In `beginThumbDrag`'s `onMove`, after the existing clamps and before the constraint clamp, insert:

```ts
        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);
```

Then replace the entire `onThumbKeyDown` from Task 4 with the version below — it folds Home/End handling and bounds clamping into one cohesive block:

```tsx
  const onThumbKeyDown = (index: number) => (e: React.KeyboardEvent) => {
    const stepSize = defaultStep(step, min, max);
    let delta = 0;
    let snapTo: 'home' | 'end' | null = null;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        delta = e.shiftKey ? stepSize * 10 : stepSize;
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        delta = e.shiftKey ? -stepSize * 10 : -stepSize;
        break;
      case 'PageUp':
        delta = stepSize * 10;
        break;
      case 'PageDown':
        delta = -stepSize * 10;
        break;
      case 'Home':
        snapTo = 'home';
        break;
      case 'End':
        snapTo = 'end';
        break;
      default:
        return;
    }

    e.preventDefault();
    const next = thumbs.map(t => ({ ...t }));
    const [bLo, bHi] = resolveBounds(next[index], { thumbs: next, index }, min, max);
    const lo = Math.max(min, bLo);
    const hi = Math.min(max, bHi);
    let v: number;
    if (snapTo === 'home') v = lo;
    else if (snapTo === 'end') v = hi;
    else v = next[index].value + delta;
    v = snap(v, step, min);
    v = clamp(v, lo, hi);
    next[index] = { ...next[index], value: v };
    onChange(next);
    onCommit?.(next);
  };
```

Add `bounds` to the dependency array if you wrap this in a `useCallback` (it's fine to leave it inline). The `next` array is properly typed at the call site.

Note: `resolveBounds` accepts `Thumb`, but `thumbs` is `readonly T[]` where `T extends Thumb` — TypeScript will accept the upcast directly.

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): per-thumb bounds (tuple form) clamps drag and Home/End"
```

---

## Task 8: Per-thumb `bounds` (callback form)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

The callback form is already supported by `resolveBounds` (it dispatches on `typeof bounds === 'function'`). Add a regression test that exercises the in-flight buffer.

- [ ] **Step 1: Write the test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker per-thumb bounds (callback form)', () => {
  it('callback receives the in-flight thumb buffer and clamps using neighbor values', () => {
    const onChange = vi.fn();
    // Two thumbs; thumb 0 cannot exceed thumb 1's value − 0.05.
    const thumbsProp = [
      {
        value: 0.3,
        bounds: ({ thumbs }: { thumbs: readonly { value: number }[]; index: number }) =>
          [0, thumbs[1].value - 0.05] as [number, number],
      },
      { value: 0.7 },
    ];
    const { container } = render(
      <RangePicker min={0} max={1} step={0.01} thumbs={thumbsProp} onChange={onChange} />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    fireEvent.pointerMove(document, { clientX: 200, clientY: 12, pointerId: 1 });
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last[0].value).toBeCloseTo(0.65, 2); // 0.7 − 0.05
    fireEvent.pointerUp(document, { pointerId: 1 });
  });
});
```

- [ ] **Step 2: Run, verify it passes**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "test(weasel-ui): per-thumb bounds callback receives in-flight buffer"
```

---

## Task 9: Click-on-track to add (`onAddThumb`)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

When `onAddThumb` is defined, a pointerdown on the track itself (not a thumb) computes the value at the pointer's x and calls `onAddThumb(atValue)`. If the callback returns a `T`, the picker fires `onChange` and `onCommit` with the appended thumb. If it returns `null`, the click is a no-op.

- [ ] **Step 1: Write the failing test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker click-on-track to add', () => {
  it('appends thumb returned by onAddThumb on track click', () => {
    const onChange = vi.fn();
    const onCommit = vi.fn();
    const onAddThumb = vi.fn((at: number) => ({ value: Math.round(at * 100) / 100 }));
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onCommit={onCommit}
        onAddThumb={onAddThumb}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onAddThumb).toHaveBeenCalledWith(0.25);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
    expect(onCommit.mock.calls[0][0]).toEqual([{ value: 0.5 }, { value: 0.25 }]);
  });

  it('null return is a no-op', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onAddThumb={() => null}
      />,
    );
    const track = container.querySelector('[role="slider"]')!.parentElement!;
    stubRect(track, { left: 0, width: 200 });
    fireEvent.pointerDown(track, { clientX: 50, clientY: 12, pointerId: 1, button: 0 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement track click**

In `RangePicker.tsx`, add inside the component (after `onThumbPointerDown`):

```tsx
  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (!props.onAddThumb) return;
    // If the event originated on a thumb, the thumb's own handler ran first; this is a track click.
    if ((e.target as HTMLElement).closest(`.${s.thumb}`)) return;
    e.preventDefault();
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const f = clamp((e.clientX - rect.left) / rect.width, 0, 1);
    let v = fractionToValue(f);
    v = snap(v, step, min);
    v = clamp(v, min, max);
    const created = props.onAddThumb(v);
    if (!created) return;
    const next = [...thumbs.map(t => ({ ...t })), created] as T[];
    onChange(next);
    onCommit?.(next);
  };
```

Wire it onto the track div:

```tsx
      <div className={s.track} ref={trackRef} onPointerDown={onTrackPointerDown}>
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker click-on-track to add via onAddThumb"
```

---

## Task 10: Drag-off-vertical and right-click to remove (`onRemoveThumb`)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Remove:
- During a thumb drag, if pointer y exits the track band by more than `trackHeight` vertically, on pointerup the picker calls `onRemoveThumb(index)`. If it returns truthy, the picker emits `onChange` with the thumb removed.
- Right-click (`contextmenu`) on a thumb calls `onRemoveThumb(index)` with the same removal semantics, and prevents the default menu.

- [ ] **Step 1: Write the failing tests**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker remove (drag-off and right-click)', () => {
  it('drag-off-vertical removes thumb on pointerup if onRemoveThumb returns true', () => {
    const onChange = vi.fn();
    const onRemoveThumb = vi.fn(() => true);
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
        onRemoveThumb={onRemoveThumb}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[0].parentElement!, { left: 0, width: 200, top: 0, bottom: 24, height: 24 });

    fireEvent.pointerDown(thumbs[0], { clientX: 60, clientY: 12, pointerId: 1, button: 0 });
    // Drag well below the track band — y > top + height + trackHeight (24 + 24 = 48).
    fireEvent.pointerMove(document, { clientX: 60, clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(document, { clientX: 60, clientY: 100, pointerId: 1 });
    expect(onRemoveThumb).toHaveBeenCalledWith(0);
    const last = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(last).toEqual([{ value: 0.7 }]);
  });

  it('right-click on thumb removes via onRemoveThumb', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.3 }, { value: 0.7 }]}
        onChange={onChange}
        onRemoveThumb={() => true}
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    fireEvent.contextMenu(thumbs[1]);
    expect(onChange.mock.calls[0][0]).toEqual([{ value: 0.3 }]);
  });

  it('onRemoveThumb returning false leaves thumbs intact', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={onChange}
        onRemoveThumb={() => false}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    fireEvent.contextMenu(thumb);
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement remove gestures**

In `RangePicker.tsx`, add inside the component (near the other handlers):

```tsx
  const onThumbContextMenu = (index: number) => (e: React.MouseEvent) => {
    if (!props.onRemoveThumb) return;
    e.preventDefault();
    const accepted = props.onRemoveThumb(index);
    if (!accepted) return;
    const next = thumbs.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
    onChange(next);
    onCommit?.(next);
  };
```

Wire onto the thumb element:

```tsx
            onPointerDown={onThumbPointerDown(i)}
            onKeyDown={onThumbKeyDown(i)}
            onContextMenu={onThumbContextMenu(i)}
```

For drag-off-vertical, modify `beginThumbDrag` to track whether the drag exited the band, and use the result on pointerup. Replace the entire `beginThumbDrag` function with:

```tsx
  const beginThumbDrag = useCallback(
    (index: number) => {
      const buf: T[] = thumbs.map(t => ({ ...t }));
      dragBufferRef.current = buf;
      let droppedOff = false;

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const f = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
        let v = fractionToValue(f);
        v = snap(v, step, min);
        v = clamp(v, min, max);

        const [bLo, bHi] = resolveBounds(buffer[index], { thumbs: buffer, index }, min, max);
        v = clamp(v, bLo, bHi);

        if (constraint === 'ordered') {
          const gap = step !== undefined && step > 0 ? step : (max - min) / 1000;
          const lower = index > 0 ? buffer[index - 1].value + gap : min;
          const upper = index < buffer.length - 1 ? buffer[index + 1].value - gap : max;
          v = clamp(v, lower, upper);
        }

        // Drop-off detection: pointer exits the track vertically by more than trackHeight.
        const bandHeight = rect.height;
        if (props.onRemoveThumb) {
          if (ev.clientY < rect.top - bandHeight || ev.clientY > rect.bottom + bandHeight) {
            droppedOff = true;
          } else {
            droppedOff = false;
          }
        }

        buffer[index] = { ...buffer[index], value: v };
        onChange(buffer.map(t => ({ ...t })));
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (!buffer) return;

        if (droppedOff && props.onRemoveThumb) {
          const accepted = props.onRemoveThumb(index);
          if (accepted) {
            const next = buffer.filter((_, i) => i !== index).map(t => ({ ...t })) as T[];
            onChange(next);
            onCommit?.(next);
            return;
          }
        }

        if (onCommit) onCommit(buffer.map(t => ({ ...t })));
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
    },
    [thumbs, onChange, onCommit, fractionToValue, min, max, step, constraint, props],
  );
```

(The `props` reference in the dependency array picks up `onRemoveThumb` changes.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker drag-off-vertical and right-click remove"
```

---

## Task 11: `allowShiftAll` shift-drag translates all thumbs

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Drag, modifier behavior: with shift held on pointerdown and `allowShiftAll === true`, all thumbs translate by the same delta. The delta is reduced as needed so no thumb crosses `min` or `max`. Per-thumb bounds are also respected (each thumb's clamp narrows the allowed delta).

- [ ] **Step 1: Write the failing test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker allowShiftAll', () => {
  it('shift-drag moves all thumbs by the same delta clamped to [min, max]', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.8 }]}
        onChange={onChange}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[1].parentElement!, { left: 0, width: 200 });

    // Pointer starts at thumb[1]'s center (x=100, value=0.5). Drag right by +30 px → +0.15 delta.
    fireEvent.pointerDown(thumbs[1], { clientX: 100, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 130, clientY: 12, pointerId: 1, shiftKey: true });
    const after = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.35, 2);
    expect(after[1].value).toBeCloseTo(0.65, 2);
    expect(after[2].value).toBeCloseTo(0.95, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });

  it('clamps the shift-drag delta so no thumb crosses max', () => {
    const onChange = vi.fn();
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        step={0.01}
        thumbs={[{ value: 0.2 }, { value: 0.5 }, { value: 0.9 }]}
        onChange={onChange}
        allowShiftAll
      />,
    );
    const thumbs = container.querySelectorAll<HTMLElement>('[role="slider"]');
    stubRect(thumbs[2].parentElement!, { left: 0, width: 200 });
    fireEvent.pointerDown(thumbs[2], { clientX: 180, clientY: 12, pointerId: 1, button: 0, shiftKey: true });
    fireEvent.pointerMove(document, { clientX: 240, clientY: 12, pointerId: 1, shiftKey: true });
    // Requested delta = +0.30 px-fraction, but max delta = 1 − 0.9 = 0.1.
    const after = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(after[0].value).toBeCloseTo(0.3, 2);
    expect(after[1].value).toBeCloseTo(0.6, 2);
    expect(after[2].value).toBeCloseTo(1.0, 2);
    fireEvent.pointerUp(document, { pointerId: 1, shiftKey: true });
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — shift treated as ordinary drag, only one thumb moves.

- [ ] **Step 3: Branch on shift in `beginThumbDrag`**

In `RangePicker.tsx`, replace the `onThumbPointerDown` handler with one that detects shift and dispatches:

```tsx
  const onThumbPointerDown = (index: number) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    if (e.shiftKey && props.allowShiftAll) {
      beginShiftAllDrag(index, e.clientX);
    } else {
      beginThumbDrag(index);
    }
  };
```

Add `beginShiftAllDrag` near `beginThumbDrag`:

```tsx
  const beginShiftAllDrag = useCallback(
    (anchorIndex: number, anchorX: number) => {
      const buf: T[] = thumbs.map(t => ({ ...t }));
      const startValues = buf.map(t => t.value);
      dragBufferRef.current = buf;

      const onMove = (ev: PointerEvent) => {
        const track = trackRef.current;
        const buffer = dragBufferRef.current;
        if (!track || !buffer) return;
        const rect = track.getBoundingClientRect();
        const dxFraction = (ev.clientX - anchorX) / rect.width;
        let dValue = dxFraction * (max - min);
        dValue = snap(dValue, step, 0);

        // Clamp delta so no thumb leaves [min, max] (ignoring per-thumb bounds for translate-all,
        // matching the experiment's hue-band shift-translate semantics).
        let allowedNeg = -Infinity;
        let allowedPos = Infinity;
        for (let i = 0; i < startValues.length; i++) {
          allowedNeg = Math.max(allowedNeg, min - startValues[i]);
          allowedPos = Math.min(allowedPos, max - startValues[i]);
        }
        dValue = clamp(dValue, allowedNeg, allowedPos);

        for (let i = 0; i < buffer.length; i++) {
          buffer[i] = { ...buffer[i], value: clamp(startValues[i] + dValue, min, max) };
        }
        onChange(buffer.map(t => ({ ...t })));
      };

      const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
        const buffer = dragBufferRef.current;
        dragBufferRef.current = null;
        if (buffer && onCommit) onCommit(buffer.map(t => ({ ...t })));
      };

      document.addEventListener('pointermove', onMove);
      document.addEventListener('pointerup', onUp);
      void anchorIndex; // anchorIndex unused but kept for future reference; eslint will not complain because tsc has noUnusedParameters
    },
    [thumbs, onChange, onCommit, min, max, step],
  );
```

The `anchorIndex` is declared but unused; either drop it from the signature or reference it. Cleanest: drop it. Replace the function signature with `(anchorX: number)` and update the call site to `beginShiftAllDrag(e.clientX)`.

(Per-thumb bounds are intentionally not enforced during shift-translate-all — the hue-band UX in the experiment is: hold shift, drag the whole set together, every thumb stays on the axis. A future iteration could add per-thumb bounds to the clamp; out of scope here.)

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker allowShiftAll shift-drag translate-all"
```

---

## Task 12: Track customization via `renderTrack`

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

`renderTrack(ctx)` returns a `ReactNode` rendered inside an absolutely-positioned, `inset: 0` container behind the thumbs. The picker measures the track width on mount and on resize via `ResizeObserver`, and re-invokes `renderTrack` whenever `trackWidth` changes.

- [ ] **Step 1: Write the failing test**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker renderTrack', () => {
  it('invokes renderTrack with a TrackCtx and renders its output behind thumbs', () => {
    const renderTrack = vi.fn(() => <div data-testid="custom-track">painted</div>);
    const { getByTestId } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        onChange={() => {}}
        renderTrack={renderTrack}
      />,
    );
    expect(renderTrack).toHaveBeenCalled();
    const arg = renderTrack.mock.calls[0][0];
    expect(typeof arg.valueToFraction).toBe('function');
    expect(arg.valueToFraction(0.5)).toBeCloseTo(0.5, 5);
    expect(getByTestId('custom-track')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify it fails**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL — `renderTrack` not invoked.

- [ ] **Step 3: Wire `renderTrack` into the JSX**

In `RangePicker.tsx`, just inside the `<div className={s.track}>`, before the thumbs map, add:

```tsx
        {props.renderTrack && (
          <div className={s.trackInner}>
            {props.renderTrack({
              trackWidth: trackRef.current?.getBoundingClientRect().width ?? 0,
              valueToFraction,
            })}
          </div>
        )}
```

This calls `renderTrack` with a snapshot. `trackWidth` is measured at render time; in jsdom it'll be 0 unless the test stubs `getBoundingClientRect` on the track, but `valueToFraction` is correct regardless. We deliberately do not introduce a `ResizeObserver` in v1 — `valueToFraction` is the workhorse for value-space rendering, and `trackWidth` is provided as a convenience for sample-count tuning. Consumers that need pixel-precise resize reactivity can wrap their helper output in their own `ResizeObserver`.

- [ ] **Step 4: Run, verify it passes**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker renderTrack customization"
```

---

## Task 13: `paintGradientTrack` helper

**Files:**
- Modify: `packages/weasel-ui/src/paintGradientTrack.tsx`
- Create: `packages/weasel-ui/src/paintGradientTrack.test.tsx`

The helper returns a function that, given a `TrackCtx`, renders an absolutely-positioned `<div>` whose `background` CSS string is composed of:
1. A horizontal `linear-gradient(to right, …)` sampled from `opts.gradient` at `samples + 1` points (default 16 → 17 stops).
2. Optional `repeating-linear-gradient` hatched overlays for the regions of the track outside `activeRange` (in value space), plus a `color-mix` dim layer.

Layer order matches the experiment: dim and hatch overlays come BEFORE the base gradient in the `background` shorthand string (CSS paints later layers underneath, so the gradient is the bottom layer).

Wait — re-reading the experiment's `paintTrack()`:

```js
const layers = [];
if (parseFloat(lowPct) > 0) {
  layers.push(`${halfOverlay} left 0 / ${lowPct}% 100% no-repeat`);
  layers.push(`${stripe} left 0 / ${lowPct}% 100% no-repeat`);
}
if (parseFloat(highPct) < 100) {
  ...
}
layers.push(baseGrad);
sliderEl.style.background = layers.join(', ');
```

The base gradient is appended LAST. In CSS shorthand, multiple layers stack with the FIRST listed on top. So overlays (hatch, dim) are on top, base gradient at the bottom — exactly what we want visually.

- [ ] **Step 1: Write the failing tests**

Create `packages/weasel-ui/src/paintGradientTrack.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { paintGradientTrack } from './paintGradientTrack';
import type { TrackCtx } from './RangePicker';

const ctx: TrackCtx = {
  trackWidth: 200,
  valueToFraction: (v: number) => v,
};

describe('paintGradientTrack', () => {
  it('returns a function that renders a div with a sampled linear gradient', () => {
    const renderTrack = paintGradientTrack({
      gradient: t => (t < 0.5 ? '#000' : '#fff'),
      samples: 4,
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    const bg = (div as HTMLElement).style.background;
    expect(bg).toContain('linear-gradient(to right');
    // 5 stops at 0/25/50/75/100%.
    expect(bg).toMatch(/0\.0%/);
    expect(bg).toMatch(/100\.0%/);
    expect(bg).toContain('#000');
    expect(bg).toContain('#fff');
  });

  it('layers hatched overlays for activeRange < full', () => {
    const renderTrack = paintGradientTrack({
      gradient: () => '#888',
      samples: 2,
      activeRange: [0.25, 0.75],
      hatch: { angleDeg: 135, stripe: 2, gap: 4, dim: 75 },
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    const bg = (div as HTMLElement).style.background;
    expect(bg).toContain('repeating-linear-gradient(135deg');
    // Two outer hatched regions (left and right), so two repeating-linear-gradient layers and two dim layers.
    expect(bg.match(/repeating-linear-gradient/g)?.length).toBe(2);
  });

  it('omits overlays when activeRange covers full range', () => {
    const renderTrack = paintGradientTrack({
      gradient: () => '#888',
      activeRange: [0, 1],
      hatch: { angleDeg: 135 },
    });
    const { container } = render(<>{renderTrack(ctx)}</>);
    const div = container.querySelector('div')!;
    expect((div as HTMLElement).style.background).not.toContain('repeating-linear-gradient');
  });
});
```

Note: `valueToFraction` in this helper's tests is identity, but the helper internally treats `activeRange` as values; conversion to track fraction for overlay positioning uses the picker's `valueToFraction`. Since our test ctx is identity, `activeRange: [0.25, 0.75]` maps to 25%–75% on the track, leaving 25% on each side for overlays.

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/paintGradientTrack.test.tsx`
Expected: FAIL — helper still returns `null`.

- [ ] **Step 3: Implement the helper**

Replace `packages/weasel-ui/src/paintGradientTrack.tsx` with:

```tsx
import type { ReactNode, CSSProperties } from 'react';
import type { TrackCtx } from './RangePicker';

export type GradientTrackOpts = {
  gradient: (t: number) => string;
  samples?: number;
  activeRange?: [number, number];
  hatch?: {
    angleDeg?: number;
    stripe?: number;
    gap?: number;
    dim?: number;
  };
};

const DEFAULT_HATCH = { angleDeg: 135, stripe: 2, gap: 4, dim: 75 };

export function paintGradientTrack(opts: GradientTrackOpts): (ctx: TrackCtx) => ReactNode {
  const { gradient, samples = 16, activeRange, hatch } = opts;

  return (ctx: TrackCtx) => {
    const stops: string[] = [];
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      stops.push(`${gradient(t)} ${(t * 100).toFixed(1)}%`);
    }
    const baseGradient = `linear-gradient(to right, ${stops.join(', ')})`;

    const layers: string[] = [];
    if (activeRange) {
      const lowPct = ctx.valueToFraction(activeRange[0]) * 100;
      const highPct = ctx.valueToFraction(activeRange[1]) * 100;
      const h = { ...DEFAULT_HATCH, ...hatch };
      const stripe = `repeating-linear-gradient(${h.angleDeg}deg, transparent 0 ${h.stripe}px, var(--wui-panel-bg, #fafbfc) ${h.stripe}px ${h.stripe + h.gap}px)`;
      const dimColor = `color-mix(in srgb, var(--wui-panel-bg, #fafbfc) ${h.dim}%, transparent)`;
      const dimOverlay = `linear-gradient(${dimColor}, ${dimColor})`;

      if (lowPct > 0) {
        layers.push(`${dimOverlay} left 0 / ${lowPct.toFixed(2)}% 100% no-repeat`);
        layers.push(`${stripe} left 0 / ${lowPct.toFixed(2)}% 100% no-repeat`);
      }
      if (highPct < 100) {
        const wR = (100 - highPct).toFixed(2);
        layers.push(`${dimOverlay} right 0 / ${wR}% 100% no-repeat`);
        layers.push(`${stripe} right 0 / ${wR}% 100% no-repeat`);
      }
    }
    layers.push(baseGradient);

    const style: CSSProperties = {
      position: 'absolute',
      inset: 0,
      background: layers.join(', '),
    };
    return <div style={style} />;
  };
}
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/paintGradientTrack.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run the full test suite**

Run: `npm run test`
Expected: PASS (everything green).

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/paintGradientTrack.tsx packages/weasel-ui/src/paintGradientTrack.test.tsx
git commit -m "feat(weasel-ui): paintGradientTrack helper composes sampled gradient + hatch overlays"
```

---

## Task 14: Thumb shape variants (`'notched'`, custom render)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.module.css`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Styling: `'round'` is the default; `'notched'` ships an inline-SVG polygon (matching the experiment's `--thumb-svg` data URI); `{ render }` is a consumer-supplied function returning a `ReactNode`.

- [ ] **Step 1: Write the failing tests**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker thumb shape variants', () => {
  it('shape="notched" renders the notched class', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: 'notched' }]}
        onChange={() => {}}
      />,
    );
    const thumb = container.querySelector('[role="slider"]') as HTMLElement;
    expect(thumb.className).toContain('notched');
  });

  it('shape={ render } uses the custom render', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5, shape: { render: () => <span data-testid="x">X</span> } }]}
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('[data-testid="x"]')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Add notched styling**

Append to `RangePicker.module.css`:

```css
.notched {
  background: var(--thumb-svg, none);
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-color: transparent;
  border: none;
  /* Default notched SVG (down-pointing pentagon, matches the perceptual-color experiment). */
  --thumb-svg: url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 30' preserveAspectRatio='none'%3E%3Cpolygon points='0,0 2.52,0 7,10.3 11.48,0 14,0 14,30 0,30' fill='rgba(255,255,255,0.62)' stroke='rgba(0,0,0,0.55)' stroke-width='0.75' stroke-linejoin='miter'/%3E%3C/svg%3E");
}
```

- [ ] **Step 4: Wire shape into the thumb JSX**

Replace the thumb mapping in `RangePicker.tsx` with:

```tsx
        {thumbs.map((thumb, i) => {
          const isNotched = thumb.shape === 'notched';
          const customRender = typeof thumb.shape === 'object' && thumb.shape !== null ? thumb.shape.render : null;
          const cls = `${s.thumb}${isNotched ? ` ${s.notched}` : ''}`;
          return (
            <div
              key={i}
              role="slider"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={thumb.value}
              aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
              className={cls}
              style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
              onPointerDown={onThumbPointerDown(i)}
              onKeyDown={onThumbKeyDown(i)}
              onContextMenu={onThumbContextMenu(i)}
            >
              {customRender ? customRender({ width: 14, height: 24, isActive: false }) : (thumb.label ?? '')}
            </div>
          );
        })}
```

- [ ] **Step 5: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.module.css packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker thumb shapes (notched + custom render)"
```

---

## Task 15: Readouts (`inline-after`, `below-thumb`)

**Files:**
- Modify: `packages/weasel-ui/src/RangePicker.tsx`
- Modify: `packages/weasel-ui/src/RangePicker.test.tsx`

Spec § Readouts:
- `'none'` (default): no readout.
- `'inline-after'`: a single block after the picker, with one entry per thumb (consumer-formatted via `renderReadout` or default `value.toFixed(3)`).
- `'below-thumb'`: per-thumb readout absolutely positioned under each thumb, x-tracked by value.

- [ ] **Step 1: Write the failing tests**

Append to `RangePicker.test.tsx`:

```tsx
describe('RangePicker readouts', () => {
  it("'inline-after' renders one entry per thumb after the track", () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.123 }, { value: 0.456 }]}
        readoutPlacement="inline-after"
        onChange={() => {}}
      />,
    );
    const inline = container.querySelector('[data-readout="inline"]')!;
    expect(inline.textContent).toContain('0.123');
    expect(inline.textContent).toContain('0.456');
  });

  it("'below-thumb' renders one absolutely-positioned readout per thumb", () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.25 }, { value: 0.75 }]}
        readoutPlacement="below-thumb"
        onChange={() => {}}
      />,
    );
    const readouts = container.querySelectorAll<HTMLElement>('[data-readout="below"]');
    expect(readouts).toHaveLength(2);
    expect(readouts[0].style.left).toBe('25%');
    expect(readouts[1].style.left).toBe('75%');
  });

  it('renderReadout overrides default formatting', () => {
    const { container } = render(
      <RangePicker
        min={0}
        max={1}
        thumbs={[{ value: 0.5 }]}
        readoutPlacement="inline-after"
        renderReadout={(t) => `[${t.value}]`}
        onChange={() => {}}
      />,
    );
    expect(container.querySelector('[data-readout="inline"]')!.textContent).toContain('[0.5]');
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Render readouts conditionally**

In `RangePicker.tsx`, add `readoutPlacement` and `renderReadout` to the destructured props, then add helper:

```ts
function defaultReadout(thumb: Thumb): string {
  return thumb.value.toFixed(3);
}
```

Wrap the existing root render with the readout block. Replace the component's return with:

```tsx
  const placement = props.readoutPlacement ?? 'none';
  const renderReadout = props.renderReadout;

  return (
    <div
      className={className ? `${s.root} ${className}` : s.root}
      style={trackHeight !== undefined ? ({ ['--rp-track-height' as string]: `${trackHeight}px` } as CSSProperties) : undefined}
    >
      <div className={s.track} ref={trackRef} onPointerDown={onTrackPointerDown}>
        {props.renderTrack && (
          <div className={s.trackInner}>
            {props.renderTrack({
              trackWidth: trackRef.current?.getBoundingClientRect().width ?? 0,
              valueToFraction,
            })}
          </div>
        )}
        {thumbs.map((thumb, i) => {
          const isNotched = thumb.shape === 'notched';
          const customRender = typeof thumb.shape === 'object' && thumb.shape !== null ? thumb.shape.render : null;
          const cls = `${s.thumb}${isNotched ? ` ${s.notched}` : ''}`;
          return (
            <div
              key={i}
              role="slider"
              tabIndex={0}
              aria-orientation="horizontal"
              aria-valuemin={min}
              aria-valuemax={max}
              aria-valuenow={thumb.value}
              aria-label={[ariaLabel, thumb.label].filter(Boolean).join(' ') || undefined}
              className={cls}
              style={{ left: `${valueToFraction(thumb.value) * 100}%` }}
              onPointerDown={onThumbPointerDown(i)}
              onKeyDown={onThumbKeyDown(i)}
              onContextMenu={onThumbContextMenu(i)}
            >
              {customRender ? customRender({ width: 14, height: 24, isActive: false }) : (thumb.label ?? '')}
            </div>
          );
        })}
        {placement === 'below-thumb' && (
          <div className={s.readoutsBelow}>
            {thumbs.map((t, i) => (
              <span
                key={i}
                data-readout="below"
                className={s.readoutBelow}
                style={{ left: `${valueToFraction(t.value) * 100}%` }}
              >
                {renderReadout ? renderReadout(t, i) : defaultReadout(t)}
              </span>
            ))}
          </div>
        )}
      </div>
      {placement === 'inline-after' && (
        <span data-readout="inline" className={s.readoutInline}>
          {thumbs.map((t, i) => (
            <span key={i}>{i > 0 ? ' / ' : ''}{renderReadout ? renderReadout(t, i) : defaultReadout(t)}</span>
          ))}
        </span>
      )}
    </div>
  );
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `npx vitest run packages/weasel-ui/src/RangePicker.test.tsx`
Expected: PASS.

- [ ] **Step 5: Full test run + typecheck**

Run: `npm run test && npm run typecheck`
Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/RangePicker.tsx packages/weasel-ui/src/RangePicker.test.tsx
git commit -m "feat(weasel-ui): RangePicker readouts (inline-after + below-thumb)"
```

---

## Task 16: Demo — port perceptual-color sliders

**Files:**
- Create: `demo/demos/PerceptualColorSlidersDemo.tsx`
- Modify: `demo/registry.ts`

Build a demo that mirrors the four representative slider variants from the experiment so we can visually verify parity:
1. Single-thumb hue (0–360) with a hue gradient track.
2. 2-thumb L-range (0–1, hard-ordered) with an L gradient + active-range hatching.
3. 3-thumb chroma (free, per-thumb bounds) with a chroma gradient + active-range hatching.
4. Dynamic indices band (0–1000, click-to-add, drag-off-vertical to remove, allowShiftAll) with a grayscale ramp.

The OKLCH math is tiny — embedded directly in the demo file.

- [ ] **Step 1: Create the demo**

Create `demo/demos/PerceptualColorSlidersDemo.tsx`:

```tsx
import { useState } from 'react';
import { RangePicker, paintGradientTrack, type Thumb } from '@orochi235/weasel-ui';

// Minimal OKLCH → sRGB hex (clamped). Sufficient for a demo gradient.
function oklchToHex(L: number, C: number, Hdeg: number): string {
  const h = (Hdeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const lr = l_ ** 3, mr = m_ ** 3, sr = s_ ** 3;
  const r = 4.0767416621 * lr - 3.3077115913 * mr + 0.2309699292 * sr;
  const g = -1.2684380046 * lr + 2.6097574011 * mr - 0.3413193965 * sr;
  const bl = -0.0041960863 * lr - 0.7034186147 * mr + 1.707614701 * sr;
  const linToSrgb = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * Math.pow(u, 1 / 2.4) - 0.055);
  const toByte = (u: number) => Math.max(0, Math.min(255, Math.round(linToSrgb(u) * 255)));
  const hh = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hh(toByte(r))}${hh(toByte(g))}${hh(toByte(bl))}`;
}

type CThumb = Thumb & { key: 'cTop' | 'cPeak' | 'cBot' };

export function PerceptualColorSlidersDemo() {
  const [hue, setHue] = useState(200);
  const midL = 0.65;
  const peakC = 0.16;

  const [lRange, setLRange] = useState<[number, number]>([0.16, 0.97]);

  const [chroma, setChroma] = useState({ cTop: 0.04, cPeak: 0.16, cBot: 0.08 });

  const [indices, setIndices] = useState<number[]>([25, 50, 100, 200, 300, 400, 500, 600, 700, 800, 900]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: 16, maxWidth: 720 }}>
      <section>
        <h3 style={{ margin: '0 0 8px' }}>Hue (single thumb)</h3>
        <RangePicker
          min={0} max={360} step={1}
          thumbs={[{ value: hue }]}
          onChange={ts => setHue(ts[0].value)}
          ariaLabel="Hue"
          readoutPlacement="inline-after"
          renderReadout={t => `${t.value}°`}
          renderTrack={paintGradientTrack({ gradient: t => oklchToHex(midL, peakC, t * 360) })}
        />
      </section>

      <section>
        <h3 style={{ margin: '0 0 8px' }}>L range (2-thumb, ordered)</h3>
        <RangePicker
          min={0} max={1} step={0.005}
          constraint="ordered"
          thumbs={[
            { value: lRange[0], label: '↓', shape: 'notched' },
            { value: lRange[1], label: '↑', shape: 'notched' },
          ]}
          onChange={ts => setLRange([ts[0].value, ts[1].value])}
          readoutPlacement="below-thumb"
          renderTrack={paintGradientTrack({
            gradient: t => oklchToHex(t, 0, 0),
            activeRange: lRange,
            hatch: { angleDeg: 135, stripe: 2, gap: 4, dim: 75 },
          })}
        />
      </section>

      <section>
        <h3 style={{ margin: '0 0 8px' }}>Chroma (3-thumb, free, per-thumb bounds)</h3>
        <RangePicker<CThumb>
          min={0} max={0.22} step={0.005}
          constraint="free"
          thumbs={[
            { value: chroma.cTop,  label: 'T', key: 'cTop',  bounds: [0, 0.06] },
            { value: chroma.cPeak, label: 'P', key: 'cPeak', bounds: [0, 0.22] },
            { value: chroma.cBot,  label: 'B', key: 'cBot',  bounds: [0, 0.10] },
          ]}
          onChange={ts => {
            const next = { ...chroma };
            for (const t of ts) next[t.key] = t.value;
            setChroma(next);
          }}
          readoutPlacement="below-thumb"
          renderTrack={paintGradientTrack({
            gradient: t => oklchToHex(midL, t * 0.22, hue),
          })}
        />
      </section>

      <section>
        <h3 style={{ margin: '0 0 8px' }}>Indices band (dynamic, allowShiftAll)</h3>
        <RangePicker
          min={0} max={1000} step={1}
          thumbs={indices.map(value => ({ value }))}
          onChange={ts => setIndices(ts.map(t => Math.round(t.value)).sort((a, b) => a - b))}
          onAddThumb={at => ({ value: Math.round(at) })}
          onRemoveThumb={() => true}
          allowShiftAll
          renderTrack={paintGradientTrack({
            gradient: t => {
              const c = Math.round((1 - t) * 255);
              return `rgb(${c}, ${c}, ${c})`;
            },
          })}
        />
        <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}>{indices.join(', ')}</div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Register the demo**

In `demo/registry.ts`, add the import alongside the other demo imports (alphabetical-ish to fit the existing pattern). Add:

```ts
import { PerceptualColorSlidersDemo } from './demos/PerceptualColorSlidersDemo';
import PerceptualColorSlidersDemoFull from './demos/PerceptualColorSlidersDemo.tsx?raw';
```

Add an entry to the `DEMOS` array in `demo/registry.ts`. Placement: anywhere alongside the existing entries (the array is iterated in order, and placement after the `'animation'` entry reads sensibly). The shape is:

```ts
  {
    id: 'perceptual-color-sliders',
    title: 'Perceptual Color Sliders',
    category: 'Composed',
    description: 'Four representative slider variants from the perceptual-color experiment, all built on RangePicker: single-thumb hue, 2-thumb ordered L range with active-range hatching, 3-thumb chroma with per-thumb bounds, and a dynamic indices band with click-to-add, drag-off-vertical to remove, and shift-drag translate-all.',
    hint: 'Drag thumbs; on the indices band, click empty track to add, drag a thumb up/down to remove, hold Shift to translate all.',
    Component: PerceptualColorSlidersDemo,
    full: PerceptualColorSlidersDemoFull,
    path: 'demo/demos/PerceptualColorSlidersDemo.tsx',
  },
```

- [ ] **Step 3: Start the dev server and visually verify**

Run: `npm run dev`
Open: http://localhost:5173 (or whatever Vite reports)
Navigate to the new "Perceptual Color Sliders" demo.

Verify:
- Hue slider drags smoothly across the OKLCH gradient.
- L-range slider has two notched thumbs that can't cross each other; activeRange hatching appears outside the chosen [lMin, lMax] band.
- Chroma slider has T/P/B thumbs that pass freely; each respects its own `bounds`.
- Indices band: click empty track to add, drag a thumb up/down to remove it, hold shift to translate all thumbs together; the displayed list updates.

Stop the dev server with Ctrl+C when done.

- [ ] **Step 4: Run the full test suite + typecheck + build**

Run: `npm run prepublishOnly`
Expected: all green (typecheck + tests + tsup build).

- [ ] **Step 5: Commit**

```bash
git add demo/demos/PerceptualColorSlidersDemo.tsx demo/registry.ts
git commit -m "feat(demo): perceptual color sliders demo for RangePicker parity"
```

---

## Self-review notes

After completing all tasks:

1. **Spec coverage** — every section of `docs/specs/2026-05-09-range-picker-design.md` has at least one task: types (Task 1), rendering (Task 2), drag (Task 3), keyboard (Task 4), free constraint (Task 5), ordered constraint (Task 6), tuple bounds (Task 7), callback bounds (Task 8), onAddThumb (Task 9), onRemoveThumb drag-off + right-click (Task 10), allowShiftAll (Task 11), renderTrack (Task 12), paintGradientTrack (Task 13), thumb shapes (Task 14), readouts (Task 15), demo parity (Task 16).
2. **Test count** — the spec calls for 10 unit-test scenarios; this plan covers all of them across Tasks 2–15, plus additional regression tests.
3. **No placeholders** — every step has actual code, exact paths, and exact commands.
4. **Type consistency** — the public type names (`Thumb`, `ThumbShape`, `ThumbRenderCtx`, `BoundsCtx`, `TrackCtx`, `RangePickerProps`, `GradientTrackOpts`) and method names (`onChange`, `onCommit`, `onAddThumb`, `onRemoveThumb`, `allowShiftAll`, `renderTrack`, `renderReadout`, `paintGradientTrack`) are stable across all tasks.

## Out of scope (deferred)

- Vertical orientation.
- WebGL track helper (`paintGlGradientTrack`) — drops in via the same `renderTrack` slot.
- Drag-to-reorder swatches (categorical hue band's swap-positions gesture).
- Modifier-drag beyond shift (alt/cmd, generic `onModifierDrag`).
- Whole-model adapter API (`<TValue>` with `thumbsOf` / `setThumbs`).
