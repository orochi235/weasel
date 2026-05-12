# Tool Palette + Presentation Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `Tool.presentation` metadata (label, icon, group, shortcut override) on the kit's `Tool` type, backfill it on all six existing built-in tools, ship a `<ToolPalette>` component in `@orochi235/weasel-ui` that renders an ARIA toolbar grouped by `presentation.group`, and drop Swillustrator's hand-rolled `TOOL_ORDER` button block in favor of the new component.

**Architecture:** `Tool.presentation` is a new optional field on the existing `Tool<TScratch>` interface in `src/tools/types.ts`. The `cursor` half of the spec is already in place (top-level `Tool.cursor` + `Canvas.tsx` writes `style.cursor` on the host) — this plan deviates from the spec by leaving `cursor` at the top level rather than nesting it under `presentation`, avoiding duplicate declarations. The palette itself is a presentational React component that consumes the `ToolsApi`, partitions tools by group, formats shortcut text from the structured `KeyBinding` shape (now stable after the `753d3d0` refactor), and exposes ARIA toolbar keyboard nav. Shape tools and their primitives (`useDragRadial`, `schneiderFit`, `useEllipseTool`, etc.) are out of scope — separate plan.

**Tech Stack:** TypeScript, React 18+, Vitest + `@testing-library/react`, CSS Modules, Storybook (CSF v3 via `@storybook/react-vite`). Tests run from repo root via `npm test`. No new runtime dependencies.

**Spec:** `docs/superpowers/specs/2026-05-11-shape-tools-and-tool-palette-design.md`.

---

### File map (locked at start)

**Created:**

- `src/icons/UnknownIcon.tsx` — placeholder for tools without `presentation.icon`.
- `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx`
- `packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css`
- `packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx`
- `packages/weasel-ui/src/components/ToolPalette/ToolPalette.stories.tsx`
- `packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts`
- `packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts`
- `packages/weasel-ui/src/components/ToolPalette/index.ts`

**Modified:**

- `src/tools/types.ts` — `Tool.presentation` field added.
- `src/index.ts` — re-export `UnknownIcon`.
- `src/tools/builtin/useSelectTool.ts` — backfill `presentation`.
- `src/tools/builtin/useLassoTool.ts` — backfill `presentation`.
- `src/tools/builtin/useInsertTool.ts` — backfill `presentation`.
- `src/tools/builtin/useTextTool.ts` — backfill `presentation`.
- `src/tools/builtin/useUserPenTool.ts` — backfill `presentation`.
- `src/tools/builtin/useHandTool.ts` — backfill `presentation`.
- `packages/weasel-ui/src/index.ts` — re-export ToolPalette barrel.
- `apps/swillustrator/src/App.tsx` — drop local `TOOL_ORDER` rendering, use `<ToolPalette>`.
- `apps/swillustrator/src/swillustrator.css` — drop dead `.swill-tool-button` rules if no longer used.

---

## Task 1: Add `Tool.presentation` field

**Files:**

- Modify: `src/tools/types.ts`

Adds the optional `presentation` field on `Tool<TScratch>`. `cursor` is *not* part of this field (the existing top-level `Tool.cursor` already covers it; duplicating would be a footgun).

- [ ] **Step 1: Add the field type and update the `Tool` interface**

At the top of `src/tools/types.ts`, after the existing `ToolBounds` interface (around line 102) and before `/** Full Tool record. */`, add:

```ts
/** Presentation metadata for tool palettes / menus. Optional on every
 *  tool — consumers that render a palette (`<ToolPalette>`) read these
 *  fields to display the tool; consumers that don't can ignore them.
 *
 *  Note: cursor is NOT here. The top-level `Tool.cursor` field below is
 *  already plumbed through `<Canvas>` to `style.cursor` on the host. */
export interface ToolPresentation<TScratch = unknown> {
  /** Human-readable label, distinct from the `id`. Falls back to `id`. */
  label?: string;
  /** Inline-SVG icon component output. May be a static `ReactNode` or a
   *  function of scratch state (rare; useful for shape-aware affordances). */
  icon?: import('react').ReactNode | ((scratch?: TScratch) => import('react').ReactNode);
  /** Palette grouping key. Tools sharing a group render contiguously
   *  with separators between groups. Free-form string; the kit
   *  recommends 'select' | 'shape' | 'draw' | 'type' | 'view'. */
  group?: string;
  /** Display override for the keyboard shortcut. When omitted the palette
   *  derives one from `Tool.keybinding` via its own formatter. */
  shortcut?: string;
}
```

Then add the field to the `Tool` interface (right after `cursor?:`, around line 132):

```ts
  /** Presentation metadata for tool palettes. See `ToolPresentation`. */
  presentation?: ToolPresentation<TScratch>;
```

- [ ] **Step 2: Typecheck**

```bash
cd /Users/mike/src/weasel && npm run typecheck
```
Expected: clean. The change is purely additive (optional field).

- [ ] **Step 3: Commit**

```bash
git add src/tools/types.ts
git commit -m "feat(tools): add optional Tool.presentation metadata field"
```

---

## Task 2: Add `UnknownIcon`

**Files:**

- Create: `src/icons/UnknownIcon.tsx`
- Modify: `src/icons/index.ts`
- Modify: `src/index.ts`

Renders a placeholder used by `<ToolPalette>` for tools with no `presentation.icon`. Same conventions as the other six kit icons.

- [ ] **Step 1: Create the icon**

```tsx
// src/icons/UnknownIcon.tsx
import { ICON_SVG_BASE } from './_base';
import type { IconProps } from './types';

/** Placeholder for tools without `presentation.icon`. A circle with "?"
 *  inside — readable, debuggable, not hidden. */
export default function UnknownIcon({ className, size = 20 }: IconProps) {
  return (
    <svg
      {...ICON_SVG_BASE}
      className={className}
      width={size}
      height={size}
    >
      <circle cx="10" cy="10" r="7.5" />
      <path
        d="M 7.5 8 Q 7.5 5.5 10 5.5 Q 12.5 5.5 12.5 8 Q 12.5 9.5 10 11 L 10 12.5"
        strokeLinecap="round"
      />
      <circle cx="10" cy="14.5" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
```

- [ ] **Step 2: Re-export from the icons barrel**

Append to `src/icons/index.ts`:

```ts
export { default as UnknownIcon } from './UnknownIcon';
```

- [ ] **Step 3: Re-export from the main kit barrel**

In `src/index.ts`, find the existing block:

```ts
export {
  SelectIcon,
  LassoIcon,
  RectIcon,
  TextIcon,
  PenIcon,
  HandIcon,
} from './icons';
```

Add `UnknownIcon`:

```ts
export {
  SelectIcon,
  LassoIcon,
  RectIcon,
  TextIcon,
  PenIcon,
  HandIcon,
  UnknownIcon,
} from './icons';
```

- [ ] **Step 4: Typecheck + commit**

```bash
cd /Users/mike/src/weasel && npm run typecheck
git add src/icons/UnknownIcon.tsx src/icons/index.ts src/index.ts
git commit -m "feat(icons): UnknownIcon placeholder for tools without presentation"
```

---

## Task 3: Backfill `presentation` on six existing built-in tools

**Files:**

- Modify: `src/tools/builtin/useSelectTool.ts`
- Modify: `src/tools/builtin/useLassoTool.ts`
- Modify: `src/tools/builtin/useInsertTool.ts`
- Modify: `src/tools/builtin/useTextTool.ts`
- Modify: `src/tools/builtin/useUserPenTool.ts`
- Modify: `src/tools/builtin/useHandTool.ts`

Each tool returns a `Tool` object — add a `presentation` field with `{ label, icon, group }` (and `shortcut` if the derived format from `keybinding` would be misleading). The icons come from the existing `src/icons/` exports.

Per the spec table:

| Tool             | label       | group    | icon          |
| ---------------- | ----------- | -------- | ------------- |
| `useSelectTool`  | Select      | `select` | SelectIcon    |
| `useLassoTool`   | Lasso       | `select` | LassoIcon     |
| `useInsertTool`  | Rectangle   | `shape`  | RectIcon      |
| `useTextTool`    | Text        | `type`   | TextIcon      |
| `useUserPenTool` | Pen         | `draw`   | PenIcon       |
| `useHandTool`    | Hand        | `view`   | HandIcon      |

(Note: `useInsertTool` is named for "rect insertion" today; spec calls it "Rectangle" in the label. The future `useRectTool` will replace it.)

- [ ] **Step 1: Read each tool's current shape to find where the returned `Tool` is built**

```bash
for f in src/tools/builtin/use{Select,Lasso,Insert,Text,UserPen,Hand}Tool.ts; do
  echo "=== $f ===";
  grep -n "return {" "$f" | head -3;
done
```

This tells you which line in each file holds the `return { ... }` of the `Tool` object. Some tools may use `defineTool({...})` or another helper — read the file to confirm where to add `presentation`.

- [ ] **Step 2: Add the import + `presentation` field to each tool**

For each of the six files, add at the top of the imports:

```ts
import { SelectIcon /* or LassoIcon, RectIcon, etc. per the table */ } from '../../icons';
```

And in the returned `Tool` object, after `cursor` and before `pointer`/`drag`/etc. (or wherever it fits naturally), add:

```ts
presentation: {
  label: 'Select',         // or per the table
  icon: <SelectIcon />,    // matching icon
  group: 'select',         // per the table
},
```

JSX in `.ts` files: if a tool file is `.ts` (not `.tsx`), the `<SelectIcon />` syntax will fail TypeScript. In that case use the explicit factory:

```ts
import React from 'react';
import { SelectIcon } from '../../icons';
// ...
presentation: {
  label: 'Select',
  icon: React.createElement(SelectIcon),
  group: 'select',
},
```

Or rename the file to `.tsx` if it's logical. Prefer the `React.createElement` form if the file is otherwise `.ts` — file extension change has its own ripple of `.ts` → `.tsx` import updates.

- [ ] **Step 3: Typecheck after each tool**

```bash
cd /Users/mike/src/weasel && npm run typecheck
```

Run after EACH tool edit, not just at the end. Easier to localize a typo.

- [ ] **Step 4: Run the test suite**

```bash
npm test
```

Expected: green. No tests were testing absence of `presentation`, so the additions should not regress.

- [ ] **Step 5: Commit**

```bash
git add src/tools/builtin/use{Select,Lasso,Insert,Text,UserPen,Hand}Tool.ts
git commit -m "feat(tools): backfill presentation metadata on six built-in tools"
```

---

## Task 4: `formatShortcut` helper

**Files:**

- Create: `packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts`
- Create: `packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts`

Derives a display-shortcut string from the kit's `KeyBinding` shape — `{ key, mod?, shift?, alt? }`. Used by `<ToolPalette>` when a tool doesn't override via `presentation.shortcut`.

- [ ] **Step 1: Write the failing test**

```ts
// packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts
import { describe, it, expect } from 'vitest';
import { formatShortcut } from './formatShortcut';

describe('formatShortcut', () => {
  it('returns undefined for undefined input', () => {
    expect(formatShortcut(undefined)).toBeUndefined();
  });

  it('formats a plain key', () => {
    expect(formatShortcut({ key: 'v' })).toBe('V');
  });

  it('formats mod + key', () => {
    expect(formatShortcut({ key: 'z', mod: true })).toBe('⌘Z');
  });

  it('formats shift + key', () => {
    expect(formatShortcut({ key: 'h', shift: true })).toBe('⇧H');
  });

  it('formats alt + key', () => {
    expect(formatShortcut({ key: 'r', alt: true })).toBe('⌥R');
  });

  it('formats mod + shift + key in canonical order', () => {
    expect(formatShortcut({ key: 'z', mod: true, shift: true })).toBe('⌘⇧Z');
  });

  it('formats mod + shift + alt + key', () => {
    expect(formatShortcut({ key: 'x', mod: true, shift: true, alt: true })).toBe('⌘⇧⌥X');
  });

  it('uppercases the key character', () => {
    expect(formatShortcut({ key: 'a' })).toBe('A');
    expect(formatShortcut({ key: 'A' })).toBe('A');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
cd /Users/mike/src/weasel && npm test -- packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts
import type { KeyBinding } from '@orochi235/weasel';

/** Format a `KeyBinding` as a display string. Order: mod, shift, alt, key.
 *  Returns `undefined` for `undefined` input so callers can `??` a fallback.
 */
export function formatShortcut(b: KeyBinding | undefined): string | undefined {
  if (!b) return undefined;
  const parts = [
    b.mod && '⌘',
    b.shift && '⇧',
    b.alt && '⌥',
    b.key.toUpperCase(),
  ];
  return parts.filter(Boolean).join('');
}
```

If `KeyBinding` isn't exported from `@orochi235/weasel`'s top-level index, locate the actual export path (`grep -n "KeyBinding" /Users/mike/src/weasel/src/index.ts`) and import from there. If it's not exported at all, add an export to `src/index.ts`:

```ts
// in src/index.ts, near other action-layer exports
export type { KeyBinding } from './interactions/actions/useKeybinding';
```

- [ ] **Step 4: Run to verify PASS**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/components/ToolPalette/formatShortcut.ts \
        packages/weasel-ui/src/components/ToolPalette/formatShortcut.test.ts \
        src/index.ts   # only if you needed to export KeyBinding
git commit -m "feat(weasel-ui): formatShortcut deriver for ToolPalette"
```

---

## Task 5: `ToolPalette` component — skeleton (no grouping, no keyboard nav)

**Files:**

- Create: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx`
- Create: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css` (stub — full styling in Task 6)
- Create: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx`

Skeleton renders one button per tool from `tools.list()`, dispatches `tools.setActive(id)` on click, and applies `aria-current="true"` to the active tool. No groups, no keyboard nav yet — those come in subsequent tasks.

- [ ] **Step 1: Read the existing `ToolsApi` shape to know what props the component reads**

```bash
grep -n "ToolsApi\|list\(\)\|activeId\|setActive" /Users/mike/src/weasel/src/tools/useTools.ts | head -20
```

Confirm:
- `tools.list(): AnyTool[]` returns the registered tools.
- `tools.activeId: string | null` is the active tool id.
- `tools.setActive(id: string): void` switches active.

If those exact names diverge, adapt the test + component to match.

- [ ] **Step 2: Write the failing test**

```tsx
// packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToolPalette } from './ToolPalette';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';

function fakeTool(id: string, group?: string, label?: string): AnyTool {
  return {
    id,
    presentation: { label: label ?? id, group },
  } as AnyTool;
}

function fakeTools(list: AnyTool[], activeId: string | null = null): ToolsApi {
  const setActive = vi.fn();
  return {
    list: () => list,
    activeId,
    setActive,
    // any other ToolsApi members the component doesn't read — leave as stubs.
  } as unknown as ToolsApi;
}

describe('ToolPalette', () => {
  it('renders one button per tool', () => {
    const tools = fakeTools([fakeTool('select'), fakeTool('hand')]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  it('shows the tool label from presentation', () => {
    const tools = fakeTools([fakeTool('select', undefined, 'Select')]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('Select')).toBeTruthy();
  });

  it('falls back to id when presentation.label is absent', () => {
    const tools = fakeTools([{ id: 'mystery' } as AnyTool]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('mystery')).toBeTruthy();
  });

  it('marks the active tool with aria-current', () => {
    const tools = fakeTools([fakeTool('a'), fakeTool('b')], 'b');
    render(<ToolPalette tools={tools} />);
    const aBtn = screen.getByRole('button', { name: /^a/ });
    const bBtn = screen.getByRole('button', { name: /^b/ });
    expect(aBtn.getAttribute('aria-current')).toBeNull();
    expect(bBtn.getAttribute('aria-current')).toBe('true');
  });

  it('clicking a button dispatches tools.setActive(id)', () => {
    const list = [fakeTool('select'), fakeTool('hand')];
    const tools = fakeTools(list);
    render(<ToolPalette tools={tools} />);
    fireEvent.click(screen.getByRole('button', { name: /^hand/ }));
    expect(tools.setActive).toHaveBeenCalledWith('hand');
  });

  it('root has role="toolbar" with an accessible name', () => {
    const tools = fakeTools([fakeTool('select')]);
    const { container } = render(<ToolPalette tools={tools} />);
    const root = container.querySelector('[role="toolbar"]');
    expect(root).toBeTruthy();
    expect(root?.getAttribute('aria-label')).toBeTruthy();
  });
});
```

If `ToolsApi` isn't exported from the kit's top-level, check `grep -n "ToolsApi" /Users/mike/src/weasel/src/index.ts` and either fix imports or export from the kit. Same approach as `KeyBinding` in Task 4.

- [ ] **Step 3: Run to verify FAIL**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: FAIL — module not found.

- [ ] **Step 4: Implement the skeleton**

```tsx
// packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx
import { UnknownIcon } from '@orochi235/weasel';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';
import s from './ToolPalette.module.css';

export interface ToolPaletteProps {
  tools: ToolsApi;
  orientation?: 'vertical' | 'horizontal';
  className?: string;
}

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className } = props;
  const list = tools.list();
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Tools">
      {list.map((tool) => {
        const label = tool.presentation?.label ?? tool.id;
        const icon = tool.presentation?.icon ?? <UnknownIcon />;
        const isActive = tools.activeId === tool.id;
        return (
          <button
            key={tool.id}
            type="button"
            className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
            aria-current={isActive ? 'true' : undefined}
            onClick={() => tools.setActive(tool.id)}
          >
            <span className={s.icon} aria-hidden="true">{icon}</span>
            <span className={s.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}
```

And the stub CSS module (full styling in Task 6):

```css
/* packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css */
.palette {}
.horizontal {}
.button {}
.active {}
.icon {}
.label {}
```

If `AnyTool` / `ToolsApi` aren't exported from `@orochi235/weasel`, add the exports in `src/index.ts` (same approach as Task 4).

- [ ] **Step 5: Run to verify PASS**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: 6 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx \
        packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css \
        packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx \
        src/index.ts   # only if needed for AnyTool/ToolsApi
git commit -m "feat(weasel-ui): ToolPalette skeleton with click + aria-current"
```

---

## Task 6: `ToolPalette` — grouping + group separators

**Files:**

- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx`
- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx`

Partition `tools.list()` by `presentation.group`, render each group as its own `<div>`, insert separators between groups. Unknown groups go after known ones in first-seen order; tools without a group go into an implicit `'misc'` bucket rendered last.

- [ ] **Step 1: Write the failing tests**

Append to `ToolPalette.test.tsx`:

```tsx
describe('ToolPalette — grouping', () => {
  it('renders groups in DEFAULT_GROUP_ORDER (select, shape, draw, type, view)', () => {
    const tools = fakeTools([
      fakeTool('text', 'type'),
      fakeTool('select', 'select'),
      fakeTool('hand', 'view'),
      fakeTool('rect', 'shape'),
      fakeTool('pen', 'draw'),
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.map((b) => b.textContent)).toEqual(
      // expected order: select → shape → draw → type → view
      // each entry is the label (defaulted to id here)
      expect.arrayContaining([]),
    );
    // Specifically: select is first, hand is last.
    expect(buttons[0].textContent).toContain('select');
    expect(buttons[buttons.length - 1].textContent).toContain('hand');
  });

  it('puts tools with unknown groups after known ones', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      fakeTool('weird', 'experimental'),
      fakeTool('hand', 'view'),
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    // select, hand are known (select, view in DEFAULT_GROUP_ORDER).
    // weird is unknown → after the known ones.
    expect(buttons[buttons.length - 1].textContent).toContain('weird');
  });

  it('tools without presentation.group go into the implicit misc bucket (last)', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      { id: 'orphan', presentation: { label: 'Orphan' } } as AnyTool,
    ]);
    render(<ToolPalette tools={tools} />);
    const buttons = screen.getAllByRole('button');
    expect(buttons[buttons.length - 1].textContent).toContain('Orphan');
  });

  it('separates groups with a visible divider', () => {
    const tools = fakeTools([
      fakeTool('select', 'select'),
      fakeTool('rect', 'shape'),
    ]);
    const { container } = render(<ToolPalette tools={tools} />);
    // Each group is a `<div role="group">`; separators are `role="separator"`.
    const separators = container.querySelectorAll('[role="separator"]');
    expect(separators.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: the four new tests fail (current skeleton renders a flat list with no separators).

- [ ] **Step 3: Implement grouping**

Replace the body of `ToolPalette` with grouped rendering:

```tsx
const DEFAULT_GROUP_ORDER = ['select', 'shape', 'draw', 'type', 'view'] as const;
const MISC = 'misc';

function partitionByGroup(list: AnyTool[]): Map<string, AnyTool[]> {
  const groups = new Map<string, AnyTool[]>();
  for (const tool of list) {
    const g = tool.presentation?.group ?? MISC;
    const bucket = groups.get(g) ?? [];
    bucket.push(tool);
    groups.set(g, bucket);
  }
  return groups;
}

function orderedGroupKeys(groups: Map<string, AnyTool[]>): string[] {
  const seen = new Set(groups.keys());
  const ordered: string[] = [];
  for (const known of DEFAULT_GROUP_ORDER) {
    if (seen.has(known)) {
      ordered.push(known);
      seen.delete(known);
    }
  }
  // unknown groups in first-seen order; iteration order of Map preserves insertion order
  for (const key of groups.keys()) {
    if (seen.has(key) && key !== MISC) {
      ordered.push(key);
      seen.delete(key);
    }
  }
  if (seen.has(MISC)) ordered.push(MISC);
  return ordered;
}

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className } = props;
  const groups = partitionByGroup(tools.list());
  const groupKeys = orderedGroupKeys(groups);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');

  return (
    <div className={cls} role="toolbar" aria-label="Tools">
      {groupKeys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <div className={s.separator} role="separator" aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'} />}
          <div className={s.group} role="group" data-group={key}>
            {groups.get(key)!.map((tool) => renderToolButton(tool, tools))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}

function renderToolButton(tool: AnyTool, tools: ToolsApi) {
  const label = tool.presentation?.label ?? tool.id;
  const icon = tool.presentation?.icon ?? <UnknownIcon />;
  const isActive = tools.activeId === tool.id;
  return (
    <button
      key={tool.id}
      type="button"
      className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => tools.setActive(tool.id)}
    >
      <span className={s.icon} aria-hidden="true">{icon}</span>
      <span className={s.label}>{label}</span>
    </button>
  );
}
```

Add `Fragment` to the React import at the top:

```ts
import { Fragment } from 'react';
```

- [ ] **Step 4: Run to verify all tests pass**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: 10 tests PASS (6 original + 4 new).

- [ ] **Step 5: Typecheck + commit**

```bash
cd /Users/mike/src/weasel && npm run typecheck
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx \
        packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
git commit -m "feat(weasel-ui): ToolPalette grouping + separators"
```

---

## Task 7: `ToolPalette` — shortcut display + tooltips

**Files:**

- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx`
- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx`

Each button shows the keyboard shortcut next to its label (via `formatShortcut(tool.keybinding)` unless `presentation.shortcut` is set), and the button's `title` attribute combines label + shortcut for the native tooltip.

- [ ] **Step 1: Write the failing tests**

Append to `ToolPalette.test.tsx`:

```tsx
describe('ToolPalette — shortcuts', () => {
  function withKeybinding(id: string, keybinding: { key: string; mod?: boolean; shift?: boolean; alt?: boolean }): AnyTool {
    return { id, keybinding, presentation: { label: id, group: 'select' } } as AnyTool;
  }

  it('shows shortcut derived from keybinding', () => {
    const tools = fakeTools([withKeybinding('select', { key: 'v' })]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('V')).toBeTruthy();
  });

  it('shows the override from presentation.shortcut when set', () => {
    const tool = {
      id: 'select',
      keybinding: { key: 'v' },
      presentation: { label: 'Select', group: 'select', shortcut: 'Sel' },
    } as AnyTool;
    const tools = fakeTools([tool]);
    render(<ToolPalette tools={tools} />);
    expect(screen.getByText('Sel')).toBeTruthy();
    expect(screen.queryByText('V')).toBeNull();
  });

  it('button title combines label and shortcut', () => {
    const tools = fakeTools([withKeybinding('select', { key: 'v' })]);
    render(<ToolPalette tools={tools} />);
    const btn = screen.getByRole('button', { name: /^select/i });
    const title = btn.getAttribute('title') ?? '';
    expect(title).toMatch(/select/i);
    expect(title).toMatch(/V/);
  });

  it('button title is just the label when no shortcut is available', () => {
    const tool = { id: 'select', presentation: { label: 'Select', group: 'select' } } as AnyTool;
    const tools = fakeTools([tool]);
    render(<ToolPalette tools={tools} />);
    const btn = screen.getByRole('button', { name: /^select/i });
    expect(btn.getAttribute('title')).toBe('Select');
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: 4 new tests fail.

- [ ] **Step 3: Implement**

In `ToolPalette.tsx`, import `formatShortcut`:

```ts
import { formatShortcut } from './formatShortcut';
```

Update `renderToolButton`:

```tsx
function renderToolButton(tool: AnyTool, tools: ToolsApi) {
  const label = tool.presentation?.label ?? tool.id;
  const icon = tool.presentation?.icon ?? <UnknownIcon />;
  const shortcut = tool.presentation?.shortcut ?? formatShortcut(tool.keybinding);
  const title = shortcut ? `${label} (${shortcut})` : label;
  const isActive = tools.activeId === tool.id;
  return (
    <button
      key={tool.id}
      type="button"
      title={title}
      className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => tools.setActive(tool.id)}
    >
      <span className={s.icon} aria-hidden="true">{icon}</span>
      <span className={s.label}>{label}</span>
      {shortcut && <span className={s.shortcut}>{shortcut}</span>}
    </button>
  );
}
```

The third test asserts the title contains both "select" and "V" but doesn't pin a format — accept `${label} (${shortcut})` here.

- [ ] **Step 4: Run all tests**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/
```

Expected: 14 tests pass (10 original + 4 new).

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx \
        packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
git commit -m "feat(weasel-ui): ToolPalette shortcut display + native tooltip"
```

---

## Task 8: `ToolPalette` — keyboard nav (ARIA toolbar pattern)

**Files:**

- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx`
- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx`

Arrow keys move focus between buttons within the palette; Enter / Space activates (and click already handles activation). Per ARIA Toolbar pattern, the buttons form a single focusable group — only the currently-focused button has `tabIndex={0}`, the rest have `tabIndex={-1}`.

- [ ] **Step 1: Write failing tests**

Append to `ToolPalette.test.tsx`:

```tsx
describe('ToolPalette — keyboard nav', () => {
  function fiveTools() {
    return fakeTools(['a', 'b', 'c', 'd', 'e'].map((id) => fakeTool(id, 'select', id.toUpperCase())));
  }

  it('only the active tool has tabIndex=0 initially; others tabIndex=-1', () => {
    const tools = fakeTools([fakeTool('a', 'select'), fakeTool('b', 'select')], 'b');
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^a/i }) as HTMLButtonElement;
    const b = screen.getByRole('button', { name: /^b/i }) as HTMLButtonElement;
    expect(a.tabIndex).toBe(-1);
    expect(b.tabIndex).toBe(0);
  });

  it('falls back to the first tool when no active tool', () => {
    const tools = fakeTools([fakeTool('a', 'select'), fakeTool('b', 'select')], null);
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^a/i }) as HTMLButtonElement;
    const b = screen.getByRole('button', { name: /^b/i }) as HTMLButtonElement;
    expect(a.tabIndex).toBe(0);
    expect(b.tabIndex).toBe(-1);
  });

  it('ArrowDown / ArrowRight moves focus to the next tool', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const b = screen.getByRole('button', { name: /^B/ });
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(b);
  });

  it('ArrowUp / ArrowLeft moves focus to the previous tool', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const b = screen.getByRole('button', { name: /^B/ });
    b.focus();
    fireEvent.keyDown(b, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(a);
  });

  it('Home focuses the first tool, End focuses the last', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const e = screen.getByRole('button', { name: /^E/ });
    const c = screen.getByRole('button', { name: /^C/ });
    c.focus();
    fireEvent.keyDown(c, { key: 'End' });
    expect(document.activeElement).toBe(e);
    fireEvent.keyDown(e, { key: 'Home' });
    expect(document.activeElement).toBe(a);
  });

  it('focus wraps from last to first on ArrowDown, first to last on ArrowUp', () => {
    const tools = fiveTools();
    render(<ToolPalette tools={tools} />);
    const a = screen.getByRole('button', { name: /^A/ });
    const e = screen.getByRole('button', { name: /^E/ });
    e.focus();
    fireEvent.keyDown(e, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(a);
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(e);
  });
});
```

- [ ] **Step 2: Run to verify FAIL**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: ~6 new tests fail.

- [ ] **Step 3: Implement keyboard nav**

In `ToolPalette.tsx`, add a ref for the root element and the key handler:

```tsx
import { Fragment, useRef } from 'react';

export function ToolPalette(props: ToolPaletteProps) {
  const { tools, orientation = 'vertical', className } = props;
  const list = tools.list();
  const groups = partitionByGroup(list);
  const groupKeys = orderedGroupKeys(groups);
  const cls = [s.palette, orientation === 'horizontal' && s.horizontal, className]
    .filter(Boolean).join(' ');
  const rootRef = useRef<HTMLDivElement | null>(null);

  // tabIndex roving: active tool (or first when none active) is tabbable;
  // arrow keys move focus and update tabIndex implicitly via the next render.
  const orderedIds = groupKeys.flatMap((k) => groups.get(k)!.map((t) => t.id));
  const tabbableId = tools.activeId && orderedIds.includes(tools.activeId)
    ? tools.activeId
    : orderedIds[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const target = e.target as HTMLElement;
    if (target.getAttribute('role') !== 'button' && target.tagName !== 'BUTTON') return;
    const root = rootRef.current;
    if (!root) return;
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button'));
    const i = buttons.indexOf(target as HTMLButtonElement);
    if (i < 0) return;

    let next = -1;
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        next = (i + 1) % buttons.length;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        next = (i - 1 + buttons.length) % buttons.length;
        break;
      case 'Home':
        next = 0;
        break;
      case 'End':
        next = buttons.length - 1;
        break;
    }
    if (next >= 0) {
      e.preventDefault();
      buttons[next].focus();
    }
  }

  return (
    <div
      ref={rootRef}
      className={cls}
      role="toolbar"
      aria-label="Tools"
      onKeyDown={onKeyDown}
    >
      {groupKeys.map((key, i) => (
        <Fragment key={key}>
          {i > 0 && <div className={s.separator} role="separator" aria-orientation={orientation === 'horizontal' ? 'vertical' : 'horizontal'} />}
          <div className={s.group} role="group" data-group={key}>
            {groups.get(key)!.map((tool) => renderToolButton(tool, tools, tool.id === tabbableId))}
          </div>
        </Fragment>
      ))}
    </div>
  );
}
```

And update `renderToolButton` to take the tabbable flag:

```tsx
function renderToolButton(tool: AnyTool, tools: ToolsApi, isTabbable: boolean) {
  const label = tool.presentation?.label ?? tool.id;
  const icon = tool.presentation?.icon ?? <UnknownIcon />;
  const shortcut = tool.presentation?.shortcut ?? formatShortcut(tool.keybinding);
  const title = shortcut ? `${label} (${shortcut})` : label;
  const isActive = tools.activeId === tool.id;
  return (
    <button
      key={tool.id}
      type="button"
      tabIndex={isTabbable ? 0 : -1}
      title={title}
      className={[s.button, isActive && s.active].filter(Boolean).join(' ')}
      aria-current={isActive ? 'true' : undefined}
      onClick={() => tools.setActive(tool.id)}
    >
      <span className={s.icon} aria-hidden="true">{icon}</span>
      <span className={s.label}>{label}</span>
      {shortcut && <span className={s.shortcut}>{shortcut}</span>}
    </button>
  );
}
```

- [ ] **Step 4: Run tests**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
```

Expected: ~20 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.tsx \
        packages/weasel-ui/src/components/ToolPalette/ToolPalette.test.tsx
git commit -m "feat(weasel-ui): ToolPalette ARIA toolbar keyboard nav"
```

---

## Task 9: `ToolPalette` CSS chrome

**Files:**

- Modify: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css`

Visual chrome. Match the LayerList / PathfinderPanel palette (dark warm-brown, 4px radius, 2px padding). Vertical layout default; horizontal layout flips `flex-direction`. Button is icon-above-label, with the shortcut as small subtext.

- [ ] **Step 1: Replace the CSS stub with real styling**

```css
.palette {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: #1a1612;
  border: 1px solid #2a2418;
  border-radius: 4px;
  padding: 4px;
  user-select: none;
}
.palette.horizontal {
  flex-direction: row;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.palette.horizontal .group {
  flex-direction: row;
}

.separator {
  background: #2a2418;
}
.palette:not(.horizontal) .separator {
  height: 1px;
  margin: 2px 0;
}
.palette.horizontal .separator {
  width: 1px;
  margin: 0 2px;
}

.button {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 44px;
  padding: 6px 4px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: #d8c8a8;
  cursor: default;
  font-family: inherit;
  font-size: 10px;
  line-height: 1.1;
}
.button:hover:not([disabled]) {
  background: #221c12;
  color: #fff5d8;
}
.button:focus-visible {
  outline: 2px solid #d4c4a8;
  outline-offset: -2px;
}
.button.active {
  background: #3a2e1c;
  color: #fff5d8;
  border-color: #d4c4a8;
}

.icon {
  display: block;
}
.icon > svg {
  display: block;
}
.label {
  font-size: 10px;
}
.shortcut {
  opacity: 0.55;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 9px;
}
```

- [ ] **Step 2: Run tests to confirm no regressions**

```bash
npm test -- packages/weasel-ui/src/components/ToolPalette/
```

Expected: all tests still pass.

- [ ] **Step 3: Commit**

```bash
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.module.css
git commit -m "style(weasel-ui): ToolPalette chrome — dark palette with icon-above-label buttons"
```

---

## Task 10: Per-component barrel + main weasel-ui export

**Files:**

- Create: `packages/weasel-ui/src/components/ToolPalette/index.ts`
- Modify: `packages/weasel-ui/src/index.ts`

- [ ] **Step 1: Create the barrel**

```ts
// packages/weasel-ui/src/components/ToolPalette/index.ts
export { ToolPalette } from './ToolPalette';
export type { ToolPaletteProps } from './ToolPalette';
export { formatShortcut } from './formatShortcut';
```

- [ ] **Step 2: Re-export from main weasel-ui index**

Append to the top section of `packages/weasel-ui/src/index.ts` (alongside the other `export * from './components/...'` lines):

```ts
export * from './components/ToolPalette';
```

- [ ] **Step 3: Typecheck + commit**

```bash
cd /Users/mike/src/weasel && npm run typecheck
git add packages/weasel-ui/src/components/ToolPalette/index.ts \
        packages/weasel-ui/src/index.ts
git commit -m "feat(weasel-ui): export ToolPalette from package barrel"
```

---

## Task 11: Storybook stories for ToolPalette

**Files:**

- Create: `packages/weasel-ui/src/components/ToolPalette/ToolPalette.stories.tsx`

Three stories per the spec: Default (vertical, full 6-tool palette), Horizontal (same tools, horizontal), Minimal (3 tools, no groups).

- [ ] **Step 1: Write the stories**

```tsx
// packages/weasel-ui/src/components/ToolPalette/ToolPalette.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { ToolPalette } from './ToolPalette';
import type { AnyTool, ToolsApi } from '@orochi235/weasel';
import {
  SelectIcon,
  LassoIcon,
  RectIcon,
  TextIcon,
  PenIcon,
  HandIcon,
} from '@orochi235/weasel';

const meta: Meta<typeof ToolPalette> = {
  title: 'weasel-ui/ToolPalette',
  component: ToolPalette,
};
export default meta;

type Story = StoryObj<typeof ToolPalette>;

function buildFullPalette(): { tools: ToolsApi; setActive: (id: string) => void; activeId: string } {
  const list: AnyTool[] = [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon />, group: 'select' } } as AnyTool,
    { id: 'lasso',  keybinding: { key: 'l' }, presentation: { label: 'Lasso',  icon: <LassoIcon />,  group: 'select' } } as AnyTool,
    { id: 'rect',   keybinding: { key: 'r' }, presentation: { label: 'Rect',   icon: <RectIcon />,   group: 'shape'  } } as AnyTool,
    { id: 'text',   keybinding: { key: 't' }, presentation: { label: 'Text',   icon: <TextIcon />,   group: 'type'   } } as AnyTool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon />,    group: 'draw'   } } as AnyTool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon />,   group: 'view'   } } as AnyTool,
  ];
  return { list } as never;
}

function Demo({ orientation }: { orientation?: 'vertical' | 'horizontal' }) {
  const [activeId, setActive] = useState<string>('select');
  const list: AnyTool[] = [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon />, group: 'select' } } as AnyTool,
    { id: 'lasso',  keybinding: { key: 'l' }, presentation: { label: 'Lasso',  icon: <LassoIcon />,  group: 'select' } } as AnyTool,
    { id: 'rect',   keybinding: { key: 'r' }, presentation: { label: 'Rect',   icon: <RectIcon />,   group: 'shape'  } } as AnyTool,
    { id: 'text',   keybinding: { key: 't' }, presentation: { label: 'Text',   icon: <TextIcon />,   group: 'type'   } } as AnyTool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon />,    group: 'draw'   } } as AnyTool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon />,   group: 'view'   } } as AnyTool,
  ];
  const tools: ToolsApi = {
    list: () => list,
    activeId,
    setActive,
  } as unknown as ToolsApi;
  return <ToolPalette tools={tools} orientation={orientation} />;
}

function MinimalDemo() {
  const [activeId, setActive] = useState<string>('select');
  const list: AnyTool[] = [
    { id: 'select', keybinding: { key: 'v' }, presentation: { label: 'Select', icon: <SelectIcon /> } } as AnyTool,
    { id: 'pen',    keybinding: { key: 'p' }, presentation: { label: 'Pen',    icon: <PenIcon /> } } as AnyTool,
    { id: 'hand',   keybinding: { key: 'h' }, presentation: { label: 'Hand',   icon: <HandIcon /> } } as AnyTool,
  ];
  const tools: ToolsApi = {
    list: () => list,
    activeId,
    setActive,
  } as unknown as ToolsApi;
  return <ToolPalette tools={tools} />;
}

export const Default: Story = { render: () => <Demo /> };
export const Horizontal: Story = { render: () => <Demo orientation="horizontal" /> };
export const Minimal: Story = { render: () => <MinimalDemo /> };
```

- [ ] **Step 2: Typecheck + commit**

The unused `buildFullPalette` function at the top is dead — remove it. (It's there from an early draft; if the implementation in this plan is followed verbatim, drop that stub.)

```bash
cd /Users/mike/src/weasel && npm run typecheck
git add packages/weasel-ui/src/components/ToolPalette/ToolPalette.stories.tsx
git commit -m "story(weasel-ui): ToolPalette — default, horizontal, minimal"
```

---

## Task 12: Swillustrator drops `TOOL_ORDER`, uses `<ToolPalette tools={tools} />`

**Files:**

- Modify: `apps/swillustrator/src/App.tsx`
- Modify: `apps/swillustrator/src/swillustrator.css`

After this task, Swillustrator's tool palette is rendered from kit metadata alone. The local `TOOL_ORDER` array, the `swill-tool-button` rendering block, and the per-tool button styles can all go.

- [ ] **Step 1: Drop the local tool-array + rendering**

In `apps/swillustrator/src/App.tsx`:

1. Remove the `TOOL_ORDER` array (the `ToolEntry` interface + `const TOOL_ORDER: ToolEntry[] = [...]` lines).
2. Remove the `import { SelectIcon, LassoIcon, RectIcon as ToolRectIcon, TextIcon as ToolTextIcon, PenIcon, HandIcon } from '@orochi235/weasel';` import — the kit metadata supplies the icons now.
3. Remove the `ComponentType` import.
4. In the tool palette JSX block (the `{TOOL_ORDER.map(...)}` inside `<aside className="swill-sidebar">`), replace with:

```tsx
<aside className="swill-sidebar">
  <div className="swill-section-label">Tools</div>
  <ToolPalette tools={tools} />
  <div className="swill-sidebar-spacer" />
  <button
    className="swill-tool-button"
    onClick={() => setView({ x: 0, y: 0, scale: 1 })}
    title="Reset view"
    type="button"
  >
    <span>Reset</span>
    <span className="key">view</span>
  </button>
</aside>
```

(The "Reset view" button stays as-is — it's not a tool, it's a one-shot action.)

5. Add the import:

```ts
import { ToolPalette } from '@orochi235/weasel-ui';
```

(combine with the existing weasel-ui import block).

- [ ] **Step 2: Decide what to do with `swill-tool-button` CSS**

The "Reset view" button still uses the `.swill-tool-button` class — keep the class. But the variants tied to the tool list (`active`, `.swill-tool-button .key`) are still needed for the Reset button. Don't delete those rules.

What CAN go: nothing in this case, since the Reset button reuses the same class. If you want, audit `.swill-tool-button > svg { display: block }` — it's harmless either way; leave it.

- [ ] **Step 3: Run the dev server and smoke test**

```bash
cd /Users/mike/src/weasel && npm run dev
```

Visit `http://localhost:5173/swillustrator` (or wherever the app mounts — confirm via `apps/swillustrator/package.json`). Verify:

1. The tool palette renders with 6 icons.
2. Clicking each switches the active tool (canvas behavior changes accordingly).
3. The active tool gets a visible "active" highlight.
4. Reset view button still works.
5. Keyboard shortcut "V" still activates Select (the kit's existing `useKeybindings` does this independently of the palette).

- [ ] **Step 4: Run the full test suite**

```bash
npm test
```

Expected: no regressions.

- [ ] **Step 5: Typecheck + commit**

```bash
npm run typecheck
git add apps/swillustrator/src/App.tsx apps/swillustrator/src/swillustrator.css
git commit -m "feat(swillustrator): replace hand-rolled tool buttons with <ToolPalette>"
```

---

## Self-review notes

- **Cursor plumbing isn't a task** because it's already done (`Tool.cursor` → `Canvas.tsx:1317` `style.cursor`). The spec listed it as new work; this plan deliberately deviates.
- **Shape tools are out of scope.** The spec bundles them with the palette work but they're independent. They get their own plan when the user picks them up.
- **Task 4 + 5 may need exports added to the kit's main `src/index.ts`** (`KeyBinding`, `AnyTool`, `ToolsApi`). The plan flags this inline; the implementer adds the export and includes `src/index.ts` in that task's commit if needed.
- **Story file's `buildFullPalette` is a known dead-code stub** the implementer should drop before commit. Flagged inline.
- **The keyboard-nav implementation uses raw DOM queries** to find adjacent buttons. An alternative is a roving-index state in React, but the DOM-query approach matches existing patterns in the codebase (LayerList, RangePicker) and is simpler to reason about.
- **Reset view button** stays in Swillustrator's sidebar — it's an action, not a tool. The plan keeps it outside `<ToolPalette>` because there's nothing tool-shaped about it.
