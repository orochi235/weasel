/**
 * A tool held by an ordinary letter key: it engages at hotkey scope while the
 * key is down, its bindings outrank the viewport's, and its lifecycle
 * callbacks bracket the hold.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import { defineTool, type useTools } from '../tools/overlayBinding';
import type { Action } from '@weasel-js/routing';
import type { View } from 'core/viewport/view';
import { makeGLRecorder } from '../renderer/test-utils/glRecorder';

type D = { color: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});
afterEach(() => cleanup());

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup() {
  const scrub = vi.fn();
  const onActivate = vi.fn();
  const onDeactivate = vi.fn();
  const onViewChange = vi.fn();
  const action: Action = {
    id: 'test.heldScrub',
    label: 'Scrub',
    invoker: { timing: 'immediate', run: (_deps, params) => scrub(params) },
  };
  const tool = defineTool<null>({
    id: 'scrub',
    hotkey: 'o',
    actions: [action],
    bindings: [{ spec: { kind: 'wheel' }, actionId: 'test.heldScrub' }],
    onActivate,
    onDeactivate,
  });
  let tools: ReturnType<typeof useTools> | null = null;
  function Harness() {
    const scene = useScene<D, L, P>({ systemLayers: [{ id: 'main' }], initial: [] });
    return (
      <>
        <input aria-label="field" />
        <SceneCanvas
          scene={scene}
          width={200} height={200}
          layers={{}}
          view={HOME}
          onViewChange={onViewChange}
          tools={{ scrub: tool }}
          onToolsCreated={(t) => { tools = t; }}
        />
      </>
    );
  }
  const { container, unmount } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const wheel = () => act(() => {
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true }));
  });
  const key = (type: 'keydown' | 'keyup', init: KeyboardEventInit, target: EventTarget = window) =>
    act(() => { target.dispatchEvent(new KeyboardEvent(type, { bubbles: true, ...init })); });
  return {
    scrub, onActivate, onDeactivate, onViewChange, wheel, key, container, unmount,
    tools: () => tools!,
  };
}

describe('a tool held by a letter key', () => {
  it('takes the wheel while O is held, and gives it back to the viewport on release', () => {
    const t = setup();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    t.wheel();
    expect(t.scrub).toHaveBeenCalledTimes(1);
    expect(t.onViewChange).not.toHaveBeenCalled();

    t.key('keyup', { key: 'o', code: 'KeyO' });
    t.wheel();
    expect(t.scrub).toHaveBeenCalledTimes(1);
    expect(t.onViewChange).toHaveBeenCalled();
  });

  it('is released by a keyup that reports the key in another case', () => {
    const t = setup();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    t.wheel();
    expect(t.scrub).toHaveBeenCalledTimes(1);
    // Shift went down mid-hold, so the release reads as 'O'.
    t.key('keyup', { key: 'O', code: 'KeyO', shiftKey: true });
    t.wheel();
    expect(t.scrub).toHaveBeenCalledTimes(1);
    expect(t.onViewChange).toHaveBeenCalled();
  });

  it('does not engage while typing in a text field', () => {
    const t = setup();
    const field = t.container.querySelector('input')!;
    t.key('keydown', { key: 'o', code: 'KeyO' }, field);
    t.wheel();
    expect(t.scrub).not.toHaveBeenCalled();
    // The same press outside the field does engage.
    t.key('keydown', { key: 'o', code: 'KeyO' });
    t.wheel();
    expect(t.scrub).toHaveBeenCalledTimes(1);
  });
});

describe('tool lifecycle', () => {
  it('brackets a hold with onActivate and onDeactivate', () => {
    const t = setup();
    expect(t.onActivate).not.toHaveBeenCalled();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    expect(t.onActivate).toHaveBeenCalledTimes(1);
    expect(t.onDeactivate).not.toHaveBeenCalled();
    t.key('keyup', { key: 'o', code: 'KeyO' });
    expect(t.onDeactivate).toHaveBeenCalledTimes(1);
    expect(t.onActivate).toHaveBeenCalledTimes(1);
  });

  it('deactivates a held tool when the window loses focus', () => {
    const t = setup();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(t.onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('fires onActivate and onDeactivate as the tool enters and leaves the active slot', () => {
    const t = setup();
    act(() => t.tools().setActive('scrub'));
    expect(t.onActivate).toHaveBeenCalledTimes(1);
    act(() => t.tools().setActive('select'));
    expect(t.onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('does not re-fire for a tool that is already live in the other slot', () => {
    const t = setup();
    act(() => t.tools().setActive('scrub'));
    t.key('keydown', { key: 'o', code: 'KeyO' });
    t.key('keyup', { key: 'o', code: 'KeyO' });
    expect(t.onActivate).toHaveBeenCalledTimes(1);
    expect(t.onDeactivate).not.toHaveBeenCalled();
  });

  it('deactivates a live tool when the canvas unmounts', () => {
    const t = setup();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    t.unmount();
    expect(t.onDeactivate).toHaveBeenCalledTimes(1);
  });

  it('hands the callbacks the tool scratch', () => {
    const t = setup();
    t.key('keydown', { key: 'o', code: 'KeyO' });
    expect(t.onActivate).toHaveBeenCalledWith({ scratch: null });
  });
});
