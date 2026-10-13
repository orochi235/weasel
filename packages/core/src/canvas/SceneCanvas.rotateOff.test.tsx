/**
 * `selectTool={{ rotate: false }}` — rotation off on a canvas whose presets
 * would otherwise turn it on.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, type Feature } from './SceneCanvas';
import type { CanvasHelpers } from './useViewHelpers';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { isRotateHandle } from '@weasel-js/routing';
import type { SelectionApi } from 'core/selection/useSelection';
import { always } from 'features/chrome-caps';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number; rotation: number };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

interface Seen { actionIds: string[]; labels: Record<string, string>; selection: SelectionApi | null }

function Probe({ into }: { into: Seen }) {
  const reg = useActionsRegistry();
  const deps = useDepRegistry();
  useEffect(() => {
    into.actionIds = reg ? reg.list().map((a) => a.id) : [];
    into.labels = Object.fromEntries((reg?.list() ?? []).map((a) => [a.id, a.label]));
    into.selection = (deps.get('selection') as SelectionApi | undefined) ?? null;
  });
  return null;
}

function mount(props: { features?: readonly Feature[] } & Record<string, unknown> = {}) {
  const scene: Scene<D, L, P> = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  let id!: NodeId;
  scene.batch('seed', () => {
    id = scene.add({
      kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 0, y: 0, width: 50, height: 50, rotation: 0 } as P,
    });
  });
  const seen: Seen = { actionIds: [], labels: {}, selection: null };
  const helpersRef: { current: CanvasHelpers<P> | null } = { current: null };
  const result = render(
    <SceneCanvas scene={scene} width={200} height={200} helpersRef={helpersRef} {...props}>
      <Probe into={seen} />
    </SceneCanvas>,
  );
  const canvas = result.container.querySelector('canvas')!;
  act(() => seen.selection!.set([id]));
  const isVisible = (chrome: string) => helpersRef.current!.getIsVisible()(chrome);
  const pose = () => scene.get(id)!.pose as P;
  return { id, seen, canvas, isVisible, pose };
}

function drag(canvas: Element, from: [number, number], to: [number, number]): void {
  const opts = (x: number, y: number) => ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 });
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(...from)));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts(...to)));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(...to)));
  });
}

/** Where the rotation handle of the 50×50 node at the origin sits. */
const ON_ROTATE_HANDLE: [number, number] = [25, -24];
const OFF: [number, number] = [60, 10];

describe('<SceneCanvas selectTool={{ rotate: false }}>', () => {
  it('control: the same canvas without it rotates from the handle', () => {
    const { seen, canvas, isVisible, pose } = mount({ features: ['pick', 'transform'] });
    expect(seen.actionIds).toContain('rotate');
    expect(isVisible('selection.rotation-handle')).toBe(true);
    drag(canvas, ON_ROTATE_HANDLE, OFF);
    expect(pose().rotation).not.toBe(0);
  });

  it('leaves the rotate action out, hides its handle, and does not rotate on a drag there', () => {
    const { id, seen, canvas, isVisible, pose } = mount({
      features: ['pick', 'transform'], selectTool: { rotate: false },
    });
    expect(seen.actionIds).not.toContain('rotate');
    expect(seen.actionIds).toContain('resize');
    expect(isVisible('selection.rotation-handle')).toBe(false);
    expect(isVisible('selection.resize-handles')).toBe(true);
    drag(canvas, ON_ROTATE_HANDLE, OFF);
    expect(pose().rotation).toBe(0);
    expect(seen.selection!.get()).toEqual([id]);
  });

  it('still resizes from a corner', () => {
    const { canvas, pose } = mount({ features: ['pick', 'transform'], selectTool: { rotate: false } });
    drag(canvas, [50, 50], [70, 70]);
    expect(pose().width).toBe(70);
  });

  // The rotate preset's binding stays installed with its action muted, so a
  // drag that reaches the handle resolves `rotate` and finds nothing there.
  it('does not rotate from a handle a consumer rule puts back, and the dispatcher says the binding has no action', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { id, seen, canvas, isVisible, pose } = mount({
      features: ['pick', 'transform'], selectTool: { rotate: false },
      chromeVisibility: { 'selection.rotation-handle': always },
    });
    expect(isVisible('selection.rotation-handle')).toBe(true);
    drag(canvas, ON_ROTATE_HANDLE, OFF);
    expect(pose().rotation).toBe(0);
    expect(seen.selection!.get()).toEqual([id]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('actionId "rotate" which has no registered action'));
    warn.mockRestore();
  });

  it('keeps the rotate action out when a tool binds it', () => {
    const spinner = {
      id: 'spinner', eligibility: {},
      bindings: [{ spec: { kind: 'drag', target: { kindOf: isRotateHandle } }, actionId: 'rotate' }],
    };
    const control = mount({ features: ['pick'], tools: { spinner } });
    expect(control.seen.actionIds).toContain('rotate');
    const { seen } = mount({ features: ['pick'], tools: { spinner }, selectTool: { rotate: false } });
    expect(seen.actionIds).not.toContain('rotate');
  });

  it("lets a consumer's own `actions.rotate` win: the action stays, relabeled, and its handle stays hidden", () => {
    const { seen, isVisible } = mount({
      features: ['pick', 'transform'], selectTool: { rotate: false },
      actions: { rotate: { label: 'Spin' } },
    });
    expect(seen.labels.rotate).toBe('Spin');
    expect(isVisible('selection.rotation-handle')).toBe(false);
  });
});
