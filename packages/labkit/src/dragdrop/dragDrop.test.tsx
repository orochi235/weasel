import { act, fireEvent, render, screen } from '@testing-library/react';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from 'zustand/react';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabStoreContext } from '../state/context';

interface DropState {
  items: { id: string; x: number; y: number }[];
}

const testInstrument = defineInstrument<DropState, Record<string, never>>({
  name: 'TestDrop',
  defaultConfig: () => ({}),
  initialState: () => ({ items: [] }),
  configSchema: () => [],
  render: () => null,
  canvas: {
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    layers: [{ id: 'main', draw: () => undefined }],
  },
  dragDrop: {
    palette: [{ id: 'a', label: 'Item A' }],
    onDrop: (worldPos, item, state) => ({
      items: [...state.items, { id: item.id, x: worldPos.x, y: worldPos.y }],
    }),
  },
  undo: { snapshotOn: ['canvas.itemAdded'], maxDepth: 10 },
});

const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;

function StateProbe({ onState }: { onState: (state: DropState) => void }) {
  const ctx = useContext(LabStoreContext);
  const ws = useStore(
    ctx?.store ?? ({ getState: () => ({ trials: [] }) } as never),
    (s) => (s as { trials: { state: unknown }[] }).trials[0],
  );
  if (ws) onState(ws.state as DropState);
  return null;
}

const centredInstrument = defineInstrument<DropState, Record<string, never>>({
  ...testInstrument,
  name: 'CentredDrop',
  canvas: {
    worldSpec: { origin: { x: 0.5, y: 0.5 }, yAxis: 'up' },
    initialView: { zoom: 1, pan: { x: 0, y: 0 } },
    layers: [{ id: 'main', draw: () => undefined }],
  },
});

function renderLab(probe?: (state: DropState) => void, instrument = testInstrument) {
  return render(
    <Lab instruments={[instrument]} defaultInstrument={instrument.name}>
      {probe ? <StateProbe onState={probe} /> : null}
    </Lab>,
  );
}

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('lk-trial__canvas-host')) {
      return {
        x: 100,
        y: 100,
        left: 100,
        top: 100,
        right: 500,
        bottom: 500,
        width: 400,
        height: 400,
        toJSON: () => ({}),
      } as DOMRect;
    }
    return originalGetBoundingClientRect.call(this);
  };
});

afterEach(() => {
  HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
});

function pointerDown(el: Element, x: number, y: number) {
  fireEvent.pointerDown(el, { pointerId: 1, buttons: 1, clientX: x, clientY: y });
}

/** The session listens on the document, so that is where the rest of the
 *  gesture has to arrive — a dispatch on `window` reaches nothing. */
function dispatchOnDocument(type: string, init: PointerEventInit) {
  act(() => {
    document.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, ...init }));
  });
}

function pointerMove(x: number, y: number) {
  dispatchOnDocument('pointermove', { buttons: 1, clientX: x, clientY: y });
}

function pointerUp(x: number, y: number) {
  dispatchOnDocument('pointerup', { clientX: x, clientY: y });
}

describe('DragDrop integration', () => {
  it('renders palette item in the sidebar', () => {
    renderLab();
    expect(screen.getByRole('button', { name: 'Item A' })).toBeInTheDocument();
  });

  it('drops an item onto the canvas and appends it to state', () => {
    let latest: DropState = { items: [] };
    renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    act(() => {
      pointerDown(palette, 0, 0);
    });
    pointerUp(250, 250);

    expect(latest.items).toHaveLength(1);
    expect(latest.items[0]?.id).toBe('a');
  });

  it('drop outside the canvas leaves state unchanged', () => {
    let latest: DropState = { items: [] };
    renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    act(() => {
      pointerDown(palette, 0, 0);
    });
    pointerMove(10, 10);
    pointerUp(10, 10);

    expect(latest.items).toHaveLength(0);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it('shows drag ghost during drag and clears on drop', () => {
    renderLab();
    const palette = screen.getByRole('button', { name: 'Item A' });

    act(() => {
      pointerDown(palette, 5, 5);
    });
    expect(document.querySelector('.lk-drag-ghost')).not.toBeNull();

    pointerUp(250, 250);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it('a cancelled gesture drops nothing and clears the ghost', () => {
    let latest: DropState = { items: [] };
    renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    act(() => {
      pointerDown(palette, 0, 0);
    });
    pointerMove(250, 250);
    expect(document.querySelector('.lk-drag-ghost')).not.toBeNull();

    dispatchOnDocument('pointercancel', {});

    expect(latest.items).toHaveLength(0);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it('drops through the instrument world spec, not the canvas top-left', () => {
    let latest: DropState = { items: [] };
    renderLab((s) => {
      latest = s;
    }, centredInstrument);
    const palette = screen.getByRole('button', { name: 'Item A' });

    act(() => {
      pointerDown(palette, 0, 0);
    });
    // The host spans (100,100)-(500,500), so its centre is at (300,300).
    // Dropping 50px right of centre and 50px above it, at zoom 1, y up.
    pointerUp(350, 250);

    expect(latest.items[0]).toMatchObject({ x: 50, y: 50 });
  });
});
