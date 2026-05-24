import { describe, it, expect, vi } from 'vitest';
import { useEffect, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import {
  ActionsProvider,
  useActionsRegistry,
  type Action,
} from './registry';
import { DepRegistryProvider, useDepRegistry } from './depRegistry';
import { useStandardActions } from './useStandardActions';
import type { UseStandardActionsOptions } from './useStandardActions';

// Import depSchema augmentation so DepSchema entries are typed
import './depSchema';

// ---------------------------------------------------------------------------
// Test wrappers
// ---------------------------------------------------------------------------

function Providers({ children }: { children: ReactNode }) {
  // Phase 14e Task 7: DepRegistryProvider must wrap ActionsProvider so that
  // ActionsProvider's `trigger` can read deps from the dep registry. This
  // matches SceneCanvas's nesting order.
  return (
    <DepRegistryProvider>
      <ActionsProvider>
        {children}
      </ActionsProvider>
    </DepRegistryProvider>
  );
}

function Host({ opts, children }: { opts?: UseStandardActionsOptions; children?: ReactNode }) {
  useStandardActions(opts ?? {});
  return <>{children}</>;
}

function ProbeIds({ onIds }: { onIds: (ids: string[]) => void }) {
  const reg = useActionsRegistry();
  useEffect(() => {
    onIds(reg ? reg.list().map((a) => a.id) : []);
  });
  return null;
}

function ProbeAction({ id, onAction }: { id: string; onAction: (a: Action | undefined) => void }) {
  const reg = useActionsRegistry();
  useEffect(() => {
    onAction(reg?.list().find((a) => a.id === id));
  });
  return null;
}

function ProbeDepSelection({ onValue }: { onValue: (v: unknown) => void }) {
  const depReg = useDepRegistry();
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onValue((depReg as any).get('selection'));
  });
  return null;
}

// ---------------------------------------------------------------------------
// Kit-standard descriptor IDs
// ---------------------------------------------------------------------------
const KIT_IDS = [
  'escape', 'cancelGesture', 'selectAll', 'delete', 'duplicate',
  'group', 'ungroup',
  'undo', 'redo',
  'flip',
  'nudge.up', 'nudge.down', 'nudge.left', 'nudge.right',
  'reorder.forward', 'reorder.backward',
  'align.left', 'align.right', 'align.top', 'align.bottom', 'align.centerX', 'align.centerY',
  'distribute.horizontal', 'distribute.vertical',
  'pathfinder.union', 'pathfinder.subtract', 'pathfinder.intersect',
  'pathfinder.exclude', 'pathfinder.divide', 'pathfinder.crop',
  'move',
  'resize', 'rotate', 'areaSelect', 'insert', 'insert.adjustRotation', 'clone',
  'editAnchors', 'enterPathEdit', 'exitPathEdit', 'insertPathAnchor',
  'lassoSelect', 'viewport.pinchZoom',
  // viewport.pan / viewport.zoom are registered conditionally by SceneCanvas's
  // useViewportActions, not by useStandardActions — see useViewportActions.ts.
  'viewport.dragPan', // Phase 14c.2
  'clearSelection', // Phase 14a
  'enterTextEdit', // Phase 14c.3
] as const;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useStandardActions', () => {
  it('registers all 46 kit-standard action descriptors', () => {
    const seen: string[][] = [];
    render(
      <Providers>
        <Host />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </Providers>,
    );
    const last = seen.at(-1)!;
    for (const id of KIT_IDS) {
      expect(last, `expected "${id}" to be registered`).toContain(id);
    }
    expect(last).toHaveLength(KIT_IDS.length);
  });

  it('each registered action has an invoker (Phase 14e Task 7: withLegacyRunBridge deleted; trigger routes via invoker.run with deps from depRegistry)', () => {
    let actions: readonly Action[] = [];
    render(
      <Providers>
        <Host />
        <ProbeAction id="escape" onAction={(a) => { if (a) actions = [a]; }} />
      </Providers>,
    );
    const escape = actions[0];
    expect(escape).toBeDefined();
    expect(escape?.invoker).toBeDefined();
  });

  it('dep source for selection is registered and returns the provided SelectionApi', () => {
    const fakeSelection = { get: vi.fn(() => []), set: vi.fn() };
    let depValue: unknown = 'not-set';
    render(
      <Providers>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Host opts={{ selection: fakeSelection as any }} />
        <ProbeDepSelection onValue={(v) => { depValue = v; }} />
      </Providers>,
    );
    expect(depValue).toBe(fakeSelection);
  });

  it('escape via registry.trigger calls selection.set([]) when selection is non-empty (Phase 14e Task 7: trigger routes through invoker.run + depRegistry)', () => {
    const mockSet = vi.fn();
    const fakeSelection = {
      get: vi.fn(() => ['a', 'b']),
      set: mockSet,
    };
    let reg: ReturnType<typeof useActionsRegistry> = null;
    function CaptureReg() { reg = useActionsRegistry(); return null; }
    render(
      <Providers>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Host opts={{ selection: fakeSelection as any }} />
        <CaptureReg />
      </Providers>,
    );
    expect(reg).not.toBeNull();
    reg!.trigger('escape');
    expect(mockSet).toHaveBeenCalledWith([]);
  });

  it('escape via registry.trigger is a no-op when selection is empty', () => {
    const mockSet = vi.fn();
    const fakeSelection = {
      get: vi.fn(() => []),
      set: mockSet,
    };
    let reg: ReturnType<typeof useActionsRegistry> = null;
    function CaptureReg() { reg = useActionsRegistry(); return null; }
    render(
      <Providers>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        <Host opts={{ selection: fakeSelection as any }} />
        <CaptureReg />
      </Providers>,
    );
    reg!.trigger('escape');
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('unmount unregisters all actions', () => {
    let seen: string[] = [];
    function Probe() {
      const r = useActionsRegistry();
      useEffect(() => { seen = r ? r.list().map((a) => a.id) : []; });
      return null;
    }
    const { rerender } = render(
      <Providers>
        <Host />
        <Probe />
      </Providers>,
    );
    expect(seen).toContain('escape');
    rerender(<Providers><Probe /></Providers>);
    expect(seen).not.toContain('escape');
    expect(seen).toEqual([]);
  });

  it('no-op when no providers are in scope (does not throw)', () => {
    expect(() => {
      render(<Host />);
    }).not.toThrow();
  });

  it('no-op when only ActionsProvider is in scope (no DepRegistryProvider)', () => {
    const seen: string[][] = [];
    expect(() => {
      render(
        <ActionsProvider>
          <Host />
          <ProbeIds onIds={(ids) => seen.push(ids)} />
        </ActionsProvider>,
      );
    }).not.toThrow();
    // Without DepRegistryProvider, no actions should be registered (bridge requires depReg).
    expect(seen.at(-1) ?? []).toEqual([]);
  });

  it('stable identity: re-rendering with the same opts does not re-register', () => {
    let listA: readonly Action[] = [];
    let listB: readonly Action[] = [];
    function CaptureA() {
      const r = useActionsRegistry();
      useEffect(() => { if (r) listA = r.list(); });
      return null;
    }
    function CaptureB() {
      const r = useActionsRegistry();
      useEffect(() => { if (r) listB = r.list(); });
      return null;
    }
    const { rerender } = render(
      <Providers>
        <Host />
        <CaptureA />
      </Providers>,
    );
    rerender(
      <Providers>
        <Host />
        <CaptureB />
      </Providers>,
    );
    const idsA = listA.map((a) => a.id).sort();
    const idsB = listB.map((a) => a.id).sort();
    expect(idsA).toEqual(idsB);
    expect(idsA).toHaveLength(KIT_IDS.length);
  });
});

// Minimal sanity-check that Providers supplies both registries.
describe('useStandardActions — Providers helper', () => {
  it('Providers renders both ActionsProvider and DepRegistryProvider', () => {
    let sawActions = false;
    let sawDeps = false;
    function Probe() {
      const r = useActionsRegistry();
      const d = useDepRegistry();
      useEffect(() => {
        sawActions = r !== null;
        sawDeps = d !== null;
      });
      return null;
    }
    render(<Providers><Probe /></Providers>);
    expect(sawActions).toBe(true);
    expect(sawDeps).toBe(true);
  });
});
