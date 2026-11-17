/**
 * `<SceneCanvas snap={{ enabled: false }}>` turns every source off, so the pen
 * places a click where it lands with no modifier held.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { createEvent, act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { PolygonPath } from '@weasel-js/geom';
import { SceneCanvas, createScene } from '@weasel-js/core';
import { gridSnapSourceForTests as gridSource } from '@weasel-js/core/test-seams';
import { pathToolsPreset } from '../presets';
import { usePathToolsTools } from '../toolSets';
import { drawPreset, KIT_TOOL_IDS } from '@weasel-js/editing';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(cleanup);

function clickAt(canvas: HTMLCanvasElement, x: number, y: number) {
  const at = (ev: Event) => {
    Object.defineProperty(ev, 'clientX', { value: x });
    Object.defineProperty(ev, 'clientY', { value: y });
    return ev;
  };
  act(() => {
    canvas.dispatchEvent(at(createEvent.pointerDown(canvas, { pointerId: 1, button: 0, isPrimary: true })));
    canvas.dispatchEvent(at(createEvent.pointerUp(canvas, { pointerId: 1, button: 0, isPrimary: true })));
  });
}

/** The coordinates of the path the pen commits from clicks at each of `points`. */
function penAnchors(enabled: boolean, points: readonly { x: number; y: number }[]) {
  const scene = createScene({ systemLayers: [{ id: 'main' }] });
  function Harness() {
    return (
      <SceneCanvas
        features={[drawPreset, pathToolsPreset]} tools={usePathToolsTools()} scene={scene} width={200} height={200} layers={{}}
        defaultTools={KIT_TOOL_IDS} defaultActiveTool="pen"
        snap={{ sources: [gridSource(10)], enabled }}
      />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas') as HTMLCanvasElement;
  for (const p of points) clickAt(canvas, p.x, p.y);
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  const node = scene.renderOrderNodes().find((n) => n.kind === 'mark')!;
  return Array.from((node.data as { path: PolygonPath }).path.coords);
}

describe('snapping turned off on a canvas', () => {
  it('lets the pen place a click unsnapped, with no modifier held', () => {
    expect(penAnchors(false, [{ x: 12, y: 18 }, { x: 63, y: 47 }])).toEqual([12, 18, 63, 47]);
  });

  it('snaps the same clicks while it is on', () => {
    expect(penAnchors(true, [{ x: 12, y: 18 }, { x: 63, y: 47 }])).toEqual([10, 20, 60, 50]);
  });
});
