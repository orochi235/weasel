# labkit chrome regions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Assemble a trial's chrome from what its instrument declares, through one mechanism, replacing three half-built ones.

**Architecture:** A **region** is a named position in a trial's chrome. A **contribution** is data keyed to a region (`{ id, region, item }`), with `render` as a visible escape. Built-in contributions are derived from the instrument's declared capabilities; the instrument and the consumer add more; bundles concatenate and a duplicate id throws. `TrialChrome` stops hand-writing each region and renders whatever the assembled list puts there.

**Tech Stack:** TypeScript, React 19, zustand (vanilla store + `useStore`), vitest + @testing-library/react, LESS with `lk-` class prefix (enforced by `scripts/check-class-prefix.ts`).

**Spec:** `docs/superpowers/specs/2026-08-25-labkit-chrome-regions-design.md`. Read it before Task 1.

**Worktree:** `/Users/mike/src/weasel-arc3`, branch `feat/labkit-arc3`. Every path below is relative to that directory. Run commands from it.

---

## File Structure

**Create:**

| File | Responsibility |
|---|---|
| `packages/labkit/src/chrome/types.ts` | `TrialRegion`, the `TrialContribution` union, the per-region item types, `TrialChromeContext` |
| `packages/labkit/src/chrome/merge.ts` | `mergeContributions` (throws on duplicate id), `suppressContributions` (throws on unknown id) |
| `packages/labkit/src/chrome/builtins.tsx` | `builtinContributions(ctx)` — derives the built-in bundle from declared capabilities |
| `packages/labkit/src/chrome/regions/ToolbarRegion.tsx` | Renders `region: 'toolbar'` contributions into `<Toolbar>` |
| `packages/labkit/src/chrome/regions/SidebarRegion.tsx` | Renders `region: 'sidebar'` contributions as sections |
| `packages/labkit/src/chrome/regions/StatusRegion.tsx` | Renders `region: 'status'` contributions |
| `packages/labkit/src/chrome/regions/ViewportRegion.tsx` | Renders `region: 'viewport'` contributions, anchored in the canvas |
| `packages/labkit/src/chrome/regions/PaletteRegion.tsx` | Renders `region: 'palette'` contributions as a tool strip |
| `packages/labkit/src/chrome/regions/ViewportRegion.less` | Viewport region styling |
| `packages/labkit/src/chrome/regions/PaletteRegion.less` | Palette region styling |
| `packages/labkit/src/chrome/index.ts` | Barrel |
| `packages/labkit/src/tools/types.ts` | `TrialTool` — labkit's own tool declaration |

**Modify:**

| File | Change |
|---|---|
| `packages/labkit/src/trial/TrialChrome.tsx` | Build one `TrialChromeContext`; render each region from contributions |
| `packages/labkit/src/trial/Trial.tsx` | Stop passing `sidebarExtras`; contribute palette/layers instead |
| `packages/labkit/src/instrument/types.ts` | Add `tools?` and `chrome?` to `Instrument` |
| `packages/labkit/src/state/types.ts` | `activeToolId` on `TrialRecord` (optional) and `LabStoreState` |
| `packages/labkit/src/state/store.ts` | `setLabTool` / `setTrialTool` actions |
| `packages/labkit/src/lab/Lab.tsx` | `chrome`, `suppress`, `tools` on `LabProps` |
| `packages/labkit/src/styles.less` | Import the two new region stylesheets |
| `packages/labkit/src/index.ts` | Export the chrome surface; drop the deleted types |

**Delete:**

| File | Why |
|---|---|
| `packages/labkit/src/trial/slotTypes.ts` | Replaced by `TrialChromeContext`; `*Slot` names freed |
| `packages/labkit/src/instrument/capabilityDetector.ts` | The derivation replaces it |
| `packages/labkit/src/instrument/capabilityDetector.test.ts` | Ditto |
| `packages/labkit/src/trial/DefaultToolbar.tsx` | Becomes built-in contributions |
| `packages/labkit/src/trial/DefaultSidebar.tsx` | Ditto |
| `packages/labkit/src/trial/DefaultStatusBar.tsx` | Ditto |

---

### Task 1: Contribution types

**Files:**
- Create: `packages/labkit/src/chrome/types.ts`

- [ ] **Step 1: Write the types**

```ts
import type { ReactNode } from 'react';
import type { ComponentType } from 'react';
import type { ConfigField } from '../controls/types';
import type { SavedSnapshot } from '../state/types';

/** A named position in a trial's chrome. Content is not a region — that is
 *  the instrument. */
export type TrialRegion = 'toolbar' | 'palette' | 'sidebar' | 'viewport' | 'status';

/** An icon component taking a pixel size, as `@weasel-js/ui` glyphs do. */
export type IconComponent = ComponentType<{ size?: number }>;

/** A button in the trial toolbar. */
export interface ToolbarItem {
  icon: IconComponent;
  label: string;
  /** Shown in the tooltip. Not bound here — the trial owns its keymap. */
  shortcut?: string;
  disabled?: boolean;
  /** Reddens on hover. For actions that discard work. */
  danger?: boolean;
  /** Render the label beside the glyph rather than only in the tooltip. */
  showLabel?: boolean;
  onActivate: () => void;
}

/** A selectable tool in the palette region. */
export interface ToolItem {
  icon: IconComponent;
  label: string;
  shortcut?: string;
  disabled?: boolean;
}

/** A titled block in the sidebar. */
export interface SidebarSection {
  title: string;
  /** Starts collapsed. The open/closed state itself is the region's. */
  defaultCollapsed?: boolean;
  body: ReactNode;
}

/** A control acting on the view of the trial, not on the trial. */
export interface ViewportControl {
  icon: IconComponent;
  label: string;
  disabled?: boolean;
  onActivate: () => void;
}

/** A readout in the status bar. */
export interface StatusReadout {
  /** Short enough for a status bar. Rendered as text. */
  text: string;
  /** Tooltip. */
  title?: string;
}

/** What every contribution shares. */
interface ContributionBase {
  id: string;
  /** Groups sort by first appearance; items sort within a group by
   *  declaration order. Contributions with no group sort after grouped ones. */
  group?: string;
  /** Pushes this contribution, and its group, to the far end of the region. */
  end?: boolean;
}

/**
 * A contribution is data the chrome renders, keyed to a region. Supplying
 * `render` instead of `item` opts out of the chrome's layout — deliberate,
 * and visible in the declaration.
 */
export type TrialContribution =
  | (ContributionBase & { region: 'toolbar'; item: ToolbarItem; render?: never })
  | (ContributionBase & { region: 'palette'; item: ToolItem; render?: never })
  | (ContributionBase & { region: 'sidebar'; item: SidebarSection; render?: never })
  | (ContributionBase & { region: 'viewport'; item: ViewportControl; render?: never })
  | (ContributionBase & { region: 'status'; item: StatusReadout; render?: never })
  | (ContributionBase & {
      region: TrialRegion;
      item?: never;
      render: (ctx: TrialChromeContext) => ReactNode;
    });

/**
 * Everything a contribution can read about the trial it is being rendered
 * into. Replaces the three separate slot contexts, which each carried a
 * hand-picked subset.
 */
export interface TrialChromeContext {
  trialId: string;
  instrumentName: string;
  isLastTrial: boolean;

  /** Null when the trial holds a view that is not the 2D one. */
  zoom: number | null;
  setZoom: (z: number) => void;

  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;

  configFields: ConfigField[];
  config: unknown;
  setConfig: (key: string, value: unknown) => void;

  savedSnapshots: SavedSnapshot[];
  saveSnapshot: (name?: string) => void;
  loadSnapshot: (snapshotId: string) => void;

  clone: () => void;
  reset: () => void;
  close: () => void;

  /** Resolved active tool: the trial's slot, or the lab's when the trial has
   *  none. Null when neither holds one. */
  activeToolId: string | null;
  setActiveTool: (id: string) => void;
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit -p packages/labkit/tsconfig.json`
Expected: PASS, no output.

- [ ] **Step 3: Commit**

```bash
git add packages/labkit/src/chrome/types.ts
git commit -m "declare the trial chrome contribution types"
```

---

### Task 2: Merge and suppress

Two pure functions. `mergeContributions` follows core's `packages/core/src/contributions/merge.ts` — a duplicate id throws rather than one bundle silently losing.

**Files:**
- Create: `packages/labkit/src/chrome/merge.ts`
- Test: `packages/labkit/src/chrome/merge.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { mergeContributions, suppressContributions } from './merge';
import type { TrialContribution } from './types';

const Glyph = () => null;

function toolbarItem(id: string): TrialContribution {
  return {
    id,
    region: 'toolbar',
    item: { icon: Glyph, label: id, onActivate: () => {} },
  };
}

describe('mergeContributions', () => {
  it('concatenates bundles in order', () => {
    const out = mergeContributions([toolbarItem('a')], [toolbarItem('b'), toolbarItem('c')]);
    expect(out.map((c) => c.id)).toEqual(['a', 'b', 'c']);
  });

  it('throws on a duplicate id, naming it', () => {
    expect(() => mergeContributions([toolbarItem('undo')], [toolbarItem('undo')])).toThrow(
      /duplicate contribution id "undo"/,
    );
  });

  it('accepts no bundles', () => {
    expect(mergeContributions()).toEqual([]);
  });
});

describe('suppressContributions', () => {
  it('removes the named ids', () => {
    const out = suppressContributions(
      [toolbarItem('a'), toolbarItem('b'), toolbarItem('c')],
      ['b'],
    );
    expect(out.map((c) => c.id)).toEqual(['a', 'c']);
  });

  it('throws on an id that is not there', () => {
    expect(() => suppressContributions([toolbarItem('a')], ['snapshto'])).toThrow(
      /cannot suppress "snapshto"/,
    );
  });

  it('is a no-op for an empty suppress list', () => {
    const bundle = [toolbarItem('a')];
    expect(suppressContributions(bundle, [])).toEqual(bundle);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/chrome/merge.test.ts`
Expected: FAIL — `Failed to resolve import "./merge"`.

- [ ] **Step 3: Write the implementation**

```ts
import type { TrialContribution } from './types';

/**
 * Concatenate contribution bundles into one list, preserving order — order
 * decides how a region lays its contributions out, so it is part of the
 * result, not an accident of it.
 *
 * Throws on a duplicate id rather than dropping one: a contribution silently
 * losing to a later bundle is the failure a registry exists to prevent.
 */
export function mergeContributions(
  ...bundles: readonly TrialContribution[][]
): TrialContribution[] {
  const out: TrialContribution[] = [];
  const seen = new Set<string>();
  for (const bundle of bundles) {
    for (const entry of bundle) {
      if (seen.has(entry.id)) {
        throw new Error(
          `[labkit] mergeContributions: duplicate contribution id "${entry.id}". `
            + 'Two bundles registered the same id; rename one, or suppress the '
            + 'built-in before adding yours.',
        );
      }
      seen.add(entry.id);
      out.push(entry);
    }
  }
  return out;
}

/**
 * Drop contributions by id. Throws when an id is not present: a typo that
 * silently suppresses nothing is the same class of bug as a duplicate id
 * silently winning.
 */
export function suppressContributions(
  bundle: readonly TrialContribution[],
  ids: readonly string[],
): TrialContribution[] {
  const present = new Set(bundle.map((c) => c.id));
  for (const id of ids) {
    if (!present.has(id)) {
      throw new Error(
        `[labkit] cannot suppress "${id}": no contribution with that id. `
          + `Present ids: ${[...present].join(', ')}`,
      );
    }
  }
  const drop = new Set(ids);
  return bundle.filter((c) => !drop.has(c.id));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/chrome/merge.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/chrome/merge.ts packages/labkit/src/chrome/merge.test.ts
git commit -m "merge contribution bundles, refusing a duplicate id"
```

---

### Task 3: Built-in contributions

The derivation that replaces `detectCapabilities` and the six inline `instrument.canvas != null` checks. Pure: instrument + context in, contributions out.

Zoom goes to `viewport`, not `toolbar` — that is the region split the spec makes. Snapshot loses its pinned leading position by being an ordinary member of the `trial` group.

**Files:**
- Create: `packages/labkit/src/chrome/builtins.tsx`
- Test: `packages/labkit/src/chrome/builtins.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { builtinContributions } from './builtins';
import type { TrialChromeContext } from './types';
import type { Instrument } from '../instrument/types';

const ctx: TrialChromeContext = {
  trialId: 't1',
  instrumentName: 'Stub',
  isLastTrial: false,
  zoom: 1,
  setZoom: () => {},
  canUndo: true,
  canRedo: false,
  undo: () => {},
  redo: () => {},
  configFields: [],
  config: {},
  setConfig: () => {},
  savedSnapshots: [],
  saveSnapshot: () => {},
  loadSnapshot: () => {},
  clone: () => {},
  reset: () => {},
  close: () => {},
  activeToolId: null,
  setActiveTool: () => {},
};

const bare: Instrument = {
  name: 'Stub',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

function ids(instrument: Instrument, c: TrialChromeContext = ctx): string[] {
  return builtinContributions(instrument, c).map((x) => x.id);
}

describe('builtinContributions', () => {
  it('always contributes the trial actions', () => {
    expect(ids(bare)).toEqual(['snapshot', 'clone', 'reset', 'close']);
  });

  it('contributes undo and redo only when the instrument declares undo', () => {
    expect(ids(bare)).not.toContain('undo');
    expect(ids({ ...bare, undo: {} })).toContain('undo');
    expect(ids({ ...bare, undo: {} })).toContain('redo');
  });

  it('puts zoom controls in the viewport region, not the toolbar', () => {
    const withCanvas: Instrument = { ...bare, canvas: { layers: [] } };
    const zoomIn = builtinContributions(withCanvas, ctx).find((c) => c.id === 'zoom-in');
    expect(zoomIn?.region).toBe('viewport');
  });

  it('contributes no viewport controls when the view is not 2D', () => {
    const withCanvas: Instrument = { ...bare, canvas: { layers: [] } };
    const orbit = { ...ctx, zoom: null };
    expect(ids(withCanvas, orbit)).not.toContain('zoom-in');
  });

  it('contributes a settings section only when the schema has fields', () => {
    expect(ids(bare)).not.toContain('settings');
    const withFields = {
      ...ctx,
      configFields: [{ key: 'n', label: 'N', type: 'number' as const, default: 1 }],
    };
    expect(ids(bare, withFields)).toContain('settings');
  });

  it('reflects undo availability in the item, not by omitting it', () => {
    const withUndo: Instrument = { ...bare, undo: {} };
    const list = builtinContributions(withUndo, { ...ctx, canUndo: false });
    const undo = list.find((c) => c.id === 'undo');
    expect(undo?.item).toMatchObject({ disabled: true });
  });

  it('marks close as danger and disables it on the last trial', () => {
    const list = builtinContributions(bare, { ...ctx, isLastTrial: true });
    expect(list.find((c) => c.id === 'close')?.item).toMatchObject({
      danger: true,
      disabled: true,
    });
  });

  it('produces no duplicate ids for a fully-declared instrument', () => {
    const full: Instrument = {
      ...bare,
      undo: {},
      canvas: { layers: [] },
      layers: { ids: ['a'] },
    };
    const list = builtinContributions(full, ctx);
    expect(new Set(list.map((c) => c.id)).size).toBe(list.length);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/chrome/builtins.test.ts`
Expected: FAIL — `Failed to resolve import "./builtins"`.

- [ ] **Step 3: Write the implementation**

```tsx
import {
  CloneIcon,
  CloseIcon,
  FitIcon,
  RedoIcon,
  ResetIcon,
  SnapshotIcon,
  UndoIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@weasel-js/ui';
import { ControlPanel } from '../controls/ControlPanel';
import type { Instrument } from '../instrument/types';
import type { TrialChromeContext, TrialContribution } from './types';

const ZOOM_STEP = 1.25;

/**
 * The contributions a trial gets from what its instrument declared. This is
 * the whole "declaring a capability provides the chrome" rule — it replaces
 * the presence checks that used to be spread across the runtime.
 */
export function builtinContributions(
  instrument: Instrument,
  ctx: TrialChromeContext,
): TrialContribution[] {
  const out: TrialContribution[] = [];
  const zoom = ctx.zoom;

  if (instrument.undo != null) {
    out.push({
      id: 'undo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: UndoIcon,
        label: 'Undo',
        shortcut: 'Mod+Z',
        disabled: !ctx.canUndo,
        onActivate: ctx.undo,
      },
    });
    out.push({
      id: 'redo',
      region: 'toolbar',
      group: 'history',
      item: {
        icon: RedoIcon,
        label: 'Redo',
        shortcut: 'Mod+Shift+Z',
        disabled: !ctx.canRedo,
        onActivate: ctx.redo,
      },
    });
  }

  // Zoom acts on the view of the trial, so it is a viewport control. A trial
  // holding a non-2D view reports zoom as null and gets none of this.
  if (instrument.canvas != null && zoom !== null) {
    out.push({
      id: 'zoom-out',
      region: 'viewport',
      group: 'zoom',
      item: {
        icon: ZoomOutIcon,
        label: 'Zoom out',
        onActivate: () => ctx.setZoom(zoom / ZOOM_STEP),
      },
    });
    out.push({
      id: 'zoom-in',
      region: 'viewport',
      group: 'zoom',
      item: {
        icon: ZoomInIcon,
        label: 'Zoom in',
        onActivate: () => ctx.setZoom(zoom * ZOOM_STEP),
      },
    });
    out.push({
      id: 'actual-size',
      region: 'viewport',
      group: 'zoom',
      item: { icon: FitIcon, label: 'Actual size', onActivate: () => ctx.setZoom(1) },
    });
    out.push({
      id: 'zoom-readout',
      region: 'status',
      item: { text: `${Math.round(zoom * 100)}%`, title: 'Zoom' },
    });
  }

  if (ctx.configFields.length > 0) {
    out.push({
      id: 'settings',
      region: 'sidebar',
      item: {
        title: 'Settings',
        body: (
          <ControlPanel
            fields={ctx.configFields}
            config={ctx.config as Record<string, unknown>}
            setConfig={(key, value) => ctx.setConfig(String(key), value)}
          />
        ),
      },
    });
  }

  out.push({
    id: 'snapshot',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: {
      icon: SnapshotIcon,
      label: 'Save snapshot',
      shortcut: 'Mod+S',
      onActivate: () => ctx.saveSnapshot(),
    },
  });
  out.push({
    id: 'clone',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: { icon: CloneIcon, label: 'Clone trial', onActivate: ctx.clone },
  });
  out.push({
    id: 'reset',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: { icon: ResetIcon, label: 'Reset trial', onActivate: ctx.reset },
  });
  out.push({
    id: 'close',
    region: 'toolbar',
    group: 'trial',
    end: true,
    item: {
      icon: CloseIcon,
      label: ctx.isLastTrial ? 'Cannot close the last trial' : 'Close trial',
      danger: true,
      disabled: ctx.isLastTrial,
      onActivate: ctx.close,
    },
  });

  return out;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/chrome/builtins.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/chrome/builtins.tsx packages/labkit/src/chrome/builtins.test.ts
git commit -m "derive a trial's built-in chrome from its declared capabilities"
```

---

### Task 4: The toolbar region

**Files:**
- Create: `packages/labkit/src/chrome/regions/ToolbarRegion.tsx`
- Test: `packages/labkit/src/chrome/regions/ToolbarRegion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ToolbarRegion } from './ToolbarRegion';
import type { TrialChromeContext, TrialContribution } from '../types';

const Glyph = () => <svg data-testid="glyph" />;

const ctx = { trialId: 't1' } as unknown as TrialChromeContext;

function item(id: string, over: Partial<TrialContribution> = {}): TrialContribution {
  return {
    id,
    region: 'toolbar',
    item: { icon: Glyph, label: id, onActivate: () => {} },
    ...over,
  } as TrialContribution;
}

describe('ToolbarRegion', () => {
  it('renders nothing when it has no contributions', () => {
    const { container } = render(<ToolbarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders one button per contribution, labelled', () => {
    render(<ToolbarRegion contributions={[item('undo'), item('redo')]} ctx={ctx} />);
    expect(screen.getByRole('button', { name: 'undo' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'redo' })).toBeInTheDocument();
  });

  it('fires onActivate on click', async () => {
    const onActivate = vi.fn();
    render(
      <ToolbarRegion
        contributions={[
          { id: 'go', region: 'toolbar', item: { icon: Glyph, label: 'Go', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Go' }).click();
    expect(onActivate).toHaveBeenCalledOnce();
  });

  it('groups contributions sharing a group into one group element', () => {
    render(
      <ToolbarRegion
        contributions={[
          item('undo', { group: 'history' }),
          item('redo', { group: 'history' }),
          item('close', { group: 'trial' }),
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.getAllByRole('group')).toHaveLength(2);
  });

  it('renders a render-escape contribution verbatim', () => {
    render(
      <ToolbarRegion
        contributions={[
          { id: 'custom', region: 'toolbar', render: () => <b>custom</b> },
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('custom')).toBeInTheDocument();
  });

  it('disables a button whose item says so', () => {
    render(
      <ToolbarRegion
        contributions={[item('undo', { item: { icon: Glyph, label: 'Undo', disabled: true, onActivate: () => {} } })]}
        ctx={ctx}
      />,
    );
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/ToolbarRegion.test.tsx`
Expected: FAIL — `Failed to resolve import "./ToolbarRegion"`.

- [ ] **Step 3: Write the implementation**

```tsx
import type { ReactNode } from 'react';
import { Toolbar } from '../../primitives/Toolbar';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<ToolbarRegion>`. */
export interface ToolbarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

interface Group {
  key: string;
  end: boolean;
  entries: TrialContribution[];
}

/** Bucket by group, preserving first-appearance order. Ungrouped
 *  contributions each become their own bucket so they stay in place. */
function groupsOf(contributions: readonly TrialContribution[]): Group[] {
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();
  for (const c of contributions) {
    if (c.group == null) {
      groups.push({ key: c.id, end: c.end ?? false, entries: [c] });
      continue;
    }
    let g = byKey.get(c.group);
    if (!g) {
      g = { key: c.group, end: c.end ?? false, entries: [] };
      byKey.set(c.group, g);
      groups.push(g);
    }
    g.entries.push(c);
  }
  return groups;
}

function renderEntry(c: TrialContribution, ctx: TrialChromeContext): ReactNode {
  if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
  if (c.region !== 'toolbar' || !c.item) return null;
  const { icon: Icon, label, shortcut, disabled, danger, showLabel } = c.item;
  return (
    <Toolbar.Button
      key={c.id}
      iconOnly={!showLabel}
      variant={danger ? 'danger' : 'default'}
      disabled={disabled}
      aria-label={label}
      title={shortcut ? `${label} (${shortcut})` : label}
      onClick={c.item.onActivate}
    >
      <Icon size={16} />
      {showLabel ? <span>{label}</span> : null}
    </Toolbar.Button>
  );
}

/** Lays a trial's `toolbar` contributions out, grouped by their `group`. */
export function ToolbarRegion({ contributions, ctx }: ToolbarRegionProps) {
  if (contributions.length === 0) return null;
  const groups = groupsOf(contributions);
  return (
    <Toolbar>
      {groups.map((g) => (
        <Toolbar.Group key={g.key} end={g.end} aria-label={g.key}>
          {g.entries.map((c) => renderEntry(c, ctx))}
        </Toolbar.Group>
      ))}
    </Toolbar>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/ToolbarRegion.test.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/chrome/regions/ToolbarRegion.tsx packages/labkit/src/chrome/regions/ToolbarRegion.test.tsx
git commit -m "lay out a trial's toolbar contributions"
```

---

### Task 5: The sidebar, status and viewport regions

Three region renderers, one commit — each is small and they share the escape-hatch shape established in Task 4.

**Files:**
- Create: `packages/labkit/src/chrome/regions/SidebarRegion.tsx`
- Create: `packages/labkit/src/chrome/regions/StatusRegion.tsx`
- Create: `packages/labkit/src/chrome/regions/ViewportRegion.tsx`
- Create: `packages/labkit/src/chrome/regions/ViewportRegion.less`
- Test: `packages/labkit/src/chrome/regions/regions.test.tsx`
- Modify: `packages/labkit/src/styles.less`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SidebarRegion } from './SidebarRegion';
import { StatusRegion } from './StatusRegion';
import { ViewportRegion } from './ViewportRegion';
import type { TrialChromeContext, TrialContribution } from '../types';

const Glyph = () => <svg />;
const ctx = { trialId: 't1' } as unknown as TrialChromeContext;

describe('SidebarRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<SidebarRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each section with its title and body', () => {
    const contributions: TrialContribution[] = [
      { id: 'settings', region: 'sidebar', item: { title: 'Settings', body: <p>fields</p> } },
      { id: 'layers', region: 'sidebar', item: { title: 'Layers', body: <p>list</p> } },
    ];
    render(<SidebarRegion contributions={contributions} ctx={ctx} />);
    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('fields')).toBeInTheDocument();
    expect(screen.getByText('Layers')).toBeInTheDocument();
  });

  it('starts a section collapsed when it asks to', () => {
    render(
      <SidebarRegion
        contributions={[
          {
            id: 's',
            region: 'sidebar',
            item: { title: 'S', defaultCollapsed: true, body: <p>hidden</p> },
          },
        ]}
        ctx={ctx}
      />,
    );
    expect(screen.queryByText('hidden')).not.toBeInTheDocument();
  });
});

describe('StatusRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<StatusRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders each readout as text', () => {
    render(
      <StatusRegion
        contributions={[{ id: 'zoom', region: 'status', item: { text: '150%' } }]}
        ctx={ctx}
      />,
    );
    expect(screen.getByText('150%')).toBeInTheDocument();
  });
});

describe('ViewportRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<ViewportRegion contributions={[]} ctx={ctx} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('fires a control on click', () => {
    const onActivate = vi.fn();
    render(
      <ViewportRegion
        contributions={[
          { id: 'fit', region: 'viewport', item: { icon: Glyph, label: 'Fit', onActivate } },
        ]}
        ctx={ctx}
      />,
    );
    screen.getByRole('button', { name: 'Fit' }).click();
    expect(onActivate).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/regions.test.tsx`
Expected: FAIL — unresolved imports for the three region modules.

- [ ] **Step 3: Write `SidebarRegion.tsx`**

```tsx
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<SidebarRegion>`. */
export interface SidebarRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

function Section({ title, defaultCollapsed, children }: {
  title: string;
  defaultCollapsed: boolean;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  return (
    <section className="lk-sidebar-section">
      <button
        type="button"
        className="lk-sidebar-section__head"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((c) => !c)}
      >
        {title}
      </button>
      {collapsed ? null : <div className="lk-sidebar-section__body">{children}</div>}
    </section>
  );
}

/** Lays a trial's `sidebar` contributions out as titled, collapsible sections. */
export function SidebarRegion({ contributions, ctx }: SidebarRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <>
      {contributions.map((c) => {
        if (c.render) return <div key={c.id}>{c.render(ctx)}</div>;
        if (c.region !== 'sidebar' || !c.item) return null;
        return (
          <Section
            key={c.id}
            title={c.item.title}
            defaultCollapsed={c.item.defaultCollapsed ?? false}
          >
            {c.item.body}
          </Section>
        );
      })}
    </>
  );
}
```

- [ ] **Step 4: Write `StatusRegion.tsx`**

```tsx
import { StatusBar } from '../../primitives/StatusBar';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<StatusRegion>`. */
export interface StatusRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/** Lays a trial's `status` contributions out as readouts. */
export function StatusRegion({ contributions, ctx }: StatusRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <StatusBar>
      {contributions.map((c) => {
        if (c.render) return <StatusBar.Section key={c.id}>{c.render(ctx)}</StatusBar.Section>;
        if (c.region !== 'status' || !c.item) return null;
        return (
          <StatusBar.Section key={c.id}>
            <span title={c.item.title}>{c.item.text}</span>
          </StatusBar.Section>
        );
      })}
    </StatusBar>
  );
}
```

- [ ] **Step 5: Write `ViewportRegion.tsx`**

```tsx
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<ViewportRegion>`. */
export interface ViewportRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/**
 * Controls acting on the view of a trial. Anchored inside the content well
 * rather than in the toolbar, which acts on the trial itself.
 */
export function ViewportRegion({ contributions, ctx }: ViewportRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <div className="lk-viewport-controls" role="group" aria-label="View">
      {contributions.map((c) => {
        if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
        if (c.region !== 'viewport' || !c.item) return null;
        const { icon: Icon, label, disabled } = c.item;
        return (
          <button
            key={c.id}
            type="button"
            className="lk-viewport-controls__button"
            aria-label={label}
            title={label}
            disabled={disabled}
            onClick={c.item.onActivate}
          >
            <Icon size={16} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 6: Write `ViewportRegion.less`**

`--wzl-control-h` is deliberately not overridden here: the viewport controls are not in the 22px toolbar and should sit at the theme's normal control height.

```less
.lk-viewport-controls {
  position: absolute;
  right: var(--wzl-space-sm);
  bottom: var(--wzl-space-sm);
  z-index: var(--wzl-z-overlay);
  display: flex;
  gap: var(--wzl-space-xs);
  padding: var(--wzl-space-xs);
  border: var(--wzl-border-w) solid var(--wzl-border);
  border-radius: var(--wzl-radius-md);
  background: var(--wzl-surface-raised);
  backdrop-filter: blur(var(--wzl-glass-blur));
}

.lk-viewport-controls__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--wzl-control-h);
  height: var(--wzl-control-h);
  padding: 0;
  border: 0;
  border-radius: var(--wzl-radius-sm);
  background: transparent;
  color: var(--wzl-fg-muted);
  cursor: pointer;

  &:hover:not(:disabled) {
    background: var(--wzl-surface-hover);
    color: var(--wzl-fg);
  }

  &:disabled {
    opacity: 0.4;
    cursor: default;
  }
}
```

Add the sidebar-section rules to `packages/labkit/src/primitives/Sidebar.less`:

```less
.lk-sidebar-section {
  border-bottom: var(--wzl-border-w) solid var(--wzl-line-subtle);
}

.lk-sidebar-section__head {
  width: 100%;
  padding: var(--wzl-space-xs) var(--wzl-space-sm);
  border: 0;
  background: transparent;
  color: var(--wzl-fg-muted);
  font-family: var(--wzl-font-display);
  font-size: var(--wzl-font-size-sm);
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
  cursor: pointer;

  &:hover {
    color: var(--wzl-fg);
  }
}

.lk-sidebar-section__body {
  padding: 0 var(--wzl-space-sm) var(--wzl-space-sm);
}
```

- [ ] **Step 7: Import the new stylesheet**

In `packages/labkit/src/styles.less`, add alongside the other imports:

```less
@import './chrome/regions/ViewportRegion.less';
```

- [ ] **Step 8: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/regions.test.tsx`
Expected: PASS, 7 tests.

- [ ] **Step 9: Check the class prefix rule**

Run: `cd packages/labkit && npx tsx scripts/check-class-prefix.ts`
Expected: PASS — every new class starts `lk-`.

- [ ] **Step 10: Commit**

```bash
git add packages/labkit/src/chrome/regions packages/labkit/src/styles.less packages/labkit/src/primitives/Sidebar.less
git commit -m "lay out a trial's sidebar, status and viewport contributions"
```

---

### Task 6: The tool slot

Two slots — the lab's and the trial's — with the trial resolving `activeToolId ?? lab.activeToolId`.

**Files:**
- Create: `packages/labkit/src/tools/types.ts`
- Modify: `packages/labkit/src/state/types.ts`
- Modify: `packages/labkit/src/state/store.ts`
- Modify: `packages/labkit/src/instrument/types.ts`
- Modify: `packages/labkit/src/trial/TrialChrome.tsx`
- Modify: `packages/labkit/src/trial/Trial.tsx`
- Test: `packages/labkit/src/state/toolSlot.test.ts`

- [ ] **Step 1: Write `packages/labkit/src/tools/types.ts`**

```ts
import type { IconComponent } from '../chrome/types';

/**
 * A tool a trial can be in. labkit's own — core's `ToolsApi` carries hotkey
 * slots, ambient tools, eligibility tiers and canvas overlay layers, all bound
 * to the gesture dispatcher, and a labkit instrument is an arbitrary canvas or
 * DOM tree rather than a weasel scene.
 */
export interface TrialTool {
  id: string;
  label: string;
  icon: IconComponent;
  /** Shown in the tooltip. Not bound here — the instrument owns its keymap. */
  shortcut?: string;
  /** Presentation grouping in the palette. Ungrouped tools sort after grouped. */
  group?: string;
}

/** What an instrument declares to get a palette region. */
export interface ToolCapability {
  tools: TrialTool[];
  /** Which tool a fresh trial starts in. Defaults to the first. */
  initial?: string;
}
```

- [ ] **Step 2: Write the failing test**

```ts
import { describe, expect, it } from 'vitest';
import { createLabStore } from './store';

function store() {
  return createLabStore({ instruments: [] });
}

describe('the tool slot', () => {
  it('starts empty at both levels', () => {
    const s = store();
    expect(s.getState().activeToolId).toBeNull();
  });

  it('sets the lab slot', () => {
    const s = store();
    s.getState().setLabTool('brush');
    expect(s.getState().activeToolId).toBe('brush');
  });

  it('sets a trial slot without touching the lab one', () => {
    const s = store();
    s.getState().addTrial({
      id: 't1', instrumentName: 'X', config: {}, state: {}, view: {},
    });
    s.getState().setLabTool('brush');
    s.getState().setTrialTool('t1', 'eraser');
    expect(s.getState().activeToolId).toBe('brush');
    expect(s.getState().trials[0].activeToolId).toBe('eraser');
  });

  it('leaves a trial slot undefined until it is set', () => {
    const s = store();
    s.getState().addTrial({
      id: 't1', instrumentName: 'X', config: {}, state: {}, view: {},
    });
    expect(s.getState().trials[0].activeToolId).toBeUndefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/state/toolSlot.test.ts`
Expected: FAIL — `setLabTool is not a function`.

- [ ] **Step 4: Add the state**

In `packages/labkit/src/state/types.ts`:

```ts
// on TrialRecord, after `view`:
/** This trial's own tool slot. Undefined means it reads the lab's. */
activeToolId?: string | null;

// on LabStoreState, after `mode`:
/** The lab's tool slot — what a trial with no slot of its own resolves to. */
activeToolId: string | null;
```

In `packages/labkit/src/state/store.ts`, add to `LabStoreActions`:

```ts
setLabTool: (id: string | null) => void;
setTrialTool: (trialId: string, id: string | null) => void;
```

and to the store body, alongside `setMode`:

```ts
setLabTool: (id) => set({ activeToolId: id }),
setTrialTool: (trialId, id) =>
  set((s) => ({
    trials: s.trials.map((t) => (t.id === trialId ? { ...t, activeToolId: id } : t)),
  })),
```

Seed `activeToolId: null` in the initial state next to `mode`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/state/toolSlot.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Resolve the slot in `TrialChrome`**

Add these bindings to `TrialChrome`; Task 7 consumes them when it rewrites the body.

Replace the Task 6 placeholders:

```tsx
const labToolId = useStore(storeCtx.store, (s) => s.activeToolId);
const setTrialTool = useStore(storeCtx.store, (s) => s.setTrialTool);
const setLabTool = useStore(storeCtx.store, (s) => s.setLabTool);

// A trial gets its own slot when its instrument declares tools; otherwise it
// reads the lab's. Which slot a change writes follows from the same thing.
const declaresTools = instrument.tools != null;
const resolvedToolId = declaresTools
  ? (record.activeToolId ?? instrument.tools?.initial ?? instrument.tools?.tools[0]?.id ?? null)
  : labToolId;
const setActiveTool = useCallback(
  (id: string) => {
    if (declaresTools) setTrialTool(trialId, id);
    else setLabTool(id);
  },
  [declaresTools, setTrialTool, setLabTool, trialId],
);
```

Add to `Instrument` in `packages/labkit/src/instrument/types.ts`:

```ts
/** Tools this instrument offers. Declaring them gives the trial a palette
 *  region and its own tool slot. */
tools?: ToolCapability;
```

Expose the resolved tool to the instrument by adding to `RenderContext.trial` in the same file:

```ts
/** Resolved active tool: this trial's slot, or the lab's. Null when neither
 *  holds one. */
activeToolId: string | null;
```

and populate it in `packages/labkit/src/trial/Trial.tsx` where `renderCtx` is built.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/labkit/src/tools packages/labkit/src/state packages/labkit/src/instrument/types.ts packages/labkit/src/trial
git commit -m "give a lab and a trial each a tool slot"
```

---

### Task 7: Render TrialChrome from contributions

The switchover. `TrialChrome` stops hand-writing regions and builds one context, assembles contributions, and hands each region its slice. The three slot contexts, the three `Default*` components, `sidebarExtras` and `capabilityDetector` all go.

**Files:**
- Modify: `packages/labkit/src/trial/TrialChrome.tsx`
- Modify: `packages/labkit/src/trial/Trial.tsx`
- Modify: `packages/labkit/src/trial/index.ts`
- Modify: `packages/labkit/src/instrument/index.ts`
- Modify: `packages/labkit/src/index.ts`
- Delete: `packages/labkit/src/trial/slotTypes.ts`, `packages/labkit/src/trial/DefaultToolbar.tsx`, `packages/labkit/src/trial/DefaultSidebar.tsx`, `packages/labkit/src/trial/DefaultStatusBar.tsx`, `packages/labkit/src/instrument/capabilityDetector.ts`, `packages/labkit/src/instrument/capabilityDetector.test.ts`
- Test: `packages/labkit/src/trial/TrialChrome.test.tsx` (existing — update)

- [ ] **Step 1: Write the failing test**

Add to `packages/labkit/src/trial/TrialChrome.test.tsx`. It renders a `<Lab>` with an instrument declaring `undo` and `canvas` and asserts the regions land where the spec says.

```tsx
it('puts zoom in the viewport region and not in the toolbar', () => {
  renderLabWith({ ...bare, canvas: { layers: [] }, undo: {} });
  const toolbar = document.querySelector('.lk-trial__toolbar') as HTMLElement;
  const viewport = document.querySelector('.lk-viewport-controls') as HTMLElement;
  expect(within(viewport).getByRole('button', { name: 'Zoom in' })).toBeInTheDocument();
  expect(within(toolbar).queryByRole('button', { name: 'Zoom in' })).toBeNull();
});

it('renders no undo group for an instrument that does not declare undo', () => {
  renderLabWith({ ...bare, canvas: { layers: [] } });
  expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
});

it('renders no viewport region for an instrument with no canvas', () => {
  renderLabWith(bare);
  expect(document.querySelector('.lk-viewport-controls')).toBeNull();
});
```

Add the helper at the top of the file, next to the existing setup:

```tsx
import { within } from '@testing-library/react';

const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

function renderLabWith(instrument: Instrument) {
  return render(<Lab title="T" instruments={[instrument]} />);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/trial/TrialChrome.test.tsx`
Expected: FAIL — zoom is still in the toolbar, `.lk-viewport-controls` does not exist.

- [ ] **Step 3: Rewrite `TrialChrome.tsx`**

Replace `TrialChromeProps` and the component body. Keep the existing imports for `useLabContext`, `LabStoreContext`, `useStore`, `as2DView`, `JobProgress`, `TrialTitleBar`.

```tsx
/** Props for `<TrialChrome>`. */
export interface TrialChromeProps {
  trialId: string;
  record: TrialRecord;
  instrument: Instrument;
  isLastTrial: boolean;
  undoBindings?: UndoBindings;
  /** Supplied when the instrument declares a `job`. */
  job?: JobHandle;
  /** Contributions the trial runtime itself adds — the drag palette and the
   *  layer list, which depend on runtime state the instrument cannot reach. */
  trialChrome?: readonly TrialContribution[];
  /** Contributions from the lab, merged last. */
  chrome?: readonly TrialContribution[];
  /** Built-in contribution ids to drop. Throws on an id that is not there. */
  suppress?: readonly string[];
  children: ReactNode;
}
```

Body, replacing the three `useMemo` slot contexts and the JSX:

```tsx
const view2d = as2DView(record.view);

const ctx = useMemo<TrialChromeContext>(() => {
  const setZoom = (z: number): void => {
    if (!view2d) return;
    updateTrialView(trialId, { ...view2d, zoom: z });
  };
  return {
    trialId,
    instrumentName: record.instrumentName,
    isLastTrial,
    zoom: view2d ? view2d.zoom : null,
    setZoom,
    canUndo: undoBindings?.canUndo ?? false,
    canRedo: undoBindings?.canRedo ?? false,
    undo: undoBindings?.undo ?? (() => {}),
    redo: undoBindings?.redo ?? (() => {}),
    configFields: instrument.configSchema?.() ?? [],
    config: record.config,
    setConfig: (key, value) => {
      const prevConfig = record.config as Record<string, unknown>;
      if (process.env.NODE_ENV !== 'production' && !(key in prevConfig)) {
        console.warn(
          `[labkit] setConfig: unknown key "${key}" for instrument "${record.instrumentName}"`,
        );
      }
      updateTrialConfig(trialId, key as never, value as never);
      if (instrument.onConfigChange) {
        const nextConfig = { ...prevConfig, [key]: value };
        const nextState = instrument.onConfigChange(nextConfig, prevConfig, record.state);
        updateTrialState(trialId, nextState as never);
      }
    },
    savedSnapshots: lab.savedSnapshots.filter((s) => s.trialId === trialId),
    saveSnapshot: (name) => lab.saveSnapshot(trialId, name),
    loadSnapshot: (snapshotId) => lab.loadSnapshot(trialId, snapshotId),
    clone: () => lab.cloneTrial(trialId),
    reset: () => lab.resetTrial(trialId),
    close: () => lab.closeTrial(trialId),
    activeToolId: resolvedToolId,
    setActiveTool,
  };
}, [
  trialId, record, instrument, lab, isLastTrial, updateTrialView, updateTrialConfig,
  updateTrialState, undoBindings, view2d, resolvedToolId, setActiveTool,
]);

const contributions = useMemo(
  () =>
    suppressContributions(
      mergeContributions(
        builtinContributions(instrument, ctx),
        [...(instrument.chrome ?? [])],
        [...(trialChrome ?? [])],
        [...(chrome ?? [])],
      ),
      suppress ?? [],
    ),
  [instrument, ctx, trialChrome, chrome, suppress],
);

const inRegion = (region: TrialRegion) => contributions.filter((c) => c.region === region);
```

`resolvedToolId` and `setActiveTool` are the bindings Task 6 added to this file.

JSX:

```tsx
return (
  <section
    className="lk-trial"
    aria-label={`Trial ${record.instrumentName}`}
    tabIndex={-1}
    onKeyDown={handleKeyDown}
  >
    <TrialTitleBar title={record.instrumentName} />
    <div className="lk-trial__toolbar">
      <ToolbarRegion contributions={inRegion('toolbar')} ctx={ctx} />
    </div>
    <div className="lk-trial__body">
      <PaletteRegion contributions={inRegion('palette')} ctx={ctx} />
      <div className="lk-trial__sidebar">
        <SidebarRegion contributions={inRegion('sidebar')} ctx={ctx} />
      </div>
      <div
        className={`lk-trial__content${instrument.canvas ? ' lk-trial__content--flush' : ''}`}
      >
        {children}
        <ViewportRegion contributions={inRegion('viewport')} ctx={ctx} />
      </div>
    </div>
    <div className="lk-trial__status">
      {job ? <JobProgress job={job} /> : null}
      <StatusRegion contributions={inRegion('status')} ctx={ctx} />
    </div>
  </section>
);
```

`handleKeyDown` keeps its shape but reads from `ctx` instead of `toolbarCtx`:

```tsx
const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
  const mod = e.metaKey || e.ctrlKey;
  if (!mod) return;
  if (e.key === 'z' || e.key === 'Z') {
    e.preventDefault();
    if (e.shiftKey) ctx.redo();
    else ctx.undo();
  } else if (e.key === 's' || e.key === 'S') {
    e.preventDefault();
    ctx.saveSnapshot();
  }
};
```

`.lk-trial__content` must become a positioning context for the viewport region. In `packages/labkit/src/trial/Trial.less`, add to `&__content`:

```less
position: relative;
```

- [ ] **Step 4: Move the palette and layer list off `sidebarExtras`**

`Trial.tsx` already builds `paletteNode` and `layerListNode` and passes them as
`sidebarExtras`. Keep both expressions exactly as they are and re-home them as
contributions. Replace the `sidebarExtras={...}` prop on `<TrialChrome>` with
`chrome={extraChrome}`, and add above the `return`:

```tsx
const extraChrome = useMemo<TrialContribution[]>(() => {
  const out: TrialContribution[] = [];
  if (paletteNode) {
    out.push({
      id: 'dragdrop-palette',
      region: 'sidebar',
      item: { title: 'Parts', body: paletteNode },
    });
  }
  if (layerListNode) {
    out.push({
      id: 'layer-list',
      region: 'sidebar',
      item: { title: 'Layers', body: layerListNode },
    });
  }
  return out;
}, [paletteNode, layerListNode]);
```

`paletteNode` and `layerListNode` are already null when their capability is
absent, so the presence checks stay where they are and no new capability test is
introduced. Import `TrialContribution` from `../chrome/types`.

A trial receives contributions from two places now — its own (`extraChrome`) and
the lab's. `TrialChrome` merges them in that order, so `Trial.tsx` passes its own
through a second prop rather than concatenating: add `trialChrome` to
`TrialChromeProps` alongside `chrome`, and merge
`builtins, instrument.chrome, trialChrome, chrome`.

- [ ] **Step 5: Delete the replaced modules**

```bash
git rm packages/labkit/src/trial/slotTypes.ts \
       packages/labkit/src/trial/DefaultToolbar.tsx \
       packages/labkit/src/trial/DefaultSidebar.tsx \
       packages/labkit/src/trial/DefaultStatusBar.tsx \
       packages/labkit/src/instrument/capabilityDetector.ts \
       packages/labkit/src/instrument/capabilityDetector.test.ts
```

Then remove their exports:
- `packages/labkit/src/trial/index.ts` — drop `DefaultSidebar`, `DefaultStatusBar`, `DefaultToolbar`, their `*Props`, and the six slot types.
- `packages/labkit/src/instrument/index.ts` — drop `detectCapabilities` and `CapabilityFlags`.
- `packages/labkit/src/index.ts` — drop `detectCapabilities` (line ~25) and `CapabilityFlags` (line ~25), and add the chrome barrel: `export * from './chrome';`

- [ ] **Step 6: Run the labkit suite**

Run: `cd packages/labkit && npx vitest run`
Expected: PASS. Tests referencing the deleted `Default*` components or slot props will fail first — update them to assert on rendered output rather than on which component rendered it.

- [ ] **Step 7: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS from the repo root.

- [ ] **Step 8: Commit**

```bash
git add -A packages/labkit
git commit -m "render a trial's chrome from its contributions"
```

---

### Task 8: The `chrome` and `suppress` surface on `<Lab>`

**Files:**
- Modify: `packages/labkit/src/lab/Lab.tsx`
- Modify: `packages/labkit/src/instrument/types.ts`
- Test: `packages/labkit/src/lab/Lab.chrome.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lab } from './Lab';
import type { Instrument } from '../instrument/types';
import type { TrialContribution } from '../chrome/types';

const Glyph = () => <svg />;
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};

describe('<Lab> chrome', () => {
  it('renders a consumer contribution', () => {
    const extra: TrialContribution = {
      id: 'export',
      region: 'toolbar',
      item: { icon: Glyph, label: 'Export', onActivate: () => {} },
    };
    render(<Lab title="T" instruments={[bare]} chrome={[extra]} />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('suppresses a built-in by id', () => {
    render(<Lab title="T" instruments={[bare]} suppress={['snapshot']} />);
    expect(screen.queryByRole('button', { name: 'Save snapshot' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Clone trial' })).toBeInTheDocument();
  });

  it('throws when a consumer id collides with a built-in', () => {
    const clash: TrialContribution = {
      id: 'clone',
      region: 'toolbar',
      item: { icon: Glyph, label: 'Mine', onActivate: () => {} },
    };
    expect(() => render(<Lab title="T" instruments={[bare]} chrome={[clash]} />)).toThrow(
      /duplicate contribution id "clone"/,
    );
  });

  it('throws when suppressing an id that is not there', () => {
    expect(() => render(<Lab title="T" instruments={[bare]} suppress={['nope']} />)).toThrow(
      /cannot suppress "nope"/,
    );
  });

  it('renders an instrument-declared contribution', () => {
    const withChrome: Instrument = {
      ...bare,
      chrome: [
        { id: 'mine', region: 'status', item: { text: 'ready' } },
      ],
    };
    render(<Lab title="T" instruments={[withChrome]} />);
    expect(screen.getByText('ready')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/lab/Lab.chrome.test.tsx`
Expected: FAIL — `chrome` and `suppress` are not props on `LabProps`.

- [ ] **Step 3: Add the props**

In `packages/labkit/src/lab/Lab.tsx`, add to `LabProps`:

```ts
/** Contributions added to every trial's chrome, after the instrument's own. */
chrome?: readonly TrialContribution[];
/** Built-in contribution ids to drop. Throws on an id that is not there. */
suppress?: readonly string[];
```

and thread both through to each `<Trial>`, which passes them to `<TrialChrome>`.

In `packages/labkit/src/instrument/types.ts`, add to `Instrument`:

```ts
/** Chrome this instrument contributes beyond what its capabilities imply. */
chrome?: TrialContribution[];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/lab/Lab.chrome.test.tsx`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add packages/labkit/src/lab/Lab.tsx packages/labkit/src/instrument/types.ts packages/labkit/src/lab/Lab.chrome.test.tsx
git commit -m "let a lab and an instrument contribute chrome"
```

---

### Task 9: The palette region

**Files:**
- Create: `packages/labkit/src/chrome/regions/PaletteRegion.tsx`
- Create: `packages/labkit/src/chrome/regions/PaletteRegion.less`
- Modify: `packages/labkit/src/chrome/builtins.tsx`
- Modify: `packages/labkit/src/styles.less`
- Test: `packages/labkit/src/chrome/regions/PaletteRegion.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PaletteRegion } from './PaletteRegion';
import type { TrialChromeContext, TrialContribution } from '../types';

const Glyph = () => <svg />;

function ctxWith(activeToolId: string | null, setActiveTool = vi.fn()) {
  return { trialId: 't1', activeToolId, setActiveTool } as unknown as TrialChromeContext;
}

function tool(id: string): TrialContribution {
  return { id, region: 'palette', item: { icon: Glyph, label: id } };
}

describe('PaletteRegion', () => {
  it('renders nothing when empty', () => {
    const { container } = render(<PaletteRegion contributions={[]} ctx={ctxWith(null)} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('marks the resolved tool as current', () => {
    render(<PaletteRegion contributions={[tool('brush'), tool('eraser')]} ctx={ctxWith('brush')} />);
    expect(screen.getByRole('button', { name: 'brush' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('button', { name: 'eraser' })).not.toHaveAttribute('aria-current');
  });

  it('sets the tool on click', () => {
    const setActiveTool = vi.fn();
    render(
      <PaletteRegion contributions={[tool('brush')]} ctx={ctxWith(null, setActiveTool)} />,
    );
    screen.getByRole('button', { name: 'brush' }).click();
    expect(setActiveTool).toHaveBeenCalledWith('brush');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/PaletteRegion.test.tsx`
Expected: FAIL — `Failed to resolve import "./PaletteRegion"`.

- [ ] **Step 3: Write the implementation**

`ToolGroup` and `ToolButton` come through the passthrough. They are controlled and carry no `ToolsApi` dependency, which is why they are usable here when `ToolPalette` is not.

```tsx
import { ToolButton, ToolGroup } from '../../passthrough/weasel-ui';
import type { TrialChromeContext, TrialContribution } from '../types';

/** Props for `<PaletteRegion>`. */
export interface PaletteRegionProps {
  contributions: readonly TrialContribution[];
  ctx: TrialChromeContext;
}

/** A trial's tool strip. Selection lives in the trial's or the lab's tool
 *  slot; this region only reflects it. */
export function PaletteRegion({ contributions, ctx }: PaletteRegionProps) {
  if (contributions.length === 0) return null;
  return (
    <div className="lk-palette-region" role="toolbar" aria-label="Tools" aria-orientation="vertical">
      <ToolGroup orientation="vertical">
        {contributions.map((c) => {
          if (c.render) return <span key={c.id}>{c.render(ctx)}</span>;
          if (c.region !== 'palette' || !c.item) return null;
          const { icon: Icon, label, shortcut, disabled } = c.item;
          return (
            <ToolButton
              key={c.id}
              icon={<Icon size={16} />}
              label={label}
              shortcut={shortcut}
              active={ctx.activeToolId === c.id}
              disabled={disabled}
              onClick={() => ctx.setActiveTool(c.id)}
            />
          );
        })}
      </ToolGroup>
    </div>
  );
}
```

- [ ] **Step 4: Write `PaletteRegion.less`**

`@weasel-js/ui`'s `ToolButton` sizes itself from padding, and `theme/base.less`'s `:where()` element default would otherwise force it to `--wzl-control-h`. Unset it on this region — see the trap in the arc 2 handoff.

```less
.lk-palette-region {
  display: flex;
  flex-direction: column;
  padding: var(--wzl-space-xs);
  border-right: var(--wzl-border-w) solid var(--wzl-line-subtle);
  background: var(--wzl-surface-sunken);

  button {
    height: auto;
  }
}
```

- [ ] **Step 5: Contribute the tools**

In `packages/labkit/src/chrome/builtins.tsx`, after the undo block:

```tsx
for (const t of instrument.tools?.tools ?? []) {
  out.push({
    id: t.id,
    region: 'palette',
    group: t.group,
    item: { icon: t.icon, label: t.label, shortcut: t.shortcut },
  });
}
```

A tool id therefore shares the contribution namespace, so a tool called `close` collides with the built-in close button and throws. That is correct: they are both contributions to one trial's chrome.

- [ ] **Step 6: Import the stylesheet**

In `packages/labkit/src/styles.less`:

```less
@import './chrome/regions/PaletteRegion.less';
```

- [ ] **Step 7: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/chrome/regions/PaletteRegion.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 8: Commit**

```bash
git add packages/labkit/src/chrome packages/labkit/src/styles.less
git commit -m "give a trial a tool palette from what its instrument declares"
```

---

### Task 10: The lab's tool palette

The lab's tool slot is settable from Task 6 but nothing sets it through UI. A lab
that passes `tools` gets a palette beside its trials, and every trial whose
instrument declares no tools of its own reflects and writes that slot.

**Files:**
- Create: `packages/labkit/src/lab/LabPalette.tsx`
- Modify: `packages/labkit/src/lab/Lab.tsx`
- Modify: `packages/labkit/src/lab/LabShell.less`
- Test: `packages/labkit/src/lab/LabPalette.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Lab } from './Lab';
import type { Instrument } from '../instrument/types';

const Glyph = () => <svg />;
const bare: Instrument = {
  name: 'Bare',
  defaultConfig: () => ({}),
  initialState: () => ({}),
  render: () => null,
};
const tools = [
  { id: 'pick', label: 'Pick', icon: Glyph },
  { id: 'pan', label: 'Pan', icon: Glyph },
];

describe('the lab palette', () => {
  it('does not render when the lab declares no tools', () => {
    render(<Lab title="T" instruments={[bare]} />);
    expect(screen.queryByRole('toolbar', { name: 'Tools' })).toBeNull();
  });

  it('renders one button per declared tool', () => {
    render(<Lab title="T" instruments={[bare]} tools={tools} />);
    expect(screen.getByRole('button', { name: 'Pick' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pan' })).toBeInTheDocument();
  });

  it('marks the chosen tool current after a click', () => {
    render(<Lab title="T" instruments={[bare]} tools={tools} />);
    screen.getByRole('button', { name: 'Pan' }).click();
    expect(screen.getByRole('button', { name: 'Pan' })).toHaveAttribute('aria-current', 'true');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/labkit && npx vitest run src/lab/LabPalette.test.tsx`
Expected: FAIL — `tools` is not a prop on `LabProps`.

- [ ] **Step 3: Write `LabPalette.tsx`**

It reuses `PaletteRegion` by building palette contributions from the lab's tools
and a context carrying only what that region reads.

```tsx
import { useStore } from 'zustand';
import { useContext } from 'react';
import { PaletteRegion } from '../chrome/regions/PaletteRegion';
import type { TrialChromeContext, TrialContribution } from '../chrome/types';
import { LabStoreContext } from '../state/context';
import type { TrialTool } from '../tools/types';

/** Props for `<LabPalette>`. */
export interface LabPaletteProps {
  tools: readonly TrialTool[];
}

/** The lab's tool strip. Writes the lab's tool slot, which every trial whose
 *  instrument declares no tools of its own resolves to. */
export function LabPalette({ tools }: LabPaletteProps) {
  const storeCtx = useContext(LabStoreContext);
  if (!storeCtx) throw new Error('[labkit] LabPalette requires <LabStoreProvider>');
  const activeToolId = useStore(storeCtx.store, (s) => s.activeToolId);
  const setLabTool = useStore(storeCtx.store, (s) => s.setLabTool);

  const contributions: TrialContribution[] = tools.map((t) => ({
    id: t.id,
    region: 'palette',
    group: t.group,
    item: { icon: t.icon, label: t.label, shortcut: t.shortcut },
  }));

  const ctx = {
    activeToolId,
    setActiveTool: setLabTool,
  } as unknown as TrialChromeContext;

  return <PaletteRegion contributions={contributions} ctx={ctx} />;
}
```

- [ ] **Step 4: Wire it into `<Lab>`**

Add to `LabProps`:

```ts
/** Tools offered lab-wide. A trial whose instrument declares none of its own
 *  reflects and writes this slot. */
tools?: readonly TrialTool[];
```

Render `{tools ? <LabPalette tools={tools} /> : null}` immediately before the
`<Workspace>` inside `LabShell`'s body, and wrap the pair in
`<div className="lk-lab__body">` so the palette sits beside the workspace rather
than above it.

In `packages/labkit/src/lab/LabShell.less`:

```less
.lk-lab__body {
  display: flex;
  flex: 1;
  min-height: 0;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/labkit && npx vitest run src/lab/LabPalette.test.tsx`
Expected: PASS, 3 tests.

- [ ] **Step 6: Commit**

```bash
git add packages/labkit/src/lab
git commit -m "give a lab its own tool palette"
```

---

### Task 11: Barrel, stories, docs and changeset

**Files:**
- Create: `packages/labkit/src/chrome/index.ts`
- Create: `packages/labkit/src/chrome/ChromeRegions.stories.tsx`
- Create: `.changeset/labkit-chrome-regions.md`
- Modify: `packages/labkit/src/index.ts`
- Modify: `packages/labkit/package.json`
- Modify: `docs/TODO.md`

- [ ] **Step 1: Write the barrel**

```ts
export { builtinContributions } from './builtins';
export { mergeContributions, suppressContributions } from './merge';
export { PaletteRegion } from './regions/PaletteRegion';
export type { PaletteRegionProps } from './regions/PaletteRegion';
export { SidebarRegion } from './regions/SidebarRegion';
export type { SidebarRegionProps } from './regions/SidebarRegion';
export { StatusRegion } from './regions/StatusRegion';
export type { StatusRegionProps } from './regions/StatusRegion';
export { ToolbarRegion } from './regions/ToolbarRegion';
export type { ToolbarRegionProps } from './regions/ToolbarRegion';
export { ViewportRegion } from './regions/ViewportRegion';
export type { ViewportRegionProps } from './regions/ViewportRegion';
export type {
  IconComponent,
  SidebarSection,
  StatusReadout,
  ToolbarItem,
  ToolItem,
  TrialChromeContext,
  TrialContribution,
  TrialRegion,
  ViewportControl,
} from './types';
```

Add `export * from './chrome';` and `export type { ToolCapability, TrialTool } from './tools/types';` to `packages/labkit/src/index.ts`, and a `"./chrome"` subpath to `packages/labkit/package.json`'s `exports` map, following the shape of the existing `"./primitives"` entry.

- [ ] **Step 2: Write a story showing a fully-declared trial**

`packages/labkit/src/chrome/ChromeRegions.stories.tsx` — a `<Lab>` with one instrument declaring `canvas`, `undo`, `layers` and `tools`, so every region renders at once. Title it `labkit/Chrome/Regions`, following the meta shape in `packages/labkit/src/lab/Lab.stories.tsx`.

- [ ] **Step 3: Write the changeset**

`.changeset/labkit-chrome-regions.md`. **`patch` — every changeset in this repo is `patch`** (`CLAUDE.md`, "Releases"). Say what changed in the prose, never in the number.

```markdown
---
'@weasel-js/labkit': patch
---

Assemble a trial's chrome from what its instrument declares. A contribution is
data keyed to a region — `toolbar`, `palette`, `sidebar`, `viewport`, `status` —
and the regions render whatever the assembled list puts in them. A lab adds its
own with `chrome` and drops a built-in with `suppress`.

Breaking: `detectCapabilities`, `CapabilityFlags`, `ToolbarSlot`, `SidebarSlot`,
`StatusBarSlot`, the matching `Trial*Context` types, `DefaultToolbar`,
`DefaultSidebar`, `DefaultStatusBar` and `TrialChrome`'s `sidebarExtras` are
removed. Zoom moves from the trial toolbar to the new viewport region.
```

- [ ] **Step 4: Update the TODO**

In `docs/TODO.md`, the P1 labkit presentation entry: mark arc 3 done and leave arc 4 (the density and type-scale pass) as the open follow-up. Per `CLAUDE.md`'s retention policy, keep the block while arc 4 is outstanding.

- [ ] **Step 5: Run every gate**

```bash
npx tsc --noEmit
npx eslint .
cd packages/labkit && npx vitest run
cd ../.. && npm run check:bumps
```

Expected: all PASS. `check:bumps` must confirm the changeset is `patch`.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "export the chrome region surface"
```

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| Regions (six trial regions) | 1 (type), 4, 5, 9 (renderers) |
| Contribution shape, render escape | 1, and every region renderer |
| Built-in derivation table | 3, extended in 9 for `tools` |
| `dragDrop` → sidebar, not palette | 6 step 4 |
| Assembly, duplicate id throws | 2, 7 |
| `suppress` by id, throws on unknown | 2, 7 |
| The tool slot at both levels | 8 |
| Which slot a trial uses follows from declaration | 8 step 6 |
| Deletions (detectCapabilities, slots, sidebarExtras) | 6 step 5 |
| Arc 4 is out of scope | 11 step 4 |
| Lab-level palette region | 10 |

**Type consistency:** `TrialChromeContext` is defined once in Task 1 and consumed unchanged in 3–9. `activeToolId` is `string | null` on the context and on `LabStoreState`, and `string | null | undefined` on `TrialRecord` — the optionality is what distinguishes "no slot" from "slot holding nothing", and Task 8's test pins it.
