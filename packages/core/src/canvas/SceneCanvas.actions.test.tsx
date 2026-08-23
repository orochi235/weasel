import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { ActionsProvider, useActionsRegistry, type Action } from 'interactions/actions/registry';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';
import { asNodeId } from 'core/scene/types';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function makeScene(): Scene<D, L, P> {
  return createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
}

function Probe({ onReg }: { onReg: (ids: string[]) => void }) {
  const reg = useActionsRegistry();
  // Read on mount/update via useEffect so we observe state AFTER the
  // sibling ActionRegistrar's useAction effect has registered.
  useEffect(() => {
    onReg(reg ? reg.list().map(a => a.id) : []);
  });
  return null;
}

describe('SceneCanvas actions integration', () => {
  it('default: registers all default ids when scene+selection present', () => {
    const scene = makeScene();
    const seen: string[][] = [];
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64} actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}>
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    const last = seen.at(-1)!;
    expect(last).toContain('selectAll');
    expect(last).toContain('escape');
    expect(last).toContain('duplicate');
    expect(last.filter(i => i.startsWith('nudge.'))).toHaveLength(4);
    expect(last.filter(i => i.startsWith('reorder.'))).toHaveLength(2);
  });

  it('actions={null} → no default actions, but tool keybindings remain', () => {
    const scene = makeScene();
    const seen: string[][] = [];
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64} actions={null}>
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    // `actions` governs the kit's DEFAULT action set. Tool activation and
    // Escape-returns-to-default are keybinding concerns, registered by
    // `useKeybindings` and gated by `enableKeybindings` instead. They used to
    // be absent here only because `useKeybindings` was mounted above the
    // ActionsProvider and its registrations silently no-op'd — a document
    // `keydown` listener did the real work. Both are gone (audit 3.8).
    //
    // `select.pick` / `select.collapseDeferred` are the select tool's OWN
    // actions, declared on its `ToolDef.actions` and registered by
    // `useToolActions`. A tool that was explicitly mounted has to bring the
    // actions its own bindings reference, or it is inert — `actions={null}`
    // opts out of the kit's defaults, not out of the tools you passed.
    expect(seen.at(-1)).toEqual([
      'tool.activate', 'tool.resetToDefault', 'select.pick', 'select.collapseDeferred',
    ]);
  });

  it('actions={null} + enableKeybindings={false} → only the mounted tools own actions', () => {
    const scene = makeScene();
    const seen: string[][] = [];
    render(
      <SceneCanvas
        scene={scene} layers={{}} width={64} height={64}
        actions={null} enableKeybindings={false}
      >
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    // Both keybinding actions are gone; what remains is exactly the select
    // tool's own two, for the reason above.
    expect(seen.at(-1)).toEqual(['select.pick', 'select.collapseDeferred']);
  });

  it('actions={{ selectAll: null }} drops selectAll only', () => {
    const scene = makeScene();
    const seen: string[][] = [];
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ selectAll: null }}>
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    expect(seen.at(-1)).not.toContain('selectAll');
    expect(seen.at(-1)).toContain('escape');
  });

  it('partial override keeps default id/label/defaultBinding, replaces run', () => {
    const scene = makeScene();
    const customRun = vi.fn();
    let captured: Action | undefined;
    function Capture() {
      const reg = useActionsRegistry();
      useEffect(() => { captured = reg?.list().find(a => a.id === 'duplicate'); });
      return null;
    }
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ duplicate: { invoker: { timing: 'immediate' as const, run: () => { customRun(); } } } }}>
        <Capture />
      </SceneCanvas>,
    );
    expect(captured).toBeDefined();
    expect(captured!.id).toBe('duplicate');
    expect(captured!.label).toBe('Duplicate');
    expect(captured!.defaultBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
    if (captured!.invoker!.timing === 'immediate') {
      (captured!.invoker as { run: (d: unknown) => void }).run({});
    }
    expect(customRun).toHaveBeenCalledOnce();
  });

  it('a partial override survives a re-render that rebuilds the actions object', () => {
    const scene = makeScene();
    let captured: Action | undefined;
    function Capture() {
      const reg = useActionsRegistry();
      useEffect(() => { captured = reg?.list().find(a => a.id === 'duplicate'); });
      return null;
    }
    const tree = (label: string) => (
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ duplicate: { label } }}>
        <Capture />
      </SceneCanvas>
    );
    const { rerender } = render(tree('Clone'));
    expect(captured?.label).toBe('Clone');

    // New `actions` identity → the resolver effect tears down and re-runs.
    rerender(tree('Clone again'));
    expect(captured).toBeDefined();
    expect(captured!.label).toBe('Clone again');
    expect(captured!.invoker).toBeDefined();
  });

  it('full new id is added alongside defaults', () => {
    const scene = makeScene();
    const copyRun = vi.fn();
    const seen: string[][] = [];
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{
          copy: { id: 'copy', label: 'Copy', defaultBinding: { kind: 'key', key: 'c', mods: { mod: true } }, invoker: { timing: 'immediate' as const, run: () => { copyRun(); } } },
        }}>
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    expect(seen.at(-1)).toContain('copy');
    expect(seen.at(-1)).toContain('selectAll');
  });

  it('mixed: one disabled, one overridden, one new', () => {
    const scene = makeScene();
    const seen: string[][] = [];
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{
          selectAll: null,
          duplicate: { invoker: { timing: 'immediate' as const, run: vi.fn() } },
          copy: { id: 'copy', label: 'Copy', defaultBinding: { kind: 'key', key: 'c', mods: { mod: true } }, invoker: { timing: 'immediate' as const, run: vi.fn() } },
        }}>
        <Probe onReg={(ids) => seen.push(ids)} />
      </SceneCanvas>,
    );
    const last = seen.at(-1)!;
    expect(last).not.toContain('selectAll');
    expect(last).toContain('duplicate');
    expect(last).toContain('copy');
  });

  it('auto-mounts ActionsProvider when no parent', () => {
    const scene = makeScene();
    let saw: ReturnType<typeof useActionsRegistry> = undefined as never;
    function Probe2() { const r = useActionsRegistry(); useEffect(() => { saw = r; }); return null; }
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}>
        <Probe2 />
      </SceneCanvas>,
    );
    expect(saw).not.toBeNull();
  });

  it('uses parent ActionsProvider when wrapped externally — no inner provider', () => {
    const scene = makeScene();
    let parentReg: ReturnType<typeof useActionsRegistry> = null;
    let childReg: ReturnType<typeof useActionsRegistry> = null;
    function CaptureParent() { const r = useActionsRegistry(); useEffect(() => { parentReg = r; }); return null; }
    function CaptureChild() { const r = useActionsRegistry(); useEffect(() => { childReg = r; }); return null; }
    render(
      <ActionsProvider>
        <CaptureParent />
        <SceneCanvas scene={scene} layers={{}} width={64} height={64}>
          <CaptureChild />
        </SceneCanvas>
      </ActionsProvider>,
    );
    expect(parentReg).not.toBeNull();
    expect(childReg).toBe(parentReg);
  });

  it('unmount cleans up registered defaults', () => {
    const scene = makeScene();
    let seen: string[] = [];
    function Probe3() { const r = useActionsRegistry(); useEffect(() => { seen = r ? r.list().map(a => a.id) : []; }); return null; }
    const { unmount, rerender } = render(
      <ActionsProvider>
        <SceneCanvas scene={scene} layers={{}} width={64} height={64} actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }} />
        <Probe3 />
      </ActionsProvider>,
    );
    expect(seen).toContain('selectAll');
    rerender(<ActionsProvider><Probe3 /></ActionsProvider>);
    expect(seen).not.toContain('selectAll');
    unmount();
  });

  it('partial override with explicit id mismatch ignores the id field, applies override to the slot', () => {
    const scene = makeScene();
    const customRun = vi.fn();
    let captured: Action | undefined;
    function Capture() {
      const reg = useActionsRegistry();
      useEffect(() => { captured = reg?.list().find(a => a.id === 'duplicate'); });
      return null;
    }
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ duplicate: { id: 'wrong', invoker: { timing: 'immediate' as const, run: () => { customRun(); } }, label: 'Replicate' } }}>
        <Capture />
      </SceneCanvas>,
    );
    expect(captured).toBeDefined();
    expect(captured!.id).toBe('duplicate'); // id field ignored
    expect(captured!.label).toBe('Replicate'); // label override applied
    warnSpy.mockRestore();
  });

  it('label-only override keeps run + binding from default', () => {
    const scene = makeScene();
    let captured: Action | undefined;
    function Capture() {
      const reg = useActionsRegistry();
      useEffect(() => { captured = reg?.list().find(a => a.id === 'duplicate'); });
      return null;
    }
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ duplicate: { label: 'Clone' } }}>
        <Capture />
      </SceneCanvas>,
    );
    expect(captured!.label).toBe('Clone');
    expect(captured!.defaultBinding).toEqual({ kind: 'key', key: 'd', mods: { mod: true } });
  });

  it('binding-only override keeps run + label', () => {
    const scene = makeScene();
    let captured: Action | undefined;
    function Capture() {
      const reg = useActionsRegistry();
      useEffect(() => { captured = reg?.list().find(a => a.id === 'duplicate'); });
      return null;
    }
    render(
      <SceneCanvas scene={scene} layers={{}} width={64} height={64}
        actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }}
        actions={{ duplicate: { defaultBinding: { kind: 'key', key: 'D', mods: { mod: true, shift: true } } } }}>
        <Capture />
      </SceneCanvas>,
    );
    expect(captured!.label).toBe('Duplicate');
    expect(captured!.defaultBinding).toEqual({ kind: 'key', key: 'D', mods: { mod: true, shift: true } });
  });

  it('re-mount re-registers defaults', () => {
    const scene = makeScene();
    let seen: string[] = [];
    function Probe4() { const r = useActionsRegistry(); useEffect(() => { seen = r ? r.list().map(a => a.id) : []; }); return null; }
    const { rerender } = render(
      <ActionsProvider>
        <SceneCanvas scene={scene} layers={{}} width={64} height={64} actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }} />
        <Probe4 />
      </ActionsProvider>,
    );
    expect(seen).toContain('selectAll');
    rerender(<ActionsProvider><Probe4 /></ActionsProvider>);
    expect(seen).not.toContain('selectAll');
    rerender(
      <ActionsProvider>
        <SceneCanvas scene={scene} layers={{}} width={64} height={64} actionDefaults={{ cloneNode: (id) => ({ id: asNodeId(id + "'") }) }} />
        <Probe4 />
      </ActionsProvider>,
    );
    expect(seen).toContain('selectAll');
  });
});
