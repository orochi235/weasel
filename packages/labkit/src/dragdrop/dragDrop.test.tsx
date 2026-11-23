import { act, fireEvent, screen } from '@testing-library/react';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useStore } from 'zustand/react';
import { defineInstrument } from '../instrument/defineInstrument';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';

interface DropState {
  items: { id: string; x: number; y: number }[];
}

const testInstrument = defineInstrument<DropState, Record<string, never>>({
  name: 'TestDrop',
  initialState: () => ({ items: [] }),
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

async function renderLab(probe?: (state: DropState) => void, instrument = testInstrument) {
  return renderSettled(
    <Lab instruments={[instrument]}>{probe ? <StateProbe onState={probe} /> : null}</Lab>,
    { wrapper: withIcons },
  );
}

beforeEach(() => {
  HTMLElement.prototype.getBoundingClientRect = function () {
    // The canvas stack fills the host; its dispatcher is what a drop lands on.
    if (
      this.classList.contains('lk-trial__canvas-host') ||
      this.classList.contains('lk-canvas-stack')
    ) {
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
async function dispatchOnDocument(type: string, init: PointerEventInit) {
  await act(async () => {
    document.dispatchEvent(new PointerEvent(type, { pointerId: 1, bubbles: true, ...init }));
  });
}

async function pointerMove(x: number, y: number) {
  await dispatchOnDocument('pointermove', { buttons: 1, clientX: x, clientY: y });
}

async function pointerUp(x: number, y: number) {
  await dispatchOnDocument('pointerup', { clientX: x, clientY: y });
}

describe('DragDrop integration', () => {
  it('renders palette item in the sidebar', async () => {
    await renderLab();
    expect(screen.getByRole('button', { name: 'Item A' })).toBeInTheDocument();
  });

  it('drops an item onto the canvas and appends it to state', async () => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 0, 0);
    });
    await pointerUp(250, 250);

    expect(latest.items).toHaveLength(1);
    expect(latest.items[0]?.id).toBe('a');
  });

  it('lands on a state update made since the last render rather than overwriting it', async () => {
    let latest: DropState = { items: [] };
    let store: { getState: () => unknown } | undefined;
    function StoreProbe() {
      store = useContext(LabStoreContext)?.store;
      return null;
    }
    await renderSettled(
      <Lab instruments={[testInstrument]}>
        <StateProbe onState={(s) => (latest = s)} />
        <StoreProbe />
      </Lab>,
      { wrapper: withIcons },
    );
    const palette = screen.getByRole('button', { name: 'Item A' });
    await act(async () => {
      pointerDown(palette, 0, 0);
    });
    await act(async () => {
      const s = store?.getState() as {
        trials: { id: string }[];
        updateTrialState: (id: string, next: (prev: DropState) => DropState) => void;
      };
      s.updateTrialState(s.trials[0]!.id, (prev) => ({
        items: [...prev.items, { id: 'queued', x: 0, y: 0 }],
      }));
      document.dispatchEvent(
        new PointerEvent('pointerup', { pointerId: 1, bubbles: true, clientX: 250, clientY: 250 }),
      );
    });

    expect(latest.items.map((i) => i.id)).toEqual(['queued', 'a']);
  });

  it('drop outside the canvas leaves state unchanged', async () => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 0, 0);
    });
    await pointerMove(10, 10);
    await pointerUp(10, 10);

    expect(latest.items).toHaveLength(0);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it('shows drag ghost during drag and clears on drop', async () => {
    await renderLab();
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 5, 5);
    });
    expect(document.querySelector('.lk-drag-ghost')).not.toBeNull();

    await pointerUp(250, 250);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it("draws the ghost in the lab's own portal host, so it takes the lab's theme", async () => {
    await renderLab();
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 5, 5);
    });
    const ghost = document.querySelector('.lk-drag-ghost');
    const host = palette.closest('[data-wzl-portal-host],[data-wzl-theme],[data-wzl-mode]');
    expect(host).not.toBeNull();
    expect(ghost?.closest('[aria-hidden="true"]')?.parentElement).toBe(host);

    await pointerUp(250, 250);
  });

  it('a cancelled gesture drops nothing and clears the ghost', async () => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    });
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 0, 0);
    });
    await pointerMove(250, 250);
    expect(document.querySelector('.lk-drag-ghost')).not.toBeNull();

    await dispatchOnDocument('pointercancel', {});

    expect(latest.items).toHaveLength(0);
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
  });

  it('drops through the instrument world spec, not the canvas top-left', async () => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    }, centredInstrument);
    const palette = screen.getByRole('button', { name: 'Item A' });

    await act(async () => {
      pointerDown(palette, 0, 0);
    });
    // The host spans (100,100)-(500,500), so its centre is at (300,300).
    // Dropping 50px right of centre and 50px above it, at zoom 1, y up.
    await pointerUp(350, 250);

    expect(latest.items[0]).toMatchObject({ x: 50, y: 50 });
  });

  it.each([
    ['the event it declares', testInstrument],
    ['the default undo', { ...testInstrument, name: 'DefaultUndo', undo: undefined }],
  ])('takes a drop back in one undo, under %s', async (_, instrument) => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    }, instrument);
    await act(async () => {
      pointerDown(screen.getByRole('button', { name: 'Item A' }), 0, 0);
    });
    await pointerUp(250, 250);
    expect(latest.items).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(latest.items).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('DragDrop across trials and buttons', () => {
  /** Two trials side by side: the first trial's canvas at x 100–500, the second's at 600–1000. */
  function sideBySide() {
    HTMLElement.prototype.getBoundingClientRect = function () {
      const host = this.closest('.lk-trial__canvas-host');
      if (host && (this === host || this.classList.contains('lk-canvas-stack'))) {
        const i = [...document.querySelectorAll('.lk-trial__canvas-host')].indexOf(host);
        const left = 100 + i * 500;
        return {
          x: left,
          y: 100,
          left,
          top: 100,
          right: left + 400,
          bottom: 500,
          width: 400,
          height: 400,
          toJSON: () => ({}),
        } as DOMRect;
      }
      return originalGetBoundingClientRect.call(this);
    };
  }

  it("refuses an item dragged from one trial's palette onto another trial's canvas", async () => {
    sideBySide();
    let lab: LabContextValue | null = null;
    await renderSettled(
      <Lab instruments={[testInstrument]}>
        <LabContext.Consumer>
          {(value) => {
            lab = value;
            return null;
          }}
        </LabContext.Consumer>
      </Lab>,
      { wrapper: withIcons },
    );
    await act(async () => (lab as LabContextValue | null)?.addTrial('TestDrop'));
    const trials = () => (lab as LabContextValue | null)?.trials ?? [];
    expect(trials()).toHaveLength(2);
    const palettes = screen.getAllByRole('button', { name: 'Item A' });
    await act(async () => {
      pointerDown(palettes[0] as Element, 0, 0);
    });
    // Over the other trial's canvas, then released there.
    await pointerMove(800, 300);
    await pointerUp(800, 300);
    const states = trials().map((t) => (t.state as DropState).items.length);
    expect(states).toEqual([0, 0]);
  });

  it('drops nothing where onDragOver refuses the drop', async () => {
    let latest: DropState = { items: [] };
    const refusing = defineInstrument<DropState, Record<string, never>>({
      ...testInstrument,
      name: 'Refusing',
      dragDrop: {
        ...(testInstrument.dragDrop as NonNullable<typeof testInstrument.dragDrop>),
        onDragOver: () => ({ ok: false, reason: 'full' }),
      },
    });
    await renderLab((s) => {
      latest = s;
    }, refusing);
    await act(async () => {
      pointerDown(screen.getByRole('button', { name: 'Item A' }), 0, 0);
    });
    await pointerUp(250, 250);
    expect(latest.items).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it.each([
    ['middle', 1, 4],
    ['secondary', 2, 2],
  ])('starts no drag on a %s-button press', async (_, button, buttons) => {
    let latest: DropState = { items: [] };
    await renderLab((s) => {
      latest = s;
    });
    await act(async () => {
      fireEvent.pointerDown(screen.getByRole('button', { name: 'Item A' }), {
        pointerId: 1,
        button,
        buttons,
        clientX: 0,
        clientY: 0,
      });
    });
    expect(document.querySelector('.lk-drag-ghost')).toBeNull();
    await pointerUp(250, 250);
    expect(latest.items).toHaveLength(0);
  });
});
