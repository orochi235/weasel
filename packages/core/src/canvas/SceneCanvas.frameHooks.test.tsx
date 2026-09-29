/**
 * `beforePaint` / `afterPaint` run on the surface's own frame loop, in entry
 * order, isolated from each other's throws; `requires` is checked on install.
 *
 * The GL recorder is load-bearing: without a WebGL2 context every paint bails
 * before landing, and no `afterPaint` would ever run.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup, render, renderHook } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import type { CanvasExtensionApi } from './canvasExtension';
import type { SurfaceContribution } from './surfaceContribution';
import { useContributionFrameHooks } from './SceneCanvas/contributionFrameHooks';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const VIEW: View = { x: 5, y: 6, scale: { x: 1, y: 1 } };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const frame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));
const frames = async (n: number) => { await act(async () => { for (let i = 0; i < n; i++) await frame(); }); };

function Harness({ ambient, versionCheck }: {
  ambient: SurfaceContribution[];
  versionCheck?: 'warn' | 'strict' | 'off';
}) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  return (
    <SceneCanvas
      scene={scene} layers={{}} width={300} height={200} view={VIEW}
      ambient={ambient} {...(versionCheck ? { versionCheck } : {})}
    />
  );
}

/** A screen layer with no `deps`, so the command cache cannot serve it and
 *  every paint calls its draw. */
function paintProbe(log: string[]): RenderLayer<unknown> {
  return {
    id: 'paint-probe',
    label: 'probe',
    space: 'screen',
    draw: (data) => {
      if ((data as { viewId?: string | null } | null)?.viewId == null) log.push('paint');
      return [];
    },
  };
}

describe('contribution frame hooks', () => {
  it('run before and after the paint, in the order the entries are listed', async () => {
    const log: string[] = [];
    const a: SurfaceContribution = {
      id: 'a', eligibility: { always: true }, overlay: paintProbe(log),
      beforePaint: () => { log.push('a.before'); },
      afterPaint: () => { log.push('a.after'); },
    };
    const b: SurfaceContribution = {
      id: 'b', eligibility: { always: true },
      beforePaint: () => { log.push('b.before'); },
      afterPaint: () => { log.push('b.after'); },
    };
    render(<Harness ambient={[b, a]} />);
    await frames(3);
    const first = log.indexOf('b.before');
    expect(log.slice(first, first + 5)).toEqual(['b.before', 'a.before', 'paint', 'b.after', 'a.after']);
  });

  it('hand the hook the frame time, the surface view and the deps', async () => {
    const seen: { time: number; view: View; hasScene: boolean }[] = [];
    const entry: SurfaceContribution = {
      id: 'probe', eligibility: { always: true },
      beforePaint: (ctx) => { seen.push({ time: ctx.time, view: ctx.view, hasScene: !!ctx.deps.get('scene') }); },
    };
    render(<Harness ambient={[entry]} />);
    await frames(3);
    expect(seen.length).toBeGreaterThan(0);
    expect(seen[0]!.time).toBeTypeOf('number');
    expect(seen[0]!.view).toMatchObject({ x: 5, y: 6 });
    expect(seen[0]!.hasScene).toBe(true);
  });

  it('keep the frame running while a hook asks for more, and let it idle after', async () => {
    let remaining = 3;
    const ran = vi.fn();
    const entry: SurfaceContribution = {
      id: 'anim', eligibility: { always: true },
      afterPaint: (ctx) => {
        ran();
        if (remaining > 0) { remaining -= 1; ctx.requestFrame(); }
      },
    };
    render(<Harness ambient={[entry]} />);
    await frames(10);
    const settled = ran.mock.calls.length;
    expect(settled).toBeGreaterThanOrEqual(4);
    await frames(4);
    expect(ran).toHaveBeenCalledTimes(settled);
  });

  it('isolate a throwing hook: the others run, the paint lands, and it is reported once', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const log: string[] = [];
    const broken: SurfaceContribution = {
      id: 'broken', eligibility: { always: true },
      beforePaint: () => { throw new Error('boom'); },
      afterPaint: (ctx) => { log.push('broken.after'); ctx.requestFrame(); },
    };
    const fine: SurfaceContribution = {
      id: 'fine', eligibility: { always: true }, overlay: paintProbe(log),
      beforePaint: () => { log.push('fine.before'); },
    };
    render(<Harness ambient={[broken, fine]} />);
    await frames(4);
    expect(log.filter((l) => l === 'fine.before').length).toBeGreaterThanOrEqual(2);
    expect(log).toContain('paint');
    expect(log).toContain('broken.after');
    const reports = error.mock.calls.filter((c) => String(c[0]).includes('"broken"'));
    expect(reports).toHaveLength(1);
    expect(String(reports[0]![0])).toContain('beforePaint');
  });
});

describe('contribution frame hooks cost nothing unused', () => {
  function fakeApi() {
    return {
      getView: () => VIEW,
      requestRedraw: vi.fn(),
      subscribeFrame: vi.fn(() => () => {}),
      subscribeBeforePaint: vi.fn(() => () => {}),
    } as unknown as CanvasExtensionApi & {
      subscribeFrame: ReturnType<typeof vi.fn>;
      subscribeBeforePaint: ReturnType<typeof vi.fn>;
    };
  }
  const reader = { get: () => undefined };

  it('subscribes to neither phase when no entry declares a hook', () => {
    const api = fakeApi();
    const plain: SurfaceContribution = { id: 'plain', eligibility: { always: true }, attach: () => () => {} };
    renderHook(() => useContributionFrameHooks([plain], api, reader));
    expect(api.subscribeBeforePaint).not.toHaveBeenCalled();
    expect(api.subscribeFrame).not.toHaveBeenCalled();
  });

  it('subscribes once per declared phase however many entries declare it', () => {
    const api = fakeApi();
    const e = (id: string): SurfaceContribution => ({ id, eligibility: { always: true }, afterPaint: () => {} });
    renderHook(() => useContributionFrameHooks([e('x'), e('y'), e('z')], api, reader));
    expect(api.subscribeBeforePaint).not.toHaveBeenCalled();
    expect(api.subscribeFrame).toHaveBeenCalledTimes(1);
  });
});

describe('requires', () => {
  const needs = (range: string): SurfaceContribution =>
    ({ id: 'future', eligibility: { always: true }, requires: { core: range } });

  it('warns naming the entry, the range and the running version', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Harness ambient={[needs('^99')]} />);
    const hits = warn.mock.calls.filter((c) => String(c[0]).includes('"future"'));
    expect(hits).toHaveLength(1);
    expect(String(hits[0]![0])).toMatch(/core \^99.*1\.\d+\.\d+/);
  });

  it('says nothing when the range is met', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Harness ambient={[needs('>=1')]} />);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('"future"'))).toHaveLength(0);
  });

  it('throws under versionCheck="strict"', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness ambient={[needs('^99')]} versionCheck="strict" />)).toThrow(/"future".*core \^99/);
  });

  it('checks nothing under versionCheck="off"', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<Harness ambient={[needs('^99')]} versionCheck="off" />);
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('"future"'))).toHaveLength(0);
  });
});
