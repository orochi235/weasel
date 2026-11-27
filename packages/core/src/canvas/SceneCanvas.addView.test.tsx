import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef } from 'react';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import { SceneCanvas } from './SceneCanvas';
import type { CanvasViewHandle, SceneCanvasApi } from './canvasExtension';
import type { CanvasViewProps } from './canvasViewProps';

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 300, dpr: 1 };
const probe = (color: string): RenderLayer<unknown> => ({
  id: 'probe', label: 'Probe', space: 'screen',
  draw: () => [{ kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: 4, height: 4 }, fill: { paint: { kind: 'solid', color } } }],
});
const pip = (color: string): CanvasViewProps => ({
  id: 'pip', bounds: { x: 0, y: 0, width: 100, height: 100 }, defaultView: ROOT, paint: false, layers: () => [probe(color)],
});

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as Record<string, unknown>).getContext = vi.fn(() => null);
});

const flat = (cmds: readonly DrawCommand[]): DrawCommand[] =>
  cmds.flatMap((c) => (c.kind === 'group' ? [c, ...flat(c.children)] : [c]));

describe('SceneCanvasApi.addView', () => {
  it('stops a handle drawing once a re-add with its id has replaced it', () => {
    const api = createRef<SceneCanvasApi>();
    const scene = createScene<{ kind: 'rect' }, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });
    render(<SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} ref={api} />);
    let first: CanvasViewHandle | undefined;
    let second: CanvasViewHandle | undefined;
    act(() => { first = api.current!.addView(pip('#111111')); });
    expect(flat(first!.draw({}, ROOT, DIMS)).length).toBeGreaterThan(0);
    act(() => { second = api.current!.addView(pip('#222222')); });
    expect(JSON.stringify(second!.draw({}, ROOT, DIMS))).toContain('#222222');
    expect(first!.draw({}, ROOT, DIMS)).toEqual([]);
  });
});
