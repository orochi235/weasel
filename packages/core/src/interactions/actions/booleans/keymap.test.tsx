/** `PATHFINDER_KEYMAP`: Alt+P, then an operation's key held over a selection — the release runs it, and Escape before the release runs nothing. */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import type { Path } from '@weasel-js/geom';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import { PATHFINDER_KEYMAP } from './keymap';

type P = { x: number; y: number; width: number; height: number };
type D = { path: Path; fill: { paint: { color: string } } };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto['getContext'] = vi.fn(() => null);
  proto['setPointerCapture'] = vi.fn();
  proto['releasePointerCapture'] = vi.fn();
});

const box = (x: number, color: string) => ({
  kind: 'mark' as const,
  layer: 'main' as const,
  pose: { x, y: 0, width: 100, height: 100 },
  data: { path: { kind: 'rect', x: 0, y: 0, width: 1, height: 1 } as Path, fill: { paint: { color } } },
});

function mount() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }], initial: [box(0, 'red'), box(50, 'blue')] });
  const ids = [...scene.renderOrder()];
  let selection: SelectionApi | null = null;
  function Harness() {
    const sel = useSelection({ scene, mode: 'multi' });
    selection = sel;
    return <SceneCanvas features={['draw']} scene={scene} selection={sel} layers={{}} width={400} height={400} ambient={PATHFINDER_KEYMAP} />;
  }
  render(<Harness />);
  act(() => { selection!.set(ids); });
  const send = (type: 'keydown' | 'keyup', key: string, code: string, altKey = false) => {
    act(() => { document.dispatchEvent(new KeyboardEvent(type, { bubbles: true, key, code, altKey })); });
  };
  const leader = () => {
    send('keydown', 'π', 'KeyP', true);
    send('keyup', 'π', 'KeyP', true);
  };
  const count = () => [...scene.renderOrder()].length;
  return { send, leader, count };
}

describe('PATHFINDER_KEYMAP', () => {
  it('runs an operation when its held key comes up, and not before', () => {
    const s = mount();
    s.leader();
    s.send('keydown', 'u', 'KeyU');
    expect(s.count()).toBe(2);
    s.send('keyup', 'u', 'KeyU');
    expect(s.count()).toBe(1);
  });

  it('runs it with the leader held down too', () => {
    const s = mount();
    s.send('keydown', 'π', 'KeyP', true);
    s.send('keydown', '¨', 'KeyU', true);
    s.send('keyup', '¨', 'KeyU', true);
    expect(s.count()).toBe(1);
  });

  it('runs nothing when Escape comes before the release', () => {
    const s = mount();
    s.send('keydown', 'π', 'KeyP', true);
    s.send('keydown', 'u', 'KeyU');
    s.send('keydown', 'Escape', 'Escape');
    s.send('keyup', 'Escape', 'Escape');
    s.send('keyup', 'u', 'KeyU');
    expect(s.count()).toBe(2);
  });
});
