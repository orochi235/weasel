/**
 * `<SceneCanvas features={['edit']}>` answering a real `ClipboardEvent` whose
 * `clipboardData` is a real `DataTransfer` — the two objects jsdom lacks. The
 * event is still constructed here, not produced by Cmd/Ctrl+V against the OS
 * clipboard, so this covers the event's shape and not the browser's choice of
 * which flavors of a copy to put on it.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { SceneCanvas } from './SceneCanvas';
import type { Feature } from './SceneCanvas/features';
import { createScene } from '../core/scene/scene';
import type { Scene } from '../core/scene/types';
import { buildWeaselClipboardText } from '../interactions/actions/clipboard/wireFormat';

type P = { x: number; y: number; width: number; height: number };
type S = Scene<object, 'main', P>;

let root: Root | null = null;
let host: HTMLDivElement | null = null;

afterEach(() => {
  root?.unmount();
  host?.remove();
  root = null;
  host = null;
});

function mount(features: readonly Feature[]): S {
  const scene: S = createScene<object, 'main', P>({ systemLayers: [{ id: 'main' }] });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  flushSync(() => root!.render(
    createElement(SceneCanvas<object, 'main', P>, { features, scene, layers: {}, width: 64, height: 64 }),
  ));
  return scene;
}

function paste(fill: (dt: DataTransfer) => void): ClipboardEvent {
  const clipboardData = new DataTransfer();
  fill(clipboardData);
  const ev = new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true });
  document.body.dispatchEvent(ev);
  return ev;
}

const NODE_TEXT = buildWeaselClipboardText([
  {
    kind: 'leaf', id: 'src-1', layer: 'main', parent: null,
    pose: { x: 10, y: 10, width: 20, height: 20 }, data: {},
  },
]);

const settle = () => new Promise((r) => setTimeout(r, 50));

describe('<SceneCanvas features={["edit"]}> and a real paste event', () => {
  it('pastes copied nodes and claims the event', async () => {
    const scene = mount(['edit']);
    const ev = paste((dt) => dt.setData('text/plain', NODE_TEXT));
    await expect.poll(() => scene.roots.length).toBe(1);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('leaves a pasted image file to the page', async () => {
    const scene = mount(['edit']);
    const ev = paste((dt) => dt.items.add(new File(['x'], 'pic.png', { type: 'image/png' })));
    await settle();
    expect(scene.roots.length).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });

  it('inserts nothing without the edit preset', async () => {
    const scene = mount([]);
    const ev = paste((dt) => dt.setData('text/plain', NODE_TEXT));
    await settle();
    expect(scene.roots.length).toBe(0);
    expect(ev.defaultPrevented).toBe(false);
  });
});
