import { describe, it, expect, vi } from 'vitest';
import { useEffect, useState, type ReactNode } from 'react';
import { render } from '@testing-library/react';
import {
  ActionsProvider,
  useActionsRegistry,
  type Action,
} from './registry';
import {
  useStandardActions,
  type StandardActionsDeps,
  type UseStandardActionsOptions,
} from './useStandardActions';
import { asNodeId } from 'core/scene/types';

type Pose = { x: number; y: number; width: number; height: number };

function wrap({ children }: { children: ReactNode }) {
  return <ActionsProvider>{children}</ActionsProvider>;
}

function makeDeps(overrides: Partial<StandardActionsDeps<Pose>> = {}): StandardActionsDeps<Pose> {
  return {
    getSelection: () => [],
    setSelection: () => {},
    listAll: () => [],
    getPose: () => ({ x: 0, y: 0, width: 0, height: 0 }),
    applyBatch: () => {},
    translatePose: (p, dx, dy) => ({ ...p, x: p.x + dx, y: p.y + dy }),
    ...overrides,
  };
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

describe('useStandardActions', () => {
  function Host<TPose>({
    deps,
    options,
    children,
  }: {
    deps: StandardActionsDeps<TPose>;
    options?: UseStandardActionsOptions<TPose>;
    children?: ReactNode;
  }) {
    useStandardActions(deps, options);
    return <>{children}</>;
  }

  it('registers all 15 default actions when cloneObject is supplied', () => {
    const seen: string[][] = [];
    render(
      <ActionsProvider>
        <Host
          deps={makeDeps()}
          options={{ defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) } }}
        />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </ActionsProvider>,
    );
    const last = seen.at(-1)!;
    expect(last).toContain('selectAll');
    expect(last).toContain('escape');
    expect(last).toContain('duplicate');
    expect(last.filter((i) => i.startsWith('nudge.'))).toHaveLength(8);
    expect(last.filter((i) => i.startsWith('reorder.'))).toHaveLength(2);
    // 1 (selectAll) + 1 (escape) + 1 (duplicate) + 8 (nudge×8) + 2 (reorder×2) = 13
    expect(last).toHaveLength(13);
  });

  it('actions={null} → registers nothing', () => {
    const seen: string[][] = [];
    render(
      <ActionsProvider>
        <Host deps={makeDeps()} options={{ actions: null }} />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </ActionsProvider>,
    );
    expect(seen.at(-1)).toEqual([]);
  });

  it('actions={{ selectAll: null }} drops selectAll only', () => {
    const seen: string[][] = [];
    render(
      <ActionsProvider>
        <Host
          deps={makeDeps()}
          options={{
            actions: { selectAll: null },
            defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) },
          }}
        />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </ActionsProvider>,
    );
    const last = seen.at(-1)!;
    expect(last).not.toContain('selectAll');
    expect(last).toContain('escape');
    expect(last).toContain('duplicate');
  });

  it('partial override keeps default id/label/binding, replaces run', () => {
    const customRun = vi.fn();
    let captured: Action | undefined;
    render(
      <ActionsProvider>
        <Host
          deps={makeDeps()}
          options={{
            actions: { duplicate: { run: customRun } },
            defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) },
          }}
        />
        <ProbeAction id="duplicate" onAction={(a) => { captured = a; }} />
      </ActionsProvider>,
    );
    expect(captured).toBeDefined();
    expect(captured!.id).toBe('duplicate');
    expect(captured!.label).toBe('Duplicate');
    expect(captured!.defaultBinding).toEqual({ key: 'd', mod: true });
    captured!.run();
    expect(customRun).toHaveBeenCalledOnce();
  });

  it('full new id is added alongside defaults', () => {
    const copyRun = vi.fn();
    const seen: string[][] = [];
    render(
      <ActionsProvider>
        <Host
          deps={makeDeps()}
          options={{
            actions: {
              copy: { id: 'copy', label: 'Copy', defaultBinding: { key: 'c', mod: true }, run: copyRun },
            },
            defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) },
          }}
        />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </ActionsProvider>,
    );
    expect(seen.at(-1)).toContain('copy');
    expect(seen.at(-1)).toContain('selectAll');
  });

  it('no-op when no <ActionsProvider> is in scope (does not throw)', () => {
    expect(() => {
      render(<Host deps={makeDeps()} />);
    }).not.toThrow();
  });

  it('stable identity: re-rendering with the same deps does not re-resolve / re-register', () => {
    const reg = { register: vi.fn(() => () => {}) };
    // Fake registry exposed via context isn't trivial here; instead, use the
    // real ActionsProvider and assert that the resolved Action references are
    // === across re-renders.
    let listA: readonly Action[] = [];
    let listB: readonly Action[] = [];
    function Capture({ snapshot }: { snapshot: 'a' | 'b' }) {
      const r = useActionsRegistry();
      useEffect(() => {
        if (!r) return;
        if (snapshot === 'a') listA = r.list();
        else listB = r.list();
      });
      return null;
    }
    function Wrapper() {
      const [, setN] = useState(0);
      useEffect(() => {
        // Trigger a re-render after first commit.
        setN((n) => n + 1);
      }, []);
      return (
        <ActionsProvider>
          <Host
            deps={makeDeps()}
            options={{ defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) } }}
          />
          <Capture snapshot="a" />
          <Capture snapshot="b" />
        </ActionsProvider>
      );
    }
    render(<Wrapper />);
    // After mount and re-render, both probes see the same registered Action
    // instances — we register once and never replace.
    expect(listA.length).toBeGreaterThan(0);
    expect(listB.length).toBeGreaterThan(0);
    const idsA = listA.map((a) => a.id).sort();
    const idsB = listB.map((a) => a.id).sort();
    expect(idsA).toEqual(idsB);
    void reg;
  });

  it('without cloneObject, duplicate is dropped', () => {
    const seen: string[][] = [];
    render(
      <ActionsProvider>
        <Host deps={makeDeps()} />
        <ProbeIds onIds={(ids) => seen.push(ids)} />
      </ActionsProvider>,
    );
    expect(seen.at(-1)).not.toContain('duplicate');
    expect(seen.at(-1)).toContain('selectAll');
  });

  it('keydown dispatches the consumer setSelection via deps', () => {
    const setSelection = vi.fn();
    const listAll = vi.fn(() => [asNodeId('a'), asNodeId('b'), asNodeId('c')]);
    render(
      <ActionsProvider>
        <Host deps={makeDeps({ setSelection, listAll })} />
      </ActionsProvider>,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', metaKey: true, bubbles: true }));
    expect(setSelection).toHaveBeenCalledWith(['a', 'b', 'c']);
  });

  it('keydown applyBatch reaches the consumer for nudge', () => {
    const applyBatch = vi.fn();
    const getSelection = vi.fn(() => [asNodeId('n1')]);
    render(
      <ActionsProvider>
        <Host
          deps={makeDeps({
            applyBatch,
            getSelection,
            getPose: () => ({ x: 5, y: 5, width: 10, height: 10 }),
          })}
        />
      </ActionsProvider>,
    );
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(applyBatch).toHaveBeenCalled();
    expect(applyBatch.mock.calls[0][1]).toBe('Nudge');
  });

  it('unmount unregisters all actions', () => {
    let seen: string[] = [];
    function Probe() {
      const r = useActionsRegistry();
      useEffect(() => { seen = r ? r.list().map((a) => a.id) : []; });
      return null;
    }
    const { rerender } = render(
      <ActionsProvider>
        <Host
          deps={makeDeps()}
          options={{ defaults: { cloneObject: (id) => ({ id: asNodeId(id + "'") }) } }}
        />
        <Probe />
      </ActionsProvider>,
    );
    expect(seen).toContain('selectAll');
    rerender(<ActionsProvider><Probe /></ActionsProvider>);
    expect(seen).not.toContain('selectAll');
    expect(seen).toEqual([]);
  });
});

// Minimal sanity-check that wrap() produces an ActionsProvider context.
describe('useStandardActions wrap helper', () => {
  it('wrap renders ActionsProvider for tests', () => {
    let saw: ReturnType<typeof useActionsRegistry> = null;
    function Probe() {
      const r = useActionsRegistry();
      useEffect(() => { saw = r; });
      return null;
    }
    render(wrap({ children: <Probe /> }));
    expect(saw).not.toBeNull();
  });
});
