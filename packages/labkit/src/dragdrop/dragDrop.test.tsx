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
    ctx?.store ?? ({ getState: () => ({ workspaces: [] }) } as never),
    (s) => (s as { workspaces: { state: unknown }[] }).workspaces[0],
  );
  if (ws) onState(ws.state as DropState);
  return null;
}

// biome-ignore lint/suspicious/noExplicitAny: cross-generic instrument array
const instruments: any[] = [testInstrument];

function renderLab(probe?: (state: DropState) => void) {
  return render(
    <Lab instruments={instruments} defaultInstrument="TestDrop">
      {probe ? <StateProbe onState={probe} /> : null}
    </Lab>,
  );
}

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    if (this.classList.contains('lk-workspace__canvas-host')) {
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
  fireEvent.pointerDown(el, { clientX: x, clientY: y });
}

function windowPointerMove(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointermove', { clientX: x, clientY: y, bubbles: true }));
  });
}

function windowPointerUp(x: number, y: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent('pointerup', { clientX: x, clientY: y, bubbles: true }));
  });
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
    windowPointerUp(250, 250);

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
    windowPointerMove(10, 10);
    windowPointerUp(10, 10);

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

    windowPointerUp(250, 250);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });
});
