import { act, cleanup, render } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DiagramView, type DiagramViewApi } from './DiagramView';
import { diagramScene, type DiagramData, type DiagramSpec } from './fromData';

afterEach(() => { cleanup(); });

const DATA: DiagramData = {
  nodes: [{ id: 'a', lines: ['a'] }, { id: 'b', lines: ['b'] }, { id: 'c', lines: ['c'] }],
  edges: [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }],
};

/** `specs` with every node shoved sideways off where the layout put it. */
const scrambled = (specs: DiagramSpec[]): DiagramSpec[] =>
  specs.map((s, i) => ({ ...s, pose: { ...s.pose, x: s.pose.x + i * 37 } }));

function makeClock() {
  const callbacks = new Map<number, (t: number) => void>();
  let next = 1;
  return {
    requestFrame: (cb: (t: number) => void) => { callbacks.set(next, cb); return next++; },
    cancelFrame: (h: number) => { callbacks.delete(h); },
    run() {
      for (let i = 0; i < 50 && callbacks.size > 0; i++) {
        const due = [...callbacks.values()];
        callbacks.clear();
        for (const cb of due) cb(0);
      }
    },
  };
}

describe('DiagramView', () => {
  it('does not report a reconciled spec change as a move', async () => {
    const onMove = vi.fn();
    const specs = diagramScene(DATA);
    const { rerender } = render(<DiagramView specs={specs} width={300} height={300} onMove={onMove} />);
    await act(async () => {
      rerender(<DiagramView specs={scrambled(specs)} width={300} height={300} onMove={onMove} />);
    });
    expect(onMove).not.toHaveBeenCalled();
  });

  it('reports what a layout run moved, once it settles', async () => {
    const onMove = vi.fn();
    const clock = makeClock();
    const api = createRef<DiagramViewApi>();
    render(
      <DiagramView
        ref={api}
        specs={scrambled(diagramScene(DATA))}
        width={300}
        height={300}
        onMove={onMove}
        live={{ frames: 2, requestFrame: clock.requestFrame, cancelFrame: clock.cancelFrame }}
      />,
    );
    await act(async () => { api.current!.layout('layered'); });
    await act(async () => { clock.run(); });
    expect(onMove).toHaveBeenCalledTimes(1);
    const ids = onMove.mock.calls[0]![0].map((m: { id: string }) => m.id).sort();
    expect(ids).toEqual(['b', 'c']);
  });
});

describe('DiagramView keyboard', () => {
  const spaceOnBody = async () => {
    const e = new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true, cancelable: true });
    await act(async () => { document.body.dispatchEvent(e); });
    await act(async () => {
      document.body.dispatchEvent(new KeyboardEvent('keyup', { key: ' ', code: 'Space', bubbles: true }));
    });
    return e;
  };

  it('leaves held Space to the page when the diagram is view-only', async () => {
    render(<DiagramView specs={diagramScene(DATA)} width={300} height={300} />);
    expect((await spaceOnBody()).defaultPrevented).toBe(false);
  });

  it('claims held Space for panning when the diagram is editable', async () => {
    render(<DiagramView specs={diagramScene(DATA)} width={300} height={300} onMove={() => {}} />);
    expect((await spaceOnBody()).defaultPrevented).toBe(true);
  });

  it('follows enableKeybindings over the default', async () => {
    render(<DiagramView specs={diagramScene(DATA)} width={300} height={300} onMove={() => {}} enableKeybindings={false} />);
    expect((await spaceOnBody()).defaultPrevented).toBe(false);
  });
});
