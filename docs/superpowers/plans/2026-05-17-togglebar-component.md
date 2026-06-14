# ToggleBar Component Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `ToggleBar` in `@weasel-js/ui` — a segmented control that supports single-select, multi-select, and (via 2-segment single) boolean, sharing `RangePicker`'s frosted-glass aesthetic.

**Architecture:** Single component in `packages/ui/src/components/ToggleBar/`. Mode discriminated union (`'single' | 'multiple'`). Controlled only. Per-segment frosted fill (no sliding thumb). CSS variables (`--wzl-track-*`, `--wzl-thumb-*`, `--wzl-accent`, `--wzl-tb-height`) shared with `RangePicker`.

**Tech Stack:** React 18, TypeScript, CSS Modules, Vitest + Testing Library, Storybook (vite).

**Spec:** `docs/superpowers/specs/2026-05-17-togglebar-component-design.md`

**Reference:** `packages/ui/src/components/RangePicker/` — copy patterns from `RangePicker.tsx`, `.module.css`, `.test.tsx`, `.stories.tsx`, `index.ts`.

---

### Task 1: Scaffold files with types and empty render

**Files:**
- Create: `packages/ui/src/components/ToggleBar/ToggleBar.tsx`
- Create: `packages/ui/src/components/ToggleBar/ToggleBar.module.css`
- Create: `packages/ui/src/components/ToggleBar/index.ts`

- [ ] **Step 1: Create `ToggleBar.module.css` with the root container shell**

```css
.root {
  display: flex;
  height: var(--wzl-tb-height, 24px);
  background: var(--wzl-track-bg);
  border: 1px solid var(--wzl-track-border);
  border-radius: 3px;
  overflow: hidden;
  user-select: none;
  -webkit-user-select: none;
  touch-action: none;
}

.segment {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  padding: 0;
  margin: 0;
  font: 500 0.7rem/1 ui-sans-serif, system-ui, sans-serif;
  color: var(--wzl-text-muted);
  cursor: pointer;
  transition: background 120ms, box-shadow 120ms, color 120ms;
}

.segment:not(:first-child) {
  border-left: 1px solid var(--wzl-track-border);
}

.segment:focus-visible {
  outline: 2px solid var(--wzl-accent);
  outline-offset: -2px;
}

.segment:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.segmentSelected {
  background: color-mix(in srgb, var(--wzl-thumb-fill) 70%, transparent);
  backdrop-filter: blur(3px);
  -webkit-backdrop-filter: blur(3px);
  box-shadow: inset 0 0 0 1px var(--wzl-thumb-border), 0 1px 2px rgba(0, 0, 0, 0.2);
  color: var(--wzl-thumb-text);
  text-shadow: 0 0 2px rgba(255, 255, 255, 0.7);
}
```

- [ ] **Step 2: Create `ToggleBar.tsx` with types and skeleton render**

```tsx
import { useRef, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactElement, type ReactNode } from 'react';
import s from './ToggleBar.module.css';

export type ToggleBarItem<V extends string | number = string> = {
  value: V;
  label?: ReactNode;
  ariaLabel?: string;
  disabled?: boolean;
};

type CommonProps = {
  ariaLabel?: string;
  className?: string;
  height?: number;
};

export type ToggleBarProps<V extends string | number = string> =
  | (CommonProps & {
      mode?: 'single';
      items: readonly ToggleBarItem<V>[];
      value: V | null;
      onChange: (next: V | null) => void;
      allowDeselect?: boolean;
    })
  | (CommonProps & {
      mode: 'multiple';
      items: readonly ToggleBarItem<V>[];
      value: readonly V[];
      onChange: (next: V[]) => void;
    });

function firstEnabledIndex(items: readonly ToggleBarItem<string | number>[]): number {
  for (let i = 0; i < items.length; i++) if (!items[i].disabled) return i;
  return -1;
}

function lastEnabledIndex(items: readonly ToggleBarItem<string | number>[]): number {
  for (let i = items.length - 1; i >= 0; i--) if (!items[i].disabled) return i;
  return -1;
}

function nextEnabledIndex(items: readonly ToggleBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from + k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

function prevEnabledIndex(items: readonly ToggleBarItem<string | number>[], from: number): number {
  const n = items.length;
  for (let k = 1; k <= n; k++) {
    const i = (from - k + n) % n;
    if (!items[i].disabled) return i;
  }
  return from;
}

export function ToggleBar<V extends string | number = string>(props: ToggleBarProps<V>): ReactElement {
  const { items, ariaLabel, className, height } = props;
  const mode = props.mode ?? 'single';
  const rootRef = useRef<HTMLDivElement | null>(null);

  const isSelected = (value: V): boolean => {
    if (mode === 'multiple') return (props.value as readonly V[]).includes(value);
    return (props.value as V | null) === value;
  };

  // Roving tabindex anchor
  let tabStopIndex = -1;
  if (mode === 'single') {
    const sel = items.findIndex(it => it.value === (props.value as V | null));
    tabStopIndex = sel >= 0 && !items[sel].disabled ? sel : firstEnabledIndex(items);
  } else {
    tabStopIndex = firstEnabledIndex(items);
  }

  const handleClick = (index: number) => () => {
    const item = items[index];
    if (item.disabled) return;
    if (mode === 'multiple') {
      const current = props.value as readonly V[];
      const next = current.includes(item.value)
        ? current.filter(v => v !== item.value)
        : [...current, item.value];
      (props.onChange as (n: V[]) => void)(next);
    } else {
      const current = props.value as V | null;
      if (current === item.value) {
        if ((props as { allowDeselect?: boolean }).allowDeselect) {
          (props.onChange as (n: V | null) => void)(null);
        }
        return;
      }
      (props.onChange as (n: V | null) => void)(item.value);
    }
  };

  const focusSegment = (index: number) => {
    const root = rootRef.current;
    if (!root) return;
    const buttons = root.querySelectorAll<HTMLButtonElement>(`.${s.segment}`);
    buttons[index]?.focus();
  };

  const handleKeyDown = (index: number) => (e: ReactKeyboardEvent<HTMLButtonElement>) => {
    let nextIndex = -1;
    switch (e.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        nextIndex = prevEnabledIndex(items, index);
        break;
      case 'ArrowRight':
      case 'ArrowDown':
        nextIndex = nextEnabledIndex(items, index);
        break;
      case 'Home':
        nextIndex = firstEnabledIndex(items);
        break;
      case 'End':
        nextIndex = lastEnabledIndex(items);
        break;
      case ' ':
      case 'Enter':
        if (mode === 'multiple') {
          e.preventDefault();
          handleClick(index)();
        }
        return;
      default:
        return;
    }
    if (nextIndex < 0 || nextIndex === index) return;
    e.preventDefault();
    if (mode === 'single') {
      const item = items[nextIndex];
      (props.onChange as (n: V | null) => void)(item.value);
    }
    focusSegment(nextIndex);
  };

  const style: CSSProperties | undefined = height !== undefined
    ? ({ ['--wzl-tb-height' as string]: `${height}px` } as CSSProperties)
    : undefined;

  return (
    <div
      ref={rootRef}
      className={className ? `${s.root} ${className}` : s.root}
      role={mode === 'multiple' ? 'group' : 'radiogroup'}
      aria-label={ariaLabel}
      style={style}
    >
      {items.map((item, i) => {
        const selected = isSelected(item.value);
        const cls = `${s.segment}${selected ? ` ${s.segmentSelected}` : ''}`;
        return (
          <button
            key={item.value}
            type="button"
            role={mode === 'multiple' ? undefined : 'radio'}
            aria-checked={mode === 'multiple' ? undefined : selected}
            aria-pressed={mode === 'multiple' ? selected : undefined}
            aria-label={item.ariaLabel}
            disabled={item.disabled}
            tabIndex={i === tabStopIndex ? 0 : -1}
            className={cls}
            onClick={handleClick(i)}
            onKeyDown={handleKeyDown(i)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create `index.ts` barrel export**

```ts
export { ToggleBar } from './ToggleBar';
export type { ToggleBarItem, ToggleBarProps } from './ToggleBar';
```

- [ ] **Step 4: Typecheck**

Run: `cd packages/ui && npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 5: Commit**

```bash
git add packages/ui/src/components/ToggleBar/
git commit -m "feat(weasel-ui): scaffold ToggleBar component"
```

---

### Task 2: Single-mode rendering + click tests

**Files:**
- Create: `packages/ui/src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Write failing tests for single-mode render and click**

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ToggleBar } from './ToggleBar';

const items = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

describe('ToggleBar single mode', () => {
  it('renders one segment per item with radiogroup role', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    const segs = container.querySelectorAll('[role="radio"]');
    expect(segs).toHaveLength(3);
  });

  it('marks the selected segment with aria-checked=true', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(segs[0].getAttribute('aria-checked')).toBe('false');
    expect(segs[1].getAttribute('aria-checked')).toBe('true');
    expect(segs[2].getAttribute('aria-checked')).toBe('false');
  });

  it('calls onChange with clicked value', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[2]);
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('does not call onChange when clicking the already-selected segment (default)', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('calls onChange(null) when clicking selected segment with allowDeselect', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} allowDeselect />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).toHaveBeenCalledWith(null);
  });
});
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd packages/ui && npx vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: 5 tests PASS (implementation from Task 1 already covers these).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "test(weasel-ui): cover ToggleBar single-mode rendering and click"
```

---

### Task 3: Multi-mode tests

**Files:**
- Modify: `packages/ui/src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Append multi-mode tests**

```tsx
describe('ToggleBar multiple mode', () => {
  const triItems = [
    { value: 'b', label: 'B' },
    { value: 'i', label: 'I' },
    { value: 'u', label: 'U' },
  ];

  it('uses role=group and aria-pressed', () => {
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={() => {}} />,
    );
    expect(container.querySelector('[role="group"]')).not.toBeNull();
    const btns = container.querySelectorAll<HTMLElement>('button');
    expect(btns[0].getAttribute('aria-pressed')).toBe('true');
    expect(btns[1].getAttribute('aria-pressed')).toBe('false');
    expect(btns[2].getAttribute('aria-pressed')).toBe('false');
  });

  it('adds value to array when clicking an unselected segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={onChange} />,
    );
    fireEvent.click(container.querySelectorAll('button')[2]);
    expect(onChange).toHaveBeenCalledWith(['b', 'u']);
  });

  it('removes value from array when clicking a selected segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b', 'u']} onChange={onChange} />,
    );
    fireEvent.click(container.querySelectorAll('button')[0]);
    expect(onChange).toHaveBeenCalledWith(['u']);
  });
});
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd packages/ui && npx vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: all tests PASS (8 total).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "test(weasel-ui): cover ToggleBar multi-mode toggle behavior"
```

---

### Task 4: Keyboard navigation tests

**Files:**
- Modify: `packages/ui/src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Append keyboard tests**

```tsx
describe('ToggleBar keyboard — single mode', () => {
  it('ArrowRight moves selection forward', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="left" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('center');
  });

  it('ArrowLeft wraps from first to last', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="left" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('right');
  });

  it('Home jumps to first, End to last', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[1], { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('left');
    fireEvent.keyDown(segs[1], { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('right');
  });

  it('roving tabindex: selected segment is tab stop', () => {
    const { container } = render(
      <ToggleBar items={items} value="center" onChange={() => {}} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    expect(segs[0].tabIndex).toBe(-1);
    expect(segs[1].tabIndex).toBe(0);
    expect(segs[2].tabIndex).toBe(-1);
  });
});

describe('ToggleBar keyboard — multiple mode', () => {
  const triItems = [
    { value: 'b', label: 'B' },
    { value: 'i', label: 'I' },
    { value: 'u', label: 'U' },
  ];

  it('Space toggles focused segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={[]} onChange={onChange} />,
    );
    const btns = container.querySelectorAll<HTMLElement>('button');
    fireEvent.keyDown(btns[1], { key: ' ' });
    expect(onChange).toHaveBeenCalledWith(['i']);
  });

  it('ArrowRight does not mutate selection in multiple mode', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar mode="multiple" items={triItems} value={['b']} onChange={onChange} />,
    );
    const btns = container.querySelectorAll<HTMLElement>('button');
    fireEvent.keyDown(btns[0], { key: 'ArrowRight' });
    expect(onChange).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd packages/ui && npx vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: all tests PASS (14 total).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "test(weasel-ui): cover ToggleBar keyboard navigation"
```

---

### Task 5: Disabled segment tests

**Files:**
- Modify: `packages/ui/src/components/ToggleBar/ToggleBar.test.tsx`

- [ ] **Step 1: Append disabled tests**

```tsx
describe('ToggleBar disabled segments', () => {
  const mixed = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B', disabled: true },
    { value: 'c', label: 'C' },
  ];

  it('does not call onChange when clicking a disabled segment', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={mixed} value="a" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.click(segs[1]);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('arrow nav skips disabled segments', () => {
    const onChange = vi.fn();
    const { container } = render(
      <ToggleBar items={mixed} value="a" onChange={onChange} />,
    );
    const segs = container.querySelectorAll<HTMLElement>('[role="radio"]');
    fireEvent.keyDown(segs[0], { key: 'ArrowRight' });
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
```

- [ ] **Step 2: Run tests, verify they pass**

Run: `cd packages/ui && npx vitest run src/components/ToggleBar/ToggleBar.test.tsx`
Expected: all tests PASS (16 total).

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ToggleBar/ToggleBar.test.tsx
git commit -m "test(weasel-ui): cover ToggleBar disabled segment handling"
```

---

### Task 6: Storybook stories

**Files:**
- Create: `packages/ui/src/components/ToggleBar/ToggleBar.stories.tsx`

- [ ] **Step 1: Write stories**

```tsx
import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { ToggleBar } from './ToggleBar';

const meta: Meta<typeof ToggleBar> = {
  title: 'weasel-ui/ToggleBar',
  component: ToggleBar,
};

export default meta;
type Story = StoryObj<typeof ToggleBar>;

const alignItems = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
  { value: 'justify', label: 'Justify' },
];

export const Single: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} ariaLabel="Text alignment" />;
  },
};

export const Boolean2Segment: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('on');
    return (
      <ToggleBar
        items={[{ value: 'off', label: 'Off' }, { value: 'on', label: 'On' }]}
        value={v}
        onChange={setV}
        ariaLabel="Power"
      />
    );
  },
};

export const Multiple: Story = {
  render: () => {
    const [v, setV] = useState<string[]>(['b']);
    return (
      <ToggleBar
        mode="multiple"
        items={[
          { value: 'b', label: 'B' },
          { value: 'i', label: 'I' },
          { value: 'u', label: 'U' },
        ]}
        value={v}
        onChange={setV}
        ariaLabel="Text style"
      />
    );
  },
};

export const Disabled: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('a');
    return (
      <ToggleBar
        items={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B', disabled: true },
          { value: 'c', label: 'C' },
        ]}
        value={v}
        onChange={setV}
      />
    );
  },
};

export const Tall: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} height={32} />;
  },
};

export const AllowDeselect: Story = {
  render: () => {
    const [v, setV] = useState<string | null>('center');
    return <ToggleBar items={alignItems} value={v} onChange={setV} allowDeselect />;
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd packages/ui && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components/ToggleBar/ToggleBar.stories.tsx
git commit -m "docs(weasel-ui): add ToggleBar stories"
```

---

### Task 7: Export from package barrel

**Files:**
- Modify: `packages/ui/src/index.ts`

- [ ] **Step 1: Add the export line**

Open `packages/ui/src/index.ts`. After the line `export * from './components/RangePicker';`, add:

```ts
export * from './components/ToggleBar';
```

- [ ] **Step 2: Verify package builds**

Run: `cd packages/ui && npx tsc --noEmit && npx vitest run`
Expected: typecheck PASS, all tests PASS.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/index.ts
git commit -m "feat(weasel-ui): export ToggleBar from package barrel"
```

---

### Task 8: Visual verification in Storybook

**Files:** (none modified)

- [ ] **Step 1: Start the weasel-ui storybook dev server**

Run: `cd packages/ui && npm run storybook` (or whatever script exists in `package.json`; check first if unsure with `cat packages/ui/package.json | grep -A1 storybook`)

- [ ] **Step 2: Open `weasel-ui/ToggleBar` in the browser**

Open `http://localhost:6006` and navigate to `weasel-ui/ToggleBar`. Verify each story:
- `Single` — 4 segments, "Center" has frosted-glass fill. Clicking another segment moves the fill.
- `Boolean2Segment` — 2 segments, one selected with frosted fill.
- `Multiple` — clicking each of B/I/U independently toggles the frosted fill.
- `Disabled` — middle segment is dimmed and unclickable; arrow keys skip it.
- `Tall` — taller bar, frosted fill scales.
- `AllowDeselect` — clicking the selected segment unselects it (no segment frosted).
- The aesthetic matches `weasel-ui/RangePicker` stories (same translucent fill, blur, border, raise).

- [ ] **Step 3: Stop the dev server** (Ctrl-C).

No commit for this task — verification only.

---

### Task 9: Final verification

**Files:** (none modified)

- [ ] **Step 1: Run full package checks**

Run: `cd packages/ui && npx tsc --noEmit && npx vitest run`
Expected: both PASS with no warnings.

- [ ] **Step 2: Run the repo's prepublish gate** (per CLAUDE.md memory: matches CI's release gate)

Run: `cd packages/ui && npm run prepublishOnly` (or, if no script: `npx tsc --noEmit && npx vitest run && npx tsup build`).
Expected: PASS.

- [ ] **Step 3: Confirm git log shows the expected feature commits**

Run: `git log --oneline -10`
Expected: see the ToggleBar feat/test/docs commits in order.

No commit for this task — verification only.

---

## Self-review notes

- Spec coverage: anatomy (Task 1), single-mode click + allowDeselect (Task 2), multi-mode toggle (Task 3), keyboard nav both modes (Task 4), disabled (Task 5), stories for every documented story (Task 6), barrel export (Task 7), visual check (Task 8), prepublish gate (Task 9).
- No placeholders; every code step contains full code.
- Type names consistent: `ToggleBarItem`, `ToggleBarProps`, helpers `firstEnabledIndex`/`lastEnabledIndex`/`nextEnabledIndex`/`prevEnabledIndex` used identically across tasks.
- Out-of-scope items (no sliding thumb, no overflow, no uncontrolled, no vertical orientation) are not present in any task — correct.
