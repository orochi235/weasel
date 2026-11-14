import { fireEvent, render, waitFor } from '@testing-library/react';
import { createMemoryAdapter } from '@weasel-js/storage';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { labPrefix } from '../state/labRecords';
import { Persistence } from '../state/Persistence';
import { PersistedFloatingPanel } from './PersistedFloatingPanel';

// The shared stub reports one size for every element, which makes the panel and
// its container the same box. Report per-target sizes instead, keyed by class,
// because `observe()` fires synchronously inside the effect.
const sizes = { host: { w: 400, h: 300 }, panel: { w: 100, h: 40 } };
const realRO = globalThis.ResizeObserver;
const PANEL = 'lk-test-panel';

beforeEach(() => {
  localStorage.clear();
  globalThis.ResizeObserver = class {
    #cb: ResizeObserverCallback;
    constructor(cb: ResizeObserverCallback) {
      this.#cb = cb;
    }
    observe(target: Element) {
      const { w, h } = target.classList.contains(PANEL) ? sizes.panel : sizes.host;
      const contentRect = { width: w, height: h, x: 0, y: 0, top: 0, left: 0 };
      this.#cb([{ target, contentRect } as ResizeObserverEntry], this);
    }
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
});

afterEach(() => {
  globalThis.ResizeObserver = realRO;
});

const panelIn = (root: HTMLElement) => root.querySelector(`.${PANEL}`) as HTMLElement | null;

function drag(panel: HTMLElement) {
  fireEvent.pointerDown(panel, { clientX: 100, clientY: 100 });
  fireEvent.pointerMove(panel, { clientX: 140, clientY: 60 });
  fireEvent.pointerUp(panel);
}

describe('PersistedFloatingPanel', () => {
  const PLACE = `${labPrefix('fp')}value:lab:legend`;

  function persisted(backing: Map<string, unknown>, ui: ReactElement) {
    return render(
      <Persistence storageKey="fp" storage={createMemoryAdapter(backing)}>
        <div>{ui}</div>
      </Persistence>,
    );
  }

  it('writes its placement under its persist name once dragged', async () => {
    const backing = new Map<string, unknown>();
    const { container } = persisted(
      backing,
      <PersistedFloatingPanel className={PANEL} persist="legend">
        x
      </PersistedFloatingPanel>,
    );
    await waitFor(() => expect(panelIn(container)).not.toBeNull());
    drag(panelIn(container) as HTMLElement);
    await waitFor(() =>
      expect(backing.get(PLACE)).toMatchObject({ x: expect.any(Number), y: expect.any(Number) }),
    );
    expect(backing.get(PLACE)).toHaveProperty('anchor');
  });

  it('restores what it stored on a later mount', async () => {
    const backing = new Map<string, unknown>([[PLACE, { x: 140, y: 90, anchor: null }]]);
    const { container } = persisted(
      backing,
      <PersistedFloatingPanel className={PANEL} persist="legend">
        x
      </PersistedFloatingPanel>,
    );
    // Placed only once both boxes are measured, which can land a render later.
    await waitFor(() => expect(panelIn(container)?.style.left).toBe('140px'));
    expect(panelIn(container)?.style.top).toBe('90px');
  });

  it('writes nothing without a persist name', async () => {
    const backing = new Map<string, unknown>();
    const { container, unmount } = persisted(
      backing,
      <PersistedFloatingPanel className={PANEL}>x</PersistedFloatingPanel>,
    );
    await waitFor(() => expect(panelIn(container)).not.toBeNull());
    drag(panelIn(container) as HTMLElement);
    unmount();
    await new Promise((r) => setTimeout(r, 20));
    expect(backing.size).toBe(0);
  });

  it('forgets its placement with no provider above it', () => {
    const first = render(
      <div>
        <PersistedFloatingPanel className={PANEL} persist="legend">
          x
        </PersistedFloatingPanel>
      </div>,
    );
    drag(panelIn(first.container) as HTMLElement);
    expect(panelIn(first.container)?.style.top).not.toBe('248px');
    first.unmount();

    const { container } = render(
      <div>
        <PersistedFloatingPanel className={PANEL} persist="legend">
          x
        </PersistedFloatingPanel>
      </div>,
    );
    expect(panelIn(container)?.style.left).toBe('12px');
    expect(panelIn(container)?.style.top).toBe('248px');
  });
});
