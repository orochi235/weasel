/**
 * `<SceneCanvas>`'s dev HUDs: that each flag mounts its widget, that the
 * readouts convert the pointer the way the canvas does, and where a HUD pins
 * itself when the canvas paints into a caller's element.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { SceneCanvas } from './SceneCanvas';
import type { WorldPoint } from '@weasel-js/routing';

type P = { x: number; y: number; width: number; height: number };

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

const makeScene = () => createScene<Record<string, never>, 'main', P>({ systemLayers: [{ id: 'main' }] });

async function mount(ui: React.ReactElement): Promise<HTMLElement> {
  let container!: HTMLElement;
  // Each HUD renders nothing until its effect resolves an anchor.
  await act(async () => { ({ container } = render(ui)); });
  return container;
}

describe('<SceneCanvas> HUDs', () => {
  it('renders no HUD when no flag is set', async () => {
    const container = await mount(<SceneCanvas scene={makeScene()} width={200} height={200} />);
    expect(container.querySelectorAll('div').length).toBe(0);
  });

  it('renders the cursor-coords HUD when cursorCoordsHud is set', async () => {
    const container = await mount(
      <SceneCanvas scene={makeScene()} width={200} height={200} cursorCoordsHud />,
    );
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders the pick HUD when pickHud is set', async () => {
    const container = await mount(<SceneCanvas scene={makeScene()} width={200} height={200} pickHud />);
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('renders the modality HUD when modalityHud is set', async () => {
    const container = await mount(
      <SceneCanvas scene={makeScene()} width={200} height={200} modalityHud />,
    );
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
  });

  it('both readouts convert the pointer through the clientToWorld prop', async () => {
    const pickEvery = vi.fn((_world: WorldPoint): string[] => []);
    const container = await mount(
      <SceneCanvas
        scene={makeScene()}
        width={200}
        height={200}
        cursorCoordsHud
        pickHud
        geometry={{ pickEvery }}
        clientToWorld={(_canvas, cx, cy) => [cx + 1000, cy + 2000]}
      />,
    );
    await act(async () => {
      const ev = new Event('pointermove', { bubbles: true });
      Object.defineProperties(ev, { clientX: { value: 0 }, clientY: { value: 0 } });
      document.dispatchEvent(ev);
    });
    expect(pickEvery).toHaveBeenCalledWith({ x: 1000, y: 2000 });
    expect(container.textContent).toContain('(1000.0, 2000.0)');
  });
});

describe('<SceneCanvas> HUDs when detached', () => {
  it('renders the cursor-coords HUD even with no canvas of its own', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);

    const container = await mount(
      <SceneCanvas
        scene={makeScene()}
        width={200}
        height={200}
        paintInto={{ canvas: shared, x: 0, y: 0 }}
        inputElement={input}
        cursorCoordsHud
      />,
    );

    // The HUD is the only thing this render can produce: detached, the canvas
    // renders no element of its own.
    expect(container.querySelectorAll('div').length).toBeGreaterThan(0);
    expect(container.querySelector('canvas')).toBeNull();

    shared.remove();
    input.remove();
  });

  it('holds the HUD until the input element arrives', async () => {
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    document.body.append(shared, input);
    const scene = makeScene();
    const pane = (inputElement: HTMLElement | null) => (
      <SceneCanvas
        scene={scene}
        width={200}
        height={200}
        paintInto={{ canvas: shared, x: 0, y: 0 }}
        inputElement={inputElement}
        cursorCoordsHud
      />
    );

    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(pane(null)); });
    expect(view.container.querySelectorAll('div').length).toBe(0);
    await act(async () => { view.rerender(pane(input)); });
    expect(view.container.querySelectorAll('div').length).toBeGreaterThan(0);

    shared.remove();
    input.remove();
  });

  it('anchors a detached HUD to the input box, not to the shared container', async () => {
    const host = document.createElement('div');
    const shared = document.createElement('canvas');
    const input = document.createElement('div');
    host.append(shared, input);
    document.body.append(host);

    const measured: Element[] = [];
    for (const [el, rect] of [
      [host, { left: 0, top: 0, width: 820, height: 400 }],
      [input, { left: 400, top: 0, width: 380, height: 360 }],
    ] as const) {
      el.getBoundingClientRect = () => {
        measured.push(el);
        return {
          ...rect, right: rect.left + rect.width, bottom: rect.top + rect.height,
        } as DOMRect;
      };
    }

    await mount(
      <SceneCanvas
        scene={makeScene()}
        width={380}
        height={360}
        paintInto={{ canvas: shared, x: 400, y: 0 }}
        inputElement={input}
        cursorCoordsHud
      />,
    );

    // The anchor measured the pane, not the strip it sits in. Both panes'
    // HUDs would otherwise resolve to the same corner.
    expect(measured).toContain(input);
    expect(measured).not.toContain(host);

    host.remove();
  });
});
